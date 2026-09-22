// test/transactions.test.ts: the P0 financial cases from PRD §15 that touch the transaction engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, makeWorkspace, ctxOf } from './helpers.ts';
import { createWallet, listWallets, reconcileWallet } from '../src/domain/wallets.ts';
import { createCategory, seedDefaultCategories } from '../src/domain/categories.ts';
import {
  createTransaction, correctTransaction, reverseTransaction, transactionImpact, postPlannedTransaction,
  listTransactions, ledgerNetsToZero,
} from '../src/domain/transactions.ts';
import { classTotal, verifyIntegrity } from '../src/domain/ledger.ts';
import { addDays, localDateInTz } from '../src/core/dates.ts';

function setup() {
  const ws = makeWorkspace(makeDb());
  const ctx = ctxOf(ws);
  const bank = createWallet(ctx, { name: 'Bank', type: 'bank', openingBalance: 1_000_000, openedOn: '2026-01-01' });
  const wallet = createWallet(ctx, { name: 'Dompet', type: 'cash', openingBalance: 0, openedOn: '2026-01-01' });
  const income = createCategory(ctx, { name: 'Gaji', kind: 'income' });
  const expense = createCategory(ctx, { name: 'Makan dan minum', kind: 'expense' });
  const ewallet = createWallet(ctx, { name: 'E-wallet', type: 'ewallet', openingBalance: 0, openedOn: '2026-01-01' });
  return { ws, ctx, bank, wallet, ewallet, income, expense };
}

function balanceOf(ctx: ReturnType<typeof setup>['ctx'], id: string): number {
  const found = listWallets(ctx, { includeArchived: true }).find((w) => w.id === id);
  assert.ok(found, 'dompet harus ada');
  return found.balance;
}

test('AT01 saldo awal bank Rp1.000.000, pendapatan Rp5.000.000, belanja Rp100.000', () => {
  const { ctx, bank, income, expense } = setup();
  createTransaction(ctx, { type: 'income', amount: 5_000_000, walletId: bank.id, categoryId: income.id, effectiveDate: '2026-01-02' });
  createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-01-03' });

  assert.equal(balanceOf(ctx, bank.id), 5_900_000, 'saldo bank Rp5.900.000');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'income', '2026-01-01', '2026-01-31'), 5_000_000, 'pendapatan tidak termasuk saldo awal');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-01-01', '2026-01-31'), 100_000);
  assert.equal(verifyIntegrity(ctx.db, ctx.workspaceId).ok, true);
  assert.equal(ledgerNetsToZero(ctx.db, ctx.workspaceId), 0, 'seluruh jurnal ruang harus netto nol');
});

test('AT02 transfer Rp500.000 dan biaya Rp2.500', () => {
  const { ctx, bank, ewallet } = setup();
  createTransaction(ctx, {
    type: 'transfer', amount: 500_000, fee: 2_500,
    walletId: bank.id, toWalletId: ewallet.id, effectiveDate: '2026-02-02',
  });

  assert.equal(balanceOf(ctx, bank.id), 497_500, 'bank Rp497.500');
  assert.equal(balanceOf(ctx, ewallet.id), 500_000, 'e-wallet Rp500.000');
  const totalCash = balanceOf(ctx, bank.id) + balanceOf(ctx, ewallet.id) + balanceOf(ctx, ctx.db.prepare('SELECT id FROM wallets WHERE name = ?').get('Dompet')!.id as string);
  assert.equal(totalCash, 997_500, 'total kas Rp997.500');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'income', '2026-02-01', '2026-02-28'), 0, 'transfer bukan pendapatan');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-02-01', '2026-02-28'), 2_500, 'konsumsi hanya biaya');
});

test('transfer ke dompet yang sama ditolak', () => {
  const { ctx, bank } = setup();
  assert.throws(
    () => createTransaction(ctx, { type: 'transfer', amount: 10_000, walletId: bank.id, toWalletId: bank.id }),
    /harus berbeda/i,
  );
});

test('AT07 belanja Rp100.000 lalu refund Rp40.000 pada bulan yang sama', () => {
  const { ctx, bank, expense } = setup();
  const belanja = createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-03-05' });
  createTransaction(ctx, { type: 'refund', amount: 40_000, walletId: bank.id, refundOf: belanja.id, effectiveDate: '2026-03-20' });

  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-03-01', '2026-03-31'), 60_000, 'pengeluaran bersih Rp60.000');
  assert.equal(balanceOf(ctx, bank.id), 940_000, 'kas naik kembali Rp40.000');
  assert.throws(
    () => createTransaction(ctx, { type: 'refund', amount: 61_000, walletId: bank.id, refundOf: belanja.id, effectiveDate: '2026-03-21' }),
    /melebihi nilai pengeluaran asal/i,
    'refund berikutnya lebih besar dari sisa ditolak',
  );
  assert.equal(verifyIntegrity(ctx.db, ctx.workspaceId).ok, true);
});

