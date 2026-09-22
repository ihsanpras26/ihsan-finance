// domain/recurring.ts: rencana transaksi berulang (PRD FR17, ARCHITECTURE §8).
// P0 memakai mode 'reminder': scheduler hanya menyiapkan kejadian dan pengingat, transaksi
// nyata dibukukan setelah pengguna menekan Konfirmasi.
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { parseAmount } from '../core/money.ts';
import {
  compareDate, isValidIsoDate, localDateInTz, nextOccurrence,
} from '../core/dates.ts';
import { all, one, run, tx } from '../db/index.ts';
import { recordAudit } from './audit.ts';
import { withIdempotency } from './idempotency.ts';
import { createTransaction, type TxContext, type TxRow } from './transactions.ts';

export type RuleType = 'income' | 'expense' | 'transfer';
export type Frequency = 'daily' | 'weekly' | 'monthly';
export type RuleStatus = 'active' | 'paused' | 'stopped';
export type OccurrenceStatus = 'pending' | 'skipped' | 'confirmed' | 'failed';

export interface RecurringTemplate {
  label: string;
  amount: number;
  walletId: string;
  categoryId: string | null;
  toWalletId: string | null;
  fee: number;
  note: string | null;
}

export interface RuleRow {
  id: string;
  workspace_id: string;
  type: RuleType;
  frequency: Frequency;
  anchor_day: number;
  timezone: string;
  start_on: string;
  end_on: string | null;
  next_on: string;
  mode: 'reminder' | 'auto_post';
  status: RuleStatus;
  template_json: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RuleView extends RuleRow {
  template: RecurringTemplate;
  typeLabel: string;
  frequencyLabel: string;
}

export interface OccurrenceRow {
  id: string;
  workspace_id: string;
  rule_id: string;
  scheduled_date: string;
  status: OccurrenceStatus;
  transaction_id: string | null;
  created_at: string;
}

export interface OccurrenceView extends OccurrenceRow {
  label: string;
  amount: number;
  ruleType: RuleType;
  frequency: Frequency;
  template: RecurringTemplate;
}

const TYPE_LABEL: Record<RuleType, string> = { income: 'Pendapatan', expense: 'Pengeluaran', transfer: 'Transfer' };
const FREQUENCY_LABEL: Record<Frequency, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };

/** Batas aman pengisian kejadian tertinggal dalam satu kali jalan scheduler. */
const MAX_CATCHUP = 400;

// ── validasi ────────────────────────────────────────────────────────────────

function assertType(value: unknown): RuleType {
  const type = String(value ?? '').trim() as RuleType;
  if (type !== 'income' && type !== 'expense' && type !== 'transfer') {
    throw new AppError('validation_failed', 'Jenis rencana harus Pendapatan, Pengeluaran, atau Transfer.', { fields: { type: 'invalid' } });
  }
  return type;
}

function assertFrequency(value: unknown): Frequency {
  const frequency = String(value ?? '').trim() as Frequency;
  if (frequency !== 'daily' && frequency !== 'weekly' && frequency !== 'monthly') {
    throw new AppError('validation_failed', 'Pengulangan harus Harian, Mingguan, atau Bulanan.', { fields: { frequency: 'invalid' } });
  }
  return frequency;
}

function assertIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isValidIsoDate(value)) {
    throw new AppError('validation_failed', 'Tanggal belum benar. Pakai format tanggal yang benar.', { fields: { [field]: 'invalid' } });
  }
  return value;
}

function assertAnchorDay(value: unknown, startOn: string): number {
  if (value === undefined || value === null || value === '') return Number(startOn.slice(8, 10));
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new AppError('validation_failed', 'Tanggal acuan bulanan harus antara 1 dan 31.', { fields: { anchorDay: 'invalid' } });
  }
  return day;
}

function assertLabel(value: unknown, fallback: string): string {
  const label = String(value ?? '').trim();
  if (!label) return fallback;
  if (label.length > 120) throw new AppError('validation_failed', 'Nama rencana maksimal 120 karakter.', { fields: { label: 'too_long' } });
  return label;
}

function assertNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const note = String(value).trim();
  if (note.length > 500) throw new AppError('validation_failed', 'Catatan terlalu panjang (maksimal 500 karakter).', { fields: { note: 'too_long' } });
  return note || null;
}

function assertWallet(ctx: TxContext, walletId: unknown, field: string): { id: string; name: string } {
  if (typeof walletId !== 'string' || !walletId) {
    throw new AppError('validation_failed', 'Dompet wajib dipilih.', { fields: { [field]: 'required' } });
  }
  const row = one<{ id: string; name: string; archived_at: string | null }>(
    ctx.db, `SELECT id, name, archived_at FROM wallets WHERE workspace_id = ? AND id = ?`, ctx.workspaceId, walletId,
  );
  if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
  if (row.archived_at) throw new AppError('validation_failed', 'Dompet ini sudah diarsipkan. Pilih dompet aktif.', { fields: { [field]: 'archived' } });
  return { id: row.id, name: row.name };
}

function assertCategory(ctx: TxContext, categoryId: unknown, kind: 'income' | 'expense'): { id: string; name: string } {
  if (typeof categoryId !== 'string' || !categoryId) {
    throw new AppError('validation_failed', 'Kategori wajib dipilih untuk rencana pendapatan atau pengeluaran.', { fields: { categoryId: 'required' } });
  }
  const row = one<{ id: string; name: string; kind: string; archived_at: string | null }>(
    ctx.db, `SELECT id, name, kind, archived_at FROM categories WHERE workspace_id = ? AND id = ?`, ctx.workspaceId, categoryId,
  );
  if (!row) throw new AppError('not_found', 'Kategori tidak ditemukan di ruang keuangan ini.');
  if (row.archived_at) throw new AppError('validation_failed', 'Kategori ini sudah diarsipkan. Pilih kategori aktif.', { fields: { categoryId: 'archived' } });
  if (row.kind !== kind) {
    throw new AppError('validation_failed', kind === 'income' ? 'Pilih kategori pendapatan.' : 'Pilih kategori pengeluaran.', { fields: { categoryId: 'wrong_kind' } });
  }
  return { id: row.id, name: row.name };
}

function getRuleRow(db: TxContext['db'], workspaceId: string, id: string): RuleRow {
  const row = one<RuleRow>(db, `SELECT * FROM recurring_rules WHERE workspace_id = ? AND id = ?`, workspaceId, id);
  if (!row) throw new AppError('not_found', 'Rencana berulang tidak ditemukan di ruang keuangan ini.');
  return row;
}

function parseTemplate(row: RuleRow): RecurringTemplate {
  const raw = JSON.parse(row.template_json) as Partial<RecurringTemplate>;
  return {
    label: String(raw.label ?? TYPE_LABEL[row.type]),
    amount: Number(raw.amount ?? 0),
    walletId: String(raw.walletId ?? ''),
    categoryId: raw.categoryId ?? null,
    toWalletId: raw.toWalletId ?? null,
    fee: Number(raw.fee ?? 0),
    note: raw.note ?? null,
  };
}

function buildRuleView(row: RuleRow): RuleView {
  return {
    ...row,
    template: parseTemplate(row),
    typeLabel: TYPE_LABEL[row.type],
    frequencyLabel: FREQUENCY_LABEL[row.frequency],
  };
}

// ── aturan ──────────────────────────────────────────────────────────────────

export function listRules(ctx: TxContext, options: { status?: RuleStatus } = {}): RuleView[] {
  const where = ['workspace_id = ?'];
  const params: unknown[] = [ctx.workspaceId];
  if (options.status) {
    where.push('status = ?');
    params.push(options.status);
  }
  return all<RuleRow>(ctx.db, `SELECT * FROM recurring_rules WHERE ${where.join(' AND ')} ORDER BY next_on, created_at`, ...params)
    .map(buildRuleView);
}

