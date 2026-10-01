// scripts/smoke.mjs: one process boots the API, walks the real HTTP surface, and reports PASS/FAIL.
// This is the automated half of the R-35 click-through: every route the UI calls is exercised here.
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// The native driver releases the file handle slightly after close(); on Windows the removal can
// still hit EPERM. Best effort: the temporary directory reclaims whatever is left.
function cleanup(path) {
  try {
    rmSync(path, { force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    console.log(`Catatan: ${path} belum bisa dihapus`);
  }
}

const PORT = Number(process.env.SMOKE_PORT ?? 8791);
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
let cookie = '';
let workspaceId = '';

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? `: ${detail}` : ''}`);
}

async function call(method, path, { body, idempotencyKey, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  if (raw) return { status: response.status, text: await response.text(), headers: response.headers };
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

function money(value) {
  return typeof value === 'string' && /^\d+$/.test(value);
}

async function main() {
  const { openDatabase, migrate } = await import('../server/src/db/index.ts');
  const { buildServer } = await import('../server/src/http/server.ts');

  // A real file, not :memory: — libSQL gives every pooled connection its own in-memory database.
  const dbPath = join(tmpdir(), `ihsan-smoke-${process.pid}.db`);
  const db = await openDatabase(dbPath);
  await migrate(db);
  const app = await buildServer({ db });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`Server uji berjalan di ${BASE}`);
  console.log(`Basis data: ${dbPath} (uji ini)`);
  console.log('');

  try {
    // ── health ──────────────────────────────────────────────────────────────
    const health = await call('GET', '/api/v1/health');
    record('health terbuka tanpa sesi', health.status === 200);

    const guarded = await call('GET', '/api/v1/transactions');
    record('permintaan tanpa sesi ditolak 401', guarded.status === 401);

    // ── daftar ──────────────────────────────────────────────────────────────
    const registered = await call('POST', '/api/v1/auth/register', {
      body: { email: 'smoke@ihsan.test', password: 'smoke-uji-2026', displayName: 'Uji Asap', timezone: 'Asia/Jakarta' },
    });
    record('daftar akun baru', registered.status === 200, `status ${registered.status}`);
    workspaceId = registered.json?.data?.user?.workspaceId ?? '';
    record('kode pemulihan diberikan sekali', typeof registered.json?.data?.recoveryCode === 'string');

    const me = await call('GET', '/api/v1/auth/me');
    record('sesi dikenali setelah daftar', me.status === 200 && me.json?.data?.email === 'smoke@ihsan.test');

    // ── dompet ──────────────────────────────────────────────────────────────
    const wallet = await call('POST', '/api/v1/wallets', {
      body: { name: 'Bank Uji', type: 'bank', openingBalance: '1.000.000', openedOn: '2026-01-01' },
      idempotencyKey: 'smoke-w1',
    });
    record('buat dompet dengan saldo awal "1.000.000"', wallet.status === 200 && wallet.json?.data?.balance === '1000000');
    const walletId = wallet.json?.data?.id;

    const repeatWallet = await call('POST', '/api/v1/wallets', {
      body: { name: 'Bank Uji', type: 'bank', openingBalance: '1.000.000', openedOn: '2026-01-01' },
      idempotencyKey: 'smoke-w1',
    });
    record('kunci idempotensi yang sama tidak menggandakan dompet', repeatWallet.json?.data?.id === walletId);

    const secondWallet = await call('POST', '/api/v1/wallets', {
      body: { name: 'Dompet Digital', type: 'ewallet', openingBalance: '250000', openedOn: '2026-01-01' },
      idempotencyKey: 'smoke-w2',
    });
    const secondWalletId = secondWallet.json?.data?.id;

    // ── kategori ────────────────────────────────────────────────────────────
    const categories = await call('GET', '/api/v1/categories');
    const rows = categories.json?.data ?? [];
    record('kategori bawaan tersedia', rows.length >= 12, `${rows.length} kategori`);
    const expenseCategory = rows.find((row) => row.kind === 'expense')?.id;
    const incomeCategory = rows.find((row) => row.kind === 'income')?.id;

    // ── transaksi ───────────────────────────────────────────────────────────
    const income = await call('POST', '/api/v1/transactions', {
      body: { type: 'income', amount: '5.000.000', walletId, categoryId: incomeCategory, effectiveDate: '2026-01-02' },
      idempotencyKey: 'smoke-t1',
    });
    record('catat pendapatan Rp5.000.000', income.status === 200 && income.json?.data?.amount === '5000000');

    const expense = await call('POST', '/api/v1/transactions', {
      body: { type: 'expense', amount: '100000', walletId, categoryId: expenseCategory, effectiveDate: '2026-01-03' },
      idempotencyKey: 'smoke-t2',
    });
    record('catat pengeluaran Rp100.000', expense.status === 200);

    const transfer = await call('POST', '/api/v1/transactions', {
      body: { type: 'transfer', amount: '500000', walletId, toWalletId: secondWalletId, fee: '2500', effectiveDate: '2026-01-04' },
      idempotencyKey: 'smoke-t3',
    });
    record('transfer Rp500.000 dengan biaya Rp2.500', transfer.status === 200);

    const balanceBank = await call('GET', `/api/v1/wallets/${walletId}/balance`);
    record('AT02 saldo bank Rp5.397.500 setelah transfer berbunga', balanceBank.json?.data?.balance === '5397500', `dapat ${balanceBank.json?.data?.balance}`);

    const balanceEwallet = await call('GET', `/api/v1/wallets/${secondWalletId}/balance`);
    record('AT02 dompet tujuan menerima Rp500.000', balanceEwallet.json?.data?.balance === '750000');

    // ── laporan ─────────────────────────────────────────────────────────────
    const summary = await call('GET', '/api/v1/reports/summary?period=2026-01');
    const summaryData = summary.json?.data ?? {};
    record('AT01 pendapatan Rp5.000.000', summaryData.income === '5000000');
    record('AT01 pengeluaran Rp102.500 (belanja + biaya transfer)', summaryData.expense === '102500', `dapat ${summaryData.expense}`);
    record('nominal dikirim sebagai string desimal', money(summaryData.income) && money(summaryData.expense));

    const cashflow = await call('GET', '/api/v1/reports/cashflow?period=2026-01');
    record('arus kas per periode', cashflow.status === 200 && Array.isArray(cashflow.json?.data?.buckets));

    const networth = await call('GET', '/api/v1/reports/networth');
    record('kekayaan bersih dapat dihitung', networth.status === 200 && networth.json?.data?.netWorth === '6147500', `dapat ${networth.json?.data?.netWorth}`);

    const check = await call('GET', '/api/v1/reports/networth-check');
    record('kekayaan bersih turunan sama dengan buku besar', check.json?.data?.match === true);

    // ── refund ──────────────────────────────────────────────────────────────
    const refund = await call('POST', '/api/v1/transactions', {
      body: { type: 'refund', amount: '40000', walletId, categoryId: expenseCategory, refundOf: expense.json?.data?.id, effectiveDate: '2026-01-05' },
      idempotencyKey: 'smoke-t4',
    });
    record('AT07 refund Rp40.000 atas belanja Rp100.000', refund.status === 200, `status ${refund.status}`);

    const afterRefund = await call('GET', '/api/v1/reports/summary?period=2026-01');
    record('AT07 pengeluaran bersih Rp62.500', afterRefund.json?.data?.expense === '62500', `dapat ${afterRefund.json?.data?.expense}`);

    // ── utang ───────────────────────────────────────────────────────────────
    const debt = await call('POST', '/api/v1/debts', {
      body: { direction: 'payable', counterpartyName: 'Koperasi Uji', principal: '1000000', openingMode: 'cash', walletId, startDate: '2026-02-01' },
      idempotencyKey: 'smoke-d1',
    });
    record('AT03 catat utang Rp1.000.000', debt.status === 200 && debt.json?.data?.remaining === '1000000');
    const debtId = debt.json?.data?.id;

    const payment = await call('POST', `/api/v1/debts/${debtId}/payments`, {
      body: { principal: '200000', interest: '10000', walletId, paymentDate: '2026-02-05' },
      idempotencyKey: 'smoke-p1',
    });
    record('AT03 bayar pokok Rp200.000 dan bunga Rp10.000', payment.status === 200 && payment.json?.data?.debt?.remaining === '800000');

    const debtDetail = await call('GET', `/api/v1/debts/${debtId}`);
    const paymentId = debtDetail.json?.data?.payments?.[0]?.id;
    record('AT03 kas keluar Rp210.000', debtDetail.json?.data?.payments?.[0]?.cashAmount === '210000');

    const cancelled = await call('POST', `/api/v1/debts/${debtId}/payments/${paymentId}/cancel`, {
      body: { reason: 'uji pembatalan' }, idempotencyKey: 'smoke-p2',
    });
    record('AT10 batal pembayaran mengembalikan sisa pokok', cancelled.json?.data?.remaining === '1000000');

    // ── tujuan ──────────────────────────────────────────────────────────────
    const goal = await call('POST', '/api/v1/goals', {
      body: { name: 'Laptop Uji', target: '1000000', targetDate: '2026-12-31', priority: 1 },
      idempotencyKey: 'smoke-g1',
    });
    record('buat tujuan Rp1.000.000', goal.status === 200);
    const goalId = goal.json?.data?.id;

    const allocation = await call('POST', `/api/v1/goals/${goalId}/allocations`, {
      body: { walletId, amount: '400000', effectiveDate: '2026-03-01' }, idempotencyKey: 'smoke-a1',
    });
    record('AT05 alokasi Rp400.000 ke tujuan', allocation.json?.data?.goal?.allocated === '400000');

    const goalSpend = await call('POST', `/api/v1/goals/${goalId}/spend`, {
      body: { walletId, categoryId: expenseCategory, amount: '100000', effectiveDate: '2026-03-02' },
      idempotencyKey: 'smoke-a2',
    });
    record('AT06 belanja dari tujuan mengurangi alokasi', goalSpend.json?.data?.goal?.allocated === '300000');

    // ── anggaran ────────────────────────────────────────────────────────────
    const budget = await call('POST', '/api/v1/budgets', {
      body: { categoryId: expenseCategory, period: '2026-04', limit: '500000' }, idempotencyKey: 'smoke-b1',
    });
    record('buat anggaran Rp500.000', budget.status === 200);

    await call('POST', '/api/v1/transactions', {
      body: { type: 'expense', amount: '450000', walletId, categoryId: expenseCategory, effectiveDate: '2026-04-10' },
      idempotencyKey: 'smoke-t5',
    });
    const budgets = await call('GET', '/api/v1/budgets?period=2026-04');
    const budgetRow = budgets.json?.data?.[0] ?? {};
    record('AT11 terpakai Rp450.000 dan sisa Rp50.000', budgetRow.spent === '450000' && budgetRow.remaining === '50000');
    record('AT11 peringatan mendekati batas', budgetRow.warning === 'near', `dapat ${budgetRow.warning}`);

    // ── rencana berulang ────────────────────────────────────────────────────
    const rule = await call('POST', '/api/v1/recurring', {
      body: { type: 'expense', frequency: 'monthly', label: 'Internet Uji', amount: '300000', walletId, categoryId: expenseCategory, startOn: '2026-05-01', anchorDay: 1 },
      idempotencyKey: 'smoke-r1',
    });
    record('buat aturan berulang bulanan', rule.status === 200);

    const occurrences = await call('GET', '/api/v1/recurring/occurrences?status=pending');
    const pending = occurrences.json?.data ?? [];
    record('kejadian menunggu konfirmasi muncul', pending.length >= 1, `${pending.length} kejadian`);

    if (pending[0]) {
      const confirmed = await call('POST', `/api/v1/recurring/occurrences/${pending[0].id}/confirm`, {
        body: {}, idempotencyKey: 'smoke-conf1',
      });
      record('konfirmasi kejadian membuat transaksi', confirmed.status === 200 && confirmed.json?.data?.transaction?.amount === '300000');
    }

    // ── pengingat & beranda ─────────────────────────────────────────────────
    const notifications = await call('GET', '/api/v1/notifications?status=all');
    record('daftar pengingat dapat dibaca', notifications.status === 200 && Array.isArray(notifications.json?.data));

    const dashboard = await call('GET', '/api/v1/dashboard');
    const dash = dashboard.json?.data ?? {};
    record('beranda mengembalikan satu paket data', dashboard.status === 200 && typeof dash.totalBalance === 'string');
    record('beranda memuat saldo dompet', Array.isArray(dash.wallets) && dash.wallets.length === 2);

    // ── ekspor ──────────────────────────────────────────────────────────────
    const exportJob = await call('POST', '/api/v1/export/csv', { body: {} });
    const exportUrl = exportJob.json?.data?.url;
    record('buat ekspor CSV', exportJob.status === 200 && typeof exportUrl === 'string');

    if (exportUrl) {
      const csv = await call('GET', exportUrl, { raw: true });
      record('unduh CSV berisi kolom wajib', csv.status === 200 && csv.text.includes('ID transaksi') && csv.text.includes('Nominal'));
    }

    const fullExport = await call('POST', '/api/v1/export/full', { body: {} });
    record('buat cadangan penuh', fullExport.status === 200);

    // ── isolasi ruang ───────────────────────────────────────────────────────
    const savedCookie = cookie;
    cookie = '';
    const other = await call('POST', '/api/v1/auth/register', {
      body: { email: 'lain@ihsan.test', password: 'lain-uji-2026', displayName: 'Ruang Lain', timezone: 'Asia/Jakarta' },
    });
    record('ruang kedua dibuat', other.status === 200);

    const stolen = await call('GET', `/api/v1/wallets/${walletId}/balance`);
    record('AT13 ruang lain tidak membaca saldo dompet ini', stolen.status === 404, `status ${stolen.status}`);

    const stolenDebt = await call('GET', `/api/v1/debts/${debtId}`);
    record('AT13 ruang lain tidak membaca catatan utang ini', stolenDebt.status === 404);

    const otherList = await call('GET', '/api/v1/transactions');
    record('AT13 daftar transaksi ruang lain kosong', (otherList.json?.data?.items ?? []).length === 0);

    cookie = savedCookie;

    // ── validasi ────────────────────────────────────────────────────────────
    const zero = await call('POST', '/api/v1/transactions', {
      body: { type: 'expense', amount: '0', walletId, categoryId: expenseCategory, effectiveDate: '2026-06-01' },
    });
    record('nominal nol ditolak', zero.status === 400);

    const decimal = await call('POST', '/api/v1/transactions', {
      body: { type: 'expense', amount: '1000.5', walletId, categoryId: expenseCategory, effectiveDate: '2026-06-01' },
    });
    record('nominal bersen ditolak (bukan dibaca 10005)', decimal.status === 400);

    const huge = await call('POST', '/api/v1/transactions', {
      body: { type: 'expense', amount: '1000000000000', walletId, categoryId: expenseCategory, effectiveDate: '2026-06-01' },
    });
    record('nominal di atas Rp999.999.999.999 ditolak', huge.status === 400);

    const sameWallet = await call('POST', '/api/v1/transactions', {
      body: { type: 'transfer', amount: '1000', walletId, toWalletId: walletId, effectiveDate: '2026-06-01' },
    });
    record('transfer ke dompet yang sama ditolak', sameWallet.status === 400);

    const future = await call('POST', '/api/v1/transactions', {
      body: { type: 'expense', amount: '50000', walletId, categoryId: expenseCategory, effectiveDate: '2099-12-31' },
      idempotencyKey: 'smoke-t6',
    });
    record('tanggal masa depan menjadi rencana', future.json?.data?.status === 'planned', `dapat ${future.json?.data?.status}`);

    const impact = await call('GET', `/api/v1/transactions/${expense.json?.data?.id}/impact`);
    record('dampak pembatalan dapat dipratinjau', impact.status === 200 && typeof impact.json?.data?.summary === 'string');
  } finally {
    await app.close();
    await db.close();
    cleanup(dbPath);
    cleanup(`${dbPath}-wal`);
    cleanup(`${dbPath}-shm`);
  }

  const failed = results.filter((entry) => !entry.ok);
  console.log('');
  console.log(`Ringkasan: ${results.length - failed.length}/${results.length} lulus.`);
  if (failed.length > 0) {
    console.log('Yang gagal:');
    for (const entry of failed) console.log(`  - ${entry.name}${entry.detail ? ` (${entry.detail})` : ''}`);
    process.exitCode = 1;
  }
  await delay(50);
}

main().catch((error) => {
  console.error('Smoke test berhenti karena kesalahan:', error);
  process.exitCode = 1;
});