test('AT09 request transfer diulang dengan kunci idempotensi yang sama', () => {
  const { ctx, bank, ewallet } = setup();
  const payload = { type: 'transfer' as const, amount: 500_000, walletId: bank.id, toWalletId: ewallet.id, effectiveDate: '2026-04-02' };
  const first = createTransaction(ctx, payload, 'kunci-uji-1');
  const second = createTransaction(ctx, payload, 'kunci-uji-1');

  assert.equal(first.id, second.id, 'ID transaksi sama');
  assert.equal(balanceOf(ctx, bank.id), 500_000, 'saldo berubah satu kali');
  const count = ctx.db.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE workspace_id = ?`).get(ctx.workspaceId) as { n: number };
  assert.equal(count.n, 2, 'satu jurnal saldo awal dan satu transfer');
  assert.throws(
    () => createTransaction(ctx, { ...payload, amount: 600_000 }, 'kunci-uji-1'),
    /kunci idempotensi ini sudah dipakai/i,
    'kunci sama dengan payload berbeda ditolak',
  );
});

test('transaksi bertanggal masa depan menjadi rencana dan belum mengubah saldo', () => {
  const { ctx, bank, expense } = setup();
  const today = localDateInTz(ctx.timezone);
  const planned = createTransaction(ctx, { type: 'expense', amount: 250_000, walletId: bank.id, categoryId: expense.id, effectiveDate: addDays(today, 5) });

  assert.equal(planned.status, 'planned', 'status planned');
  assert.equal(balanceOf(ctx, bank.id), 1_000_000, 'saldo belum berubah');
  const lines = ctx.db.prepare(`SELECT COUNT(*) AS n FROM journal_lines WHERE transaction_id = ?`).get(planned.id) as { n: number };
  assert.equal(lines.n, 0, 'rencana belum memiliki jurnal');

  const posted = postPlannedTransaction(ctx, planned.id);
  assert.equal(posted.status, 'posted');
  assert.equal(balanceOf(ctx, bank.id), 750_000, 'setelah dikonfirmasi saldo berubah');
  assert.equal(verifyIntegrity(ctx.db, ctx.workspaceId).ok, true);
});

test('koreksi transaksi posted: pembalikan + pengganti, histori tetap ada', () => {
  const { ctx, bank, expense } = setup();
  const original = createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-05-10' });
  assert.equal(balanceOf(ctx, bank.id), 900_000);

  const replacement = correctTransaction(ctx, original.id, { amount: 80_000, effectiveDate: '2026-05-12', expectedVersion: original.version, reason: 'nominal salah' });

  assert.notEqual(replacement.id, original.id, 'pengganti adalah transaksi baru');
  assert.equal(replacement.amount_minor, 80_000);
  assert.equal(replacement.replacement_of, original.id, 'menunjuk transaksi asal');
  assert.equal(balanceOf(ctx, bank.id), 920_000, 'saldo memakai nilai terkoreksi');

  const originalAfter = ctx.db.prepare(`SELECT status, version FROM transactions WHERE id = ?`).get(original.id) as { status: string; version: number };
  assert.equal(originalAfter.status, 'reversed', 'transaksi asal ditandai reversed');
  assert.equal(originalAfter.version, 2, 'versi naik');

  const rows = ctx.db.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE workspace_id = ?`).get(ctx.workspaceId) as { n: number };
  assert.equal(rows.n, 4, 'saldo awal, transaksi asal, pembalikan, dan pengganti');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-05-01', '2026-05-31'), 80_000, 'laporan memakai nilai bersih setelah koreksi');
  assert.equal(verifyIntegrity(ctx.db, ctx.workspaceId).ok, true);
});

