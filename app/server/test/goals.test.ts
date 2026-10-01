// test/goals.test.ts: tujuan keuangan: AT05, AT06, AT17 (PRD §15, FR13–FR14, §07).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, makeWorkspace, ctxOf } from './helpers.ts';
import { createWallet, getWallet } from '../src/domain/wallets.ts';
import { createCategory } from '../src/domain/categories.ts';
import { createTransaction } from '../src/domain/transactions.ts';
import { classTotal, verifyIntegrity } from '../src/domain/ledger.ts';
import {
  allocateGoal, archiveGoal, createGoal, getGoal, listGoals, releaseGoal, spendFromGoal, updateGoal,
} from '../src/domain/goals.ts';
import { addDays, addMonthsClamped, localDateInTz, monthBounds } from '../src/core/dates.ts';

async function setup(openingBalance = 0) {
  const ws = await makeWorkspace(await makeDb());
  const ctx = ctxOf(ws);
  const wallet = await createWallet(ctx, { name: 'Kas', type: 'cash', openingBalance, openedOn: '2026-01-01' });
  const expense = await createCategory(ctx, { name: 'Belanja harian', kind: 'expense' });
  const today = localDateInTz(ctx.timezone);
  const ago = (n: number) => addDays(today, -n);
  const monthOf = (date: string) => monthBounds(date.slice(0, 7));
  return { ws, ctx, wallet, expense, today, ago, monthOf };
}

test('AT05 dompet Rp1.000.000; alokasi Rp400.000 ke goal Rp1.000.000', async () => {
  const { ctx, wallet, ago, monthOf } = await setup(1_000_000);
  const goal = await createGoal(ctx, { name: 'Dana darurat', target: 1_000_000, priority: 1 });
  const allocated = await allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 400_000, effectiveDate: ago(3), note: 'sisihkan dari kas' }, 'alok-1');

  assert.equal((await getWallet(ctx, wallet.id)).balance, 1_000_000, 'saldo tetap Rp1.000.000');
  assert.equal(allocated.goal.allocated, 400_000, 'alokasi Rp400.000');
  assert.equal(allocated.goal.progress, 0.4, 'progres 40%');
  assert.equal(allocated.goal.progressDisplay, 0.4);
  assert.equal(allocated.goal.shortfall, 600_000, 'dana belum dialokasikan Rp600.000');
  assert.equal(allocated.transferId, null, 'alokasi biasa tidak menggerakkan uang');
  assert.equal(allocated.goal.insufficient, false, 'dana masih tertutup saldo');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(ago(3)).start, monthOf(ago(3)).end), 0, 'alokasi bukan pengeluaran');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', monthOf(ago(3)).start, monthOf(ago(3)).end), 0, 'alokasi bukan pendapatan');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('AT06 belanja dari goal Rp100.000 mengurangi alokasi dan mencatat pengeluaran', async () => {
  const { ctx, wallet, expense, ago, monthOf } = await setup(1_000_000);
  const goal = await createGoal(ctx, { name: 'Dana darurat', target: 1_000_000 });
  await allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 400_000, effectiveDate: ago(3) }, 'alok-1');
  const spentOn = ago(1);

  const spend = await spendFromGoal(ctx, goal.id, {
    walletId: wallet.id, categoryId: expense.id, amount: 100_000, effectiveDate: spentOn, note: 'perbaikan atap',
  }, 'belanja-1');

  assert.equal((await getWallet(ctx, wallet.id)).balance, 900_000, 'saldo Rp900.000');
  assert.equal(spend.goal.allocated, 300_000, 'alokasi Rp300.000');
  assert.equal(spend.goal.progress, 0.3, 'progres 30%');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(spentOn).start, monthOf(spentOn).end), 100_000, 'pengeluaran bertambah Rp100.000');
  assert.equal(spend.goal.insufficient, false, 'dana masih tertutup saldo');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);

  const repeated = await spendFromGoal(ctx, goal.id, {
    walletId: wallet.id, categoryId: expense.id, amount: 100_000, effectiveDate: spentOn, note: 'perbaikan atap',
  }, 'belanja-1');
  assert.equal(repeated.transactionId, spend.transactionId, 'kunci idempotensi mengembalikan transaksi yang sama');
  assert.equal((await getWallet(ctx, wallet.id)).balance, 900_000, 'saldo tidak berubah dua kali');
});

