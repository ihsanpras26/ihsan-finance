# Catatan Keputusan: Ihsan Finance

Setiap keputusan yang menyimpang dari, atau memperjelas, PRD dicatat di sini. Bila kode dan PRD
berbeda, PRD menang; entri di bawah ini menjelaskan mengapa kode berbentuk demikian.

---

## D-01 · Runtime tanpa langkah build di server

**Tanggal:** 22 September 2026
**Konteks:** PRD menetapkan Node 24 dan `node:sqlite`, tanpa menyebut alat build.
**Keputusan:** Server berjalan sebagai TypeScript langsung (`node server/src/main.ts`) memakai
type-stripping bawaan Node 24. Tidak ada `tsc` pada jalur produksi, tidak ada `dist/`.
**Alasan:** Menghapus satu langkah build berarti satu kelas kegagalan lebih sedikit, dan `tsc`
tetap dipakai sebagai pemeriksa tipe (`pnpm typecheck`). Impor internal memakai akhiran `.ts`
karena itu yang dibutuhkan penyelesai ESM Node.
**Konsekuensi:** Kode server tidak boleh memakai fitur TypeScript yang butuh transformasi
(enum, `namespace`, dekorator, parameter property). Sudah dipatuhi seluruh modul.

## D-02 · Uang sebagai bilangan bulat rupiah di seluruh sistem

**Tanggal:** 22 September 2026
**Konteks:** PRD §11 melarang floating point untuk nominal dan meminta string desimal di API.
**Keputusan:** Kolom basis data `INTEGER` dalam rupiah penuh. Batas per peristiwa
Rp999.999.999.999, diperiksa di `core/money.ts`. Di API, nominal selalu keluar sebagai string
desimal (`toDecimalString`) dan masuk lewat `parseAmount`.
**Alasan:** Bilangan bulat menghapus galat pembulatan; string menjaga presisi saat melewati JSON.
**Konsekuensi:** `parseAmount` menolak `"1000.5"` alih-alih membacanya sebagai `10005`. Titik
hanya diterima sebagai pemisah ribuan dengan pola `1.000.000`. Ini ditemukan lewat tes dan
diperbaiki pada `core/money.ts`.

## D-03 · Tipe transaksi yang jujur untuk pencairan utang dan pemberian piutang

**Tanggal:** 22 September 2026
**Konteks:** Skema awal hanya punya `debt_payment` dan `receivable_payment`, yaitu tipe untuk
pembayaran, bukan untuk peristiwa pencairan.
**Keputusan:** Menambah `debt_received` dan `receivable_given` ke `CHECK (type IN (...))` di
`db/schema.sql`.
**Alasan:** Alternatifnya adalah menumpangkan pencairan utang pada tipe `debt_payment` atau
`adjustment`, yang membuat laporan per jenis menyesatkan. Jurnal tetap penentu dampak (§10);
`type` hanya label peristiwa.
**Konsekuensi:** Tidak ada migrasi karena skema masih versi pertama dan basis data dibuat ulang.

## D-04 · `tx()` dapat dipanggil bersarang dengan SAVEPOINT

**Tanggal:** 22 September 2026
**Konteks:** `correctTransaction` membuat pembalikan dan pengganti di dalam satu transaksi, dan
memanggil `createTransaction` yang membuka transaksinya sendiri. SQLite menolak `BEGIN` bersarang.
**Keputusan:** `db/index.ts` menyimpan kedalaman transaksi per koneksi di `WeakMap`. Panggilan
teratas memakai `BEGIN IMMEDIATE`; panggilan bersarang memakai `SAVEPOINT`.
**Alasan:** `BEGIN IMMEDIATE` di panggilan teratas mengambil kunci tulis lebih awal sehingga
penulis bersamaan tidak dapat menyela; SAVEPOINT menjaga sifat atomik tanpa mengubah pemanggil.
**Konsekuensi:** Setiap fungsi domain boleh memanggil fungsi domain lain tanpa memikirkan
transaksi. Ini yang membuat "satu penulisan transaksi + jurnal + alokasi = satu transaksi DB"
(§13) benar-benar berlaku.

## D-05 · `planned` ditentukan tanggal, bukan pilihan pengguna

