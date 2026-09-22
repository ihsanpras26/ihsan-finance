// http/routes/planning.ts: FR09..FR17: debts, receivables, goals, budgets, recurring, notifications.
// Handlers stay thin: validation and bookkeeping live in the domain modules.
import type { FastifyInstance } from 'fastify';
import { toDecimalString } from '../../core/money.ts';
import type { Db } from '../../db/index.ts';
import { contextFor } from '../../domain/workspaces.ts';
import {
  cancelDebtPayment, createDebt, getDebt, listDebts, recordDebtPayment, updateDebt, upcomingDebts, writeOffDebt,
} from '../../domain/debts.ts';
import {
  allocateGoal, archiveGoal, createGoal, getGoal, listGoals, releaseGoal, spendFromGoal, updateGoal,
} from '../../domain/goals.ts';
import { createBudget, getBudget, listBudgets, updateBudget } from '../../domain/budgets.ts';
import {
  confirmOccurrence, createRule, ensureOccurrences, getRule, listOccurrences, listRules, setRuleStatus,
  skipOccurrence, updateRule,
} from '../../domain/recurring.ts';
import { getNotification, listNotifications, markAllRead, markRead } from '../../domain/notifications.ts';
import { dashboardReport } from '../../domain/dashboard.ts';
import { categoryLegsFor, getTransactionRow, walletLegsFor } from '../../domain/transactions.ts';
import {
  serializeBudget, serializeDebt, serializeDebtPayment, serializeGoal, serializeGoalAllocation,
  serializeNotification, serializeOccurrence, serializeRule, serializeTransaction,
} from '../serialize.ts';

export interface RouteDeps { db: Db }

