// domain/reports.ts: PRD §10 definitions. Every total is derived from the ledger, never stored.
import { negate } from '../core/money.ts';
import { addDays, currentPeriod, localDateInTz, monthBounds, resolvePeriod, yearBounds } from '../core/dates.ts';
import { all, one, scalar, type Db } from '../db/index.ts';
import { accountBalance, accountDelta, balancesByClass, classTotal, type AccountBalanceRow } from './ledger.ts';
import type { TxContext } from './transactions.ts';

export interface Period { start: string; end: string; label: string }

export function periodOf(ctx: TxContext, input: { period?: string; from?: string; to?: string }): Period {
  return resolvePeriod({ period: input.period, from: input.from, to: input.to, tz: ctx.timezone });
}

/** Previous period of the same length, used for comparisons (PRD FR18). */
export function previousPeriod(period: Period): Period {
  const startDay = new Date(`${period.start}T00:00:00Z`).getTime();
  const endDay = new Date(`${period.end}T00:00:00Z`).getTime();
  const span = Math.round((endDay - startDay) / 86_400_000) + 1;
  const prevEnd = addDays(period.start, -1);
  const prevStart = addDays(prevEnd, -(span - 1));
  return { start: prevStart, end: prevEnd, label: `${prevStart} s.d. ${prevEnd}` };
}

export interface CategoryLine {
  categoryId: string | null;
  name: string;
  kind: 'income' | 'expense';
  amount: number;
  share: number;
}

/** Net movement per income/expense category in a period. Refunds land on the refund date (PRD §10). */
export function categoryBreakdown(ctx: TxContext, period: Period, kind: 'income' | 'expense'): CategoryLine[] {
  const rows = all<{ id: string; name: string; raw: number }>(
    ctx.db,
    `SELECT c.id AS id, c.name AS name,
            COALESCE(SUM(CASE WHEN a.normal_side = 'debit' THEN l.debit_minor - l.credit_minor ELSE l.credit_minor - l.debit_minor END), 0) AS raw
     FROM categories c
     JOIN ledger_accounts a ON a.id = c.ledger_account_id
     LEFT JOIN journal_lines l ON l.ledger_account_id = c.ledger_account_id
     LEFT JOIN transactions t ON t.id = l.transaction_id AND t.status IN ('posted','reversed')
       AND t.effective_date BETWEEN ? AND ?
     WHERE c.workspace_id = ? AND c.kind = ?
     GROUP BY c.id
     HAVING raw <> 0
     ORDER BY raw DESC`,
    period.start, period.end, ctx.workspaceId, kind,
  );
  const total = rows.reduce((sum, row) => sum + row.raw, 0);
  return rows.map((row) => ({
    categoryId: row.id,
    name: row.name,
    kind,
    amount: row.raw,
    share: total === 0 ? 0 : row.raw / total,
  }));
}

/** Categories that no longer exist are still shown so the period adds up. */
export function uncategorised(ctx: TxContext, period: Period, kind: 'income' | 'expense'): number {
  const total = classTotal(ctx.db, ctx.workspaceId, kind, period.start, period.end);
  const named = categoryBreakdown(ctx, period, kind).reduce((sum, row) => sum + row.amount, 0);
  return total - named;
}

export interface Summary {
  period: Period;
  income: number;
  expense: number;
  net: number;
  openingBalance: number;
  closingBalance: number;
  netWorth: number;
  categoryBreakdown: CategoryLine[];
  comparison: { label: string; income: number; expense: number; net: number } | null;
}

