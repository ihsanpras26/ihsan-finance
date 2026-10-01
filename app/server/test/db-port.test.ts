// db-port.test.ts: the database port contract (libSQL). These are the invariants the rest of the
// server relies on: one transaction per async context, nested savepoints, rollback on failure,
// and isolation between concurrent transactions.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { all, migrate, one, openDatabase, run, scalar, tx, type Db } from '../src/db/index.ts';

const dir = mkdtempSync(join(tmpdir(), 'ihsan-port-'));
let seq = 0;

async function freshDb(): Promise<Db> {
  seq += 1;
  const db = await openDatabase(join(dir, `port-${seq}.db`));
  await migrate(db);
  return db;
}

/** Minimal identity tables; the port tests do not need the domain schema beyond users/workspaces. */
async function insertUser(db: Db, id: string, email: string): Promise<void> {
  await run(
    db,
    `INSERT INTO users (id, email, email_norm, password_hash, password_salt, display_name, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 'salt', ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    id,
    email,
    email.toLowerCase(),
    id,
  );
}
after(async () => {
  // Best effort. On Windows the native driver releases the database file only when its finaliser
  // runs, which no amount of awaiting here can force; leftovers stay in the OS temp directory,
  // never in the repository.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      await setTimeout(100);
    }
  }
});

test('migrate applies the schema once and records the version', async () => {
  const db = await freshDb();
  await migrate(db);
  const tables = await scalar(db, `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'`);
  const version = await scalar(db, `PRAGMA user_version`);
  assert.ok(tables >= 20, `expected the full schema, got ${tables} tables`);
  assert.equal(version, 1);
  await db.close();
});
test('run, all, one and scalar bind values the way the schema expects', async () => {
  const db = await freshDb();
  await insertUser(db, 'u1', 'Satu@Contoh.id');
  const inserted = await run(db, `UPDATE users SET display_name = ? WHERE id = ?`, 'Satu', 'u1');
  assert.equal(inserted.changes, 1);

  const rows = await all<{ id: string; display_name: string }>(db, `SELECT id, display_name FROM users`);
  assert.deepEqual(rows, [{ id: 'u1', display_name: 'Satu' }]);

  const row = await one<{ email_norm: string }>(db, `SELECT email_norm FROM users WHERE id = ?`, 'u1');
  assert.equal(row?.email_norm, 'satu@contoh.id');
  assert.equal(await one(db, `SELECT id FROM users WHERE id = ?`, 'missing'), undefined);
  assert.equal(await scalar(db, `SELECT COUNT(*) FROM users WHERE id = ?`, 'missing'), 0);
  await db.close();
});

test('numbers stay INTEGER in the database', async () => {
  const db = await freshDb();
  await db.script('CREATE TABLE amounts (id TEXT PRIMARY KEY, amount INTEGER NOT NULL, rate REAL NOT NULL)');
  await run(db, `INSERT INTO amounts (id, amount, rate) VALUES (?, ?, ?)`, 'a', 999_999_999_999, 0.5);
  const row = await one<{ t: string; r: string; amount: number; rate: number }>(
    db,
    `SELECT typeof(amount) AS t, typeof(rate) AS r, amount, rate FROM amounts WHERE id = ?`,
    'a',
  );
  assert.equal(row?.t, 'integer', 'money must be stored as INTEGER');
  assert.equal(row?.amount, 999_999_999_999);
  assert.equal(row?.r, 'real');
  assert.equal(row?.rate, 0.5);
  await db.close();
});

test('tx commits together and rolls back everything on failure', async () => {
  const db = await freshDb();
  await tx(db, async () => {
    await insertUser(db, 'a', 'a@contoh.id');
    await insertUser(db, 'b', 'b@contoh.id');
  });
  assert.equal(await scalar(db, `SELECT COUNT(*) FROM users`), 2);

  await assert.rejects(
    tx(db, async () => {
      await insertUser(db, 'c', 'c@contoh.id');
      throw new Error('gagal di tengah');
    }),
    /gagal di tengah/,
  );
  assert.equal(await scalar(db, `SELECT COUNT(*) FROM users`), 2, 'the failed transaction must leave nothing behind');
  await db.close();
});

