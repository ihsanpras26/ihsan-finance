// test/debts.test.ts: utang & piutang: AT03, AT04, AT08, AT10, AT12 (PRD §15, FR09–FR11).
// Tanggal uji dihitung relatif terhadap hari ini supaya hasilnya tidak bergantung tanggal jalan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, makeWorkspace, ctxOf } from './helpers.ts';
import { createWallet, getWallet, totalCash } from '../src/domain/wallets.ts';
import { createCategory } from '../src/domain/categories.ts';
import { createTransaction, reverseTransaction, type TxContext } from '../src/domain/transactions.ts';
import { classTotal, verifyIntegrity } from '../src/domain/ledger.ts';
import {
  cancelDebtPayment, createDebt, getDebt, listDebts, recordDebtPayment, upcomingDebts, updateDebt, writeOffDebt,
} from '../src/domain/debts.ts';
import { addDays, localDateInTz, monthBounds } from '../src/core/dates.ts';
import { one } from '../src/db/index.ts';

async function setup(openingBalance = 0) {
  const ws = await makeWorkspace(await makeDb());
  const ctx = ctxOf(ws);
  const wallet = await createWallet(ctx, { name: 'Kas', type: 'cash', openingBalance, openedOn: '2026-01-01' });
  const expense = await createCategory(ctx, { name: 'Makan dan minum', kind: 'expense' });
  const income = await createCategory(ctx, { name: 'Gaji', kind: 'income' });
  const today = localDateInTz(ctx.timezone);
  /** Tanggal `n` hari yang lalu. */
  const ago = (n: number) => addDays(today, -n);
  const monthOf = (date: string) => monthBounds(date.slice(0, 7));
  return { ws, ctx, wallet, expense, income, today, ago, monthOf };
}

async function balanceOf(ctx: TxContext, walletId: string): Promise<number> {
  return (await getWallet(ctx, walletId)).balance;
}

test('AT03 kas awal nol; terima utang Rp1.000.000 lalu bayar pokok Rp200.000 dan bunga Rp10.000', async () => {
  const { ctx, wallet, ago, monthOf } = await setup(0);
  const start = ago(20);
  const payDate = ago(5);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Budi', principal: 1_000_000,
    startDate: start, openingMode: 'cash', walletId: wallet.id,
  });

  assert.equal(await balanceOf(ctx, wallet.id), 1_000_000, 'kas naik Rp1.000.000 saat dana diterima');
  assert.equal(debt.remaining, 1_000_000, 'sisa pokok Rp1.000.000');
  assert.equal(debt.status, 'active');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', monthOf(payDate).start, monthOf(payDate).end), 0, 'menerima pinjaman bukan pendapatan');

  const paid = await recordDebtPayment(ctx, debt.id, {
    principal: 200_000, interest: 10_000, walletId: wallet.id, paymentDate: payDate, note: 'cicilan pertama',
  }, 'bayar-1');

  assert.equal(await balanceOf(ctx, wallet.id), 790_000, 'kas Rp790.000');
  assert.equal(paid.debt.remaining, 800_000, 'sisa pokok Rp800.000');
  assert.equal(paid.debt.interestPaid, 10_000, 'bunga tercatat terpisah');
  assert.equal(paid.payment.cashAmount, 210_000, 'kas keluar = pokok + bunga');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', monthOf(payDate).start, monthOf(payDate).end), 0, 'pendapatan tetap nol');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(payDate).start, monthOf(payDate).end), 10_000, 'pengeluaran hanya bunga');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);

  const repeated = await recordDebtPayment(ctx, debt.id, {
    principal: 200_000, interest: 10_000, walletId: wallet.id, paymentDate: payDate, note: 'cicilan pertama',
  }, 'bayar-1');
  assert.equal(repeated.payment.id, paid.payment.id, 'kunci idempotensi mengembalikan pembayaran yang sama');
  assert.equal(await balanceOf(ctx, wallet.id), 790_000, 'saldo tidak berubah dua kali');
});

