// tools/offsite.ts: offsite backup for the deployed database (NFR05).
//
// The production database lives on Turso, so `VACUUM INTO` inside the server process is not usable
// (it would write on the server's disk, not ours). Instead the dump is logical: read `sqlite_master`
// from the source, replay the schema into a fresh local SQLite file, copy every table row by row,
// then verify counts, journal balance, integrity and relations before the file is uploaded to an
// S3-compatible bucket (Cloudflare R2, Backblaze B2, AWS S3) with SigV4.
//
// Usage: node server/src/tools/offsite.ts dump    → dump + verify, keep the local copy
//        node server/src/tools/offsite.ts upload  → upload the newest local dump + manifest
//        node server/src/tools/offsite.ts all     → dump, then upload
// Env:   IHSAN_DB_URL (libsql://… ) or the local file (IHSAN_DB_PATH/IHSAN_DATA_DIR), IHSAN_DB_TOKEN,
//        IHSAN_OFFSITE_DIR, IHSAN_OFFSITE_KEEP,
//        IHSAN_S3_ENDPOINT, IHSAN_S3_BUCKET, IHSAN_S3_ACCESS_KEY_ID, IHSAN_S3_SECRET_ACCESS_KEY,
//        IHSAN_S3_REGION, IHSAN_S3_PREFIX.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, one, openDatabase, run, scalar, tx, type Db } from '../db/index.ts';
import { config } from '../config.ts';
import { nowIso } from '../core/ids.ts';
import { objectKey, putObject, s3ConfigFromEnv, type S3Config } from '../core/s3.ts';

/**
 * Where offsite dumps live. Deliberately not the snapshot directory used by `scripts/backup.mjs`:
 * both write `ihsan-<stamp>.db`, and pruning one family must never delete the other.
 */
export function offsiteDir(env: NodeJS.ProcessEnv, dataDir: string): string {
  const explicit = (env.IHSAN_OFFSITE_DIR ?? '').trim();
  return explicit ? resolve(explicit) : join(dataDir, 'offsite');
}

/**
 * Source of a logical dump: Turso when a URL is configured, otherwise the local database file
 * (mode A). Null when neither exists, so the caller reports it instead of dumping nothing.
 */
export function dumpSource(env: NodeJS.ProcessEnv, localFallback: string): { url: string; token?: string } | null {
  const url = (env.IHSAN_DB_URL ?? '').trim();
  if (url) {
    const token = (env.IHSAN_DB_TOKEN ?? '').trim();
    return token ? { url, token } : { url };
  }
  const file = (env.IHSAN_DB_PATH ?? '').trim() || localFallback;
  return existsSync(file) ? { url: file } : null;
}

export interface DumpReport {
  file: string;
  bytes: number;
  sha256: string;
  createdAt: string;
  tables: number;
  rows: number;
  journalBalanced: boolean;
  integrity: string;
  problems: string[];
}

interface MasterRow {
  type: string;
  name: string;
  sql: string;
}

/** Replay the source schema in dependency order: tables, indexes, triggers, views. */
export async function copySchema(source: Db, target: Db): Promise<string[]> {
  const rows = await all<MasterRow>(
    source,
    `SELECT type, name, sql FROM sqlite_master
      WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
      ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name`,
  );
  for (const row of rows) await target.script(`${row.sql};`);
  return rows.filter((row) => row.type === 'table').map((row) => row.name);
}

/**
 * Copy every row of `tables` in chunks sized so the parameter count stays far below the SQLite
 * limit (widest table has ~20 columns, so 500/columns rows per statement).
 */
