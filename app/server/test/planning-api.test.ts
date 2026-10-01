// test/planning-api.test.ts: the planning HTTP surface, exercised end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { makeDb } from './helpers.ts';
import { buildServer } from '../src/http/server.ts';
import { runScheduler } from '../src/workers/scheduler.ts';
import { localDateInTz } from '../src/core/dates.ts';
import type { Db } from '../src/db/index.ts';

/** Zona waktu ruang kerja yang didaftarkan `boot()`. */
const WS_TIMEZONE = 'Asia/Jakarta';

async function boot(): Promise<{ app: FastifyInstance; db: Db; cookie: string; walletId: string; categoryId: string; incomeCategoryId: string }> {
  const db = makeDb();
  const app = await buildServer({ db });
  const registered = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'rencana@contoh.id', password: 'rahasia-uji-123', displayName: 'Perencana', timezone: 'Asia/Jakarta' },
  });
  assert.equal(registered.statusCode, 200, registered.body);
  const raw = registered.headers['set-cookie'];
  const cookie = String(Array.isArray(raw) ? raw[0] : raw).split(';')[0]!;

  const wallet = await app.inject({
    method: 'POST', url: '/api/v1/wallets', headers: { cookie, 'idempotency-key': 'w' },
    payload: { name: 'Dompet', type: 'cash', openingBalance: '1000000', openedOn: '2026-01-01' },
  });
  assert.equal(wallet.statusCode, 200, wallet.body);

  const categories = await app.inject({ method: 'GET', url: '/api/v1/categories', headers: { cookie } });
  const rows = categories.json().data as { id: string; kind: string }[];
  return {
    app,
    db,
    cookie,
    walletId: (wallet.json().data as { id: string }).id,
    categoryId: rows.find((row) => row.kind === 'expense')!.id,
    incomeCategoryId: rows.find((row) => row.kind === 'income')!.id,
  };
}

test('utang: catat, bayar, dan batalkan lewat HTTP', async () => {
  const { app, cookie, walletId } = await boot();
  try {
    const created = await app.inject({
      method: 'POST', url: '/api/v1/debts', headers: { cookie, 'idempotency-key': 'd-1' },
      payload: { direction: 'payable', counterpartyName: 'Koperasi', principal: '1000000', openingMode: 'cash', walletId, startDate: '2026-02-01' },
    });
    assert.equal(created.statusCode, 200, created.body);
    const debt = created.json().data as { id: string; remaining: string; status: string; counterpartyName: string };
    assert.equal(debt.remaining, '1000000');
    assert.equal(debt.counterpartyName, 'Koperasi');

    const paid = await app.inject({
      method: 'POST', url: `/api/v1/debts/${debt.id}/payments`, headers: { cookie, 'idempotency-key': 'p-1' },
      payload: { principal: '200000', interest: '10000', walletId, paymentDate: '2026-02-05' },
    });
    assert.equal(paid.statusCode, 200, paid.body);
    const paidData = paid.json().data as { debt: { remaining: string }; transaction: { id: string; type: string; amount: string } };
    assert.equal(paidData.debt.remaining, '800000', 'sisa pokok berkurang');
    assert.equal(paidData.transaction.type, 'debt_payment');
    assert.equal(paidData.transaction.amount, '210000', 'nominal transaksi adalah kas total: pokok + bunga');

    const detail = await app.inject({ method: 'GET', url: `/api/v1/debts/${debt.id}`, headers: { cookie } });
    assert.equal(detail.statusCode, 200, detail.body);
    const payments = (detail.json().data as { payments: { id: string; cashAmount: string }[] }).payments;
    assert.equal(payments.length, 1);
    assert.equal(payments[0]!.cashAmount, '210000', 'kas keluar = pokok + bunga');

    const cancelled = await app.inject({
      method: 'POST', url: `/api/v1/debts/${debt.id}/payments/${payments[0]!.id}/cancel`,
      headers: { cookie, 'idempotency-key': 'c-1' }, payload: { reason: 'salah input' },
    });
    assert.equal(cancelled.statusCode, 200, cancelled.body);
    assert.equal((cancelled.json().data as { remaining: string }).remaining, '1000000', 'sisa pokok kembali');

    const upcoming = await app.inject({ method: 'GET', url: '/api/v1/debts/upcoming?days=7', headers: { cookie } });
    assert.equal(upcoming.statusCode, 200, upcoming.body);

    const report = await app.inject({ method: 'GET', url: '/api/v1/reports/debts', headers: { cookie } });
    assert.equal(report.statusCode, 200, report.body);
    const reportData = report.json().data as { payable: unknown[]; totals: { payable: string; receivable: string } };
    assert.equal(reportData.payable.length, 1);
    assert.equal(reportData.totals.payable, '1000000');
    assert.equal(reportData.totals.receivable, '0');
  } finally {
    await app.close();
  }
});

