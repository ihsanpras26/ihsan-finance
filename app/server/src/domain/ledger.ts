// domain/ledger.ts: the double-entry engine. Balances are always derived, never stored.
// Every function that touches the database is async (db port is libSQL over HTTP when remote).
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { addSafe, fromDbInt, negate } from '../core/money.ts';
import { all, one, run, scalar, type Db } from '../db/index.ts';

export type AccountClass = 'asset' | 'liability' | 'income' | 'expense' | 'equity';
export type NormalSide = 'debit' | 'credit';

export interface AccountRow {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  class: AccountClass;
  normal_side: NormalSide;
  currency: string;
  system_key: string | null;
  status: string;
  created_at: string;
}

/** Chart of accounts created with every workspace (ARCHITECTURE §5). */
export const SYSTEM_ACCOUNTS: ReadonlyArray<{ key: string; name: string; klass: AccountClass; normal: NormalSide }> = [
  { key: 'EQ-OPENING', name: 'Saldo Awal', klass: 'equity', normal: 'credit' },
  { key: 'EQ-ADJUST', name: 'Penyesuaian Saldo', klass: 'equity', normal: 'credit' },
  { key: 'EQ-WRITEOFF', name: 'Penghapusan', klass: 'equity', normal: 'credit' },
  { key: 'INC-INTEREST', name: 'Bunga Diterima', klass: 'income', normal: 'credit' },
  { key: 'EXP-INTEREST', name: 'Bunga Dibayar', klass: 'expense', normal: 'debit' },
  { key: 'EXP-FEE', name: 'Biaya dan Administrasi', klass: 'expense', normal: 'debit' },
];

const NORMAL: Record<AccountClass, NormalSide> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  income: 'credit',
  equity: 'credit',
};

export function normalSideOf(klass: AccountClass): NormalSide {
  return NORMAL[klass];
}

async function insertAccount(db: Db, workspaceId: string, code: string, name: string, klass: AccountClass, systemKey: string | null): Promise<string> {
  const id = uuidv7();
  await run(
    db,
    `INSERT INTO ledger_accounts (id, workspace_id, code, name, class, normal_side, currency, system_key, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'IDR', ?, 'active', ?)`,
    id, workspaceId, code, name, klass, NORMAL[klass], systemKey, nowIso(),
  );
  return id;
}

export async function ensureSystemAccounts(db: Db, workspaceId: string): Promise<void> {
  for (const acc of SYSTEM_ACCOUNTS) {
    const existing = await one<{ id: string }>(db, `SELECT id FROM ledger_accounts WHERE workspace_id = ? AND code = ?`, workspaceId, acc.key);
    if (!existing) await insertAccount(db, workspaceId, acc.key, acc.name, acc.klass, acc.key);
  }
}

export async function systemAccountId(db: Db, workspaceId: string, key: string): Promise<string> {
  const row = await one<{ id: string }>(db, `SELECT id FROM ledger_accounts WHERE workspace_id = ? AND code = ?`, workspaceId, key);
  if (!row) throw new AppError('internal', `Akun sistem ${key} belum dibuat untuk ruang ini.`);
  return row.id;
}

export function createWalletAccount(db: Db, workspaceId: string, walletId: string, name: string): Promise<string> {
  return insertAccount(db, workspaceId, `A-WALLET:${walletId}`, name, 'asset', null);
}

export async function createCategoryAccount(db: Db, workspaceId: string, categoryId: string, name: string, kind: 'income' | 'expense'): Promise<string> {
  const prefix = kind === 'income' ? 'INC' : 'EXP';
  return insertAccount(db, workspaceId, `${prefix}:${categoryId}`, name, kind, null);
}

export async function createDebtAccount(db: Db, workspaceId: string, debtId: string, direction: 'payable' | 'receivable', name: string): Promise<string> {
  return direction === 'payable'
    ? insertAccount(db, workspaceId, `L-PAYABLE:${debtId}`, name, 'liability', null)
    : insertAccount(db, workspaceId, `A-RECEIVABLE:${debtId}`, name, 'asset', null);
}

export async function renameAccount(db: Db, accountId: string, name: string): Promise<void> {
  await run(db, `UPDATE ledger_accounts SET name = ? WHERE id = ?`, name, accountId);
}

export async function accountById(db: Db, workspaceId: string, accountId: string): Promise<AccountRow> {
  const row = await one<AccountRow>(db, `SELECT * FROM ledger_accounts WHERE workspace_id = ? AND id = ?`, workspaceId, accountId);
  if (!row) throw new AppError('not_found', 'Akun buku besar tidak ditemukan di ruang keuangan ini.');
  return row;
}

