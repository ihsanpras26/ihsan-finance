# Status Implementasi: Ihsan Finance

Diperbarui: 5 Oktober 2026
Sumber kebenaran: `docs/PRD_Aplikasi_Keuangan_Pribadi_v1.md` · Kontrak teknis: `docs/ARCHITECTURE.md`
Keputusan menyimpang: `docs/DECISIONS.md`

---

## Cara memverifikasi sendiri

```bash
cd app
pnpm install          # sekali saja
pnpm verify           # typecheck + tes di kedua paket, lalu build antarmuka
pnpm seed             # isi data contoh (akun demo)
pnpm smoke            # jalankan server uji dan telusuri seluruh permukaan HTTP
pnpm dev              # jalankan API + antarmuka web untuk dipakai
```

`pnpm verify` menjalankan pemeriksaan tipe di kedua paket, **83 tes server**, **5 tes antarmuka**,
dan build produksi. `pnpm smoke` membuka server di dalam prosesnya sendiri dan menjalankan
**50 pemeriksaan HTTP nyata** terhadap permukaan yang dipakai antarmuka, termasuk seluruh
skenario penerimaan.

Laporan gerbang anti-slop sebelum penyerahan ada di `docs/DELIVERY_GATE.md`.

---

## Yang sudah jadi dan terverifikasi

### Inti keuangan (server)

| Bagian | Berkas | Keadaan |
|---|---|---|
| Uang bilangan bulat rupiah, batas, parsing ketat | `core/money.ts` | Selesai · teruji |
| Mesin jurnal berpasangan, keseimbangan, saldo turunan | `domain/ledger.ts` | Selesai · teruji |
| Transaksi: pendapatan, pengeluaran, transfer, refund, rencana | `domain/transactions.ts` | Selesai · teruji |
| Koreksi (pembalikan + pengganti) dan pembatalan | `domain/transactions.ts` | Selesai · teruji |
| Idempotensi kunci + muatan | `domain/idempotency.ts` | Selesai · teruji |
| Dompet, saldo awal sebagai jurnal, rekonsiliasi | `domain/wallets.ts` | Selesai · teruji |
| Kategori bawaan dan pengarsipan | `domain/categories.ts` | Selesai · teruji |
| Utang dan piutang, pembayaran, pembatalan, penghapusan | `domain/debts.ts` | Selesai · teruji |
| Tujuan dan alokasi dana | `domain/goals.ts` | Selesai · teruji |
| Anggaran per kategori per periode | `domain/budgets.ts` | Selesai · teruji |
| Aturan berulang dan kejadian | `domain/recurring.ts` | Selesai · teruji |
| Pengingat jatuh tempo, anggaran, kejadian | `domain/notifications.ts` | Selesai · teruji |
| Penjadwal berkala | `workers/scheduler.ts` | Selesai · teruji |
| Laporan: ringkasan, arus kas, kekayaan bersih, kategori | `domain/reports.ts` | Selesai · teruji |
| Ekspor CSV dan cadangan penuh | `domain/export.ts` | Selesai · teruji |
| Beranda satu panggilan | `domain/dashboard.ts` | Selesai · teruji |
| Autentikasi, sesi, pemulihan, pembatasan percobaan | `domain/auth.ts` | Selesai · teruji |
| Audit perubahan | `domain/audit.ts` | Selesai · teruji |

### Permukaan HTTP

Semua rute di bawah ada di `/api/v1` dan tercakup oleh `pnpm smoke`.

- `auth`: register, login, logout, recover, me, sessions, revoke-others
- `workspace`, `preferences`, `timezones`, `onboarding`
- `wallets`: daftar, buat, ubah, arsip, batal arsip, hapus, saldo, rekonsiliasi
- `categories`: daftar, buat, ubah, arsip, batal arsip
- `transactions`: daftar berfilter, buat, detail + histori, ubah, batalkan, konfirmasi rencana, dampak
- `debts`: daftar, akan jatuh tempo, detail + pembayaran, buat, ubah, bayar, batal bayar, hapus buku
- `goals`: daftar, buat, detail + alokasi, ubah, alokasi, pelepasan, belanja, arsip
- `budgets`: daftar per periode, buat, ubah
- `recurring`: daftar, buat, detail, ubah, jeda, lanjut, hentikan, kejadian, konfirmasi, lewati
- `notifications`: daftar, tandai satu, tandai semua
- `reports`: summary, categories, cashflow, networth, networth-check, debts
- `dashboard`
- `export`: csv, full, daftar pekerjaan, unduh

### Antarmuka web

