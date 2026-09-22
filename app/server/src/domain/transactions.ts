// domain/transactions.ts: income, expense, transfer, refund, planned, correction, reversal.
// Every mutation is one database transaction (PRD §13).
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { addSafe, parseAmount, sumSafe } from '../core/money.ts';
import { isValidIsoDate, localDateInTz } from '../core/dates.ts';
import { all, one, run, scalar, tx, type Db } from '../db/index.ts';
import {
  categoryAccountId, postJournal, systemAccountId, walletAccountId, type JournalLineInput,
} from './ledger.ts';
import {
  buildExpense, buildIncome, buildRefund, buildTransfer, buildTransferFee, mirrorLines,
} from './posting.ts';
import { recordAudit } from './audit.ts';
import { withIdempotency } from './idempotency.ts';
import { insertTransaction } from './transaction-store.ts';

export type TxType = 'income' | 'expense' | 'transfer' | 'refund' | 'debt_received' | 'receivable_given' | 'debt_payment' | 'receivable_payment' | 'opening' | 'adjustment' | 'reversal' | 'goal_spend';
export type TxStatus = 'planned' | 'posted' | 'cancelled' | 'reversed';

export interface TxRow {
  id: string;
  workspace_id: string;
  type: TxType;
  status: TxStatus;
  amount_minor: number;
  currency: string;
  effective_date: string;
  note: string | null;
  source: string;
  idempotency_key: string | null;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  original_id: string | null;
  reversal_of: string | null;
  replacement_of: string | null;
  counterparty_id: string | null;
  meta_json: string | null;
}

export interface TxContext {
  db: Db;
  workspaceId: string;
  userId: string | null;
  timezone: string;
}

export interface CreateTransactionInput {
  type: 'income' | 'expense' | 'transfer' | 'refund';
  amount: unknown;
  effectiveDate?: string;
  note?: string | null;
  walletId?: string;
  categoryId?: string;
  toWalletId?: string;
  fee?: unknown;
  refundOf?: string;
  source?: 'manual' | 'import' | 'automatic' | 'system';
}

function assertDate(value: unknown, tz: string, field = 'effectiveDate'): string {
  if (value === undefined || value === null || value === '') return localDateInTz(tz);
  if (!isValidIsoDate(value)) {
    throw new AppError('validation_failed', 'Tanggal belum benar. Pakai format tanggal yang benar.', { fields: { [field]: 'invalid' } });
  }
  return value;
}

function assertNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const note = String(value).trim();
  if (note.length > 500) {
    throw new AppError('validation_failed', 'Catatan terlalu panjang (maksimal 500 karakter).', { fields: { note: 'too_long' } });
  }
  return note || null;
}

function assertWallet(db: Db, workspaceId: string, walletId: unknown, field = 'walletId'): { id: string; accountId: string; name: string } {
  if (typeof walletId !== 'string' || !walletId) {
    throw new AppError('validation_failed', 'Dompet wajib dipilih.', { fields: { [field]: 'required' } });
  }
  const row = one<{ id: string; name: string; ledger_account_id: string; archived_at: string | null }>(
    db,
    `SELECT id, name, ledger_account_id, archived_at FROM wallets WHERE workspace_id = ? AND id = ?`,
    workspaceId, walletId,
  );
  if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
  if (row.archived_at) throw new AppError('validation_failed', 'Dompet ini sudah diarsipkan. Pilih dompet aktif.', { fields: { [field]: 'archived' } });
  return { id: row.id, accountId: row.ledger_account_id, name: row.name };
}

function assertCategory(db: Db, workspaceId: string, categoryId: unknown, kind: 'income' | 'expense', field = 'categoryId'): { id: string; accountId: string; name: string } {
  if (typeof categoryId !== 'string' || !categoryId) {
    throw new AppError('validation_failed', 'Kategori wajib dipilih.', { fields: { [field]: 'required' } });
  }
  const row = one<{ id: string; name: string; kind: string; ledger_account_id: string; archived_at: string | null }>(
    db,
    `SELECT id, name, kind, ledger_account_id, archived_at FROM categories WHERE workspace_id = ? AND id = ?`,
    workspaceId, categoryId,
  );
  if (!row) throw new AppError('not_found', 'Kategori tidak ditemukan di ruang keuangan ini.');
  if (row.archived_at) throw new AppError('validation_failed', 'Kategori ini sudah diarsipkan. Pilih kategori aktif.', { fields: { [field]: 'archived' } });
  if (row.kind !== kind) {
    throw new AppError('validation_failed', kind === 'income' ? 'Pilih kategori pendapatan, bukan kategori pengeluaran.' : 'Pilih kategori pengeluaran, bukan kategori pendapatan.', { fields: { [field]: 'wrong_kind' } });
  }
  return { id: row.id, accountId: row.ledger_account_id, name: row.name };
}