test('AT04 kas Rp1.000.000; beri piutang Rp300.000; terima pelunasan pokok Rp100.000', async () => {
  const { ctx, wallet, ago, monthOf } = await setup(1_000_000);
  const given = ago(15);
  const collected = ago(5);
  const debt = await createDebt(ctx, {
    direction: 'receivable', counterpartyName: 'Sari', principal: 300_000,
    startDate: given, openingMode: 'cash', walletId: wallet.id,
  });

  assert.equal(await balanceOf(ctx, wallet.id), 700_000, 'kas turun Rp300.000 saat piutang diberikan');
  assert.equal(debt.remaining, 300_000, 'piutang Rp300.000');

  const result = await recordDebtPayment(ctx, debt.id, { principal: 100_000, walletId: wallet.id, paymentDate: collected });

  assert.equal(await balanceOf(ctx, wallet.id), 800_000, 'kas Rp800.000');
  assert.equal(result.debt.remaining, 200_000, 'piutang Rp200.000');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', monthOf(collected).start, monthOf(collected).end), 0, 'pelunasan pokok bukan pendapatan');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(collected).start, monthOf(collected).end), 0, 'pelunasan pokok bukan konsumsi');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('AT12 utang lama Rp2.000.000 saat onboarding tidak mengubah kas dan pendapatan', async () => {
  const { ctx, wallet, ago, monthOf } = await setup(0);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Koperasi Lama', principal: 2_000_000,
    startDate: ago(10), openingMode: 'legacy', note: 'sisa utang sebelum memakai aplikasi',
  });

  assert.equal(debt.remaining, 2_000_000, 'kewajiban bertambah Rp2.000.000');
  assert.equal(debt.opening_mode, 'legacy');
  assert.equal(await balanceOf(ctx, wallet.id), 0, 'kas tidak berubah');
  assert.equal(await totalCash(ctx), 0, 'total kas tetap nol');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', monthOf(ago(10)).start, monthOf(ago(10)).end), 0, 'pendapatan tidak berubah');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(ago(10)).start, monthOf(ago(10)).end), 0, 'tidak ada konsumsi baru');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('AT08 utang Rp200.000; dua pembayaran pokok Rp150.000; hanya satu berhasil', async () => {
  const { ctx, wallet, ago } = await setup(0);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Rina', principal: 200_000,
    startDate: ago(10), openingMode: 'cash', walletId: wallet.id,
  });

  await recordDebtPayment(ctx, debt.id, { principal: 150_000, walletId: wallet.id, paymentDate: ago(5) });
  assert.equal((await getDebt(ctx, debt.id)).remaining, 50_000, 'sisa pokok Rp50.000 setelah pembayaran pertama');
  assert.equal(await balanceOf(ctx, wallet.id), 50_000);

  await assert.rejects(
    async () => recordDebtPayment(ctx, debt.id, { principal: 150_000, walletId: wallet.id, paymentDate: ago(5) }),
    (error: unknown) => {
      const appError = error as { code?: string; message: string };
      assert.equal(appError.code, 'insufficient_principal', 'kode konflik yang bisa ditangani UI');
      assert.match(appError.message, /sisa pokok/i);
      assert.match(appError.message, /Rp50\.000/, 'pesan menyebut sisa pokok Rp50.000');
      return true;
    },
  );
  assert.equal(await balanceOf(ctx, wallet.id), 50_000, 'kas tidak berubah oleh permintaan kedua');
  assert.equal((await getDebt(ctx, debt.id)).remaining, 50_000, 'sisa pokok tidak turun di bawah nol');

  const payments = (await getDebt(ctx, debt.id)).payments;
  assert.equal(payments.length, 1, 'hanya satu pembayaran tersimpan');
});