test('koreksi dengan versi lama ditolak sebagai konflik', () => {
  const { ctx, bank, expense } = setup();
  const original = createTransaction(ctx, { type: 'expense', amount: 50_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-05-20' });
  assert.throws(
    () => correctTransaction(ctx, original.id, { amount: 40_000, expectedVersion: 99 }),
    (error: unknown) => (error as { code?: string }).code === 'version_conflict',
  );
});

test('AT10 pembatalan pembayaran mengembalikan saldo dan menaikkan kewajiban (lewat jurnal)', () => {
  const { ctx, bank, expense } = setup();
  const belanja = createTransaction(ctx, { type: 'expense', amount: 200_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-06-01' });
  assert.equal(balanceOf(ctx, bank.id), 800_000);

  const impact = transactionImpact(ctx, belanja.id);
  assert.equal(impact.canCancel, true, 'belum ada dependensi, boleh dibatalkan');

  const { reversalId } = reverseTransaction(ctx, belanja.id, 'salah catat');
  assert.ok(reversalId, 'ada transaksi pembalikan');
  assert.equal(balanceOf(ctx, bank.id), 1_000_000, 'kas kembali');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-06-01', '2026-06-30'), 0, 'pengeluaran bersih kembali nol');
  const audit = ctx.db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE workspace_id = ? AND action = 'reverse'`).get(ctx.workspaceId) as { n: number };
  assert.equal(audit.n, 1, 'jejak audit tetap ada');
  assert.equal(verifyIntegrity(ctx.db, ctx.workspaceId).ok, true);
});

test('pembatalan ditolak bila ada refund yang menunjuk transaksi itu', () => {
  const { ctx, bank, expense } = setup();
  const belanja = createTransaction(ctx, { type: 'expense', amount: 100_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-07-01' });
  createTransaction(ctx, { type: 'refund', amount: 20_000, walletId: bank.id, refundOf: belanja.id, effectiveDate: '2026-07-02' });

  const impact = transactionImpact(ctx, belanja.id);
  assert.equal(impact.canCancel, false, 'ada dependensi refund');
  assert.match(impact.blockedBy[0] ?? '', /pengembalian dana/i);
  assert.throws(
    () => reverseTransaction(ctx, belanja.id),
    (error: unknown) => (error as { code?: string }).code === 'has_dependencies',
  );
});

test('rekonsiliasi menyimpan selisih sebagai penyesuaian, bukan pendapatan', () => {
  const { ctx, bank } = setup();
  const result = reconcileWallet(ctx, bank.id, { actualBalance: 985_000, reason: 'selisih catat bank' }, 'rek-1');
  assert.equal(result.difference, -15_000, 'selisih negatif Rp15.000');
  assert.equal(balanceOf(ctx, bank.id), 985_000, 'saldo menyesuaikan');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'income', '2020-01-01', '2030-12-31'), 0, 'penyesuaian bukan pendapatan');
  assert.equal(classTotal(ctx.db, ctx.workspaceId, 'expense', '2020-01-01', '2030-12-31'), 0, 'penyesuaian bukan konsumsi');

  const again = reconcileWallet(ctx, bank.id, { actualBalance: 985_000, reason: 'selisih catat bank' }, 'rek-1');
  assert.equal(again.difference, -15_000, 'kunci idempotensi yang sama mengembalikan hasil sama');
  assert.equal(balanceOf(ctx, bank.id), 985_000, 'saldo tidak berubah dua kali');
});

test('filter daftar transaksi: periode, jenis, dan pencarian catatan', () => {
  const { ctx, bank, income, expense } = setup();
  createTransaction(ctx, { type: 'income', amount: 3_000_000, walletId: bank.id, categoryId: income.id, effectiveDate: '2026-08-01', note: 'gaji agustus' });
  createTransaction(ctx, { type: 'expense', amount: 45_000, walletId: bank.id, categoryId: expense.id, effectiveDate: '2026-08-02', note: 'makan siang' });

  const inPeriod = listTransactions(ctx, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(inPeriod.total, 2);
  const onlyIncome = listTransactions(ctx, { type: 'income' });
  assert.equal(onlyIncome.total, 1);
  const search = listTransactions(ctx, { q: 'makan' });
  assert.equal(search.total, 1);
  assert.equal(search.items[0]?.note, 'makan siang');
  const byWallet = listTransactions(ctx, { walletId: bank.id });
  assert.ok(byWallet.total >= 2);
});

test('kategori bawaan dibuat sekali saja', () => {
  const { ctx } = setup();
  const before = ctx.db.prepare(`SELECT COUNT(*) AS n FROM categories WHERE workspace_id = ?`).get(ctx.workspaceId) as { n: number };
  seedDefaultCategories(ctx);
  const after = ctx.db.prepare(`SELECT COUNT(*) AS n FROM categories WHERE workspace_id = ?`).get(ctx.workspaceId) as { n: number };
  assert.equal(before.n, after.n, 'kategori bawaan tidak digandakan');
});