export function getTransactionRow(db: Db, workspaceId: string, id: string): TxRow {
  const row = one<TxRow>(db, `SELECT * FROM transactions WHERE workspace_id = ? AND id = ?`, workspaceId, id);
  if (!row) throw new AppError('not_found', 'Transaksi tidak ditemukan di ruang keuangan ini.');
  return row;
}

// ── create ──────────────────────────────────────────────────────────────────

export function createTransaction(ctx: TxContext, input: CreateTransactionInput, idempotencyKey?: string | null): TxRow {
  const { db, workspaceId } = ctx;
  const amount = parseAmount(input.amount, { field: 'amount' });
  const effectiveDate = assertDate(input.effectiveDate, ctx.timezone);
  const note = assertNote(input.note);
  const today = localDateInTz(ctx.timezone);
  const isFuture = effectiveDate > today;
  const status: TxStatus = isFuture ? 'planned' : 'posted';

  const outcome = withIdempotency(db, { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: input }, () =>
    tx(db, () => {
      let lines: JournalLineInput[] = [];
      let meta: Record<string, unknown> | null = null;
      let originalId: string | null = null;

      if (input.type === 'income') {
        const wallet = assertWallet(db, workspaceId, input.walletId);
        const category = assertCategory(db, workspaceId, input.categoryId, 'income');
        lines = buildIncome({ walletAccountId: wallet.accountId, categoryAccountId: category.accountId, amount });
        meta = { walletId: wallet.id, categoryId: category.id };
      } else if (input.type === 'expense') {
        const wallet = assertWallet(db, workspaceId, input.walletId);
        const category = assertCategory(db, workspaceId, input.categoryId, 'expense');
        lines = buildExpense({ walletAccountId: wallet.accountId, categoryAccountId: category.accountId, amount });
        meta = { walletId: wallet.id, categoryId: category.id };
      } else if (input.type === 'transfer') {
        const from = assertWallet(db, workspaceId, input.walletId, 'walletId');
        const to = assertWallet(db, workspaceId, input.toWalletId, 'toWalletId');
        if (from.id === to.id) {
          throw new AppError('validation_failed', 'Dompet asal dan tujuan harus berbeda.', { fields: { toWalletId: 'same_wallet' } });
        }
        const fee = input.fee === undefined || input.fee === null ? 0 : parseAmount(input.fee, { allowZero: true, field: 'fee' });
        lines = buildTransfer({ fromAccountId: from.accountId, toAccountId: to.accountId, amount });
        meta = { walletId: from.id, toWalletId: to.id, fee };
        if (fee > 0) {
          lines = lines.concat(buildTransferFee({ fromAccountId: from.accountId, feeAccountId: systemAccountId(db, workspaceId, 'EXP-FEE'), fee }));
        }
      } else if (input.type === 'refund') {
        const wallet = assertWallet(db, workspaceId, input.walletId);
        if (typeof input.refundOf !== 'string' || !input.refundOf) {
          throw new AppError('validation_failed', 'Pengembalian dana harus menunjuk pengeluaran asal.', { fields: { refundOf: 'required' } });
        }
        const original = getTransactionRow(db, workspaceId, input.refundOf);
        if (original.type !== 'expense') {
          throw new AppError('validation_failed', 'Pengembalian dana hanya dapat menunjuk transaksi pengeluaran.');
        }
        if (original.status !== 'posted' && original.status !== 'reversed') {
          throw new AppError('validation_failed', 'Pengeluaran asal belum tercatat, jadi belum bisa dikembalikan.');
        }
        const refunded = scalar(
          db,
          `SELECT COALESCE(SUM(amount_minor), 0) FROM transactions
           WHERE workspace_id = ? AND type = 'refund' AND original_id = ? AND status IN ('posted','reversed')`,
          workspaceId, original.id,
        );
        if (addSafe(refunded, amount) > original.amount_minor) {
          throw new AppError('refund_exceeds', `Pengembalian melebihi nilai pengeluaran asal. Sisa yang bisa dikembalikan Rp${(original.amount_minor - refunded).toLocaleString('id-ID')}.`);
        }
        const originalLines = all<{ ledger_account_id: string; debit_minor: number; credit_minor: number }>(
          db, `SELECT ledger_account_id, debit_minor, credit_minor FROM journal_lines WHERE transaction_id = ?`, original.id,
        );
        const expenseLine = originalLines.find((line) => line.debit_minor > 0);
        if (!expenseLine) throw new AppError('internal', 'Pengeluaran asal tidak memiliki baris beban.');
        lines = buildRefund({ walletAccountId: wallet.accountId, categoryAccountId: expenseLine.ledger_account_id, amount });
        originalId = original.id;
        meta = { walletId: wallet.id, refundOf: original.id };
      } else {
        throw new AppError('validation_failed', 'Jenis transaksi tidak dikenali.');
      }

      const id = insertTransaction(db, {
        workspaceId, type: input.type, status, amount, effectiveDate, note,
        source: input.source ?? 'manual', userId: ctx.userId, idempotencyKey: idempotencyKey ?? null, originalId, meta,
      });

      if (status === 'posted') {
        postJournal(db, { workspaceId, transactionId: id, lines });
      }
      if (input.type === 'refund' && originalId) {
        run(
          db,
          `INSERT OR IGNORE INTO transaction_links (id, workspace_id, source_tx_id, target_tx_id, relation_type, created_at)
           VALUES (?, ?, ?, ?, 'refund_of', ?)`,
          uuidv7(), workspaceId, id, originalId, nowIso(),
        );
      }
      recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'create', entityType: 'transaction', entityId: id, after: { type: input.type, amount, effectiveDate, status } });
      return getTransactionRow(db, workspaceId, id);
    }),
  );
  return outcome.value;
}