export function getRule(ctx: TxContext, id: string): RuleView {
  return buildRuleView(getRuleRow(ctx.db, ctx.workspaceId, id));
}

export interface CreateRuleInput {
  type: RuleType | string;
  frequency: Frequency | string;
  label?: string;
  amount: unknown;
  walletId: string;
  categoryId?: string;
  toWalletId?: string;
  fee?: unknown;
  note?: string | null;
  startOn?: string;
  endOn?: string | null;
  anchorDay?: number;
}

export function createRule(ctx: TxContext, input: CreateRuleInput, idempotencyKey?: string | null): RuleView {
  const { db, workspaceId } = ctx;
  const type = assertType(input.type);
  const frequency = assertFrequency(input.frequency);
  const today = localDateInTz(ctx.timezone);
  const startOn = input.startOn === undefined || input.startOn === null || input.startOn === ''
    ? today
    : assertIsoDate(input.startOn, 'startOn');
  const endOn = input.endOn === undefined || input.endOn === null || input.endOn === ''
    ? null
    : assertIsoDate(input.endOn, 'endOn');
  if (endOn && compareDate(endOn, startOn) < 0) {
    throw new AppError('validation_failed', 'Tanggal berakhir tidak boleh sebelum tanggal mulai.', { fields: { endOn: 'before_start' } });
  }
  const anchorDay = assertAnchorDay(input.anchorDay, startOn);
  const amount = parseAmount(input.amount, { field: 'amount' });
  const wallet = assertWallet(ctx, input.walletId, 'walletId');
  const fee = input.fee === undefined || input.fee === null || input.fee === ''
    ? 0
    : parseAmount(input.fee, { allowZero: true, field: 'fee' });

  let categoryId: string | null = null;
  let toWalletId: string | null = null;
  let labelFallback = TYPE_LABEL[type];
  if (type === 'transfer') {
    if (input.toWalletId && input.toWalletId === wallet.id) {
      throw new AppError('validation_failed', 'Dompet asal dan tujuan harus berbeda.', { fields: { toWalletId: 'same_wallet' } });
    }
    const toWallet = assertWallet(ctx, input.toWalletId, 'toWalletId');
    toWalletId = toWallet.id;
    labelFallback = `Transfer ke ${toWallet.name}`;
  } else {
    const category = assertCategory(ctx, input.categoryId, type);
    categoryId = category.id;
    labelFallback = `${TYPE_LABEL[type]}: ${category.name}`;
  }
  const label = assertLabel(input.label, labelFallback);
  const note = assertNote(input.note);

  const outcome = withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { ...input, type, frequency, startOn, endOn, anchorDay, amount, walletId: wallet.id, categoryId, toWalletId, fee } },
    () => tx(db, () => {
      const id = uuidv7();
      const template: RecurringTemplate = { label, amount, walletId: wallet.id, categoryId, toWalletId, fee, note };
      const now = nowIso();
      run(
        db,
        `INSERT INTO recurring_rules (id, workspace_id, type, frequency, anchor_day, timezone, start_on, end_on, next_on, mode, status, template_json, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'reminder', 'active', ?, 1, ?, ?)`,
        id, workspaceId, type, frequency, anchorDay, ctx.timezone, startOn, endOn, startOn,
        JSON.stringify(template), now, now,
      );
      recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'create', entityType: 'recurring_rule', entityId: id,
        after: { type, frequency, startOn, endOn, anchorDay, template },
      });
      return buildRuleView(getRuleRow(db, workspaceId, id));
    }),
  );
  return outcome.value;
}

export interface UpdateRuleInput {
  label?: string;
  amount?: unknown;
  walletId?: string;
  categoryId?: string;
  toWalletId?: string;
  fee?: unknown;
  note?: string | null;
  frequency?: Frequency | string;
  anchorDay?: number;
  endOn?: string | null;
  expectedVersion?: number;
}

