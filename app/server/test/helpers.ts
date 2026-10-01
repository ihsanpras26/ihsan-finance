// test/helpers.ts: test harness: one file-backed database per call, one workspace, system accounts.
// Databases are real files (not :memory:): libSQL hands every pooled connection its own private
// in-memory database, while the production target behaves like a file. They live in the OS temp
// directory and are not deleted, because the native driver only releases the handle when its
// finaliser runs (see db-port.test.ts).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, migrate, run, type Db } from '../src/db/index.ts';
import { uuidv7, nowIso } from '../src/core/ids.ts';
import { ensureSystemAccounts } from '../src/domain/ledger.ts';
import { hashPassword } from '../src/domain/auth.ts';

export interface TestCtx {
  db: Db;
  userId: string;
  workspaceId: string;
  timezone: string;
}

const dir = mkdtempSync(join(tmpdir(), 'ihsan-test-'));
let counter = 0;

export async function makeDb(): Promise<Db> {
  counter += 1;
  const db = await openDatabase(join(dir, `t${counter}.db`));
  await migrate(db);
  return db;
}

/** Build the request context used by every domain function. */
export function ctxOf(workspace: TestCtx) {
  return {
    db: workspace.db,
    workspaceId: workspace.workspaceId,
    userId: workspace.userId,
    timezone: workspace.timezone,
  };
}

export async function makeWorkspace(db: Db, opts: { email?: string; timezone?: string; name?: string } = {}): Promise<TestCtx> {
  const now = nowIso();
  const userId = uuidv7();
  const workspaceId = uuidv7();
  const email = opts.email ?? `uji${userId.slice(0, 8)}@contoh.id`;
  const { hash, salt } = hashPassword('rahasia-uji-123');
  await run(
    db,
    `INSERT INTO users (id, email, email_norm, password_hash, password_salt, display_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    userId, email, email.toLowerCase(), hash, salt, 'Pengguna Uji', now, now,
  );
  const timezone = opts.timezone ?? 'Asia/Jakarta';
  await run(
    db,
    `INSERT INTO workspaces (id, name, base_currency, timezone, owner_id, created_at, updated_at)
     VALUES (?, ?, 'IDR', ?, ?, ?, ?)`,
    workspaceId, opts.name ?? 'Ruang Uji', timezone, userId, now, now,
  );
  await run(
    db,
    `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at) VALUES (?, ?, ?, 'owner', 'active', ?)`,
    uuidv7(), workspaceId, userId, now,
  );
  await run(
    db,
    `INSERT INTO user_preferences (user_id, workspace_id, hide_amounts, reminders_on, theme, updated_at)
     VALUES (?, ?, 0, 1, 'system', ?)`,
    userId, workspaceId, now,
  );
  await ensureSystemAccounts(db, workspaceId);
  return { db, userId, workspaceId, timezone };
}
