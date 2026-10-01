// test/transactions.test.ts: the P0 financial cases from PRD §15 that touch the transaction engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, makeWorkspace, ctxOf } from './helpers.ts';
import { createWallet, listWallets, reconcileWallet } from '../src/domain/wallets.ts';
import { createCategory, seedDefaultCategories } from '../src/domain/categories.ts';
import {
  createTransaction, correctTransaction, reverseTransaction, transactionImpact, postPlannedTransaction,
  listTransactions, ledgerNetsToZero, type TxContext,
} from '../src/domain/transactions.ts';
import { classTotal, verifyIntegrity } from '../src/domain/ledger.ts';
import { addDays, localDateInTz } from '../src/core/dates.ts';
import { one } from '../src/db/index.ts';

async function setup() {
  const ws = await makeWorkspace(await makeDb());
  const ctx = ctxOf(ws);
  const bank = await createWallet(ctx, { name: 'Bank', type: 'bank', openingBalance: 1_000_000, openedOn: '2026-01-01' });
  const wallet = await createWallet(ctx, { name: 'Dompet', type: 'cash', openingBalance: 0, openedOn: '2026-01-01' });
  const income = await createCategory(ctx, { name: 'Gaji', kind: 'income' });
  const expense = await createCategory(ctx, { name: 'Makan dan minum', kind: 'expense' });
  const ewallet = await createWallet(ctx, { name: 'E-wallet', type: 'ewallet', openingBalance: 0, openedOn: '2026-01-01' });
  return { ws, ctx, bank, wallet, ewallet, income, expense };
}

async function balanceOf(ctx: TxContext, id: string): Promise<number> {
  const found = (await listWallets(ctx, { includeArchived: true })).find((w) => w.id === id);
  assert.ok(found, 'dompet harus ada');
  return found.balance;
}

test('AT01 saldo awal bank Rp1.000.000, pendapatan Rp5.000.000, belanja Rp100.000', async () => {
  const { ctx, bank, income, expense } = await setup();
  await createTransaction(ctx, { type: 'income', amount: 5_000_000, walletId: bank.id, categoryId: income.id, effectiveDate: '2026-01-02' });
  await createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-01-03' });

  assert.equal(await balanceOf(ctx, bank.id), 5_900_000, 'saldo bank Rp5.900.000');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', '2026-01-01', '2026-01-31'), 5_000_000, 'pendapatan tidak termasuk saldo awal');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-01-01', '2026-01-31'), 100_000);
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
  assert.equal(await ledgerNetsToZero(ctx.db, ctx.workspaceId), 0, 'seluruh jurnal ruang harus netto nol');
});

test('AT02 transfer Rp500.000 dan biaya Rp2.500', async () => {
  const { ctx, bank, ewallet } = await setup();
  await createTransaction(ctx, {
    type: 'transfer', amount: 500_000, fee: 2_500,
    walletId: bank.id, toWalletId: ewallet.id, effectiveDate: '2026-02-02',
  });

  assert.equal(await balanceOf(ctx, bank.id), 497_500, 'bank Rp497.500');
  assert.equal(await balanceOf(ctx, ewallet.id), 500_000, 'e-wallet Rp500.000');
  const dompet = (await one<{ id: string }>(ctx.db, 'SELECT id FROM wallets WHERE name = ?', 'Dompet'))!;
  const totalCash = (await balanceOf(ctx, bank.id)) + (await balanceOf(ctx, ewallet.id)) + (await balanceOf(ctx, dompet.id));
  assert.equal(totalCash, 997_500, 'total kas Rp997.500');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', '2026-02-01', '2026-02-28'), 0, 'transfer bukan pendapatan');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-02-01', '2026-02-28'), 2_500, 'konsumsi hanya biaya');
});

test('transfer ke dompet yang sama ditolak', async () => {
  const { ctx, bank } = await setup();
  await assert.rejects(
    async () => createTransaction(ctx, { type: 'transfer', amount: 10_000, walletId: bank.id, toWalletId: bank.id }),
    /harus berbeda/i,
  );
});

