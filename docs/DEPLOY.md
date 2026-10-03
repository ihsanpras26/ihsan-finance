# Penyebaran dan Operasi: Ihsan Finance

Dokumen ini adalah kontrak menjalankan aplikasi di server, bukan di mesin pengembangan. Sumber
kebenaran produk tetap `PRD_Aplikasi_Keuangan_Pribadi_v1.md`; keputusan yang menyimpang dicatat di
`docs/DECISIONS.md`.

## 1. Dua bentuk penyalaan

Aplikasi memakai satu skema SQLite dengan dua mode basis data (D-21). Kode aplikasi tidak berubah di
antara keduanya; yang berbeda hanya target dan penjadwalnya.

**A. Satu proses (VPS, wadah, mesin sendiri).**

| Bagian | Peran |
|---|---|
| `app/server/src/main.ts` | API Fastify, penyaji PWA hasil build, penjadwal internal tiap 15 menit |
| `app/web/dist` | Hasil `pnpm --dir web build`; disajikan dari asal yang sama (`config.webDist`) |
| `<IHSAN_DATA_DIR>/ihsan.db` | Basis data libSQL mode berkas, seluruh uang dan jurnal di dalamnya |

Tidak ada `tsc` pada jalur produksi (type-stripping Node 24, D-03) dan tidak ada proses worker
terpisah untuk P0 (PRD §13: satu layanan aplikasi). Karena itu basis data berkas **tidak boleh**
dibagi ke beberapa replika: satu proses, satu penulis.

**B. Serverless (Vercel + Turso).**

| Bagian | Peran |
|---|---|
| `app/api/index.js` | Fungsi Node Vercel: Fastify dibungkus satu handler, permintaan `/api/*` masuk ke sini. Berkas di git hanya re-ekspor tipis supaya Vercel merencanakan fungsi; `node scripts/build-api.mjs` menggantinya dengan bundel mandiri pada langkah build |
| `app/web/dist` | Berkas statis, disajikan CDN Vercel |
| `IHSAN_DB_URL` + `IHSAN_DB_TOKEN` | Turso; berkas lokal tidak bisa dipakai di sana (sistem berkas hanya-baca) |
| `vercel.json` → `crons` | Penjadwal harian memanggil `GET /api/v1/internal/tick` |

## 2. Variabel lingkungan

Salinan acuan ada di `app/.env.example`. Ringkasnya:

| Variabel | Bawaan | Wajib di produksi | Catatan |
|---|---|---|---|
| `HOST` | `127.0.0.1` | ya (mode A) | `0.0.0.0` di dalam wadah atau di belakang proksi |
| `PORT` | `8787` | tidak | platform biasanya menyuntikkan sendiri |
| `APP_ORIGIN` | kosong | ya | **wajib `https://…`**; dari sinilah cookie `Secure` dan HSTS dinyalakan |
| `IHSAN_DB_URL` | kosong | ya (mode B) | `libsql://<basis>.turso.io`; bila diisi, mode berkas diabaikan |
| `IHSAN_DB_TOKEN` | kosong | ya (mode B) | token basis data Turso (bukan token akun) |
| `IHSAN_DATA_DIR` | `app/data`, atau direktori sementara di mode B | ya (mode A) | mode A: harus volume permanen; dipakai juga untuk ekspor |
| `IHSAN_DB_PATH` | `<data>/ihsan.db` | tidak | hanya dipakai bila `IHSAN_DB_URL` kosong |
| `IHSAN_BACKUP_DIR` | `<data>/backups` | tidak | |
| `IHSAN_BACKUP_KEEP` | `14` | tidak | jumlah snapshot tersimpan (NFR07: peluruhan cadangan) |
| `IHSAN_S3_ENDPOINT` | kosong | ya (cadangan offsite) | endpoint S3/R2/B2, mis. `https://<akun>.r2.cloudflarestorage.com` |
| `IHSAN_S3_BUCKET` | kosong | ya (cadangan offsite) | nama ember |
| `IHSAN_S3_REGION` | `auto` | tidak | `auto` benar untuk R2 |
| `IHSAN_S3_ACCESS_KEY_ID` / `IHSAN_S3_SECRET_ACCESS_KEY` | kosong | ya (cadangan offsite) | kredensial S3 berlingkup satu ember |
| `IHSAN_S3_PREFIX` | kosong | tidak | awalan kunci di dalam ember, mis. `produksi` |
| `IHSAN_OFFSITE_KEEP` | `30` | tidak | jumlah dump lokal yang disimpan |
| `IHSAN_OFFSITE_DIR` | `<IHSAN_DATA_DIR>/offsite` | tidak | tempat dump offsite; sengaja terpisah dari snapshot `backup.mjs` |
| `CRON_SECRET` | kosong | ya (mode B) | Vercel mengirim `Authorization: Bearer $CRON_SECRET` ke cron; kosong = titik akhir tick tidak ada |
| `IHSAN_CRON_TOKEN` | kosong | tidak | padanan untuk platform lain; dipakai bila `CRON_SECRET` kosong |
| `IHSAN_TRUST_PROXY` | `0` | ya (di balik proksi) | mempercayai `X-Forwarded-*` untuk IP klien |
| `IHSAN_ALLOW_REGISTRATION` | `1` | ya (`0`) | `0` menutup pendaftaran setelah akun pertama lahir |
| `SESSION_DAYS` | `30` | tidak | umur sesi |
| `NODE_ENV` | kosong | ya | `production` |
| `LOG_LEVEL` | `warn` | tidak | log tidak pernah memuat nominal, catatan, atau nama pihak (NFR08) |