// ── planned → posted ────────────────────────────────────────────────────────

export function postPlannedTransaction(ctx: TxContext, id: string): TxRow {
  const { db, workspaceId } = ctx;
  return tx(db, () => {
    const row = getTransactionRow(db, workspaceId, id);
    if (row.status !== 'planned') {
      throw new AppError('validation_failed', 'Transaksi ini sudah tercatat, tidak perlu dikonfirmasi ulang.');
    }
    const amount = row.amount_minor;
    let lines: JournalLineInput[] = [];
    const meta = row.meta_json ? (JSON.parse(row.meta_json) as Record<string, unknown>) : null;

    if (row.type === 'income') {
      const categoryId = requireMeta(meta, 'categoryId');
      const walletId = requireMeta(meta, 'walletId');
      lines = buildIncome({
        walletAccountId: walletAccountId(db, workspaceId, walletId),
        categoryAccountId: categoryAccountId(db, workspaceId, categoryId),
        amount,
      });
    } else if (row.type === 'expense') {
      lines = buildExpense({
        walletAccountId: walletAccountId(db, workspaceId, requireMeta(meta, 'walletId')),
        categoryAccountId: categoryAccountId(db, workspaceId, requireMeta(meta, 'categoryId')),
        amount,
      });
    } else if (row.type === 'transfer') {
      lines = buildTransfer({
        fromAccountId: walletAccountId(db, workspaceId, requireMeta(meta, 'walletId')),
        toAccountId: walletAccountId(db, workspaceId, requireMeta(meta, 'toWalletId')),
        amount,
      });
      const fee = Number(meta?.fee ?? 0);
      if (fee > 0) {
        lines = lines.concat(buildTransferFee({
          fromAccountId: walletAccountId(db, workspaceId, requireMeta(meta, 'walletId')),
          feeAccountId: systemAccountId(db, workspaceId, 'EXP-FEE'),
          fee,
        }));
      }
    } else {
      throw new AppError('validation_failed', 'Transaksi rencana jenis ini belum dapat dikonfirmasi dari layar ini.');
    }

    postJournal(db, { workspaceId, transactionId: id, lines });
    run(db, `UPDATE transactions SET status = 'posted', version = version + 1, updated_at = ? WHERE id = ?`, nowIso(), id);
    recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'post_planned', entityType: 'transaction', entityId: id });
    return getTransactionRow(db, workspaceId, id);
  });
}

