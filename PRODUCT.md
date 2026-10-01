# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Satu orang Indonesia yang mengelola uangnya sendiri, lebih sering dari HP daripada dari desktop,
sering tepat setelah membayar sesuatu (berdiri, satu tangan). Tiga kebutuhan awal menurut PRD §01:
penerima pendapatan rutin yang memantau sisa anggaran bulan berjalan; pekerja dengan pendapatan
berubah yang memantau arus kas; pengguna dengan utang, piutang, dan tujuan tabungan.

P0 hanya satu pemilik per ruang keuangan (`memberships` role owner; peran kedua = P1). PRD §02
menyebut pemakaian bersama pasangan sebagai keputusan yang belum ditetapkan.

## Product Purpose

Mencatat pendapatan, pengeluaran, transfer, refund, utang dan piutang, tujuan tabungan, dan
anggaran dalam satu tempat, lalu menampilkan saldo serta laporan yang konsisten. Masalah yang
diselesaikan: catatan tersebar membuat pengguna tidak tahu uang yang tersedia, pengeluaran
terbesar, dan kewajiban yang segera jatuh tempo (PRD §01).

Keberhasilan diukur: input harian median ≤ 15 detik dan p90 ≤ 30 detik; ≥ 80% peserta uji berhasil
membuat dompet dan transaksi pertama tanpa bantuan; 100% skenario finansial wajib lulus (PRD §01).
Angka-angka ini hipotesis produk yang belum divalidasi dengan pengguna nyata.

## Positioning

Setiap peristiwa yang dibukukan menjadi jurnal berpasangan, sehingga transfer, pembayaran pokok,
refund, dan koreksi tetap konsisten di balik antarmuka sederhana; pengguna tidak perlu memahami
jurnal (PRD §10). Saldo selalu turunan dari ledger, bukan sumber kebenaran. Koreksi transaksi
posted = pembalikan + pengganti, tidak pernah menimpa histori.

## Operating Context

- PWA responsif: HP lebih dulu (390px adalah susunan dasar), desktop menambah kolom (PRD §03).
- Bahasa Indonesia, mata uang IDR, zona waktu dipilih saat onboarding; format `Rp25.000`.
- P0 input manual saja. Tanpa integrasi bank, OCR, atau input suara (itu P2).
- Keadaan luring: draf belum terkirim disimpan di perangkat dan tidak mengubah saldo (FR22);
  aplikasi tidak menjanjikan seluruh fitur jalan tanpa koneksi (PRD §09).
- Dataset kerja saat ini: satu akun demo `demo@ihsan.test` dengan ruang "Keuangan Keluarga";
  seluruh nominalnya **data uji sintetis**, bukan data pengguna nyata.

## Capabilities and Constraints

P0 yang sudah terimplementasi ada di `docs/STATUS.md`: akun dan sesi, dompet + rekonsiliasi,
transaksi (pendapatan, pengeluaran, transfer, refund, koreksi), utang dan piutang dengan cicilan
parsial, goals dan alokasi, anggaran per kategori, rencana berulang dengan konfirmasi atau melewati
kejadian, pengingat in-app, laporan periode + ekspor CSV, preferensi, keamanan sesi, dan penghapusan
akun.

Kendala yang mengikat (AGENTS.md, PRD §11-13):

- Uang = bilangan bulat Rupiah. API mengirim nominal sebagai string desimal. Batas P0
  Rp999.999.999.999 per peristiwa; penjumlahan wajib memeriksa overflow.
- Tidak ada `UPDATE`/`DELETE` pada `journal_lines` yang sudah dibukukan.
- Setiap baris finansial punya `workspace_id`, difilter dari sesi, dan otorisasi diperiksa server.
- Setiap mutasi menerima `Idempotency-Key`; kunci sama + muatan sama mengembalikan hasil yang sama.
- Satu penulisan transaksi + jurnal + pembayaran/alokasi = satu transaksi DB.
- Bahasa: teks antarmuka Indonesia; kode, komentar, dan dokumen teknis Inggris (penyimpangan
  dokumen teknis berbahasa Indonesia dicatat di `docs/DECISIONS.md` D-13, menunggu keputusan).