export async function copyRows(source: Db, target: Db, tables: string[]): Promise<number> {
  let total = 0;
  await target.script('PRAGMA foreign_keys = OFF');
  for (const table of tables) {
    const info = await all<{ name: string }>(source, `PRAGMA table_info("${table}")`);
    const columns = info.map((column) => column.name);
    if (columns.length === 0) continue;
    const rows = await all<Record<string, unknown>>(source, `SELECT * FROM "${table}"`);
    if (rows.length === 0) continue;
    const quoted = columns.map((column) => `"${column}"`).join(', ');
    const tuple = `(${columns.map(() => '?').join(', ')})`;
    const perChunk = Math.max(1, Math.floor(500 / columns.length));
    await tx(target, async () => {
      for (let index = 0; index < rows.length; index += perChunk) {
        const slice = rows.slice(index, index + perChunk);
        const sql = `INSERT INTO "${table}" (${quoted}) VALUES ${slice.map(() => tuple).join(', ')}`;
        const params = slice.flatMap((row) => columns.map((column) => row[column]));
        await run(target, sql, ...params);
      }
    });
    total += rows.length;
  }
  await target.script('PRAGMA foreign_keys = ON');
  return total;
}
/** Compare the copy against the source: row counts, journal balance, integrity, relations. */
export async function verifyDump(source: Db, target: Db, tables: string[]): Promise<{ rows: number; journalBalanced: boolean; integrity: string; problems: string[] }> {
  const problems: string[] = [];
  let rows = 0;
  for (const table of tables) {
    const sourceCount = await scalar(source, `SELECT COUNT(*) FROM "${table}"`);
    const targetCount = await scalar(target, `SELECT COUNT(*) FROM "${table}"`);
    rows += targetCount;
    if (sourceCount !== targetCount) problems.push(`tabel ${table}: ${targetCount} baris tersalin, sumber ${sourceCount}`);
  }
  const balanceOf = `SELECT COALESCE(SUM(debit_minor), 0) - COALESCE(SUM(credit_minor), 0) FROM journal_lines`;
  const sourceBalance = await scalar(source, balanceOf);
  const targetBalance = await scalar(target, balanceOf);
  if (sourceBalance !== targetBalance) problems.push(`saldo jurnal berbeda: salinan ${targetBalance}, sumber ${sourceBalance}`);
  if (targetBalance !== 0) problems.push(`jurnal tidak seimbang: ${targetBalance}`);
  const integrityRow = await one<{ integrity_check: string }>(target, 'PRAGMA integrity_check');
  const integrity = integrityRow?.integrity_check ?? 'unknown';
  if (integrity !== 'ok') problems.push(`integritas berkas: ${integrity}`);
  const relationIssues = await all(target, 'PRAGMA foreign_key_check');
  if (relationIssues.length > 0) problems.push(`${relationIssues.length} pelanggaran relasi`);
  return { rows, journalBalanced: targetBalance === 0, integrity, problems };
}

/**
 * Snapshot stamp: UTC, millisecond precision, same shape as scripts/backup.mjs
 * (`ihsan-YYYYMMDD-HHMMSSmmm.db`).
 */
export function stamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:T]/g, '').replace(/\..+$/, '') + String(date.getUTCMilliseconds()).padStart(3, '0');
}

export function dumpName(date: Date = new Date()): string {
  const value = stamp(date);
  return `ihsan-${value.slice(0, 8)}-${value.slice(8)}.db`;
}

