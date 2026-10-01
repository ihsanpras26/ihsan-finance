// http/server.ts: Fastify factory: session resolution, error envelope, static PWA hosting.
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { AppError } from '../core/errors.ts';
import { config } from '../config.ts';
import type { Db } from '../db/index.ts';
import { getWorkspace } from '../domain/workspaces.ts';
import { resolveSession, type SessionUser } from '../domain/auth.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerCoreRoutes } from './routes/core.ts';
import { registerTransactionRoutes } from './routes/transactions.ts';
import { registerReportRoutes } from './routes/reports.ts';
import { registerPlanningRoutes } from './routes/planning.ts';

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionUser;
  }
}

export interface ServerDeps {
  db: Db;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function sessionTokenOf(request: FastifyRequest): { token: string | null; fromCookie: boolean } {
  const bearer = bearerToken(request.headers.authorization);
  if (bearer) return { token: bearer, fromCookie: false };
  const cookies = parseCookies(request.headers.cookie);
  return { token: cookies[config.cookieName] ?? null, fromCookie: true };
}

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Same-origin check for cookie-authenticated writes (defence in depth on top of SameSite=Lax). */
function sameOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'warn',
      // Observability without leaking money, notes, or third-party names (NFR08).
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.recoveryCode', 'req.body.note', 'res.body'],
        censor: '[disunting]',
      },
      serializers: {
        req(request) {
          return { method: request.method, url: request.url.split('?')[0], id: request.id };
        },
      },
    },
    bodyLimit: 1_048_576,
    trustProxy: config.trustProxy,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
    // Only meaningful over TLS; local http development must not pin a browser to https.
    if (config.secureOrigin) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    const { token, fromCookie } = sessionTokenOf(request);
    if (token) {
      const session = resolveSession(deps.db, token);
      if (session) request.session = session;
    }
    if (MUTATING.has(request.method) && fromCookie && request.session && !sameOrigin(request)) {
      throw new AppError('forbidden', 'Permintaan ini datang dari situs lain dan ditolak.');
    }
    if (request.url.startsWith('/api/v1/auth/') || request.url.startsWith('/api/v1/health')) return;
    if (!request.session) {
      throw new AppError('unauthorized', 'Sesi tidak ditemukan. Masuk dulu untuk melanjutkan.');
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.status >= 500) request.log.error({ err: error.message, code: error.code }, 'domain error');
      return reply.status(error.status).send(error.toBody());
    }
    const fastifyError = error as { statusCode?: number; code?: string; message?: string };
    if (fastifyError.statusCode === 400 && fastifyError.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      return reply.status(400).send({ error: { code: 'validation_failed', message: 'Isi permintaan bukan JSON yang sah.' } });
    }
    if (fastifyError.statusCode === 413) {
      return reply.status(413).send({ error: { code: 'payload_too_large', message: 'Data yang dikirim terlalu besar.' } });
    }
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({ error: { code: 'validation_failed', message: fastifyError.message ?? 'Permintaan tidak valid.' } });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'internal', message: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' } });
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: { code: 'not_found', message: 'Alamat API tidak ditemukan.' } });
    }
    return reply.status(404).type('text/html; charset=utf-8').send('<!doctype html><html lang="id"><meta charset="utf-8"><title>404</title><p>Halaman tidak ditemukan.</p>');
  });

  // ── API ───────────────────────────────────────────────────────────────────
  const api = { db: deps.db };
  await app.register(async (instance) => {
    instance.get('/health', async () => ({ data: { ok: true, time: new Date().toISOString() } }));
    await registerAuthRoutes(instance, api);
    await registerCoreRoutes(instance, api);
    await registerTransactionRoutes(instance, api);
    await registerReportRoutes(instance, api);
    await registerPlanningRoutes(instance, api); // dipasang setelah modul perencanaan tersedia
  }, { prefix: '/api/v1' });

  // ── built PWA (same origin, no separate host needed) ──────────────────────
  app.get('/*', async (request, reply) => {
    return serveStatic(request, reply);
  });

  return app;
}

async function serveStatic(request: FastifyRequest, reply: FastifyReply) {
  const root = resolve(config.webDist);
  const url = request.url.split('?')[0] ?? '/';
  const relative = normalize(decodeURIComponent(url)).replace(/^([/\\])+/, '');
  let filePath = resolve(join(root, relative));

  if (!filePath.startsWith(root)) {
    return reply.status(403).type('text/plain; charset=utf-8').send('Akses ditolak.');
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // SPA fallback: unknown paths render the app shell
    filePath = join(root, 'index.html');
  }

  try {
    const body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    const cache = filePath.includes(`${join('assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
    return reply.type(type).header('Cache-Control', cache).send(body);
  } catch {
    return reply
      .status(404)
      .type('text/html; charset=utf-8')
      .send('<!doctype html><html lang="id"><meta charset="utf-8"><title>Belum dibangun</title><p>Antarmuka web belum dibangun. Jalankan <code>pnpm --dir web build</code> lebih dulu.</p>');
  }
}

export function workspaceNameOf(db: Db, workspaceId: string): string {
  try {
    return getWorkspace(db, workspaceId).name;
  } catch {
    return 'Ruang keuangan';
  }
}
