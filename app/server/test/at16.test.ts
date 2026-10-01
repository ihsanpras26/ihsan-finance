// test/at16.test.ts: AT16. Koreksi transaksi memperbarui anggaran dan laporan,
// sementara jurnal lama dan pembalikannya tetap tersimpan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ctxOf, makeDb, makeWorkspace } from './helpers.ts';
import { seedDefaultCategories, listCategories } from '../src/domain/categories.ts';
import { createWallet } from '../src/domain/wallets.ts';
import { correctTransaction, createTransaction } from '../src/domain/transactions.ts';
import { createBudget, listBudgets } from '../src/domain/budgets.ts';
import { summaryReport, categoryBreakdown } from '../src/domain/reports.ts';
import { all, scalar } from '../src/db/index.ts';
import { verifyIntegrity } from '../src/domain/ledger.ts';

async function setup() {
  const workspace = await makeWorkspace(await makeDb());
  const ctx = ctxOf(workspace);
  await seedDefaultCategories(ctx);
  const wallet = await createWallet(ctx, { name: 'Bank', type: 'bank', openingBalance: '5.000.000', openedOn: '2026-01-01' }, 'at16-w1');
  const expense = (await listCategories(ctx, { kind: 'expense' })).find((row) => row.name === 'Makan dan minum')!;
  return { ctx, wallet, expense, period: '2026-04' };
}

test('AT16 koreksi memperbarui anggaran dan laporan, jurnal lama tetap ada', async () => {
  const { ctx, wallet, expense, period } = await setup();
  await createBudget(ctx, { categoryId: expense.id, period, limit: 500_000 }, 'at16-b1');

  const original = await createTransaction(ctx, {
    type: 'expense', amount: 300_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: `${period}-10`,
  }, 'at16-t1');

  const beforeBudget = (await listBudgets(ctx, { period }))[0]!;
  const beforeReport = await summaryReport(ctx, { period });
  assert.equal(beforeBudget.spent, 300_000);
  assert.equal(beforeReport.expense, 300_000, 'laporan awal memuat Rp300.000');

  // Correct Rp300.000 down to Rp120.000.
  const replacement = await correctTransaction(ctx, original.id, {
    amount: 120_000,
    reason: 'salah ketik nominal',
    expectedVersion: 1,
  });

  assert.notEqual(replacement.id, original.id, 'pengganti adalah transaksi baru');

  // Reports must reflect the correction, not the old figure.
  const afterReport = await summaryReport(ctx, { period });
  assert.equal(afterReport.expense, 120_000, 'AT16 laporan memakai nominal terkoreksi');
  assert.equal(afterReport.net, -120_000);

  const breakdown = await categoryBreakdown(ctx, afterReport.period, 'expense');
  const line = breakdown.find((row) => row.categoryId === expense.id)!;
  assert.equal(line.amount, 120_000, 'AT16 rincian kategori ikut terkoreksi');

  // Budget must reflect the correction too.
  const afterBudget = (await listBudgets(ctx, { period }))[0]!;
  assert.equal(afterBudget.spent, 120_000, 'AT16 anggaran memakai nominal terkoreksi');
  assert.equal(afterBudget.remaining, 380_000);

  // The old journal must still be there, together with its reversal.
  const oldLines = await scalar(ctx.db, `SELECT COUNT(*) FROM journal_lines WHERE transaction_id = ?`, original.id);
  assert.ok(oldLines > 0, 'AT16 jurnal lama tetap tersimpan');

  const reversal = await all<{ id: string; reversal_of: string | null }>(
    ctx.db, `SELECT id, reversal_of FROM transactions WHERE workspace_id = ? AND reversal_of = ?`, ctx.workspaceId, original.id,
  );
  assert.equal(reversal.length, 1, 'AT16 ada satu transaksi pembalikan');

  const reversalLines = await scalar(ctx.db, `SELECT COUNT(*) FROM journal_lines WHERE transaction_id = ?`, reversal[0]!.id);
  assert.ok(reversalLines > 0, 'pembalikan punya jurnal sendiri');

  const originalRow = (await all<{ status: string }>(ctx.db, `SELECT status FROM transactions WHERE id = ?`, original.id))[0]!;
  assert.equal(originalRow.status, 'reversed', 'transaksi lama ditandai dibalik, bukan dihapus');

  // Ledger stays balanced after correction.
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true, 'jurnal tetap seimbang');
});

test('AT16 koreksi berulang tetap menyeimbangkan jurnal', async () => {
  const { ctx, wallet, expense, period } = await setup();

  let current = await createTransaction(ctx, {
    type: 'expense', amount: 200_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: `${period}-05`,
  }, 'at16-t2');

  for (const [amount, version] of [[150_000, 1], [90_000, 1], [40_000, 1]] as [number, number][]) {
    current = await correctTransaction(ctx, current.id, { amount, reason: 'koreksi berantai', expectedVersion: version });
  }

  const report = await summaryReport(ctx, { period });
  assert.equal(report.expense, 40_000, 'hanya nominal terakhir yang dihitung');

  const reversed = await all<{ id: string }>(ctx.db, `SELECT id FROM transactions WHERE workspace_id = ? AND status = 'reversed'`, ctx.workspaceId);
  assert.equal(reversed.length, 3, 'tiga transaksi lama ditandai dibalik');

  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true, 'jurnal tetap seimbang setelah tiga koreksi');
});
