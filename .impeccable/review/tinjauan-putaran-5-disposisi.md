# Disposisi tinjauan desain putaran 5 (1 Oktober 2026)

Sumber: reviewer `impeccable` atas arah canon D-18 (`docs/DESIGN.md`, ENERGY 4 / RHYTHM 4 / MOTION 3).
Enam `material_fixes` dilaporkan; enam-enamnya ditindaklanjuti pada sesi yang sama. Berkas ini adalah
catatan serah-terima disposisinya, ditemani `audit-d18.json` dan empat PNG bukti di direktori ini.

Semua angka di bawah ditulis sebagai hasil pengukuran, bukan perkiraan. Tempat menelusuri buktinya
juga dicantumkan pada tiap butir supaya klaimnya bisa diperiksa ulang tanpa percaya pada catatan ini.

## 1. Bukti tema terang belum ada

- **Temuan:** keempat tangkapan yang diperiksa bertema gelap, sementara kanvas terang didaftarkan lebih
  dulu di `docs/DESIGN.md`.
- **Tindakan:** tangkapan ulang dalam tema terang, lalu disimpan ulang lewat Lanczos.
- **Bukti ukur:** `desktop.png` 1440x900 rata-rata RGB 248/243/250; `mobile.png` 390x844 rata-rata
  242/239/245; dua tangkapan lembar 1440x900 dan 390x844 dengan rata-rata 155-161 karena lapisan
  peredup dialog. Empat-empatnya terang, dan ukurannya persis sama dengan viewport yang diminta.
- **Batas kejujuran:** berkas PNG di direktori ini adalah hasil resample `ffmpeg -vf scale=…:flags=lanczos`
  dari tangkapan asli (harness memaskan tangkapan ke <=1024 px). Mode gelap tidak dinilai dari
  tangkapan, melainkan dari DOM: `getComputedStyle` ditambah komposit warna latar.

## 2. Gradien di grafik Laporan tidak terlihat pemeriksa

- **Temuan:** `charts.tsx` memakai `<linearGradient>` sebagai isian area, padahal bukti R-01 hanya
  memindai `background-image`.
- **Tindakan:** dipertahankan sebagai pengecualian yang dicatat, bukan dihapus: isian itu memberi
  bentuk pada arus kas, dan warnanya tetap dari token.
- **Bukti:** `app/web/src/components/charts.tsx:107-110` (masih ada pada penyerahan ini); dicatat di
  `docs/DELIVERY_GATE.md` bagian "Angka akhir" sebagai "Gradien SVG isian grafik (`/laporan`): 4 (satu
  per halaman, pengecualian tercatat)" dan di `audit-d18.json` sebagai `svgGradients: 4`. Klaim "0
  gradien" kini dibatasi tegas ke CSS, bukan ke seluruh aplikasi.

## 3. Glif netral terbaca sebagai minus

- **Temuan:** titik tengah `·` 13-14,5 px pada kolom tanda terbaca `-` pada dua pembacaan tangkapan
  independen.
- **Tindakan:** glif netral dihapus sama sekali. `SignMark` (`components/ui.tsx:291-300`) mengembalikan
  `null` untuk nilai netral, `NEUTRAL_SIGN` dan `signGlyph` dihapus dari `lib/format.ts` (grep kosong),
  dan `.sign-dot` sekarang hanya penanda nominal tersembunyi (seluruh digit sudah `••••••`). Lebar
  kolom tetap dikunci `.sign-col` = `1ch`, jadi angka tetap lurus.
- **Bukti ukur:** 24 halaman, 1.044 kolom tanda, **0 titik netral**, 0 sisa glif titik tengah; 500
  angka bernilai nol dengan **0 tanda palsu** (`+Rp0` / `−Rp0`).
- **Efek samping yang ditutup:** menghapus glif meninggalkan kotak kosong pada baris buku besar tanpa
  arah. Kini dipakai `IconTransfer` (`components/icons.tsx:111`, dipakai di
  `routes/transaksi/Transaksi.tsx:373`). Terukur di `/transaksi`: 17 kotak ikon, 4 berglif transfer,
  **0 kotak kosong**.

## 4. Semantik tanda uang sisa tidak satu aturan

- **Temuan:** "Sisa anggaran" tampil `+Rp952.500` sementara "Dana belum dialokasikan" tampil tanpa
  tanda, padahal keduanya uang sisa.
- **Tindakan:** `+` hanya untuk uang masuk. `routes/beranda/parts/BudgetNearLimit.tsx:59` memakai
  `remainingDirection = toMinor(budgetRemaining) < 0 ? 'out' : 'zero'`, sehingga sisa positif tampil
  netral. Pembaca layar tidak lagi mengumumkan "plus" untuk sisa anggaran.

