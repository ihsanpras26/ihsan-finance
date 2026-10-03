// vercel.ts: Vercel Node function hosting the Fastify app (docs/DEPLOY.md, "Vercel + Turso").
// Static files (web/dist) are served by Vercel's CDN; every /api/* request lands here.
//
// This file is not the deployed entry: `scripts/build-api.mjs` bundles it into `api/index.js`
// during the Vercel build. Vercel compiles `api/*.ts` itself with plain `tsc`, which keeps the
// `.ts` import specifiers and ships only the emitted JS — the function then dies on its first
// import (production answered 500 FUNCTION_INVOCATION_FAILED). The bundle inlines these imports.
// Keep the file inside the server package: `api/index.ts` and the generated `api/index.js` share a
// path stem and Vercel rejects that as a conflict.
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
