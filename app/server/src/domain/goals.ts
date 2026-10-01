// domain/goals.ts: tujuan keuangan, alokasi dana, dan pemakaiannya (PRD FR13, FR14, §07).
// Alokasi hanya menandai sebagian saldo dompet; ia tidak membuat jurnal sendiri dan tidak
// pernah menurunkan saldo. Uang benar-benar berpindah hanya lewat transfer atau belanja nyata.
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { addSafe, formatIDR, parseAmount } from '../core/money.ts';
import { compareDate, isValidIsoDate, localDateInTz } from '../core/dates.ts';
import { all, one, run, tx, type Db } from '../db/index.ts';
import { accountBalance, categoryAccountId, postJournal, walletAccountId } from './ledger.ts';
import { buildGoalSpend } from './posting.ts';
import { recordAudit } from './audit.ts';
import { withIdempotency } from './idempotency.ts';
import { insertTransaction } from './transaction-store.ts';
import { createTransaction, type TxContext } from './transactions.ts';

export type GoalStatus = 'active' | 'achieved' | 'archived';
export type AllocationDirection = 'allocate' | 'release';

export interface GoalRow {
  id: string;
  workspace_id: string;
  name: string;
  target_minor: number;
  target_date: string | null;
  priority: number;
  status: GoalStatus;
  note: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GoalAllocationRow {
  id: string;
  workspace_id: string;
  goal_id: string;
  wallet_id: string;
  direction: AllocationDirection;
  amount_minor: number;
  effective_date: string;
  note: string | null;
  linked_tx_id: string | null;
  reversed_by: string | null;
  created_at: string;
}

export interface GoalAllocationView extends GoalAllocationRow {
  walletName: string;
}

/** Ketersediaan dana nyata untuk satu dompet yang dipakai goal. */
export interface GoalFunding {
  walletId: string;
  walletName: string;
  allocated: number;
  walletBalance: number;
  /** Bagian alokasi yang tidak lagi tertutup saldo dompet (PRD §07 "Dana tujuan kurang"). */
  shortfall: number;
}

export interface GoalView extends GoalRow {
  /** Neto alokasi aktif: jumlah allocate − release, dikurangi baris yang sudah di-reversed_by. */
  allocated: number;
  /** allocated ÷ target apa adanya (boleh lebih dari 1 saat kelebihan alokasi). */
  progress: number;
  /** Nilai progres untuk tampilan, dibatasi 0..1. */
  progressDisplay: number;
  /** Kekurangan menuju target, tidak pernah negatif. */
  shortfall: number;
  /** Setoran bulanan yang disarankan; null bila tanpa tanggal target atau tanggalnya sudah lewat. */
  monthlyPlan: number | null;
  monthsRemaining: number | null;
  funding: GoalFunding[];
  /** Total kekurangan dana dari seluruh dompet (PRD AT17). */
  fundingShortfall: number;
  insufficient: boolean;
  reachedTarget: boolean;
}

export interface GoalDetail extends GoalView {
  allocations: GoalAllocationView[];
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'Tinggi', 2: 'Sedang', 3: 'Rendah' };

// ── validasi ────────────────────────────────────────────────────────────────

function assertName(value: unknown): string {
  const name = String(value ?? '').trim();
  if (!name) throw new AppError('validation_failed', 'Nama tujuan wajib diisi.', { fields: { name: 'required' } });
  if (name.length > 120) throw new AppError('validation_failed', 'Nama tujuan maksimal 120 karakter.', { fields: { name: 'too_long' } });
  return name;
}

function assertTarget(value: unknown): number {
  return parseAmount(value, { field: 'target' });
}

function assertOptionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !isValidIsoDate(value)) {
    throw new AppError('validation_failed', 'Tanggal target belum benar. Pakai format tanggal yang benar.', { fields: { [field]: 'invalid' } });
  }
  return value;
}

function assertPriority(value: unknown): number {
  const priority = Number(value ?? 2);
  if (!Number.isInteger(priority) || priority < 1 || priority > 3) {
    throw new AppError('validation_failed', 'Prioritas harus 1 (tinggi), 2 (sedang), atau 3 (rendah).', { fields: { priority: 'invalid' } });
  }
  return priority;
}

