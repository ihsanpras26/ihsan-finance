---
version: 1
slug: "app-web-src-routes-beranda-beranda-tsx"
primary_target: "app/web/src/routes/beranda/Beranda.tsx"
related_targets: ["app/web/src/components/ui.tsx","app/web/src/components/layout/AppShell.tsx","app/web/src/styles/index.css","app/web/src/routes/transaksi/Transaksi.tsx","app/web/src/routes/rencana/Rencana.tsx","app/web/src/routes/laporan/Laporan.tsx","app/web/src/routes/profil/Profil.tsx"]
---

# Surface brief — Ihsan Finance (aplikasi web, kelima layar)

Mode pengunjung: **Operate**. Dipakai beberapa kali sehari sambil berdiri, satu tangan, 390px lebih
dulu; desktop untuk meninjau.

Audiens dan pekerjaan: satu orang yang mencatat uangnya sendiri. Setelah membayar sesuatu ia ingin
mencatat dalam hitungan detik; sebelum berbelanja ia ingin tahu saldo dompet dan sisa anggaran.
Tindakan utama: **Tambah** (tengah bilah bawah), lalu menelusuri daftar, dan membuka angka ringkasan
menjadi baris penyusunnya.

Bukti dan isi: seluruh angka berasal dari API (jurnal berpasangan); tidak ada angka karangan. Data
demonstrasi berasal dari `pnpm seed` dan diberi label sintetis.

Batasan: `APP/AGENTS.md` (uang integer Rupiah, `workspace_id` dari sesi, idempotensi, atomik),
`docs/PRD_Aplikasi_Keuangan_Pribadi_v1.md` (urutan informasi Beranda §03, FR04 kartu membuka rincian,
FR07 cari dan saring, FR18 laporan), `docs/DESIGN.md` (sumber kebenaran visual sampai ditulis ulang
di akhir), target sentuh 44px, NFR06 arah uang tidak pernah warna-saja, R-27 empat keadaan.

## Direction contract

**THESIS:** Layar ini adalah **register**: satu kolom angka yang lurus dengan tanda arah eksplisit,
dan setiap angka ringkasan bisa dibuka menjadi baris jurnal yang menyusunnya. Ia menolak susunan
bawaan kategori ini: kartu dekoratif dengan pendar, gradien aurora, tombol menyala, dan angka
ringkasan yang tidak bisa ditelusuri.

**OWN-WORLD:** Kanvas netral `#f4f4f5`, panel putih radius 24px, pemisah garis rambut, satu biru
struktural `#0256ff` hanya di titik keputusan, kuning `#ffb700` hanya untuk seri data kedua.
Nominal selalu IBM Plex Mono dengan kolom tanda `+ / − / ·`; teks Schibsted Grotesk pada delapan
langkah ukuran. Kedalaman hanya milik lapisan yang mengambang; kartu diam. Mode gelap memakai
geometri yang sama dengan kanvas nyaris hitam. Kalau semua teks dihapus, yang tersisa: kolom angka
rata kanan, bilah aksen 3px di item navigasi aktif, dan tombol pil biru tunggal.

**STORY:** "Saya tahu berapa uang yang bisa dipakai, apa yang sudah keluar bulan ini, apa yang
segera jatuh tempo, dan saya bisa mencatat pembelian terakhir tanpa berpikir soal formulir."
Pengguna percaya karena setiap angka bisa dibuka ke asalnya; ia bertindak lewat Tambah di tengah
bilah bawah, dan lewat pencarian yang dipin di puncak daftar.

**FIRST VIEWPORT:** Beranda 390px, urutan mengikat: kepala ringkas (judul, tanggal, tombol mata
nominal, notifikasi) → **banner pekerjaan** hanya bila ada draf, transaksi berulang menunggu
konfirmasi, atau anggaran mendekati batas → panel saldo: total 34px mono di bawah labelnya, baris
tiga dompet dengan kolom tanda, kekayaan bersih sebagai angka terpisah dengan komponennya → arus
bulan ini tiga angka (masuk, keluar, selisih) → sisa anggaran dengan kategori terdekat batas →
jatuh tempo 7 hari → progres tujuan. Tanpa grafik di layar pertama. Aksi utama: tombol bulat 56px
di tengah bilah bawah, satu jempol dari mana saja.

**Interaksi tanda tangan:** **membuka angka** — setiap angka ringkasan adalah tombol yang menurunkan
baris jurnal penyusunnya di tempat (FR04), dengan `aria-expanded` dan fokus yang kembali; dan
**satu tombol mata** menyembunyikan seluruh nominal sekaligus dengan satu pengumuman `aria-live`.

**FORM:** **canon** — konvensi pasar dikerjakan penuh, tanpa keunikan yang diselundupkan. Patokan
mutu yang mengikat: YNAB (banner perhatian paling atas, ruang bernomor), Copilot Money (urutan
dasbor tetap, nominal bertanda), Monzo (detail sebagai lembar bawah), Jenius (tombol tengah di
navigasi bawah). Ini pilihan pemilik atas arah yang ditugaskan dadu (#3 terbitan statistik) dan
pilihan pertama saya (#1 buku tabungan). seed key: `3b9442ef`, `--kind canon`.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.
