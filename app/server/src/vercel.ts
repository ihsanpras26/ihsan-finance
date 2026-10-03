// vercel.ts: Vercel Node function hosting the Fastify app (docs/DEPLOY.md, "Vercel + Turso").
// Static files (web/dist) are served by Vercel's CDN; every /api/* request lands here.
//
// The committed entry `api/index.js` imports this module; Vercel plans functions from the source
// tree, so the entry must exist before the build runs, and Vercel's own bundle keeps every import
// inlined (docs/DECISIONS.md D-24).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { config as appConfig } from './config.ts';
import { migrate, openDatabase } from './db/index.ts';
import { buildServer } from './http/server.ts';

type App = Awaited<ReturnType<typeof buildServer>>;

// One instance per warm function invocation: the database connection, the schema check, and the
// Fastify instance are reused across requests instead of being rebuilt on every call.
let booted: Promise<App> | null = null;

function boot(): Promise<App> {
  booted ??= (async () => {
    const db = await openDatabase(appConfig.dbUrl ?? appConfig.dbPath, appConfig.dbToken || undefined);
    await migrate(db);
    const app = await buildServer({ db });
    await app.ready();
    return app;
  })();
  return booted;
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const app = await boot();
  app.server.emit('request', request, response);
}
