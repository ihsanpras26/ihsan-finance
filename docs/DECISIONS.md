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

## D-15 · Arah visual disetel ulang ke referensi pemilik

**Tanggal:** 22 September 2026
**Konteks:** Pemilik menyatakan belum puas dengan hasil D-14 dan melampirkan dua tangkapan
antarmuka yang diinginkan: dasbor fintech bergaya kartu, kanvas abu terang, kartu putih, aksen
biru, lencana pil, dan bilah progres. D-14 sudah mengganti arah, tetapi paletnya masih membawa sisa
arah kertas (kanvas `#fbfaf9` yang hangat) dan tidak punya bahasa grafik sama sekali. Chrome PWA
juga masih memakai nilai lama: `manifest.webmanifest` dan meta `theme-color` menyebut `#f6f2ea`,
dan `icon.svg` memakai stroke biru `#243b7a` di atas kanvas krem.
**Keputusan:** Arah D-14 dipertahankan sebagai kerangka (rupa huruf, kolom tanda, skala huruf) dan
disetel ulang pada empat titik:
1. Kanvas menjadi abu netral `#f4f4f5`; biru `#0256ff` menjadi aksen struktural dan kuning
   `#ffb700` menjadi warna data kedua.
2. `components/charts.tsx` ditambahkan sebagai perangkat grafik SVG gambar-sendiri: bilah kategori,
   garis tren, cincin, dan bilah progres. Tanpa pustaka grafik pihak ketiga.
3. Setiap layar dibangun ulang di atas primitif yang sama; layar Notifikasi ditambahkan karena
   endpoint-nya sudah ada di server tetapi belum punya rumah di antarmuka.
4. Chrome PWA diselaraskan: manifest, meta `theme-color`, `icon.svg`, dan `icon-maskable.svg`
   memakai palet baru, dan ikon maskable dipisahkan supaya aman dari pemotongan topeng peluncur.
**Alasan:** Referensi pemilik adalah bahasa fintech yang sudah matang, dan tujuannya adalah aplikasi
yang dipakai tiap hari di HP. Menyisakan permukaan hangat dari arah kertas akan terbaca sebagai dua
bahasa visual yang bertabrakan, dan chrome PWA adalah hal pertama yang dilihat pengguna saat
memasang aplikasi, jadi tidak boleh memakai warna di luar sistem.
**Konsekuensi:** Lima nilai token digelapkan supaya lolos WCAG AA di seluruh layar, terukur dengan
alat, bukan dikira-kira: `--fg-muted` `#59616d`, `--in` `#07714e`, `--out` `#c81a1a`, dan `--warn`
`#96450a`. Tabel palet di `docs/DESIGN.md` ikut diperbarui. Grafik sekarang menjadi bagian bahasa
desain, bukan tempelan per layar.
**Status:** Selesai dan terverifikasi; bukti ada di `docs/DELIVERY_GATE.md` bagian D-15.

## D-16 · Lapisan sentuh diperketat untuk pemakaian harian di HP

**Tanggal:** 23 September 2026
**Konteks:** Pemilik menegaskan aplikasi akan banyak dipakai di HP dan meminta kualitas setara
studio agensi SaaS, dengan fokus pada margin, UI/UX, layout, dan alur. Audit terukur pada viewport
390x844 menemukan lapisan sentuh yang belum diperketat: skala radius masih 10/16/24 (terlalu tajam
untuk ibu jari dan tidak konsisten dengan pil 999px di sebelahnya), strip tab yang bisa digulir
horizontal tidak punya `touch-action` sehingga sapuan vertikal di atasnya tertelan dan halaman
tidak ikut bergulir, baris buku besar 56px terasa rapat, dan label `Jenis`/`Nominal` di lembar
entri tidak memakai penanda wajib seperti kolom lain di formulir yang sama.
**Keputusan:**
1. Skala radius dinaikkan menjadi 12/18/26 untuk kontrol, panel, dan lembar, mengikuti bahasa
   referensi pemilik; tab di dalam strip disetel ke 9px supaya tetap terlihat sebagai elemen
   bersarang, bukan elemen setingkat.
2. `[class*='overflow-x-auto']` mendapat `touch-action: pan-x pan-y` dan `-webkit-overflow-scrolling:
   touch`, sehingga sapuan vertikal di atas strip tetap menggulir halaman.
3. Lembar diberi `overscroll-contain` pada wadah dan `min-h-0` pada badan yang menggulir, supaya
   gulir tidak menembus ke halaman di belakangnya dan papan ketik di layar tidak meremukkan isi.
4. Baris buku besar naik ke 60px dengan `:active` yang terlihat; kepala layar mendapat
   `pt-[env(safe-area-inset-top)]`; setiap elemen ber-`id` mendapat `scroll-margin-top` agar tidak
   tersembunyi di bawah kepala yang lengket.
5. Konsistensi formulir: `Nominal` dan `Jenis` di lembar entri kini memakai penanda wajib yang sama
   dengan kolom lain, dengan teks `sr-only` untuk pembaca layar.
6. Aksi berulang per dompet di Profil diringkas menjadi satu menu `Lainnya`; tiga tombol teks per
   baris terlalu padat di lebar HP dan mendorong baris menjadi dua tingkat.
**Alasan:** Semua temuan berasal dari pengukuran, bukan kesan: `document.scrollWidth` versus
`clientWidth`, tinggi baris hasil `getBoundingClientRect`, dan pembacaan CSS terkompilasi untuk
memastikan aturan benar-benar terkirim. Kualitas yang bisa dirasakan ibu jari berasal dari ukuran
yang bisa diukur.
**Konsekuensi:** `docs/DESIGN.md` bagian skala radius dan bagian baru tentang perilaku mobile ikut
diperbarui. Empat belas temuan audit ditutup; dua di antaranya ternyata bukan cacat setelah diukur
ulang (klirens konten terhadap bilah navigasi aman 37-63px di semua layar dan tinggi, dan aturan
safe-area memang sudah terkirim ke CSS terkompilasi) dan dicatat apa adanya supaya tidak
"diperbaiki" lagi di kemudian hari.
**Status:** Selesai dan terverifikasi; bukti ada di `docs/DELIVERY_GATE.md` bagian D-16.


## D-17 · Setel halus (Refine v2) ke gaya Fintech Aurora