function assertStatus(value: unknown): GoalStatus {
  const status = String(value ?? '').trim() as GoalStatus;
  if (status !== 'active' && status !== 'achieved' && status !== 'archived') {
    throw new AppError('validation_failed', 'Status tujuan harus Aktif, Tercapai, atau Diarsipkan.', { fields: { status: 'invalid' } });
  }
  return status;
}

function assertNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const note = String(value).trim();
  if (note.length > 500) throw new AppError('validation_failed', 'Catatan terlalu panjang (maksimal 500 karakter).', { fields: { note: 'too_long' } });
  return note || null;
}

function assertEffectiveDate(value: unknown, tz: string, field = 'effectiveDate'): string {
  if (value === undefined || value === null || value === '') return localDateInTz(tz);
  if (typeof value !== 'string' || !isValidIsoDate(value)) {
    throw new AppError('validation_failed', 'Tanggal belum benar. Pakai format tanggal yang benar.', { fields: { [field]: 'invalid' } });
  }
  if (compareDate(value, localDateInTz(tz)) > 0) {
    throw new AppError('validation_failed', 'Tanggal alokasi tidak boleh di masa depan. Catat alokasi saat dana benar-benar ditandai.', { fields: { [field]: 'future' } });
  }
  return value;
}

async function assertWallet(db: Db, workspaceId: string, walletId: unknown, field = 'walletId'): Promise<{ id: string; name: string; accountId: string }> {
  if (typeof walletId !== 'string' || !walletId) {
    throw new AppError('validation_failed', 'Dompet wajib dipilih.', { fields: { [field]: 'required' } });
  }
  const row = await one<{ id: string; name: string; ledger_account_id: string; archived_at: string | null }>(
    db, `SELECT id, name, ledger_account_id, archived_at FROM wallets WHERE workspace_id = ? AND id = ?`, workspaceId, walletId,
  );
  if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
  if (row.archived_at) throw new AppError('validation_failed', 'Dompet ini sudah diarsipkan. Pilih dompet aktif.', { fields: { [field]: 'archived' } });
  return { id: row.id, name: row.name, accountId: row.ledger_account_id };
}

async function getGoalRow(db: Db, workspaceId: string, id: string): Promise<GoalRow> {
  const row = await one<GoalRow>(db, `SELECT * FROM goals WHERE workspace_id = ? AND id = ?`, workspaceId, id);
  if (!row) throw new AppError('not_found', 'Tujuan tidak ditemukan di ruang keuangan ini.');
  return row;
}

// ── turunan alokasi ─────────────────────────────────────────────────────────

interface WalletAllocation {
  goalId: string;
  walletId: string;
  net: number;
}

/** Alokasi aktif per (goal, dompet): baris yang sudah di-reversed_by tidak dihitung. */
async function activeAllocations(db: Db, workspaceId: string): Promise<WalletAllocation[]> {
  const rows = await all<{ goal_id: string; wallet_id: string; net: number }>(
    db,
    `SELECT goal_id, wallet_id,
            SUM(CASE WHEN direction = 'allocate' THEN amount_minor ELSE -amount_minor END) AS net
     FROM goal_allocations
     WHERE workspace_id = ? AND reversed_by IS NULL
     GROUP BY goal_id, wallet_id`,
    workspaceId,
  );
  const allocations: WalletAllocation[] = [];
  for (const row of rows) {
    allocations.push({ goalId: row.goal_id, walletId: row.wallet_id, net: Number(row.net ?? 0) });
  }
  return allocations;
}

async function walletLookup(db: Db, workspaceId: string, walletIds: readonly string[]): Promise<Map<string, { name: string; accountId: string }>> {
  const map = new Map<string, { name: string; accountId: string }>();
  for (const walletId of new Set(walletIds)) {
    const row = await one<{ name: string; ledger_account_id: string }>(
      db, `SELECT name, ledger_account_id FROM wallets WHERE workspace_id = ? AND id = ?`, workspaceId, walletId,
    );
    if (row) map.set(walletId, { name: row.name, accountId: row.ledger_account_id });
  }
  return map;
}