test('utang saldo lama tidak mengubah kas dan bukan pendapatan', async () => {
  const { app, cookie } = await boot();
  try {
    const before = await app.inject({ method: 'GET', url: '/api/v1/reports/summary?period=2026-03', headers: { cookie } });
    const beforeData = before.json().data as { income: string };

    const created = await app.inject({
      method: 'POST', url: '/api/v1/debts', headers: { cookie, 'idempotency-key': 'l-1' },
      payload: { direction: 'payable', counterpartyName: 'Pinjaman Lama', principal: '2000000', openingMode: 'legacy', startDate: '2026-03-01' },
    });
    assert.equal(created.statusCode, 200, created.body);

    const after = await app.inject({ method: 'GET', url: '/api/v1/reports/summary?period=2026-03', headers: { cookie } });
    const afterData = after.json().data as { income: string; closingBalance: string };
    assert.equal(afterData.income, beforeData.income, 'AT12 saldo lama bukan pendapatan');
    assert.equal(afterData.closingBalance, '1000000', 'AT12 kas tidak berubah');

    const worth = await app.inject({ method: 'GET', url: '/api/v1/reports/networth', headers: { cookie } });
    const worthData = worth.json().data as { payable: string; netWorth: string };
    assert.equal(worthData.payable, '2000000', 'kewajiban tercatat');
    assert.equal(worthData.netWorth, '-1000000', 'kekayaan bersih = kas − kewajiban');
  } finally {
    await app.close();
  }
});

test('goal: alokasi menandai dana tanpa menggerakkan kas, belanja mengurangi alokasi', async () => {
  const { app, cookie, walletId, categoryId } = await boot();
  try {
    const created = await app.inject({
      method: 'POST', url: '/api/v1/goals', headers: { cookie, 'idempotency-key': 'g-1' },
      payload: { name: 'Laptop', target: '1000000', targetDate: '2026-12-31', priority: 1 },
    });
    assert.equal(created.statusCode, 200, created.body);
    const goal = created.json().data as { id: string; allocated: string; progress: number; monthlyPlan: string | null };
    assert.equal(goal.allocated, '0');
    assert.ok(goal.monthlyPlan !== null, 'rencana setoran bulanan disarankan');

    const allocated = await app.inject({
      method: 'POST', url: `/api/v1/goals/${goal.id}/allocations`, headers: { cookie, 'idempotency-key': 'a-1' },
      payload: { walletId, amount: '400000', effectiveDate: '2026-04-01' },
    });
    assert.equal(allocated.statusCode, 200, allocated.body);
    const allocatedData = allocated.json().data as { goal: { allocated: string }; allocation: { amount: string } };
    assert.equal(allocatedData.goal.allocated, '400000', 'AT05 alokasi Rp400.000');
    assert.equal(allocatedData.allocation.amount, '400000');

    const wallet = await app.inject({ method: 'GET', url: `/api/v1/wallets/${walletId}/balance`, headers: { cookie } });
    assert.equal((wallet.json().data as { balance: string }).balance, '1000000', 'alokasi tidak menggerakkan kas');

    const spent = await app.inject({
      method: 'POST', url: `/api/v1/goals/${goal.id}/spend`, headers: { cookie, 'idempotency-key': 's-1' },
      payload: { walletId, categoryId, amount: '100000', effectiveDate: '2026-04-02' },
    });
    assert.equal(spent.statusCode, 200, spent.body);
    const spentData = spent.json().data as { goal: { allocated: string }; transaction: { type: string; amount: string } };
    assert.equal(spentData.goal.allocated, '300000', 'AT06 belanja mengurangi alokasi');
    assert.equal(spentData.transaction.type, 'goal_spend', 'label peristiwa belanja dana tujuan');

    const summary = await app.inject({ method: 'GET', url: '/api/v1/reports/summary?period=2026-04', headers: { cookie } });
    assert.equal((summary.json().data as { expense: string }).expense, '100000', 'AT06 konsumsi tercatat');
  } finally {
    await app.close();
  }
});