| Layar | Berkas | Keadaan |
|---|---|---|
| Kerangka aplikasi, penjaga sesi, tata letak | `web/src/app.tsx`, `components/layout/` | Selesai · typecheck + build lulus |
| Masuk, daftar, pemulihan akun | `routes/auth/Auth.tsx` | Selesai |
| Beranda | `routes/beranda/Beranda.tsx` | Selesai |
| Transaksi: daftar, filter, catat, koreksi, batalkan | `routes/transaksi/Transaksi.tsx` | Selesai |
| Rencana: utang, tujuan, anggaran | `routes/rencana/` | Selesai |
| Laporan | `routes/laporan/Laporan.tsx` | Selesai |
| Profil: dompet, kategori, preferensi, ekspor | `routes/profil/Profil.tsx` | Selesai |
| Primitif UI, ikon gambar sendiri | `components/ui.tsx`, `components/icons.tsx` | Selesai |
| Grafik SVG gambar sendiri (garis, cincin) | `components/charts.tsx` | Selesai |
| Notifikasi jatuh tempo | `routes/notifikasi/Notifikasi.tsx` | Selesai |
| PWA: manifest, service worker, ikon | `web/public/` | Selesai |
| Draf lokal saat jaringan bermasalah | `lib/offline.ts` | Selesai |

**Lapisan sentuh (D-16).** Skala radius saat itu 12/18/26 px, kemudian diganti arah canon menjadi
pil 999 px, kendali 14 px, panel 24 px, dan lembar 28 px. `touch-action: pan-x pan-y` pada strip gulir,
`overscroll-behavior: contain` di lembar, baris buku besar 60px, safe-area di kepala dan bilah bawah,
`scroll-margin-top` pada target anchor, dan menu `Lainnya` menggantikan tiga tombol teks per dompet.
Diukur pada 390x844, 360x740, dan 320x568.

### Arah canon (D-18, D-19)

Redesain keempat, dengan konvensi aplikasi keuangan besar sebagai patokan yang dikunci pemilik: YNAB
(pekerjaan yang menunggu di banner paling atas), Copilot Money (urutan blok tetap dan nominal selalu
bertanda), Monzo (lembar bawah), Jenius (satu tombol di tengah bilah bawah). Seluruh enam slice rute
digarap: Beranda, Transaksi, Rencana, Laporan, Notifikasi, Profil, plus layar masuk.

| Yang berubah | Berkas | Keadaan |
|---|---|---|
| Lembar konfirmasi rencana berulang (FR17) | `routes/beranda/parts/RecurringSheet.tsx` | Selesai · terverifikasi lewat HTTP dan telusuri klik |
| Banner pekerjaan menunggu, arah nominal dari `ruleType` | `routes/beranda/parts/WorkBanner.tsx`, `lib/api.ts` | Selesai |
| Kartu "Dana belum dialokasikan" (FR04) di panel saldo | `routes/beranda/parts/SaldoPanel.tsx` | Selesai |
| Draf lokal ikut terhapus saat keluar | `lib/session.tsx` | Selesai |
| Nol tanpa arah: `+Rp0` tidak ada lagi | `lib/format.ts`, `components/ui.tsx` | Selesai · tes web 5/5 |
| Kolom tanda netral kosong (titik `·` dibaca minus) | `components/ui.tsx`, `styles/index.css` | Selesai · diukur 1.044 kolom, 0 titik netral |
| Kotak kiri baris transfer memakai glif transfer | `components/icons.tsx`, `routes/transaksi/Transaksi.tsx` | Selesai · 17 kotak, 0 kosong |
| Aksen gelap `#60a5fa` untuk label di atas tint | `styles/index.css` | Selesai · 4,30:1 menjadi 6,23:1 |
| Aksi kaki lembar 52 px di sembilan formulir | `components/forms/*Form.tsx` | Selesai · terukur 52 px |
| Aksi per-baris lembar berulang di tepi konten | `routes/beranda/parts/RecurringSheet.tsx` | Selesai · terukur 52 px |
| Sisa anggaran tidak lagi bertanda `+` | `routes/beranda/parts/BudgetNearLimit.tsx` | Selesai · `Rp952.500` tanpa tanda |

Dua aturan tampilan disempitkan sampai sesuai kenyataan: monospace hanya untuk nominal yang berdiri
sendiri sebagai angka, dan nol selalu netral. Rinciannya di `docs/DECISIONS.md` D-19 dan
`docs/DESIGN.md` bagian typography.

Setelah tinjauan desain kelima, tujuh cacat tampilan diperbaiki dan diukur ulang: tanda `+` palsu pada
sisa anggaran, titik netral di kolom tanda (berikut janji `DESIGN.md` yang ikut diperjelas), kotak
ikon kosong pada baris transfer, tombol kaki lembar yang tidak seragam, aksen gelap yang gagal AA,
aksi per-baris lembar yang menjorok, dan satu blok tes kolom tanda yang ikut dihapus bersama
glifnya. Rinciannya di `docs/DELIVERY_GATE.md` bagian D-18, cacat nomor 7 sampai 12.

### Skema basis data

Satu modul, `db/schema.ts` (`SCHEMA_SQL`), 25 tabel: pengguna dan sesi, ruang dan keanggotaan, akun buku besar,
dompet, kategori, transaksi, baris jurnal, tautan transaksi, pihak lawan, utang, pembayaran utang,
tujuan, alokasi tujuan, anggaran, aturan berulang, kejadian berulang, pengingat, log audit,
catatan idempotensi, pekerjaan data.