Bila `IHSAN_DB_URL` diisi tetapi `IHSAN_DB_TOKEN` kosong, server gagal saat permintaan pertama —
Turso menolak koneksi tanpa token.

## 3. Urutan penyalaan pertama

1. Pasang variabel dengan `IHSAN_ALLOW_REGISTRATION=1` dan `APP_ORIGIN=https://<domain>`.
2. Jalankan server (atau sebarkan ke Vercel), buka `https://<domain>`, daftar akun pemilik. Kode
   pemulihan muncul sekali.
3. Ubah `IHSAN_ALLOW_REGISTRATION=0`, lalu jalankan ulang. Setelah itu pendaftaran akun baru
   dijawab 403 `Pendaftaran akun baru ditutup di server ini.`
4. Buat dompet pertama. Basis data produksi **tidak boleh** diisi data karangan (D-08); data demo
   `app/server/src/tools/seed.ts` hanya untuk mesin pengembangan.

Di mode B, langkah 1–3 sama; yang berbeda hanya tempat menempelkan variabel (Vercel Project Settings
→ Environment Variables) dan penyebaran ulang yang otomatis setelah disimpan.

## 4. TLS, proksi, dan cookie

Aplikasi tidak memegang sertifikat; TLS diterminasi platform atau proksi (Vercel, Fly/Render/Railway
atau Caddy/nginx). Yang perlu dipastikan:

- `APP_ORIGIN=https://…` → cookie sesi mendapat atribut `Secure` dan setiap balasan membawa
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` (terverifikasi di
  `app/server/test/deploy.test.ts`).
- Proksi meneruskan `Host` dan `X-Forwarded-Proto`; set `IHSAN_TRUST_PROXY=1` supaya kolom
  perangkat pada daftar sesi mencatat IP asli, bukan IP proksi.
- Penulisan ber-cookie diperiksa asalnya (`sameOrigin`): `Origin` harus sehost dengan `Host`.
- Titik kesehatan untuk platform: `GET /api/v1/health` (tanpa sesi) → `{"data":{"ok":true,…}}`.
  `Dockerfile` memakai titik ini untuk `HEALTHCHECK`.
- Di Vercel, domain resmi (`https://<proyek>.vercel.app`) dan domain sendiri sama-sama valid;
  masukkan yang dipakai pengguna ke `APP_ORIGIN`, karena cookie `Secure` dan pemeriksaan asal
  bersandar padanya.

## 5. Penjadwal (FR11, FR17)

- **Mode A:** `main.ts` menjalankan penjadwal di dalam proses, langsung saat menyala lalu setiap 15
  menit. Tidak ada variabel tambahan.
- **Mode B:** platform memanggil `GET /api/v1/internal/tick` dengan
  `Authorization: Bearer $CRON_SECRET`. Titik akhir ini **tidak menuntut sesi pengguna** (tokennya
  sendiri), idempoten, dan menjalankan pekerjaan untuk seluruh ruang sekaligus. Bila `CRON_SECRET`
  dan `IHSAN_CRON_TOKEN` dua-duanya kosong, titik akhir menjawab 404 supaya tidak menjadi pintu
  pembanjiran permintaan.