test('AT07 belanja Rp100.000 lalu refund Rp40.000 pada bulan yang sama', async () => {
  const { ctx, bank, expense } = await setup();
  const belanja = await createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-03-05' });
  await createTransaction(ctx, { type: 'refund', amount: 40_000, walletId: bank.id, refundOf: belanja.id, effectiveDate: '2026-03-20' });

  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-03-01', '2026-03-31'), 60_000, 'pengeluaran bersih Rp60.000');
  assert.equal(await balanceOf(ctx, bank.id), 940_000, 'kas naik kembali Rp40.000');
  await assert.rejects(
    async () => createTransaction(ctx, { type: 'refund', amount: 61_000, walletId: bank.id, refundOf: belanja.id, effectiveDate: '2026-03-21' }),
    /melebihi nilai pengeluaran asal/i,
    'refund berikutnya lebih besar dari sisa ditolak',
  );
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('AT09 request transfer diulang dengan kunci idempotensi yang sama', async () => {
  const { ctx, bank, ewallet } = await setup();
  const payload = { type: 'transfer' as const, amount: 500_000, walletId: bank.id, toWalletId: ewallet.id, effectiveDate: '2026-04-02' };
  const first = await createTransaction(ctx, payload, 'kunci-uji-1');
  const second = await createTransaction(ctx, payload, 'kunci-uji-1');

  assert.equal(first.id, second.id, 'ID transaksi sama');
  assert.equal(await balanceOf(ctx, bank.id), 500_000, 'saldo berubah satu kali');
  const count = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM transactions WHERE workspace_id = ?`, ctx.workspaceId))!;
  assert.equal(count.n, 2, 'satu jurnal saldo awal dan satu transfer');
  await assert.rejects(
    async () => createTransaction(ctx, { ...payload, amount: 600_000 }, 'kunci-uji-1'),
    /kunci idempotensi ini sudah dipakai/i,
    'kunci sama dengan payload berbeda ditolak',
  );
});

test('transaksi bertanggal masa depan menjadi rencana dan belum mengubah saldo', async () => {
  const { ctx, bank, expense } = await setup();
  const today = localDateInTz(ctx.timezone);
  const planned = await createTransaction(ctx, { type: 'expense', amount: 250_000, walletId: bank.id, categoryId: expense.id, effectiveDate: addDays(today, 5) });

  assert.equal(planned.status, 'planned', 'status planned');
  assert.equal(await balanceOf(ctx, bank.id), 1_000_000, 'saldo belum berubah');
  const lines = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM journal_lines WHERE transaction_id = ?`, planned.id))!;
  assert.equal(lines.n, 0, 'rencana belum memiliki jurnal');

  const posted = await postPlannedTransaction(ctx, planned.id);
  assert.equal(posted.status, 'posted');
  assert.equal(await balanceOf(ctx, bank.id), 750_000, 'setelah dikonfirmasi saldo berubah');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('koreksi transaksi posted: pembalikan + pengganti, histori tetap ada', async () => {
  const { ctx, bank, expense } = await setup();
  const original = await createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-05-10' });
  assert.equal(await balanceOf(ctx, bank.id), 900_000);

  const replacement = await correctTransaction(ctx, original.id, { amount: 80_000, effectiveDate: '2026-05-12', expectedVersion: original.version, reason: 'nominal salah' });

  assert.notEqual(replacement.id, original.id, 'pengganti adalah transaksi baru');
  assert.equal(replacement.amount_minor, 80_000);
  assert.equal(replacement.replacement_of, original.id, 'menunjuk transaksi asal');
  assert.equal(await balanceOf(ctx, bank.id), 920_000, 'saldo memakai nilai terkoreksi');

  const originalAfter = (await one<{ status: string; version: number }>(ctx.db, `SELECT status, version FROM transactions WHERE id = ?`, original.id))!;
  assert.equal(originalAfter.status, 'reversed', 'transaksi asal ditandai reversed');
  assert.equal(originalAfter.version, 2, 'versi naik');

  const rows = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM transactions WHERE workspace_id = ?`, ctx.workspaceId))!;
  assert.equal(rows.n, 4, 'saldo awal, transaksi asal, pembalikan, dan pengganti');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-05-01', '2026-05-31'), 80_000, 'laporan memakai nilai bersih setelah koreksi');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('koreksi dengan versi lama ditolak sebagai konflik', async () => {
  const { ctx, bank, expense } = await setup();
  const original = await createTransaction(ctx, { type: 'expense', amount: 50_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-05-20' });
  await assert.rejects(
    async () => correctTransaction(ctx, original.id, { amount: 40_000, expectedVersion: 99 }),
    (error: unknown) => (error as { code?: string }).code === 'version_conflict',
  );
});

test('AT10 pembatalan pembayaran mengembalikan saldo dan menaikkan kewajiban (lewat jurnal)', async () => {
  const { ctx, bank, expense } = await setup();
  const belanja = await createTransaction(ctx, { type: 'expense', amount: 200_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-06-01' });
  assert.equal(await balanceOf(ctx, bank.id), 800_000);

  const impact = await transactionImpact(ctx, belanja.id);
  assert.equal(impact.canCancel, true, 'belum ada dependensi, boleh dibatalkan');

  const { reversalId } = await reverseTransaction(ctx, belanja.id, 'salah catat');
  assert.ok(reversalId, 'ada transaksi pembalikan');
  assert.equal(await balanceOf(ctx, bank.id), 1_000_000, 'kas kembali');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-06-01', '2026-06-30'), 0, 'pengeluaran bersih kembali nol');
  const audit = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM audit_logs WHERE workspace_id = ? AND action = 'reverse'`, ctx.workspaceId))!;
  assert.equal(audit.n, 1, 'jejak audit tetap ada');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('pembatalan ditolak bila ada refund yang menunjuk transaksi itu', async () => {
  const { ctx, bank, expense } = await setup();
  const belanja = await createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-07-01' });
  await createTransaction(ctx, { type: 'refund', amount: 20_000, walletId: bank.id, refundOf: belanja.id, effectiveDate: '2026-07-02' });

  const impact = await transactionImpact(ctx, belanja.id);
  assert.equal(impact.canCancel, false, 'ada dependensi refund');
  assert.match(impact.blockedBy[0] ?? '', /pengembalian dana/i);
  await assert.rejects(
    async () => reverseTransaction(ctx, belanja.id),
    (error: unknown) => (error as { code?: string }).code === 'has_dependencies',
  );
});

test('rekonsiliasi menyimpan selisih sebagai penyesuaian, bukan pendapatan', async () => {
  const { ctx, bank } = await setup();
  const result = await reconcileWallet(ctx, bank.id, { actualBalance: 985_000, reason: 'selisih catat bank' }, 'rek-1');
  assert.equal(result.difference, -15_000, 'selisih negatif Rp15.000');
  assert.equal(await balanceOf(ctx, bank.id), 985_000, 'saldo menyesuaikan');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', '2020-01-01', '2030-12-31'), 0, 'penyesuaian bukan pendapatan');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2020-01-01', '2030-12-31'), 0, 'penyesuaian bukan konsumsi');

  const again = await reconcileWallet(ctx, bank.id, { actualBalance: 985_000, reason: 'selisih catat bank' }, 'rek-1');
  assert.equal(again.difference, -15_000, 'kunci idempotensi yang sama mengembalikan hasil sama');
  assert.equal(await balanceOf(ctx, bank.id), 985_000, 'saldo tidak berubah dua kali');
});

