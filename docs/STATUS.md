# Status Implementasi: Ihsan Finance

Diperbarui: 1 Oktober 2026
Sumber kebenaran: `PRD_Aplikasi_Keuangan_Pribadi_v1.md` · Kontrak teknis: `docs/ARCHITECTURE.md`
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

Satu berkas, `db/schema.sql`, 25 tabel: pengguna dan sesi, ruang dan keanggotaan, akun buku besar,
dompet, kategori, transaksi, baris jurnal, tautan transaksi, pihak lawan, utang, pembayaran utang,
tujuan, alokasi tujuan, anggaran, aturan berulang, kejadian berulang, pengingat, log audit,
catatan idempotensi, pekerjaan data.

### Penyalaan produksi (persiapan, D-20)

| Bagian | Berkas | Keadaan |
|---|---|---|
| Kontrak lingkungan | `app/.env.example`, `docs/DEPLOY.md` | Selesai · dipakai tes smoke |
| Titik kesehatan bebas sesi + HSTS + cookie `Secure` | `server/src/http/server.ts`, `routes/auth.ts`, `config.ts` | Selesai · teruji |
| Gerbang pendaftaran (`IHSAN_ALLOW_REGISTRATION`) | `routes/auth.ts` | Selesai · teruji |
| Cadangan + pemulihan + retensi | `scripts/backup.mjs` | Selesai · teruji pada basis data yang sedang dipakai |
| Wadah | `Dockerfile`, `.dockerignore`, `compose.yaml` | Selesai · **belum dibangun** (Docker tidak ada di mesin ini) |
| VPS tanpa wadah | `deploy/systemd/ihsan.service`, `ihsan-backup.service`, `ihsan-backup.timer` | Selesai · dicoba di server pertama |
| Runbook | `docs/DEPLOY.md` | Selesai (dua bentuk penyalaan: satu proses, serverless) |

### Lapisan data libSQL dan penyalaan serverless (D-21)

| Bagian | Berkas | Keadaan |
|---|---|---|
| Port basis data (berkas atau Turso) | `server/src/db/index.ts` | Selesai · teruji: pemilihan klien, transaksi bersarang, isolasi konteks async, uang tetap `INTEGER` |
| Fungsi Vercel pembungkus Fastify | `app/api/index.ts`, `app/vercel.json` | Selesai · dijalankan lewat soket HTTP nyata (health, register, dompet, fallback SPA) |
| Titik penjadwal ber-token | `server/src/http/routes/internal.ts` | Selesai · teruji: tanpa token 404/403, bertoken menjalankan penjadwal |
| Dump lintas mode + unggah S3/R2/B2 | `server/src/tools/offsite.ts`, `core/s3.ts`, `core/sigv4.ts` | Selesai · SigV4 cocok vektor resmi AWS; unggahan ke ember sungguhan **belum dicoba** (ember belum ada) |
| Perintah cadangan offsite | `app/package.json` (`offsite`, `offsite:dump`) | Selesai · dump 24 tabel/193 baris/408 KB dengan pemeriksaan jurnal; sumber Turso atau berkas lokal, hasilnya di `<IHSAN_DATA_DIR>/offsite` |

Pemilik sudah memilih **Vercel Hobby + Turso Free + Cloudflare R2** dengan batas biaya gratis
(D-22), dan sudah punya domain. Belum tertutup: nama domain + penyedia DNS, kredensial
(`C:\Users\HP\.ihsan-prod.env` masih berisi penanda `ISI_DI_SINI`), koneksi Turso sungguhan, ember
cadangan, alarm di luar proses, uji restore terjadwal tiga bulanan, dan pipeline.

---

## Bukti verifikasi

Perintah dan hasil nyata, bukan klaim:

| Perintah | Hasil |
|---|---|
| `tsc --noEmit` server dan web | EXIT=0 keduanya |
| Tes server (`node --test`, satu concurrency) | **106/106 lulus** (termasuk `db-port` 9/9, `offsite` 11/11, `internal-tick` 3/3) |
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
| Adapter serverless (`app/api/index.ts`, soket HTTP nyata) | `/api/v1/health` 200; tick tanpa token 403, bertoken 200 `{"today":"2026-10-01",…}`; register 200 + cookie `ifsess`; `GET /api/v1/wallets` 200; fallback SPA 200 |
| Klien remote dipilih untuk URL `libsql://` | `db.remote === true` dan kueri gagal di lapisan transpor (`tidak-ada.turso.invalid`), bukan galat modul/binding (`db-port.test.ts`) |
| Dump offsite dari basis data berkas (`pnpm offsite:dump`, mode A) | PASS — `sumber: …\app\data\ihsan.db`, 24 tabel, 193 baris, 408 KB, jurnal seimbang, `integrity_check` ok, segel `sha256`; berkas masuk `data/offsite/` dan snapshot `data/backups/` tidak tersentuh |
| SigV4 terhadap vektor resmi AWS | 2/2 (`get-vanilla` `5fa00fa3…`, `get-vanilla-query-order-key-case` `b97d918c…`) |
| Gerbang penuh (`NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir app verify`) | EXIT=0 dalam ±66 detik: tsc server+web, 106 tes server, 5 tes web, `vite build` |

Catatan lingkungan: mesin pengembangan ini 8 GB dengan memori bebas ~1 GB saat gerbang berjalan,
jadi `.githooks/pre-commit` memasang `NODE_OPTIONS=--max-old-space-size=1536` sendiri bila pemanggil
belum menyetelnya. Tanpa batas heap Node abort dengan `Zone Allocation failed` dan keluar 134;
batas 2560 MB justru lebih sering abort pada mesin ini, karena yang habis adalah memori sistem,
bukan ruang lama V8. Perintah yang terbukti: hook keluar 0, `tsc --noEmit` (server dan web) EXIT=0,
tes server **106/106**, tes web **5/5**, `vite build` EXIT=0.

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