test('a nested tx is a savepoint: rolling it back keeps the outer work', async () => {
  const db = await freshDb();
  await tx(db, async () => {
    await insertUser(db, 'outer', 'outer@contoh.id');
    await assert.rejects(
      tx(db, async () => {
        await insertUser(db, 'inner', 'inner@contoh.id');
        throw new Error('batal dalam');
      }),
      /batal dalam/,
    );
  });
  const ids = (await all<{ id: string }>(db, `SELECT id FROM users ORDER BY id`)).map((row) => row.id);
  assert.deepEqual(ids, ['outer']);
  await db.close();
});

test('work inside one transaction never leaks into a concurrent async context', async () => {
  const db = await freshDb();
  const inserted = Promise.withResolvers<void>();
  const readDone = Promise.withResolvers<void>();
  const outside: number[] = [];

  const writer = tx(db, async () => {
    await insertUser(db, 'p', 'p@contoh.id');
    inserted.resolve();
    await readDone.promise;
    assert.equal(await scalar(db, `SELECT COUNT(*) FROM users`), 1, 'still inside its own transaction');
    return 'committed';
  });

  await inserted.promise;
  outside.push(await scalar(db, `SELECT COUNT(*) FROM users`));
  readDone.resolve();

  assert.equal(await writer, 'committed');
  assert.deepEqual(outside, [0], 'a concurrent read must not see uncommitted work');
  assert.equal(await scalar(db, `SELECT COUNT(*) FROM users`), 1);
  await db.close();
});


test('script runs multiple statements and can copy the database', async () => {
  const db = await freshDb();
  await db.script(`CREATE TABLE extra (id INTEGER PRIMARY KEY, note TEXT);
                   INSERT INTO extra (note) VALUES ('satu'), ('dua');`);
  assert.equal(await scalar(db, `SELECT COUNT(*) FROM extra`), 2);

  const copy = join(dir, 'copy.db');
  await db.script(`VACUUM INTO '${copy.replace(/\\/g, '/')}'`);
  assert.ok(existsSync(copy) && statSync(copy).size > 0, 'the snapshot file must exist and be non-empty');
  const opened = await openDatabase(copy);
  assert.equal(await scalar(opened, `SELECT COUNT(*) FROM extra`), 2);
  await opened.close();
  await db.close();
});

test('a unique violation surfaces as an error and aborts the transaction', async () => {
  const db = await freshDb();
  await insertUser(db, 'first', 'same@contoh.id');
  await assert.rejects(
    tx(db, async () => {
      await insertUser(db, 'second', 'same@contoh.id');
    }),
    /UNIQUE constraint failed/,
  );
  assert.equal(await scalar(db, `SELECT COUNT(*) FROM users`), 1);
  await db.close();
});

test('remote targets use the HTTP client, not the native file driver', async () => {
  const file = await freshDb();
  assert.equal(file.remote, false);
  await file.close();

  const remote = await openDatabase('libsql://tidak-ada.turso.invalid', 'token-uji');
  assert.equal(remote.remote, true, 'a libsql:// URL must select the remote client');
  // The host cannot resolve, so the query must fail in the transport layer: a missing module or a
  // native binding error would mean the wrong client was picked for a libsql:// URL.
  await assert.rejects(
    remote.query('SELECT 1'),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.ok(!/Cannot find module|ERR_MODULE_NOT_FOUND|bindings/i.test(message), message);
      assert.ok(/tidak-ada|fetch|ENOTFOUND|getaddrinfo|WebSocket|connect/i.test(message), message);
      return true;
    },
  );
  await remote.close();
});