function idempotencyKey(request: { headers: Record<string, unknown> }): string | null {
  const raw = request.headers['idempotency-key'];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function optString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function registerPlanningRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db } = deps;

  /** A single transaction DTO, used when a planning action produces one. */
  function transactionDto(workspaceId: string, transactionId: string) {
    const row = getTransactionRow(db, workspaceId, transactionId);
    const legs = walletLegsFor(db, workspaceId, [transactionId]).get(transactionId) ?? [];
    const category = categoryLegsFor(db, workspaceId, [transactionId]).get(transactionId) ?? null;
    return serializeTransaction(row, { wallets: legs, category });
  }

  // ── debts and receivables (FR09..FR12) ────────────────────────────────────
  app.get('/debts/upcoming', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as { days?: string };
    const days = query.days ? Number.parseInt(query.days, 10) : 7;
    return {
      data: upcomingDebts(ctx, Number.isFinite(days) && days > 0 && days <= 90 ? days : 7).map((debt) => ({
        id: debt.id,
        counterpartyName: debt.counterpartyName ?? 'Tanpa nama',
        direction: debt.direction,
        amount: toDecimalString(debt.remaining),
        dueDate: debt.due_date,
        daysToDue: debt.daysToDue ?? 0,
      })),
    };
  });

  app.get('/debts', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as Record<string, string | undefined>;
    return {
      data: listDebts(ctx, {
        direction: query.direction === 'payable' || query.direction === 'receivable' ? query.direction : undefined,
        status: query.status as never,
        includeArchived: query.includeArchived === 'true',
      }).map(serializeDebt),
    };
  });

  app.post('/debts', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeDebt(
        createDebt(ctx, {
          direction: String(body.direction ?? ''),
          counterpartyName: String(body.counterpartyName ?? ''),
          principal: body.principal,
          startDate: optString(body.startDate),
          dueDate: body.dueDate === undefined ? undefined : (body.dueDate === null ? null : String(body.dueDate)),
          note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
          openingMode: String(body.openingMode ?? ''),
          walletId: optString(body.walletId),
        }, idempotencyKey(request as never)),
      ),
    };
  });

  app.get('/debts/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const debt = getDebt(contextFor(db, session), id);
    return {
      data: {
        ...serializeDebt(debt),
        payments: debt.payments.map(serializeDebtPayment),
      },
    };
  });

  app.patch('/debts/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeDebt(
        updateDebt(contextFor(db, session), id, {
          counterpartyName: optString(body.counterpartyName),
          dueDate: body.dueDate === undefined ? undefined : (body.dueDate === null ? null : String(body.dueDate)),
          note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
          reminderOff: typeof body.reminderOff === 'boolean' ? body.reminderOff : undefined,
          expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        }),
      ),
    };
  });

  app.post('/debts/:id/payments', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = recordDebtPayment(ctx, id, {
      principal: body.principal,
      interest: body.interest,
      fee: body.fee,
      walletId: String(body.walletId ?? ''),
      paymentDate: optString(body.paymentDate),
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
    }, idempotencyKey(request as never));
    return {
      data: {
        debt: serializeDebt(result.debt),
        payment: serializeDebtPayment(result.payment),
        transaction: transactionDto(ctx.workspaceId, result.payment.transaction_id),
      },
    };
  });

  app.post('/debts/:id/payments/:paymentId/cancel', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id, paymentId } = request.params as { id: string; paymentId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const debt = cancelDebtPayment(ctx, id, paymentId, {
      reason: body.reason === undefined || body.reason === null ? undefined : String(body.reason),
    }, idempotencyKey(request as never));
    return { data: serializeDebt(debt) };
  });

  app.post('/debts/:id/write-off', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeDebt(
        writeOffDebt(ctx, id, {
          reason: String(body.reason ?? ''),
          effectiveDate: optString(body.effectiveDate),
        }, idempotencyKey(request as never)),
      ),
    };
  });

  // ── goals (FR14) ──────────────────────────────────────────────────────────
  app.get('/goals', async (request) => {
    const session = request.session!;
    const query = request.query as Record<string, string | undefined>;
    return {
      data: listGoals(contextFor(db, session), {
        includeArchived: query.includeArchived === 'true',
        status: query.status as never,
      }).map(serializeGoal),
    };
  });

  app.post('/goals', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeGoal(
        createGoal(ctx, {
          name: String(body.name ?? ''),
          target: body.target,
          targetDate: body.targetDate === undefined ? undefined : (body.targetDate === null ? null : String(body.targetDate)),
          priority: typeof body.priority === 'number' ? body.priority : undefined,
          note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
        }, idempotencyKey(request as never)),
      ),
    };
  });

  app.get('/goals/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const goal = getGoal(contextFor(db, session), id);
    return {
      data: {
        ...serializeGoal(goal),
        allocations: goal.allocations.map(serializeGoalAllocation),
      },
    };
  });

  app.patch('/goals/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeGoal(
        updateGoal(contextFor(db, session), id, {
          name: optString(body.name),
          target: body.target,
          targetDate: body.targetDate === undefined ? undefined : (body.targetDate === null ? null : String(body.targetDate)),
          priority: typeof body.priority === 'number' ? body.priority : undefined,
          note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
          status: optString(body.status),
          expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        }),
      ),
    };
  });

  app.post('/goals/:id/allocations', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const key = idempotencyKey(request as never);
    if (body.direction === 'release') {
      const result = releaseGoal(ctx, id, {
        walletId: String(body.walletId ?? ''),
        amount: body.amount,
        effectiveDate: optString(body.effectiveDate),
        note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
      }, key);
      return {
        data: {
          goal: serializeGoal(result.goal),
          allocation: serializeGoalAllocation(result.allocation),
          transferId: result.transferId,
        },
      };
    }
    const result = allocateGoal(ctx, id, {
      walletId: String(body.walletId ?? ''),
      amount: body.amount,
      effectiveDate: optString(body.effectiveDate),
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
      moveMoney: body.moveMoney === true,
      toWalletId: optString(body.toWalletId),
    }, key);
    return {
      data: {
        goal: serializeGoal(result.goal),
        allocation: serializeGoalAllocation(result.allocation),
        transferId: result.transferId,
      },
    };
  });

  app.post('/goals/:id/spend', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = spendFromGoal(ctx, id, {
      walletId: String(body.walletId ?? ''),
      categoryId: String(body.categoryId ?? ''),
      amount: body.amount,
      effectiveDate: optString(body.effectiveDate),
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
    }, idempotencyKey(request as never));
    return {
      data: {
        goal: serializeGoal(result.goal),
        transaction: transactionDto(ctx.workspaceId, result.transactionId),
      },
    };
  });

  app.post('/goals/:id/archive', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeGoal(
        archiveGoal(ctx, id, {
          resolution: body.resolution === 'keep' ? 'keep' : 'release',
          reason: body.reason === undefined || body.reason === null ? null : String(body.reason),
        }, idempotencyKey(request as never)),
      ),
    };
  });

  // ── budgets (FR13) ────────────────────────────────────────────────────────
  app.get('/budgets', async (request) => {
    const session = request.session!;
    const query = request.query as Record<string, string | undefined>;
    return { data: listBudgets(contextFor(db, session), { period: optString(query.period) }).map(serializeBudget) };
  });

  app.get('/budgets/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeBudget(getBudget(contextFor(db, session), id)) };
  });

  app.post('/budgets', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeBudget(
        createBudget(ctx, {
          categoryId: String(body.categoryId ?? ''),
          period: String(body.period ?? ''),
          limit: body.limit,
        }, idempotencyKey(request as never)),
      ),
    };
  });

  app.patch('/budgets/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    return {
      data: serializeBudget(
        updateBudget(contextFor(db, session), id, {
          limit: body.limit,
          expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
        }),
      ),
    };
  });

  // ── recurring (FR15, FR16) ────────────────────────────────────────────────
  app.get('/recurring', async (request) => {
    const session = request.session!;
    const query = request.query as Record<string, string | undefined>;
    return { data: listRules(contextFor(db, session), { status: query.status as never }).map(serializeRule) };
  });

  app.get('/recurring/occurrences', async (request) => {
    const session = request.session!;
    const query = request.query as Record<string, string | undefined>;
    return {
      data: listOccurrences(contextFor(db, session), {
        status: query.status as never,
        ruleId: optString(query.ruleId),
      }).map(serializeOccurrence),
    };
  });

  app.post('/recurring', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const rule = createRule(ctx, {
      type: String(body.type ?? ''),
      frequency: String(body.frequency ?? ''),
      label: optString(body.label),
      amount: body.amount,
      walletId: String(body.walletId ?? ''),
      categoryId: optString(body.categoryId),
      toWalletId: optString(body.toWalletId),
      fee: body.fee,
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
      startOn: optString(body.startOn),
      endOn: body.endOn === undefined ? undefined : (body.endOn === null ? null : String(body.endOn)),
      anchorDay: typeof body.anchorDay === 'number' ? body.anchorDay : undefined,
    }, idempotencyKey(request as never));
    // Materialise due occurrences now, so a new rule shows its first item without waiting for the tick.
    ensureOccurrences(ctx);
    return { data: serializeRule(getRule(ctx, rule.id)) };
  });

  app.get('/recurring/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeRule(getRule(contextFor(db, session), id)) };
  });

  app.patch('/recurring/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const ctx = contextFor(db, session);
    updateRule(ctx, id, {
      label: optString(body.label),
      amount: body.amount,
      walletId: optString(body.walletId),
      categoryId: optString(body.categoryId),
      toWalletId: optString(body.toWalletId),
      fee: body.fee,
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
      frequency: optString(body.frequency),
      anchorDay: typeof body.anchorDay === 'number' ? body.anchorDay : undefined,
      endOn: body.endOn === undefined ? undefined : (body.endOn === null ? null : String(body.endOn)),
      expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
    });
    ensureOccurrences(ctx);
    return { data: serializeRule(getRule(ctx, id)) };
  });

  for (const action of ['pause', 'resume', 'stop'] as const) {
    app.post(`/recurring/:id/${action}`, async (request) => {
      const session = request.session!;
      const { id } = request.params as { id: string };
      return { data: serializeRule(setRuleStatus(contextFor(db, session), id, action)) };
    });
  }

  app.post('/recurring/occurrences/:id/confirm', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = confirmOccurrence(ctx, id, {
      amount: body.amount,
      walletId: optString(body.walletId),
      categoryId: optString(body.categoryId),
      toWalletId: optString(body.toWalletId),
      fee: body.fee,
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
      effectiveDate: optString(body.effectiveDate),
    }, idempotencyKey(request as never));
    return {
      data: {
        occurrence: serializeOccurrence(result.occurrence),
        transaction: transactionDto(ctx.workspaceId, result.transaction.id),
      },
    };
  });

  app.post('/recurring/occurrences/:id/skip', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeOccurrence(skipOccurrence(contextFor(db, session), id)) };
  });

  // ── notifications (FR11, FR13, FR16) ──────────────────────────────────────
  app.get('/notifications', async (request) => {
    const session = request.session!;
    const query = request.query as Record<string, string | undefined>;
    const status = query.status === 'unread' || query.status === 'read' ? query.status : undefined;
    return { data: listNotifications(contextFor(db, session), { status }).map(serializeNotification) };
  });

  app.get('/notifications/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeNotification(getNotification(contextFor(db, session), id)) };
  });

  app.post('/notifications/read-all', async (request) => {
    const session = request.session!;
    return { data: markAllRead(contextFor(db, session)) };
  });

  app.post('/notifications/:id/read', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeNotification(markRead(contextFor(db, session), id)) };
  });

  // ── dashboard (FR08) ──────────────────────────────────────────────────────
  app.get('/dashboard', async (request) => {
    const session = request.session!;
    const query = request.query as { asOf?: string };
    const view = dashboardReport(contextFor(db, session), optString(query.asOf));
    return {
      data: {
        ...view,
        totalBalance: toDecimalString(view.totalBalance),
        netWorth: toDecimalString(view.netWorth),
        netWorthParts: {
          cash: toDecimalString(view.netWorthParts.cash),
          receivable: toDecimalString(view.netWorthParts.receivable),
          payable: toDecimalString(view.netWorthParts.payable),
        },
        income: toDecimalString(view.income),
        expense: toDecimalString(view.expense),
        net: toDecimalString(view.net),
        wallets: view.wallets.map((wallet) => ({ ...wallet, balance: toDecimalString(wallet.balance) })),
        budgetRemaining: toDecimalString(view.budgetRemaining),
        upcoming: view.upcoming.map((entry) => ({ ...entry, amount: toDecimalString(entry.amount) })),
        goals: view.goals.map((goal) => ({
          ...goal,
          target: toDecimalString(goal.target),
          allocated: toDecimalString(goal.allocated),
        })),
        unallocated: toDecimalString(view.unallocated),
      },
    };
  });

  // ── debts report (FR18) ───────────────────────────────────────────────────
  app.get('/reports/debts', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as Record<string, string | undefined>;
    const includeArchived = query.includeArchived === 'true';
    const payable = listDebts(ctx, { direction: 'payable', includeArchived });
    const receivable = listDebts(ctx, { direction: 'receivable', includeArchived });
    const sum = (rows: typeof payable) => rows.reduce((total, row) => total + row.remaining, 0);
    return {
      data: {
        payable: payable.map(serializeDebt),
        receivable: receivable.map(serializeDebt),
        totals: {
          payable: toDecimalString(sum(payable)),
          receivable: toDecimalString(sum(receivable)),
        },
      },
    };
  });
}
