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

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase());
}

const dataDir = process.env.IHSAN_DATA_DIR ? resolve(process.env.IHSAN_DATA_DIR) : join(APP_ROOT, 'data');
mkdirSync(dataDir, { recursive: true });

const appOrigin = process.env.APP_ORIGIN ?? '';

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
  appOrigin,
  /** True when APP_ORIGIN is https; turns on Secure cookies and HSTS. */
  secureOrigin: appOrigin.startsWith('https://'),
  /** Behind a platform TLS terminator or reverse proxy, trust forwarded headers for client IP. */
  trustProxy: envFlag('IHSAN_TRUST_PROXY', false),
  /**
   * FR01: set to 0 in production once the owner account exists. The first account is always
   * allowed so a fresh deployment can be bootstrapped.
   */
  allowRegistration: envFlag('IHSAN_ALLOW_REGISTRATION', true),
};

mkdirSync(config.exportDir, { recursive: true });