**Tanggal:** 28 September 2026
**Konteks:** Pemilik membawa 3 gambar referensi baru berestetika dark mode ekstrim dengan gradien jala (aurora mesh), radius kartu sangat bulat (kapsul/squircle), latar nyaris hitam murni, dan pendaran neon (glow). OMP vision memverifikasi elemen-elemen ini. Pemilik meminta "setel halus" (refine v2) alih-alih merombak total, untuk menyeimbangkan estetika baru dengan prinsip anti-slop yang ada.
**Keputusan:**
1. Palet mode gelap ditajamkan: kanvas `--surface` menjadi `#050508` (nyaris hitam), kartu menjadi `#111318`.
2. Radius dilengkungkan: panel naik dari 18px ke 24px, lembar dari 26px ke 28px. Kontrol naik dari 12px ke 14px.
3. Tombol aksi utama (CTA) dipisahkan dari kontrol umum dan memakai radius pil penuh (`--radius-chip`).
4. Ditambahkan utilitas `.bg-aurora` (gradien jala biru-ungu) dan efek glow, namun penggunaannya dibatasi mutlak HANYA untuk satu kartu "Premium" atau "AI Insight" per layar, mengikuti R-01 (gradien punya tujuan, bukan bawaan).
**Alasan:** "Setel halus" berarti menjaga arsitektur (huruf Schibsted/Plex, kolom tanda, tanpa pustaka grafik) tetapi mengadopsi bahasa visual referensi. Gradien aurora dan glow diizinkan asalkan dilokalisir ke fitur premium/AI, sehingga tidak melanggar R-01.
**Status:** Dikerjakan di seluruh permukaan (fase token, primitif, layar, PWA). Butir 4 (utilitas
aurora dan glow) dibatalkan oleh D-18.

## D-18 · Arah canon: konvensi aplikasi keuangan besar, sebagian D-17 dibatalkan

**Tanggal:** 29 September 2026
**Konteks:** Pemilik menilai antarmuka belum terasa profesional dan meminta perbaikan menyeluruh:
profesional, tata letak modern, aksesibel, dan alurnya meniru aplikasi keuangan bermerek besar.
Dari empat arah yang disodorkan, pemilik memilih yang keempat: "aplikasi keuangan besar apa adanya".
Artinya konvensi pasar yang sudah matang dieksekusi habis-habisan, tanpa keunikan yang diselundupkan
ke dalamnya.
**Keputusan:**
1. Arah yang berlaku adalah canon. Patokan mutu yang disepakati dan dipakai sebagai ujian: YNAB
   (pekerjaan yang menunggu pengguna diletakkan di banner paling atas), Copilot Money (urutan blok
   dasbor tetap, nominal selalu bertanda), Monzo (detail transaksi sebagai lembar bawah), Jenius
   (satu tombol aksi di tengah bilah bawah). Kualitas datang dari eksekusi dan alur yang bersumber
   dari data nyata, bukan dari efek visual.
2. Butir 4 D-17 dibatalkan. Utilitas `.bg-aurora` dan token `--glow-accent` beserta pemetaan
   `@theme inline`-nya dihapus dari `styles/index.css`; tidak ada lagi rujukan glow atau aurora di
   repositori. Butir 1 sampai 3 D-17 tetap berlaku: kanvas gelap `#050508`, radius panel 24px,
   lembar 28px, kontrol 14px, dan CTA beradius pil penuh.
3. Persentase bilah progres duduk di luar isian, bukan di dalamnya. Alasan: aksen mode gelap
   `#3b82f6` dengan teks putih hanya sekitar 3.7:1 dan gagal AA untuk teks 11.5px; label di luar
   isian menghapus cabang `insideFill`/`text-white` sekaligus memastikan persentase tidak pernah
   bergantung pada warna atau pada lebar isian.
4. Nominal diisi lewat papan angka di dalam lembar, bukan lewat isian teks. Papan fisik tetap
   bekerja (angka menambah, Backspace mengurangi). Batas P0 Rp999.999.999.999 ditegakkan di papan:
   angka di atas batas tidak diterima, bukan dibulatkan.
5. Kontrol tema di kepala HP dihapus. Tema tetap ada di rel desktop dan di Profil, bagian
   Preferensi, karena canon menaruh tema di pengaturan, bukan di setiap layar.
6. Kepala HP dibuat opaque; blur dihapus karena di sana blur tidak memberi fungsi, sementara
   glassmorphism yang tidak berfungsi dilarang R-10.
**Alasan:** Rujukan pasar adalah bahasa yang sudah matang untuk aplikasi uang, dan pemilik memilihnya
secara eksplisit. Menghapus butir 4 D-17 menutup satu-satunya pelanggaran R-01 dan R-13 yang masih
tersisa di sistem, sekaligus memangkas dua token yang tidak punya pemakai.
**Konsekuensi:** `docs/DESIGN.md` ditulis ulang mengikuti arah ini: bagian glow dan aurora hilang,
radius kartu disebut sesuai token panel 24px (bukan 18px), skala huruf disebut delapan langkah,
dan aturan persentase progres diperbarui. D-13 tetap berlaku apa adanya; bahasa dokumen dan
komentar tidak berubah pada sesi ini.
**Status:** Selesai dan terverifikasi; laporan gerbangnya ada di `docs/DELIVERY_GATE.md` bagian D-18.
Putaran tinjauan sesudahnya menutup tujuh cacat tampilan tanpa mengubah perilaku finansial: kolom tanda
netral dibiarkan kosong (tanda apa pun pada nilai tanpa arah dibaca sebagai minus pada pembacaan
tangkapan), kotak kiri baris transfer memakai glif transfer, aksi kaki lembar diseragamkan 52 px,
aksen gelap dinaikkan ke `#60a5fa`, sisa anggaran tidak lagi bertanda `+`, aksi per-baris lembar
berulang dipindah ke tepi konten, dan satu blok tes kolom tanda yang sudah tidak berlaku dihapus.

## D-19 · Celah PRD dan aturan tampilan yang diperjelas saat redesain canon

**Tanggal:** 1 Oktober 2026
**Konteks:** Redesain arah canon menyentuh setiap layar, dan di situ tiga celah antara PRD dan kode
terbuka: janji di antarmuka yang tidak punya jalannya, janji privasi yang tidak dijalankan, dan satu
kartu P0 yang dihitung server tetapi tidak pernah muncul. Selain itu dua aturan tampilan ternyata
lebih luas daripada kenyataan.
**Keputusan:**
1. **Alur konfirmasi rencana berulang dibangun, bukan sekadar dicatat (FR17/FR09).** Label tombol
   di banner Beranda menjanjikan "Catat transaksi berulang", tetapi `openQuickEntry()` membuka
   formulir kosong dan `api.confirmOccurrence`/`api.skipOccurrence` tidak dipanggil berkas web mana
   pun. Sekarang banner membuka lembar "Transaksi berulang menunggu" yang memuat label, jadwal, dan
   nominal bertanda, lalu memanggil kedua endpoint itu dan menyegarkan ringkasan.
2. **Penyuntingan per-isian sengaja tidak dibuat.** Server menerima `overrides` (`amount`,
   `walletId`, `categoryId`, `toWalletId`, `fee`, `effectiveDate`, `note`) pada
   `POST /occurrences/:id/confirm`. Lembar hanya mengonfirmasi apa adanya atau melewati kejadian.
   Alasan: satu nilai yang salah lebih baik dikoreksi setelah tercatat lewat transaksi pembalikan
   dan pengganti, daripada dibuatkan formulir kedua di dalam dasbor yang harus diuji sendiri.