export function summaryReport(ctx: TxContext, input: { period?: string; from?: string; to?: string; compare?: boolean }): Summary {
  const period = periodOf(ctx, input);
  const income = classTotal(ctx.db, ctx.workspaceId, 'income', period.start, period.end);
  const expense = classTotal(ctx.db, ctx.workspaceId, 'expense', period.start, period.end);
  const openingBalance = cashAt(ctx, addDays(period.start, -1));
  const closingBalance = cashAt(ctx, period.end);

  let comparison: Summary['comparison'] = null;
  if (input.compare) {
    const prev = previousPeriod(period);
    const prevIncome = classTotal(ctx.db, ctx.workspaceId, 'income', prev.start, prev.end);
    const prevExpense = classTotal(ctx.db, ctx.workspaceId, 'expense', prev.start, prev.end);
    comparison = { label: prev.label, income: prevIncome, expense: prevExpense, net: prevIncome - prevExpense };
  }

  return {
    period,
    income,
    expense,
    net: income - expense,
    openingBalance,
    closingBalance,
    netWorth: netWorthOf(ctx),
    categoryBreakdown: [...categoryBreakdown(ctx, period, 'expense'), ...categoryBreakdown(ctx, period, 'income')],
    comparison,
  };
}

/** Cash = every wallet asset account, archived wallets included while they hold value (PRD §04). */
export function cashAt(ctx: TxContext, asOf?: string): number {
  return walletBalances(ctx, asOf).reduce((sum, row) => sum + row.balance, 0);
}

export interface WalletBalanceView {
  id: string;
  name: string;
  type: string;
  archived: boolean;
  balance: number;
}

export function walletBalances(ctx: TxContext, asOf?: string): WalletBalanceView[] {
  const rows = all<{ id: string; name: string; type: string; archived_at: string | null; ledger_account_id: string }>(
    ctx.db,
    `SELECT id, name, type, archived_at, ledger_account_id FROM wallets WHERE workspace_id = ? ORDER BY archived_at IS NOT NULL, created_at`,
    ctx.workspaceId,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    archived: row.archived_at !== null,
    balance: accountBalance(ctx.db, ctx.workspaceId, row.ledger_account_id, asOf),
  }));
}

/** Receivables and payables outstanding right now, derived from each debt's own ledger account. */
export function debtTotals(ctx: TxContext, asOf?: string): { receivable: number; payable: number } {
  const rows = all<{ direction: 'payable' | 'receivable'; ledger_account_id: string; status: string }>(
    ctx.db,
    `SELECT direction, ledger_account_id, status FROM debts WHERE workspace_id = ? AND status IN ('active','paid')`,
    ctx.workspaceId,
  );
  let receivable = 0;
  let payable = 0;
  for (const row of rows) {
    const balance = accountBalance(ctx.db, ctx.workspaceId, row.ledger_account_id, asOf);
    if (row.direction === 'receivable') receivable += balance;
    else payable += balance;
  }
  return { receivable, payable };
}

export function netWorthOf(ctx: TxContext, asOf?: string): number {
  const cash = cashAt(ctx, asOf);
  const { receivable, payable } = debtTotals(ctx, asOf);
  return cash + receivable - payable;
}

export interface CashflowBucket { label: string; inflow: number; outflow: number; net: number }

export interface Cashflow {
  period: Period;
  opening: number;
  closing: number;
  change: number;
  buckets: CashflowBucket[];
  byActivity: { label: string; amount: number; kind: string }[];
  wallets: { walletId: string; name: string; opening: number; closing: number; change: number }[];
}