test('anggaran: batas per kategori dan peringatan lewat HTTP', async () => {
  const { app, cookie, walletId, categoryId } = await boot();
  try {
    const created = await app.inject({
      method: 'POST', url: '/api/v1/budgets', headers: { cookie, 'idempotency-key': 'b-1' },
      payload: { categoryId, period: '2026-05', limit: '500000' },
    });
    assert.equal(created.statusCode, 200, created.body);
    const budget = created.json().data as { id: string; limit: string; spent: string; warning: string };
    assert.equal(budget.limit, '500000');
    assert.equal(budget.spent, '0');

    await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie, 'idempotency-key': 't-1' },
      payload: { type: 'expense', amount: '450000', walletId, categoryId, effectiveDate: '2026-05-10' },
    });

    const list = await app.inject({ method: 'GET', url: '/api/v1/budgets?period=2026-05', headers: { cookie } });
    const row = (list.json().data as { spent: string; remaining: string; warning: string }[])[0]!;
    assert.equal(row.spent, '450000', 'AT11 terpakai Rp450.000');
    assert.equal(row.remaining, '50000', 'AT11 sisa Rp50.000');
    assert.equal(row.warning, 'near', 'AT11 mendekati batas');

    const updated = await app.inject({
      method: 'PATCH', url: `/api/v1/budgets/${budget.id}`, headers: { cookie },
      payload: { limit: '400000', expectedVersion: 1 },
    });
    assert.equal(updated.statusCode, 200, updated.body);
    assert.equal((updated.json().data as { warning: string }).warning, 'over', 'melewati batas ditandai');

    const conflict = await app.inject({
      method: 'PATCH', url: `/api/v1/budgets/${budget.id}`, headers: { cookie },
      payload: { limit: '600000', expectedVersion: 1 },
    });
    assert.equal(conflict.statusCode, 409, 'versi lama ditolak');
  } finally {
    await app.close();
  }
});

test('rencana berulang: buat aturan, kejadian muncul, konfirmasi membuat transaksi', async () => {
  const { app, cookie, walletId, categoryId } = await boot();
  try {
    const created = await app.inject({
      method: 'POST', url: '/api/v1/recurring', headers: { cookie, 'idempotency-key': 'r-1' },
      payload: {
        type: 'expense', frequency: 'monthly', label: 'Internet', amount: '300000',
        walletId, categoryId, startOn: '2026-06-01', anchorDay: 1,
      },
    });
    assert.equal(created.statusCode, 200, created.body);
    const rule = created.json().data as { id: string; nextOn: string; status: string; template: { label: string; amount: number } };
    assert.equal(rule.status, 'active');
    assert.equal(rule.template.label, 'Internet');
    assert.equal(rule.template.amount, 300000, 'template menyimpan nominal sebagai integer');

    const occurrences = await app.inject({ method: 'GET', url: '/api/v1/recurring/occurrences?status=pending', headers: { cookie } });
    assert.equal(occurrences.statusCode, 200, occurrences.body);
    const pending = occurrences.json().data as { id: string; scheduledDate: string; amount: string }[];
    assert.ok(pending.length >= 1, 'kejadian menunggu konfirmasi tersedia');
    assert.equal(pending[0]!.amount, '300000');

    const confirmed = await app.inject({
      method: 'POST', url: `/api/v1/recurring/occurrences/${pending[0]!.id}/confirm`,
      headers: { cookie, 'idempotency-key': 'conf-1' }, payload: {},
    });
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    const confirmedData = confirmed.json().data as { occurrence: { status: string; transactionId: string }; transaction: { type: string; amount: string } };
    assert.equal(confirmedData.occurrence.status, 'confirmed');
    assert.equal(confirmedData.transaction.type, 'expense');
    assert.equal(confirmedData.transaction.amount, '300000');

    const again = await app.inject({
      method: 'POST', url: `/api/v1/recurring/occurrences/${pending[0]!.id}/confirm`,
      headers: { cookie, 'idempotency-key': 'conf-1' }, payload: {},
    });
    assert.equal(again.statusCode, 200, 'pengulangan dengan kunci sama tidak menggandakan');
    assert.equal(
      (again.json().data as { transaction: { id: string } }).transaction.id,
      (confirmed.json().data as { transaction: { id: string } }).transaction.id,
    );

    const paused = await app.inject({ method: 'POST', url: `/api/v1/recurring/${rule.id}/pause`, headers: { cookie } });
    assert.equal(paused.statusCode, 200, paused.body);
    assert.equal((paused.json().data as { status: string }).status, 'paused');
  } finally {
    await app.close();
  }
});

