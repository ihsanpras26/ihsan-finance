// domain/categories.ts: income and expense categories, archived rather than deleted (PRD FR05).
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { all, one, run, scalar, tx, type Db } from '../db/index.ts';
import { createCategoryAccount, renameAccount } from './ledger.ts';
import { recordAudit } from './audit.ts';
import type { TxContext } from './transactions.ts';

export type CategoryKind = 'income' | 'expense';

export interface CategoryRow {
  id: string;
  workspace_id: string;
  ledger_account_id: string;
  name: string;
  kind: CategoryKind;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_EXPENSE = ['Makan dan minum', 'Transportasi', 'Belanja harian', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Lain-lain'];
const DEFAULT_INCOME = ['Gaji', 'Usaha', 'Hadiah', 'Lain-lain'];

export async function listCategories(ctx: TxContext, options: { kind?: CategoryKind; includeArchived?: boolean } = {}): Promise<CategoryRow[]> {
  const where = ['workspace_id = ?'];
  const params: unknown[] = [ctx.workspaceId];
  if (options.kind) {
    where.push('kind = ?');
    params.push(options.kind);
  }
  if (!options.includeArchived) where.push('archived_at IS NULL');
  return all<CategoryRow>(ctx.db, `SELECT * FROM categories WHERE ${where.join(' AND ')} ORDER BY kind, name`, ...params);
}

export async function getCategory(ctx: TxContext, id: string): Promise<CategoryRow> {
  const row = await one<CategoryRow>(ctx.db, `SELECT * FROM categories WHERE workspace_id = ? AND id = ?`, ctx.workspaceId, id);
  if (!row) throw new AppError('not_found', 'Kategori tidak ditemukan di ruang keuangan ini.');
  return row;
}

function assertName(value: unknown): string {
  const name = String(value ?? '').trim();
  if (!name) throw new AppError('validation_failed', 'Nama kategori wajib diisi.', { fields: { name: 'required' } });
  if (name.length > 60) throw new AppError('validation_failed', 'Nama kategori maksimal 60 karakter.', { fields: { name: 'too_long' } });
  return name;
}

function assertKind(value: unknown): CategoryKind {
  const kind = String(value ?? '').trim() as CategoryKind;
  if (kind !== 'income' && kind !== 'expense') {
    throw new AppError('validation_failed', 'Jenis kategori harus Pendapatan atau Pengeluaran.', { fields: { kind: 'invalid' } });
  }
  return kind;
}

export async function createCategory(ctx: TxContext, input: { name: string; kind: CategoryKind | string }): Promise<CategoryRow> {
  const { db, workspaceId } = ctx;
  const name = assertName(input.name);
  const kind = assertKind(input.kind);
  return tx(db, async () => {
    const duplicate = await one<{ id: string }>(db, `SELECT id FROM categories WHERE workspace_id = ? AND kind = ? AND name = ?`, workspaceId, kind, name);
    if (duplicate) {
      throw new AppError('validation_failed', 'Kategori dengan nama ini sudah ada. Pakai nama lain.', { fields: { name: 'taken' } });
    }
    const id = uuidv7();
    const accountId = await createCategoryAccount(db, workspaceId, id, name, kind);
    const now = nowIso();
    await run(
      db,
      `INSERT INTO categories (id, workspace_id, ledger_account_id, name, kind, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      id, workspaceId, accountId, name, kind, now, now,
    );
    await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'create', entityType: 'category', entityId: id, after: { name, kind } });
    return getCategory(ctx, id);
  });
}

export async function updateCategory(ctx: TxContext, id: string, input: { name?: string; expectedVersion?: number }): Promise<CategoryRow> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    const row = await getCategory(ctx, id);
    if (input.expectedVersion !== undefined && input.expectedVersion !== row.version) {
      throw new AppError('version_conflict', 'Kategori ini sudah berubah di perangkat lain. Muat ulang lalu ulangi perubahan.', { details: { serverVersion: row.version } });
    }
    const name = input.name === undefined ? row.name : assertName(input.name);
    if (name !== row.name) {
      const duplicate = await one<{ id: string }>(db, `SELECT id FROM categories WHERE workspace_id = ? AND kind = ? AND name = ? AND id <> ?`, workspaceId, row.kind, name, id);
      if (duplicate) throw new AppError('validation_failed', 'Kategori dengan nama ini sudah ada. Pakai nama lain.', { fields: { name: 'taken' } });
    }
    await run(db, `UPDATE categories SET name = ?, version = version + 1, updated_at = ? WHERE id = ?`, name, nowIso(), id);
    if (name !== row.name) await renameAccount(db, row.ledger_account_id, name);
    await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'update', entityType: 'category', entityId: id, before: { name: row.name }, after: { name } });
    return getCategory(ctx, id);
  });
}

export async function archiveCategory(ctx: TxContext, id: string): Promise<CategoryRow> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    await getCategory(ctx, id);
    await run(db, `UPDATE categories SET archived_at = ?, version = version + 1, updated_at = ? WHERE id = ?`, nowIso(), nowIso(), id);
    await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'archive', entityType: 'category', entityId: id });
    return getCategory(ctx, id);
  });
}

export async function unarchiveCategory(ctx: TxContext, id: string): Promise<CategoryRow> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    await run(db, `UPDATE categories SET archived_at = NULL, version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`, nowIso(), workspaceId, id);
    return getCategory(ctx, id);
  });
}

/** Seed the starter set so a new workspace is usable in seconds (PRD §03 new-user flow). */
export async function seedDefaultCategories(ctx: TxContext): Promise<CategoryRow[]> {
  const existing = await scalar(ctx.db, `SELECT COUNT(*) FROM categories WHERE workspace_id = ?`, ctx.workspaceId);
  if (existing > 0) return listCategories(ctx);
  const created: CategoryRow[] = [];
  for (const name of DEFAULT_EXPENSE) created.push(await createCategory(ctx, { name, kind: 'expense' }));
  for (const name of DEFAULT_INCOME) created.push(await createCategory(ctx, { name, kind: 'income' }));
  return created;
}
