# Panduan penyalaan produksi (Vercel + Turso + Cloudflare R2)

Panduan ini ditulis untuk dikerjakan sendiri dari dashboard, tanpa CLI. Semua nilai yang diketik
dimasukkan ke panel penyedia; berkas ini tidak pernah memuat rahasia sungguhan.

Yang akan jadi setelah selesai: aplikasi hidup di `https://ihsanpras.my.id` (fungsi Node di Vercel),
basis datanya Turso, penjadwal harian Vercel memicu `/api/v1/internal/tick`, dan dump cadangan
harian naik ke ember R2 dari mesin tetap.

Untuk mesin sendiri atau VPS (mode satu proses, basis data berkas, penjadwal internal), pakai
`docs/PANDUAN_PENYALAAN_VPS.md`. Jangan menyalakan dua bentuk penyalaan di atas basis data yang sama.

Perkiraan waktu 45–60 menit, ditambah waktu propagasi DNS.

| # | Bagian | Siapa | Hasil |
|---|---|---|---|
| 1 | Basis data Turso | Anda | `IHSAN_DB_URL` + `IHSAN_DB_TOKEN` |
| 2 | Proyek + variabel Vercel | Anda | aplikasi tersebar, `/api/v1/health` 200 |
| 3 | Domain + DNS IDWebhost | Anda | `ihsanpras.my.id` terverifikasi di Vercel |
| 4 | Akun pemilik + tutup pendaftaran | Anda | akun `owner` ada, pendaftaran tertutup |
| 5 | Verifikasi | Anda | lima pemeriksaan lolos |
| 6 | Ember R2 + cadangan harian | Anda | dump naik ke ember, terjadwal |
| 7 | Pemulihan + perawatan | Anda | uji restore, rotasi token |

Simpan nilai yang Anda kumpulkan di berkas di luar repositori, misalnya
`C:\Users\HP\.ihsan-prod.env` (format `NAMA=nilai` per baris). Berkas itu dipakai
`deploy/windows/offsite.ps1` untuk cadangan harian, dan tidak pernah masuk git.

---

## 1. Basis data Turso

1. Masuk ke <https://turso.tech> → **Create Database**.
   - Nama: `ihsan-finance`
   - Group/region: pilih yang terdekat (Asia/Pacific).
2. Buka basis data itu, salin **URL**-nya. Bentuknya `libsql://ihsan-finance-<org>.turso.io`.
3. Buat token untuk basis data itu: **Create Token** (nama bebas, mis. `vercel-produksi`).
   Token hanya ditampilkan sekali; salin sekarang.
4. Tulis ke berkas env Anda:

```
TURSO_DB=ihsan-finance
IHSAN_DB_URL=libsql://ihsan-finance-<org>.turso.io
IHSAN_DB_TOKEN=<token>
```

Catatan: skema `libsql://` dipakai apa adanya; klien aplikasi otomatis memilih jalur HTTP untuk
alamat remote. Skema berkas hanya untuk pengembangan lokal.

Skema tabel tidak perlu dijalankan manual: setiap penyalaan fungsi memanggil migrasi idempoten
(`db/schema.ts`). Penanda `PRAGMA user_version` hanya ditulis pada basis data berkas — Turso menolak
perintah itu lewat HTTP (`SQL_PARSE_ERROR: SQL not allowed statement`).

✅ Periksa: URL berawalan `libsql://`, token tersimpan, basis data terlihat di dashboard.

---

## 2. Proyek dan variabel Vercel

1. <https://vercel.com/new> → **Import Git Repository** → pilih `ihsanpras26/ihsan-finance`.
   Bila repositori tidak muncul, pasang dulu Vercel GitHub App untuk repositori itu
   (**Account Settings → Git** atau tautan *Adjust GitHub App Permissions* di halaman impor).