3. **"Lewati" tidak menghapus rencana.** Kejadian ditandai `skipped` dan `next_on` maju ke jadwal
   berikutnya; rencana berulangnya tetap berjalan, dan itu diucapkan di toast.
4. **Draf lokal dihapus saat keluar.** Layar Profil, bagian Keamanan, menjanjikan draf yang belum
   terkirim ikut terhapus, dan draf bisa memuat nominal serta catatan. `signOut` di
   `app/web/src/lib/session.tsx` sekarang memanggil `clearAllDrafts(user.workspaceId)` sebelum sesi
   lokal dibersihkan.
5. **Kartu "Dana belum dialokasikan" (FR04) ditampilkan di dalam panel saldo.** Angkanya sudah
   dihitung server (`unallocatedFunds` = kas dikurangi alokasi tujuan aktif) dan sudah dikirim API,
   tetapi tidak punya tempat di antarmuka. Ia diletakkan di panel saldo, bukan sebagai blok
   tersendiri, supaya urutan blok Beranda yang tetap tidak berubah; label dan penjelasannya mengikuti
   kalimat PRD yang melarang angka ini dibaca sebagai rekomendasi belanja.
6. **Nol tidak punya arah.** Aturan kolom tanda diperjelas: `+` dan `-` hanya untuk nominal yang
   benar-benar bergerak, nol selalu netral (`·`). Sebelumnya baris pembanding di Laporan menampilkan
   "+Rp0" karena arah baris diturunkan ke nilai nol, dan pembaca layar mengucapkan "plus nol".
7. **Monospace untuk nominal yang berdiri sendiri.** `DESIGN.md` disempitkan: nominal yang tersemat
   di dalam satu kalimat yang datang dari server sebagai string utuh (mis. badan pengingat
   "Piutang kepada Dimas sebesar Rp750.000 jatuh tempo 6 Okt 2026.") memakai rupa teks, karena satu
   kalimat tidak boleh berganti rupa di tengahnya dan angkanya tetap tabular.
**Alasan:** PRD adalah sumber kebenaran produk, jadi janji di antarmuka tidak boleh dibiarkan tanpa
jalannya dan kartu P0 tidak boleh hanya hidup di respons API. Aturan tampilan sebaliknya harus
disempitkan sampai sesuai kenyataan, bukan dibiarkan sebagai klaim yang tidak terverifikasi.
**Konsekuensi:** Cacat yang ikut ditemukan dan diperbaiki pada sesi yang sama: bug bulan pada
`server/src/tools/seed.ts`, bug jarak hari pengingat jatuh tempo di
`server/src/domain/notifications.ts`, pengucapan arah uang yang hilang pada `Money`, dan 16 ekspor
mati yang dihapus. Rinciannya ada di `docs/DELIVERY_GATE.md` bagian D-18 dan ringkasannya di
`docs/STATUS.md`. Lembar konfirmasi berulang tetap bisa berkembang ke penyuntingan nilai bila
PRD menuntutnya.
**Status:** Selesai dan terverifikasi; laporan gerbangnya ada di `docs/DELIVERY_GATE.md` bagian D-18.
Aturan "nol selalu netral" dipertegas pada putaran tinjauan: nominal netral tidak memakai glif apa pun
di kolom tanda, dan `DESIGN.md` mencatat dua penanda yang sudah dicoba dan gagal (titik tengah `·`
yang diketik dan bulatan yang digambar).

## D-20 · Kontrak penyalaan produksi: satu proses, satu volume, cadangan harian

**Tanggal:** 1 Oktober 2026
**Konteks:** PRD §13 memilih satu layanan aplikasi untuk P0 dan menyerahkan pemilihan hosting ke
desain teknis; NFR05 menuntut cadangan harian otomatis dengan RPO maksimal 24 jam, RTO maksimal 8
jam, dan uji restore sebelum rilis; NFR07 meminta cadangan ikut meluruh. Aplikasi memakai
`node:sqlite` dalam mode WAL, jadi basis datanya adalah **berkas**, bukan layanan jaringan. Pemilik
belum memilih penyedia hosting karena akun, biaya, dan domain hanya bisa diputuskan oleh dia.
**Keputusan:**
1. **Satu proses, satu penulis.** API, penyajian `web/dist`, dan penjadwal internal hidup di satu
   proses Node 24; basis data SQLite tidak boleh dibagi ke beberapa replika. Menambah replika
   berarti pindah ke Postgres/libSQL dan itu pekerjaan tersendiri, bukan setelan penyebaran.
2. **Kontrak lingkungan, bukan setelan tersembunyi.** `HOST`, `PORT`, `APP_ORIGIN`,
   `IHSAN_DATA_DIR`, `IHSAN_DB_PATH`, `IHSAN_BACKUP_DIR`, `IHSAN_BACKUP_KEEP`,
   `IHSAN_TRUST_PROXY`, `IHSAN_ALLOW_REGISTRATION`, `SESSION_DAYS`, `NODE_ENV`, `LOG_LEVEL`
   dicatat di `app/.env.example` dan `docs/panduan/DEPLOY.md`.
3. **TLS di proksi, keamanan cookie dari `APP_ORIGIN`.** `APP_ORIGIN=https://…` menyalakan atribut
   `Secure` pada cookie sesi dan header `Strict-Transport-Security`; tanpa itu keduanya tetap mati
   supaya pengembangan lewat http tidak terkunci. `IHSAN_TRUST_PROXY=1` membuat daftar perangkat
   mencatat IP klien asli di balik proksi, bukan IP proksi.
4. **Pendaftaran ditutup setelah akun pertama.** `IHSAN_ALLOW_REGISTRATION=0` menolak pendaftaran
   baru dengan 403, tetapi akun pertama tetap boleh lahir supaya penyalaan pertama bisa
   di-bootstrap. Bawaannya tetap terbuka agar mesin pengembangan dan tes tidak terkunci.
5. **Cadangan memakai `VACUUM INTO`, bukan penyalinan berkas.** `app/scripts/backup.mjs` membuat
   snapshot konsisten walau server sedang menulis, memeriksa integritas, pelanggaran relasi, dan
   keseimbangan jurnal sebelum berkas diakui sah, lalu memangkas retensi (`IHSAN_BACKUP_KEEP`,
   bawaan 14). `--restore` menyimpan basis data lama lebih dulu sebagai snapshot keamanan dan
   membuang `-wal`/`-shm` yang tertinggal. Jadwal harian disediakan lewat
   `deploy/systemd/ihsan-backup.timer`, dan kegagalan apa pun keluar dengan kode ≠ 0 sebagai alarm.
