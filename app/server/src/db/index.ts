// db/index.ts: SQLite connection, migration and small query helpers.
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = DatabaseSync;

const HERE = dirname(fileURLToPath(import.meta.url));

export type BindValue = string | number | bigint | null | Uint8Array;

/** node:sqlite rejects booleans and undefined; normalise before binding. */
export function bind(value: unknown): BindValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint' || value instanceof Uint8Array) return value;
  throw new TypeError(`Nilai tidak dapat disimpan: ${typeof value}`);
}

export function openDatabase(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');
  return db;
}

export function migrate(db: Db): void {
  const schema = readFileSync(join(HERE, 'schema.sql'), 'utf8');
  db.exec(schema);
  db.exec('PRAGMA user_version = 1');
}

/**
 * Run fn inside a single database transaction. PRD §13: a failed step rolls back everything.
 * BEGIN IMMEDIATE takes the write lock up front so concurrent writers cannot interleave.
 * Re-entrant: a nested call uses SAVEPOINT so domain functions can compose (e.g. a correction
 * that creates a replacement transaction).
 */
const TX_DEPTH = new WeakMap<DatabaseSync, number>();

export function tx<T>(db: Db, fn: () => T): T {
  const depth = TX_DEPTH.get(db) ?? 0;
  const savepoint = depth > 0 ? `sp_${depth}_${Math.random().toString(36).slice(2, 8)}` : null;

  db.exec(savepoint ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
  TX_DEPTH.set(db, depth + 1);
  try {
    const result = fn();
    db.exec(savepoint ? `RELEASE ${savepoint}` : 'COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec(savepoint ? `ROLLBACK TO ${savepoint}` : 'ROLLBACK');
      if (savepoint) db.exec(`RELEASE ${savepoint}`);
    } catch {
      // connection already unwound; surface the original error
    }
    throw error;
  } finally {
    TX_DEPTH.set(db, depth);
  }
}

export function run(db: Db, sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
  const stmt: StatementSync = db.prepare(sql);
  const result = stmt.run(...params.map(bind));
  // node:sqlite types `changes` as number | bigint; row counts in this schema always fit a number.
  return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
}

export function all<T = Record<string, unknown>>(db: Db, sql: string, ...params: unknown[]): T[] {
  const stmt: StatementSync = db.prepare(sql);
  return stmt.all(...params.map(bind)) as T[];
}

export function one<T = Record<string, unknown>>(db: Db, sql: string, ...params: unknown[]): T | undefined {
  const stmt: StatementSync = db.prepare(sql);
  const row = stmt.get(...params.map(bind));
  return row as T | undefined;
}

export function scalar(db: Db, sql: string, ...params: unknown[]): number {
  const row = one<Record<string, unknown>>(db, sql, ...params);
  if (!row) return 0;
  const value = Object.values(row)[0];
  if (value === null || value === undefined) return 0;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}
