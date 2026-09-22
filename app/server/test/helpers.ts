// test/helpers.ts: test harness: in-memory database, one workspace, system accounts.
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

export function makeDb(): Db {
  const db = openDatabase(':memory:');
  migrate(db);
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

export function makeWorkspace(db: Db, opts: { email?: string; timezone?: string; name?: string } = {}): TestCtx {
  const now = nowIso();
  const userId = uuidv7();
  const workspaceId = uuidv7();
  const email = opts.email ?? `uji${userId.slice(0, 8)}@contoh.id`;
  const { hash, salt } = hashPassword('rahasia-uji-123');
  run(
    db,
    `INSERT INTO users (id, email, email_norm, password_hash, password_salt, display_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    userId, email, email.toLowerCase(), hash, salt, 'Pengguna Uji', now, now,
  );
  const timezone = opts.timezone ?? 'Asia/Jakarta';
  run(
    db,
    `INSERT INTO workspaces (id, name, base_currency, timezone, owner_id, created_at, updated_at)
     VALUES (?, ?, 'IDR', ?, ?, ?, ?)`,
    workspaceId, opts.name ?? 'Ruang Uji', timezone, userId, now, now,
  );
  run(
    db,
    `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at) VALUES (?, ?, ?, 'owner', 'active', ?)`,
    uuidv7(), workspaceId, userId, now,
  );
  run(
    db,
    `INSERT INTO user_preferences (user_id, workspace_id, hide_amounts, reminders_on, theme, updated_at)
     VALUES (?, ?, 0, 1, 'system', ?)`,
    userId, workspaceId, now,
  );
  ensureSystemAccounts(db, workspaceId);
  return { db, userId, workspaceId, timezone };
}
