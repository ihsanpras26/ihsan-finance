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

async function setup(openingBalance = 1_000_000) {
  const ws = await makeWorkspace(await makeDb());
  const ctx = ctxOf(ws);
  const wallet = await createWallet(ctx, { name: 'Kas', type: 'cash', openingBalance, openedOn: '2026-01-01' });
  const expense = await createCategory(ctx, { name: 'Belanja harian', kind: 'expense' });
  const income = await createCategory(ctx, { name: 'Gaji', kind: 'income' });
  const today = localDateInTz(ctx.timezone);
  const period = currentPeriod(ctx.timezone);
  return { ws, ctx, wallet, expense, income, today, period };
}

test('AT11 anggaran Rp500.000; belanja Rp450.000 lalu refund Rp100.000', async () => {
  const { ctx, wallet, expense, today, period } = await setup();
  const budget = await createBudget(ctx, { categoryId: expense.id, period, limit: 500_000 });

  assert.equal(budget.spent, 0);
  assert.equal(budget.remaining, 500_000);
  assert.equal(budget.warning, 'none');
  assert.equal(budget.period, period);

  const belanja = await createTransaction(ctx, {
    type: 'expense', amount: 450_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: today,
  });

  const setelahBelanja = (await listBudgets(ctx, { period }))[0]!;
  assert.equal(setelahBelanja.spent, 450_000, 'terpakai Rp450.000');
  assert.equal(setelahBelanja.remaining, 50_000, 'tersisa Rp50.000');
  assert.equal(setelahBelanja.warning, 'near', 'peringatan 80% aktif');

  await createTransaction(ctx, {
    type: 'refund', amount: 100_000, walletId: wallet.id, refundOf: belanja.id, effectiveDate: today,
  });

  const setelahRefund = (await listBudgets(ctx, { period }))[0]!;
  assert.equal(setelahRefund.spent, 350_000, 'terpakai Rp350.000 setelah refund');
  assert.equal(setelahRefund.remaining, 150_000, 'tersisa Rp150.000');
  assert.equal(setelahRefund.ratio, 0.7);
  assert.equal(setelahRefund.warning, 'none', 'peringatan 80% tidak tetap aktif');
  assert.equal((await budgetAlerts(ctx, period)).length, 0, 'tidak ada peringatan tersisa');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('anggaran melewati batas ditandai over dan pengeluaran tetap boleh dicatat', async () => {
  const { ctx, wallet, expense, today, period } = await setup();
  await createBudget(ctx, { categoryId: expense.id, period, limit: 100_000 });

  await createTransaction(ctx, { type: 'expense', amount: 130_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: today });
  const view = (await listBudgets(ctx, { period }))[0]!;

  assert.equal(view.spent, 130_000);
  assert.equal(view.remaining, -30_000, 'sisa negatif ditampilkan apa adanya');
  assert.equal(view.warning, 'over');
  assert.match(view.warningLabel, /terlampaui/i);
  assert.equal((await getWallet(ctx, wallet.id)).balance, 870_000, 'pengeluaran tetap tercatat walau limit terlampaui');
});

test('perubahan limit langsung tercermin dan versinya naik', async () => {
  const { ctx, wallet, expense, today, period } = await setup();
  const budget = await createBudget(ctx, { categoryId: expense.id, period, limit: 500_000 }, 'anggaran-1');
  await createTransaction(ctx, { type: 'expense', amount: 450_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: today });

  const updated = await updateBudget(ctx, budget.id, { limit: 400_000, expectedVersion: budget.version });
  assert.equal(updated.limit_minor, 400_000);
  assert.equal(updated.version, 2, 'versi naik');
  assert.equal(updated.spent, 450_000, 'terpakai tidak berubah');
  assert.equal(updated.warning, 'over', 'limit baru langsung dipakai');
  assert.equal((await getBudget(ctx, budget.id)).limit_minor, 400_000);

  await assert.rejects(
    async () => updateBudget(ctx, budget.id, { limit: 600_000, expectedVersion: budget.version }),
    (error: unknown) => (error as { code?: string }).code === 'version_conflict',
  );
  await assert.rejects(async () => updateBudget(ctx, budget.id, { limit: 0 }), /lebih dari Rp0/i);

  const repeated = await createBudget(ctx, { categoryId: expense.id, period, limit: 500_000 }, 'anggaran-1');
  assert.equal(repeated.id, budget.id, 'kunci idempotensi mengembalikan anggaran yang sama');
  assert.equal((await listBudgets(ctx, { period })).length, 1, 'tidak ada anggaran ganda');
});

test('satu kategori hanya boleh punya satu anggaran per periode', async () => {
  const { ctx, expense, period } = await setup();
  await createBudget(ctx, { categoryId: expense.id, period, limit: 200_000 });

  await assert.rejects(
    async () => createBudget(ctx, { categoryId: expense.id, period, limit: 300_000 }),
    /sudah ada/i,
    'periode yang sama ditolak',
  );

  const periodeLain = addMonthsClamped(`${period}-01`, 1).slice(0, 7);
  const lain = await createBudget(ctx, { categoryId: expense.id, period: periodeLain, limit: 300_000 });
  assert.equal(lain.period, periodeLain, 'periode berbeda boleh punya anggaran sendiri');
  assert.equal(lain.spent, 0, 'terpakai dihitung per periode');
  assert.equal((await listBudgets(ctx, { period: periodeLain })).length, 1);
});

test('anggaran hanya untuk kategori pengeluaran', async () => {
  const { ctx, income, period } = await setup();
  await assert.rejects(
    async () => createBudget(ctx, { categoryId: income.id, period, limit: 200_000 }),
    /kategori pengeluaran/i,
  );
  await assert.rejects(
    async () => createBudget(ctx, { categoryId: income.id, period: '2026-13', limit: 200_000 }),
    /bulan anggaran/i,
  );
  await assert.rejects(
    async () => createBudget(ctx, { categoryId: income.id, period: 'periode-ini', limit: 200_000 }),
    /format YYYY-MM/i,
  );
});

test('periode tanpa anggaran mengembalikan daftar kosong', async () => {
  const { ctx, expense, period } = await setup();
  await createBudget(ctx, { categoryId: expense.id, period, limit: 200_000 });
  const lain = addMonthsClamped(`${period}-01`, 3).slice(0, 7);
  assert.equal((await listBudgets(ctx, { period: lain })).length, 0);
  assert.equal((await listBudgets(ctx)).length, 1, 'tanpa parameter memakai periode berjalan');
});
