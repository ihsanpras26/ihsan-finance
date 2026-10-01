// test/api.test.ts: the HTTP contract end to end, including tenant isolation (AT13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { makeDb } from './helpers.ts';
import { buildServer } from '../src/http/server.ts';

interface Client {
  cookie: string;
  workspaceId: string;
  walletId: string;
}

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  assert.equal(typeof value, 'string', 'respons harus mengirim cookie sesi');
  return String(value).split(';')[0]!;
}

async function register(app: FastifyInstance, email: string, name: string): Promise<{ cookie: string; body: Record<string, unknown> }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'rahasia-uji-123', displayName: name, timezone: 'Asia/Jakarta' },
  });
  assert.equal(response.statusCode, 200, response.body);
  return { cookie: cookieFrom(response), body: response.json().data as Record<string, unknown> };
}

async function withClient(app: FastifyInstance, cookie: string): Promise<Client> {
  const wallet = await app.inject({
    method: 'POST',
    url: '/api/v1/wallets',
    headers: { cookie, 'idempotency-key': 'wallet-1' },
    payload: { name: 'Bank Utama', type: 'bank', openingBalance: '1000000', openedOn: '2026-01-01' },
  });
  assert.equal(wallet.statusCode, 200, wallet.body);
  const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
  const workspaceId = (me.json().data as { workspaceId: string }).workspaceId;
  return { cookie, workspaceId, walletId: (wallet.json().data as { id: string }).id };
}

test('alur utama: daftar, dompet, transaksi, laporan', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const { cookie, body } = await register(app, 'pemilik@contoh.id', 'Pemilik');
    const user = body.user as { workspaceId: string; displayName: string; workspaceName: string };
    assert.equal(user.displayName, 'Pemilik');
    assert.ok(typeof body.recoveryCode === 'string' && body.recoveryCode.length > 8, 'kode pemulihan dikembalikan sekali');

    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    assert.equal(me.statusCode, 200);

    const wallet = await app.inject({
      method: 'POST', url: '/api/v1/wallets', headers: { cookie, 'idempotency-key': 'w1' },
      payload: { name: 'Bank', type: 'bank', openingBalance: '1000000', openedOn: '2026-01-01' },
    });
    assert.equal(wallet.statusCode, 200, wallet.body);
    const walletId = (wallet.json().data as { id: string }).id;
    assert.equal((wallet.json().data as { balance: string }).balance, '1000000', 'saldo awal tampil di dompet');

    const categories = await app.inject({ method: 'GET', url: '/api/v1/categories', headers: { cookie } });
    assert.equal(categories.statusCode, 200);
    const list = categories.json().data as { id: string; name: string; kind: string }[];
    assert.ok(list.length >= 10, 'kategori bawaan dibuat saat pendaftaran');
    const incomeCategory = list.find((row) => row.kind === 'income')!;
    const expenseCategory = list.find((row) => row.kind === 'expense')!;

    const income = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie, 'idempotency-key': 'tx-1' },
      payload: { type: 'income', amount: '5000000', walletId, categoryId: incomeCategory.id, effectiveDate: '2026-01-02' },
    });
    assert.equal(income.statusCode, 200, income.body);
    const incomeBody = income.json().data as { id: string; amount: string; wallets: { direction: string; amount: string }[] };
    assert.equal(incomeBody.amount, '5000000', 'nominal dikirim sebagai string desimal');
    assert.equal(incomeBody.wallets[0]?.direction, 'in');

    const expense = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie, 'idempotency-key': 'tx-2' },
      payload: { type: 'expense', amount: '100000', walletId, categoryId: expenseCategory.id, effectiveDate: '2026-01-03' },
    });
    assert.equal(expense.statusCode, 200, expense.body);

    const repeat = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie, 'idempotency-key': 'tx-2' },
      payload: { type: 'expense', amount: '100000', walletId, categoryId: expenseCategory.id, effectiveDate: '2026-01-03' },
    });
    assert.equal(repeat.statusCode, 200);
    assert.equal((repeat.json().data as { id: string }).id, (expense.json().data as { id: string }).id, 'kunci sama tidak menggandakan');

    const summary = await app.inject({ method: 'GET', url: '/api/v1/reports/summary?period=2026-01', headers: { cookie } });
    assert.equal(summary.statusCode, 200, summary.body);
    const data = summary.json().data as { income: string; expense: string; net: string; closingBalance: string };
    assert.equal(data.income, '5000000', 'AT01 pendapatan');
    assert.equal(data.expense, '100000', 'AT01 pengeluaran');
    assert.equal(data.net, '4900000');
    assert.equal(data.closingBalance, '5900000', 'AT01 saldo bank Rp5.900.000');

    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/transactions?from=2026-01-01&to=2026-01-31', headers: { cookie } });
    assert.equal((listResponse.json().data as { total: number }).total, 3, 'saldo awal, pendapatan, pengeluaran');

    const reverse = await app.inject({
      method: 'POST', url: `/api/v1/transactions/${incomeBody.id}/reverse`, headers: { cookie },
      payload: { reason: 'salah catat' },
    });
    assert.equal(reverse.statusCode, 200, reverse.body);

    const after = await app.inject({ method: 'GET', url: '/api/v1/reports/summary?period=2026-01', headers: { cookie } });
    const afterData = after.json().data as { income: string; closingBalance: string };
    assert.equal(afterData.income, '0', 'pendapatan kembali nol setelah pembatalan');
    assert.equal(afterData.closingBalance, '900000', 'saldo kembali Rp900.000');
  } finally {
    await app.close();
  }
});