Belum diputuskan pemilik (PRD §16): pemakaian pribadi murni atau bersama pasangan, metode login,
kebutuhan kartu kredit sejak awal, dan apakah impor riwayat masuk rilis pertama.

## Brand Commitments

- Nama produk: **Ihsan Finance**, ditulis sebagai teks (belum ada logo yang disetujui).
- Aset yang belum ada: logo, avatar, foto, testimoni, statistik pengguna. Tempat logo memakai
  penanda jujur `[LOGO]` (DESIGN §12, R-23). Tidak ada klaim keamanan yang belum diverifikasi.
- Suara teks (DESIGN §11): kalimat pendek, kata konkret, tombol menyebut aksinya, pesan galat
  menyebut sebab dan tindakan, tanpa tanda pisah panjang, tanpa kata pemanis, tanpa emoji.
- Pemilik menyatakan preferensi visual dengan melampirkan gambar referensi; keputusan arah
  tercatat di `docs/DESIGN.md` dan `docs/DECISIONS.md`.

## Evidence on Hand

- `PRD_Aplikasi_Keuangan_Pribadi_v1.md` (v1.0, 21 September 2026) — sumber kebenaran produk.
- `docs/UX_RESEARCH.md` — riset permukaan atas Money Lover, Finansialku, Wallet, Actual Budget,
  Firefly III, Money Manager EX, dengan sumber resmi dan bagian "tidak terverifikasi".
- `docs/STATUS.md` — bukti verifikasi, termasuk 18 skenario AT dan cacat yang sudah diperbaiki.
- Tes: `app/server/test/*.test.ts` (tanpa jaringan) dan `app/web/test/format.test.ts`; verifikasi
  dengan `cd app && pnpm verify` (typecheck + tes + build).
- Data demo sintetis di `app/data/ihsan.db` untuk akun `demo@ihsan.test`.

Yang tidak ada dan tidak boleh dikarang: data pengguna nyata, hasil uji pengguna, benchmark,
jumlah pengguna, harga, dan logo.

## Product Principles

1. **Angka adalah produknya.** Setiap nominal harus langsung terbaca: arah uang selalu punya tanda
   dan kata, bukan hanya warna (NFR06). Nol adalah satu-satunya pengecualian: ia tidak punya arah,
   jadi tidak diberi tanda apa pun.
2. **Cepat dicatat, jujur saat gagal.** Form ringkas dengan isian wajib lebih dulu; aplikasi tidak
   pernah menyatakan "tersimpan" sebelum server mengonfirmasi (FR22).
3. **Perhitungan tidak bisa dibantah.** Saldo, laporan, dan sisa pokok selalu dapat dibangun ulang
   dari ledger; tidak ada nilai yang diketik ulang sebagai sumber kebenaran.
4. **Data adalah milik pengguna.** Ekspor, penghapusan, dan privasi nominal adalah bagian produk,
   bukan tambahan (NFR07).
5. **Bahasa manusia, bukan bahasa mesin.** Pesan menyebut sebab dan langkah berikutnya.

## Accessibility & Inclusion

NFR06 mengikat: kontras teks biasa ≥ 4,5:1, teks utama 16 CSS px, zoom 200%, label untuk pembaca
layar, fokus keyboard yang terlihat, dan arah nominal tidak pernah hanya dibedakan warna. DESIGN
§13 menambahkan target sentuh minimum 44×44px tanpa kecuali, tanpa zoom otomatis iOS (input ≥16px),
safe-area di kepala/bilah bawah/lembar, dan penghormatan `prefers-reduced-motion`. NFR01: layout
berfungsi 360–1440 CSS px tanpa gulir horizontal pada alur utama. Pengguna yang belum diteliti:
tidak ada kebutuhan khusus yang terdokumentasi selain standar AA di atas.