test('AT17 alokasi Rp400.000 dengan saldo turun menjadi Rp300.000 memunculkan kekurangan Rp100.000', async () => {
  const { ctx, wallet, expense, ago, monthOf } = await setup(1_000_000);
  const goal = await createGoal(ctx, { name: 'Liburan', target: 1_000_000 });
  await allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 400_000, effectiveDate: ago(5) }, 'alok-1');

  // Pengeluaran nyata tetap boleh dicatat walau membuat dana tujuan kurang (PRD §07).
  const belanja = await createTransaction(ctx, {
    type: 'expense', amount: 700_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: ago(2),
  });
  assert.equal((await getWallet(ctx, wallet.id)).balance, 300_000, 'saldo turun menjadi Rp300.000');

  const view = await getGoal(ctx, goal.id);
  assert.equal(view.allocated, 400_000, 'alokasi tetap tercatat apa adanya');
  assert.equal(view.progress, 0.4, 'progres memakai alokasi tercatat');
  assert.equal(view.fundingShortfall, 100_000, 'kekurangan Rp100.000 terlihat dari data');
  assert.equal(view.insufficient, true, 'status "Dana tujuan kurang"');
  assert.equal(view.funding[0]!.walletBalance, 300_000);
  assert.equal(view.funding[0]!.shortfall, 100_000);
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(ago(2)).start, monthOf(ago(2)).end), 700_000, 'pencatatan pengeluaran nyata tetap berhasil');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
  assert.ok(belanja.id);
});

test('alokasi melebihi saldo positif dompet ditolak', async () => {
  const { ctx, wallet, ago } = await setup(300_000);
  const goal = await createGoal(ctx, { name: 'Motor', target: 5_000_000 });

  await assert.rejects(
    async () => allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 400_000, effectiveDate: ago(1) }),
    (error: unknown) => {
      const appError = error as { code?: string; message: string };
      assert.equal(appError.code, 'allocation_exceeds');
      assert.match(appError.message, /Rp300\.000/, 'pesan menyebut dana yang tersedia');
      return true;
    },
  );
  assert.equal((await getGoal(ctx, goal.id)).allocated, 0, 'tidak ada alokasi tersimpan');
  assert.equal((await getWallet(ctx, wallet.id)).balance, 300_000, 'saldo tidak berubah');
});

test('dana yang sama tidak bisa dialokasikan ke dua tujuan sekaligus', async () => {
  const { ctx, wallet, ago } = await setup(500_000);
  const pertama = await createGoal(ctx, { name: 'Tujuan A', target: 1_000_000 });
  const kedua = await createGoal(ctx, { name: 'Tujuan B', target: 1_000_000 });
  await allocateGoal(ctx, pertama.id, { walletId: wallet.id, amount: 400_000, effectiveDate: ago(2) });

  await assert.rejects(
    async () => allocateGoal(ctx, kedua.id, { walletId: wallet.id, amount: 200_000, effectiveDate: ago(1) }),
    (error: unknown) => {
      const appError = error as { code?: string; message: string };
      assert.equal(appError.code, 'allocation_exceeds', 'diperiksa per dompet, bukan hanya per tujuan');
      assert.match(appError.message, /Rp100\.000/, 'sisa dana bebas Rp100.000');
      return true;
    },
  );
  assert.equal((await getGoal(ctx, kedua.id)).allocated, 0);

  // Sisa yang masih bebas tetap boleh dialokasikan.
  const sisa = await allocateGoal(ctx, kedua.id, { walletId: wallet.id, amount: 100_000, effectiveDate: ago(1) });
  assert.equal(sisa.goal.allocated, 100_000);
});

test('pelepasan alokasi hanya melepaskan dana, bukan pendapatan', async () => {
  const { ctx, wallet, ago, monthOf } = await setup(1_000_000);
  const goal = await createGoal(ctx, { name: 'Sepeda', target: 2_000_000 });
  await allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 400_000, effectiveDate: ago(4) });

  const released = await releaseGoal(ctx, goal.id, { walletId: wallet.id, amount: 150_000, effectiveDate: ago(1), note: 'dipakai mendesak' });
  assert.equal(released.goal.allocated, 250_000, 'alokasi aktif menjadi Rp250.000');
  assert.equal((await getWallet(ctx, wallet.id)).balance, 1_000_000, 'saldo dompet tidak berubah');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', monthOf(ago(1)).start, monthOf(ago(1)).end), 0, 'pelepasan bukan pendapatan');

  await assert.rejects(
    async () => releaseGoal(ctx, goal.id, { walletId: wallet.id, amount: 300_000 }),
    (error: unknown) => (error as { code?: string }).code === 'allocation_exceeds',
    'pelepasan tidak boleh melebihi alokasi aktif tujuan itu',
  );
});