function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty * 12 + (tm - 1)) - (fy * 12 + (fm - 1));
}

async function buildGoalView(
  db: Db,
  workspaceId: string,
  row: GoalRow,
  today: string,
  allocations: readonly WalletAllocation[],
  wallets: Map<string, { name: string; accountId: string }>,
): Promise<GoalView> {
  const mine = allocations.filter((entry) => entry.goalId === row.id);
  const allocated = mine.reduce((sum, entry) => addSafe(sum, entry.net), 0);

  const funding: GoalFunding[] = [];
  for (const entry of mine) {
    const wallet = wallets.get(entry.walletId);
    const balance = wallet ? await accountBalance(db, workspaceId, wallet.accountId) : 0;
    const usable = balance > 0 ? balance : 0;
    const shortfall = entry.net > usable ? entry.net - usable : 0;
    funding.push({
      walletId: entry.walletId,
      walletName: wallet?.name ?? 'Dompet tidak dikenal',
      allocated: entry.net,
      walletBalance: balance,
      shortfall,
    });
  }
  const fundingShortfall = funding.reduce((sum, entry) => addSafe(sum, entry.shortfall), 0);

  const shortfall = row.target_minor - allocated > 0 ? row.target_minor - allocated : 0;
  const monthsRemaining = row.target_date ? monthDiff(today, row.target_date) : null;
  const monthlyPlan = row.target_date && monthsRemaining !== null && monthsRemaining > 0
    ? Math.ceil(shortfall / monthsRemaining)
    : null;

  return {
    ...row,
    allocated,
    progress: allocated / row.target_minor,
    progressDisplay: Math.min(1, Math.max(0, allocated / row.target_minor)),
    shortfall,
    monthlyPlan,
    monthsRemaining,
    funding,
    fundingShortfall,
    insufficient: fundingShortfall > 0,
    reachedTarget: allocated >= row.target_minor,
  };
}

// ── FR13: tujuan keuangan ───────────────────────────────────────────────────

export async function listGoals(ctx: TxContext, options: { includeArchived?: boolean; status?: GoalStatus } = {}): Promise<GoalView[]> {
  const { db, workspaceId } = ctx;
  const where = ['workspace_id = ?'];
  const params: unknown[] = [workspaceId];
  if (options.status) {
    where.push('status = ?');
    params.push(options.status);
  } else if (!options.includeArchived) {
    where.push(`status <> 'archived'`);
  }
  const rows = await all<GoalRow>(db, `SELECT * FROM goals WHERE ${where.join(' AND ')} ORDER BY priority, created_at`, ...params);
  const allocations = await activeAllocations(db, workspaceId);
  const wallets = await walletLookup(db, workspaceId, allocations.map((entry) => entry.walletId));
  const today = localDateInTz(ctx.timezone);
  const views: GoalView[] = [];
  for (const row of rows) {
    views.push(await buildGoalView(db, workspaceId, row, today, allocations, wallets));
  }
  return views;
}

export async function getGoal(ctx: TxContext, id: string): Promise<GoalDetail> {
  const { db, workspaceId } = ctx;
  const row = await getGoalRow(db, workspaceId, id);
  const allocations = await activeAllocations(db, workspaceId);
  const wallets = await walletLookup(db, workspaceId, allocations.map((entry) => entry.walletId));
  const today = localDateInTz(ctx.timezone);
  const view = await buildGoalView(db, workspaceId, row, today, allocations, wallets);
  const history = (await all<GoalAllocationRow>(
    db,
    `SELECT * FROM goal_allocations WHERE workspace_id = ? AND goal_id = ? ORDER BY effective_date DESC, created_at DESC`,
    workspaceId, id,
  )).map((entry) => ({ ...entry, walletName: wallets.get(entry.wallet_id)?.name ?? 'Dompet tidak dikenal' }));
  return { ...view, allocations: history };
}

export interface CreateGoalInput {
  name: string;
  target: unknown;
  targetDate?: string | null;
  priority?: number;
  note?: string | null;
}