function requireMeta(meta: Record<string, unknown> | null, key: string): string {
  const value = meta?.[key];
  if (typeof value !== 'string' || !value) {
    throw new AppError('internal', `Rencana transaksi tidak menyimpan ${key}, sehingga tidak dapat dikonfirmasi.`);
  }
  return value;
}

/** Planned transactions keep their parameters so they can be confirmed later. */
export function attachPlannedMeta(ctx: TxContext, id: string, meta: Record<string, unknown>): void {
  run(ctx.db, `UPDATE transactions SET meta_json = ? WHERE workspace_id = ? AND id = ?`, JSON.stringify(meta), ctx.workspaceId, id);
}

// ── read ────────────────────────────────────────────────────────────────────

export interface ListFilters {
  from?: string;
  to?: string;
  type?: TxType;
  status?: TxStatus;
  walletId?: string;
  categoryId?: string;
  q?: string;
  min?: number;
  max?: number;
  page?: number;
  pageSize?: number;
}

export function listTransactions(ctx: TxContext, filters: ListFilters): { items: TxRow[]; total: number; page: number; pageSize: number } {
  const { db, workspaceId } = ctx;
  const where: string[] = ['t.workspace_id = ?'];
  const params: unknown[] = [workspaceId];

  if (filters.from) {
    where.push('t.effective_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('t.effective_date <= ?');
    params.push(filters.to);
  }
  if (filters.type) {
    where.push('t.type = ?');
    params.push(filters.type);
  }
  if (filters.status) {
    where.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    where.push('(t.note LIKE ? OR EXISTS (SELECT 1 FROM journal_lines l JOIN categories c ON c.ledger_account_id = l.ledger_account_id WHERE l.transaction_id = t.id AND c.name LIKE ?))');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.min !== undefined) {
    where.push('t.amount_minor >= ?');
    params.push(filters.min);
  }
  if (filters.max !== undefined) {
    where.push('t.amount_minor <= ?');
    params.push(filters.max);
  }
  if (filters.walletId) {
    where.push('EXISTS (SELECT 1 FROM journal_lines l JOIN wallets w ON w.ledger_account_id = l.ledger_account_id WHERE l.transaction_id = t.id AND w.id = ?)');
    params.push(filters.walletId);
  }
  if (filters.categoryId) {
    where.push('EXISTS (SELECT 1 FROM journal_lines l JOIN categories c ON c.ledger_account_id = l.ledger_account_id WHERE l.transaction_id = t.id AND c.id = ?)');
    params.push(filters.categoryId);
  }

  const clause = where.join(' AND ');
  const total = scalar(db, `SELECT COUNT(*) FROM transactions t WHERE ${clause}`, ...params);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 25));
  const items = all<TxRow>(
    db,
    `SELECT t.* FROM transactions t WHERE ${clause} ORDER BY t.effective_date DESC, t.created_at DESC LIMIT ? OFFSET ?`,
    ...params, pageSize, (page - 1) * pageSize,
  );
  return { items, total, page, pageSize };
}

export interface WalletLeg {
  walletId: string;
  walletName: string;
  direction: 'in' | 'out';
  amount: number;
}

/** Which wallets a transaction touched, and in which direction. */
export function walletLegsFor(db: Db, workspaceId: string, transactionIds: readonly string[]): Map<string, WalletLeg[]> {
  const map = new Map<string, WalletLeg[]>();
  if (transactionIds.length === 0) return map;
  const placeholders = transactionIds.map(() => '?').join(',');
  const rows = all<{ transaction_id: string; wallet_id: string; wallet_name: string; debit_minor: number; credit_minor: number }>(
    db,
    `SELECT l.transaction_id, w.id AS wallet_id, w.name AS wallet_name, l.debit_minor, l.credit_minor
     FROM journal_lines l JOIN wallets w ON w.ledger_account_id = l.ledger_account_id AND w.workspace_id = l.workspace_id
     WHERE l.workspace_id = ? AND l.transaction_id IN (${placeholders})
     ORDER BY l.debit_minor DESC`,
    workspaceId, ...transactionIds,
  );
  for (const row of rows) {
    const list = map.get(row.transaction_id) ?? [];
    list.push({
      walletId: row.wallet_id,
      walletName: row.wallet_name,
      direction: row.debit_minor > 0 ? 'in' : 'out',
      amount: row.debit_minor > 0 ? row.debit_minor : row.credit_minor,
    });
    map.set(row.transaction_id, list);
  }
  return map;
}

