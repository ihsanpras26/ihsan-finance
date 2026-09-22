// domain/export.ts: FR19: CSV and full relational export. Consistent snapshot, no credentials.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { uuidv7, nowIso } from '../core/ids.ts';
import { config } from '../config.ts';
import { all, one, run, tx, type Db } from '../db/index.ts';
import { categoryLegsFor, walletLegsFor, type TxRow } from './transactions.ts';
import { recordAudit } from './audit.ts';
import type { TxContext } from './transactions.ts';

/** Neutralise spreadsheet formulas in text columns (PRD FR19). */
export function neutraliseCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (text.length > 4000) text = `${text.slice(0, 4000)}…`;
  return text;
}

function csvCell(value: unknown): string {
  const text = neutraliseCell(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvExportResult {
  jobId: string;
  filename: string;
  rows: number;
  content: string;
}

const CSV_HEADER = ['ID transaksi', 'Tanggal', 'Jenis', 'Dompet', 'Kategori', 'Nominal', 'Status', 'Referensi'];

/** One row per wallet leg so transfers appear on both sides, matching the ledger. */
export function exportCsv(ctx: TxContext, range: { from?: string; to?: string }): CsvExportResult {
  const where = ['t.workspace_id = ?'];
  const params: unknown[] = [ctx.workspaceId];
  if (range.from) {
    where.push('t.effective_date >= ?');
    params.push(range.from);
  }
  if (range.to) {
    where.push('t.effective_date <= ?');
    params.push(range.to);
  }
  const rows = all<TxRow>(ctx.db, `SELECT t.* FROM transactions t WHERE ${where.join(' AND ')} ORDER BY t.effective_date, t.created_at`, ...params);
  const ids = rows.map((row) => row.id);
  const legs = walletLegsFor(ctx.db, ctx.workspaceId, ids);
  const categories = categoryLegsFor(ctx.db, ctx.workspaceId, ids);

  const lines: string[] = [CSV_HEADER.join(',')];
  let rowCount = 0;
  for (const row of rows) {
    const legsForTx = legs.get(row.id) ?? [];
    const category = categories.get(row.id);
    const reference = row.original_id ?? row.reversal_of ?? row.replacement_of ?? '';
    if (legsForTx.length === 0) {
      lines.push(
        [row.id, row.effective_date, row.type, '', category?.name ?? '', String(row.amount_minor), row.status, reference].map(csvCell).join(','),
      );
      rowCount += 1;
      continue;
    }
    for (const leg of legsForTx) {
      lines.push(
        [
          row.id,
          row.effective_date,
          row.type,
          leg.walletName,
          category?.name ?? '',
          `${leg.direction === 'out' ? '-' : ''}${leg.amount}`,
          row.status,
          reference,
        ].map(csvCell).join(','),
      );
      rowCount += 1;
    }
  }

  const content = `\uFEFF${lines.join('\r\n')}\r\n`;
  const filename = `ihsan-transaksi-${range.from ?? 'awal'}-${range.to ?? 'akhir'}.csv`;
  return { jobId: '', filename, rows: rowCount, content };
}

export function storeCsvJob(ctx: TxContext, result: CsvExportResult): { jobId: string; path: string; bytes: number } {
  const jobId = uuidv7();
  const path = join(config.exportDir, `${jobId}.csv`);
  writeFileSync(path, result.content, 'utf8');
  const bytes = Buffer.byteLength(result.content, 'utf8');
  run(
    ctx.db,
    `INSERT INTO data_jobs (id, workspace_id, kind, status, payload_json, result_path, byte_size, expires_at, created_at)
     VALUES (?, ?, 'csv_export', 'done', ?, ?, ?, ?, ?)`,
    jobId, ctx.workspaceId, JSON.stringify({ rows: result.rows }), path, bytes,
    new Date(Date.now() + 24 * 3_600_000).toISOString(), nowIso(),
  );
  recordAudit(ctx.db, { workspaceId: ctx.workspaceId, actorUserId: ctx.userId, action: 'export_csv', entityType: 'data_job', entityId: jobId, after: { rows: result.rows } });
  return { jobId, path, bytes };
}

export interface FullExportResult {
  jobId: string;
  path: string;
  bytes: number;
}

const EXPORT_TABLES = [
  'workspaces', 'ledger_accounts', 'wallets', 'categories', 'transactions', 'journal_lines', 'transaction_links',
  'counterparties', 'debts', 'debt_payments', 'goals', 'goal_allocations', 'budgets',
  'recurring_rules', 'recurring_occurrences', 'notifications', 'audit_logs', 'data_jobs', 'user_preferences',
];

/** Versioned relational dump that can be restored (PRD FR19). Never includes credentials. */
export function exportFull(ctx: TxContext): FullExportResult {
  const dump: Record<string, unknown> = {
    format: 'ihsan-finance-dump',
    version: 1,
    exportedAt: nowIso(),
    workspaceId: ctx.workspaceId,
    tables: {},
  };
  const tables = dump.tables as Record<string, unknown[]>;
  for (const table of EXPORT_TABLES) {
    if (table === 'workspaces') {
      tables[table] = all(ctx.db, `SELECT * FROM workspaces WHERE id = ?`, ctx.workspaceId);
    } else if (table === 'user_preferences') {
      tables[table] = all(ctx.db, `SELECT * FROM user_preferences WHERE workspace_id = ?`, ctx.workspaceId);
    } else {
      tables[table] = all(ctx.db, `SELECT * FROM ${table} WHERE workspace_id = ?`, ctx.workspaceId);
    }
  }
  // Users are exported without any secret material.
  tables.users = all(ctx.db, `SELECT id, email, display_name, status, created_at FROM users WHERE id = (SELECT owner_id FROM workspaces WHERE id = ?)`, ctx.workspaceId);

  const content = JSON.stringify(dump, null, 2);
  const jobId = uuidv7();
  const path = join(config.exportDir, `${jobId}.json`);
  writeFileSync(path, content, 'utf8');
  const bytes = Buffer.byteLength(content, 'utf8');
  run(
    ctx.db,
    `INSERT INTO data_jobs (id, workspace_id, kind, status, payload_json, result_path, byte_size, expires_at, created_at)
     VALUES (?, ?, 'full_export', 'done', ?, ?, ?, ?, ?)`,
    jobId, ctx.workspaceId, JSON.stringify({ tables: EXPORT_TABLES.length }), path, bytes,
    new Date(Date.now() + 24 * 3_600_000).toISOString(), nowIso(),
  );
  recordAudit(ctx.db, { workspaceId: ctx.workspaceId, actorUserId: ctx.userId, action: 'export_full', entityType: 'data_job', entityId: jobId });
  return { jobId, path, bytes };
}

export function getJob(db: Db, workspaceId: string, jobId: string): { id: string; kind: string; path: string | null; bytes: number | null; expiresAt: string | null } | null {
  const row = one<{ id: string; kind: string; result_path: string | null; byte_size: number | null; expires_at: string | null }>(
    db,
    `SELECT id, kind, result_path, byte_size, expires_at FROM data_jobs WHERE workspace_id = ? AND id = ?`,
    workspaceId, jobId,
  );
  if (!row) return null;
  if (row.expires_at && row.expires_at < nowIso()) return null;
  return { id: row.id, kind: row.kind, path: row.result_path, bytes: row.byte_size, expiresAt: row.expires_at };
}

export function listJobs(ctx: TxContext): { id: string; kind: string; bytes: number | null; createdAt: string; expiresAt: string | null }[] {
  return all(
    ctx.db,
    `SELECT id, kind, byte_size AS bytes, created_at AS createdAt, expires_at AS expiresAt FROM data_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50`,
    ctx.workspaceId,
  );
}

export function pruneExpiredJobs(ctx: TxContext): number {
  const result = run(ctx.db, `DELETE FROM data_jobs WHERE workspace_id = ? AND expires_at IS NOT NULL AND expires_at < ?`, ctx.workspaceId, nowIso());
  return Number(result.changes);
}

export function ensureExportDir(): void {
  mkdirSync(config.exportDir, { recursive: true });
}

export function withExportTx<T>(db: Db, fn: () => T): T {
  return tx(db, fn);
}