export async function createGoal(ctx: TxContext, input: CreateGoalInput, idempotencyKey?: string | null): Promise<GoalView> {
  const { db, workspaceId } = ctx;
  const name = assertName(input.name);
  const target = assertTarget(input.target);
  const targetDate = assertOptionalDate(input.targetDate, 'targetDate');
  const priority = assertPriority(input.priority);
  const note = assertNote(input.note);

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { name, target, targetDate, priority, note } },
    () => tx(db, async () => {
      const id = uuidv7();
      const now = nowIso();
      await run(
        db,
        `INSERT INTO goals (id, workspace_id, name, target_minor, target_date, priority, status, note, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?)`,
        id, workspaceId, name, target, targetDate, priority, note, now, now,
      );
      await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'create', entityType: 'goal', entityId: id, after: { name, target, targetDate, priority } });
      return await getGoal(ctx, id);
    }),
  );
  return outcome.value;
}

export interface UpdateGoalInput {
  name?: string;
  target?: unknown;
  targetDate?: string | null;
  priority?: number;
  note?: string | null;
  status?: GoalStatus | string;
  expectedVersion?: number;
}

export async function updateGoal(ctx: TxContext, id: string, input: UpdateGoalInput): Promise<GoalView> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    const row = await getGoalRow(db, workspaceId, id);
    if (input.expectedVersion !== undefined && input.expectedVersion !== row.version) {
      throw new AppError('version_conflict', 'Tujuan ini sudah berubah di perangkat lain. Muat ulang lalu ulangi perubahan.', { details: { serverVersion: row.version } });
    }
    const name = input.name === undefined ? row.name : assertName(input.name);
    const target = input.target === undefined ? row.target_minor : assertTarget(input.target);
    const targetDate = input.targetDate === undefined ? row.target_date : assertOptionalDate(input.targetDate, 'targetDate');
    const priority = input.priority === undefined ? row.priority : assertPriority(input.priority);
    const note = input.note === undefined ? row.note : assertNote(input.note);
    const status = input.status === undefined ? row.status : assertStatus(input.status);

    if (status === 'archived' && row.status !== 'archived') {
      const active = (await activeAllocations(db, workspaceId)).filter((entry) => entry.goalId === id && entry.net > 0);
      if (active.length > 0) {
        throw new AppError('validation_failed', 'Tujuan ini masih memiliki alokasi dana. Lepaskan atau pindahkan alokasinya dulu sebelum diarsipkan.', { fields: { status: 'has_allocation' } });
      }
    }

    await run(
      db,
      `UPDATE goals SET name = ?, target_minor = ?, target_date = ?, priority = ?, note = ?, status = ?, version = version + 1, updated_at = ?
       WHERE workspace_id = ? AND id = ?`,
      name, target, targetDate, priority, note, status, nowIso(), workspaceId, id,
    );
    await recordAudit(db, {
      workspaceId, actorUserId: ctx.userId, action: 'update', entityType: 'goal', entityId: id,
      before: { name: row.name, target: row.target_minor, targetDate: row.target_date, priority: row.priority, status: row.status },
      after: { name, target, targetDate, priority, status },
    });
    return await getGoal(ctx, id);
  });
}

// ── FR14: alokasi, pelepasan, dan pemakaian dana ────────────────────────────

interface AllocationAvailability {
  /** Alokasi aktif per dompet untuk seluruh tujuan (bukan hanya tujuan ini). */
  allocatedTotal: number;
  usable: number;
  existingForGoal: number;
}

async function availabilityFor(db: Db, workspaceId: string, goalId: string, wallet: { id: string; name: string; accountId: string }): Promise<AllocationAvailability> {
  const rows = (await activeAllocations(db, workspaceId)).filter((entry) => entry.walletId === wallet.id);
  const allocatedTotal = rows.reduce((sum, entry) => addSafe(sum, entry.net), 0);
  const balance = await accountBalance(db, workspaceId, wallet.accountId);
  return {
    allocatedTotal,
    usable: balance > 0 ? balance : 0,
    existingForGoal: rows.filter((entry) => entry.goalId === goalId).reduce((sum, entry) => addSafe(sum, entry.net), 0),
  };
}