test('beranda merangkum saldo, anggaran, tujuan, dan pengingat dalam satu panggilan', async () => {
  const { app, cookie, walletId, categoryId } = await boot();
  try {
    await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie, 'idempotency-key': 'h-1' },
      // Tanggal efektif adalah tanggal lokal ruang kerja, bukan UTC: pada 00:00-06:59 WIB
      // keduanya berbeda hari dan transaksi akan jatuh ke periode bulan sebelumnya.
      payload: { type: 'expense', amount: '125000', walletId, categoryId, effectiveDate: localDateInTz(WS_TIMEZONE) },
    });
    await app.inject({
      method: 'POST', url: '/api/v1/goals', headers: { cookie, 'idempotency-key': 'h-2' },
      payload: { name: 'Dana Darurat', target: '5000000' },
    });

    const dashboard = await app.inject({ method: 'GET', url: '/api/v1/dashboard', headers: { cookie } });
    assert.equal(dashboard.statusCode, 200, dashboard.body);
    const data = dashboard.json().data as {
      totalBalance: string; netWorth: string; income: string; expense: string;
      wallets: { balance: string }[]; goals: unknown[]; budgetRemaining: string; draftsPending: number;
    };
    assert.equal(data.expense, '125000', 'pengeluaran bulan ini terbaca');
    assert.equal(data.totalBalance, '875000', 'saldo kas terkini');
    assert.equal(data.wallets[0]!.balance, '875000');
    assert.equal(data.goals.length, 1);
    assert.equal(typeof data.budgetRemaining, 'string', 'nominal selalu string desimal');
    assert.equal(data.draftsPending, 0);
  } finally {
    await app.close();
  }
});

test('notifikasi dapat dibaca dan ditandai', async () => {
  const { app, cookie } = await boot();
  try {
    const list = await app.inject({ method: 'GET', url: '/api/v1/notifications?status=all', headers: { cookie } });
    assert.equal(list.statusCode, 200, list.body);

    const all = await app.inject({ method: 'POST', url: '/api/v1/notifications/read-all', headers: { cookie } });
    assert.equal(all.statusCode, 200, all.body);
    assert.equal(typeof (all.json().data as { updated: number }).updated, 'number');
  } finally {
    await app.close();
  }
});