`vercel.json` memasang satu cron harian `0 22 * * *` (UTC) = 05:00 WIB: pengingat H−7/H−1/H−0 dan
kejadian berulang muncul sebelum hari dimulai. Paket Vercel Hobby hanya mengizinkan cron sekali
sehari; pada paket berbayar frekuensinya bisa dirapatkan menjadi tiap 15 menit tanpa perubahan kode.
Perbedaan granularitasnya dicatat di `docs/DECISIONS.md` D-21.

## 6. Cadangan dan pemulihan (NFR05, AT16)

### 6.1 Snapshot lokal (mode berkas)

`app/scripts/backup.mjs` membuat snapshot konsisten dengan `VACUUM INTO` (aman walau server sedang
menulis), lalu memeriksa integritas, relasi, dan keseimbangan jurnal sebelum berkas diakui sah.
Keluaran tidak pernah memuat nominal.

```bash
node scripts/backup.mjs                    # snapshot baru + pangkas retensi
node scripts/backup.mjs --list             # daftar snapshot
node scripts/backup.mjs --check <berkas>   # uji satu snapshot (keluar 1 bila rusak)
node scripts/backup.mjs --restore <berkas> # pasang snapshot (server harus berhenti dulu)
```

### 6.2 Dump lintas mode + unggah offsite (S3/R2/B2)

`VACUUM INTO` hanya bekerja pada basis data berkas, jadi dump selalu logis:
`app/server/src/tools/offsite.ts` membaca daftar tabel, menyalin seluruh baris dengan chunk, memberi
`PRAGMA foreign_key_check`, lalu memeriksa jumlah baris per tabel, keseimbangan
`SUM(debit)-SUM(credit)`, dan `PRAGMA integrity_check` sebelum dump dianggap sah. Sumbernya
`IHSAN_DB_URL` bila diisi; kalau tidak, berkas lokal `IHSAN_DB_PATH`. Berkas dump diberi nama
`ihsan-YYYYMMDD-HHMMSSmmm.db`, disegel `sha256` di `<berkas>.json`, diunggah ke ember dengan SigV4
buatan sendiri, dan salinan lokal dipangkas ke `IHSAN_OFFSITE_KEEP` terbaru (ember tetap utuh).

Dump ditulis ke `<IHSAN_DATA_DIR>/offsite`, **bukan** ke direktori snapshot `backup.mjs`: kedua
keluarga berkas memakai pola nama yang sama, jadi pemangkasan retensi masing-masing tidak boleh
saling menghapus.

```bash
# mode A: sumbernya basis data berkas
pnpm --dir app offsite:dump   # dump + periksa saja
pnpm --dir app offsite        # dump, unggah, lalu pangkas salinan lokal

# mode B: sumbernya Turso
IHSAN_DB_URL="libsql://…turso.io" IHSAN_DB_TOKEN="…" pnpm --dir app offsite
```

Jadwal: `deploy/systemd/ihsan-backup.timer` memanggil `backup.mjs` (03:10), dan
`deploy/systemd/ihsan-offsite.timer` memanggil `server/src/tools/offsite.ts` (03:20).
Mesin Windows memakai `deploy/windows/offsite.ps1` (membaca berkas env di luar repositori, menulis
log, meneruskan kode keluar) yang cocok dipasang lewat Task Scheduler. Kalau `IHSAN_S3_*` belum
diisi, perintah `upload`/`all` berhenti dengan kode 2 dan tidak mengunggah apa pun.

### 6.3 Pemulihan

- Mode berkas: `node scripts/backup.mjs --restore <berkas>` (server berhenti dulu; skrip menyimpan
  basis data lama sebagai snapshot keamanan dan membuang `-wal`/`-shm` yang tertinggal).
- Mode berkas dari dump offsite: hentikan server, salin berkas dump menimpa `IHSAN_DB_PATH` (dump
  adalah basis data SQLite utuh), buang `-wal`/`-shm` yang tertinggal, lalu jalankan server.
- Mode Turso: unduh berkas dump dari ember, periksa `<berkas>.json`, lalu pulihkan. Berkas dump
  adalah basis data SQLite biner, jadi ia harus diubah menjadi teks SQL lebih dulu:
  `sqlite3 <berkas> .dump > dump.sql` lalu `turso db shell <basis> < dump.sql`. Uji restore wajib
  dilakukan di basis data sementara dulu, bukan pada basis data produksi.