**Tanggal:** 22 September 2026
**Konteks:** PRD §05 dan §10 menyatakan transaksi bertanggal masa depan menjadi rencana dan belum
mengubah saldo.
**Keputusan:** `createTransaction` menetapkan `status = 'planned'` otomatis bila
`effective_date` lebih besar dari hari ini di zona waktu ruang. Rencana tidak punya baris jurnal.
**Alasan:** Aturan ini adalah konsekuensi tanggal, bukan preferensi; menjadikannya pilihan
pengguna akan menciptakan keadaan tidak sah yang harus divalidasi di tempat lain.
**Konsekuensi:** `POST /transactions/:id/post` mengonfirmasi rencana menjadi pos nyata.

## D-06 · Koreksi transaksi = pembalikan + pengganti, bukan UPDATE

**Tanggal:** 22 September 2026
**Konteks:** PRD §13 melarang `UPDATE`/`DELETE` pada `journal_lines` yang sudah dibukukan.
**Keputusan:** `PATCH /transactions/:id` pada transaksi `posted` membuat transaksi pembalikan
bertanggal efektif asli, lalu transaksi pengganti bertanggal pilihan pengguna, lalu menandai
aslinya `reversed`. Ketiganya tersimpan dan tampil di `history`.
**Alasan:** Sejarah keuangan harus dapat diaudit; mengubah baris yang sudah dibukukan akan
menghapus jejak.
**Konsekuensi:** Rencana (`planned`) masih boleh diedit langsung tanpa pembalikan, sesuai §10.
Pembatalan ditolak bila ada refund yang menunjuk transaksi itu (`has_dependencies`).

## D-07 · Alokasi tujuan tidak menciptakan jurnal

**Tanggal:** 22 September 2026
**Konteks:** PRD §07 dan FR14: alokasi "menandai" dana, bukan memindahkannya.
**Keputusan:** `goal_allocations` tidak menulis `journal_lines`. Yang berjurnal hanya belanja dari
dana tujuan (`spendFromGoal`), yang benar-benar mengeluarkan uang dari dompet.
**Alasan:** Alokasi adalah janji internal atas saldo yang sudah ada; memberinya jurnal akan
menggandakan uang dan merusak keseimbangan neraca.
**Konsekuensi:** Batas "dana yang sama tidak bisa dipakai dua tujuan" ditegakkan dengan
membandingkan total alokasi aktif per dompet terhadap saldo dompet, bukan lewat jurnal.

## D-08 · Kesehatan aplikasi (`/health`) tetap terbuka

**Tanggal:** 22 September 2026
**Konteks:** Kait `preHandler` menuntut sesi untuk semua jalur `/api/`.
**Keputusan:** `/api/v1/health` dan seluruh `/api/v1/auth/*` dikecualikan dari syarat sesi.
**Alasan:** Pemeriksaan kesiapan dan alur masuk memang harus dapat dijangkau sebelum ada sesi.
Ditemukan lewat tes integrasi HTTP, bukan lewat penalaran.

## D-09 · Pembatalan pembayaran utang memakai transaksi pembalikan, bukan penghapusan baris

**Tanggal:** 22 September 2026
**Konteks:** PRD §10 meminta pembatalan pembayaran mengembalikan saldo dan menaikkan kewajiban.
**Keputusan:** `cancelDebtPayment` membuat transaksi pembalikan atas transaksi pembayaran dan
menghitung ulang status catatan (`paid` kembali menjadi `active` bila sisa pokok kembali positif).
**Alasan:** Sama dengan D-06: jejak pembayaran tetap ada untuk audit.
**Konsekuensi:** Status catatan adalah nilai turunan dari sisa pokok, bukan sumber kebenaran.

## D-10 · Rencana berulang mengisi kejadian saat aturan dibuat

**Tanggal:** 22 September 2026
**Konteks:** Penjadwal (`workers/scheduler.ts`) yang membuat kejadian tertinggal berjalan
berkala, sehingga aturan yang baru dibuat belum menampilkan kejadian apa pun.
**Keputusan:** Rute `POST /recurring` dan `PATCH /recurring/:id` memanggil `ensureOccurrences`
segera setelah perubahan, di lapisan HTTP.
**Alasan:** Pengguna yang baru membuat aturan harus langsung melihat butir yang menunggu
konfirmasi. Penjadwal tetap ada untuk kejadian yang jatuh tempo belakangan.
**Konsekuensi:** `ensureOccurrences` wajib idempoten; sudah diuji dengan pengulangan.

## D-11 · Data contoh dijalankan lewat perkakas, bukan lewat migrasi