2. Di layar konfigurasi:
   - **Project Name**: `ihsan-finance`
   - **Framework Preset**: `Other`
   - **Root Directory**: `app` ← wajib; paket pnpm ada di `app/`, bukan di akar repositori
   - **Build and Output Settings**: biarkan kosong. `app/vercel.json` sudah mengatur
     `pnpm install --frozen-lockfile`, `pnpm --dir web build`, keluaran `web/dist`.
   - **Node.js Version**: pilih `24.x` bila tersedia (repositori meminta Node ≥ 24; kode server
     adalah TypeScript yang dijalankan langsung tanpa langkah build).
3. Tambahkan **Environment Variables** (Environment: *Production*; boleh sekalian *Preview*):

| Nama | Nilai | Alasan |
|---|---|---|
| `APP_ORIGIN` | `https://ihsanpras.my.id` | cookie `Secure` + HSTS hanya menyala bila nilai ini https |
| `IHSAN_DB_URL` | dari langkah 1 | memilih mode Turso |
| `IHSAN_DB_TOKEN` | dari langkah 1 | kredensial Turso |
| `IHSAN_TRUST_PROXY` | `1` | Vercel menerminasi TLS dan meneruskan `X-Forwarded-For` |
| `NODE_ENV` | `production` | perilaku produksi |
| `LOG_LEVEL` | `warn` | log ringkas; log tidak pernah memuat nominal |
| `SESSION_DAYS` | `30` | umur sesi |
| `IHSAN_ALLOW_REGISTRATION` | `0` | pendaftaran tertutup; akun pertama tetap boleh lahir |
| `CRON_SECRET` | nilai acak panjang (lihat di bawah) | token penjadwal Vercel |

Jangan isi `IHSAN_DATA_DIR` di Vercel: fungsi hanya bisa menulis di `/tmp`, dan bawaannya sudah
`/tmp/ihsan`. Jangan isi `IHSAN_S3_*` di Vercel juga — dump cadangan dijalankan dari mesin tetap
(langkah 6), bukan dari fungsi.

Buat `CRON_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

4. **Deploy**. Tunggu sampai selesai; catat URL `*.vercel.app` yang diberikan.
5. Setelah deploy pertama, buka **Settings → Cron Jobs**: harus ada satu entri
   `/api/v1/internal/tick` dengan jadwal harian (`0 22 * * *` = 05:00 WIB). Paket Hobby hanya
   mengizinkan penjadwalan harian, dan itu memang cukup (RPO 24 jam).

✅ Periksa: `curl.exe -sS -o NUL -w "%{http_code}\n" https://<proyek>.vercel.app/api/v1/health`
menjawab `200`.

---

## 3. Domain dan DNS di IDWebhost

1. Vercel → proyek → **Settings → Domains → Add**:
   - `ihsanpras.my.id` (apex)
   - `www.ihsanpras.my.id`, lalu pilih **Redirect to `ihsanpras.my.id`** (308)
2. Vercel menampilkan catatan DNS yang harus dipasang. **Pakai nilai yang tertera di layar itu**;
   biasanya: apex `A` ke `76.76.21.21` (beberapa proyek baru memakai `216.198.79.1`) dan
   `www` `CNAME` ke `cname.vercel-dns.com`.
3. Panel IDWebhost → domain `ihsanpras.my.id` → **DNS Management**:
   - Hapus catatan `A`/`CNAME` bawaan (halaman parkir) untuk `@` dan `www` bila ada.
   - Tambah `A` host `@` → alamat dari Vercel, TTL 300–3600.
   - Tambah `CNAME` host `www` → `cname.vercel-dns.com`, TTL 300–3600.
   - Nameserver tetap `ns1.idwebhost.id` / `ns2.idwebhost.id`; zona tetap dikelola IDWebhost,
     jadi jangan pindahkan DNS ke Vercel.
4. Tunggu propagasi (5 menit sampai beberapa jam), lalu periksa:

```powershell
nslookup ihsanpras.my.id 1.1.1.1
nslookup www.ihsanpras.my.id 1.1.1.1
```

Saat panduan ini ditulis, kueri `NS`/`SOA`/`A` untuk domain itu menjawab **SERVFAIL** di resolver
Cloudflare dan Google — artinya zona di sisi IDWebhost belum melayani jawaban. Bila setelah catatan
dipasang hasilnya masih SERVFAIL, itu masalah sisi registrar: hubungi dukungan IDWebhost dan sebut
bahwa zona `ihsanpras.my.id` belum menjawab kueri `NS`/`SOA`.