test('AT10 batalkan pembayaran pokok Rp200.000 dan bunga Rp10.000', async () => {
  const { ctx, wallet, ago, monthOf } = await setup(0);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Joko', principal: 500_000,
    startDate: ago(20), openingMode: 'cash', walletId: wallet.id,
  });
  const payDate = ago(5);
  const paid = await recordDebtPayment(ctx, debt.id, { principal: 200_000, interest: 10_000, walletId: wallet.id, paymentDate: payDate });
  assert.equal(await balanceOf(ctx, wallet.id), 290_000);
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(payDate).start, monthOf(payDate).end), 10_000);

  await assert.rejects(
    async () => reverseTransaction(ctx, paid.payment.transaction_id, 'salah catat'),
    (error: unknown) => (error as { code?: string }).code === 'has_dependencies',
    'pembatalan lewat layar transaksi umum ditolak; harus dari layar utang',
  );

  const after = await cancelDebtPayment(ctx, debt.id, paid.payment.id, { reason: 'salah catat' }, 'batal-1');

  assert.equal(await balanceOf(ctx, wallet.id), 500_000, 'kas kembali Rp210.000');
  assert.equal(after.remaining, 500_000, 'utang naik kembali Rp200.000');
  assert.equal(after.interestPaid, 0, 'bunga yang dibatalkan tidak dihitung');
  assert.equal(after.status, 'active');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(payDate).start, monthOf(payDate).end), 0, 'bunga bersih kembali nol');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);

  const audit = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM audit_logs WHERE workspace_id = ? AND action = 'cancel_payment'`, ctx.workspaceId))!;
  assert.equal(audit.n, 1, 'jejak audit pembatalan tetap ada');

  await assert.rejects(
    async () => cancelDebtPayment(ctx, debt.id, paid.payment.id, { reason: 'ulang' }),
    /sudah dibatalkan/i,
    'pembatalan kedua ditolak',
  );
});

test('pembayaran penuh melunasi catatan', async () => {
  const { ctx, wallet, today, ago } = await setup(0);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Toko Bangunan', principal: 120_000,
    startDate: ago(15), dueDate: addDays(today, 3), openingMode: 'cash', walletId: wallet.id,
  });
  const result = await recordDebtPayment(ctx, debt.id, { principal: 120_000, walletId: wallet.id, paymentDate: today });

  assert.equal(result.debt.remaining, 0, 'sisa pokok nol');
  assert.equal(result.debt.status, 'paid', 'status menjadi lunas');
  assert.equal(result.debt.overdue, false);
});

test('pembatalan pembayaran pelunasan mengembalikan status aktif', async () => {
  const { ctx, wallet, today, ago } = await setup(100_000);
  const debt = await createDebt(ctx, {
    direction: 'receivable', counterpartyName: 'Wawan', principal: 80_000,
    startDate: ago(10), openingMode: 'cash', walletId: wallet.id,
  });
  assert.equal((await getWallet(ctx, wallet.id)).balance, 20_000, 'kas turun saat piutang diberikan');
  const paid = await recordDebtPayment(ctx, debt.id, { principal: 80_000, walletId: wallet.id, paymentDate: today });
  assert.equal(paid.debt.status, 'paid');
  assert.equal((await getWallet(ctx, wallet.id)).balance, 100_000);

  const after = await cancelDebtPayment(ctx, debt.id, paid.payment.id, { reason: 'dana belum masuk' });
  assert.equal(after.status, 'active', 'status kembali aktif');
  assert.equal(after.remaining, 80_000, 'piutang kembali Rp80.000');
  assert.equal((await getWallet(ctx, wallet.id)).balance, 20_000, 'kas kembali seperti sebelum pelunasan');
});

test('penghapusan utang adalah penyesuaian non-kas dengan alasan dan audit', async () => {
  const { ctx, wallet, today, ago, monthOf } = await setup(0);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Pemberi Pinjaman', principal: 750_000,
    startDate: ago(10), openingMode: 'cash', walletId: wallet.id,
  });
  const before = (await getWallet(ctx, wallet.id)).balance;

  await assert.rejects(
    async () => writeOffDebt(ctx, debt.id, { reason: 'x' }),
    /minimal 3 karakter/i,
    'alasan wajib diisi',
  );

  const written = await writeOffDebt(ctx, debt.id, { reason: 'dibebaskan pemberi pinjaman', effectiveDate: today }, 'hapus-1');
  assert.equal(written.status, 'written_off');
  assert.equal(written.remaining, 0, 'sisa pokok hilang dari buku besar');
  assert.equal((await getWallet(ctx, wallet.id)).balance, before, 'tidak ada kas masuk atau keluar');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', monthOf(today).start, monthOf(today).end), 0, 'penghapusan bukan pendapatan');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', monthOf(today).start, monthOf(today).end), 0, 'penghapusan bukan konsumsi');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);

  const audit = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM audit_logs WHERE workspace_id = ? AND entity_type = 'debt' AND action = 'write_off'`, ctx.workspaceId))!;
  assert.equal(audit.n, 1, 'penghapusan tercatat di audit terpisah');

  await assert.rejects(
    async () => recordDebtPayment(ctx, debt.id, { principal: 1_000, walletId: wallet.id, paymentDate: ago(1) }),
    /sudah ditutup/i,
    'catatan yang sudah dihapus tidak menerima pembayaran baru',
  );
});