/** Cash flow explains the change in wallet balances (PRD §10). Internal transfers cancel out. */
export function cashflowReport(ctx: TxContext, input: { period?: string; from?: string; to?: string; bucket?: 'day' | 'week' | 'month' }): Cashflow {
  const period = periodOf(ctx, input);
  const opening = cashAt(ctx, addDays(period.start, -1));
  const closing = cashAt(ctx, period.end);

  const walletIds = all<{ id: string; ledger_account_id: string; name: string }>(
    ctx.db,
    `SELECT id, ledger_account_id, name FROM wallets WHERE workspace_id = ?`,
    ctx.workspaceId,
  );

  const activityRows = all<{ type: string; total: number }>(
    ctx.db,
    `SELECT t.type AS type, COALESCE(SUM(CASE WHEN a.normal_side = 'debit' THEN l.debit_minor - l.credit_minor ELSE l.credit_minor - l.debit_minor END), 0) AS total
     FROM journal_lines l
     JOIN transactions t ON t.id = l.transaction_id
     JOIN ledger_accounts a ON a.id = l.ledger_account_id
     WHERE l.workspace_id = ? AND t.effective_date BETWEEN ? AND ? AND t.status IN ('posted','reversed')
       AND a.class = 'asset' AND a.code LIKE 'A-WALLET:%'
     GROUP BY t.type
     ORDER BY ABS(total) DESC`,
    ctx.workspaceId, period.start, period.end,
  );

  const buckets = bucketise(ctx, period);
  const wallets = walletIds.map((wallet) => {
    const open = accountBalance(ctx.db, ctx.workspaceId, wallet.ledger_account_id, addDays(period.start, -1));
    const close = accountBalance(ctx.db, ctx.workspaceId, wallet.ledger_account_id, period.end);
    return { walletId: wallet.id, name: wallet.name, opening: open, closing: close, change: close - open };
  });

  return {
    period,
    opening,
    closing,
    change: closing - opening,
    buckets,
    byActivity: activityRows.map((row) => ({ label: ACTIVITY_LABEL[row.type] ?? row.type, amount: row.total, kind: row.type })),
    wallets,
  };
}

const ACTIVITY_LABEL: Record<string, string> = {
  income: 'Pendapatan',
  expense: 'Pengeluaran',
  transfer: 'Transfer antar dompet',
  refund: 'Pengembalian dana',
  debt_received: 'Utang diterima',
  receivable_given: 'Piutang diberikan',
  debt_payment: 'Pembayaran utang',
  receivable_payment: 'Penerimaan piutang',
  opening: 'Saldo awal',
  adjustment: 'Penyesuaian saldo',
  goal_spend: 'Belanja dari dana tujuan',
  reversal: 'Pembalikan',
};

function bucketise(ctx: TxContext, period: Period): CashflowBucket[] {
  const rows = all<{ d: string; inflow: number; outflow: number }>(
    ctx.db,
    `SELECT t.effective_date AS d,
            COALESCE(SUM(CASE WHEN a.normal_side = 'debit' THEN l.debit_minor - l.credit_minor ELSE 0 END), 0) AS inflow,
            COALESCE(SUM(CASE WHEN a.normal_side = 'credit' THEN l.credit_minor - l.debit_minor ELSE 0 END), 0) AS outflow
     FROM journal_lines l
     JOIN transactions t ON t.id = l.transaction_id
     JOIN ledger_accounts a ON a.id = l.ledger_account_id
     WHERE l.workspace_id = ? AND t.effective_date BETWEEN ? AND ? AND t.status IN ('posted','reversed')
       AND a.class = 'asset' AND a.code LIKE 'A-WALLET:%'
     GROUP BY t.effective_date
     ORDER BY t.effective_date`,
    ctx.workspaceId, period.start, period.end,
  );
  const byDate = new Map(rows.map((row) => [row.d, row]));
  const out: CashflowBucket[] = [];
  let cursor = period.start;
  const monthly = period.start.slice(0, 7) === period.end.slice(0, 7) && period.start.endsWith('-01') && period.end === monthBounds(period.start.slice(0, 7)).end;
  if (monthly) {
    // daily buckets inside a single month
    while (cursor <= period.end) {
      const row = byDate.get(cursor);
      out.push({ label: cursor.slice(8), inflow: row?.inflow ?? 0, outflow: row?.outflow ?? 0, net: (row?.inflow ?? 0) - (row?.outflow ?? 0) });
      cursor = addDays(cursor, 1);
    }
    return out;
  }
  // yearly view: monthly buckets
  const monthMap = new Map<string, { inflow: number; outflow: number }>();
  for (const row of rows) {
    const key = row.d.slice(0, 7);
    const entry = monthMap.get(key) ?? { inflow: 0, outflow: 0 };
    entry.inflow += row.inflow;
    entry.outflow += row.outflow;
    monthMap.set(key, entry);
  }
  for (const [key, value] of [...monthMap.entries()].sort()) {
    out.push({ label: key, inflow: value.inflow, outflow: value.outflow, net: value.inflow - value.outflow });
  }
  return out;
}

