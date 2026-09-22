# Status Implementasi: Ihsan Finance

Diperbarui: 22 September 2026
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

`pnpm verify` menjalankan pemeriksaan tipe di kedua paket, **74 tes server**, **6 tes antarmuka**,
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
| PWA: manifest, service worker, ikon | `web/public/` | Selesai |
| Draf lokal saat jaringan bermasalah | `lib/offline.ts` | Selesai |

### Skema basis data

Satu berkas, `db/schema.sql`, 25 tabel: pengguna dan sesi, ruang dan keanggotaan, akun buku besar,
dompet, kategori, transaksi, baris jurnal, tautan transaksi, pihak lawan, utang, pembayaran utang,
tujuan, alokasi tujuan, anggaran, aturan berulang, kejadian berulang, pengingat, log audit,
catatan idempotensi, pekerjaan data.

---

## Bukti verifikasi

Perintah dan hasil nyata, bukan klaim:

| Perintah | Hasil |
|---|---|
| `pnpm verify` | lulus menyeluruh (typecheck server, 74 tes server, typecheck web, 6 tes web, build) |
| `pnpm --dir web build` | 60 modul, `dist/assets/index-*.js` 426,73 kB (gzip 124,36 kB) |
| `pnpm smoke` | **50 lulus, 0 gagal** |
| Telusuri klik `agent-browser` (R-35) | 13 langkah di Chrome 153, dua ukuran jendela, dua tema |
| Kontras WCAG AA | **1.276 pemeriksaan** (637 gelap + 639 terang, 5 layar), 0 gagal |
| Luapan horizontal 360x800 | `scrollWidth 360 = clientWidth 360`, 0 elemen melewati tepi |
| Target sentuh | 135 kendali x 2 tema, 0 di bawah 44 px |
| Nilai di luar skala huruf dan jarak | 0 di seluruh `web/src` |

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

---

## Yang belum selesai

| Hal | Alasan | Langkah berikutnya |
|---|---|---|---|
| AT14 sebagai satu alur peramban | Butuh dua peramban nyata dan pemutusan jaringan | Uji manual dengan mode luring peramban |
| AT18 sebagai tes otomatis | Butuh perkakas uji peramban yang terpasang di `pnpm verify` | Pindahkan telusuri klik ke skrip gerbang |
| Waktu muat pada perangkat kelas menengah | Butuh pengukuran pada perangkat target | Ukur dengan data contoh penuh |
| Pemeriksaan kontras otomatis | Dijalankan manual lewat peramban, belum masuk `pnpm verify` | Pindahkan pemeriksa kontras ke skrip gerbang |
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
