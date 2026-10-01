// scripts/backup.mjs: snapshot harian basis data SQLite (NFR05) plus uji integritas dan keseimbangan jurnal.
// `VACUUM INTO` membuat salinan yang konsisten walau server sedang menulis (mode WAL).
// Pemakaian: node scripts/backup.mjs            → snapshot baru + pangkas retensi
//            node scripts/backup.mjs --list     → daftar snapshot
//            node scripts/backup.mjs --check F  → uji satu berkas snapshot
//            node scripts/backup.mjs --restore F → pasang snapshot sebagai basis data aktif
// Lingkungan: IHSAN_DATA_DIR, IHSAN_DB_PATH, IHSAN_BACKUP_DIR, IHSAN_BACKUP_KEEP (bawaan 14).
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..');

const dataDir = process.env.IHSAN_DATA_DIR ? resolve(process.env.IHSAN_DATA_DIR) : join(APP_ROOT, 'data');
const dbPath = process.env.IHSAN_DB_PATH ? resolve(process.env.IHSAN_DB_PATH) : join(dataDir, 'ihsan.db');
const backupDir = process.env.IHSAN_BACKUP_DIR ? resolve(process.env.IHSAN_BACKUP_DIR) : join(dataDir, 'backups');
const keep = Number.parseInt(process.env.IHSAN_BACKUP_KEEP ?? '14', 10) || 14;

const SNAPSHOT = /^ihsan-\d{8}-\d{9}\.db$/;

function stamp() {
  const [date, time] = new Date().toISOString().split('T');
  return `${date.replace(/-/g, '')}-${time.slice(0, 8).replace(/:/g, '')}${time.slice(9, 12)}`;
}

/** Buka salinan hanya-baca dan periksa integritas, relasi, serta keseimbangan jurnal (AT16). */
function inspect(file) {
  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    const integrityOk = String(Object.values(integrity)[0] ?? '') === 'ok';
    const foreign = db.prepare('PRAGMA foreign_key_check').all().length;
    const balance = db.prepare('SELECT COALESCE(SUM(debit_minor), 0) - COALESCE(SUM(credit_minor), 0) AS selisih FROM journal_lines').get();
    const selisih = Number(balance.selisih ?? 0);
    const transactions = Number(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n ?? 0);
    return { integrityOk, foreign, selisih, transactions };
  } catch (error) {
    return { integrityOk: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    db.close();
  }
}

/** Satu baris laporan tanpa nominal: jumlah, integritas, relasi, dan keseimbangan jurnal. */
function describe(file) {
  const result = inspect(file);
  if (result.error) {
    console.log(`FAIL  ${basename(file)}  tidak dapat dibaca: ${result.error}`);
    return { ok: false };
  }
  const { integrityOk, foreign, selisih, transactions } = result;
  const ok = integrityOk && foreign === 0 && selisih === 0;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${basename(file)}  ${Math.round(statSync(file).size / 1024)} KB  transaksi=${transactions}  ` +
      `integritas=${integrityOk ? 'ok' : 'rusak'}  relasi_melanggar=${foreign}  jurnal_seimbang=${selisih === 0}`,
  );
  return { ok };
}

function snapshots() {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir)
    .filter((name) => SNAPSHOT.test(name))
    .sort()
    .map((name) => join(backupDir, name));
}

/** Salinan konsisten dari basis data yang sedang dipakai; nama berkas memuat waktu UTC. */
function snapshotInto(target) {
  mkdirSync(dirname(target), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
}

function takeBackup() {
  if (!existsSync(dbPath)) {
    console.error(`FAIL  basis data tidak ditemukan: ${dbPath}`);
    process.exit(1);
  }
  mkdirSync(backupDir, { recursive: true });
  const target = join(backupDir, `ihsan-${stamp()}.db`);
  if (existsSync(target)) {
    console.error(`FAIL  snapshot dengan nama ini sudah ada: ${target}`);
    process.exit(1);
  }
  try {
    snapshotInto(target);
  } catch (error) {
    rmSync(target, { force: true });
    console.error(`FAIL  snapshot gagal dibuat: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  if (!describe(target).ok) {
    rmSync(target, { force: true });
    console.error('FAIL  snapshot tidak lulus uji; berkas dibuang.');
    process.exit(1);
  }
  const all = snapshots();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) {
    rmSync(old, { force: true });
    console.log(`INFO  retensi: ${basename(old)} dihapus (menyimpan ${keep} terbaru)`);
  }
  console.log(`PASS  snapshot selesai: ${target}`);
}

function restore(file) {
  const source = resolve(file);
  if (!existsSync(source)) {
    console.error(`FAIL  snapshot tidak ditemukan: ${source}`);
    process.exit(1);
  }
  if (!describe(source).ok) {
    console.error('FAIL  snapshot tidak lulus uji; pemulihan dibatalkan.');
    process.exit(1);
  }
  if (existsSync(dbPath)) {
    const safety = join(backupDir, `ihsan-${stamp()}.db`);
    snapshotInto(safety);
    console.log(`INFO  basis data lama disimpan dulu di ${basename(safety)}`);
  }
  // Hentikan server lebih dulu; berkas -wal/-shm yang tertinggal bisa menimpa isi salinan.
  for (const suffix of ['-wal', '-shm']) rmSync(`${dbPath}${suffix}`, { force: true });
  mkdirSync(dirname(dbPath), { recursive: true });
  copyFileSync(source, dbPath);
  console.log(`PASS  basis data dipasang dari ${basename(source)}. Jalankan server lagi.`);
}

const [command, argument] = process.argv.slice(2);

if (command === '--list') {
  for (const file of snapshots()) describe(file);
} else if (command === '--check') {
  if (!argument) {
    console.error('FAIL  sebutkan berkas snapshot: node scripts/backup.mjs --check <berkas>');
    process.exit(1);
  }
  process.exit(describe(argument).ok ? 0 : 1);
} else if (command === '--restore') {
  if (!argument) {
    console.error('FAIL  sebutkan berkas snapshot: node scripts/backup.mjs --restore <berkas>');
    process.exit(1);
  }
  restore(argument);
} else {
  takeBackup();
}
