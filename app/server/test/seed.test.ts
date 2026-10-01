// test/seed.test.ts: contoh data harus bisa dibuat kapan pun, termasuk di hari pertama bulan.
// Sebelumnya `recordDebtPayment` ditolak `validation_failed` pada tanggal 1-18 karena seed memakai
// tanggal tengah bulan yang belum tiba, dan basis data tertinggal separuh (tanpa anggaran/tujuan).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb } from './helpers.ts';
import { bookedThisMonth, dayOfThisMonth, seedDemo } from '../src/tools/seed.ts';
import { localDateInTz } from '../src/core/dates.ts';
import { all, one } from '../src/db/index.ts';

test('seed selesai pada tanggal berapa pun: anggaran, tujuan, utang, dan aturan ikut terisi', () => {
  const db = makeDb();
  const summary = seedDemo(db);
  const today = localDateInTz('Asia/Jakarta');

  assert.equal(summary.wallets, 3);
  assert.equal(summary.total, 27_090_000, 'total saldo contoh');
  assert.equal(one<{ c: number }>(db, `SELECT count(*) c FROM budgets WHERE period_start = ?`, `${today.slice(0, 7)}-01`)!.c, 4);
  assert.equal(one<{ c: number }>(db, `SELECT count(*) c FROM goals`)!.c, 3);
  assert.equal(one<{ c: number }>(db, `SELECT count(*) c FROM recurring_rules`)!.c, 2);
  assert.equal(one<{ c: number }>(db, `SELECT count(*) c FROM transactions WHERE type = 'debt_payment'`)!.c, 1);
});

test('seed tidak membukukan peristiwa bertanggal masa depan', () => {
  const db = makeDb();
  seedDemo(db);
  const today = localDateInTz('Asia/Jakarta');
  const future = all<{ type: string; d: string }>(db, `SELECT type, effective_date d FROM transactions WHERE effective_date > ?`, today);
  assert.deepEqual(future, [], 'semua peristiwa contoh bertanggal hari ini atau sebelumnya');
});

test('tanggal tercatat dijepit ke hari ini, tenggat boleh tetap di masa depan', () => {
  assert.equal(bookedThisMonth('2026-10-01', 18), '2026-10-01');
  assert.equal(bookedThisMonth('2026-10-05', 5), '2026-10-05');
  assert.equal(bookedThisMonth('2026-10-25', 5), '2026-10-05');
  assert.equal(bookedThisMonth('2026-02-28', 30), '2026-02-28');
  assert.equal(dayOfThisMonth('2026-10-01', 25), '2026-10-25');
});
