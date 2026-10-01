// tools/seed.ts: contoh data untuk jalan lokal dan uji klik di peramban.
// Pemakaian: node server/src/tools/seed.ts
import { config } from '../config.ts';
import { migrate, openDatabase, one, type Db } from '../db/index.ts';
import { registerUser } from '../domain/auth.ts';
import { seedDefaultCategories, listCategories } from '../domain/categories.ts';
import { createWallet, listWallets } from '../domain/wallets.ts';
import { contextFor } from '../domain/workspaces.ts';
import { createTransaction } from '../domain/transactions.ts';
import { createDebt, recordDebtPayment } from '../domain/debts.ts';
import { createGoal, allocateGoal } from '../domain/goals.ts';
import { createBudget } from '../domain/budgets.ts';
import { createRule, ensureOccurrences } from '../domain/recurring.ts';
import { localDateInTz, addDays } from '../core/dates.ts';

const DEMO_EMAIL = 'demo@ihsan.test';
const DEMO_PASSWORD = 'demo-ihsan-2026';

function today(): string {
  return localDateInTz('Asia/Jakarta');
}

/** Tenggat di bulan `at`: boleh jatuh di masa depan. */
export function dayOfThisMonth(at: string, day: number): string {
  return `${at.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/**
 * Tanggal tercatat di bulan `at`, dijepit ke `at` sendiri. Peristiwa yang sudah dibukukan tidak
 * boleh bertanggal masa depan (pembayaran utang ditolak `validation_failed`), dan larangan itu
 * membuat seed gagal separuh jalan saat dijalankan sebelum tanggal 19: contoh data harus bisa
 * dibuat kapan pun, jadi hari yang belum tiba jatuh ke hari ini.
 */
export function bookedThisMonth(at: string, day: number): string {
  const dayNow = Number(at.slice(8, 10));
  return `${at.slice(0, 8)}${String(Math.min(day, dayNow)).padStart(2, '0')}`;
}

/**
 * Mengisi satu basis data kosong dengan contoh data. `at` adalah tanggal "hari ini" milik
 * pemanggil, supaya perilaku pada awal bulan bisa diuji tanpa menunggu awal bulan tiba.
 */
export function seedDemo(db: Db, at: string = today()): { wallets: number; total: number } {

  const registered = registerUser(db, {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    displayName: 'Manuel',
    timezone: 'Asia/Jakarta',
    workspaceName: 'Keuangan Keluarga',
  });
  const ctx = contextFor(db, { userId: registered.user.id, workspaceId: registered.workspaceId, timezone: 'Asia/Jakarta' });
  seedDefaultCategories(ctx);

  const bank = createWallet(ctx, { name: 'Bank BCA', type: 'bank', openingBalance: '12500000', openedOn: '2026-01-01', note: 'Rekening gaji' }, 'seed-w1');
  const cash = createWallet(ctx, { name: 'Tunai', type: 'cash', openingBalance: '1500000', openedOn: '2026-01-01' }, 'seed-w2');
  const ewallet = createWallet(ctx, { name: 'GoPay', type: 'ewallet', openingBalance: '275000', openedOn: '2026-01-01' }, 'seed-w3');

  const categories = listCategories(ctx);
  const categoryId = (name: string, kind: 'income' | 'expense'): string => {
    const row = categories.find((entry) => entry.name === name && entry.kind === kind);
    if (!row) throw new Error(`Kategori ${name} (${kind}) tidak ditemukan`);
    return row.id;
  };

  const gaji = categoryId('Gaji', 'income');
  const hadiah = categoryId('Hadiah', 'income');
  const makan = categoryId('Makan dan minum', 'expense');
  const transport = categoryId('Transportasi', 'expense');
  const tagihan = categoryId('Tagihan', 'expense');
  const belanja = categoryId('Belanja harian', 'expense');
  const kesehatan = categoryId('Kesehatan', 'expense');

  const month = at.slice(0, 7);
  const lastMonth = (() => {
    const [year, monthNumber] = month.split('-').map(Number) as [number, number];
    const previous = monthNumber === 1 ? { year: year - 1, month: 12 } : { year, month: monthNumber - 1 };
    return `${previous.year}-${String(previous.month).padStart(2, '0')}`;
  })();

  const spend: Array<[string, number, string, string]> = [
    ['Makan dan minum', 185_000, bank.id, bookedThisMonth(at, 5)],
    ['Transportasi', 62_000, ewallet.id, bookedThisMonth(at, 6)],
    ['Tagihan', 425_000, bank.id, bookedThisMonth(at, 8)],
    ['Belanja harian', 318_500, bank.id, bookedThisMonth(at, 11)],
    ['Makan dan minum', 97_000, cash.id, bookedThisMonth(at, 12)],
    ['Kesehatan', 150_000, bank.id, bookedThisMonth(at, 15)],
    ['Makan dan minum', 210_000, bank.id, bookedThisMonth(at, 18)],
  ];

  createTransaction(ctx, {
    type: 'income', amount: 8_500_000, walletId: bank.id, categoryId: gaji,
    effectiveDate: bookedThisMonth(at, 1), note: 'Gaji bulanan', source: 'manual',
  }, 'seed-tx-gaji');

  createTransaction(ctx, {
    type: 'income', amount: 1_250_000, walletId: bank.id, categoryId: hadiah,
    effectiveDate: bookedThisMonth(at, 10), note: 'Bonus proyek', source: 'manual',
  }, 'seed-tx-bonus');

  for (const [name, amount, walletId, date] of spend) {
    const id = name === 'Makan dan minum' ? makan : name === 'Transportasi' ? transport : name === 'Tagihan' ? tagihan : name === 'Belanja harian' ? belanja : kesehatan;
    createTransaction(ctx, { type: 'expense', amount, walletId, categoryId: id, effectiveDate: date, source: 'manual' }, `seed-tx-${date}-${amount}`);
  }

  createTransaction(ctx, {
    type: 'transfer', amount: 1_000_000, walletId: bank.id, toWalletId: ewallet.id, fee: 2_500,
    effectiveDate: bookedThisMonth(at, 3), note: 'Top up dompet digital',
  }, 'seed-tx-transfer');

  createTransaction(ctx, {
    type: 'expense', amount: 175_000, walletId: cash.id, categoryId: makan,
    effectiveDate: `${lastMonth}-20`, source: 'manual',
  }, 'seed-tx-lastmonth');

  const koperasi = createDebt(ctx, {
    direction: 'payable', counterpartyName: 'Koperasi Karyawan', principal: 6_000_000,
    startDate: `${lastMonth}-15`, dueDate: dayOfThisMonth(at, 25), openingMode: 'cash', walletId: bank.id,
    note: 'Pinjaman renovasi kamar',
  }, 'seed-debt-1');
  recordDebtPayment(ctx, koperasi.id, { principal: 500_000, interest: 60_000, walletId: bank.id, paymentDate: bookedThisMonth(at, 15) }, 'seed-pay-1');

  createDebt(ctx, {
    direction: 'receivable', counterpartyName: 'Dimas', principal: 750_000,
    startDate: `${lastMonth}-22`, dueDate: addDays(at, 5), openingMode: 'cash', walletId: cash.id,
    note: 'Pinjaman sementara',
  }, 'seed-debt-2');

  const laptop = createGoal(ctx, { name: 'Laptop Kerja', target: 18_000_000, targetDate: `${Number(month.slice(0, 4)) + 1}-06-30`, priority: 1, note: 'Ganti unit lama' }, 'seed-goal-1');
  allocateGoal(ctx, laptop.id, { walletId: bank.id, amount: 4_000_000, effectiveDate: bookedThisMonth(at, 2) }, 'seed-alloc-1');

  const darurat = createGoal(ctx, { name: 'Dana Darurat', target: 30_000_000, priority: 1 }, 'seed-goal-2');
  allocateGoal(ctx, darurat.id, { walletId: bank.id, amount: 2_500_000, effectiveDate: bookedThisMonth(at, 2) }, 'seed-alloc-2');

  createGoal(ctx, { name: 'Liburan Keluarga', target: 7_500_000, targetDate: `${Number(month.slice(0, 4)) + 1}-03-15`, priority: 2 }, 'seed-goal-3');

  createBudget(ctx, { categoryId: makan, period: month, limit: 900_000 }, 'seed-budget-1');
  createBudget(ctx, { categoryId: transport, period: month, limit: 400_000 }, 'seed-budget-2');
  createBudget(ctx, { categoryId: belanja, period: month, limit: 500_000 }, 'seed-budget-3');
  createBudget(ctx, { categoryId: tagihan, period: month, limit: 450_000 }, 'seed-budget-4');

  createRule(ctx, {
    type: 'expense', frequency: 'monthly', label: 'Langganan internet', amount: 385_000,
    walletId: bank.id, categoryId: tagihan, anchorDay: 20, startOn: `${month}-20`,
  }, 'seed-rule-1');
  createRule(ctx, {
    type: 'income', frequency: 'monthly', label: 'Gaji bulanan', amount: 8_500_000,
    walletId: bank.id, categoryId: gaji, anchorDay: 1, startOn: `${month}-01`,
  }, 'seed-rule-2');
  ensureOccurrences(ctx);

  const wallets = listWallets(ctx);
  return { wallets: wallets.length, total: wallets.reduce((sum, wallet) => sum + wallet.balance, 0) };
}

function main(): void {
  const db = openDatabase(config.dbPath);
  migrate(db);
  const existing = one<{ id: string }>(db, `SELECT id FROM users WHERE email = ?`, DEMO_EMAIL);
  if (existing) {
    console.log(`Data contoh sudah ada untuk ${DEMO_EMAIL}. Tidak ada yang diubah.`);
    db.close();
    return;
  }
  const { wallets, total } = seedDemo(db);
  console.log('Data contoh siap.');
  console.log(`  Masuk dengan: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Dompet: ${wallets}, total saldo: Rp${total.toLocaleString('id-ID')}`);
  db.close();
}

// Dijalankan hanya saat berkas ini dieksekusi langsung: uji impor `seedDemo` tanpa efek samping.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/tools/seed.ts')) main();