Bukti uji pada basis data pengembangan (server sedang hidup, mode WAL), termasuk dump lintas mode:

```
PASS  ihsan-20261001-124455329.db  408 KB  transaksi=17  integritas=ok  relasi_melanggar=0  jurnal_seimbang=true
INFO  retensi: ihsan-20261001-124454996.db dihapus (menyimpan 1 terbaru)
FAIL  rusak.db  tidak dapat dibaca: file is not a database          (keluar 1)
PASS  basis data dipasang dari ihsan-20261001-124455329.db. Jalankan server lagi.
transaksi=17 wallets=3 selisih_jurnal=0
PASS  ihsan-20261001-141209321.db — 24 tabel, 193 baris, 408 KB, jurnal seimbang, integritas ok
(baris terakhir dijalankan dari basis data berkas mode A: `pnpm --dir app offsite:dump`)
```

## 7. Menyebarkan mode B (Vercel + Turso)

Pemilik perlu melakukan sendiri bagian akun; agen tidak memegang kredensial. Panduan langkah demi
langkah dari dashboard — Turso, Vercel, DNS IDWebhost, akun pemilik, verifikasi, ember R2, jadwal
cadangan — ada di `docs/PANDUAN_PENYALAAN.md`; ringkasannya di bawah ini.

1. **Basis data.** Buat basis data Turso (`turso db create ihsan-finance`), ambil
   `turso db show --url ihsan-finance` dan `turso db tokens create ihsan-finance`. URL masuk
   `IHSAN_DB_URL`, token masuk `IHSAN_DB_TOKEN`.
2. **Proyek.** Hubungkan repositori ini di Vercel, lalu set **Root Directory = `app`** dan
   **Framework Preset = Other** (boleh kosong). Perintah build ada di `app/vercel.json` dan harus
   sama di pengaturan proyek, karena pengaturan proyek menang: `pnpm install --frozen-lockfile`,
   lalu `node scripts/build-api.mjs && pnpm --dir web build` (keluaran `web/dist`).
3. **Kenapa dibundel.** Vercel merencanakan fungsi dari pohon sumber *sebelum* perintah build
   berjalan, jadi `api/index.js` harus ada di git — isinya re-ekspor tipis. Platform lalu
   mengompilasi `server/src/*.ts` dengan `tsc`-nya sendiri, mempertahankan spesifier impor `.ts` di
   JS hasilnya, dan mengirim hanya berkas `.js`, sehingga fungsi mati pada impor pertama
   (`ERR_MODULE_NOT_FOUND` → 500 `FUNCTION_INVOCATION_FAILED`). Karena itu langkah build menimpa
   berkas itu dengan bundel esbuild mandiri: seluruh modul lokal, seluruh dependensi pihak ketiga,
   dan skema (`db/schema.ts`) masuk ke satu berkas; yang tersisa eksternal hanya penggerak libSQL
   asli (`@libsql/client`, `libsql`) yang dijangkau hanya untuk target `file:`, tidak pernah di mode
   Turso. Bundel CJS di keluaran ESM memakai `createRequire` lewat banner, karena Fastify/pino
   memanggil `require('node:events')` dan padanannya. Rinciannya di `docs/DECISIONS.md` D-24.
4. **Variabel.** Isi `IHSAN_DB_URL`, `IHSAN_DB_TOKEN`, `APP_ORIGIN=https://<domain>`,
   `IHSAN_ALLOW_REGISTRATION=0`, `CRON_SECRET` (acak, panjang), dan `IHSAN_TRUST_PROXY=1`.
   Menyetel `0` sejak awal tetap aman: akun pertama boleh lahir sebagai pengecualian bootstrap,
   sesudah itu pendaftaran ditolak.
5. **Skema.** Dijalankan otomatis: setiap penyalaan fungsi memanggil `migrate(db)`, yang idempoten
   (`db/schema.ts`; `PRAGMA user_version` hanya ditulis pada basis data berkas karena Turso menolak
   perintah itu lewat HTTP).
6. **Cron.** `vercel.json` sudah memasang `/api/v1/internal/tick` harian; pastikan `CRON_SECRET`
   terisi, karena tanpa itu titik akhir menjawab 404.
7. **Domain.** Tambahkan domain di Vercel, arahkan DNS, lalu samakan `APP_ORIGIN` dengan domain itu
   dan sebarkan ulang.