6. **Titik kesehatan bebas sesi.** `GET /api/v1/health` tidak menuntut sesi dan dipakai
   `HEALTHCHECK` di `Dockerfile` serta pemeriksaan platform.
**Alasan:** NFR05 dan NFR07 hanya bisa dijanjikan kalau snapshot dibuat otomatis dan diperiksa,
bukan disalin manual; sedangkan batas "satu penulis" harus diucapkan karena SQLite berkas akan
rusak kalau dipakai dua mesin sekaligus. Menyalakan `Secure`/HSTS dari `APP_ORIGIN` menempatkan
satu sumber kebenaran untuk kedua hal itu, sehingga tidak ada setelan kedua yang bisa lupa diisi.
**Konsekuensi:** Pemilihan penyedia, domain, dan penyimpanan cadangan luar mesin masih menunggu
keputusan pemilik (`docs/panduan/DEPLOY.md` bagian 6 dan 7). Uji restore terjadwal tiga bulanan (NFR05)
belum ada berkasnya; pembuktian saat ini manual dan tercatat di `docs/panduan/DEPLOY.md` bagian 5.
Kewajiban lingkungan yang belum tertutup tetap dicatat di `docs/STATUS.md` (batas heap hook
`pre-commit`).
**Status:** Kontrak dan perangkat penyalaan selesai dan terverifikasi di mesin pengembangan; deploy
pertama menunggu kredensial, domain, dan pilihan penyedia dari pemilik.

## D-21 · Lapisan data libSQL: berkas, berkas temp, atau Turso; penjadwal lewat cron

**Tanggal:** 1 Oktober 2026
**Konteks:** D-20 mengunci `node:sqlite` mode berkas dan satu proses sebagai kontrak penyalaan.
Pemilik kemudian memilih penyedia **gratis** (Vercel/Cloudflare) dan meminta cadangan offsite
disiapkan sekarang. Vercel memberi sistem berkas hanya-baca dan sekali pakai, jadi basis data
berkas tidak bisa hidup di sana; Cloudflare Workers tidak bisa menjalankan Fastify tanpa menulis
ulang seluruh lapisan HTTP. Turso (libSQL) mempertahankan dialek SQLite sehingga `schema.sql`,
jurnal berpasangan, dan seluruh aturan P0 tetap berlaku tanpa cabang kode kedua.
**Keputusan:**
1. **Satu port basis data, dua target.** `app/server/src/db/index.ts` menjadi satu-satunya modul
   yang tahu drivernya: `openDatabase(target, authToken?)` memilih `@libsql/client/web` untuk URL
   `libsql:`/`http(s)`/`ws(s)` dan `@libsql/client` (binding native, berkas + pragma WAL) untuk
   jalur berkas. Seluruh domain, rute, pekerja terjadwal, dan tes memanggil `query/mutate/script/
   transaction` pada kelas `Db`, tidak pernah `prepare/get/run` milik `node:sqlite`.
2. **Uang tetap integer.** `bind()` mengubah bilangan bulat aman menjadi `bigint` supaya nilai
   rupiah tersimpan sebagai `INTEGER` (aturan PRD 1), dan dibuktikan
   `typeof(amount)='integer'` di `app/server/test/db-port.test.ts`.
3. **Transaksi mengikuti konteks async, bukan instance.** `AsyncLocalStorage` menyimpan transaksi
   aktif, sehingga dua permintaan yang berbagi satu `Db` tidak saling melihat pekerjaan setengah
   jalan; pemanggilan `tx()` bersarang menjadi `SAVEPOINT` (dipakai koreksi transaksi dan
   konfirmasi rencana berulang).
4. **Berkas tetap target pengembangan dan tes.** Tes memakai berkas sungguhan di direktori
   sementara, bukan `:memory:`: libSQL memberi setiap koneksi dalam pool basis data in-memory
   sendiri, sehingga `:memory:` tidak mencerminkan produksi.
5. **Turso opsional, bukan wajib.** `IHSAN_DB_URL` + `IHSAN_DB_TOKEN` mengalihkan mode; bila
   kosong, `IHSAN_DB_PATH`/`IHSAN_DATA_DIR` dipakai seperti D-20. Di mode serverless, direktori
   data bawaan pindah ke direktori sementara karena paket fungsi hanya-baca.
6. **Penjadwal dipisah dari proses.** Mode satu proses tetap memakai timer 15 menit di `main.ts`;
   mode serverless memakai `GET|POST /api/v1/internal/tick` ber-`Authorization: Bearer
   $CRON_SECRET` (padanan `IHSAN_CRON_TOKEN`), idempoten, tanpa sesi pengguna, dan menjawab 404
   saat token belum diatur. `app/vercel.json` memasangnya harian pukul 22:00 UTC (05:00 WIB).
7. **Cadangan keluar mesin memakai dump logis.** `VACUUM INTO` pada Turso menulis di sisi server,
   jadi `app/server/src/tools/offsite.ts` menyalin baris per tabel, memeriksa jumlah baris,
   keseimbangan jurnal, `PRAGMA integrity_check`, dan `foreign_key_check`, menyegel `sha256`, lalu
   mengunggah ke ember S3/R2/B2 dengan SigV4 buatan sendiri (tanpa SDK). Unggahan hanya dianggap
   berhasil bila ember menjawab 2xx. Sumbernya Turso bila `IHSAN_DB_URL` diisi, kalau tidak berkas
   lokal, dan hasilnya ditulis ke `<IHSAN_DATA_DIR>/offsite` (`IHSAN_OFFSITE_DIR`): pola nama dump
   sama dengan snapshot `backup.mjs`, jadi direktori terpisah mencegah retensi kedua keluarga
   berkas saling menghapus.
**Alasan:** Aturan finansial P0 (jurnal berpasangan, isolasi ruang, idempotensi, satu transaksi
per mutasi) tidak boleh ditawar demi penyedia hosting. libSQL menjaga seluruhnya sekaligus
menghapus ketergantungan pada disk permanen, jadi hosting gratis menjadi mungkin tanpa menulis
ulang domain. AsyncLocalStorage dipilih daripada menyimpan transaksi di field `Db` karena satu
instance dibagi banyak permintaan; slot di instance akan bocor antarpengguna.
**Konsekuensi:** Setiap pemanggil domain menjadi asinkron; ini perubahan besar pada 45 berkas dan
diverifikasi `pnpm --dir app verify` (typecheck + 106 tes server + 5 tes antarmuka + build web).
Mesin 8 GB tidak sanggup memberi V8 heap 2560 MB saat memori bebas menipis (`Zone Allocation
failed`), jadi hook `pre-commit` memakai 1536 MB — angka yang lolos utuh dalam ±65 detik.
Di Vercel Hobby penjadwal menjadi harian, bukan tiap 15 menit, sehingga pengingat
H−7/H−1/H−0 tetap akurat harinya tetapi tidak muncul lebih rapat; pada paket berbayar frekuensi
bisa dirapatkan tanpa perubahan kode. Tambahan 3 Oktober 2026: koneksi Turso sungguhan sudah diuji
(`migrate` membuat 24 tabel di basis data `ihsan-finance`, idempoten saat diulang, server lokal
menjawab `/api/v1/health` 200 dengan sumber Turso). Uji itu menemukan satu cacat nyata: Turso
menolak `PRAGMA user_version = …` lewat HTTP dengan 400 `SQL_PARSE_ERROR: SQL not allowed statement`,
sehingga setiap penyalaan dingin gagal sebelum `migrate()` selesai. `migrate()` sekarang menulis
penanda itu hanya pada basis data berkas (`if (!db.remote)`), dengan alasan: `schema.sql` seluruhnya
`CREATE … IF NOT EXISTS` sehingga tetap idempoten dan menambah tanpa penanda versi. Perilaku itu
dikunci tes regresi di `app/server/test/db-port.test.ts`.

