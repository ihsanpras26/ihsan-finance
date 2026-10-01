// test/recurring.test.ts: rencana berulang AT15 dan pengingat jatuh tempo (PRD §15, FR11, FR17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, makeWorkspace, ctxOf } from './helpers.ts';
import { createWallet, getWallet } from '../src/domain/wallets.ts';
import { createCategory } from '../src/domain/categories.ts';
import { createDebt, recordDebtPayment, updateDebt } from '../src/domain/debts.ts';
import { verifyIntegrity } from '../src/domain/ledger.ts';
import {
  confirmOccurrence, createRule, ensureOccurrences, getRule, listOccurrences, listRules, setRuleStatus,
  skipOccurrence, updateRule,
} from '../src/domain/recurring.ts';
import {
  ensureDueNotifications, listNotifications, markAllRead, markRead, unreadCount,
} from '../src/domain/notifications.ts';
import { runScheduler } from '../src/workers/scheduler.ts';
import { addDays, formatDateID, localDateInTz } from '../src/core/dates.ts';
import { one } from '../src/db/index.ts';

async function setup(openingBalance = 1_000_000) {
  const ws = await makeWorkspace(await makeDb());
  const ctx = ctxOf(ws);
  const wallet = await createWallet(ctx, { name: 'Kas', type: 'cash', openingBalance, openedOn: '2026-01-01' });
  const expense = await createCategory(ctx, { name: 'Tagihan', kind: 'expense' });
  const income = await createCategory(ctx, { name: 'Gaji', kind: 'income' });
  const today = localDateInTz(ctx.timezone);
  return { ws, ctx, wallet, expense, income, today };
}

