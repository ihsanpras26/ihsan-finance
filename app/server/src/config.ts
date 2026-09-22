// config.ts: environment with safe local defaults.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '../..');

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

const dataDir = process.env.IHSAN_DATA_DIR ? resolve(process.env.IHSAN_DATA_DIR) : join(APP_ROOT, 'data');
mkdirSync(dataDir, { recursive: true });

export const config = {
  port: envInt('PORT', 8787),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: process.env.IHSAN_DB_PATH ?? join(dataDir, 'ihsan.db'),
  dataDir,
  exportDir: join(dataDir, 'exports'),
  isTest: process.env.NODE_ENV === 'test',
  cookieName: 'ifsess',
  sessionDays: envInt('SESSION_DAYS', 30),
  /** Serve the built web app from the same origin when it exists (single-process demo). */
  webDist: join(APP_ROOT, 'web', 'dist'),
  appOrigin: process.env.APP_ORIGIN ?? '',
};

mkdirSync(config.exportDir, { recursive: true });
