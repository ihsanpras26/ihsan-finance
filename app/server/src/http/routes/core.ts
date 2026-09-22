// http/routes/core.ts: wallets (FR02, FR03) and categories (FR05).
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../core/errors.ts';
import type { Db } from '../../db/index.ts';
import { contextFor } from '../../domain/workspaces.ts';
import { archiveWallet, createWallet, deleteWallet, getWallet, listWallets, reconcileWallet, unarchiveWallet, updateWallet } from '../../domain/wallets.ts';
import { archiveCategory, createCategory, listCategories, unarchiveCategory, updateCategory } from '../../domain/categories.ts';
import { listTimezones } from '../../domain/workspaces.ts';
import { serializeCategory, serializeWallet } from '../serialize.ts';

export interface RouteDeps { db: Db }

function idempotencyKey(request: { headers: Record<string, unknown> }): string | null {
  const raw = request.headers['idempotency-key'];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export async function registerCoreRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db } = deps;

  app.get('/timezones', async () => ({ data: listTimezones() }));

  // ── wallets ───────────────────────────────────────────────────────────────
  app.get('/wallets', async (request) => {
    const session = request.session!;
    const query = request.query as Record<string, string | undefined>;
    const ctx = contextFor(db, session);
    const rows = listWallets(ctx, { includeArchived: query.includeArchived === 'true', asOf: query.asOf });
    return { data: rows.map(serializeWallet) };
  });

  app.post('/wallets', async (request) => {
    const session = request.session!;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const ctx = contextFor(db, session);
    const wallet = createWallet(ctx, {
      name: String(body.name ?? ''),
      type: String(body.type ?? 'cash'),
      openingBalance: body.openingBalance,
      openedOn: typeof body.openedOn === 'string' ? body.openedOn : undefined,
      note: body.note === undefined || body.note === null ? null : String(body.note),
    }, idempotencyKey(request as never));
    return { data: serializeWallet(wallet) };
  });

  app.get('/wallets/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeWallet(getWallet(contextFor(db, session), id)) };
  });

  app.get('/wallets/:id/balance', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const query = request.query as { asOf?: string };
    const wallet = getWallet(contextFor(db, session), id);
    return {
      data: {
        walletId: wallet.id,
        asOf: query.asOf ?? null,
        balance: String(wallet.balance),
        archived: wallet.archived_at !== null,
      },
    };
  });

  app.patch('/wallets/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const wallet = updateWallet(contextFor(db, session), id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      type: typeof body.type === 'string' ? body.type : undefined,
      note: body.note === undefined ? undefined : (body.note === null ? null : String(body.note)),
      expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
    });
    return { data: serializeWallet(wallet) };
  });

  app.post('/wallets/:id/archive', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeWallet(archiveWallet(contextFor(db, session), id)) };
  });

  app.post('/wallets/:id/unarchive', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeWallet(unarchiveWallet(contextFor(db, session), id)) };
  });

  app.delete('/wallets/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    deleteWallet(contextFor(db, session), id);
    return { data: { ok: true } };
  });

  app.post('/wallets/:id/reconcile', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = reconcileWallet(contextFor(db, session), id, {
      actualBalance: body.actualBalance,
      reason: String(body.reason ?? ''),
      effectiveDate: typeof body.effectiveDate === 'string' ? body.effectiveDate : undefined,
    }, idempotencyKey(request as never));
    return {
      data: {
        walletId: result.walletId,
        difference: String(result.difference),
        transactionId: result.transactionId,
      },
    };
  });

  // ── categories ────────────────────────────────────────────────────────────
  app.get('/categories', async (request) => {
    const session = request.session!;
    const query = request.query as Record<string, string | undefined>;
    const kind = query.kind === 'income' || query.kind === 'expense' ? query.kind : undefined;
    const rows = listCategories(contextFor(db, session), { kind, includeArchived: query.includeArchived === 'true' });
    return { data: rows.map(serializeCategory) };
  });

  app.post('/categories', async (request) => {
    const session = request.session!;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const category = createCategory(contextFor(db, session), {
      name: String(body.name ?? ''),
      kind: String(body.kind ?? 'expense') as 'income' | 'expense',
    });
    return { data: serializeCategory(category) };
  });

  app.patch('/categories/:id', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const category = updateCategory(contextFor(db, session), id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
    });
    return { data: serializeCategory(category) };
  });

  app.post('/categories/:id/archive', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeCategory(archiveCategory(contextFor(db, session), id)) };
  });

  app.post('/categories/:id/unarchive', async (request) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    return { data: serializeCategory(unarchiveCategory(contextFor(db, session), id)) };
  });

  app.get('/onboarding', async (request) => {
    const session = request.session!;
    const { onboardingState } = await import('../../domain/workspaces.ts');
    return { data: onboardingState(db, session.workspaceId) };
  });

  app.post('/onboarding/seed-categories', async (request) => {
    const session = request.session!;
    const { seedDefaultCategories } = await import('../../domain/categories.ts');
    const created = seedDefaultCategories(contextFor(db, session));
    return { data: created.map(serializeCategory) };
  });

  app.post('/_guard', async () => {
    throw new AppError('not_found', 'Alamat ini tidak dipakai.');
  });
}
