// domain/budgets.ts: anggaran bulanan per kategori pengeluaran (PRD FR15).
// Terpakai dihitung dari jurnal kategori pada periode berjalan, sehingga refund otomatis
// mengurangi pemakaian dan transfer, pokok utang, serta alokasi goals tidak mengonsumsinya.
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { parseAmount } from '../core/money.ts';
import { currentPeriod, monthBounds } from '../core/dates.ts';
import { all, one, run, tx } from '../db/index.ts';
import { accountDelta, categoryAccountId } from './ledger.ts';
import { recordAudit } from './audit.ts';
import { withIdempotency } from './idempotency.ts';
import type { TxContext } from './transactions.ts';

export type BudgetWarning = 'none' | 'near' | 'over';

export interface BudgetRow {
  id: string;
  workspace_id: string;
  category_id: string;
  period_start: string;
  period_end: string;
  limit_minor: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetView extends BudgetRow {
  /** "YYYY-MM" untuk tampilan periode. */
  period: string;
  categoryName: string;
  /** Pengeluaran bersih kategori pada periode ini (sudah dikurangi refund). */
  spent: number;
  remaining: number;
  ratio: number;
  warning: BudgetWarning;
  warningLabel: string;
}

const WARNING_LABEL: Record<BudgetWarning, string> = {
  none: 'Masih aman',
  near: 'Mendekati batas 80%',
  over: 'Anggaran terlampaui',
};

function assertPeriod(value: unknown, tz: string): string {
  if (value === undefined || value === null || value === '') return currentPeriod(tz);
  const period = String(value).trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new AppError('validation_failed', 'Periode anggaran harus dalam format YYYY-MM, misalnya 2026-03.', { fields: { period: 'invalid' } });
  }
  const month = Number(period.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new AppError('validation_failed', 'Bulan anggaran harus antara 01 dan 12.', { fields: { period: 'invalid' } });
  }
  return period;
}

function assertLimit(value: unknown): number {
  return parseAmount(value, { field: 'limit' });
}

function getBudgetRow(ctx: TxContext, id: string): BudgetRow {
  const row = one<BudgetRow>(ctx.db, `SELECT * FROM budgets WHERE workspace_id = ? AND id = ?`, ctx.workspaceId, id);
  if (!row) throw new AppError('not_found', 'Anggaran tidak ditemukan di ruang keuangan ini.');
  return row;
}

function categoryName(db: TxContext['db'], workspaceId: string, categoryId: string): string {
  const row = one<{ name: string }>(db, `SELECT name FROM categories WHERE workspace_id = ? AND id = ?`, workspaceId, categoryId);
  return row?.name ?? 'Kategori tidak dikenal';
}

function warningOf(ratio: number): BudgetWarning {
  if (ratio >= 1) return 'over';
  if (ratio >= 0.8) return 'near';
  return 'none';
}

function buildBudgetView(ctx: TxContext, row: BudgetRow): BudgetView {
  const { db, workspaceId } = ctx;
  const spent = accountDelta(db, workspaceId, categoryAccountId(db, workspaceId, row.category_id), row.period_start, row.period_end);
  const remaining = row.limit_minor - spent;
  const ratio = row.limit_minor > 0 ? spent / row.limit_minor : 0;
  const warning = warningOf(ratio);
  return {
    ...row,
    period: row.period_start.slice(0, 7),
    categoryName: categoryName(db, workspaceId, row.category_id),
    spent,
    remaining,
    ratio,
    warning,
    warningLabel: WARNING_LABEL[warning],
  };
}

export function listBudgets(ctx: TxContext, options: { period?: string } = {}): BudgetView[] {
  const { db, workspaceId } = ctx;
  const period = assertPeriod(options.period, ctx.timezone);
  const bounds = monthBounds(period);
  const rows = all<BudgetRow>(
    db,
    `SELECT * FROM budgets WHERE workspace_id = ? AND period_start = ? ORDER BY period_start DESC, created_at`,
    workspaceId, bounds.start,
  );
  return rows.map((row) => buildBudgetView(ctx, row));
}

export function getBudget(ctx: TxContext, id: string): BudgetView {
  return buildBudgetView(ctx, getBudgetRow(ctx, id));
}