test('filter daftar transaksi: periode, jenis, dan pencarian catatan', async () => {
  const { ctx, bank, income, expense } = await setup();
  await createTransaction(ctx, { type: 'income', amount: 3_000_000, walletId: bank.id, categoryId: income.id, effectiveDate: '2026-08-01', note: 'gaji agustus' });
  await createTransaction(ctx, { type: 'expense', amount: 45_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-08-02', note: 'makan siang' });

  const inPeriod = await listTransactions(ctx, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(inPeriod.total, 2);
  const onlyIncome = await listTransactions(ctx, { type: 'income' });
  assert.equal(onlyIncome.total, 1);
  const search = await listTransactions(ctx, { q: 'makan' });
  assert.equal(search.total, 1);
  assert.equal(search.items[0]?.note, 'makan siang');
  const byWallet = await listTransactions(ctx, { walletId: bank.id });
  assert.ok(byWallet.total >= 2);
});

test('kategori bawaan dibuat sekali saja', async () => {
  const { ctx } = await setup();
  const before = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM categories WHERE workspace_id = ?`, ctx.workspaceId))!;
  await seedDefaultCategories(ctx);
  const after = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM categories WHERE workspace_id = ?`, ctx.workspaceId))!;
  assert.equal(before.n, after.n, 'kategori bawaan tidak digandakan');
});