test('pokok utang dan transfer tidak mengonsumsi anggaran kategori', async () => {
  const { ctx, wallet, expense, ago, monthOf } = await setup(1_000_000);
  const start = ago(8);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Bank', principal: 300_000,
    startDate: start, openingMode: 'cash', walletId: wallet.id,
  });
  await recordDebtPayment(ctx, debt.id, { principal: 300_000, walletId: wallet.id, paymentDate: ago(5) });
  await createTransaction(ctx, { type: 'expense', amount: 25_000, walletId: wallet.id, categoryId: expense.id, effectiveDate: ago(4) });

  const period = monthOf(ago(4));
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', period.start, period.end), 25_000, 'hanya belanja kategori yang masuk konsumsi');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('upcomingDebts hanya menampilkan kewajiban dengan sisa pokok dalam rentang', async () => {
  const { ctx, wallet, today } = await setup(0);
  const near = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Dekat', principal: 100_000,
    startDate: today, dueDate: addDays(today, 3), openingMode: 'cash', walletId: wallet.id,
  });
  await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Jauh', principal: 100_000,
    startDate: today, dueDate: addDays(today, 30), openingMode: 'cash', walletId: wallet.id,
  });
  const lunas = await createDebt(ctx, {
    direction: 'receivable', counterpartyName: 'Lunas', principal: 50_000,
    startDate: today, dueDate: addDays(today, 2), openingMode: 'cash', walletId: wallet.id,
  });
  await recordDebtPayment(ctx, lunas.id, { principal: 50_000, walletId: wallet.id, paymentDate: today });

  const upcoming = await upcomingDebts(ctx, 7);
  assert.equal(upcoming.length, 1, 'hanya satu kewajiban dalam 7 hari ke depan');
  assert.equal(upcoming[0]!.id, near.id);
  assert.equal(upcoming[0]!.daysToDue, 3);
  assert.equal(upcoming[0]!.overdue, false);
});