export interface CategoryLeg {
  id: string;
  name: string;
  kind: 'income' | 'expense';
}

export function categoryLegsFor(db: Db, workspaceId: string, transactionIds: readonly string[]): Map<string, CategoryLeg> {
  const map = new Map<string, CategoryLeg>();
  if (transactionIds.length === 0) return map;
  const placeholders = transactionIds.map(() => '?').join(',');
  const rows = all<{ transaction_id: string; id: string; name: string; kind: 'income' | 'expense' }>(
    db,
    `SELECT l.transaction_id, c.id, c.name, c.kind
     FROM journal_lines l JOIN categories c ON c.ledger_account_id = l.ledger_account_id AND c.workspace_id = l.workspace_id
     WHERE l.workspace_id = ? AND l.transaction_id IN (${placeholders})`,
    workspaceId, ...transactionIds,
  );
  for (const row of rows) map.set(row.transaction_id, { id: row.id, name: row.name, kind: row.kind });
  return map;
}

export function replacedBy(db: Db, workspaceId: string, id: string): string | null {
  const row = one<{ id: string }>(db, `SELECT id FROM transactions WHERE workspace_id = ? AND replacement_of = ? AND status = 'posted' LIMIT 1`, workspaceId, id);
  return row?.id ?? null;
}

export function reversedBy(db: Db, workspaceId: string, id: string): string | null {
  const row = one<{ id: string }>(db, `SELECT id FROM transactions WHERE workspace_id = ? AND reversal_of = ? LIMIT 1`, workspaceId, id);
  return row?.id ?? null;
}

// ── correction & reversal ───────────────────────────────────────────────────

export interface ImpactReport {
  summary: string;
  blockedBy: string[];
  canCancel: boolean;
}

export function transactionImpact(ctx: TxContext, id: string): ImpactReport {
  const { db, workspaceId } = ctx;
  const row = getTransactionRow(db, workspaceId, id);
  const blockedBy: string[] = [];

  const refunds = scalar(db, `SELECT COUNT(*) FROM transactions WHERE workspace_id = ? AND original_id = ? AND type = 'refund' AND status = 'posted'`, workspaceId, id);
  if (refunds > 0) blockedBy.push(`Ada ${refunds} pengembalian dana yang menunjuk transaksi ini.`);

  const payments = scalar(db, `SELECT COUNT(*) FROM debt_payments WHERE workspace_id = ? AND transaction_id = ?`, workspaceId, id);
  if (payments > 0) blockedBy.push('Transaksi ini adalah pembayaran utang atau piutang.');

  const allocations = scalar(db, `SELECT COUNT(*) FROM goal_allocations WHERE workspace_id = ? AND linked_tx_id = ?`, workspaceId, id);
  if (allocations > 0) blockedBy.push('Transaksi ini terhubung ke alokasi dana tujuan.');

  const replacement = replacedBy(db, workspaceId, id);
  if (replacement) blockedBy.push('Transaksi ini sudah diganti versi barunya.');

  if (row.status === 'reversed') blockedBy.push('Transaksi ini sudah dibalik sebelumnya.');

  const legs = walletLegsFor(db, workspaceId, [id]).get(id) ?? [];
  const parts = legs.map((leg) => `${leg.walletName} ${leg.direction === 'in' ? '+' : '−'}Rp${leg.amount.toLocaleString('id-ID')}`);
  const summary = parts.length
    ? `Membatalkan transaksi ini akan mengubah ${parts.join(', ')}.`
    : 'Transaksi ini tidak mengubah saldo dompet.';

  return { summary, blockedBy, canCancel: blockedBy.length === 0 && (row.status === 'posted' || row.status === 'planned') };
}