/**
 * Perubahan jadwal menggeser next_on ke jadwal pertama yang belum lewat, tanpa membuat kejadian
 * baru di sini; pengisian kejadian tertinggal tetap tugas scheduler.
 */
export function updateRule(ctx: TxContext, id: string, input: UpdateRuleInput): RuleView {
  const { db, workspaceId } = ctx;
  return tx(db, () => {
    const row = getRuleRow(db, workspaceId, id);
    if (input.expectedVersion !== undefined && input.expectedVersion !== row.version) {
      throw new AppError('version_conflict', 'Rencana ini sudah berubah di perangkat lain. Muat ulang lalu ulangi perubahan.', { details: { serverVersion: row.version } });
    }
    const template = parseTemplate(row);
    const type = row.type;
    const frequency = input.frequency === undefined ? row.frequency : assertFrequency(input.frequency);
    const anchorDay = input.anchorDay === undefined ? row.anchor_day : assertAnchorDay(input.anchorDay, row.start_on);
    const endOn = input.endOn === undefined ? row.end_on : (input.endOn === null || input.endOn === '' ? null : assertIsoDate(input.endOn, 'endOn'));
    if (endOn && compareDate(endOn, row.start_on) < 0) {
      throw new AppError('validation_failed', 'Tanggal berakhir tidak boleh sebelum tanggal mulai.', { fields: { endOn: 'before_start' } });
    }
    const amount = input.amount === undefined ? template.amount : parseAmount(input.amount, { field: 'amount' });
    const fee = input.fee === undefined || input.fee === null || input.fee === ''
      ? template.fee
      : parseAmount(input.fee, { allowZero: true, field: 'fee' });
    const wallet = input.walletId === undefined ? { id: template.walletId } : assertWallet(ctx, input.walletId, 'walletId');
    let categoryId = template.categoryId;
    let toWalletId = template.toWalletId;
    if (type === 'transfer') {
      if (input.toWalletId !== undefined) {
        const toWallet = assertWallet(ctx, input.toWalletId, 'toWalletId');
        if (toWallet.id === wallet.id) throw new AppError('validation_failed', 'Dompet asal dan tujuan harus berbeda.', { fields: { toWalletId: 'same_wallet' } });
        toWalletId = toWallet.id;
      }
    } else if (input.categoryId !== undefined) {
      categoryId = assertCategory(ctx, input.categoryId, type === 'income' ? 'income' : 'expense').id;
    }
    const label = input.label === undefined ? template.label : assertLabel(input.label, template.label);
    const note = input.note === undefined ? template.note : assertNote(input.note);

    const scheduleChanged = frequency !== row.frequency || anchorDay !== row.anchor_day;
    const nextOn = scheduleChanged ? firstOnOrAfter(row.start_on, frequency, anchorDay, localDateInTz(ctx.timezone)) : row.next_on;
    const nextTemplate: RecurringTemplate = { label, amount, walletId: wallet.id, categoryId, toWalletId, fee, note };
    run(
      db,
      `UPDATE recurring_rules SET frequency = ?, anchor_day = ?, end_on = ?, next_on = ?, template_json = ?, version = version + 1, updated_at = ?
       WHERE workspace_id = ? AND id = ?`,
      frequency, anchorDay, endOn, nextOn, JSON.stringify(nextTemplate), nowIso(), workspaceId, id,
    );
    recordAudit(db, {
      workspaceId, actorUserId: ctx.userId, action: 'update', entityType: 'recurring_rule', entityId: id,
      before: { frequency: row.frequency, anchorDay: row.anchor_day, endOn: row.end_on, nextOn: row.next_on, template },
      after: { frequency, anchorDay, endOn, nextOn, template: nextTemplate },
    });
    return buildRuleView(getRuleRow(db, workspaceId, id));
  });
}

function firstOnOrAfter(from: string, frequency: Frequency, anchorDay: number, target: string): string {
  let cursor = from;
  let guard = 0;
  while (cursor < target && guard < MAX_CATCHUP) {
    cursor = nextOccurrence(cursor, frequency, anchorDay);
    guard++;
  }
  return cursor;
}