test('daftar utang bisa disaring arah dan status, dan menandai lewat jatuh tempo', async () => {
  const { ctx, wallet, today } = await setup(0);
  await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Lewat', principal: 60_000,
    startDate: addDays(today, -20), dueDate: addDays(today, -2), openingMode: 'cash', walletId: wallet.id,
  });
  await createDebt(ctx, { direction: 'receivable', counterpartyName: 'Nanti', principal: 90_000, startDate: today, openingMode: 'cash', walletId: wallet.id });

  const payables = await listDebts(ctx, { direction: 'payable' });
  assert.equal(payables.length, 1);
  assert.equal(payables[0]!.overdue, true, 'lewat jatuh tempo ditandai');
  assert.equal(payables[0]!.daysToDue, -2);
  assert.match(payables[0]!.dueLabel, /lewat jatuh tempo/i);

  const receivables = await listDebts(ctx, { direction: 'receivable' });
  assert.equal(receivables.length, 1);
  assert.equal(receivables[0]!.dueLabel, 'Belum ada jatuh tempo', 'tanpa tanggal pakai label khusus');

  assert.equal((await listDebts(ctx, { status: 'paid' })).length, 0);
});

test('ubah catatan utang memakai pemeriksaan versi', async () => {
  const { ctx, wallet, ago } = await setup(0);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Awal', principal: 10_000,
    startDate: ago(10), openingMode: 'cash', walletId: wallet.id,
  });
  const updated = await updateDebt(ctx, debt.id, {
    counterpartyName: 'Sudah Diubah', dueDate: addDays(ago(10), 30), reminderOff: true, expectedVersion: debt.version,
  });

  assert.equal(updated.counterpartyName, 'Sudah Diubah');
  assert.equal(updated.due_date, addDays(ago(10), 30));
  assert.equal(updated.reminder_off, 1, 'pengingat bisa dimatikan');
  assert.equal(updated.version, 2);

  await assert.rejects(
    async () => updateDebt(ctx, debt.id, { note: 'bentrok', expectedVersion: debt.version }),
    (error: unknown) => (error as { code?: string }).code === 'version_conflict',
  );
  await assert.rejects(
    async () => updateDebt(ctx, debt.id, { dueDate: addDays(ago(10), -1) }),
    /tidak boleh sebelum tanggal mulai/i,
  );
});

test('validasi pembuatan utang: nama pihak, pokok, dan mode awal', async () => {
  const { ctx, wallet, ago } = await setup(0);
  await assert.rejects(
    async () => createDebt(ctx, { direction: 'payable', counterpartyName: '  ', principal: 10_000, openingMode: 'cash', walletId: wallet.id }),
    /nama pihak lain wajib diisi/i,
  );
  await assert.rejects(
    async () => createDebt(ctx, { direction: 'payable', counterpartyName: 'Budi', principal: 0, openingMode: 'cash', walletId: wallet.id }),
    /lebih dari Rp0/i,
  );
  await assert.rejects(
    async () => createDebt(ctx, { direction: 'payable', counterpartyName: 'Budi', principal: 10_000, openingMode: 'cash' }),
    /dompet wajib dipilih/i,
  );
  await assert.rejects(
    async () => createDebt(ctx, { direction: 'payable', counterpartyName: 'Budi', principal: 10_000, openingMode: 'salah' }),
    /dana diterima atau diberikan sekarang/i,
  );
  await assert.rejects(
    async () => createDebt(ctx, { direction: 'payable', counterpartyName: 'Budi', principal: 10_000, openingMode: 'cash', walletId: wallet.id, dueDate: ago(30), startDate: ago(10) }),
    /tidak boleh sebelum tanggal mulai/i,
  );
});

test('satu pihak dipakai ulang, bukan digandakan di tabel counterparties', async () => {
  const { ctx, wallet, ago } = await setup(0);
  await createDebt(ctx, { direction: 'payable', counterpartyName: 'Sama', principal: 10_000, startDate: ago(9), openingMode: 'cash', walletId: wallet.id });
  await createDebt(ctx, { direction: 'receivable', counterpartyName: 'Sama', principal: 20_000, startDate: ago(8), openingMode: 'cash', walletId: wallet.id });
  const count = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM counterparties WHERE workspace_id = ?`, ctx.workspaceId))!;
  assert.equal(count.n, 1);
});