/** Cancel a transaction: planned is dropped, posted gets a mirror reversal (PRD FR07). */
export function reverseTransaction(ctx: TxContext, id: string, reason?: string): { reversalId: string; row: TxRow } {
  const { db, workspaceId } = ctx;
  return tx(db, () => {
    const row = getTransactionRow(db, workspaceId, id);
    const impact = transactionImpact(ctx, id);
    if (!impact.canCancel) {
      throw new AppError('has_dependencies', impact.blockedBy[0] ?? 'Transaksi ini belum dapat dibatalkan.');
    }
    const now = nowIso();

    if (row.status === 'planned') {
      run(db, `UPDATE transactions SET status = 'cancelled', version = version + 1, updated_at = ? WHERE id = ?`, now, id);
      recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'cancel_planned', entityType: 'transaction', entityId: id, after: { reason: reason ?? null } });
      return { reversalId: '', row: getTransactionRow(db, workspaceId, id) };
    }

    const originalLines = all<{ ledger_account_id: string; debit_minor: number; credit_minor: number }>(
      db, `SELECT ledger_account_id, debit_minor, credit_minor FROM journal_lines WHERE transaction_id = ? ORDER BY id`, id,
    );
    if (originalLines.length === 0) throw new AppError('internal', 'Transaksi tercatat ini tidak memiliki baris jurnal.');

    const reversalId = insertTransaction(db, {
      workspaceId, type: 'reversal', status: 'posted', amount: row.amount_minor, effectiveDate: row.effective_date,
      note: reason ? `Pembatalan: ${reason}` : 'Pembatalan transaksi', source: 'system', userId: ctx.userId,
      idempotencyKey: null, originalId: row.id, reversalOf: row.id,
    });
    postJournal(db, {
      workspaceId, transactionId: reversalId,
      lines: mirrorLines(originalLines.map((line) => ({ accountId: line.ledger_account_id, debit: line.debit_minor, credit: line.credit_minor }))),
    });
    run(db, `UPDATE transactions SET status = 'reversed', version = version + 1, updated_at = ? WHERE id = ?`, now, id);
    run(
      db,
      `INSERT OR IGNORE INTO transaction_links (id, workspace_id, source_tx_id, target_tx_id, relation_type, created_at)
       VALUES (?, ?, ?, ?, 'reversal_of', ?)`,
      uuidv7(), workspaceId, reversalId, row.id, now,
    );
    recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'reverse', entityType: 'transaction', entityId: id, after: { reversalId, reason: reason ?? null } });
    return { reversalId, row: getTransactionRow(db, workspaceId, id) };
  });
}

export interface CorrectTransactionInput {
  amount?: unknown;
  effectiveDate?: string;
  note?: string | null;
  walletId?: string;
  categoryId?: string;
  toWalletId?: string;
  fee?: unknown;
  expectedVersion?: number;
  reason?: string;
}

/**
 * Correction (PRD FR07): a planned transaction is edited in place; a posted one is reversed on its
 * original effective date and replaced on the chosen date, both inside one database transaction.
 */
