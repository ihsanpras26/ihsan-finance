// http/routes/auth.ts: FR01: register, login, logout, recovery, session control.
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../core/errors.ts';
import { config } from '../../config.ts';
import type { Db } from '../../db/index.ts';
import {
  listSessions, loginUser, recoverAccess, registerUser, resolveSession, revokeOtherSessions, revokeSession,
} from '../../domain/auth.ts';
import { getPreferences, getWorkspace } from '../../domain/workspaces.ts';
import { seedDefaultCategories } from '../../domain/categories.ts';
import { contextFor } from '../../domain/workspaces.ts';
import { serializePreferences, serializeSessionUser, serializeWorkspace } from '../serialize.ts';
import { sessionTokenOf } from '../server.ts';

export interface RouteDeps { db: Db }

function cookieHeader(token: string, maxAgeSeconds: number): string {
  const secure = config.appOrigin.startsWith('https://') ? '; Secure' : '';
  return `${config.cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearCookieHeader(): string {
  return `${config.cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function clientIp(request: { ip?: string; headers: Record<string, unknown> }): string | null {
  return typeof request.ip === 'string' ? request.ip : null;
}

function deviceLabel(request: { headers: Record<string, unknown> }): string {
  const agent = String(request.headers['user-agent'] ?? '').slice(0, 180);
  return agent || 'Perangkat tanpa nama';
}

function sessionPayload(db: Db, userId: string, workspaceId: string, email: string, displayName: string, role: string) {
  const workspace = getWorkspace(db, workspaceId);
  return serializeSessionUser({
    userId,
    email,
    displayName,
    workspaceId,
    workspaceName: workspace.name,
    timezone: workspace.timezone,
    role,
  });
}

export async function registerAuthRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db } = deps;

  app.post('/auth/register', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = registerUser(db, {
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      displayName: String(body.displayName ?? ''),
      timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
      workspaceName: typeof body.workspaceName === 'string' ? body.workspaceName : undefined,
    });
    seedDefaultCategories(contextFor(db, { userId: result.user.id, workspaceId: result.workspaceId, timezone: 'Asia/Jakarta' }));
    reply.header('Set-Cookie', cookieHeader(result.token, config.sessionDays * 86_400));
    return {
      data: {
        user: sessionPayload(db, result.user.id, result.workspaceId, result.user.email, result.user.display_name, 'owner'),
        recoveryCode: result.recoveryCode,
      },
    };
  });

  app.post('/auth/login', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = loginUser(db, {
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      ip: clientIp(request as never),
      deviceLabel: deviceLabel(request as never),
    });
    reply.header('Set-Cookie', cookieHeader(result.token, config.sessionDays * 86_400));
    return {
      data: {
        user: sessionPayload(db, result.user.id, result.workspaceId, result.user.email, result.user.display_name, 'owner'),
      },
    };
  });

  app.post('/auth/logout', async (request, reply) => {
    const { token } = sessionTokenOf(request);
    if (token) {
      const session = resolveSession(db, token);
      if (session) revokeSession(db, session.sessionId);
    }
    reply.header('Set-Cookie', clearCookieHeader());
    return { data: { ok: true } };
  });

  app.post('/auth/recover', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = recoverAccess(db, {
      email: String(body.email ?? ''),
      recoveryCode: String(body.recoveryCode ?? ''),
      newPassword: String(body.newPassword ?? ''),
    });
    reply.header('Set-Cookie', cookieHeader(result.token, config.sessionDays * 86_400));
    const session = resolveSession(db, result.token);
    if (!session) throw new AppError('internal', 'Sesi pemulihan gagal dibuat.');
    return {
      data: {
        user: sessionPayload(db, session.userId, session.workspaceId, session.email, session.displayName, session.role),
      },
    };
  });

  app.get('/auth/me', async (request) => {
    const session = request.session;
    if (!session) throw new AppError('unauthorized', 'Sesi tidak ditemukan. Masuk dulu untuk melanjutkan.');
    return {
      data: sessionPayload(db, session.userId, session.workspaceId, session.email, session.displayName, session.role),
    };
  });

  app.get('/auth/sessions', async (request) => {
    const session = request.session!;
    const rows = listSessions(db, session.userId);
    return {
      data: rows
        .filter((row) => !row.revoked_at && row.expires_at > new Date().toISOString())
        .map((row) => ({
          id: row.id,
          deviceLabel: row.device_label ?? 'Perangkat tanpa nama',
          createdAt: row.created_at,
          lastSeenAt: row.last_seen_at,
          current: row.id === session.sessionId,
        })),
    };
  });

  app.post('/auth/sessions/revoke-others', async (request) => {
    const session = request.session!;
    const revoked = revokeOtherSessions(db, session.userId, session.sessionId);
    return { data: { revoked } };
  });

  // Convenience for the profile screen: workspace + preferences in one call.
  app.get('/workspace', async (request) => {
    const session = request.session!;
    return { data: serializeWorkspace(getWorkspace(db, session.workspaceId)) };
  });

  app.patch('/workspace', async (request) => {
    const session = request.session!;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const { updateWorkspace } = await import('../../domain/workspaces.ts');
    return {
      data: serializeWorkspace(
        updateWorkspace(db, session.workspaceId, session.userId, {
          name: typeof body.name === 'string' ? body.name : undefined,
          timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
        }),
      ),
    };
  });

  app.get('/preferences', async (request) => {
    const session = request.session!;
    return { data: serializePreferences(getPreferences(db, session.userId)) };
  });

  app.patch('/preferences', async (request) => {
    const session = request.session!;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const { updatePreferences } = await import('../../domain/workspaces.ts');
    return {
      data: serializePreferences(
        updatePreferences(db, session.userId, {
          hideAmounts: typeof body.hideAmounts === 'boolean' ? body.hideAmounts : undefined,
          remindersOn: typeof body.remindersOn === 'boolean' ? body.remindersOn : undefined,
          theme: typeof body.theme === 'string' ? (body.theme as 'system' | 'light' | 'dark') : undefined,
          defaultWalletId: body.defaultWalletId === undefined ? undefined : (body.defaultWalletId as string | null),
          lastWalletId: body.lastWalletId === undefined ? undefined : (body.lastWalletId as string | null),
          lastCategoryId: body.lastCategoryId === undefined ? undefined : (body.lastCategoryId as string | null),
        }),
      ),
    };
  });
}
