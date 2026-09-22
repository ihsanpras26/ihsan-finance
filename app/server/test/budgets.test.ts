// test/budgets.test.ts: anggaran kategori: AT11 (PRD §15, FR15).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, makeWorkspace, ctxOf } from './helpers.ts';
import { createWallet, getWallet } from '../src/domain/wallets.ts';
import { createCategory } from '../src/domain/categories.ts';
import { createTransaction } from '../src/domain/transactions.ts';
import { verifyIntegrity } from '../src/domain/ledger.ts';
import { budgetAlerts, createBudget, getBudget, listBudgets, updateBudget } from '../src/domain/budgets.ts';
import { addMonthsClamped, currentPeriod, localDateInTz } from '../src/core/dates.ts';

function setup(openingBalance = 1_000_000) {
  const ws = makeWorkspace(makeDb());
  const ctx = ctxOf(ws);
  const wallet = createWallet(ctx, { name: 'Kas', type: 'cash', openingBalance, openedOn: '2026-01-01' });
  const expense = createCategory(ctx, { name: 'Belanja harian', kind: 'expense' });
  const income = createCategory(ctx, { name: 'Gaji', kind: 'income' });
  const today = localDateInTz(ctx.timezone);
  const period = currentPeriod(ctx.timezone);
  return { ws, ctx, wallet, expense, income, today, period };
}

test('AT11 anggaran Rp500.000; belanja Rp450.000 lalu refund Rp100.000', () => {
  const { ctx, wallet, expense, today, period } = setup();
  const budget = createBudget(ctx, { categoryId: expense.id, period, limit: 500_000 });

  assert.equal(budget.spent, 0);
  assert.equal(budget.remaining, 500_000);
  assert.equal(budget.warning, 'none');
  assert.equal(budget.period, period);

  const belanja = createTransaction(ctx, {
    type: 'expense', amount: 450_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: today,
  });

  const setelahBelanja = listBudgets(ctx, { period })[0]!;
  assert.equal(setelahBelanja.spent, 450_000, 'terpakai Rp450.000');
  assert.equal(setelahBelanja.remaining, 50_000, 'tersisa Rp50.000');
  assert.equal(setelahBelanja.warning, 'near', 'peringatan 80% aktif');

  createTransaction(ctx, {
    type: 'refund', amount: 100_000, walletId: wallet.id, refundOf: belanja.id, effectiveDate: today,
  });

  const setelahRefund = listBudgets(ctx, { period })[0]!;
  assert.equal(setelahRefund.spent, 350_000, 'terpakai Rp350.000 setelah refund');
  assert.equal(setelahRefund.remaining, 150_000, 'tersisa Rp150.000');
  assert.equal(setelahRefund.ratio, 0.7);
  assert.equal(setelahRefund.warning, 'none', 'peringatan 80% tidak tetap aktif');
  assert.equal(budgetAlerts(ctx, period).length, 0, 'tidak ada peringatan tersisa');
  assert.equal(verifyIntegrity(ctx.db, ctx.workspaceId).ok, true);
});

test('anggaran melewati batas ditandai over dan pengeluaran tetap boleh dicatat', () => {
  const { ctx, wallet, expense, today, period } = setup();
  createBudget(ctx, { categoryId: expense.id, period, limit: 100_000 });

  createTransaction(ctx, { type: 'expense', amount: 130_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: today });
  const view = listBudgets(ctx, { period })[0]!;

  assert.equal(view.spent, 130_000);
  assert.equal(view.remaining, -30_000, 'sisa negatif ditampilkan apa adanya');
  assert.equal(view.warning, 'over');
  assert.match(view.warningLabel, /terlampaui/i);
  assert.equal(getWallet(ctx, wallet.id).balance, 870_000, 'pengeluaran tetap tercatat walau limit terlampaui');
});

test('perubahan limit langsung tercermin dan versinya naik', () => {
  const { ctx, wallet, expense, today, period } = setup();
  const budget = createBudget(ctx, { categoryId: expense.id, period, limit: 500_000 }, 'anggaran-1');
  createTransaction(ctx, { type: 'expense', amount: 450_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: today });

  const updated = updateBudget(ctx, budget.id, { limit: 400_000, expectedVersion: budget.version });
  assert.equal(updated.limit_minor, 400_000);
  assert.equal(updated.version, 2, 'versi naik');
  assert.equal(updated.spent, 450_000, 'terpakai tidak berubah');
  assert.equal(updated.warning, 'over', 'limit baru langsung dipakai');
  assert.equal(getBudget(ctx, budget.id).limit_minor, 400_000);

  assert.throws(
    () => updateBudget(ctx, budget.id, { limit: 600_000, expectedVersion: budget.version }),
    (error: unknown) => (error as { code?: string }).code === 'version_conflict',
  );
  assert.throws(() => updateBudget(ctx, budget.id, { limit: 0 }), /lebih dari Rp0/i);

  const repeated = createBudget(ctx, { categoryId: expense.id, period, limit: 500_000 }, 'anggaran-1');
  assert.equal(repeated.id, budget.id, 'kunci idempotensi mengembalikan anggaran yang sama');
  assert.equal(listBudgets(ctx, { period }).length, 1, 'tidak ada anggaran ganda');
});

test('satu kategori hanya boleh punya satu anggaran per periode', () => {
  const { ctx, expense, period } = setup();
  createBudget(ctx, { categoryId: expense.id, period, limit: 200_000 });

  assert.throws(
    () => createBudget(ctx, { categoryId: expense.id, period, limit: 300_000 }),
    /sudah ada/i,
    'periode yang sama ditolak',
  );

  const periodeLain = addMonthsClamped(`${period}-01`, 1).slice(0, 7);
  const lain = createBudget(ctx, { categoryId: expense.id, period: periodeLain, limit: 300_000 });
  assert.equal(lain.period, periodeLain, 'periode berbeda boleh punya anggaran sendiri');
  assert.equal(lain.spent, 0, 'terpakai dihitung per periode');
  assert.equal(listBudgets(ctx, { period: periodeLain }).length, 1);
});

test('anggaran hanya untuk kategori pengeluaran', () => {
  const { ctx, income, period } = setup();
  assert.throws(
    () => createBudget(ctx, { categoryId: income.id, period, limit: 200_000 }),
    /kategori pengeluaran/i,
  );
  assert.throws(
    () => createBudget(ctx, { categoryId: income.id, period: '2026-13', limit: 200_000 }),
    /bulan anggaran/i,
  );
  assert.throws(
    () => createBudget(ctx, { categoryId: income.id, period: 'periode-ini', limit: 200_000 }),
    /format YYYY-MM/i,
  );
});

test('periode tanpa anggaran mengembalikan daftar kosong', () => {
  const { ctx, expense, period } = setup();
  createBudget(ctx, { categoryId: expense.id, period, limit: 200_000 });
  const lain = addMonthsClamped(`${period}-01`, 3).slice(0, 7);
  assert.equal(listBudgets(ctx, { period: lain }).length, 0);
  assert.equal(listBudgets(ctx).length, 1, 'tanpa parameter memakai periode berjalan');
});