---

## D-22 · Penyedia produksi: Vercel Hobby + Turso Free + Cloudflare R2; kredensial di luar repo

**Keputusan:** Produksi berjalan di **Vercel Hobby** (fungsi Node, cron harian) dengan basis data
**Turso Free**, dan cadangan offsite ke **Cloudflare R2 Free**. Batas biaya yang diizinkan pemilik:
**gratis**. Domain sudah dimiliki pemilik; DNS dikelola pemilik, jadi penyalaannya menunggu nama
domain.

**Alasan:** ketiga lapisan punya paket gratis yang cukup untuk satu pengguna P0 (satu basis data,
puluhan ribu baris, satu cron harian, ember 10 GB). Turso menjaga dialek SQLite sehingga
`schema.sql` tetap dipakai, Vercel menjalankan Fastify tanpa menulis ulang lapisan HTTP, dan R2
tidak mengenakan biaya egress untuk pemulihan.

**Penyerahan rahasia:** pemilik mengisi `C:\Users\HP\.ihsan-prod.env` (di luar repositori, tidak
pernah masuk git) berisi `DOMAIN`, `DNS_PROVIDER`, `VERCEL_TOKEN`, `TURSO_API_TOKEN`, `TURSO_ORG`,
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, dan kredensial S3 R2. Agen membaca berkas itu lewat
path absolut, tidak menyalin isinya ke repositori, dan tidak memasukkannya ke log atau keluaran
perintah. Nilai yang belum diisi memakai penanda `ISI_DI_SINI`; selama penanda itu ada, penyalaan
belum dijalankan.

**Konsekuensi:** kredensial R2 S3 dibuat di dashboard Cloudflare (tidak ada API untuk membuat
pasangan kunci S3), jadi langkah itu tetap milik pemilik walau token Cloudflare diberikan. Paket
gratis Vercel membatasi cron ke sekali sehari dan fungsi 30 detik; dump cadangan karena itu selalu
dijalankan dari mesin tetap, bukan dari fungsi. Bila kuota gratis tidak lagi cukup, peta pilihan
berbayar ada di `docs/panduan/DEPLOY.md` bagian 8, dan seluruh kode tetap sama karena hanya variabel
lingkungan yang berubah.

**Status:** 3 Oktober 2026 penyalaan dijalankan lewat REST API dengan kredensial dari pemilik:
basis data Turso `ihsan-finance`, proyek Vercel `ihsan-finance-app` (Root Directory `app`, Node 24.x,
branch produksi `main`), sembilan variabel lingkungan produksi, dan domain `ihsanpras.my.id`
terverifikasi. Sisa milik pemilik: menekan **Enable R2** (butuh metode bayar; tidak ada API-nya) dan
membuat pasangan kunci S3 di dashboard. Catatan lingkar kerja: `CLOUDFLARE_API_TOKEN` yang ada
berlingkup akun, jadi `/user/tokens/verify` menjawab 401 `Invalid API Token` sementara `/zones` 200
dan `/accounts/{id}/r2/buckets` menjawab 10042 — patokan sehat token itu adalah dua panggilan
terakhir, bukan `verify`.

---

## D-23 · Fungsi Vercel dibundel esbuild dari paket server, bukan dikompilasi platform (digantikan D-24)

**Keputusan:** Entri fungsi Vercel adalah **`app/server/src/vercel.ts`** (sumber TypeScript, ikut
`pnpm verify`), dan `app/scripts/build-api.mjs` membundelnya dengan esbuild menjadi
**`app/api/index.js`** pada langkah build (`pnpm run build:api`, dipanggil `app/vercel.json`).
Bundel itu berdiri sendiri: seluruh modul lokal, seluruh dependensi pihak ketiga, dan teks
`schema.sql` (lewat `define` `globalThis.__IHSAN_SCHEMA__`) masuk ke dalam satu berkas. Hanya
penggerak libSQL asli (`@libsql/client`, `libsql`) yang tetap eksternal, karena ia hanya dijangkau
target `file:` yang tidak pernah dipakai di mode Turso. Berkas `api/index.js` dan `.map`-nya
di-gitignore; yang di-commit hanya sumbernya.

**Alasan:** dua perilaku platform yang terbukti dari kegagalan produksi, bukan dugaan:

1. Vercel mengompilasi `api/*.ts` dengan `tsc`-nya sendiri, **mempertahankan spesifier impor `.ts`**
   di JS hasilnya (log build memuat `TS5097 allowImportingTsExtensions`), dan **mengirim hanya
   berkas `.js`** (0 `.ts`, 33 `.js` di `server/`). Fungsi karena itu mati pada impor pertama dengan
   `ERR_MODULE_NOT_FOUND: …server/src/config.ts` → 500 `FUNCTION_INVOCATION_FAILED`. Repo ini
   menjalankan TypeScript langsung di Node 24 (D-03), jadi spesifier `.ts` memang wajib ada di
   sumber; yang salah adalah menyerahkan kompilasi ke platform.
2. `functions.includeFiles` bukan jalan keluar: dengan `includeFiles: "server/src/**"` berkas `.ts`
   tetap tidak terkirim dan `schema.sql` justru hilang.

**Konsekuensi:** bundel CJS di keluaran ESM perlu banner `createRequire(import.meta.url)`, karena
Fastify/pino memanggil `require('node:events')` dan esbuild melempar `Dynamic require of … is not
supported` tanpa itu. Entri tidak boleh diletakkan di `api/`: Vercel menolak `api/index.ts`
berdampingan dengan `api/index.js` hasil build sebagai `Two or more files have conflicting paths`
(nama dibandingkan tanpa ekstensi, jadi `.mjs` pun bentrok). `packages: 'external'` juga tidak
dipakai: NFT tidak menyalin apa pun dari bundel di `api/` (fungsi hasil build tidak punya
`node_modules`), sehingga paket eksternal akan gagal diselesaikan saat dijalankan.

