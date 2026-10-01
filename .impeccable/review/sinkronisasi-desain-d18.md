# Sinkronisasi dokumen desain D-18 (1 Oktober 2026)

Pemeriksa dokumen (agen `DesignDocCheck`) membandingkan arah visual dengan kode yang dikirim, lalu
sesi ini memverifikasi ulang setiap koreksinya dan menutup sisa selisihnya. Berkas ini menyimpan
hasilnya supaya klaim dokumen bisa diperiksa tanpa membuka transkrip agen.

Cakupan: `docs/DESIGN.md`, `.impeccable/design.json`, `.impeccable/decision/direction.html`, dan
sembilan berkas `app/web/src` sebagai acuan kode.

## Hasil pemeriksa dokumen

| Berkas | Status | Isi |
|---|---|---|
| `docs/DESIGN.md` | dipatch | 14 koreksi nilai dan redaksi; prosa, tabel, dan frontmatter tetap bentuk aslinya |
| `.impeccable/design.json` | dipatch | 10 koreksi + 1 perbaikan sintaks (koma menggantung di `extensions.breakpoints`) |
| `.impeccable/decision/direction.html` | tanpa drift | catatan keputusan historis; 19 tanda `·` di dalamnya pemisah meta, blok `:root` milik kromatografi dokumen, mockup A/D cocok dengan canon, B dan C arah yang ditolak |
| `app/web/src/styles/index.css` | tanpa drift | acuan: `.sign-col` 1ch, `.sign-dot` 0.34em hanya untuk nominal tersembunyi, token aksen simetris terang-gelap |
| `app/web/src/components/ui.tsx` | tanpa drift | acuan: `SignMark`, `Money`, `BUTTON_SIZE`, `Chip`, `Tabs`, `SectionHead` |
| `app/web/src/components/icons.tsx` | tanpa drift | acuan: grid 20x20, goresan 1.75, `IconPlus`, `IconTransfer` |
| `app/web/src/components/layout/AppShell.tsx` | tanpa drift | acuan: bilah bawah 4 tujuan + tombol Tambah, `TabLink` 58px |
| `app/web/src/lib/format.ts` | tanpa drift | acuan: `moneySign` mengembalikan string kosong untuk netral |
| `app/web/src/routes/transaksi/Transaksi.tsx` | tanpa drift | acuan: kaki 44px, subjudul rincian kapital 13px, `SignMark` |
| `app/web/src/routes/beranda/parts/BudgetNearLimit.tsx` | tanpa drift | acuan: arah `out` hanya saat negatif |
| `app/web/src/routes/beranda/parts/RecurringSheet.tsx` | tanpa drift | acuan: kaki aksi 52px |
| `app/web/src/routes/laporan/parts/CategoryChart.tsx` | tanpa drift | acuan: kategori sebagai daftar, tanpa bilah |

Contoh koreksi `DESIGN.md` yang nilainya bisa ditelusuri: frontmatter `spacing` kini memuat `10`, `14`,
dan `36` px (`py-2.5`, tab `px-3.5`, `pr-9`); `button-primary.backgroundColor` menjadi
`{colors.accent-solid}`; `chip.backgroundColor` menjadi `{colors.surface}` dengan `padding: 0 12px`
(code `px-3`); dan kalimat "kolom tanda yang selalu terisi" menjadi "selalu ada".

Contoh koreksi `design.json`: `extensions.colorMeta["dark-accent"].canonical` menjadi `#60a5fa`
beserta ramp warnanya; `extensions.motion` menyebut pembukaan lembar `200ms cubic-bezier(0.2, 0.8,
0.3, 1)`; entri breakpoint `md` dan `xl` dihapus karena `app/web/src` hanya memakai varian `sm:` dan
`lg:` (diverifikasi dengan grep, 0 kemunculan `md:`/`xl:`); emoji baris buku besar diganti SVG 20px
dari `icons.tsx`; dan kalimat "kolom tanda selalu terisi" hilang dari `narrative.keyCharacteristics`.

## Verifikasi ulang oleh sesi ini

Semua klaim di atas diperiksa langsung terhadap kode, bukan diterima apa adanya:

- `BUTTON_SIZE` (baris 136-140): `sm px-3 py-1.5` / `md min-h-[44px] px-4 py-2.5` / `lg min-h-[52px]
  px-5 py-3`; `INPUT_BASE` baris 211 `px-3 py-2.5`; `Select` baris 223 `pr-9` dengan
  `bg-[length:14px]`; `Chip` baris 800-806 `border-hairline bg-raised hover:bg-sunken px-3`; pil
  `Tabs` baris 689 `px-3.5` tanpa thumb geser.
- `charts.tsx` hanya mengekspor `compactIDR`, `LineChart`, `DonutChart`; `lg:grid-cols-2` memang
  setara 1024 px.
- `design.json`: `dark-accent.canonical` `#60a5fa`, `dark-accent-soft.canonical` `#3b82f6` (nilai
  kanon `#3b82f624` = alfa 36/255 = 14 persen), snippet `Money` untuk netral berupa
  `<span class="ds-sign"></span>` kosong, dan tidak ada `sign-dot` maupun `sign-col` yang salah
  tempat.
- `JSON.parse(design.json)` berhasil; 10 komponen dan 6 kunci narasi terbaca.
- `direction.html`: 19 tanda `·` semuanya pemisah meta, bukan glif kolom tanda.

## Selisih yang baru ditutup pada sesi ini

1. **Bagian Motion.** `DESIGN.md` belum punya daftar gerak, sementara baris R-19 di gerbang dan dial
   MOTION 3 menyatakan gerak "terdaftar di `DESIGN.md`". Bagian `## Motion` ditambahkan berisi angka
   nyata dari kode: transisi kendali 150ms, kartu mengangkat 150ms `ease-out`, tekan
   `translateY(1px)`, lembar 200ms `cubic-bezier(0.2, 0.8, 0.3, 1)`, kerangka `animate-pulse`, tombol
   sibuk `animate-spin` 16px, isian bilah progres hanya bertransisi warna 150ms, dan
   `prefers-reduced-motion` memaksa seluruh durasi ke 0.01ms.
2. **Rujukan bagian usang.** 43 rujukan `DESIGN.md §N` di 15 berkas `app/web/src` memakai penomoran
   yang sudah tidak ada. Semuanya diganti nama bagian (`DESIGN.md "Kolom tanda"`, `DESIGN.md
   "Motion"`, dan seterusnya); diverifikasi: 0 rujukan lama tersisa, 43 rujukan baru.
3. **Angka kontras.** Nilai lama 4,38 / 6,34 / 6,6 berasal dari cuplikan piksel. Dihitung ulang dari
komposit gaya terhitung: `#3b82f6` pada tint aksen 14 persen = 4,30:1 (tetap ditinggalkan),
`#60a5fa` pada komposit sama = 6,23:1, putih di atas `#2563eb` = 5,17:1.
4. **Klaim lebih luas dari kode.** "Seluruh kaki lembar 52 px" dipersempit ke sembilan formulir,
   lembar entri cepat, dan lembar berulang (sisanya 44 px dengan invarian tinggi pasangan sama), dan
   "skala kelipatan 4 px" diganti skala sebenarnya 2/4/6/8/10/12/14/16/20/24/32/36/40/48/64.
5. **Gerbang.** Kepala berkas memuat catatan pembaruan dan padanan `§N`; daftar "Klaim lama yang
   dikoreksi" bertambah item 9 sampai 12 (gerak, rujukan bagian, radius 999/14/24/28 vs 4/8/12/16,
   label kapital 11,5 px); baris "Angka akhir" bertambah satu baris tentang gerak di luar daftar
   Motion; dan baris "Ruang putih struktural" kini menunjuk `DESIGN.md` bagian Layout.

## Catatan kejujuran

- `.impeccable/design.json` diperbaiki di tempat pada 1 Oktober 2026, tetapi medan `generatedAt` di
  dalamnya masih `2026-09-29T13:46:51.884Z` (waktu pembuatan pertama). Isi yang berlaku adalah isi
  setelah koreksi, bukan waktu itu.
- `docs/DESIGN.md` bagian Motion mencatat angka yang berlaku hari ini. Angka gerak di blok D-15
  gerbang sengaja tidak ditulis ulang di tempatnya, melainkan dikoreksi lewat item 9 supaya jejak
  laporan lama tetap terbaca.