export interface NetWorthView {
  asOf: string;
  cash: number;
  receivable: number;
  payable: number;
  netWorth: number;
  wallets: WalletBalanceView[];
  debts: { id: string; counterpartyName: string; direction: 'payable' | 'receivable'; remaining: number }[];
}

export function netWorthReport(ctx: TxContext, asOf?: string): NetWorthView {
  const cash = cashAt(ctx, asOf);
  const { receivable, payable } = debtTotals(ctx, asOf);
  const debts = all<{ id: string; direction: 'payable' | 'receivable'; ledger_account_id: string; name: string | null }>(
    ctx.db,
    `SELECT d.id, d.direction, d.ledger_account_id, cp.name AS name
     FROM debts d LEFT JOIN counterparties cp ON cp.id = d.counterparty_id
     WHERE d.workspace_id = ? AND d.status IN ('active','paid')`,
    ctx.workspaceId,
  );
  return {
    asOf: asOf ?? localDateInTz(ctx.timezone),
    cash,
    receivable,
    payable,
    netWorth: cash + receivable - payable,
    wallets: walletBalances(ctx, asOf),
    debts: debts
      .map((row) => ({
        id: row.id,
        counterpartyName: row.name ?? 'Tanpa nama',
        direction: row.direction,
        remaining: accountBalance(ctx.db, ctx.workspaceId, row.ledger_account_id, asOf),
      }))
      .filter((row) => row.remaining !== 0),
  };
}

/** Assets minus liabilities straight from the ledger, used as a cross-check. */
export function ledgerNetWorth(ctx: TxContext, asOf?: string): number {
  const assets = balancesByClass(ctx.db, ctx.workspaceId, 'asset', asOf).reduce((sum, row) => sum + row.balance, 0);
  const liabilities = balancesByClass(ctx.db, ctx.workspaceId, 'liability', asOf).reduce((sum, row) => sum + row.balance, 0);
  return assets - liabilities;
}

export function unallocatedFunds(ctx: TxContext): number {
  const totalCash = cashAt(ctx);
  const allocated = scalar(
    ctx.db,
    `SELECT COALESCE(SUM(CASE WHEN direction = 'allocate' THEN amount_minor ELSE -amount_minor END), 0)
     FROM goal_allocations WHERE workspace_id = ? AND reversed_by IS NULL`,
    ctx.workspaceId,
  );
  return totalCash - allocated;
}

export function currentPeriodOf(ctx: TxContext): string {
  return currentPeriod(ctx.timezone);
}

export function yearPeriod(year: number): Period {
  const bounds = yearBounds(year);
  return { ...bounds, label: String(year) };
}

export function walletMovement(ctx: TxContext, walletId: string, period: Period): number {
  const row = one<{ ledger_account_id: string }>(ctx.db, `SELECT ledger_account_id FROM wallets WHERE workspace_id = ? AND id = ?`, ctx.workspaceId, walletId);
  if (!row) return 0;
  return accountDelta(ctx.db, ctx.workspaceId, row.ledger_account_id, period.start, period.end);
}

export function accountMovement(ctx: TxContext, account: AccountBalanceRow, period: Period): number {
  return accountDelta(ctx.db, ctx.workspaceId, account.account_id, period.start, period.end);
}

export function negated(value: number): number {
  return negate(value);
}

export function countTransactions(ctx: TxContext, from: string, to: string): number {
  return scalar(ctx.db, `SELECT COUNT(*) FROM transactions WHERE workspace_id = ? AND effective_date BETWEEN ? AND ? AND status IN ('posted','reversed')`, ctx.workspaceId, from, to);
}

export function dbOf(ctx: TxContext): Db {
  return ctx.db;
}
