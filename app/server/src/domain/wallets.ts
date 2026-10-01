// domain/wallets.ts: cash, bank, e-wallet accounts. Opening balance is a journal, never income.
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { parseAmount } from '../core/money.ts';
import { isValidIsoDate, localDateInTz } from '../core/dates.ts';
import { all, one, run, scalar, tx, type Db } from '../db/index.ts';
import { accountBalance, createWalletAccount, postJournal, renameAccount, systemAccountId } from './ledger.ts';
import { buildAdjustment, buildOpening } from './posting.ts';
import { recordAudit } from './audit.ts';
import { withIdempotency } from './idempotency.ts';
import { insertTransaction } from './transaction-store.ts';
import type { TxContext } from './transactions.ts';

export type WalletType = 'cash' | 'bank' | 'ewallet' | 'other';

export interface WalletRow {
  id: string;
  workspace_id: string;
  ledger_account_id: string;
  name: string;
  type: WalletType;
  opened_on: string;
  note: string | null;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WalletView extends WalletRow {
  balance: number;
}

const WALLET_LABEL: Record<WalletType, string> = {
  cash: 'Kas',
  bank: 'Bank',
  ewallet: 'E-wallet',
  other: 'Lainnya',
};

function assertType(value: unknown): WalletType {
  const type = String(value ?? '').trim() as WalletType;
  if (!['cash', 'bank', 'ewallet', 'other'].includes(type)) {
    throw new AppError('validation_failed', 'Jenis dompet harus salah satu dari Kas, Bank, E-wallet, atau Lainnya.', { fields: { type: 'invalid' } });
  }
  return type;
}

function assertName(value: unknown): string {
  const name = String(value ?? '').trim();
  if (!name) throw new AppError('validation_failed', 'Nama dompet wajib diisi.', { fields: { name: 'required' } });
  if (name.length > 80) throw new AppError('validation_failed', 'Nama dompet maksimal 80 karakter.', { fields: { name: 'too_long' } });
  return name;
}

export async function listWallets(ctx: TxContext, options: { includeArchived?: boolean; asOf?: string } = {}): Promise<WalletView[]> {
  const rows = options.includeArchived
    ? await all<WalletRow>(ctx.db, `SELECT * FROM wallets WHERE workspace_id = ? ORDER BY archived_at IS NOT NULL, created_at`, ctx.workspaceId)
    : await all<WalletRow>(ctx.db, `SELECT * FROM wallets WHERE workspace_id = ? AND archived_at IS NULL ORDER BY created_at`, ctx.workspaceId);
  const views: WalletView[] = [];
  for (const row of rows) {
    views.push({ ...row, balance: await accountBalance(ctx.db, ctx.workspaceId, row.ledger_account_id, options.asOf) });
  }
  return views;
}

export async function getWallet(ctx: TxContext, id: string): Promise<WalletView> {
  const row = await one<WalletRow>(ctx.db, `SELECT * FROM wallets WHERE workspace_id = ? AND id = ?`, ctx.workspaceId, id);
  if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
  return { ...row, balance: await accountBalance(ctx.db, ctx.workspaceId, row.ledger_account_id) };
}

export interface CreateWalletInput {
  name: string;
  type: WalletType | string;
  openingBalance?: unknown;
  openedOn?: string;
  note?: string | null;
}

export async function createWallet(ctx: TxContext, input: CreateWalletInput, idempotencyKey?: string | null): Promise<WalletView> {
  const { db, workspaceId } = ctx;
  const name = assertName(input.name);
  const type = assertType(input.type);
  const openedOn = input.openedOn && isValidIsoDate(input.openedOn) ? input.openedOn : localDateInTz(ctx.timezone);
  const opening = input.openingBalance === undefined || input.openingBalance === null || input.openingBalance === ''
    ? 0
    : parseAmount(input.openingBalance, { allowZero: true, field: 'openingBalance' });

  const outcome = await withIdempotency(db, { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { ...input, name, type, openedOn, opening } }, async () =>
    tx(db, async () => {
      const duplicate = await one<{ id: string }>(db, `SELECT id FROM wallets WHERE workspace_id = ? AND name = ? AND archived_at IS NULL`, workspaceId, name);
      if (duplicate) {
        throw new AppError('validation_failed', 'Sudah ada dompet aktif dengan nama ini. Pakai nama lain.', { fields: { name: 'taken' } });
      }
      const id = uuidv7();
      const accountId = await createWalletAccount(db, workspaceId, id, `${name} (${WALLET_LABEL[type]})`);
      const now = nowIso();
      await run(
        db,
        `INSERT INTO wallets (id, workspace_id, ledger_account_id, name, type, opened_on, note, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        id, workspaceId, accountId, name, type, openedOn, input.note?.toString().trim() || null, now, now,
      );
      if (opening > 0) {
        const txId = await insertTransaction(db, {
          workspaceId, type: 'opening', status: 'posted', amount: opening, effectiveDate: openedOn,
          note: `Saldo awal ${name}`, source: 'system', userId: ctx.userId, idempotencyKey: null,
          meta: { walletId: id },
        });
        await postJournal(db, {
          workspaceId, transactionId: txId,
          lines: buildOpening({ walletAccountId: accountId, openingEquityAccountId: await systemAccountId(db, workspaceId, 'EQ-OPENING'), amount: opening }),
        });
      }
      await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'create', entityType: 'wallet', entityId: id, after: { name, type, opening } });
      return getWallet(ctx, id);
    }),
  );
  return outcome.value;
}

export async function updateWallet(ctx: TxContext, id: string, input: { name?: string; type?: string; note?: string | null; expectedVersion?: number }): Promise<WalletView> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    const row = await one<WalletRow>(db, `SELECT * FROM wallets WHERE workspace_id = ? AND id = ?`, workspaceId, id);
    if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
    if (input.expectedVersion !== undefined && input.expectedVersion !== row.version) {
      throw new AppError('version_conflict', 'Dompet ini sudah berubah di perangkat lain. Muat ulang lalu ulangi perubahan.', { details: { serverVersion: row.version } });
    }
    const name = input.name === undefined ? row.name : assertName(input.name);
    const type = input.type === undefined ? row.type : assertType(input.type);
    const note = input.note === undefined ? row.note : (input.note?.toString().trim() || null);
    await run(
      db,
      `UPDATE wallets SET name = ?, type = ?, note = ?, version = version + 1, updated_at = ? WHERE id = ?`,
      name, type, note, nowIso(), id,
    );
    if (name !== row.name) await renameAccount(db, row.ledger_account_id, `${name} (${WALLET_LABEL[type]})`);
    await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'update', entityType: 'wallet', entityId: id, before: { name: row.name, type: row.type }, after: { name, type } });
    return getWallet(ctx, id);
  });
}

export async function archiveWallet(ctx: TxContext, id: string): Promise<WalletView> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    const row = await one<WalletRow>(db, `SELECT * FROM wallets WHERE workspace_id = ? AND id = ?`, workspaceId, id);
    if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
    await run(db, `UPDATE wallets SET archived_at = ?, version = version + 1, updated_at = ? WHERE id = ?`, nowIso(), nowIso(), id);
    await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'archive', entityType: 'wallet', entityId: id });
    return getWallet(ctx, id);
  });
}

export async function unarchiveWallet(ctx: TxContext, id: string): Promise<WalletView> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    await run(db, `UPDATE wallets SET archived_at = NULL, version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`, nowIso(), workspaceId, id);
    return getWallet(ctx, id);
  });
}

/** Permanent deletion is only allowed when the wallet has no ledger history at all (PRD FR02). */
export async function deleteWallet(ctx: TxContext, id: string): Promise<void> {
  const { db, workspaceId } = ctx;
  await tx(db, async () => {
    const row = await one<WalletRow>(db, `SELECT * FROM wallets WHERE workspace_id = ? AND id = ?`, workspaceId, id);
    if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
    const lines = await scalar(db, `SELECT COUNT(*) FROM journal_lines WHERE workspace_id = ? AND ledger_account_id = ?`, workspaceId, row.ledger_account_id);
    if (lines > 0) {
      throw new AppError('wallet_has_history', 'Dompet ini sudah memiliki histori transaksi, jadi tidak dapat dihapus permanen. Arsipkan saja.');
    }
    const linked = await scalar(db, `SELECT COUNT(*) FROM goal_allocations WHERE workspace_id = ? AND wallet_id = ?`, workspaceId, id);
    if (linked > 0) {
      throw new AppError('wallet_has_history', 'Dompet ini masih dipakai alokasi dana tujuan. Lepaskan alokasinya dulu.');
    }
    await run(db, `DELETE FROM wallets WHERE id = ?`, id);
    await run(db, `DELETE FROM ledger_accounts WHERE id = ?`, row.ledger_account_id);
    await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'delete', entityType: 'wallet', entityId: id, before: { name: row.name } });
  });
}

export interface ReconcileInput {
  actualBalance: unknown;
  reason: string;
  effectiveDate?: string;
}

/** Reconciliation stores only the reviewed difference, with a reason and an adjustment journal (PRD FR03). */
export async function reconcileWallet(ctx: TxContext, id: string, input: ReconcileInput, idempotencyKey?: string | null): Promise<{ walletId: string; difference: number; transactionId: string | null }> {
  const { db, workspaceId } = ctx;
  const actual = parseAmount(input.actualBalance, { allowZero: true, allowNegative: true, field: 'actualBalance' });
  const reason = String(input.reason ?? '').trim();
  if (reason.length < 3) {
    throw new AppError('validation_failed', 'Sebutkan alasan penyesuaian saldo (minimal 3 karakter).', { fields: { reason: 'required' } });
  }
  const effectiveDate = input.effectiveDate && isValidIsoDate(input.effectiveDate) ? input.effectiveDate : localDateInTz(ctx.timezone);

  const outcome = await withIdempotency(db, { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, actual, reason, effectiveDate } }, async () =>
    tx(db, async () => {
      const wallet = await getWallet(ctx, id);
      const difference = actual - wallet.balance;
      if (difference === 0) {
        return { walletId: id, difference: 0, transactionId: null };
      }
      const txId = await insertTransaction(db, {
        workspaceId, type: 'adjustment', status: 'posted', amount: Math.abs(difference), effectiveDate,
        note: `Penyesuaian saldo: ${reason}`, source: 'system', userId: ctx.userId, idempotencyKey: null,
        meta: { walletId: id, difference, reason },
      });
      await postJournal(db, {
        workspaceId, transactionId: txId,
        lines: buildAdjustment({
          walletAccountId: wallet.ledger_account_id,
          adjustmentEquityAccountId: await systemAccountId(db, workspaceId, 'EQ-ADJUST'),
          difference,
        }),
      });
      await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'reconcile', entityType: 'wallet', entityId: id, before: { balance: wallet.balance }, after: { actual, difference, reason } });
      return { walletId: id, difference, transactionId: txId };
    }),
  );
  return outcome.value;
}

/** Total money across wallets, archived ones included while they still hold a balance (PRD §04). */
export async function totalCash(ctx: TxContext, asOf?: string): Promise<number> {
  const rows = await all<{ ledger_account_id: string }>(ctx.db, `SELECT ledger_account_id FROM wallets WHERE workspace_id = ?`, ctx.workspaceId);
  let sum = 0;
  for (const row of rows) sum += await accountBalance(ctx.db, ctx.workspaceId, row.ledger_account_id, asOf);
  return sum;
}