test('moveMoney memindahkan uang lebih dulu lalu mencatat alokasi', async () => {
  const { ctx, wallet, ago } = await setup(500_000);
  const ewallet = await createWallet(ctx, { name: 'E-wallet', type: 'ewallet', openingBalance: 0, openedOn: '2026-01-01' });
  const goal = await createGoal(ctx, { name: 'Dana pendidikan', target: 1_000_000 });

  const moved = await allocateGoal(ctx, goal.id, {
    walletId: wallet.id, toWalletId: ewallet.id, amount: 150_000, moveMoney: true, effectiveDate: ago(1),
  });

  assert.ok(moved.transferId, 'ada transfer nyata');
  assert.equal((await getWallet(ctx, wallet.id)).balance, 350_000, 'dompet asal berkurang');
  assert.equal((await getWallet(ctx, ewallet.id)).balance, 150_000, 'dompet tujuan bertambah');
  assert.equal(moved.goal.allocated, 150_000, 'alokasi tercatat di dompet tujuan');
  assert.equal(moved.allocation.wallet_id, ewallet.id);
  assert.equal(moved.allocation.linked_tx_id, moved.transferId, 'alokasi menunjuk transaksi transfer');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('arsip dengan alokasi tersisa harus dilepas lebih dulu', async () => {
  const { ctx, wallet, ago } = await setup(1_000_000);
  const goal = await createGoal(ctx, { name: 'Kursus', target: 1_000_000 });
  await allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 200_000, effectiveDate: ago(2) });

  await assert.rejects(
    async () => archiveGoal(ctx, goal.id, { resolution: 'keep' }),
    (error: unknown) => {
      const appError = error as { code?: string; message: string };
      assert.equal(appError.code, 'validation_failed');
      assert.match(appError.message, /lepaskan atau pindahkan/i);
      return true;
    },
  );
  await assert.rejects(
    async () => updateGoal(ctx, goal.id, { status: 'archived' }),
    /lepaskan atau pindahkan/i,
    'ubah status lewat update juga ditahan',
  );

  const archived = await archiveGoal(ctx, goal.id, { resolution: 'release', reason: 'tujuan dibatalkan' });
  assert.equal(archived.status, 'archived');
  assert.equal(archived.allocated, 0, 'alokasi dilepas saat pengarsipan');
  assert.equal((await listGoals(ctx)).length, 0, 'tujuan terarsip tidak tampil di daftar aktif');
  assert.equal((await listGoals(ctx, { includeArchived: true })).length, 1);
});

test('rencana setoran bulanan dibagi sisa bulan, dan tanggal lewat tidak membagi nol', async () => {
  const { ctx, wallet, today, ago } = await setup(1_000_000);
  const targetDate = addMonthsClamped(today, 6);
  const goal = await createGoal(ctx, { name: 'Uang muka rumah', target: 1_000_000, targetDate });
  await allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 400_000, effectiveDate: ago(1) });

  const view = await getGoal(ctx, goal.id);
  assert.equal(view.monthsRemaining, 6);
  assert.equal(view.monthlyPlan, 100_000, 'kekurangan Rp600.000 dibagi 6 bulan');

  const lewat = await createGoal(ctx, { name: 'Sudah lewat', target: 500_000, targetDate: addDays(today, -30) });
  const lewatView = await getGoal(ctx, lewat.id);
  assert.equal(lewatView.monthlyPlan, null, 'tanggal target lewat: UI menawarkan ubah rencana');
  assert.ok(lewatView.monthsRemaining === null || lewatView.monthsRemaining <= 0, 'tidak ada pembagian nol');

  const tanpaTanggal = await createGoal(ctx, { name: 'Tanpa tanggal', target: 500_000 });
  assert.equal((await getGoal(ctx, tanpaTanggal.id)).monthlyPlan, null, 'tanpa tanggal target tidak ada proyeksi');
});

test('progres melewati target tetap dikirim apa adanya dan menandai tercapai', async () => {
  const { ctx, wallet, ago } = await setup(1_000_000);
  const goal = await createGoal(ctx, { name: 'Kado', target: 100_000 });
  const result = await allocateGoal(ctx, goal.id, { walletId: wallet.id, amount: 150_000, effectiveDate: ago(1) });

  assert.equal(result.goal.allocated, 150_000);
  assert.equal(result.goal.progress, 1.5, 'nilai asli tetap dikirim');
  assert.equal(result.goal.progressDisplay, 1, 'tampilan dibatasi 100%');
  assert.equal(result.goal.shortfall, 0, 'kekurangan tidak pernah negatif');
  assert.equal(result.goal.reachedTarget, true, 'tanda tercapai, penyelesaian tetap aksi pengguna');

  const achieved = await updateGoal(ctx, goal.id, { status: 'achieved', expectedVersion: result.goal.version });
  assert.equal(achieved.status, 'achieved');
  await assert.rejects(
    async () => updateGoal(ctx, goal.id, { name: 'Bentrok', expectedVersion: result.goal.version }),
    (error: unknown) => (error as { code?: string }).code === 'version_conflict',
  );
});

test('validasi tujuan: nama wajib, target harus lebih dari nol', async () => {
  const { ctx } = await setup();
  await assert.rejects(async () => createGoal(ctx, { name: '   ', target: 100_000 }), /nama tujuan wajib diisi/i);
  await assert.rejects(async () => createGoal(ctx, { name: 'Nol', target: 0 }), /lebih dari Rp0/i);
  await assert.rejects(async () => createGoal(ctx, { name: 'Pecahan', target: '1000.5' }), /angka bulat rupiah/i);
});