export interface CreateBudgetInput {
  categoryId: string;
  period: string;
  limit: unknown;
}

export function createBudget(ctx: TxContext, input: CreateBudgetInput, idempotencyKey?: string | null): BudgetView {
  const { db, workspaceId } = ctx;
  if (typeof input.categoryId !== 'string' || !input.categoryId) {
    throw new AppError('validation_failed', 'Kategori pengeluaran wajib dipilih.', { fields: { categoryId: 'required' } });
  }
  const period = assertPeriod(input.period, ctx.timezone);
  const bounds = monthBounds(period);
  const limit = assertLimit(input.limit);

  const outcome = withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { categoryId: input.categoryId, period, limit } },
    () => tx(db, () => {
      const category = one<{ id: string; name: string; kind: string; archived_at: string | null }>(
        db, `SELECT id, name, kind, archived_at FROM categories WHERE workspace_id = ? AND id = ?`, workspaceId, input.categoryId,
      );
      if (!category) throw new AppError('not_found', 'Kategori tidak ditemukan di ruang keuangan ini.');
      if (category.archived_at) throw new AppError('validation_failed', 'Kategori ini sudah diarsipkan. Pilih kategori aktif.', { fields: { categoryId: 'archived' } });
      if (category.kind !== 'expense') {
        throw new AppError('validation_failed', 'Anggaran hanya berlaku untuk kategori pengeluaran. Pilih kategori pengeluaran.', { fields: { categoryId: 'wrong_kind' } });
      }
      const duplicate = one<{ id: string }>(
        db, `SELECT id FROM budgets WHERE workspace_id = ? AND category_id = ? AND period_start = ?`,
        workspaceId, category.id, bounds.start,
      );
      if (duplicate) {
        throw new AppError('validation_failed', `Anggaran untuk ${category.name} pada periode ${period} sudah ada. Ubah anggaran yang ada.`, { fields: { period: 'taken' } });
      }
      const overlap = one<{ id: string }>(
        db,
        `SELECT id FROM budgets
         WHERE workspace_id = ? AND category_id = ? AND period_start <= ? AND period_end >= ?`,
        workspaceId, category.id, bounds.end, bounds.start,
      );
      if (overlap) {
        throw new AppError('validation_failed', `Periode ini tumpang tindih dengan anggaran ${category.name} yang sudah ada.`, { fields: { period: 'overlap' } });
      }
      const id = uuidv7();
      const now = nowIso();
      run(
        db,
        `INSERT INTO budgets (id, workspace_id, category_id, period_start, period_end, limit_minor, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        id, workspaceId, category.id, bounds.start, bounds.end, limit, now, now,
      );
      recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'create', entityType: 'budget', entityId: id,
        after: { categoryId: category.id, period, limit },
      });
      return buildBudgetView(ctx, getBudgetRow(ctx, id));
    }),
  );
  return outcome.value;
}

export interface UpdateBudgetInput {
  limit: unknown;
  expectedVersion?: number;
}

/** Perubahan limit langsung tercermin pada terpakai dan tersisa, dan versinya naik. */
export function updateBudget(ctx: TxContext, id: string, input: UpdateBudgetInput): BudgetView {
  const { db, workspaceId } = ctx;
  const limit = assertLimit(input.limit);
  return tx(db, () => {
    const row = getBudgetRow(ctx, id);
    if (input.expectedVersion !== undefined && input.expectedVersion !== row.version) {
      throw new AppError('version_conflict', 'Anggaran ini sudah berubah di perangkat lain. Muat ulang lalu ulangi perubahan.', { details: { serverVersion: row.version } });
    }
    run(
      db,
      `UPDATE budgets SET limit_minor = ?, version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`,
      limit, nowIso(), workspaceId, id,
    );
    recordAudit(db, {
      workspaceId, actorUserId: ctx.userId, action: 'update', entityType: 'budget', entityId: id,
      before: { limit: row.limit_minor }, after: { limit },
    });
    return buildBudgetView(ctx, getBudgetRow(ctx, id));
  });
}

/** Ringkasan untuk Beranda: berapa anggaran yang mendekati atau melewati batas. */
export function budgetAlerts(ctx: TxContext, period?: string): BudgetView[] {
  return listBudgets(ctx, { period }).filter((view) => view.warning !== 'none');
}
