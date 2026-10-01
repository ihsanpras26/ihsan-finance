// http/routes/internal.ts: the scheduled entry point (FR11, FR17) for platforms whose cron calls
// the app over HTTP (Vercel cron). Single-process deployments keep the in-process timer in main.ts.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Db } from '../../db/index.ts';
import { runScheduler } from '../../workers/scheduler.ts';

export interface RouteDeps { db: Db }

/**
 * Vercel cron sends `Authorization: Bearer $CRON_SECRET`; other platforms use IHSAN_CRON_TOKEN.
 * Read per request, not at import time, so deployments and tests can configure it.
 */
function cronSecret(): string {
  return process.env.CRON_SECRET?.trim() || process.env.IHSAN_CRON_TOKEN?.trim() || '';
}

function tokenMatches(provided: string, expected: string): boolean {
  const given = createHash('sha256').update(provided).digest();
  const wanted = createHash('sha256').update(expected).digest();
  return timingSafeEqual(given, wanted);
}

function bearerOf(request: FastifyRequest): string {
  const match = /^Bearer\s+(.+)$/i.exec((request.headers.authorization ?? '').trim());
  return match?.[1]?.trim() ?? '';
}

export async function registerInternalRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const tick = async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = cronSecret();
    // Without a secret this endpoint does not exist: an unauthenticated scheduler trigger is a
    // request-flooding lever.
    if (secret === '') {
      return reply.status(404).send({ error: { code: 'not_found', message: 'Alamat API tidak ditemukan.' } });
    }
    if (!tokenMatches(bearerOf(request), secret)) {
      return reply.status(403).send({ error: { code: 'forbidden', message: 'Token penjadwal tidak sah.' } });
    }
    // Idempotent: the platform cron may call this repeatedly (FR11, FR17).
    const summary = await runScheduler(deps.db);
    return { data: summary };
  };

  app.get('/internal/tick', tick);
  app.post('/internal/tick', tick);
}