### Penyalaan produksi (persiapan, D-20)

| Bagian | Berkas | Keadaan |
|---|---|---|
| Kontrak lingkungan | `app/.env.example`, `docs/panduan/DEPLOY.md` | Selesai · dipakai tes smoke |
| Titik kesehatan bebas sesi + HSTS + cookie `Secure` | `server/src/http/server.ts`, `routes/auth.ts`, `config.ts` | Selesai · teruji |
| Gerbang pendaftaran (`IHSAN_ALLOW_REGISTRATION`) | `routes/auth.ts` | Selesai · teruji |
| Cadangan + pemulihan + retensi | `scripts/backup.mjs` | Selesai · teruji pada basis data yang sedang dipakai |
| Wadah | `Dockerfile`, `.dockerignore`, `compose.yaml` | Selesai · **belum dibangun** (Docker tidak ada di mesin ini) |
| VPS tanpa wadah | `deploy/systemd/ihsan.service`, `ihsan-backup.service`, `ihsan-backup.timer` | Selesai · dicoba di server pertama |
| Runbook | `docs/panduan/DEPLOY.md` | Selesai (dua bentuk penyalaan: satu proses, serverless) |
| Runbook mode A (VPS/mesin sendiri) | `docs/panduan/PANDUAN_PENYALAAN_VPS.md`, `deploy/caddy/Caddyfile.example`, `deploy/systemd/ihsan-offsite.service` + `.timer` | Selesai · belum dicoba di server sungguhan |
| Mode B hidup (Vercel Hobby + Turso + DNS) | `app/vercel.json`, `app/api/index.js`, `scripts/build-api.mjs` | Selesai · `https://ihsanpras.my.id` (deployment `dpl_EH1JVaCYk8P94AaSmevEsASNDed4`, commit `27b9238`): `/api/v1/health` 200 JSON, SPA 200 di `/`, `/transaksi`, `/tidak-ada`, API tanpa sesi 401 JSON, login salah 401, tick 403 tanpa token dan 200 bertoken, aset ber-hash `immutable` |

### Lapisan data libSQL dan penyalaan serverless (D-21)

| Bagian | Berkas | Keadaan |
|---|---|---|
| Port basis data (berkas atau Turso) | `server/src/db/index.ts` | Selesai · teruji: pemilihan klien, transaksi bersarang, isolasi konteks async, uang tetap `INTEGER` |
| Fungsi Vercel pembungkus Fastify | `server/src/vercel.ts`, `api/index.js` (entri git), `scripts/build-api.mjs`, `app/vercel.json` | Selesai · entri di git wajib ada sebelum build (D-24); paket fungsi hasil `vercel build` lokal berisi bundel 2.010.871 B, `filePathMap` kosong, 0 berkas `.ts`; dijalankan lewat soket HTTP nyata terhadap Turso produksi: health 200, login salah 401, dompet tanpa sesi 401, tick tanpa token 403 |
| Titik penjadwal ber-token | `server/src/http/routes/internal.ts` | Selesai · teruji: tanpa token 404/403, bertoken menjalankan penjadwal |
| Dump lintas mode + unggah S3/R2/B2 | `server/src/tools/offsite.ts`, `core/s3.ts`, `core/sigv4.ts` | Selesai · SigV4 cocok vektor resmi AWS; unggahan ke ember sungguhan **belum dicoba** (ember belum ada) |
| Perintah cadangan offsite | `app/package.json` (`offsite`, `offsite:dump`) | Selesai · dump 24 tabel/193 baris/408 KB dengan pemeriksaan jurnal; sumber Turso atau berkas lokal, hasilnya di `<IHSAN_DATA_DIR>/offsite` |
| Jadwal dump harian dari Windows | `deploy/windows/offsite.ps1` | Selesai · diuji di PowerShell 5.1: dump `PASS … jurnal seimbang, integritas ok` ke direktori sendiri, log UTF-8 di `%LOCALAPPDATA%\ihsan-offsite`, kode keluar diteruskan (`EXIT=2` saat `IHSAN_S3_*` kosong) |

Pemilik sudah memilih **Vercel Hobby + Turso Free + Cloudflare R2** dengan batas biaya gratis
(D-22), domain **ihsanpras.my.id** dikelola di IDWebhost (`ns1.idwebhost.id`,
`ns2.idwebhost.id`). Keadaan penghalang saat dicoba (2 Oktober 2026):

| Penghalang | Bukti nyata |
|---|---|
| Token Vercel hanya bisa baca | `GET /v2/user` 200 (`pras.ihsan@gmail.com`), tetapi `POST /v11/projects` 403 `you don't have permission to create the project` dan `GET /v2/user/tokens` 403 — token `vck_…` tanpa izin penuh, jadi proyek, env, domain, dan penyebaran belum bisa dibuat |
| R2 belum aktif di akun Cloudflare | token `cfat_…` aktif (`tokens/verify` → `active`), tetapi `GET …/r2/buckets` menjawab 10042 `Please enable R2 through the Cloudflare Dashboard` |
| Turso belum ada kredensial | `TURSO_API_TOKEN` masih `ISI_DI_SINI`; basis data produksi belum dibuat |
| DNS belum terdelegasi | `NS/SOA/A ihsanpras.my.id` → SERVFAIL di resolver Cloudflare dan Google, jadi zona di IDWebhost belum melayani jawaban |