**Tanggal:** 22 September 2026
**Keputusan:** `server/src/tools/seed.ts` membuat satu akun demo beserta dompet, kategori,
transaksi, utang, tujuan, anggaran, dan aturan berulang. Tidak ada data contoh di jalur migrasi.
**Alasan:** Basis data produksi tidak boleh berisi data karangan.
**Konsekuensi:** `pnpm seed` aman diulang; ia berhenti bila akun demo sudah ada.

## D-12 · Pemisahan yang sengaja: `draftsPending` dihitung di peramban

**Tanggal:** 22 September 2026
**Konteks:** FR22 meminta draf transaksi disimpan lokal saat jaringan bermasalah.
**Keputusan:** Draf hidup di `localStorage` (lihat `web/src/lib/offline.ts`). `/dashboard`
mengembalikan `draftsPending: 0`; angka sebenarnya diisi lapisan web.
**Alasan:** Draf adalah keadaan perangkat, bukan keadaan akun; menyimpannya di server akan
membuat draf satu perangkat muncul di perangkat lain.
**Konsekuensi:** Angka pada beranda hanya benar bila lapisan web menimpanya. Ini titik integrasi
yang harus dijaga saat mengubah beranda.

## D-13 · Bahasa dokumen teknis dan komentar

**Tanggal:** 22 September 2026
**Konteks:** `AGENTS.md` aturan 7 meminta kode, komentar, nama variabel, dan dokumen teknis
dalam bahasa Inggris, sedangkan teks antarmuka dalam bahasa Indonesia.
**Keputusan:** Nama variabel, nama fungsi, dan nama berkas berbahasa Inggris. Teks antarmuka
berbahasa Indonesia sepenuhnya. Namun dokumen teknis (`ARCHITECTURE.md`, `DESIGN.md`,
`DECISIONS.md`, `STATUS.md`, `DELIVERY_GATE.md`, `COMPANY.md`) dan sebagian komentar ditulis
dalam bahasa Indonesia.
**Alasan:** Pemilik produk adalah penutur Indonesia, PRD dan SOUL berbahasa Indonesia, dan
dokumen-dokumen ini dibaca pemilik untuk memutuskan. Menerjemahkannya ke Inggris akan
menurunkan kegunaannya bagi satu-satunya pembacanya. Komentar yang menjelaskan aturan PRD
berbahasa Indonesia agar kutipannya tetap dapat dicocokkan dengan PRD.
**Konsekuensi:** Ini penyimpangan sadar dari aturan 7, dicatat di sini supaya tidak menjadi
diam-diam berbeda. Bila pemilik ingin aturan 7 ditegakkan harfiah, dokumen dan komentar perlu
diterjemahkan; itu pekerjaan mekanis yang belum dilakukan.
**Status:** Menunggu keputusan pemilik.

## D-14 · Arah visual diganti, bukan ditambal

**Tanggal:** 22 September 2026
**Konteks:** Pemilik meminta tampilan "modern bersih, mudah dipakai, kelas SaaS". Arah yang
berlaku saat itu adalah "buku besar kertas": permukaan krem hangat, serif Fraunces untuk angka,
motif garis kolom bertakik.
**Keputusan:** Arah visual diganti seluruhnya dan `docs/DESIGN.md` ditulis ulang. Arah lama
diperlakukan sebagai bukti dan anti-contoh, bukan sebagai dasar untuk diperbaiki sedikit-sedikit.
Isi yang berubah: rupa huruf, palet, skala huruf, skala jarak, radius, elevasi, motif, dan dial.
Isi yang tidak berubah: seluruh perilaku, seluruh teks antarmuka, seluruh cakupan PRD, dan seluruh
tes.
**Alasan:** Arah lama memang dibangun untuk terbaca seperti buku kas kertas, dan itu bertentangan
dengan yang diminta pemilik. Menambal arah lama akan menghasilkan campuran dua bahasa visual.
Selain itu audit menemukan cacat yang tidak bisa diperbaiki dengan penambalan: 12 ukuran huruf
ad-hoc, nilai jarak di luar kelipatan 4 px, dan serif deklarasi yang hanya muncul di 2 elemen
sehingga arahnya tidak benar-benar bekerja.
**Konsekuensi:** Dua rupa huruf baru (Schibsted Grotesk, IBM Plex Mono) masuk sebagai dependensi
self-host; dua yang lama keluar. Motif identitas berpindah dari garis bertakik ke kolom tanda.
Dial naik dari ENERGY 1 / RHYTHM 2 / MOTION 1 ke ENERGY 2 / RHYTHM 2 / MOTION 2.
**Status:** Selesai dan terverifikasi; laporan gerbang ada di `docs/DELIVERY_GATE.md`.

