// http/serialize.ts: rows to wire DTOs. Money leaves as a decimal string (PRD §11).
import { toDecimalString } from '../core/money.ts';
import type { CategoryRow } from '../domain/categories.ts';
import type { WalletView } from '../domain/wallets.ts';
import type { CategoryLeg, TxRow, WalletLeg } from '../domain/transactions.ts';
import type { PreferencesRow, WorkspaceRow } from '../domain/workspaces.ts';
import type { DebtPaymentView, DebtView } from '../domain/debts.ts';
import type { GoalAllocationView, GoalView } from '../domain/goals.ts';
import type { BudgetView } from '../domain/budgets.ts';
import type { OccurrenceView, RuleView } from '../domain/recurring.ts';
import type { NotificationView } from '../domain/notifications.ts';

export function serializeWallet(row: WalletView) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openedOn: row.opened_on,
    note: row.note,
    archivedAt: row.archived_at,
    balance: toDecimalString(row.balance),
    version: row.version,
  };
}

export function serializeCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    archivedAt: row.archived_at,
    version: row.version,
  };
}

export function serializeTransaction(row: TxRow, extras: {
  wallets?: WalletLeg[];
  category?: CategoryLeg | null;
  replacedBy?: string | null;
  reversedBy?: string | null;
  counterpartyName?: string | null;
}) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: toDecimalString(row.amount_minor),
    effectiveDate: row.effective_date,
    note: row.note,
    source: row.source,
    version: row.version,
    createdAt: row.created_at,
    category: extras.category ? { id: extras.category.id, name: extras.category.name, kind: extras.category.kind } : null,
    wallets: (extras.wallets ?? []).map((leg) => ({
      walletId: leg.walletId,
      walletName: leg.walletName,
      direction: leg.direction,
      amount: toDecimalString(leg.amount),
    })),
    reversalOf: row.reversal_of,
    replacementOf: row.replacement_of,
    replacedBy: extras.replacedBy ?? null,
    reversedBy: extras.reversedBy ?? null,
    counterparty: row.counterparty_id && extras.counterpartyName ? { id: row.counterparty_id, name: extras.counterpartyName } : null,
    meta: row.meta_json ? (JSON.parse(row.meta_json) as Record<string, unknown>) : null,
  };
}

export function serializeWorkspace(row: WorkspaceRow) {
  return { id: row.id, name: row.name, timezone: row.timezone, baseCurrency: row.base_currency, createdAt: row.created_at };
}

export function serializePreferences(row: PreferencesRow) {
  return {
    hideAmounts: row.hide_amounts === 1,
    remindersOn: row.reminders_on === 1,
    theme: row.theme,
    defaultWalletId: row.default_wallet_id,
    lastWalletId: row.last_wallet_id,
    lastCategoryId: row.last_category_id,
  };
}

export function serializeSessionUser(input: { userId: string; email: string; displayName: string; workspaceId: string; workspaceName: string; timezone: string; role: string }) {
  return {
    userId: input.userId,
    email: input.email,
    displayName: input.displayName,
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    timezone: input.timezone,
    role: input.role,
  };
}

// ── planning modules ────────────────────────────────────────────────────────

export function serializeDebt(row: DebtView) {
  return {
    id: row.id,
    direction: row.direction,
    counterpartyName: row.counterpartyName ?? 'Tanpa nama',
    counterpartyId: row.counterparty_id,
    principal: toDecimalString(row.principal_minor),
    remaining: toDecimalString(row.remaining),
    interestPaid: toDecimalString(row.interestPaid),
    feePaid: toDecimalString(row.feePaid),
    startDate: row.start_date,
    dueDate: row.due_date,
    note: row.note,
    status: row.status,
    reminderOff: row.reminder_off === 1,
    version: row.version,
    overdue: row.overdue,
    daysToDue: row.daysToDue,
    dueLabel: row.dueLabel,
    openingMode: row.opening_mode,
  };
}

export function serializeDebtPayment(row: DebtPaymentView) {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    principal: toDecimalString(row.principal_minor),
    interest: toDecimalString(row.interest_minor),
    fee: toDecimalString(row.fee_minor),
    cashAmount: toDecimalString(row.cashAmount),
    paymentDate: row.payment_date,
    note: row.note,
    transactionStatus: row.transactionStatus,
  };
}

export function serializeGoal(row: GoalView) {
  return {
    id: row.id,
    name: row.name,
    target: toDecimalString(row.target_minor),
    targetDate: row.target_date,
    priority: row.priority,
    status: row.status,
    allocated: toDecimalString(row.allocated),
    progress: row.progress,
    progressDisplay: row.progressDisplay,
    shortfall: toDecimalString(row.shortfall),
    monthlyPlan: row.monthlyPlan === null ? null : toDecimalString(row.monthlyPlan),
    monthsRemaining: row.monthsRemaining,
    funding: row.funding.map((entry) => ({
      walletId: entry.walletId,
      walletName: entry.walletName,
      allocated: toDecimalString(entry.allocated),
      walletBalance: toDecimalString(entry.walletBalance),
      shortfall: toDecimalString(entry.shortfall),
    })),
    fundingShortfall: toDecimalString(row.fundingShortfall),
    insufficient: row.insufficient,
    reachedTarget: row.reachedTarget,
    note: row.note,
    version: row.version,
  };
}

export function serializeGoalAllocation(row: GoalAllocationView) {
  return {
    id: row.id,
    walletId: row.wallet_id,
    walletName: row.walletName,
    direction: row.direction,
    amount: toDecimalString(row.amount_minor),
    effectiveDate: row.effective_date,
    note: row.note,
    linkedTransactionId: row.linked_tx_id,
    reversedBy: row.reversed_by,
  };
}

export function serializeBudget(row: BudgetView) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.categoryName,
    period: row.period,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    limit: toDecimalString(row.limit_minor),
    spent: toDecimalString(row.spent),
    remaining: toDecimalString(row.remaining),
    ratio: row.ratio,
    warning: row.warning,
    warningLabel: row.warningLabel,
    version: row.version,
  };
}

export function serializeRule(row: RuleView) {
  return {
    id: row.id,
    type: row.type,
    frequency: row.frequency,
    anchorDay: row.anchor_day,
    startOn: row.start_on,
    endOn: row.end_on,
    nextOn: row.next_on,
    mode: row.mode,
    status: row.status,
    template: row.template,
    typeLabel: row.typeLabel,
    frequencyLabel: row.frequencyLabel,
    version: row.version,
  };
}

export function serializeOccurrence(row: OccurrenceView) {
  return {
    id: row.id,
    ruleId: row.rule_id,
    scheduledDate: row.scheduled_date,
    status: row.status,
    transactionId: row.transaction_id,
    label: row.label,
    amount: toDecimalString(row.amount),
    ruleType: row.ruleType,
    frequency: row.frequency,
    template: row.template,
  };
}

export function serializeNotification(row: NotificationView) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at,
    daysUntil: row.daysUntil,
  };
}
