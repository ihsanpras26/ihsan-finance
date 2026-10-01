// db/index.ts: database port over libSQL. The only module that knows the driver.
//
// Targets:
//   - local file  → "file:/abs/path.db"  (native libSQL binding; developer machines and tests)
//   - remote      → "libsql://<db>.turso.io" with IHSAN_DB_TOKEN (production, Turso)
// The HTTP client is imported for remote URLs on purpose: it is pure fetch and keeps the native
// addon out of serverless bundles. `await import()` is the only way to pick it by environment, and
// it is confined to this one line.
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client, Transaction } from '@libsql/client';

const HERE = dirname(fileURLToPath(import.meta.url));

export type BindValue = string | number | bigint | null | Uint8Array;

/** Driver values that are not native SQLite types; normalise before binding. */
export function bind(value: unknown): BindValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (value instanceof Date) return value.toISOString();
  // Whole numbers go in as bigint: the driver stores JS numbers through REAL, and REAL 1.0 written
  // into a TEXT column reads back as '1.0'. Money must land in the ledger as INTEGER (PRD rule 1).
  if (typeof value === 'number') return Number.isSafeInteger(value) ? BigInt(value) : value;
  if (typeof value === 'string' || typeof value === 'bigint' || value instanceof Uint8Array) return value;
  throw new TypeError(`Nilai tidak dapat disimpan: ${typeof value}`);
}

/** Current transaction for the running async context, so helpers follow tx() without threading it. */
const SESSION = new AsyncLocalStorage<{ txn: Transaction; depth: number }>();

let savepointSeq = 0;

export class Db {
  readonly #client: Client;
  readonly #remote: boolean;

  constructor(client: Client, remote: boolean) {
    this.#client = client;
    this.#remote = remote;
  }

  get remote(): boolean {
    return this.#remote;
  }

  /** Innermost active transaction of this async context, otherwise the bare connection. */
  #runner(): Client | Transaction {
    return SESSION.getStore()?.txn ?? this.#client;
  }

  async query<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    const result = await this.#runner().execute({ sql, args: params.map(bind) });
    return result.rows as T[];
  }

  async mutate(sql: string, params: readonly unknown[] = []): Promise<{ changes: number }> {
    const result = await this.#runner().execute({ sql, args: params.map(bind) });
    return { changes: Number(result.rowsAffected) };
  }

  /** Multi-statement script (schema, pragmas). No parameters. */
  async script(sql: string): Promise<void> {
    await this.#runner().executeMultiple(sql);
  }

  /**
   * Run fn inside one transaction (PRD §13: a failed step rolls back everything).
   * Re-entrant: a nested call becomes a SAVEPOINT on the outer transaction, so domain functions
   * compose (a correction that writes a replacement transaction, for example).
   * Nested calls share the outer session, which is why the transaction travels in async context
   * rather than in a field: two requests must never see each other's transaction.
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const store = SESSION.getStore();
    if (store) {
      const name = `sp_${store.depth}_${(savepointSeq += 1)}`;
      await store.txn.execute(`SAVEPOINT ${name}`);
      try {
        const result = await SESSION.run({ txn: store.txn, depth: store.depth + 1 }, fn);
        await store.txn.execute(`RELEASE ${name}`);
        return result;
      } catch (error) {
        try {
          await store.txn.execute(`ROLLBACK TO ${name}`);
          await store.txn.execute(`RELEASE ${name}`);
        } catch {
          // session already unwound; surface the original error
        }
        throw error;
      }
    }

    const txn = await this.#client.transaction('write');
    try {
      const result = await SESSION.run({ txn, depth: 1 }, fn);
      await txn.commit();
      return result;
    } catch (error) {
      try {
        await txn.rollback();
      } catch {
        // connection already unwound; surface the original error
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    // The native driver releases its file handle asynchronously; not awaiting it keeps the file locked.
    await this.#client.close();
  }
}

function isRemote(target: string): boolean {
  return /^(libsql|https?|wss?):/i.test(target);
}

/**
 * Open the database. `target` is a file path or a libsql:// URL; `authToken` is required only for
 * remote targets (Turso). File targets get the pragmas this schema relies on.
 */
export async function openDatabase(target: string, authToken?: string): Promise<Db> {
  if (isRemote(target)) {
    const { createClient } = await import('@libsql/client/web');
    const client = createClient({ url: target, authToken: authToken ?? process.env.IHSAN_DB_TOKEN });
    const db = new Db(client, true);
    // Turso enforces foreign keys server-side; a pragma over HTTP is best effort only.
    try {
      await db.script('PRAGMA foreign_keys = ON');
    } catch {
      // ignore: not every remote endpoint accepts a pragma statement
    }
    return db;
  }

  const { createClient } = await import('@libsql/client');
  const url = target.startsWith('file:') ? target : `file:${target}`;
  const client = createClient({ url });
  const db = new Db(client, false);
  await db.script('PRAGMA journal_mode = WAL');
  await db.script('PRAGMA foreign_keys = ON');
  await db.script('PRAGMA busy_timeout = 5000');
  await db.script('PRAGMA synchronous = NORMAL');
  return db;
}

export async function migrate(db: Db): Promise<void> {
  const schema = readFileSync(join(HERE, 'schema.sql'), 'utf8');
  await db.script(schema);
  await db.script('PRAGMA user_version = 1');
}

export async function run(db: Db, sql: string, ...params: unknown[]): Promise<{ changes: number }> {
  return db.mutate(sql, params);
}

export async function all<T = Record<string, unknown>>(db: Db, sql: string, ...params: unknown[]): Promise<T[]> {
  return db.query<T>(sql, params);
}

export async function one<T = Record<string, unknown>>(db: Db, sql: string, ...params: unknown[]): Promise<T | undefined> {
  const rows = await db.query<T>(sql, params);
  return rows[0];
}

export async function scalar(db: Db, sql: string, ...params: unknown[]): Promise<number> {
  const row = await one<Record<string, unknown>>(db, sql, ...params);
  if (!row) return 0;
  const value = Object.values(row)[0];
  if (value === null || value === undefined) return 0;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

export function tx<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