export function correctTransaction(ctx: TxContext, id: string, input: CorrectTransactionInput): TxRow {
  const { db, workspaceId } = ctx;
  return tx(db, () => {
    const row = getTransactionRow(db, workspaceId, id);
    if (input.expectedVersion !== undefined && input.expectedVersion !== row.version) {
      throw new AppError('version_conflict', 'Data ini sudah berubah di perangkat lain. Muat ulang lalu ulangi perubahan.', { details: { serverVersion: row.version } });
    }
    if (row.status === 'reversed') {
      throw new AppError('has_dependencies', 'Transaksi ini sudah dibalik. Ubah transaksi penggantinya.');
    }
    if (row.status === 'planned') {
      const next: CreateTransactionInput = {
        type: row.type as CreateTransactionInput['type'],
        amount: input.amount ?? row.amount_minor,
        effectiveDate: input.effectiveDate ?? row.effective_date,
        note: input.note === undefined ? row.note : input.note,
        walletId: input.walletId ?? (row.meta_json ? (JSON.parse(row.meta_json) as Record<string, string>).walletId : undefined),
        categoryId: input.categoryId ?? (row.meta_json ? (JSON.parse(row.meta_json) as Record<string, string>).categoryId : undefined),
        toWalletId: input.toWalletId ?? (row.meta_json ? (JSON.parse(row.meta_json) as Record<string, string>).toWalletId : undefined),
        fee: input.fee,
      };
      run(db, `UPDATE transactions SET status = 'cancelled', version = version + 1, updated_at = ? WHERE id = ?`, nowIso(), id);
      const replacement = createTransaction(ctx, next, null);
      run(db, `UPDATE transactions SET replacement_of = ?, original_id = ? WHERE id = ?`, id, id, replacement.id);
      recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'correct_planned', entityType: 'transaction', entityId: id, after: { replacement: replacement.id } });
      return getTransactionRow(db, workspaceId, replacement.id);
    }
    if (row.type === 'debt_payment' || row.type === 'receivable_payment' || row.type === 'opening' || row.type === 'adjustment') {
      throw new AppError('validation_failed', 'Transaksi ini dibuat oleh proses lain. Batalkan lalu catat ulang dari layar asalnya.');
    }

    const impact = transactionImpact(ctx, id);
    const blocked = impact.blockedBy.filter((entry) => !entry.startsWith('Transaksi ini sudah diganti'));
    if (blocked.length > 0) {
      throw new AppError('has_dependencies', blocked[0] ?? 'Transaksi ini belum dapat dikoreksi.');
    }

    const originalLines = all<{ ledger_account_id: string; debit_minor: number; credit_minor: number }>(
      db, `SELECT ledger_account_id, debit_minor, credit_minor FROM journal_lines WHERE transaction_id = ? ORDER BY id`, id,
    );
    const reversalId = insertTransaction(db, {
      workspaceId, type: 'reversal', status: 'posted', amount: row.amount_minor, effectiveDate: row.effective_date,
      note: `Pembalikan koreksi${input.reason ? `: ${input.reason}` : ''}`, source: 'system', userId: ctx.userId,
      idempotencyKey: null, originalId: row.id, reversalOf: row.id,
    });
    postJournal(db, {
      workspaceId, transactionId: reversalId,
      lines: mirrorLines(originalLines.map((line) => ({ accountId: line.ledger_account_id, debit: line.debit_minor, credit: line.credit_minor }))),
    });
    run(db, `UPDATE transactions SET status = 'reversed', version = version + 1, updated_at = ? WHERE id = ?`, nowIso(), id);

    const meta = row.meta_json ? (JSON.parse(row.meta_json) as Record<string, string>) : null;
    const next: CreateTransactionInput = {
      type: row.type as CreateTransactionInput['type'],
      amount: input.amount ?? row.amount_minor,
      effectiveDate: input.effectiveDate ?? row.effective_date,
      note: input.note === undefined ? row.note : input.note,
      walletId: input.walletId ?? meta?.walletId,
      categoryId: input.categoryId ?? meta?.categoryId,
      toWalletId: input.toWalletId ?? meta?.toWalletId,
      fee: input.fee ?? (meta?.fee ? Number(meta.fee) : undefined),
    };
    const replacement = createTransaction(ctx, next, null);
    run(db, `UPDATE transactions SET replacement_of = ?, original_id = ? WHERE id = ?`, id, id, replacement.id);
    run(
      db,
      `INSERT OR IGNORE INTO transaction_links (id, workspace_id, source_tx_id, target_tx_id, relation_type, created_at)
       VALUES (?, ?, ?, ?, 'replacement_of', ?)`,
      uuidv7(), workspaceId, replacement.id, id, nowIso(),
    );
    recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'correct', entityType: 'transaction', entityId: id, after: { reversalId, replacement: replacement.id } });
    return getTransactionRow(db, workspaceId, replacement.id);
  });
}

/** Rebuild-check helper: the sum of all journal lines in a workspace must be zero. */
export function ledgerNetsToZero(db: Db, workspaceId: string): number {
  return scalar(db, `SELECT COALESCE(SUM(debit_minor - credit_minor), 0) FROM journal_lines WHERE workspace_id = ?`, workspaceId);
}

export function totalOf(amounts: readonly number[]): number {
  return sumSafe(amounts);
}