Pemilik memutuskan menyalakan sendiri dari dashboard, jadi penyalaan tidak lewat REST API penyedia.
Langkah lengkapnya ada di `docs/panduan/PANDUAN_PENYALAAN.md`: Turso → proyek dan variabel Vercel → DNS di
IDWebhost → akun pemilik → lima pemeriksaan → ember R2 dan jadwal cadangan → pemulihan dan rotasi
token. Panduan itu memuat perintah verifikasi yang bisa disalin (`/api/v1/health`, tick tanpa dan
dengan token, fallback SPA, header cookie) beserta tabel gejala–penyebab–tindakan.

Belum tertutup setelah panduan dijalankan: koneksi Turso sungguhan, unggahan ke ember sungguhan,
alarm ketidakseimbangan jurnal di luar proses (NFR08), uji restore terjadwal tiga bulanan (NFR05),
dan pipeline CI.

Keadaan 3 Oktober 2026 (penyalaan dijalankan; menggantikan tabel penghalang di atas):

| Bagian | Keadaan |
|---|---|
| Token Vercel | berakses penuh — proyek `ihsan-finance-app` dibuat, sembilan variabel produksi terpasang, domain `ihsanpras.my.id` terverifikasi, penyebaran berjalan dari `main` |
| Turso | aktif — basis data `ihsan-finance` (24 tabel, `migrate` idempoten) |
| DNS | apex `A → 216.198.79.1` hidup, `NS` → `ns1`/`ns2.idwebhost.id`; `www` belum punya catatan |
| R2 | masih 10042 `Please enable R2 through the Cloudflare Dashboard`; pasangan kunci S3 menunggu pemilik |
| Akun pemilik | belum lahir; pendaftaran akun pertama tetap terbuka walau `IHSAN_ALLOW_REGISTRATION=0` |

Dua cacat nyata ditemukan saat menyalakan produksi dan sudah diperbaiki: Turso menolak
`PRAGMA user_version` lewat HTTP (D-21), dan fungsi Vercel mati pada impor pertama karena platform
mengirim hanya berkas `.js` sambil mempertahankan spesifier `.ts` (D-23). Sesudah keduanya,
`/api/v1/health` di fungsi hasil bundel menjawab 200 dengan sumber Turso sungguhan.

---

## Bukti verifikasi

Perintah dan hasil nyata, bukan klaim:

| Perintah | Hasil |
|---|---|
| `tsc --noEmit` server dan web | EXIT=0 keduanya |
| Tes server (`node --test`, satu concurrency) | **107/107 lulus** (termasuk `db-port` 10/10, `offsite` 11/11, `internal-tick` 3/3) |
| Tes web (`node --test`) | **5/5 lulus** |
| `vite build` | EXIT=0; `index-HPQJsJuM.js` 465.002 B (gzip 136.330 B), `index-Db3C64u0.css` 36.773 B (gzip 8.041 B) |
| `pnpm smoke` | **50 lulus, 0 gagal** |
| `impeccable detect` (dist, src, URL dev) | `[]` di ketiganya |
| Kontras WCAG AA | **3.724 pemeriksaan** (24 halaman: 6 rute x 2 viewport x 2 tema), 0 gagal; latar dihitung dengan mengompositkan tint `oklab(... / alfa)`, kendali kustom diukur pada labelnya |
| Luapan horizontal | 0 px di 24 halaman |
| Target sentuh | 0 kendali di bawah 44 px di 24 halaman; aksi di kaki sembilan lembar formulir, lembar entri cepat, dan lembar berulang 52 px |
| Nominal non-monospace | 0 dari 1.256 simpul `.figure` |
| Tanda nol yang berbohong (`+Rp0`, `-Rp0`) | 0 dari 500 angka bernilai nol di 24 halaman |
| Titik netral / sisa glif titik tengah di kolom tanda | 0 / 0 dari 1.044 kolom tanda |
| Kotak ikon baris kosong di `/transaksi` | 0 dari 17 kotak |
| Gradien CSS / gradien SVG pengkodean data grafik | 0 / 4 (satu per halaman `/laporan`, pengecualian tercatat) |
| Telusuri live (server dev hidup, 1 Oktober 2026) | 9 halaman (5 rute desktop 1440x900, 4 rute mobile 390x844) + 2 lembar: **0 galat konsol**, 0 luapan, 0 titik netral; lembar berulang 52 px / tutup 44 px, lembar saringan 4 tombol 44 px; mode gelap `--accent` `#60a5fa` di atas tint 14% = **6,23:1**; sembunyikan nominal 0 → 27 `.sign-dot` → 0. Tangkapan tanpa pemaskan di `.impeccable/review/live/` (10 PNG, tema terang + gelap) |
| Tes penyalaan produksi (`deploy.test.ts`, `deploy-local.test.ts`) | **5/5**: cookie `Secure` + HSTS saat `APP_ORIGIN` https, keduanya mati saat http, pendaftaran akun kedua dijawab 403 `forbidden`, titik kesehatan bebas sesi |
| Skrip cadangan (`scripts/backup.mjs`, server sedang menulis) | snapshot 408 KB: integritas ok, 0 pelanggaran relasi, jurnal seimbang; retensi memangkas yang tertua; berkas rusak/hilang keluar 1; `--restore` menghasilkan 17 transaksi, 3 dompet, selisih jurnal **0** |
| Smoke produksi satu proses (`NODE_ENV=production`, `APP_ORIGIN` https) | `/api/v1/health` 200 + HSTS, `/` 200 (982 B index), `/transaksi` 200 lewat fallback SPA, aset `immutable`, login demo 200 dengan cookie `Secure`, API tanpa sesi 401 |
| Adapter serverless (`server/src/vercel.ts` → bundel `api/index.js` dari `node scripts/build-api.mjs`, soket HTTP nyata) | paket fungsi hasil `vercel build` lokal (2.010.871 B, `filePathMap` kosong) terhadap Turso produksi: `/api/v1/health` 200 `{"data":{"ok":true,…}}`; `/api/v1/wallets` 401; login salah 401 `Email atau kata sandi belum cocok. Periksa lalu coba lagi.` (membuktikan baca/tulis lewat `@libsql/client/web` yang dibundel); tick tanpa token 403 |
| Klien remote dipilih untuk URL `libsql://` | `db.remote === true` dan kueri gagal di lapisan transpor (`tidak-ada.turso.invalid`), bukan galat modul/binding (`db-port.test.ts`) |
| Dump offsite dari basis data berkas (`pnpm offsite:dump`, mode A) | PASS — `sumber: …\app\data\ihsan.db`, 24 tabel, 193 baris, 408 KB, jurnal seimbang, `integrity_check` ok, segel `sha256`; berkas masuk `data/offsite/` dan snapshot `data/backups/` tidak tersentuh |
| SigV4 terhadap vektor resmi AWS | 2/2 (`get-vanilla` `5fa00fa3…`, `get-vanilla-query-order-key-case` `b97d918c…`) |
| Gerbang penuh (`NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir app verify`) | EXIT=0 dalam ±71 detik: tsc server+web, 107 tes server, 5 tes web, `vite build` |
| Produksi Vercel setelah D-24 (commit `c9ea81a`, lalu `27b9238`) | `curl.exe -4` ke `https://ihsanpras.my.id`: `/api/v1/health` 200 `{"data":{"ok":true,…}}`; `/` 200 (`index.html` 982 B); `/transaksi` 200; `/tidak-ada` 200 lewat fallback SPA; `/api/v1/wallets` 401 `Sesi tidak ditemukan…`; login salah 401 `Email atau kata sandi belum cocok…`; `/api/v1/internal/tick` 403 tanpa token dan 200 `{"data":{"today":"2026-10-03",…}}` dengan `Bearer $CRON_SECRET`; HSTS + `X-Content-Type-Options: nosniff`; `/sw.js` 200; `/manifest.webmanifest` 200; `/assets/index-HPQJsJuM.js` `Cache-Control: public, max-age=31536000, immutable`, halaman SPA `max-age=0, must-revalidate` |
| Alur terautentikasi lewat bundel produksi ke Turso (basis data uji terpisah `ihsan-uji-*`, dibuat lewat Turso Platform API lalu dihapus) | register (kode pemulihan dikembalikan) → login (cookie `Secure`) → kategori bawaan ≥ 10 → dompet saldo `1000000` → pendapatan `5000000` + pengeluaran `100000` → kunci idempotensi sama mengembalikan id sama, muatan beda **409** → ringkasan AT01 `5000000`/`100000`/`4900000`/`5900000` → pembatalan → `0`/`900000` → `networth-check` `match: true` → pemulihan kata sandi dengan kode pemulihan (kata sandi baru 200, lama 401) → akun kedua ditolak **403**; proses baru (cold start) membaca angka yang sama, jadi data persisten dan migrasi idempoten. Basis data produksi tidak tersentuh: login akun uji ke `https://ihsanpras.my.id` → **401** |
| UI produksi (Chromium headless, viewport 412x880) | `https://ihsanpras.my.id/masuk` judul "Ihsan Finance", tab "Masuk"/"Daftar", 2 input pada tab masuk dan 4 pada tab daftar (nama tampilan, email, kata sandi, zona waktu `Asia/Jakarta`), service worker aktif (`https://ihsanpras.my.id/sw.js`), **0 galat konsol** |
| Variabel lingkungan produksi (Vercel API) | `APP_ORIGIN=https://ihsanpras.my.id`, `CRON_SECRET`, `IHSAN_ALLOW_REGISTRATION`, `IHSAN_DB_URL`, `IHSAN_DB_TOKEN`, `IHSAN_TRUST_PROXY=1`, `LOG_LEVEL=warn`, `SESSION_DAYS` terpasang untuk target production+preview |
| Produksi Vercel setelah D-26 + D-27 (deploy `dpl_HDCtADZd38i8TdYnwSnHJ5fwJxbN`, commit `4a3b95d`) | `region: ["hnd1"]` diterima paket Hobby, fungsi jadi sedekat basis data Tokyo; hangat: `/api/v1/health` **157-181 ms** (sebelum 300 ms di `iad1`), `/api/v1/internal/tick` **216-263 ms** (sebelum 1,7-1,8 dtk), login surel tidak dikenal **200-214 ms** (sebelum 0,82 dtk), `/api/v1/wallets` tanpa sesi 150-184 ms; `/masuk` TTFB 80 ms / FCP 236 ms pada 4G + CPU 4x cache kosong (sebelum 192 / 1852 ms); panggilan pertama sesudah deploy masih 406-732 ms karena instance dingin; `curl.exe -4` ke `https://ihsanpras.my.id`: health 200, wallets 401, `/masuk` 200, tick tanpa token 403 dan dengan `Bearer $CRON_SECRET` 200, aset `immutable` 200; UI di 360x800 pada ruang kosong dan ruang berisi, tema terang dan gelap: 0 luapan, 0 em dash, kendali terkecil 44 px, lembar saringan 25 tombol 44 px berkaki "Selesai", layar masuk bermonogram `IF` tanpa teks `[LOGO]` |