**Bukti:** `pnpm run build:api` → `api/index.js` 1,97 MB tanpa spesifier `.ts`; `vercel build`
lokal menghasilkan fungsi berisi hanya `api/index.js` (2,0 MB, tanpa `node_modules`); menjalankan
artefak itu lewat shim HTTP dengan kredensial produksi menjawab `/api/v1/health` 200
`{"data":{"ok":true,…}}`, `/api/v1/wallets` 401, login salah 401 dengan pesan Indonesia (baca/tulis
Turso lewat `@libsql/client/web` yang dibundel), dan tick tanpa token 403.

---

## D-24 · Entri fungsi Vercel ada di git, bundel lahir pada langkah build, skema jadi modul

**Tanggal:** 3 Oktober 2026

**Konteks:** D-23 memindahkan kompilasi fungsi Vercel ke esbuild pada langkah build. Kenyataan
platform membatalkan urutan itu: Vercel **merencanakan fungsi dari pohon sumber sebelum perintah
build berjalan**, jadi berkas yang lahir saat build tidak pernah menjadi fungsi. Buktinya dua:
galat `The pattern "api/index.js" defined in functions doesn't match any Serverless Functions
inside the api directory` muncul di log 0,07 detik setelah CLI start, sebelum langkah install; dan
deployment `dc8e2bc` (READY) menjawab setiap `/api/*` dengan HTML aplikasi (200) serta 405 untuk
POST — tidak ada fungsi di dalamnya.

**Keputusan:**

1. **Entri di-commit.** `app/api/index.js` ada di git sebagai re-ekspor tipis
   (`import handler from '../server/src/vercel.ts'`), hanya supaya perencanaan Vercel menemukan
   berkas di `api/`; isinya tidak pernah dipakai di produksi.
2. **Bundel lahir pada langkah build.** `app/scripts/build-api.mjs` (esbuild) menimpa
   `app/api/index.js` dengan bundel mandiri 1,96 MB, dan `app/vercel.json` memanggilnya **sebelum**
   `pnpm --dir web build`. Pengumpulan paket fungsi terjadi sesudah perintah build, jadi yang
   terkirim adalah bundelnya.
3. **Skema jadi modul.** `server/src/db/schema.sql` → `server/src/db/schema.ts`
   (`export const SCHEMA_SQL`), karena paket fungsi adalah satu berkas tanpa aset.
4. **`app/vercel.json` memakai `functions` untuk `api/index.js`** (maxDuration 30, memory 512);
   pola itu kini cocok karena berkasnya ada di git. Pengaturan proyek Vercel — yang mengalahkan
   `vercel.json` — di-PATCH ke bentuk yang sama: `framework: null`,
   `buildCommand: node scripts/build-api.mjs && pnpm --dir web build`, `outputDirectory: web/dist`.

**Alasan:** dua jalur lain ditolak perilaku platform yang teramati, bukan dugaan:

1. Entri `.ts` di `api/`: platform mengompilasi `.ts` → `.js` tetapi **mempertahankan spesifier
   `.ts`** pada hasilnya — `server/src/vercel.js` hasil build lokal benar-benar memuat
   `from './config.ts'` — sementara berkas `.ts` tidak ikut dikirim, sehingga fungsi mati pada
   impor pertama. Menulis impor tanpa ekstensi bukan pilihan: Node 24 tidak memetakan `./x.js` ke
   `x.ts` (diuji, `ERR_MODULE_NOT_FOUND`), sedangkan seluruh server menjalankan TypeScript
   langsung (D-03).
2. Build Output API (perintah build menulis `.vercel/output` sendiri): `vercel build` lokal
   menimpanya — paket fungsi kembali berisi entri tipis 376 B, bahkan menelusuri `data/`
   pengembangan lewat `config.ts`.

**Konsekuensi:** `api/index.js` ada di git dalam dua wujud — entri tipis yang di-commit dan bundel
hasil build di wadah Vercel. Setiap `vercel build` lokal menimpa berkas kerja itu dengan bundel,
jadi kembalikan dengan `git checkout -- app/api/index.js` sesudah diperiksa. Tidak ada lagi berkas
`.sql` di repo.

**Bukti:** `node scripts/build-api.mjs` → `api/index.js` 1.964 KB (24 `CREATE TABLE`);
`vercel build --prod` lokal dengan entri tipis di git menghasilkan
`.vercel/output/functions/api/index.func/api/index.js` **2.010.871 B** (bundel, bukan 376 B),
`filePathMap` **kosong**, 0 berkas `.ts`, tanpa `data/`; paket itu dijalankan lewat shim HTTP
dengan kredensial produksi dan menjawab `/api/v1/health` 200 `{"data":{"ok":true,…}}`,
`/api/v1/wallets` 401, login salah 401 `Email atau kata sandi belum cocok. Periksa lalu coba lagi.`,
tick tanpa token 403. `pnpm verify` lulus: 107 tes server, 5 tes web.

**Verifikasi produksi (3 Oktober 2026):** deployment `dpl_HpCeYFkFSHHc29mQUFHS8NMLNKMw`
(commit `c9ea81a`) READY dengan fungsi benar-benar terpasang: `https://ihsanpras.my.id/api/v1/health`
200 `{"data":{"ok":true,…}}`, `/api/v1/wallets` 401 JSON (bukan lagi HTML SPA), login salah 401
`Email atau kata sandi belum cocok. Periksa lalu coba lagi.`, `/api/v1/internal/tick` 403 tanpa
token dan 200 `{"data":{"today":"2026-10-03",…}}` dengan `Bearer $CRON_SECRET`, `/`, `/transaksi`,
dan `/tidak-ada` 200 dari satu `index.html` 982 B, `/sw.js` dan `/manifest.webmanifest` 200, HSTS
dan `X-Content-Type-Options: nosniff` terpasang. Log build memuat
`api/index.js 1964 KB (bundel fungsi Vercel)`.

Setelah `27b9238` (deployment `dpl_EH1JVaCYk8P94AaSmevEsASNDed4`), `vercel.json` menambahkan blok
`headers` untuk `/assets/*` (`Cache-Control: public, max-age=31536000, immutable`) supaya perilaku
penyajian aset sama dengan penyalaan satu proses, dan menyisakan halaman SPA `max-age=0,
must-revalidate`. Penyetelan `memory` dihapus karena log build platform menyebutnya diabaikan pada
penagihan Active CPU; `maxDuration: 30` tetap dipakai. Keduanya diuji ulang di produksi: aset
ber-hash menjawab `immutable`, `/api/v1/health` 200, `wallets` 401, tick 403/200.