export interface AllocateGoalInput {
  walletId: string;
  amount: unknown;
  effectiveDate?: string;
  note?: string | null;
  /** "Pindahkan uang sekaligus": transfer nyata ke dompet tujuan, lalu alokasi dalam satu proses. */
  moveMoney?: boolean;
  toWalletId?: string;
}

export interface AllocateGoalResult {
  goal: GoalDetail;
  allocation: GoalAllocationView;
  transferId: string | null;
}

/**
 * Alokasi menandai sebagian saldo dompet untuk tujuan, tanpa menggerakkan uang (FR14).
 * Total alokasi aktif per dompet tidak boleh melebihi saldo positif dompet, sehingga dana yang
 * sama tidak dapat dipakai dua tujuan sekaligus. Tidak ada jurnal yang dibuat di sini.
 */
export async function allocateGoal(ctx: TxContext, id: string, input: AllocateGoalInput, idempotencyKey?: string | null): Promise<AllocateGoalResult> {
  const { db, workspaceId } = ctx;
  const amount = parseAmount(input.amount, { field: 'amount' });
  const effectiveDate = assertEffectiveDate(input.effectiveDate, ctx.timezone);
  const note = assertNote(input.note);
  const moveMoney = input.moveMoney === true;
  const target = moveMoney ? await assertWallet(db, workspaceId, input.toWalletId, 'toWalletId') : await assertWallet(db, workspaceId, input.walletId);
  const source = moveMoney ? await assertWallet(db, workspaceId, input.walletId, 'walletId') : null;

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, amount, effectiveDate, note, moveMoney, walletId: source?.id ?? target.id, toWalletId: moveMoney ? target.id : null } },
    () => tx(db, async () => {
      await getGoalRow(db, workspaceId, id);
      let transferId: string | null = null;
      if (moveMoney && source) {
        if (source.id === target.id) {
          throw new AppError('validation_failed', 'Dompet asal dan dompet tujuan harus berbeda.', { fields: { toWalletId: 'same_wallet' } });
        }
        transferId = (await createTransaction(ctx, {
          type: 'transfer',
          amount,
          walletId: source.id,
          toWalletId: target.id,
          effectiveDate,
          note: note ?? 'Pindahkan dana ke dompet tujuan',
        }, null)).id;
      }

      const availability = await availabilityFor(db, workspaceId, id, target);
      if (addSafe(availability.allocatedTotal, amount) > availability.usable) {
        const free = availability.usable - availability.allocatedTotal;
        throw new AppError(
          'allocation_exceeds',
          `Alokasi melebihi dana dompet ${target.name} yang masih bebas. Dana bebas saat ini ${formatIDR(free > 0 ? free : 0)}.`,
          { details: { walletBalance: availability.usable, allocatedTotal: availability.allocatedTotal, free: free > 0 ? free : 0 } },
        );
      }

      const allocationId = uuidv7();
      const now = nowIso();
      await run(
        db,
        `INSERT INTO goal_allocations (id, workspace_id, goal_id, wallet_id, direction, amount_minor, effective_date, note, linked_tx_id, reversed_by, created_at)
         VALUES (?, ?, ?, ?, 'allocate', ?, ?, ?, ?, NULL, ?)`,
        allocationId, workspaceId, id, target.id, amount, effectiveDate, note, transferId, now,
      );
      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'allocate', entityType: 'goal', entityId: id,
        after: { allocationId, walletId: target.id, amount, effectiveDate, transferId },
      });

      const goal = await getGoal(ctx, id);
      const allocation = goal.allocations.find((entry) => entry.id === allocationId);
      if (!allocation) throw new AppError('internal', 'Alokasi tersimpan tetapi tidak dapat dibaca kembali.');
      return { goal, allocation, transferId };
    }),
  );
  return outcome.value;
}

export interface ReleaseGoalInput {
  walletId: string;
  amount: unknown;
  effectiveDate?: string;
  note?: string | null;
}