Catatan lingkungan: mesin pengembangan ini 8 GB dengan memori bebas ~1 GB saat gerbang berjalan,
jadi `.githooks/pre-commit` memasang `NODE_OPTIONS=--max-old-space-size=1536` sendiri bila pemanggil
belum menyetelnya. Tanpa batas heap Node abort dengan `Zone Allocation failed` dan keluar 134;
batas 2560 MB justru lebih sering abort pada mesin ini, karena yang habis adalah memori sistem,
bukan ruang lama V8. Perintah yang terbukti: hook keluar 0, `tsc --noEmit` (server dan web) EXIT=0,
tes server **107/107**, tes web **5/5**, `vite build` EXIT=0.

Jaringan mesin ini juga merusak IPv6: alamat NAT64 (`64:ff9b::…`) tidak bisa dihubungi, sehingga
`curl` dan `git` gagal `Recv failure: Connection was reset`. Perintah verifikasi karena itu selalu
`curl.exe -4`, dan `git push` yang butuh `Proxy-Connection` dijalankan lewat proxy CONNECT IPv4
lokal sementara di `127.0.0.1:9999` (`git -c http.proxy=http://127.0.0.1:9999 push origin main`);
perintah Node memakai `NODE_OPTIONS=--dns-result-order=ipv4first`.

Cakupan skenario penerimaan yang diuji otomatis, memakai penomoran PRD §15:

| Skenario | Isi | Bukti |
|---|---|---|
| AT01 | Saldo awal, pendapatan, belanja | `transactions.test.ts`, `smoke` |
| AT02 | Transfer dengan biaya | `transactions.test.ts`, `smoke` |
| AT03 | Kas awal nol, terima utang, bayar pokok dan bunga | `debts.test.ts`, `smoke` |
| AT04 | Beri piutang, terima pelunasan | `debts.test.ts`, `planning-api.test.ts` |
| AT05 | Alokasi ke tujuan | `goals.test.ts`, `smoke` |
| AT06 | Belanja dari dana tujuan | `goals.test.ts`, `smoke` |
| AT07 | Belanja lalu refund | `transactions.test.ts`, `smoke` |
| AT08 | Pembayaran melebihi sisa pokok ditolak | `debts.test.ts` |
| AT09 | Kunci idempotensi yang sama | `transactions.test.ts`, `smoke` |
| AT10 | Pembatalan pembayaran mengembalikan saldo | `debts.test.ts`, `smoke` |
| AT11 | Anggaran mendekati dan melewati batas | `budgets.test.ts`, `smoke` |
| AT12 | Saldo lama tidak mengubah kas | `debts.test.ts`, `planning-api.test.ts` |
| AT13 | Akses data ruang lain ditolak | `api.test.ts`, `planning-api.test.ts`, `smoke` |
| AT14 | Draf lokal tidak mengubah saldo, simpan ulang tidak menggandakan | `lib/offline.ts` (draf) + idempotensi teruji; alur peramban belum otomatis |
| AT15 | Tanggal 31 jatuh ke akhir bulan dan kembali | `recurring.test.ts` |
| AT16 | Koreksi memperbarui anggaran dan laporan, jurnal lama tetap ada | `at16.test.ts` |
| AT17 | Kekurangan dana tujuan | `goals.test.ts`, `planning-api.test.ts` |
| AT18 | Alur di HP tanpa tombol terputus | Telusuri klik pada 360x800; belum otomatis |