export type RuleAction = 'pause' | 'resume' | 'stop';

export function setRuleStatus(ctx: TxContext, id: string, action: RuleAction): RuleView {
  const { db, workspaceId } = ctx;
  if (action !== 'pause' && action !== 'resume' && action !== 'stop') {
    throw new AppError('validation_failed', 'Aksi rencana harus jeda, lanjutkan, atau hentikan.', { fields: { action: 'invalid' } });
  }
  return tx(db, () => {
    const row = getRuleRow(db, workspaceId, id);
    if (action === 'pause' && row.status === 'stopped') {
      throw new AppError('rule_inactive', 'Rencana ini sudah dihentikan permanen, jadi tidak bisa dijeda. Buat rencana baru bila perlu.', { details: { status: row.status } });
    }
    if (action === 'stop' && row.status === 'stopped') return buildRuleView(row);
    const status: RuleStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'stopped';
    const today = localDateInTz(ctx.timezone);
    // Melanjutkan rencana tidak membanjiri pengingat lama: next_on digeser ke jadwal berikutnya.
    const nextOn = action === 'resume' ? firstOnOrAfter(row.next_on, row.frequency, row.anchor_day, today) : row.next_on;
    run(
      db,
      `UPDATE recurring_rules SET status = ?, next_on = ?, version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`,
      status, nextOn, nowIso(), workspaceId, id,
    );
    recordAudit(db, {
      workspaceId, actorUserId: ctx.userId, action, entityType: 'recurring_rule', entityId: id,
      before: { status: row.status, nextOn: row.next_on }, after: { status, nextOn },
    });
    return buildRuleView(getRuleRow(db, workspaceId, id));
  });
}

// ── kejadian ────────────────────────────────────────────────────────────────

function buildOccurrenceView(row: OccurrenceRow, rule: RuleRow): OccurrenceView {
  const template = parseTemplate(rule);
  return {
    ...row,
    label: template.label,
    amount: template.amount,
    ruleType: rule.type,
    frequency: rule.frequency,
    template,
  };
}

/**
 * Buat kejadian pending untuk setiap aturan aktif yang jadwalnya sudah lewat atau hari ini,
 * lalu majukan next_on. Tanggal 29–31 yang tidak ada jatuh pada hari terakhir bulan itu dan
 * tanggal acuan tidak bergeser (AT15). UNIQUE(rule_id, scheduled_date) membuatnya idempoten.
 */
export function ensureOccurrences(ctx: TxContext, today?: string): { created: number; rulesProcessed: number } {
  const { db, workspaceId } = ctx;
  const day = today ?? localDateInTz(ctx.timezone);
  return tx(db, () => {
    const rules = all<RuleRow>(db, `SELECT * FROM recurring_rules WHERE workspace_id = ? AND status = 'active' ORDER BY next_on`, workspaceId);
    let created = 0;
    for (const rule of rules) {
      let cursor = rule.next_on;
      let guard = 0;
      while (cursor <= day && guard < MAX_CATCHUP) {
        if (rule.end_on && cursor > rule.end_on) break;
        const result = run(
          db,
          `INSERT OR IGNORE INTO recurring_occurrences (id, workspace_id, rule_id, scheduled_date, status, transaction_id, created_at)
           VALUES (?, ?, ?, ?, 'pending', NULL, ?)`,
          uuidv7(), workspaceId, rule.id, cursor, nowIso(),
        );
        created += Number(result.changes);
        cursor = nextOccurrence(cursor, rule.frequency, rule.anchor_day);
        guard++;
      }
      if (cursor !== rule.next_on) {
        run(db, `UPDATE recurring_rules SET next_on = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`, cursor, nowIso(), workspaceId, rule.id);
      }
      if (rule.end_on && cursor > rule.end_on) {
        run(db, `UPDATE recurring_rules SET status = 'stopped', version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`, nowIso(), workspaceId, rule.id);
      }
    }
    return { created, rulesProcessed: rules.length };
  });
}