5. Setelah domain **Valid** di Vercel, buka aplikasinya sekali agar `APP_ORIGIN` cocok dengan asal
   yang dipakai. Bila sebelumnya Anda memakai `https://<proyek>.vercel.app`, ubah `APP_ORIGIN` lalu
   **Redeploy** (perubahan variabel lingkungan baru berlaku setelah penyebaran ulang).

✅ Periksa: halaman Vercel Domains menandai kedua domain **Valid Configuration**.

---

## 4. Akun pemilik dan menutup pendaftaran

1. Buka `https://ihsanpras.my.id` → **Daftar** (registrasi). Isi email, kata sandi, dan nama.
2. **Simpan kode pemulihan** yang ditampilkan sekali di layar; tanpa itu akun tidak bisa dipulihkan.
3. `IHSAN_ALLOW_REGISTRATION` sudah `0` sejak langkah 2. Ini benar: akun pertama tetap boleh lahir
   (pengecualian bootstrap), sedangkan pendaftaran berikutnya ditolak dengan pesan
   "Pendaftaran akun baru ditutup di server ini."

✅ Periksa: keluar, masuk lagi dengan akun itu, lalu coba buka halaman Daftar di jendela
penyamaran (private) — pendaftaran harus ditolak.

---

## 5. Verifikasi

Ganti `<domain>` dengan `ihsanpras.my.id` dan `<CRON_SECRET>` dengan nilai dari langkah 2.

| Yang diperiksa | Perintah | Jawaban benar |
|---|---|---|
| Aplikasi hidup | `curl.exe -sS https://<domain>/api/v1/health` | `{"data":{"ok":true,...}}` |
| Penjadwal tanpa token | `curl.exe -sS -o NUL -w "%{http_code}\n" https://<domain>/api/v1/internal/tick` | `403` |
| Penjadwal dengan token | `curl.exe -sS -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/v1/internal/tick` | `200` dan `{"data":{...}}` |
| Rute web (SPA) | `curl.exe -sS -o NUL -w "%{http_code}\n" https://<domain>/transaksi` | `200` |
| Cookie sesi | `curl.exe -sS -D - -o NUL -X POST https://<domain>/api/v1/auth/login -H "Content-Type: application/json" -d '{\"email\":\"<email>\",\"password\":\"<sandi>\"}'` | ada `Set-Cookie: ifsess=…; Secure; HttpOnly; SameSite=Lax` dan header `Strict-Transport-Security` |

Bila `IHSAN_ALLOW_REGISTRATION=0` dan `CRON_SECRET` terisi tapi tick menjawab `404`, berarti
variabelnya belum terbaca oleh penyebaran yang aktif → redeploy.

Gaya kutip `-d '{\"email\":…}'` di baris terakhir ditujukan untuk Windows PowerShell 5.1 (di
PowerShell 7 tandanya cukup `'{"email":…}'`). Di `cmd.exe`, ganti pembungkusnya menjadi
`-d "{\"email\":\"…\",\"password\":\"…\"}"`.

Pemeriksaan browser: buka `https://<domain>` di ponsel dan desktop, masuk, catat satu transaksi,
lalu muat ulang halaman — angka harus tetap (data datang dari Turso, bukan dari memori fungsi).

---

## 6. Ember R2 dan cadangan harian

Cadangan dijalankan dari mesin tetap (PC ini atau server lain yang menyala setiap hari), bukan dari
fungsi Vercel: dump penuh bisa melewati `maxDuration` 30 detik.

### 6.1 Ember dan kunci S3

1. Dashboard Cloudflare → **R2** → aktifkan (terima ketentuan; paket gratis tetap meminta metode
   pembayaran terdaftar, tanpa tagihan selama di bawah kuota).