Batas yang perlu diketahui: fungsi Node Vercel hanya bisa menulis di `/tmp` (dipakai untuk ekspor),
`maxDuration` dipatok 30 detik di `vercel.json`, dan setiap penyalaan dingin membuka koneksi Turso
baru. Batas waktu itu cukup untuk P0 (satu pengguna, data puluhan ribu baris), tetapi dump besar
untuk cadangan harus dijalankan dari mesin tetap (`pnpm --dir app offsite`), bukan dari fungsi.

## 8. Pilihan tempat, dan yang dibutuhkan untuk masing-masing

Keputusan pemilik (1 Oktober 2026): **Vercel Hobby + Turso Free + Cloudflare R2**, batas biaya
**gratis**. Domain **ihsanpras.my.id**, DNS dikelola di **IDWebhost** (`ns1.idwebhost.id`,
`ns2.idwebhost.id`) — bukan Cloudflare, jadi catatan DNS dipasang di panel IDWebhost. Peta pilihan
lain disimpan sebagai cadangan bila kuota gratis tidak lagi cukup:

| Pilihan | Bentuk | Biaya kasar | Yang agen butuhkan dari pemilik |
|---|---|---|---|
| Vercel + Turso | fungsi + basis data terkelola | gratis pada paket Hobby | akun Vercel (atau token `VERCEL_TOKEN`) + nama proyek, basis data Turso (`turso db create`) + URL & token, nama domain |
| Fly.io | wadah + volume `[data]`, TLS bawaan | ~US$2–4/bulan | `FLY_API_TOKEN`, nama aplikasi, region (mis. `sin`), metode bayar aktif |
| Render | wadah + disk permanen, TLS bawaan | ~US$7/bulan + disk | akun + `RENDER_API_TOKEN`, izin GitHub App, konfirmasi disk permanen berbayar |
| Railway | wadah + volume | ~US$5/bulan | `RAILWAY_TOKEN` + token proyek, metode bayar |
| VPS (Hetzner/DO) | systemd + Caddy, ukuran `deploy/systemd/` | ±US$5/bulan | IP, akses SSH (agen membuat pasangan kunci, pemilik menempelkan kunci publiknya), DNS A record |
| Mesin sendiri | systemd/compose + Cloudflare Tunnel | gratis + listrik | mesin yang hidup terus, akun Cloudflare, tunnel token |

Untuk semua pilihan di atas, yang tetap sama: `APP_ORIGIN` https, penjadwal yang berjalan
(mode A tiap 15 menit, mode B lewat cron), dan snapshot harian yang dikirim ke luar mesin.

Perintah langkah demi langkah untuk tiap bentuk ada di dua halaman: `docs/PANDUAN_PENYALAAN.md`
(mode B, dari dashboard Vercel/Turso/IDWebhost/R2) dan `docs/PANDUAN_PENYALAAN_VPS.md` (mode A,
VPS atau mesin sendiri, systemd atau wadah + Caddy).

## 9. Yang belum dikerjakan

- Uji restore terjadwal tiga bulanan (NFR05): belum ada berkasnya; pembuktian saat ini manual dan
  tercatat di bagian 6.
- Domain: `ihsanpras.my.id` sudah terdelegasi (`NS` → `ns1`/`ns2.idwebhost.id`) dan apex `A`
  mengarah ke Vercel (`216.198.79.1`); `www` belum punya catatan. Rantai TLS dan uji lewat domain
  sungguhan terhalang kuirk jaringan mesin ini: resolusi IPv6 (NAT64) mati, jadi perintah verifikasi
  harus memakai `curl -4`.
- Kredensial: berkas `C:\Users\HP\.ihsan-prod.env` (di luar repo, tidak pernah masuk git) sudah
  memuat token Vercel berakses penuh, token Turso platform + basis data, dan `CRON_SECRET`; yang
  masih kosong hanya pasangan kunci S3 R2 karena R2 belum dinyalakan.
- R2 belum dinyalakan pada akun Cloudflare (`GET …/r2/buckets` → 10042), jadi bucket dan kredensial
  S3 belum bisa dibuat, dan unggahan ke ember sungguhan belum pernah dijalankan. Yang sudah
  terbukti: format permintaan SigV4 cocok dengan vektor resmi AWS, dan round-trip dump diperiksa di
  `app/server/test/offsite.test.ts`.
- Pipelines CI: repo belum punya `.github/workflows`.
- Alarm ketidakseimbangan jurnal di luar proses: saat ini hanya log kode gagal (NFR08).