/** Baris gabungan occurrence + rule untuk listOccurrences. */
interface OccurrenceJoinRow extends RuleRow {
  o_id: string;
  o_workspace_id: string;
  o_rule_id: string;
  o_scheduled_date: string;
  o_status: string;
  o_transaction_id: string | null;
  o_created_at: string;
}

export function listOccurrences(ctx: TxContext, options: { status?: OccurrenceStatus; ruleId?: string } = {}): OccurrenceView[] {
  const { db, workspaceId } = ctx;
  const where = ['o.workspace_id = ?'];
  const params: unknown[] = [workspaceId];
  if (options.status) {
    where.push('o.status = ?');
    params.push(options.status);
  }
  if (options.ruleId) {
    where.push('o.rule_id = ?');
    params.push(options.ruleId);
  }
  const rows = all<OccurrenceJoinRow>(
    db,
    `SELECT o.id AS o_id, o.workspace_id AS o_workspace_id, o.rule_id AS o_rule_id, o.scheduled_date AS o_scheduled_date,
            o.status AS o_status, o.transaction_id AS o_transaction_id, o.created_at AS o_created_at,
            r.*
     FROM recurring_occurrences o JOIN recurring_rules r ON r.id = o.rule_id
     WHERE ${where.join(' AND ')}
     ORDER BY o.scheduled_date, o.created_at`,
    ...params,
  );
  return rows.map((row) => {
    const occurrence: OccurrenceRow = {
      id: String(row.o_id),
      workspace_id: String(row.o_workspace_id),
      rule_id: String(row.o_rule_id),
      scheduled_date: String(row.o_scheduled_date),
      status: row.o_status as OccurrenceStatus,
      transaction_id: row.o_transaction_id === null ? null : String(row.o_transaction_id),
      created_at: String(row.o_created_at),
    };
    const rule: RuleRow = {
      id: row.id,
      workspace_id: row.workspace_id,
      type: row.type,
      frequency: row.frequency,
      anchor_day: row.anchor_day,
      timezone: row.timezone,
      start_on: row.start_on,
      end_on: row.end_on,
      next_on: row.next_on,
      mode: row.mode,
      status: row.status,
      template_json: row.template_json,
      version: row.version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    return buildOccurrenceView(occurrence, rule);
  });
}

export interface ConfirmOccurrenceOverrides {
  amount?: unknown;
  walletId?: string;
  categoryId?: string;
  toWalletId?: string;
  fee?: unknown;
  note?: string | null;
  effectiveDate?: string;
}

export interface ConfirmOccurrenceResult {
  occurrence: OccurrenceView;
  transaction: TxRow;
  replayed: boolean;
}

/** Konfirmasi membuat transaksi nyata dari template + penyesuaian; sekali saja per kejadian. */
export function confirmOccurrence(
  ctx: TxContext,
  id: string,
  overrides: ConfirmOccurrenceOverrides = {},
  idempotencyKey?: string | null,
): ConfirmOccurrenceResult {
  const { db, workspaceId } = ctx;
  const outcome = withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, ...overrides } },
    () => tx(db, () => {
      const row = one<OccurrenceRow>(db, `SELECT * FROM recurring_occurrences WHERE workspace_id = ? AND id = ?`, workspaceId, id);
      if (!row) throw new AppError('not_found', 'Kejadian rencana tidak ditemukan di ruang keuangan ini.');
      const rule = getRuleRow(db, workspaceId, row.rule_id);

      if (row.status === 'confirmed' && row.transaction_id) {
        const existing = one<TxRow>(db, `SELECT * FROM transactions WHERE workspace_id = ? AND id = ?`, workspaceId, row.transaction_id);
        if (existing) return { occurrence: buildOccurrenceView(row, rule), transaction: existing, replayed: true };
      }
      if (rule.status === 'stopped') {
        throw new AppError('rule_inactive', 'Rencana ini sudah dihentikan, jadi kejadiannya tidak bisa dikonfirmasi. Aktifkan kembali rencananya lebih dulu.', { details: { status: rule.status } });
      }
      if (row.status === 'skipped') {
        throw new AppError('validation_failed', 'Kejadian ini sudah dilewati. Buat transaksi manual bila memang terjadi.');
      }

      const template = parseTemplate(rule);
      const amount = overrides.amount === undefined ? template.amount : parseAmount(overrides.amount, { field: 'amount' });
      const walletId = overrides.walletId ?? template.walletId;
      const categoryId = overrides.categoryId ?? template.categoryId ?? undefined;
      const toWalletId = overrides.toWalletId ?? template.toWalletId ?? undefined;
      const fee = overrides.fee === undefined ? template.fee : parseAmount(overrides.fee, { allowZero: true, field: 'fee' });
      const effectiveDate = overrides.effectiveDate ?? row.scheduled_date;
      const note = overrides.note === undefined ? (template.note ?? template.label) : overrides.note;

      if (rule.type === 'transfer') {
        const transaction = createTransaction(ctx, {
          type: 'transfer', amount, walletId, toWalletId, fee: fee > 0 ? fee : undefined, effectiveDate, note, source: 'manual',
        }, null);
        run(
          db,
          `UPDATE recurring_occurrences SET status = 'confirmed', transaction_id = ? WHERE workspace_id = ? AND id = ?`,
          transaction.id, workspaceId, id,
        );
        recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'confirm_occurrence', entityType: 'recurring_occurrence', entityId: id, after: { transactionId: transaction.id } });
        return { occurrence: buildOccurrenceView({ ...row, status: 'confirmed', transaction_id: transaction.id }, rule), transaction, replayed: false };
      }

      const transaction = createTransaction(ctx, {
        type: rule.type === 'income' ? 'income' : 'expense',
        amount,
        walletId,
        categoryId,
        effectiveDate,
        note,
        source: 'manual',
      }, null);
      run(
        db,
        `UPDATE recurring_occurrences SET status = 'confirmed', transaction_id = ? WHERE workspace_id = ? AND id = ?`,
        transaction.id, workspaceId, id,
      );
      recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'confirm_occurrence', entityType: 'recurring_occurrence', entityId: id, after: { transactionId: transaction.id } });
      return { occurrence: buildOccurrenceView({ ...row, status: 'confirmed', transaction_id: transaction.id }, rule), transaction, replayed: false };
    }),
  );
  return outcome.value;
}

