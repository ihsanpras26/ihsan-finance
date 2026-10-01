// test/internal-tick.test.ts: the HTTP scheduler entry point used by platform cron (FR11, FR17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, localDateInTz } from '../src/core/dates.ts';
import { createWallet } from '../src/domain/wallets.ts';
import { createDebt } from '../src/domain/debts.ts';
import { buildServer } from '../src/http/server.ts';
import { ctxOf, makeDb, makeWorkspace } from './helpers.ts';

const SECRET = 'token-penjadwal-uji';

interface TickSummary {
  today: string;
  notificationsCreated: number;
  debtsChecked: number;
  workspacesProcessed: number;
}

/** Narrow the scheduler summary out of an untrusted HTTP body instead of casting it. */
function tickSummary(body: unknown): TickSummary {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('balasan tick tidak memuat data');
  }
  const data = body.data;
  if (
    typeof data !== 'object' || data === null
    || !('today' in data) || typeof data.today !== 'string'
    || !('notificationsCreated' in data) || typeof data.notificationsCreated !== 'number'
    || !('debtsChecked' in data) || typeof data.debtsChecked !== 'number'
    || !('workspacesProcessed' in data) || typeof data.workspacesProcessed !== 'number'
  ) {
    throw new Error('bentuk ringkasan penjadwal tidak dikenali');
  }
  return {
    today: data.today,
    notificationsCreated: data.notificationsCreated,
    debtsChecked: data.debtsChecked,
    workspacesProcessed: data.workspacesProcessed,
  };
}

function errorCode(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('error' in body)) return '';
  const error = body.error;
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') return '';
  return error.code;
}

/** The secret is process-wide, so every case restores it. */
async function withSecret<T>(value: string | null, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.CRON_SECRET;
  if (value === null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = value;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
}

test('titik akhir penjadwal tidak ada bila token belum diisi', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    await withSecret(null, async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/internal/tick' });
      assert.equal(response.statusCode, 404);
      assert.equal(errorCode(response.json()), 'not_found');
    });
  } finally {
    await app.close();
  }
});

test('tick menolak tanpa token yang sah dan tidak menuntut sesi pengguna', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    await withSecret(SECRET, async () => {
      // No session cookie: the route must answer 403 (token), not 401 (session).
      const anonymous = await app.inject({ method: 'GET', url: '/api/v1/internal/tick' });
      assert.equal(anonymous.statusCode, 403);
      assert.equal(errorCode(anonymous.json()), 'forbidden');

      const wrong = await app.inject({
        method: 'GET', url: '/api/v1/internal/tick', headers: { authorization: 'Bearer token-lain' },
      });
      assert.equal(wrong.statusCode, 403);
    });
  } finally {
    await app.close();
  }
});

test('tick menjalankan penjadwal untuk seluruh ruang dan idempoten', async () => {
  const workspace = await makeWorkspace(await makeDb());
  const ctx = ctxOf(workspace);
  const today = localDateInTz(ctx.timezone);
  const wallet = await createWallet(ctx, { name: 'Kas', type: 'cash', openingBalance: 1_000_000, openedOn: '2026-01-01' });
  await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Toko Bangunan', principal: 500_000,
    startDate: today, dueDate: addDays(today, 1), openingMode: 'cash', walletId: wallet.id,
  });

  const app = await buildServer({ db: workspace.db });
  try {
    await withSecret(SECRET, async () => {
      const headers = { authorization: `Bearer ${SECRET}` };
      const first = await app.inject({ method: 'GET', url: '/api/v1/internal/tick', headers });
      assert.equal(first.statusCode, 200, first.body);
      const summary = tickSummary(first.json());
      assert.equal(summary.today, today);
      assert.equal(summary.workspacesProcessed, 1);
      assert.ok(summary.debtsChecked >= 1, `utang diperiksa: ${summary.debtsChecked}`);
      // Both slots are already due (H−7 and H−1) because the record appears one day before its
      // due date; each slot is created once and carries the real remaining days.
      assert.equal(summary.notificationsCreated, 2, 'pengingat H−7 dan H−1 dibuat');

      const second = await app.inject({ method: 'POST', url: '/api/v1/internal/tick', headers });
      assert.equal(second.statusCode, 200, second.body);
      assert.equal(tickSummary(second.json()).notificationsCreated, 0);

      const listed = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers });
      assert.equal(listed.statusCode, 401, 'daftar pengingat tetap menuntut sesi pengguna');
    });
  } finally {
    await app.close();
  }
});