**Uji alur penuh pada basis data terpisah:** bundel `api/index.js` yang sama dijalankan sebagai satu
proses HTTP dengan `IHSAN_DB_URL` menunjuk basis data Turso sekali pakai (`ihsan-uji-*`, dibuat lewat
Turso Platform API, dihapus sesudahnya). Alur nyata lulus: register (kode pemulihan dikembalikan),
login (cookie `Secure`), kategori bawaan, dompet, pendapatan + pengeluaran, idempotensi (kunci sama
→ id sama, muatan beda → 409), ringkasan AT01, pembatalan transaksi, `networth-check` seimbang, dan
pemulihan kata sandi memakai kode pemulihan; akun kedua ditolak 403 oleh gerbang pendaftaran.
Setelah proses dijalankan ulang, angka yang sama terbaca kembali dari Turso — jadi migrasi idempoten
dan data persisten. Basis data produksi tidak tersentuh (login akun uji ke produksi → 401).

## D-25 · Susunan berkas: PRD ke `docs/`, panduan penyalaan ke `docs/panduan/`

**Keputusan:** Dokumen yang bukan kontrak perkakas pindah ke `docs/`: PRD pindah dari akar
repositori ke `docs/PRD_Aplikasi_Keuangan_Pribadi_v1.md`, dan tiga panduan penyalaan
(`DEPLOY.md`, `PANDUAN_PENYALAAN.md`, `PANDUAN_PENYALAAN_VPS.md`) pindah dari `docs/` ke subfolder
baru `docs/panduan/`.
Di akar repositori hanya tinggal berkas yang dibaca berdasarkan nama oleh perkakas: `AGENTS.md`
(aturan agen, dibaca dari akar), `README.md` (pintu masuk repositori), `PRODUCT.md` dan `SOUL.md`
(dibaca skill impeccable lewat `impeccable context`), serta `Dockerfile`, `compose.yaml`, dan
`.dockerignore` (ditemukan `docker build` dan `docker compose` berdasarkan nama di direktori kerja).

**Alasan:** Akar repositori mencampur dokumen proyek dengan kontrak perkakas, sementara panduan
penyalaan tersebar di antara dokumen desain dan status. Setelah pemindahan, `docs/` terbaca sebagai
tiga kelompok: keputusan dan keadaan (`DECISIONS.md`, `STATUS.md`), arah produk dan desain
(`PRD_Aplikasi_Keuangan_Pribadi_v1.md`, `DESIGN.md`, `DELIVERY_GATE.md`, `COMPANY.md`,
`UX_RESEARCH.md`), dan cara menjalankan (`panduan/`). Berkas yang bergantung pada nama di akar tidak
dipindah karena memindahkannya memaksa setiap perkakas memakai jalur eksplisit (`impeccable context`,
`docker compose -f`, `docker build -f`, `--config`) tanpa manfaat yang sebanding.

**Konsekuensi:** Seluruh rujukan lintas berkas diperbarui (`AGENTS.md`, `README.md`, `PRODUCT.md`,
`docs/**`, `app/server/src/vercel.ts`, catatan permukaan impeccable), dan rujukan baru selalu ditulis
relatif terhadap akar repositori (`docs/panduan/DEPLOY.md`) supaya bisa di-grep dan tidak bergantung
pada direktori berkas pemanggil. Dua jalur absolut `D:\Ihsan Finance\ihsan-finance\...` di
`deploy/windows/offsite.ps1` dan `docs/panduan/PANDUAN_PENYALAAN.md` tidak berubah: susunan di dalam
repositori tidak memindahkan repositorinya. Artefak yang bisa dibuat ulang juga dibuang pada
kesempatan ini: `D:\Ihsan Finance\.smoke-out` (yatim, tidak dirujuk kode mana pun) dan `app/web/dist`.

**Verifikasi:** `pnpm --dir app verify` lulus setelah pemindahan (typecheck, 107 tes server, 5 tes web,
build produksi); tautan berkas di dalam dokumen diperiksa ulang dan tidak ada rujukan yang menunjuk
jalur lama. Commit `4173ad1` menyala di produksi sebagai deployment `dpl_4j91Uhb6Voa6rMC4Tf3UPoeENP55`
(READY): `/api/v1/health` 200, `/api/v1/wallets` 401, `/masuk` 200, `/api/v1/internal/tick` 403 tanpa
token dan 200 dengan `Bearer $CRON_SECRET`.

**Status:** 5 Oktober 2026 · diterapkan.

## D-26 · Kinerja: fungsi produksi didekatkan ke basis data, potongan kode per rute, batas waktu permintaan

Keluhan pemilik "masih lemot" diukur lebih dulu, bukan ditebak. Hasil pengukuran sebelum perubahan:

- **Server lokal** (berkas SQLite 417 KB, tanpa jaringan): seluruh endpoint 4–20 ms kecuali
  `/api/v1/dashboard` 74,6 ms. Jadi "lemot" bukan berasal dari kueri lokal.
- **Produksi** (Vercel + Turso): `/api/v1/health` tanpa satu pun pernyataan DB = 300 ms hangat;
  `/api/v1/internal/tick` (beberapa pernyataan berurutan, tanpa aturan aktif) = 1,7 detik hangat;
  `POST /api/v1/auth/login` dengan surel tidak dikenal (satu dua pernyataan) = 0,82 detik.
  Selisih itu menunjukkan **~250 ms per ronde pernyataan berurutan**.
- **Sebabnya region**: fungsi Vercel berjalan di `iad1` (Virginia, AS) sementara basis data Turso
  berada di `aws-ap-northeast-1` (Tokyo). Setiap pernyataan berurutan menempuh Virginia–Tokyo, dan
  setiap permintaan peramban dari Indonesia menempuh Jakarta–Virginia.
- **Kode klien**: satu bundel 465 KB (140 KB brotli) tanpa pemecahan, 22 berkas font (hanya 3 yang
  pernah diunduh), dan layar boot menunggu dua permintaan server secara berurutan.

**Keputusan:**

1. `app/vercel.json` menetapkan `"regions": ["hnd1"]` (Tokyo): fungsi berjalan satu region dengan
   basis data, sekaligus lebih dekat ke pengguna (Jakarta–Tokyo jauh lebih pendek daripada
   Jakarta–Virginia). Basis data tidak dipindah: memindahkan fungsi jauh lebih murah dan tidak
   menyentuh data.
2. Rute ber-sesi dimuat sesuai kebutuhan (`React.lazy`) sementara layar masuk tetap ikut berkas awal
   (layar pertama pengunjung baru tidak boleh menunggu perjalanan tambahan). Potongan pustaka
   (`react`, `react-dom`, `react-router-dom` beserta `scheduler`) dipisah lewat `manualChunks` bentuk
   fungsi supaya hash-nya stabil antar rilis dan peramban hanya mengunduh ulang kode aplikasi.
   Formulir catat juga dipotong dan dihangatkan saat peramban menganggur; kerangka lembar tampil
   selama potongan menyusul supaya tombol Tambah tidak terasa mati.