export async function walletAccountId(db: Db, workspaceId: string, walletId: string): Promise<string> {
  const row = await one<{ ledger_account_id: string }>(db, `SELECT ledger_account_id FROM wallets WHERE workspace_id = ? AND id = ?`, workspaceId, walletId);
  if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
  return row.ledger_account_id;
}

export async function categoryAccountId(db: Db, workspaceId: string, categoryId: string): Promise<string> {
  const row = await one<{ ledger_account_id: string }>(db, `SELECT ledger_account_id FROM categories WHERE workspace_id = ? AND id = ?`, workspaceId, categoryId);
  if (!row) throw new AppError('not_found', 'Kategori tidak ditemukan di ruang keuangan ini.');
  return row.ledger_account_id;
}

// ── posting ─────────────────────────────────────────────────────────────────

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
}

/** Pure arithmetic check; stays synchronous (no database access). */
export function assertBalanced(lines: readonly JournalLineInput[]): void {
  if (lines.length < 2) {
    throw new AppError('internal', 'Transaksi harus memiliki sedikitnya dua baris jurnal.');
  }
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const d = line.debit ?? 0;
    const c = line.credit ?? 0;
    if (d < 0 || c < 0) throw new AppError('internal', 'Nilai jurnal tidak boleh negatif.');
    if ((d > 0) === (c > 0)) {
      throw new AppError('internal', 'Setiap baris jurnal harus memiliki tepat satu sisi bernilai positif.');
    }
    debit = addSafe(debit, d);
    credit = addSafe(credit, c);
  }
  if (debit !== credit) {
    throw new AppError('internal', `Jurnal tidak seimbang: debit ${debit} vs kredit ${credit}.`);
  }
  if (debit === 0) {
    throw new AppError('internal', 'Jurnal bernilai nol tidak dibukukan.');
  }
}