AT18 belum punya tes otomatis: yang ada adalah telusuri klik manual pada 360x800 (lihat
`docs/DELIVERY_GATE.md`). AT14 diuji pada sisi draf dan sisi idempotensi secara terpisah,
bukan sebagai satu alur peramban.

### Cacat yang ditemukan dan diperbaiki selama verifikasi

| Cacat | Ditemukan oleh | Perbaikan |
|---|---|---|
| `parseAmount` membaca "1000.5" sebagai 10005 | tes validasi HTTP | Bentuk string divalidasi ketat di `core/money.ts`; bersen ditolak |
| `/api/v1/health` ikut terkunci sesi | tes integrasi HTTP | Pengecualian sesi untuk health dan auth |
| Saldo negatif tampil tanpa tanda minus di Profil | telusuri klik peramban | Logika tanda dipindahkan ke `moneySign` di `lib/format.ts` + 5 tes regresi |
| Lembar mengambang tanpa bayangan padahal `DESIGN.md` menyatakannya | audit gerbang | Token `--shadow-sheet` hanya untuk `.sheet-enter` |
| Kejadian berulang baru muncul setelah penjadwal berjalan | tes integrasi HTTP | `ensureOccurrences` dipanggil saat aturan dibuat atau diubah |
| `tx()` gagal saat dipanggil bersarang | penalaran sebelum uji | SAVEPOINT untuk transaksi bersarang di `db/index.ts` |
| Skala tombol `sm` menghasilkan tinggi sentuh 36 px | laporan anggota tim | `BUTTON_SIZE` menetapkan `min-h-[44px]` di ketiga ukuran; yang mengecil hanya padding dan huruf |
| Tab, aksi notifikasi, tautan merek, tautan lompat di bawah 44 px | telusuri klik peramban | Semuanya dinaikkan ke `min-h-[44px]`; 135 kendali di 5 layar kini patuh |
| `getBudget` dan `getNotification` tidak terjangkau HTTP | pemeriksaan kelengkapan permukaan | `GET /budgets/:id` dan `GET /notifications/:id` ditambah, dengan tes termasuk penolakan ruang lain |
| Bulan berjalan salah saat data contoh dibuat | temuan sesi canon | `bookedThisMonth`/`dayOfThisMonth`, `seedDemo(db, at)`, penjaga entrypoint; tes `seed.test.ts` |
| Pengingat jatuh tempo salah menghitung sisa hari | temuan sesi canon | `DEBT_REMINDER_OFFSETS`, `describeDaysLeft`, `formatDateID`; tes `recurring.test.ts` |
| Pembaca layar tidak mengucapkan arah nominal | audit aksesibilitas | Kata `sr-only` "plus"/"minus" di `Money`, sejalan dengan glif kolom tanda |
| Baris pembanding Laporan menampilkan "+Rp0" | audit gerbang | `moneySign` mengembalikan tanda kosong untuk nol; `Money` memperlakukan nol sebagai netral |
| Label banner "Catat transaksi berulang" membuka formulir kosong | telusuri klik | Lembar `RecurringSheet` memanggil `confirmOccurrence`/`skipOccurrence` |
| Kejadian berulang pendapatan tampil sebagai "-Rp8.500.000" | penalaran sebelum uji | Arah dibaca dari `ruleType`, bukan di-hardcode `out` |
| Baris meta jadwal terpotong di 390 px | telusuri klik | Nominal pindah ke baris judul, meta memakai lebar penuh |
| Kartu FR04 dihitung server tetapi tidak pernah tampil | pemeriksaan kelengkapan PRD | Kartu "Dana belum dialokasikan" di panel saldo dengan penjelasan pencegah salah tafsir |
| 16 ekspor mati | pemeriksaan kelengkapan | Dihapus: `BarChart`, 7 ikon, `loadDraft`, `DAYS_ID`, `formatDayName`, `FREQUENCY_LABEL`, `isPositive`, `useMediaQuery` |
| Sisa anggaran bertanda `+` untuk uang yang belum dibelanjakan | tinjauan desain | Arah dibaca dari nilainya: hanya saldo lewat batas yang bertanda minus |
| Titik netral di kolom tanda terbaca sebagai minus | tinjauan desain (dua pembacaan tangkapan) | Kolom netral kosong, lebarnya dikunci `1ch`; satu blok tes kolom tanda dihapus |
| Kotak ikon kosong pada baris transfer setelah glif netral dihapus | tinjauan desain | Glif transfer baru di `icons.tsx` untuk baris tanpa arah |
| Tombol Batal 44 px di samping Simpan 52 px di kaki lembar | tinjauan desain | Aksi di kaki sembilan lembar formulir `size="lg"` (18 tombol); kaki lembar lain tetap 44 px dengan pasangan setinggi sama |
| Penanda navigasi aktif mode gelap 4,30:1 (gagal AA) | tinjauan desain (komposit gaya terhitung) | `--accent` gelap `#3b82f6` menjadi `#60a5fa` |
| Aksi per-baris lembar berulang menjorok di bawah kolom teks | tinjauan desain | Tombol duduk di tepi konten lembar, keduanya 52 px |
| Angka durasi gerak di gerbang tidak cocok dengan kode | tinjauan desain putaran kelima | Bagian Motion di `DESIGN.md` mencatat angka nyata (150ms, tekan `translateY(1px)`, lembar 200ms); item 9 klaim lama |
| 43 rujukan `DESIGN.md §N` menunjuk penomoran yang sudah tidak ada | pemeriksaan dokumen terhadap kode | Semua diganti nama bagian (`"Kolom tanda"`, `"Motion"`, dst); padanan blok lama di kepala gerbang |
| Baris R-11 dan R-06 blok D-15 tidak akurat terhadap kode | tinjauan desain putaran kelima | Blok D-18 memakai angka DOM (999/14/24/28) dan menyebut label kapital 11,5 px; item 11 dan 12 klaim lama |