2. **Create bucket**: nama `ihsan-backup`, lokasi Automatic.
3. **R2 → API → Manage API Tokens → Create API Token**:
   - Permission: **Object Read & Write**
   - Scope: bucket `ihsan-backup`
   - Salin **Access Key ID**, **Secret Access Key**, dan endpoint
     `https://<account-id>.r2.cloudflarestorage.com`.

Kunci S3 R2 hanya bisa dibuat dari dashboard; tidak ada titik akhir API-nya.

### 6.2 Variabel untuk mesin cadangan

```
IHSAN_DB_URL=libsql://ihsan-finance-<org>.turso.io
IHSAN_DB_TOKEN=<token>
IHSAN_DATA_DIR=D:\ihsan-data
IHSAN_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
IHSAN_S3_BUCKET=ihsan-backup
IHSAN_S3_REGION=auto
IHSAN_S3_ACCESS_KEY_ID=<access key id>
IHSAN_S3_SECRET_ACCESS_KEY=<secret>
IHSAN_S3_PREFIX=produksi
IHSAN_OFFSITE_KEEP=30
```

`IHSAN_DATA_DIR` di sini **wajib** berbeda dari direktori kerja aplikasi: dump ditulis ke
`<IHSAN_DATA_DIR>\offsite` supaya tidak bercampur dengan snapshot `backup.mjs`.

### 6.3 Jalankan sekali, lalu jadwalkan

Di akar repositori:

```powershell
pnpm --dir app offsite
```

Keluaran yang benar: baris `sumber: libsql://…`, lalu `PASS ihsan-….db — N tabel, … jurnal seimbang,
integritas ok`, lalu unggahan. Periksa objek `produksi/ihsan-….db` dan `….db.json` di ember.

Jadwalkan harian lewat Task Scheduler (Windows), memakai skrip yang sudah ada:

```powershell
schtasks /Create /TN "Ihsan offsite backup" /SC DAILY /ST 03:10 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"D:\Ihsan Finance\ihsan-finance\deploy\windows\offsite.ps1\""
```

`deploy/windows/offsite.ps1` membaca berkas env di `%USERPROFILE%\.ihsan-prod.env`, menulis log ke
`%LOCALAPPDATA%\ihsan-offsite\offsite-<stamp>.log`, menyimpan 90 hari log terakhir, dan mengembalikan
kode keluar proses dump (0 = berhasil). Untuk mesin Linux, pasang unit systemd tambahan mengikuti
`deploy/systemd/ihsan-backup.service` tetapi dengan `ExecStart=/usr/bin/node server/src/tools/offsite.ts`
dan `WorkingDirectory=/opt/ihsan/app`.

Uji jadwalnya sekali: jalankan perintah `schtasks /Run /TN "Ihsan offsite backup"`, lalu pastikan ada
log baru dan objek baru di ember.

✅ Periksa: objek bertambah satu setiap hari; `IHSAN_OFFSITE_KEEP=30` memangkas salinan lokal, ember
tetap utuh.

---

## 7. Pemulihan dan perawatan

### 7.1 Uji restore (NFR05, tiap tiga bulan)

Berkas dump adalah basis data SQLite utuh, jadi untuk pembuktian cepat ia bisa dibuka apa adanya:

```powershell
node app\scripts\backup.mjs --check D:\ihsan-data\offsite\ihsan-<stamp>.db
```

Untuk memulihkan ke Turso, ubah dulu dump menjadi teks SQL (butuh CLI `sqlite3`), lalu suapkan ke
basis data **uji**, bukan produksi:

```powershell
sqlite3 ihsan-<stamp>.db .dump > dump.sql
turso db create ihsan-uji
turso db shell ihsan-uji < dump.sql
```

Bila hanya perlu mengganti basis data berkas lokal: hentikan server, timpa `IHSAN_DB_PATH` dengan
berkas dump, buang `-wal`/`-shm` yang tertinggal, jalankan lagi. Prosedur lengkap ada di
`docs/DEPLOY.md` bagian 6.3.

### 7.2 Perawatan rutin