test('anggaran dan notifikasi tunggal dapat diambil, dan menolak ruang lain', async () => {
  const { app, db, cookie, walletId, categoryId } = await boot();
  try {
    // A single budget is reachable by id and matches the list entry.
    const created = await app.inject({
      method: 'POST', url: '/api/v1/budgets', headers: { cookie, 'idempotency-key': 'gb-1' },
      payload: { categoryId, period: '2026-06', limit: '250000' },
    });
    assert.equal(created.statusCode, 200, created.body);
    const budgetId = (created.json().data as { id: string }).id;

    const one = await app.inject({ method: 'GET', url: `/api/v1/budgets/${budgetId}`, headers: { cookie } });
    assert.equal(one.statusCode, 200, one.body);
    assert.equal((one.json().data as { id: string }).id, budgetId);
    assert.equal((one.json().data as { limit: string }).limit, '250000', 'limit keluar sebagai string desimal');

    const list = await app.inject({ method: 'GET', url: '/api/v1/budgets?period=2026-06', headers: { cookie } });
    assert.deepEqual((one.json().data as { id: string }).id, (list.json().data as { id: string }[])[0]!.id);

    // A notification round trip. Reminders are the scheduler's job, so run it here with a
    // debt that falls due inside the reminder window; otherwise this branch proves nothing.
    const dueSoon = await app.inject({
      method: 'POST', url: '/api/v1/debts', headers: { cookie, 'idempotency-key': 'gb-debt' },
      payload: { direction: 'payable', counterpartyName: 'Toko', principal: '100000', openingMode: 'cash', walletId, startDate: '2026-06-01', dueDate: '2026-06-12' },
    });
    assert.equal(dueSoon.statusCode, 200, dueSoon.body);

    const sched = runScheduler(db, { today: '2026-06-10' });
    assert.ok(sched.notificationsCreated > 0, `penjadwal harus membuat pengingat, dapat ${sched.notificationsCreated}`);

    const notes = await app.inject({ method: 'GET', url: '/api/v1/notifications?status=all', headers: { cookie } });
    assert.equal(notes.statusCode, 200, notes.body);
    const first = (notes.json().data as { id: string }[])[0];
    assert.ok(first, 'harus ada satu pengingat untuk diambil');

    const note = await app.inject({ method: 'GET', url: `/api/v1/notifications/${first!.id}`, headers: { cookie } });
    assert.equal(note.statusCode, 200, note.body);
    assert.equal((note.json().data as { id: string }).id, first!.id);

    // A second workspace must not reach either id.
    const other = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'tetangga@contoh.id', password: 'rahasia-uji-123', displayName: 'Tetangga', timezone: 'Asia/Jakarta' },
    });
    const otherCookie = String(other.headers['set-cookie']).split(';')[0]!;

    const foreignBudget = await app.inject({ method: 'GET', url: `/api/v1/budgets/${budgetId}`, headers: { cookie: otherCookie } });
    assert.equal(foreignBudget.statusCode, 404, 'anggaran ruang lain tidak boleh terbaca');

    const foreignNote = await app.inject({ method: 'GET', url: `/api/v1/notifications/${first!.id}`, headers: { cookie: otherCookie } });
    assert.equal(foreignNote.statusCode, 404, 'notifikasi ruang lain tidak boleh terbaca');

    // An unknown id is a clean 404, not a crash.
    const missing = await app.inject({ method: 'GET', url: '/api/v1/budgets/tidak-ada', headers: { cookie } });
    assert.equal(missing.statusCode, 404, missing.body);
  } finally {
    await app.close();
  }
});

test('rute perencanaan menolak data ruang lain', async () => {
  const { app, cookie, walletId } = await boot();
  try {
    const other = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email: 'lain@contoh.id', password: 'rahasia-uji-123', displayName: 'Lain', timezone: 'Asia/Jakarta' },
    });
    const raw = other.headers['set-cookie'];
    const otherCookie = String(Array.isArray(raw) ? raw[0] : raw).split(';')[0]!;

    const debt = await app.inject({
      method: 'POST', url: '/api/v1/debts', headers: { cookie, 'idempotency-key': 'iso-1' },
      payload: { direction: 'payable', counterpartyName: 'Rahasia', principal: '500000', openingMode: 'cash', walletId, startDate: '2026-07-01' },
    });
    const debtId = (debt.json().data as { id: string }).id;

    const stolen = await app.inject({ method: 'GET', url: `/api/v1/debts/${debtId}`, headers: { cookie: otherCookie } });
    assert.equal(stolen.statusCode, 404, 'ruang lain tidak melihat catatan ini');

    const stolenList = await app.inject({ method: 'GET', url: '/api/v1/debts', headers: { cookie: otherCookie } });
    assert.equal((stolenList.json().data as unknown[]).length, 0);

    const stolenPay = await app.inject({
      method: 'POST', url: `/api/v1/debts/${debtId}/payments`, headers: { cookie: otherCookie, 'idempotency-key': 'iso-2' },
      payload: { principal: '100000', walletId: '00000000-0000-7000-8000-000000000000' },
    });
    assert.equal(stolenPay.statusCode, 404, 'tidak bisa membayar catatan ruang lain');
  } finally {
    await app.close();
  }
});