/** Melewati satu kejadian tidak menghapus aturan pengulangan (FR17). */
export function skipOccurrence(ctx: TxContext, id: string): OccurrenceView {
  const { db, workspaceId } = ctx;
  return tx(db, () => {
    const row = one<OccurrenceRow>(db, `SELECT * FROM recurring_occurrences WHERE workspace_id = ? AND id = ?`, workspaceId, id);
    if (!row) throw new AppError('not_found', 'Kejadian rencana tidak ditemukan di ruang keuangan ini.');
    const rule = getRuleRow(db, workspaceId, row.rule_id);
    if (row.status === 'confirmed') {
      throw new AppError('has_dependencies', 'Kejadian ini sudah dikonfirmasi menjadi transaksi. Batalkan transaksinya bila memang salah.');
    }
    if (row.status !== 'skipped') {
      run(db, `UPDATE recurring_occurrences SET status = 'skipped' WHERE workspace_id = ? AND id = ?`, workspaceId, id);
      recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'skip_occurrence', entityType: 'recurring_occurrence', entityId: id, before: { status: row.status }, after: { status: 'skipped' } });
    }
    return buildOccurrenceView({ ...row, status: 'skipped' }, rule);
  });
}

/** Dipakai pengingat: aturan berikutnya yang belum lewat. */
export function nextScheduledDate(ctx: TxContext, id: string): string {
  return getRuleRow(ctx.db, ctx.workspaceId, id).next_on;
}
