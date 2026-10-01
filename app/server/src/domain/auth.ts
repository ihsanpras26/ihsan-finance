// domain/auth.ts: password hashing, sessions, login throttling (NFR04).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso, randomToken, sha256 } from '../core/ids.ts';
import { all, one, run, scalar, tx, type Db } from '../db/index.ts';
import { ensureSystemAccounts } from './ledger.ts';

const SCRYPT_N = 16384;
const KEY_LEN = 64;
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MINUTES = 15;

export interface UserRow {
  id: string;
  email: string;
  email_norm: string;
  password_hash: string;
  password_salt: string;
  display_name: string;
  recovery_hash: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt ?? randomBytes(16).toString('hex');
  const hash = scryptSync(password, useSalt, KEY_LEN, { N: SCRYPT_N }).toString('hex');
  return { hash, salt: useSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N });
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertEmail(email: string): string {
  const value = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new AppError('validation_failed', 'Alamat email belum benar. Contoh: nama@email.com', { fields: { email: 'invalid' } });
  }
  return value;
}

export function assertPassword(password: string): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError('validation_failed', 'Kata sandi minimal 8 karakter.', { fields: { password: 'too_short' } });
  }
  return password;
}

async function recordAttempt(db: Db, emailNorm: string, ip: string | null, ok: boolean): Promise<void> {
  await run(
    db,
    `INSERT INTO login_attempts (id, email_norm, ip, ok, created_at) VALUES (?, ?, ?, ?, ?)`,
    uuidv7(), emailNorm, ip, ok ? 1 : 0, nowIso(),
  );
}

async function assertNotThrottled(db: Db, emailNorm: string): Promise<void> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60_000).toISOString();
  const failures = await scalar(
    db,
    `SELECT COUNT(*) FROM login_attempts WHERE email_norm = ? AND ok = 0 AND created_at >= ?`,
    emailNorm, since,
  );
  if (failures >= MAX_ATTEMPTS) {
    throw new AppError('rate_limited', `Terlalu banyak percobaan masuk. Coba lagi dalam ${ATTEMPT_WINDOW_MINUTES} menit.`);
  }
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  device_label: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function createSession(db: Db, userId: string, deviceLabel: string | null): Promise<{ token: string; sessionId: string; expiresAt: string }> {
  const token = randomToken(32);
  const id = uuidv7();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await run(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, device_label, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id, userId, sha256(token), deviceLabel, now, now, expiresAt,
  );
  return { token, sessionId: id, expiresAt };
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  workspaceId: string;
  timezone: string;
  email: string;
  displayName: string;
  role: string;
}

export async function resolveSession(db: Db, token: string): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await one<SessionRow>(db, `SELECT * FROM sessions WHERE token_hash = ?`, sha256(token));
  if (!session) return null;
  if (session.revoked_at) return null;
  if (session.expires_at <= nowIso()) return null;
  const user = await one<UserRow>(db, `SELECT * FROM users WHERE id = ?`, session.user_id);
  if (!user || user.status !== 'active') return null;
  const membership = await one<{ workspace_id: string; role: string }>(
    db,
    `SELECT workspace_id, role FROM memberships WHERE user_id = ? AND status = 'active' ORDER BY created_at LIMIT 1`,
    user.id,
  );
  if (!membership) return null;
  const workspace = await one<{ timezone: string }>(db, `SELECT timezone FROM workspaces WHERE id = ?`, membership.workspace_id);
  await run(db, `UPDATE sessions SET last_seen_at = ? WHERE id = ?`, nowIso(), session.id);
  return {
    sessionId: session.id,
    userId: user.id,
    workspaceId: membership.workspace_id,
    timezone: workspace?.timezone ?? 'Asia/Jakarta',
    email: user.email,
    displayName: user.display_name,
    role: membership.role,
  };
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await run(db, `UPDATE sessions SET revoked_at = ? WHERE id = ?`, nowIso(), sessionId);
}

export async function revokeOtherSessions(db: Db, userId: string, keepSessionId: string): Promise<number> {
  const result = await run(
    db,
    `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL`,
    nowIso(), userId, keepSessionId,
  );
  return Number(result.changes);
}