---

## Yang belum selesai

| Hal | Alasan | Langkah berikutnya |
|---|---|---|
| AT14 sebagai satu alur peramban | Butuh dua peramban nyata dan pemutusan jaringan | Uji manual dengan mode luring peramban |
| AT18 sebagai tes otomatis | Butuh perkakas uji peramban yang terpasang di `pnpm verify` | Pindahkan telusuri klik ke skrip gerbang |
| Waktu muat pada perangkat kelas menengah | Butuh pengukuran pada perangkat target | Ukur dengan data contoh penuh |
| Pemeriksaan kontras otomatis | Dijalankan manual lewat peramban, belum masuk `pnpm verify` | Pindahkan pemeriksa kontras ke skrip gerbang; hasil ad hoc terakhir di `.impeccable/review/audit-d18.json` |
| Peran kedua (anggota ruang) | P0 hanya pemilik tunggal per PRD | Di luar cakupan P0 |
| Bahasa dokumen dan komentar | Penyimpangan sadar dari `AGENTS.md` aturan 7 | Menunggu keputusan pemilik; lihat `DECISIONS.md` D-13 |
| Akun pemilik di produksi | Turso produksi berisi satu pengguna bernama "Ihsan" (email Gmail disamarkan `p*********@gm*******`) dengan ruang "Keuangan Ihsan": dibuat 2026-10-03T22:47:27Z, sesi terakhir terlihat 22:49:23Z, saat diperiksa masih 0 dompet dan 0 transaksi. Karena akun pertama sudah lahir, pendaftaran akun kedua tertutup sendiri | Pemilik cukup masuk di `https://ihsanpras.my.id/masuk`; bila akun itu ternyata bukan miliknya, hentikan pemakaian dan laporkan dulu — kredensial produksi perlu dirotasi dan basis data dibersihkan |
| Cadangan offsite ke R2 | R2 belum diaktifkan di akun Cloudflare (kode 10042) | Pemilik menekan **Enable R2**, lalu isi `R2_*` dan `IHSAN_S3_*`; jalankan `node server/src/tools/offsite.ts all` |
| `www.ihsanpras.my.id` | CNAME `www` belum ada di IDWebhost (NXDOMAIN di NS otoritatif) | Pemilik menambah `CNAME www → cname.vercel-dns.com`, lalu domain `www` ditambahkan di proyek Vercel |
| Rotasi kredensial yang pernah tampil di obrolan | Token Vercel, Turso, dan Cloudflare pernah tercetak | Pemilik merotasi ketiganya setelah penyalaan selesai |

### Catatan AT14

AT14 meminta dua hal: draf luring tidak mengubah saldo, dan menyimpan ulang setelah koneksi
pulih menghasilkan satu transaksi, bukan dua. Keduanya sudah benar secara rancangan dan teruji
terpisah:

- Draf hidup di `localStorage` (`web/src/lib/offline.ts`) dan tidak pernah menyentuh jurnal
  sampai server menerima permintaan simpan. Tidak ada jalur yang membuat draf mengubah saldo.
- Setiap mutasi membawa `Idempotency-Key`, dan kunci sama dengan muatan sama mengembalikan
  transaksi yang sama. Diuji di `transactions.test.ts`, `api.test.ts`, dan `smoke`.

Yang belum ada adalah satu tes peramban yang memutus jaringan sungguhan lalu memulihkannya.
Itu sebabnya AT14 belum dicentang penuh.

## Batas yang dijaga

1. **Tidak ada floating point untuk uang.** Semua nominal adalah `INTEGER` rupiah; API memakai
   string desimal.
2. **Tidak ada `UPDATE`/`DELETE` pada `journal_lines` yang sudah dibukukan.** Koreksi selalu
   pembalikan + pengganti.
3. **Setiap query finansial memfilter `workspace_id` dari sesi.** Diuji di `AT13` pada dompet,
   transaksi, utang, dan ekspor.
4. **Setiap mutasi menerima `Idempotency-Key`.** Kunci sama + muatan sama mengembalikan hasil
   yang sama; kunci sama + muatan beda ditolak.
5. **Saldo selalu turunan dari ledger.** Ada pemeriksaan silang `/reports/networth-check` yang
   membandingkan nilai turunan modul dengan saldo akun buku besar.