## 5. Aksi utama lembar berulang menjorok dan terlalu pendek

- **Temuan:** tombol Konfirmasi/Lewati memakai `size="sm"` dan menjorok 52 px dari tepi konten, tanpa
  footer, sementara `DESIGN.md` menjanjikan 52 px untuk aksi utama di lembar.
- **Tindakan:** `routes/beranda/parts/RecurringSheet.tsx:83-88` memakai `Button size="lg"` (52 px) dan
  duduk di tepi konten (padding 52 px dihapus, grep `pl-[52px]` kosong). Sembilan
  `components/forms/*Form.tsx` memakai dua tombol `size="lg"` di kakinya (2 per berkas).
- **Batas klaim:** janji "seluruh kaki lembar 52 px" dipersempit ke kenyataan. Lembar saringan,
  detail transaksi, arsip tujuan, dan `ConfirmDialog` memakai 44 px. Invarian yang dijaga di semua
  tempat: dua tombol dalam satu kaki lembar selalu setinggi satu sama lain.

## 6. Baris bukti gerbang tidak akurat terhadap kode

- **Temuan:** R-11 mengutip radius 4/8/12/16 px padahal kode memakai 999/14/24/28, dan R-06 tidak
  menyebut label kapital 11,5 px yang nyata dipakai.
- **Tindakan:** `docs/DELIVERY_GATE.md` bagian Gerbang D-18 memakai angka yang benar (R-11: pil 999,
  kendali 14, panel 24, lembar 28, 0 radius literal; R-06: label kapital 11,5 px di dalam kartu
  beserta alasannya). Dua kalimat lama di blok D-15 kini masuk daftar "Klaim lama yang dikoreksi"
  sebagai item 11 dan 12, dan kepala berkas memuat catatan pembaruan.
- **Bukti kode untuk label kapital:** `components/ui.tsx:350`, `routes/transaksi/Transaksi.tsx:772`
  dan `:791`.

## Temuan tambahan yang ditutup pada sesi yang sama

- **Angka kontras.** Nilai lama (4,38:1 / 6,34:1 / 6,6) berasal dari cuplikan piksel. Dihitung ulang
  dari komposit gaya terhitung: `#3b82f6` di atas tint aksen 14 persen = 4,30:1 (gagal AA, tetap
  ditinggalkan), `#60a5fa` di atas komposit yang sama = 6,23:1 (lulus), putih di atas `#2563eb` =
  5,17:1. Keputusan tidak berubah, angkanya yang diperbaiki, dan metode itu sama dengan yang dipakai
  pemeriksa audit.
- **Klaim yang terlalu luas.** "Seluruh kaki lembar 52 px" dan "skala spasi kelipatan 4 px"
  dipersempit ke kode yang sebenarnya (skala 2/4/6/8/10/12/14/16/20/24/32/36/40/48/64; padding
  8/10/12/16/20/36). Kode tidak dipaksa mengikuti janji lama.
- **Gerak.** Angka durasi di blok D-15 (hover 120ms, tekan 90ms, lembar 180ms, progres 240ms) tidak
  cocok dengan kode: transisi 150ms, tekan `translateY(1px)`, lembar 200ms `cubic-bezier(0.2, 0.8,
  0.3, 1)`, isian progres hanya bertransisi warna 150ms. `docs/DESIGN.md` kini punya bagian
  **Motion** yang mencatat angka itu; item 9 pada daftar klaim lama mencatat koreksinya.
- **Rujukan bagian.** 43 rujukan `DESIGN.md §N` di 15 berkas `app/web/src` menggantikan penomoran yang
  sudah tidak ada dengan nama bagian (`DESIGN.md "Kolom tanda"`, `DESIGN.md "Motion"`, dst). Item 10
  pada daftar klaim lama mencatatnya, dan kepala gerbang memuat padanan untuk blok lama.

## Hasil akhir yang relevan untuk penyerahan

| Pemeriksaan | Hasil |
|---|---|
| Kontras di bawah AA, 24 halaman | 0 dari 3.724 pemeriksaan; terketat yang lulus 4,74:1 |
| Kolom tanda / titik netral | 1.044 kolom / 0 titik netral |
| Kotak ikon kosong di `/transaksi` | 0 dari 17 kotak |
| Tanda palsu pada angka nol | 0 dari 500 |
| Target sentuh di bawah 44 px | 0 |
| Luapan horizontal, 24 halaman | 0 px |
| Tes server / web | 78/78 / 5/5 |