test('AT13 data ruang lain tidak dapat dibaca lewat endpoint langsung', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const first = await register(app, 'a@contoh.id', 'A');
    const second = await register(app, 'b@contoh.id', 'B');
    const clientA = await withClient(app, first.cookie);
    const clientB = await withClient(app, second.cookie);

    assert.notEqual(clientA.workspaceId, clientB.workspaceId, 'dua ruang terpisah');

    const txA = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie: clientA.cookie, 'idempotency-key': 'a-1' },
      payload: { type: 'expense', amount: '50000', walletId: clientA.walletId, categoryId: (await firstCategories(app, clientA.cookie))[0]!, effectiveDate: '2026-02-01' },
    });
    assert.equal(txA.statusCode, 200, txA.body);
    const txId = (txA.json().data as { id: string }).id;

    const stolen = await app.inject({ method: 'GET', url: `/api/v1/transactions/${txId}`, headers: { cookie: clientB.cookie } });
    assert.equal(stolen.statusCode, 404, 'B tidak dapat membaca transaksi A');

    const stolenWallet = await app.inject({ method: 'GET', url: `/api/v1/wallets/${clientA.walletId}/balance`, headers: { cookie: clientB.cookie } });
    assert.equal(stolenWallet.statusCode, 404, 'B tidak dapat membaca saldo dompet A');

    const stolenReverse = await app.inject({
      method: 'POST', url: `/api/v1/transactions/${txId}/reverse`, headers: { cookie: clientB.cookie }, payload: {},
    });
    assert.equal(stolenReverse.statusCode, 404, 'B tidak dapat membatalkan transaksi A');

    const ownList = await app.inject({ method: 'GET', url: '/api/v1/transactions', headers: { cookie: clientB.cookie } });
    const ownItems = (ownList.json().data as { items: { id: string }[] }).items;
    assert.ok(!ownItems.some((item) => item.id === txId), 'daftar B tidak memuat transaksi A');

    const exportB = await app.inject({ method: 'POST', url: '/api/v1/export/csv', headers: { cookie: clientB.cookie }, payload: {} });
    const csv = await app.inject({ method: 'GET', url: (exportB.json().data as { url: string }).url, headers: { cookie: clientB.cookie } });
    assert.ok(!csv.body.includes(txId), 'ekspor B tidak memuat transaksi A');
  } finally {
    await app.close();
  }
});

