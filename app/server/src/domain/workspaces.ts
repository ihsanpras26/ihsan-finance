// domain/workspaces.ts: the private room, its preferences, and the request context factory.
import { AppError } from '../core/errors.ts';
import { nowIso } from '../core/ids.ts';
import { one, run, tx, type Db } from '../db/index.ts';
import { recordAudit } from './audit.ts';
import type { TxContext } from './transactions.ts';

export interface WorkspaceRow {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface PreferencesRow {
  user_id: string;
  workspace_id: string;
  hide_amounts: number;
  reminders_on: number;
  theme: string;
  default_wallet_id: string | null;
  last_wallet_id: string | null;
  last_category_id: string | null;
  updated_at: string;
}

export function contextFor(db: Db, session: { userId: string; workspaceId: string; timezone: string }): TxContext {
  return { db, workspaceId: session.workspaceId, userId: session.userId, timezone: session.timezone };
}

export function getWorkspace(db: Db, workspaceId: string): WorkspaceRow {
  const row = one<WorkspaceRow>(db, `SELECT * FROM workspaces WHERE id = ?`, workspaceId);
  if (!row) throw new AppError('not_found', 'Ruang keuangan tidak ditemukan.');
  return row;
}

const KNOWN_TIMEZONES = [
  'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'UTC',
];

export function assertTimezone(value: unknown): string {
  const tz = String(value ?? '').trim();
  if (!tz) throw new AppError('validation_failed', 'Zona waktu wajib dipilih.', { fields: { timezone: 'required' } });
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  } catch {
    throw new AppError('validation_failed', 'Zona waktu tidak dikenali. Pilih dari daftar yang tersedia.', { fields: { timezone: 'invalid' } });
  }
  return tz;
}

export function listTimezones(): string[] {
  return KNOWN_TIMEZONES;
}

export function updateWorkspace(db: Db, workspaceId: string, actorUserId: string | null, input: { name?: string; timezone?: string }): WorkspaceRow {
  return tx(db, () => {
    const row = getWorkspace(db, workspaceId);
    const name = input.name === undefined ? row.name : String(input.name).trim();
    if (!name) throw new AppError('validation_failed', 'Nama ruang keuangan wajib diisi.', { fields: { name: 'required' } });
    if (name.length > 80) throw new AppError('validation_failed', 'Nama ruang keuangan maksimal 80 karakter.', { fields: { name: 'too_long' } });
    const timezone = input.timezone === undefined ? row.timezone : assertTimezone(input.timezone);
    run(db, `UPDATE workspaces SET name = ?, timezone = ?, updated_at = ? WHERE id = ?`, name, timezone, nowIso(), workspaceId);
    recordAudit(db, { workspaceId, actorUserId, action: 'update', entityType: 'workspace', entityId: workspaceId, before: { name: row.name, timezone: row.timezone }, after: { name, timezone } });
    return getWorkspace(db, workspaceId);
  });
}

export function getPreferences(db: Db, userId: string): PreferencesRow {
  const row = one<PreferencesRow>(db, `SELECT * FROM user_preferences WHERE user_id = ?`, userId);
  if (row) return row;
  throw new AppError('not_found', 'Preferensi pengguna belum dibuat.');
}

export function updatePreferences(db: Db, userId: string, input: Partial<{
  hideAmounts: boolean; remindersOn: boolean; theme: 'system' | 'light' | 'dark';
  defaultWalletId: string | null; lastWalletId: string | null; lastCategoryId: string | null;
}>): PreferencesRow {
  return tx(db, () => {
    const row = getPreferences(db, userId);
    const hide = input.hideAmounts === undefined ? row.hide_amounts : input.hideAmounts ? 1 : 0;
    const reminders = input.remindersOn === undefined ? row.reminders_on : input.remindersOn ? 1 : 0;
    let theme = input.theme === undefined ? row.theme : String(input.theme);
    if (!['system', 'light', 'dark'].includes(theme)) {
      throw new AppError('validation_failed', 'Pilihan tema harus Sistem, Terang, atau Gelap.', { fields: { theme: 'invalid' } });
    }
    const defaultWallet = input.defaultWalletId === undefined ? row.default_wallet_id : input.defaultWalletId;
    const lastWallet = input.lastWalletId === undefined ? row.last_wallet_id : input.lastWalletId;
    const lastCategory = input.lastCategoryId === undefined ? row.last_category_id : input.lastCategoryId;

    for (const [walletId, field] of [[defaultWallet, 'defaultWalletId'], [lastWallet, 'lastWalletId']] as const) {
      if (walletId) {
        const exists = one<{ id: string }>(db, `SELECT id FROM wallets WHERE workspace_id = ? AND id = ?`, row.workspace_id, walletId);
        if (!exists) throw new AppError('validation_failed', 'Dompet yang dipilih tidak ada di ruang keuangan ini.', { fields: { [field]: 'unknown' } });
      }
    }
    if (lastCategory) {
      const exists = one<{ id: string }>(db, `SELECT id FROM categories WHERE workspace_id = ? AND id = ?`, row.workspace_id, lastCategory);
      if (!exists) throw new AppError('validation_failed', 'Kategori yang dipilih tidak ada di ruang keuangan ini.', { fields: { lastCategoryId: 'unknown' } });
    }

    run(
      db,
      `UPDATE user_preferences SET hide_amounts = ?, reminders_on = ?, theme = ?, default_wallet_id = ?, last_wallet_id = ?, last_category_id = ?, updated_at = ?
       WHERE user_id = ?`,
      hide, reminders, theme, defaultWallet, lastWallet, lastCategory, nowIso(), userId,
    );
    return getPreferences(db, userId);
  });
}

/** Onboarding completion: a workspace counts as ready once it has at least one wallet. */
export function onboardingState(db: Db, workspaceId: string): { hasWallet: boolean; hasTransaction: boolean; hasCategory: boolean } {
  const wallets = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM wallets WHERE workspace_id = ?`, workspaceId);
  const categories = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM categories WHERE workspace_id = ?`, workspaceId);
  const transactions = one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM transactions WHERE workspace_id = ? AND status IN ('posted','reversed')`, workspaceId);
  return {
    hasWallet: (wallets?.n ?? 0) > 0,
    hasCategory: (categories?.n ?? 0) > 0,
    hasTransaction: (transactions?.n ?? 0) > 0,
  };
}