export async function listSessions(db: Db, userId: string): Promise<SessionRow[]> {
  return await all<SessionRow>(db, `SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC`, userId);
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  timezone?: string;
  workspaceName?: string;
}

export interface RegisterResult {
  user: UserRow;
  workspaceId: string;
  recoveryCode: string;
  token: string;
  expiresAt: string;
}

export async function registerUser(db: Db, input: RegisterInput): Promise<RegisterResult> {
  const email = assertEmail(input.email);
  const password = assertPassword(input.password);
  const emailNorm = normaliseEmail(email);
  const displayName = (input.displayName ?? '').trim() || email.split('@')[0]!;
  const timezone = input.timezone?.trim() || 'Asia/Jakarta';

  return tx(db, async () => {
    const existing = await one<{ id: string }>(db, `SELECT id FROM users WHERE email_norm = ?`, emailNorm);
    if (existing) {
      throw new AppError('validation_failed', 'Email ini sudah terdaftar. Masuk dengan email tersebut atau pakai email lain.', { fields: { email: 'taken' } });
    }
    const now = nowIso();
    const userId = uuidv7();
    const { hash, salt } = hashPassword(password);
    const recoveryCode = randomToken(12);
    await run(
      db,
      `INSERT INTO users (id, email, email_norm, password_hash, password_salt, display_name, recovery_hash, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      userId, email, emailNorm, hash, salt, displayName, sha256(recoveryCode), now, now,
    );
    const workspaceId = uuidv7();
    await run(
      db,
      `INSERT INTO workspaces (id, name, base_currency, timezone, owner_id, created_at, updated_at)
       VALUES (?, ?, 'IDR', ?, ?, ?, ?)`,
      workspaceId, input.workspaceName?.trim() || `Keuangan ${displayName}`, timezone, userId, now, now,
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
    const session = await createSession(db, userId, null);
    const user = (await one<UserRow>(db, `SELECT * FROM users WHERE id = ?`, userId))!;
    return { user, workspaceId, recoveryCode, token: session.token, expiresAt: session.expiresAt };
  });
}

export async function loginUser(db: Db, input: { email: string; password: string; ip?: string | null; deviceLabel?: string | null }): Promise<{ token: string; expiresAt: string; user: UserRow; workspaceId: string }> {
  const emailNorm = normaliseEmail(input.email);
  await assertNotThrottled(db, emailNorm);
  const user = await one<UserRow>(db, `SELECT * FROM users WHERE email_norm = ?`, emailNorm);
  if (!user || user.status !== 'active' || !verifyPassword(input.password, user.password_hash, user.password_salt)) {
    await recordAttempt(db, emailNorm, input.ip ?? null, false);
    throw new AppError('unauthorized', 'Email atau kata sandi belum cocok. Periksa lalu coba lagi.');
  }
  await recordAttempt(db, emailNorm, input.ip ?? null, true);
  const membership = await one<{ workspace_id: string }>(
    db,
    `SELECT workspace_id FROM memberships WHERE user_id = ? AND status = 'active' ORDER BY created_at LIMIT 1`,
    user.id,
  );
  if (!membership) throw new AppError('forbidden', 'Akun ini belum memiliki ruang keuangan.');
  const session = await createSession(db, user.id, input.deviceLabel ?? null);
  return { token: session.token, expiresAt: session.expiresAt, user, workspaceId: membership.workspace_id };
}

export async function recoverAccess(db: Db, input: { email: string; recoveryCode: string; newPassword: string }): Promise<{ token: string; expiresAt: string }> {
  const emailNorm = normaliseEmail(input.email);
  const user = await one<UserRow>(db, `SELECT * FROM users WHERE email_norm = ?`, emailNorm);
  if (!user || !user.recovery_hash || user.recovery_hash !== sha256(input.recoveryCode.trim())) {
    throw new AppError('unauthorized', 'Email atau kode pemulihan tidak cocok. Periksa kode dari saat pendaftaran.');
  }
  const password = assertPassword(input.newPassword);
  const { hash, salt } = hashPassword(password);
  await run(db, `UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?`, hash, salt, nowIso(), user.id);
  await run(db, `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, nowIso(), user.id);
  const session = await createSession(db, user.id, 'pemulihan');
  return { token: session.token, expiresAt: session.expiresAt };
}