async function firstCategories(app: FastifyInstance, cookie: string): Promise<string[]> {
  const response = await app.inject({ method: 'GET', url: '/api/v1/categories?kind=expense', headers: { cookie } });
  return (response.json().data as { id: string }[]).map((row) => row.id);
}

test('permintaan tanpa sesi ditolak dan tidak membocorkan data', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/transactions' });
    assert.equal(response.statusCode, 401);
    const body = response.json() as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'unauthorized');
    assert.ok(body.error.message.length > 0);

    const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
    assert.equal(health.statusCode, 200, 'health tetap terbuka');
  } finally {
    await app.close();
  }
});

test('validasi nominal dan kepemilikan dompet ditegakkan di server', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const first = await register(app, 'c@contoh.id', 'C');
    const client = await withClient(app, first.cookie);
    const categoryId = (await firstCategories(app, client.cookie))[0]!;

    const zero = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie: client.cookie },
      payload: { type: 'expense', amount: '0', walletId: client.walletId, categoryId, effectiveDate: '2026-03-01' },
    });
    assert.equal(zero.statusCode, 400);
    assert.equal((zero.json().error as { code: string }).code, 'validation_failed');

    const negative = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie: client.cookie },
      payload: { type: 'expense', amount: '-5000', walletId: client.walletId, categoryId, effectiveDate: '2026-03-01' },
    });
    assert.equal(negative.statusCode, 400);

    const fraction = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie: client.cookie },
      payload: { type: 'expense', amount: '1000.5', walletId: client.walletId, categoryId, effectiveDate: '2026-03-01' },
    });
    assert.equal(fraction.statusCode, 400);

    const tooLarge = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie: client.cookie },
      payload: { type: 'expense', amount: '1000000000000', walletId: client.walletId, categoryId, effectiveDate: '2026-03-01' },
    });
    assert.equal(tooLarge.statusCode, 400, 'melebihi batas Rp999.999.999.999 ditolak');

    const wrongKind = await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie: client.cookie },
      payload: { type: 'income', amount: '10000', walletId: client.walletId, categoryId, effectiveDate: '2026-03-01' },
    });
    assert.equal(wrongKind.statusCode, 400, 'kategori pengeluaran tidak boleh dipakai untuk pendapatan');
  } finally {
    await app.close();
  }
});

test('ekspor CSV menetralkan formula berbahaya dan memuat kolom wajib', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const first = await register(app, 'd@contoh.id', 'D');
    const client = await withClient(app, first.cookie);
    const categoryId = (await firstCategories(app, client.cookie))[0]!;

    await app.inject({
      method: 'POST', url: '/api/v1/transactions', headers: { cookie: client.cookie, 'idempotency-key': 'x-1' },
      payload: { type: 'expense', amount: '25000', walletId: client.walletId, categoryId, effectiveDate: '2026-04-01', note: '=SUM(A1:A9)' },
    });

    const job = await app.inject({ method: 'POST', url: '/api/v1/export/csv', headers: { cookie: client.cookie }, payload: {} });
    assert.equal(job.statusCode, 200, job.body);
    const url = (job.json().data as { url: string }).url;
    const csv = await app.inject({ method: 'GET', url, headers: { cookie: client.cookie } });
    assert.equal(csv.statusCode, 200);
    assert.ok(csv.body.includes('ID transaksi'), 'header kolom wajib ada');
    assert.ok(csv.body.includes('Tanggal'), 'kolom tanggal ada');
    assert.ok(csv.body.includes('Nominal'), 'kolom nominal ada');
    assert.ok(csv.body.includes('Status'), 'kolom status ada');
    assert.ok(!csv.body.includes('=SUM(A1:A9)'), 'catatan yang berisi formula dinetralkan');
  } finally {
    await app.close();
  }
});