test('AT15 pengingat tanggal 31 menghasilkan akhir Februari lalu kembali ke 31 Maret', async () => {
  const { ctx, wallet, expense } = await setup();
  const rule = await createRule(ctx, {
    type: 'expense', frequency: 'monthly', anchorDay: 31, startOn: '2026-01-31',
    amount: 150_000, walletId: wallet.id, categoryId: expense.id, label: 'Tagihan internet',
  });

  assert.equal(rule.next_on, '2026-01-31');
  assert.equal(rule.mode, 'reminder', 'P0 memakai mode pengingat');
  assert.equal(rule.status, 'active');

  await ensureOccurrences(ctx, '2026-01-31');
  assert.equal((await getRule(ctx, rule.id)).next_on, '2026-02-28', 'tanggal 31 jatuh pada hari terakhir Februari');

  await ensureOccurrences(ctx, '2026-02-28');
  assert.equal((await getRule(ctx, rule.id)).next_on, '2026-03-31', 'tanggal acuan tidak bergeser ke 28');

  await ensureOccurrences(ctx, '2026-03-31');
  assert.equal((await getRule(ctx, rule.id)).next_on, '2026-04-30', 'April juga memakai hari terakhir');

  const jadwal = (await listOccurrences(ctx, { ruleId: rule.id })).map((occurrence) => occurrence.scheduled_date);
  assert.deepEqual(jadwal, ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.match(jadwal[1]!, /^2026-02-(28|29)$/, 'Februari memakai hari terakhir bulan itu (2026 bukan tahun kabisat)');

  assert.equal((await ensureOccurrences(ctx, '2026-03-31')).created, 0, 'pemanggilan ulang idempoten');
  assert.equal((await listOccurrences(ctx, { ruleId: rule.id })).length, 3);
});

test('konfirmasi kejadian membuat tepat satu transaksi dan menyimpan tautannya', async () => {
  const { ctx, wallet, expense, today } = await setup();
  const rule = await createRule(ctx, {
    type: 'expense', frequency: 'monthly', startOn: addDays(today, -10),
    amount: 120_000, walletId: wallet.id, categoryId: expense.id, label: 'Langganan',
  });
  await ensureOccurrences(ctx, today);
  const pending = await listOccurrences(ctx, { status: 'pending' });
  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.label, 'Langganan', 'label dari template');
  assert.equal(pending[0]!.amount, 120_000, 'nominal dari template');

  const before = (await getWallet(ctx, wallet.id)).balance;
  const confirmed = await confirmOccurrence(ctx, pending[0]!.id, {}, 'konfirmasi-1');

  assert.equal(confirmed.transaction.amount_minor, 120_000);
  assert.equal(confirmed.transaction.status, 'posted');
  assert.equal(confirmed.occurrence.status, 'confirmed');
  assert.equal(confirmed.occurrence.transaction_id, confirmed.transaction.id);
  assert.equal((await getWallet(ctx, wallet.id)).balance, before - 120_000, 'saldo berubah satu kali');

  const ulang = await confirmOccurrence(ctx, pending[0]!.id, {}, 'konfirmasi-1');
  assert.equal(ulang.transaction.id, confirmed.transaction.id, 'kunci idempotensi mengembalikan transaksi yang sama');
  const ulangTanpaKunci = await confirmOccurrence(ctx, pending[0]!.id, {});
  assert.equal(ulangTanpaKunci.transaction.id, confirmed.transaction.id, 'kejadian yang sudah dikonfirmasi tidak membukukan transaksi kedua');
  assert.equal((await getWallet(ctx, wallet.id)).balance, before - 120_000, 'saldo tidak berubah dua kali');

  const jumlah = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM transactions WHERE workspace_id = ? AND type = 'expense'`, ctx.workspaceId))!;
  assert.equal(jumlah.n, 1, 'hanya satu transaksi pengeluaran');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
  assert.ok(rule.id);
});

test('konfirmasi dengan penyesuaian memakai nilai dan dompet yang dipilih pengguna', async () => {
  const { ctx, wallet, expense, today } = await setup();
  const lain = await createWallet(ctx, { name: 'Bank', type: 'bank', openingBalance: 500_000, openedOn: '2026-01-01' });
  await createRule(ctx, {
    type: 'expense', frequency: 'weekly', startOn: addDays(today, -3),
    amount: 50_000, walletId: wallet.id, categoryId: expense.id, label: 'Mingguan',
  });
  await ensureOccurrences(ctx, today);
  const pending = (await listOccurrences(ctx, { status: 'pending' }))[0]!;

  const confirmed = await confirmOccurrence(ctx, pending.id, { amount: 75_000, walletId: lain.id, note: 'naik bulan ini' });
  assert.equal(confirmed.transaction.amount_minor, 75_000, 'nominal penyesuaian dipakai');
  assert.equal((await getWallet(ctx, lain.id)).balance, 425_000, 'dompet penyesuaian dipakai');
  assert.equal((await getWallet(ctx, wallet.id)).balance, 1_000_000, 'dompet template tidak tersentuh');
});

test('melewati satu kejadian tidak menghapus aturan pengulangan', async () => {
  const { ctx, wallet, expense, today } = await setup();
  const rule = await createRule(ctx, {
    type: 'expense', frequency: 'daily', startOn: addDays(today, -3),
    amount: 20_000, walletId: wallet.id, categoryId: expense.id, label: 'Kopi harian',
  });
  await ensureOccurrences(ctx, today);
  const semua = await listOccurrences(ctx, { ruleId: rule.id });
  assert.equal(semua.length, 4, 'empat kejadian tertinggal dibuat');

  assert.equal((await skipOccurrence(ctx, semua[0]!.id)).status, 'skipped');
  assert.equal((await skipOccurrence(ctx, semua[0]!.id)).status, 'skipped', 'melewati ulang aman');

  const aturan = await getRule(ctx, rule.id);
  assert.equal(aturan.status, 'active', 'aturan tetap aktif');
  assert.equal((await listRules(ctx)).length, 1, 'aturan tidak dihapus');
  assert.equal((await listOccurrences(ctx, { status: 'pending' })).length, 3, 'kejadian lain tetap menunggu');

  // Kejadian berikutnya masih bisa dikonfirmasi setelah yang lain dilewati.
  const lanjut = (await listOccurrences(ctx, { status: 'pending' }))[0]!;
  assert.equal((await confirmOccurrence(ctx, lanjut.id, {})).occurrence.status, 'confirmed');
  assert.equal((await listRules(ctx))[0]!.status, 'active', 'melewati kejadian tidak menghentikan aturan');
});

test('kejadian yang sudah dikonfirmasi tidak bisa dilewati, aturan berhenti menolak konfirmasi', async () => {
  const { ctx, wallet, expense, today } = await setup();
  const rule = await createRule(ctx, {
    type: 'expense', frequency: 'monthly', startOn: addDays(today, -5),
    amount: 30_000, walletId: wallet.id, categoryId: expense.id, label: 'Donasi',
  });
  await ensureOccurrences(ctx, today);
  const pending = (await listOccurrences(ctx, { status: 'pending' }))[0]!;
  const confirmed = await confirmOccurrence(ctx, pending.id, {});

  await assert.rejects(
    async () => skipOccurrence(ctx, pending.id),
    (error: unknown) => (error as { code?: string }).code === 'has_dependencies',
    'kejadian yang sudah menjadi transaksi tidak bisa dilewati',
  );

  const rule2 = await createRule(ctx, {
    type: 'expense', frequency: 'monthly', startOn: addDays(today, -5),
    amount: 40_000, walletId: wallet.id, categoryId: expense.id, label: 'Lain',
  });
  await ensureOccurrences(ctx, today);
  const pending2 = (await listOccurrences(ctx, { status: 'pending', ruleId: rule2.id }))[0]!;
  await setRuleStatus(ctx, rule2.id, 'stop');

  await assert.rejects(
    async () => confirmOccurrence(ctx, pending2.id, {}),
    (error: unknown) => (error as { code?: string }).code === 'rule_inactive',
    'aturan yang dihentikan tidak membukukan transaksi',
  );
  assert.ok(confirmed.transaction.id);
  assert.equal((await setRuleStatus(ctx, rule.id, 'stop')).status, 'stopped');
});

test('jeda menahan kejadian baru, lanjut menggeser jadwal tanpa membanjiri pengingat lama', async () => {
  const { ctx, wallet, income, today } = await setup();
  const rule = await createRule(ctx, {
    type: 'income', frequency: 'monthly', startOn: '2026-01-05', anchorDay: 5,
    amount: 500_000, walletId: wallet.id, categoryId: income.id, label: 'Gaji bulanan',
  });
  const dijeda = await setRuleStatus(ctx, rule.id, 'pause');
  assert.equal(dijeda.status, 'paused');
  assert.equal((await ensureOccurrences(ctx, today)).created, 0, 'aturan yang dijeda tidak membuat kejadian');

  const dilanjutkan = await setRuleStatus(ctx, rule.id, 'resume');
  assert.equal(dilanjutkan.status, 'active');
  assert.ok(dilanjutkan.next_on >= today, `jadwal berikutnya digeser ke masa depan (${dilanjutkan.next_on})`);

  const diubah = await updateRule(ctx, rule.id, { amount: 600_000, frequency: 'weekly', label: 'Gaji mingguan' });
  assert.equal(diubah.template.amount, 600_000);
  assert.equal(diubah.frequency, 'weekly');
  assert.equal(diubah.template.label, 'Gaji mingguan');
  assert.equal(diubah.version, 4, 'versi naik setiap perubahan (buat, jeda, lanjut, ubah)');
  assert.ok(diubah.next_on >= today);

  await assert.rejects(
    async () => updateRule(ctx, rule.id, { amount: 700_000, expectedVersion: 1 }),
    (error: unknown) => (error as { code?: string }).code === 'version_conflict',
  );
  await assert.rejects(
    async () => createRule(ctx, { type: 'transfer', frequency: 'monthly', amount: 10_000, walletId: wallet.id, toWalletId: wallet.id }),
    /harus berbeda/i,
  );
  await assert.rejects(
    async () => createRule(ctx, { type: 'expense', frequency: 'harian', amount: 10_000, walletId: wallet.id, categoryId: income.id }),
    /pengulangan harus/i,
  );
});

test('pengingat H−7, H−1, dan H−0 muncul sekali saja', async () => {
  const { ctx, wallet, today } = await setup();
  const due = addDays(today, 7);
  const debt = await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Andi', principal: 500_000,
    startDate: addDays(today, -10), dueDate: due, openingMode: 'cash', walletId: wallet.id,
  });

  const pertama = await ensureDueNotifications(ctx, today);
  assert.equal(pertama.created, 1, 'pengingat H−7 dibuat');
  assert.equal((await ensureDueNotifications(ctx, today)).created, 0, 'satu kejadian tidak menghasilkan notifikasi ganda');

  assert.equal((await ensureDueNotifications(ctx, addDays(today, 6))).created, 1, 'pengingat H−1 dibuat');
  assert.equal((await ensureDueNotifications(ctx, due)).created, 1, 'pengingat H−0 dibuat');

  const semua = await listNotifications(ctx);
  assert.equal(semua.length, 3, 'tepat tiga pengingat');
  const kunci = semua.map((notifikasi) => notifikasi.dedupe_key).sort();
  assert.deepEqual(kunci, [
    `debt:${debt.id}:h0:${due}`,
    `debt:${debt.id}:h1:${due}`,
    `debt:${debt.id}:h7:${due}`,
  ]);
  assert.equal(new Set(kunci).size, 3, 'kunci deduplikasi unik');
  assert.match(semua[0]!.body, /Rp500\.000/, 'nominal sisa pokok muncul di badan pengingat');
  assert.equal(await unreadCount(ctx), 3);

  await recordDebtPayment(ctx, debt.id, { principal: 500_000, walletId: wallet.id, paymentDate: today });
  assert.equal((await ensureDueNotifications(ctx, due)).created, 0, 'pembayaran lunas menghentikan pengingat');

  assert.equal((await markRead(ctx, semua[0]!.id)).status, 'read');
  assert.equal(await unreadCount(ctx), 2);
  assert.equal((await markAllRead(ctx)).updated, 2, 'tandai semua dibaca');
  assert.equal(await unreadCount(ctx), 0);
  assert.equal((await markAllRead(ctx)).updated, 0);
});

test('pengingat yang dibuat terlambat menyebut sisa hari sebenarnya, bukan nama slotnya', async () => {
  const { ctx, wallet, today } = await setup();
  const due = addDays(today, 3);
  await createDebt(ctx, {
    direction: 'receivable', counterpartyName: 'Rani', principal: 250_000,
    startDate: today, dueDate: due, openingMode: 'cash', walletId: wallet.id,
  });

  assert.equal((await ensureDueNotifications(ctx, today)).created, 1, 'slot H−7 dibuat karena jatuh tempo sudah dekat');

  const [pengingat] = await listNotifications(ctx);
  assert.equal(pengingat!.title, 'Jatuh tempo 3 hari lagi: piutang Rani', 'judul mengikuti sisa hari nyata');
  assert.equal(pengingat!.daysUntil, 3, 'sisa hari dihitung untuk hari ini');
  assert.equal(
    pengingat!.body,
    `Piutang kepada Rani sebesar Rp250.000 jatuh tempo ${formatDateID(due)}. Tagih sebelum jatuh tempo.`,
    'badan pengingat memakai tanggal yang dibaca orang, bukan tanggal mesin',
  );
  assert.doesNotMatch(pengingat!.body, /\d{4}-\d{2}-\d{2}/, 'tidak ada tanggal ISO di teks pengguna');

  const tepatWaktu = addDays(today, 7);
  await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Bayu', principal: 100_000,
    startDate: today, dueDate: tepatWaktu, openingMode: 'cash', walletId: wallet.id,
  });
  assert.equal((await ensureDueNotifications(ctx, today)).created, 1, 'slot H−7 tepat waktu');
  const bayu = (await listNotifications(ctx)).find((item) => item.title.includes('Bayu'));
  assert.equal(bayu!.title, 'Jatuh tempo 7 hari lagi: utang Bayu', 'slot tepat waktu tetap menyebut tujuh hari');
});

test('pengingat dilewati bila jatuh tempo masih jauh atau pengingat dimatikan', async () => {
  const { ctx, wallet, today } = await setup();
  await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Jauh', principal: 100_000,
    startDate: today, dueDate: addDays(today, 30), openingMode: 'cash', walletId: wallet.id,
  });
  const mati = await createDebt(ctx, {
    direction: 'receivable', counterpartyName: 'Dimatikan', principal: 100_000,
    startDate: today, dueDate: addDays(today, 2), openingMode: 'cash', walletId: wallet.id,
  });
  await updateDebt(ctx, mati.id, { reminderOff: true });

  assert.equal((await ensureDueNotifications(ctx, today)).created, 0, 'tidak ada pengingat yang memenuhi syarat');
  assert.equal((await listNotifications(ctx)).length, 0);

  await updateDebt(ctx, mati.id, { reminderOff: false });
  assert.equal((await ensureDueNotifications(ctx, today)).created, 1, 'pengingat menyala lagi setelah dinyalakan');
});

test('scheduler menyiapkan kejadian dan pengingat sekaligus', async () => {
  const { ctx, wallet, expense, today } = await setup();
  await createRule(ctx, {
    type: 'expense', frequency: 'monthly', startOn: addDays(today, -2),
    amount: 60_000, walletId: wallet.id, categoryId: expense.id, label: 'Listrik',
  });
  await createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Tetangga', principal: 200_000,
    startDate: addDays(today, -5), dueDate: addDays(today, 7), openingMode: 'cash', walletId: wallet.id,
  });

  const ringkasan = await runScheduler(ctx, { today });
  assert.equal(ringkasan.occurrencesCreated, 1);
  assert.equal(ringkasan.notificationsCreated, 1);
  assert.equal(ringkasan.workspacesProcessed, 1);
  assert.equal(ringkasan.today, today);

  const ulang = await runScheduler(ctx, { today });
  assert.equal(ulang.occurrencesCreated, 0, 'scheduler idempoten');
  assert.equal(ulang.notificationsCreated, 0);

  const semuaRuang = await runScheduler(ctx.db, { today });
  assert.equal(semuaRuang.workspacesProcessed, 1, 'bisa dijalankan untuk seluruh ruang dari bootstrap');
});
