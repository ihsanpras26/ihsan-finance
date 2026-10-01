// domain/dashboard.ts: one call that fills the home screen (PRD FR08).
import { localDateInTz } from '../core/dates.ts';
import { cashAt, currentPeriodOf, netWorthReport, summaryReport, unallocatedFunds } from './reports.ts';
import { listBudgets } from './budgets.ts';
import { listGoals } from './goals.ts';
import { upcomingDebts } from './debts.ts';
import { listOccurrences } from './recurring.ts';
import { unreadCount } from './notifications.ts';
import type { TxContext } from './transactions.ts';

export interface DashboardView {
  asOf: string;
  period: { start: string; end: string; label: string };
  totalBalance: number;
  netWorth: number;
  netWorthParts: { cash: number; receivable: number; payable: number };
  income: number;
  expense: number;
  net: number;
  wallets: { id: string; name: string; type: string; balance: number; archived: boolean }[];
  budgetRemaining: number;
  budgetsOver: number;
  upcoming: { id: string; counterpartyName: string; direction: 'payable' | 'receivable'; amount: number; dueDate: string; daysToDue: number }[];
  goals: { id: string; name: string; target: number; allocated: number; progress: number; status: string }[];
  unallocated: number;
  draftsPending: number;
  pendingOccurrences: number;
  unreadNotifications: number;
}

export async function dashboardReport(ctx: TxContext, asOf?: string): Promise<DashboardView> {
  const today = asOf ?? localDateInTz(ctx.timezone);
  const period = currentPeriodOf(ctx);
  const worth = await netWorthReport(ctx, today);
  const summary = await summaryReport(ctx, { period });
  const budgets = await listBudgets(ctx, { period });
  const goals = await listGoals(ctx);
  const upcoming = await upcomingDebts(ctx, 7);
  const pending = await listOccurrences(ctx, { status: 'pending' });

  // Money still available to spend: budgets already over their limit contribute nothing.
  const budgetRemaining = budgets.reduce((total, budget) => total + Math.max(0, budget.remaining), 0);
  const budgetsOver = budgets.filter((budget) => budget.warning === 'over').length;

  return {
    asOf: today,
    period: summary.period,
    totalBalance: await cashAt(ctx, today),
    netWorth: worth.netWorth,
    netWorthParts: { cash: worth.cash, receivable: worth.receivable, payable: worth.payable },
    income: summary.income,
    expense: summary.expense,
    net: summary.net,
    wallets: worth.wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      balance: wallet.balance,
      archived: wallet.archived,
    })),
    budgetRemaining,
    budgetsOver,
    upcoming: upcoming.map((debt) => ({
      id: debt.id,
      counterpartyName: debt.counterpartyName ?? 'Tanpa nama',
      direction: debt.direction,
      amount: debt.remaining,
      dueDate: debt.due_date ?? today,
      daysToDue: debt.daysToDue ?? 0,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      target: goal.target_minor,
      allocated: goal.allocated,
      progress: goal.progress,
      status: goal.status,
    })),
    unallocated: await unallocatedFunds(ctx),
    // Drafts live in the browser (PRD FR22); the server cannot see them.
    draftsPending: 0,
    pendingOccurrences: pending.length,
    unreadNotifications: await unreadCount(ctx),
  };
}