- **Rotasi kredensial.** Token yang pernah muncul di percakapan atau tangkapan layar wajib dicabut:
  Vercel → **Account Settings → Tokens**, Cloudflare → **My Profile → API Tokens**, Turso →
  **Settings → API Tokens**. Ganti nilainya di Vercel/Task Scheduler, lalu redeploy.
- **Token Vercel harus berakses penuh.** Token bertipe `vck_…` yang izinnya terbatas menjawab `403`
  saat membuat proyek, menyetel variabel, atau memasang domain. Dari dashboard, token biasa
  (**Create Token** dengan *Scope: Full Account*) bekerja untuk semua langkah di panduan ini.
- **Jangan pernah** menyalakan lagi pendaftaran terbuka di produksi; biarkan
  `IHSAN_ALLOW_REGISTRATION=0`.
- Periksa **Settings → Cron Jobs → Logs** sebulan sekali: tick yang gagal berulang berarti
  penjadwal utang dan notifikasi berhenti.
- Kuota gratis yang perlu dijaga: Turso (baris/baca-tulis per bulan), R2 (10 GB simpanan),
  Vercel Hobby (fungsi harian). Dump harian ±0,4 MB, jadi R2 baru mendekati batas setelah bertahun.

---

## 8. Kalau bermasalah

| Gejala | Penyebab paling mungkin | Tindakan |
|---|---|---|
| `/api/v1/health` 500 pada semua permintaan | `IHSAN_DB_URL`/`IHSAN_DB_TOKEN` salah atau belum dibaca | Periksa **Deployments → Functions → Logs**; perbaiki variabel; redeploy |
| Deployment gagal dengan galat sintaks `.ts` | Node runtime penyebaran lebih tua dari 24 | **Settings → Node.js Version → 24.x**, lalu redeploy |
| `/api/v1/internal/tick` 404 | `CRON_SECRET` kosong di penyebaran aktif | Isi variabel, redeploy |
| `/api/v1/internal/tick` 403 padahal token benar | Nilai `CRON_SECRET` disalin dengan spasi/baris baru | Salin ulang persis, redeploy |
| Cron tidak pernah jalan | Jadwal lebih rapat dari harian di paket Hobby | Pakai jadwal harian di `app/vercel.json` |
| Domain tidak kunjung **Valid** | Catatan DNS belum ada/salah host | Periksa di panel IDWebhost; apex = `A`, bukan `CNAME` |
| Halaman putih setelah muat ulang rute dalam | Rewrite SPA hilang | `app/vercel.json` memuat rewrite `/(.*)` → `/index.html`; jangan hapus |
| Cookie sesi hilang setelah login | `APP_ORIGIN` bukan https atau tidak sama dengan domain | Samakan lalu redeploy |
| Login berhasil, data kosong | Terhubung ke basis data lain (mis. Turso baru) | Periksa `IHSAN_DB_URL` terhadap basis data yang dipakai saat mendaftar |
| `offsite` keluar 2 tanpa unggahan | `IHSAN_S3_*` belum lengkap | Isi keempat variabel S3 di berkas env mesin cadangan |

---

## 9. Daftar periksa akhir

- [ ] Basis data Turso `ihsan-finance` ada; URL + token tersimpan.
- [ ] Proyek Vercel `ihsan-finance`, Root Directory `app`, Node 24.x.
- [ ] Sembilan variabel lingkungan produksi terisi; `IHSAN_ALLOW_REGISTRATION=0`.
- [ ] `/api/v1/health` 200 lewat domain sungguhan.
- [ ] `ihsanpras.my.id` dan `www` **Valid** di Vercel; `APP_ORIGIN` sesuai.
- [ ] Akun pemilik ada, kode pemulihan tersimpan, pendaftaran tertutup.
- [ ] Tick tanpa token 403, dengan token 200.
- [ ] Cookie sesi `Secure; HttpOnly` + HSTS terlihat.
- [ ] Ember R2 `ihsan-backup` ada; dump pertama naik ke `produksi/`.
- [ ] Tugas harian `Ihsan offsite backup` terpasang dan sudah dijalankan sekali.
- [ ] Uji restore di basis data uji berhasil.
- [ ] Token yang pernah bocor sudah dicabut dan diganti.