/** Pelepasan hanya melepaskan dana yang ditandai; ia tidak menciptakan pendapatan (FR14). */
export async function releaseGoal(ctx: TxContext, id: string, input: ReleaseGoalInput, idempotencyKey?: string | null): Promise<AllocateGoalResult> {
  const { db, workspaceId } = ctx;
  const amount = parseAmount(input.amount, { field: 'amount' });
  const effectiveDate = assertEffectiveDate(input.effectiveDate, ctx.timezone);
  const note = assertNote(input.note);
  const wallet = await assertWallet(db, workspaceId, input.walletId);

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, amount, effectiveDate, note, walletId: wallet.id } },
    () => tx(db, async () => {
      await getGoalRow(db, workspaceId, id);
      const availability = await availabilityFor(db, workspaceId, id, wallet);
      if (amount > availability.existingForGoal) {
        throw new AppError(
          'allocation_exceeds',
          `Dana yang dilepas melebihi alokasi aktif tujuan ini di dompet ${wallet.name}. Alokasi aktifnya ${formatIDR(availability.existingForGoal)}.`,
          { details: { allocatedForGoal: availability.existingForGoal, requested: amount } },
        );
      }
      const allocationId = uuidv7();
      await run(
        db,
        `INSERT INTO goal_allocations (id, workspace_id, goal_id, wallet_id, direction, amount_minor, effective_date, note, linked_tx_id, reversed_by, created_at)
         VALUES (?, ?, ?, ?, 'release', ?, ?, ?, NULL, NULL, ?)`,
        allocationId, workspaceId, id, wallet.id, amount, effectiveDate, note, nowIso(),
      );
      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'release', entityType: 'goal', entityId: id,
        after: { allocationId, walletId: wallet.id, amount, effectiveDate },
      });
      const goal = await getGoal(ctx, id);
      const allocation = goal.allocations.find((entry) => entry.id === allocationId);
      if (!allocation) throw new AppError('internal', 'Pelepasan alokasi tersimpan tetapi tidak dapat dibaca kembali.');
      return { goal, allocation, transferId: null };
    }),
  );
  return outcome.value;
}

export interface SpendFromGoalInput {
  walletId: string;
  categoryId: string;
  amount: unknown;
  effectiveDate?: string;
  note?: string | null;
}

export interface SpendFromGoalResult {
  goal: GoalDetail;
  transactionId: string;
}

/**
 * Belanja dari dana tujuan: uang benar-benar keluar dari dompet dan menjadi konsumsi nyata,
 * lalu alokasi dikurangi sebesar nilai belanja (FR14, AT06).
 */
export async function spendFromGoal(ctx: TxContext, id: string, input: SpendFromGoalInput, idempotencyKey?: string | null): Promise<SpendFromGoalResult> {
  const { db, workspaceId } = ctx;
  const amount = parseAmount(input.amount, { field: 'amount' });
  const effectiveDate = assertEffectiveDate(input.effectiveDate, ctx.timezone);
  const note = assertNote(input.note);
  const wallet = await assertWallet(db, workspaceId, input.walletId);
  if (typeof input.categoryId !== 'string' || !input.categoryId) {
    throw new AppError('validation_failed', 'Kategori pengeluaran wajib dipilih.', { fields: { categoryId: 'required' } });
  }
  const category = await one<{ id: string; name: string; kind: string; archived_at: string | null }>(
    db, `SELECT id, name, kind, archived_at FROM categories WHERE workspace_id = ? AND id = ?`, workspaceId, input.categoryId,
  );
  if (!category) throw new AppError('not_found', 'Kategori tidak ditemukan di ruang keuangan ini.');
  if (category.archived_at) throw new AppError('validation_failed', 'Kategori ini sudah diarsipkan. Pilih kategori aktif.', { fields: { categoryId: 'archived' } });
  if (category.kind !== 'expense') {
    throw new AppError('validation_failed', 'Pilih kategori pengeluaran, bukan kategori pendapatan.', { fields: { categoryId: 'wrong_kind' } });
  }

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, amount, effectiveDate, note, walletId: wallet.id, categoryId: category.id } },
    () => tx(db, async () => {
      await getGoalRow(db, workspaceId, id);
      const availability = await availabilityFor(db, workspaceId, id, wallet);
      if (amount > availability.existingForGoal) {
        throw new AppError(
          'allocation_exceeds',
          `Belanja melebihi dana tujuan yang dialokasikan di dompet ${wallet.name}. Alokasi aktifnya ${formatIDR(availability.existingForGoal)}.`,
          { details: { allocatedForGoal: availability.existingForGoal, requested: amount } },
        );
      }
      const txId = await insertTransaction(db, {
        workspaceId, type: 'goal_spend', status: 'posted', amount, effectiveDate,
        note: note ?? `Belanja dari dana tujuan (${category.name})`,
        source: 'manual', userId: ctx.userId, idempotencyKey: null,
        meta: { goalId: id, walletId: wallet.id, categoryId: category.id },
      });
      await postJournal(db, {
        workspaceId, transactionId: txId,
        lines: buildGoalSpend({
          walletAccountId: await walletAccountId(db, workspaceId, wallet.id),
          categoryAccountId: await categoryAccountId(db, workspaceId, category.id),
          amount,
        }),
      });
      await run(
        db,
        `INSERT INTO goal_allocations (id, workspace_id, goal_id, wallet_id, direction, amount_minor, effective_date, note, linked_tx_id, reversed_by, created_at)
         VALUES (?, ?, ?, ?, 'release', ?, ?, ?, ?, NULL, ?)`,
        uuidv7(), workspaceId, id, wallet.id, amount, effectiveDate, `Belanja dari dana tujuan (${category.name})`, txId, nowIso(),
      );
      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'spend_from_goal', entityType: 'goal', entityId: id,
        after: { transactionId: txId, walletId: wallet.id, categoryId: category.id, amount },
      });
      return { goal: await getGoal(ctx, id), transactionId: txId };
    }),
  );
  return outcome.value;
}