/** Write journal lines for a posted transaction. Caller must already be inside tx(). */
export async function postJournal(db: Db, input: { workspaceId: string; transactionId: string; lines: readonly JournalLineInput[]; createdAt?: string }): Promise<void> {
  assertBalanced(input.lines);
  const createdAt = input.createdAt ?? nowIso();
  for (const line of input.lines) {
    const account = await accountById(db, input.workspaceId, line.accountId);
    if (account.status !== 'active') {
      throw new AppError('validation_failed', `Akun ${account.name} sudah diarsipkan dan tidak dapat dipakai.`);
    }
    await run(
      db,
      `INSERT INTO journal_lines (id, workspace_id, transaction_id, ledger_account_id, debit_minor, credit_minor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      uuidv7(), input.workspaceId, input.transactionId, line.accountId, line.debit ?? 0, line.credit ?? 0, createdAt,
    );
  }
}

// ── balances ────────────────────────────────────────────────────────────────

/** Statuses that count towards balances: original postings and their reversals (they cancel). */
const LIVE = `t.status IN ('posted','reversed')`;

export async function accountBalance(db: Db, workspaceId: string, accountId: string, asOf?: string): Promise<number> {
  const sql = `SELECT COALESCE(SUM(l.debit_minor - l.credit_minor), 0) AS bal
               FROM journal_lines l JOIN transactions t ON t.id = l.transaction_id
               WHERE l.workspace_id = ? AND l.ledger_account_id = ? AND ${LIVE}
               ${asOf ? 'AND t.effective_date <= ?' : ''}`;
  const raw = asOf
    ? await scalar(db, sql, workspaceId, accountId, asOf)
    : await scalar(db, sql, workspaceId, accountId);
  const account = await accountById(db, workspaceId, accountId);
  return account.normal_side === 'debit' ? raw : negate(raw);
}

export async function walletBalance(db: Db, workspaceId: string, walletId: string, asOf?: string): Promise<number> {
  return accountBalance(db, workspaceId, await walletAccountId(db, workspaceId, walletId), asOf);
}

export interface AccountBalanceRow {
  account_id: string;
  code: string;
  name: string;
  class: AccountClass;
  normal_side: NormalSide;
  balance: number;
}

export async function balancesByClass(db: Db, workspaceId: string, klass: AccountClass, asOf?: string): Promise<AccountBalanceRow[]> {
  const sql = `SELECT a.id AS account_id, a.code, a.name, a.class, a.normal_side,
                      COALESCE(SUM(l.debit_minor - l.credit_minor), 0) AS raw
               FROM ledger_accounts a
               LEFT JOIN journal_lines l ON l.ledger_account_id = a.id
               LEFT JOIN transactions t ON t.id = l.transaction_id AND ${LIVE}
               WHERE a.workspace_id = ? AND a.class = ? ${asOf ? 'AND (t.effective_date IS NULL OR t.effective_date <= ?)' : ''}
               GROUP BY a.id
               ORDER BY a.code`;
  const rows = asOf
    ? await all<Record<string, unknown>>(db, sql, workspaceId, klass, asOf)
    : await all<Record<string, unknown>>(db, sql, workspaceId, klass);
  return rows.map((r) => {
    const raw = fromDbInt(r.raw ?? 0);
    const normal = r.normal_side as NormalSide;
    return {
      account_id: String(r.account_id),
      code: String(r.code),
      name: String(r.name),
      class: r.class as AccountClass,
      normal_side: normal,
      balance: normal === 'debit' ? raw : negate(raw),
    };
  });
}

/** Totals per class for a period, expressed on the account's normal side. */
export async function classTotal(db: Db, workspaceId: string, klass: AccountClass, from: string, to: string): Promise<number> {
  const raw = await scalar(
    db,
    `SELECT COALESCE(SUM(l.debit_minor - l.credit_minor), 0)
     FROM journal_lines l JOIN transactions t ON t.id = l.transaction_id
     WHERE l.workspace_id = ? AND t.effective_date BETWEEN ? AND ? AND ${LIVE}
       AND l.ledger_account_id IN (SELECT id FROM ledger_accounts WHERE workspace_id = ? AND class = ?)`,
    workspaceId, from, to, workspaceId, klass,
  );
  return NORMAL[klass] === 'debit' ? raw : negate(raw);
}

/** Cash movement for one account inside a period (signed: positive increases the account). */
export async function accountDelta(db: Db, workspaceId: string, accountId: string, from: string, to: string): Promise<number> {
  const account = await accountById(db, workspaceId, accountId);
  const raw = await scalar(
    db,
    `SELECT COALESCE(SUM(l.debit_minor - l.credit_minor), 0)
     FROM journal_lines l JOIN transactions t ON t.id = l.transaction_id
     WHERE l.workspace_id = ? AND l.ledger_account_id = ? AND t.effective_date BETWEEN ? AND ? AND ${LIVE}`,
    workspaceId, accountId, from, to,
  );
  return account.normal_side === 'debit' ? raw : negate(raw);
}

// ── integrity ───────────────────────────────────────────────────────────────

export interface IntegrityReport {
  ok: boolean;
  problems: string[];
}

/** Rebuild-check used by tests and by the observability alarm (PRD NFR08). */
export async function verifyIntegrity(db: Db, workspaceId: string): Promise<IntegrityReport> {
  const problems: string[] = [];
  const unbalanced = await all<{ id: string; debit: number; credit: number }>(
    db,
    `SELECT t.id AS id, SUM(l.debit_minor) AS debit, SUM(l.credit_minor) AS credit
     FROM transactions t JOIN journal_lines l ON l.transaction_id = t.id
     WHERE t.workspace_id = ? GROUP BY t.id HAVING SUM(l.debit_minor) <> SUM(l.credit_minor)`,
    workspaceId,
  );
  for (const row of unbalanced) {
    problems.push(`Transaksi ${row.id} tidak seimbang (debit ${row.debit} vs kredit ${row.credit}).`);
  }
  const postedWithoutLines = await all<{ id: string }>(
    db,
    `SELECT t.id FROM transactions t
     WHERE t.workspace_id = ? AND t.status IN ('posted','reversed')
       AND NOT EXISTS (SELECT 1 FROM journal_lines l WHERE l.transaction_id = t.id)`,
    workspaceId,
  );
  for (const row of postedWithoutLines) problems.push(`Transaksi ${row.id} berstatus posted tanpa baris jurnal.`);

  const plannedWithLines = await all<{ id: string }>(
    db,
    `SELECT t.id FROM transactions t
     WHERE t.workspace_id = ? AND t.status = 'planned'
       AND EXISTS (SELECT 1 FROM journal_lines l WHERE l.transaction_id = t.id)`,
    workspaceId,
  );
  for (const row of plannedWithLines) problems.push(`Transaksi ${row.id} berstatus planned tetapi sudah memiliki jurnal.`);

  const orphanLines = await scalar(
    db,
    `SELECT COUNT(*) FROM journal_lines l JOIN transactions t ON t.id = l.transaction_id
     WHERE l.workspace_id = ? AND t.workspace_id <> l.workspace_id`,
    workspaceId,
  );
  if (orphanLines > 0) problems.push(`${orphanLines} baris jurnal menunjuk transaksi ruang lain.`);

  return { ok: problems.length === 0, problems };
}

export async function rebuildWalletBalance(db: Db, workspaceId: string, walletId: string, asOf?: string): Promise<number> {
  return walletBalance(db, workspaceId, walletId, asOf);
}