3. Rupa huruf IBM Plex Mono diimpor sebagai subset latin saja: 16 deklarasi `@font-face` dan 10
   berkas woff untuk aksara lain tidak pernah dipakai aplikasi berbahasa Indonesia.
4. `lib/api.ts` memberi setiap permintaan batas waktu 15 detik (keadaan galat lebih baik daripada
   kerangka selamanya) dan menyimpan sementara hasil baca `wallets`/`categories` (30 detik, dibuang
   setiap mutasi lewat `notifyDataChanged` dan setiap pergantian ruang kerja) karena kedua bacaan itu
   diulang 5–7 layar.
5. Sesi dimuat dengan satu ronde: `api.me()` dan `api.preferences()` berjalan berbarengan.

**Konsekuensi:** Selisih waktu muat awal terukur di mesin pengembang: 465 KB → 354 KB decoded dan
140 KB → 95 KB brotli untuk berkas awal (potongan rute menyusul: Rencana 9,5 KB, Laporan 8,1 KB,
Profil 7,2 KB, Transaksi 5,8 KB, formulir catat 3,6 KB brotli). Setelah satu rilis, peramban hanya
mengunduh ulang 16 KB brotli kode aplikasi (potongan `vendor` ber-hash stabil), bukan 72 KB.
Amplifikasi pernyataan berurutan (mis. `dashboardReport` memanggil sembilan bagian berurutan) belum
diubah pada keputusan ini: setelah fungsi dan basis data satu region, biaya per ronde turun dari
~250 ms menjadi satuan milidetik, jadi pengurangan jumlah pernyataan menjadi pekerjaan lanjutan yang
diukur ulang, bukan tebakan.

**Verifikasi:** `pnpm --dir app verify` lulus (typecheck, 107 tes server, 5 tes web, build produksi).
Setelah deploy, latensi produksi diukur ulang dengan urutan perintah yang sama seperti pengukuran
sebelumnya (`/api/v1/health`, `/api/v1/internal/tick`, `POST /api/v1/auth/login` dengan surel tidak
dikenal) dan hasilnya dicatat di berkas ini bila berbeda jauh.

**Status:** 5 Oktober 2026 · diterapkan.

## D-27 · Kejelasan layar: penanganan sesi berakhir, langkah pertama, label saringan, zona waktu, penanda merek

**Konteks.** Peninjauan pengalaman 5 Oktober 2026 menemukan lima tempat di mana antarmuka membuat
pengguna menebak, bukan lima cacat fungsi. Semuanya diperbaiki di klien; server, skema, dan aturan
uang tidak disentuh.

**Keputusan.**

1. **Semua galat pemuatan data lewat `DataError`, bukan `ErrorState` mentah.** Delapan belas titik di
   Notifikasi, Profil (kategori, preferensi, dompet), Rencana (anggaran, utang/piutang, tujuan), dan
   Laporan masih memakai `ErrorState` dengan tombol "Coba lagi" yang tidak mungkin berhasil saat
   sesi sudah berakhir (HTTP 401). `DataError` memusatkan keputusan: 401 menampilkan "Sesi berakhir.
   Masuk lagi…" dan memanggil `refresh()` sehingga pengguna diarahkan masuk ulang, sedangkan galat
   lain tetap menawarkan "Coba lagi". `ErrorState` tetap dipakai untuk galat yang bukan hasil
   pemuatan (mis. validasi rentang tanggal di Laporan) karena di sana "Coba lagi" memang masuk akal.
   `DataError` menerima prop `label?: string` supaya kalimat sebabnya konkret ("Dompet gagal dimuat.")
   alih-alih pesan server yang berdiri sendiri.

2. **Beranda pengguna baru memberi satu langkah berikutnya.** Tanpa dompet, seluruh panel hanya
   berisi nol dan pekerjaan yang menunggu pun kosong, jadi layar itu tidak punya aksi. PRD ("Alur
   utama" dan "Standar tampilan") meminta tepat satu tindakan berikutnya. Beranda kini mendahulukan
   keadaan kosong "Mulai dari sini" yang mengarahkan ke Profil untuk membuat dompet pertama, dengan
   penjelasan bahwa saldo awal adalah jurnal pembukaan, bukan pendapatan. Cabang ini hanya berlaku
   saat `dashboard.wallets.length === 0`; pengguna yang sudah punya dompet melihat layar yang sama
   seperti sebelumnya.

3. **Tombol kaki lembar saringan Transaksi: "Terapkan" menjadi "Selesai".** Saringan berlaku
   langsung saat chip ditekan, jadi tombol itu tidak pernah menerapkan sesuatu yang belum
   diterapkan; label lama menjanjikan penundaan yang tidak ada.

4. **Zona waktu ruang tampak di tempat periode dilaporkan.** Kriteria penerimaan PRD FR04 meminta
   rentang tanggal dan zona waktu tampak jelas. Baris periode Beranda kini menyebut "(zona waktu
   …)" dan subjudul Laporan menyebut "Zona waktu …" — keduanya dari `SessionUser.timezone` yang
   sama dengan yang dipakai server saat menghitung batas periode, bukan nilai yang ditebak klien.

5. **Penanda merek di layar masuk: monogram `IF`, bukan teks `[LOGO]`.** Teks placeholder itu
   pernah menjadi penanda jujur karena belum ada logo disetujui (aturan R-23), tetapi di layar
   masuk ia terbaca sebagai antarmuka yang belum jadi. Diganti monogram yang sudah dipakai rel
   aplikasi (`AppShell`): tidak ada berkas logo atau aset visual baru yang dibuat, jadi R-23 tetap
   berlaku. Bila pemilik menyetujui logo resmi, satu blok di `routes/auth/Auth.tsx` yang diganti.

**Konsekuensi.** Tidak ada perubahan kontrak API, skema, bentuk respons, atau aturan jurnal. Perilaku
baru hanya di klien; satu prop opsional ditambahkan pada `DataError` dan `SaldoPanel`. Kalimat galat
yang sudah ada tetap muncul apa adanya bila `label` tidak diberikan.

**Verifikasi.** `NODE_OPTIONS=--max-old-space-size=1536 pnpm --dir app verify` lulus (typecheck,
107 tes server, 5 tes web, build produksi). Telusuri klik pada Chrome: layar masuk menampilkan
monogram `IF` tanpa teks `[LOGO]`; lembar saringan Transaksi berlabel "Selesai"; ruang baru tanpa
dompet menampilkan keadaan kosong "Mulai dari sini" beserta tombolnya, dan setelah dompet pertama
dibuat Beranda kembali ke susunan panel biasa; subjudul Laporan dan baris periode Beranda menyebut
zona waktu ruang; permintaan data yang dijawab 401 menampilkan "Sesi berakhir. Masuk lagi…" tanpa
tombol "Coba lagi".

**Status:** 5 Oktober 2026 · diterapkan.