/** User tables of a database, in dependency order. */
export async function tableNames(db: Db): Promise<string[]> {
  const rows = await all<{ name: string }>(
    db,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

/** Dump the source database to `targetPath` and verify it. Throws when verification fails. */
export async function dumpDatabase(targetPath: string, options: { url: string; token?: string }): Promise<DumpReport> {
  const source = await openDatabase(options.url, options.token);
  const target = await openDatabase(targetPath);
  try {
    const tables = await copySchema(source, target);
    const rows = await copyRows(source, target, tables);
    const verified = await verifyDump(source, target, tables);
    if (verified.rows !== rows) verified.problems.push(`jumlah baris tidak konsisten: ${verified.rows} vs ${rows}`);
    // Fold the WAL into the main file so the copy stays a single self-contained artefact.
    await target.script('PRAGMA wal_checkpoint(TRUNCATE)');
    return {
      file: targetPath,
      bytes: 0,
      sha256: '',
      createdAt: nowIso(),
      tables: tables.length,
      rows,
      journalBalanced: verified.journalBalanced,
      integrity: verified.integrity,
      problems: verified.problems,
    };
  } finally {
    await target.close();
    await source.close();
  }
}

/** Hash a finished dump and write its manifest next to the file. */
export function sealDump(report: DumpReport): DumpReport {
  const bytes = readFileSync(report.file);
  report.bytes = bytes.byteLength;
  report.sha256 = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(`${report.file}.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export async function uploadDump(config: S3Config, report: DumpReport, options: { fetchImpl?: typeof fetch; date?: Date } = {}): Promise<{ key: string; status: number }> {
  const name = report.file.split(/[\\/]/).pop()!;
  const key = objectKey(config, name);
  const bytes = readFileSync(report.file);
  const result = await putObject(config, key, bytes, { contentType: 'application/vnd.sqlite3', fetchImpl: options.fetchImpl, date: options.date });
  const manifest = { ...report, file: name, key };
  await putObject(config, `${key}.json`, new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`), {
    contentType: 'application/json',
    fetchImpl: options.fetchImpl,
    date: options.date,
  });
  return { key, status: result.status };
}

/**
 * Keep only the newest `keep` local dumps (the bucket keeps everything). A file that is still
 * locked by the driver — Windows releases the handle with the native finaliser — is skipped
 * instead of failing the run, so pruning simply catches up on the next execution.
 */
export function pruneLocal(dir: string, keep: number): string[] {
  const files = readdirSync(dir).filter((name) => /^ihsan-\d{8}-\d{9}\.db$/.test(name)).sort();
  const removed: string[] = [];
  for (const name of files.slice(0, Math.max(0, files.length - keep))) {
    try {
      rmSync(join(dir, name), { force: true });
      rmSync(join(dir, `${name}.json`), { force: true });
      removed.push(name);
    } catch {
      // still open; a later run removes it
    }
  }
  return removed;
}

function reportLine(report: DumpReport): string {
  const state = report.problems.length === 0 ? 'PASS' : 'FAIL';
  const size = `${(report.bytes / 1024).toFixed(0)} KB`;
  return `${state} ${report.file.split(/[\\/]/).pop()} — ${report.tables} tabel, ${report.rows} baris, ${size}, jurnal ${report.journalBalanced ? 'seimbang' : 'TIDAK seimbang'}, integritas ${report.integrity}${report.problems.length ? ` — ${report.problems.join('; ')}` : ''}`;
}

async function main(): Promise<number> {
  const command = process.argv[2] ?? 'all';
  const dir = offsiteDir(process.env, config.dataDir);
  const keep = Number.parseInt(process.env.IHSAN_OFFSITE_KEEP ?? '30', 10) || 30;
  const source = dumpSource(process.env, config.dbPath);
  if (!source) {
    console.error(`Tidak ada basis data sumber: isi IHSAN_DB_URL (Turso) atau siapkan berkas di ${config.dbPath}.`);
    return 2;
  }
  mkdirSync(dir, { recursive: true });

  if (command === 'dump' || command === 'all') {
    console.log(`sumber: ${source.url}`);
    const report = sealDump(await dumpDatabase(join(dir, dumpName()), source));
    console.log(reportLine(report));
    for (const name of pruneLocal(dir, keep)) console.log(`dipangkas: ${name}`);
    if (report.problems.length > 0) return 1;
    if (command === 'dump') return 0;
  }

  const bucket = s3ConfigFromEnv();
  if (!bucket) {
    console.error('Penyimpanan offsite belum dikonfigurasi (IHSAN_S3_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY).');
    return 2;
  }
  const newest = readdirSync(dir).filter((name) => /^ihsan-\d{8}-\d{9}\.db$/.test(name)).sort().pop();
  if (!newest) {
    console.error(`Tidak ada salinan lokal di ${dir}; jalankan "dump" lebih dulu.`);
    return 2;
  }
  const manifestPath = join(dir, `${newest}.json`);
  const report: DumpReport = JSON.parse(readFileSync(manifestPath, 'utf8')) as DumpReport;
  const uploaded = await uploadDump(bucket, { ...report, file: join(dir, newest) });
  console.log(`PASS unggah offsite — ${uploaded.key} (${uploaded.status})`);
  return 0;
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  process.exitCode = await main();
}
