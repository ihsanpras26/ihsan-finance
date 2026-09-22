// http/routes/transactions.ts: FR05, FR06, FR07.
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/index.ts';
import { parseAmount } from '../../core/money.ts';
import { contextFor } from '../../domain/workspaces.ts';
import {
  categoryLegsFor, correctTransaction, createTransaction, getTransactionRow, listTransactions,
  postPlannedTransaction, replacedBy, reverseTransaction, reversedBy, transactionImpact, walletLegsFor,
  type TxStatus, type TxType,
} from '../../domain/transactions.ts';
import { serializeTransaction } from '../serialize.ts';
import { all } from '../../db/index.ts';

export interface RouteDeps { db: Db }

function idempotencyKey(request: { headers: Record<string, unknown> }): string | null {
  const raw = request.headers['idempotency-key'];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function counterpartyNames(db: Db, workspaceId: string, ids: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => '?').join(',');
  for (const row of all<{ id: string; name: string }>(db, `SELECT id, name FROM counterparties WHERE workspace_id = ? AND id IN (${placeholders})`, workspaceId, ...unique)) {
    map.set(row.id, row.name);
  }
  return map;
}

export async function registerTransactionRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db } = deps;

  app.get('/transactions', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as Record<string, string | undefined>;
    const page = listTransactions(ctx, {
      from: query.from,
      to: query.to,
      type: query.type as TxType | undefined,
      status: query.status as TxStatus | undefined,
      walletId: query.walletId,
      categoryId: query.categoryId,
      q: query.q,
      min: query.min ? parseAmount(query.min, { allowZero: true, allowNegative: true }) : undefined,
      max: query.max ? parseAmount(query.max, { allowZero: true, allowNegative: true }) : undefined,
      page: query.page ? Number.parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? Number.parseInt(query.pageSize, 10) : 25,
    });

    const ids = page.items.map((row) => row.id);
    const legs = walletLegsFor(db, ctx.workspaceId, ids);
    const categories = categoryLegsFor(db, ctx.workspaceId, ids);
    const names = counterpartyNames(db, ctx.workspaceId, page.items.map((row) => row.counterparty_id ?? '').filter(Boolean));

    return {
      data: {
        items: page.items.map((row) =>
          serializeTransaction(row, {
            wallets: legs.get(row.id) ?? [],
            category: categories.get(row.id) ?? null,
            replacedBy: replacedBy(db, ctx.workspaceId, row.id),
            reversedBy: reversedBy(db, ctx.workspaceId, row.id),
            counterpartyName: row.counterparty_id ? names.get(row.counterparty_id) ?? null : null,
          }),
        ),
        total: page.total,
        page: page.page,
        pageSize: page.pageSize,
      },
    };
  });

  app.post('/transactions', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const row = createTransaction(ctx, {
      type: String(body.type ?? 'expense') as 'income' | 'expense' | 'transfer' | 'refund',
      amount: body.amount,
      effectiveDate: typeof body.effectiveDate === 'string' ? body.effectiveDate : undefined,
      note: body.note === undefined || body.note === null ? null : String(body.note),
      walletId: typeof body.walletId === 'string' ? body.walletId : undefined,
      categoryId: typeof body.categoryId === 'string' ? body.categoryId : undefined,
      toWalletId: typeof body.toWalletId === 'string' ? body.toWalletId : undefined,
      fee: body.fee,
      refundOf: typeof body.refundOf === 'string' ? body.refundOf : undefined,
      source: 'manual',
    }, idempotencyKey(request as never));

    const legs = walletLegsFor(db, ctx.workspaceId, [row.id]).get(row.id) ?? [];
    const categories = categoryLegsFor(db, ctx.workspaceId, [row.id]).get(row.id) ?? null;
    return { data: serializeTransaction(row, { wallets: legs, category: categories }) };
  });

  app.get('/transactions/:id', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const row = getTransactionRow(db, ctx.workspaceId, id);
    const legs = walletLegsFor(db, ctx.workspaceId, [id]).get(id) ?? [];
    const categories = categoryLegsFor(db, ctx.workspaceId, [id]).get(id) ?? null;

    // Correction history: this transaction's own reversal/replacement chain.
    const related = all<{ id: string }>(
      db,
      `SELECT id FROM transactions
       WHERE workspace_id = ? AND (id = ? OR original_id = ? OR replacement_of = ? OR reversal_of = ?)
       ORDER BY created_at`,
      ctx.workspaceId, id, id, id, id,
    );
    const historyIds = related.map((entry) => entry.id);
    const historyLegs = walletLegsFor(db, ctx.workspaceId, historyIds);
    const historyCategories = categoryLegsFor(db, ctx.workspaceId, historyIds);
    const history = all<ReturnType<typeof getTransactionRow> extends never ? never : Parameters<typeof serializeTransaction>[0]>(
      db,
      `SELECT * FROM transactions WHERE workspace_id = ? AND id IN (${historyIds.map(() => '?').join(',') || "''"}) ORDER BY created_at`,
      ctx.workspaceId, ...historyIds,
    ).map((entry) =>
      serializeTransaction(entry, {
        wallets: historyLegs.get(entry.id) ?? [],
        category: historyCategories.get(entry.id) ?? null,
        replacedBy: replacedBy(db, ctx.workspaceId, entry.id),
        reversedBy: reversedBy(db, ctx.workspaceId, entry.id),
      }),
    );

    return {
      data: {
        ...serializeTransaction(row, {
          wallets: legs,
          category: categories,
          replacedBy: replacedBy(db, ctx.workspaceId, id),
          reversedBy: reversedBy(db, ctx.workspaceId, id),
        }),
        history,
      },
    };
  });

  app.get('/transactions/:id/impact', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: transactionImpact(contextFor(db, session), id) };
  });

  app.patch('/transactions/:id', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const row = correctTransaction(ctx, id, {
      amount: body.amount,
      effectiveDate: typeof body.effectiveDate === 'string' ? body.effectiveDate : undefined,
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
      walletId: typeof body.walletId === 'string' ? body.walletId : undefined,
      categoryId: typeof body.categoryId === 'string' ? body.categoryId : undefined,
      toWalletId: typeof body.toWalletId === 'string' ? body.toWalletId : undefined,
      fee: body.fee,
      expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });
    const legs = walletLegsFor(db, ctx.workspaceId, [row.id]).get(row.id) ?? [];
    const categories = categoryLegsFor(db, ctx.workspaceId, [row.id]).get(row.id) ?? null;
    return { data: serializeTransaction(row, { wallets: legs, category: categories }) };
  });

  app.post('/transactions/:id/reverse', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = reverseTransaction(ctx, id, typeof body.reason === 'string' ? body.reason : undefined);
    const legs = walletLegsFor(db, ctx.workspaceId, [result.row.id]).get(result.row.id) ?? [];
    const categories = categoryLegsFor(db, ctx.workspaceId, [result.row.id]).get(result.row.id) ?? null;
    return {
      data: {
        reversalId: result.reversalId,
        transaction: serializeTransaction(result.row, { wallets: legs, category: categories, reversedBy: result.reversalId }),
      },
    };
  });

  app.post('/transactions/:id/post', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const { id } = request.params as { id: string };
    const row = postPlannedTransaction(ctx, id);
    const legs = walletLegsFor(db, ctx.workspaceId, [row.id]).get(row.id) ?? [];
    const categories = categoryLegsFor(db, ctx.workspaceId, [row.id]).get(row.id) ?? null;
    return { data: serializeTransaction(row, { wallets: legs, category: categories }) };
  });
}