// ── pengarsipan ─────────────────────────────────────────────────────────────

export interface ArchiveGoalInput {
  resolution: 'release' | 'keep';
  reason?: string | null;
}

/** Arsip dengan alokasi tersisa harus menawarkan pemindahan atau pelepasan alokasi dulu (§07). */
export async function archiveGoal(ctx: TxContext, id: string, input: ArchiveGoalInput, idempotencyKey?: string | null): Promise<GoalView> {
  const { db, workspaceId } = ctx;
  const resolution = input.resolution;
  if (resolution !== 'release' && resolution !== 'keep') {
    throw new AppError('validation_failed', 'Pilih "lepaskan alokasi" atau "biarkan" saat mengarsipkan tujuan.', { fields: { resolution: 'invalid' } });
  }
  const reason = assertNote(input.reason);

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, resolution, reason } },
    () => tx(db, async () => {
      const row = await getGoalRow(db, workspaceId, id);
      const active = (await activeAllocations(db, workspaceId)).filter((entry) => entry.goalId === id && entry.net > 0);
      if (active.length > 0 && resolution !== 'release') {
        throw new AppError(
          'validation_failed',
          'Tujuan ini masih memiliki alokasi dana. Lepaskan atau pindahkan alokasinya dulu sebelum diarsipkan.',
          { fields: { resolution: 'required' } },
        );
      }
      if (resolution === 'release') {
        for (const entry of active) {
          await run(
            db,
            `INSERT INTO goal_allocations (id, workspace_id, goal_id, wallet_id, direction, amount_minor, effective_date, note, linked_tx_id, reversed_by, created_at)
             VALUES (?, ?, ?, ?, 'release', ?, ?, ?, NULL, NULL, ?)`,
            uuidv7(), workspaceId, id, entry.walletId, entry.net, localDateInTz(ctx.timezone),
            reason ? `Pelepasan saat pengarsipan: ${reason}` : 'Pelepasan saat pengarsipan', nowIso(),
          );
        }
      }
      await run(db, `UPDATE goals SET status = 'archived', version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`, nowIso(), workspaceId, id);
      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'archive', entityType: 'goal', entityId: id,
        before: { status: row.status }, after: { status: 'archived', resolution, released: resolution === 'release' ? active.length : 0, reason },
      });
      return await getGoal(ctx, id);
    }),
  );
  return outcome.value;
}

export function priorityLabel(priority: number): string {
  return PRIORITY_LABEL[priority] ?? PRIORITY_LABEL[2]!;
}
