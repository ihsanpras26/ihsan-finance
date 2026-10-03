# Ihsan Finance

Aplikasi keuangan pribadi untuk pengguna Indonesia. Mencatat pendapatan, pengeluaran, utang,
piutang, anggaran, dan tujuan tabungan dalam satu tempat, dengan bahasa antarmuka Indonesia dan
seluruh nominal dalam Rupiah.

Status: **P0, tahap pengembangan aktif.** Bukan rilis produksi.

## Apa yang sudah jalan

| Bagian | Keadaan |
|---|---|
| Jurnal berpasangan (double-entry) | Selesai. Saldo selalu turunan dari jurnal, tidak pernah disimpan. |
| Transaksi: pendapatan, pengeluaran, transfer, refund, koreksi, pembatalan | Selesai |
| Utang dan piutang, termasuk pokok dan bunga terpisah | Selesai |
| Anggaran per kategori, tujuan tabungan, transaksi berulang, pengingat | Selesai |
| Laporan periode, perbandingan bulan, ekspor CSV dan cadangan penuh | Selesai |
| Antarmuka web responsif + PWA, tema terang dan gelap | Selesai |
| Otentikasi, isolasi ruang per pengguna, jejak audit, idempotensi mutasi | Selesai |

Rincian per fitur dan skenario penerimaan ada di `docs/STATUS.md`.

## Menjalankan

Butuh **Node 24** dan **pnpm**. Tidak ada langkah build untuk server: Node 24 menjalankan
TypeScript secara langsung.

```bash
cd app
pnpm install
pnpm seed      # isi data contoh
pnpm dev       # API di http://127.0.0.1:8787, antarmuka web di http://127.0.0.1:5173
```

Untuk menjalankan hasil build produksi dari satu proses:

```bash
cd app
pnpm build     # bangun antarmuka
node server/src/main.ts   # API dan antarmuka dilayani bersama di http://127.0.0.1:8787
```

### Kredensial pengembangan

Data contoh membuat dua akun. **Keduanya hanya ada di basis data lokal Anda setelah `pnpm seed`
dijalankan, dan tidak berlaku di mana pun selain mesin Anda sendiri.**

| Keperluan | Email | Kata sandi |
|---|---|---|
| Masuk dan menjelajah aplikasi | `demo@ihsan.test` | `demo-ihsan-2026` |
| Uji asap otomatis (`pnpm smoke`) | `smoke@ihsan.test` | `smoke-uji-2026` |

Kata sandi ini ditulis terbuka di dalam kode sumber (`app/server/src/tools/seed.ts` dan
`app/scripts/smoke.mjs`) karena keduanya memang akun contoh untuk pengembangan, bukan kredensial
rahasia. Jangan pakai ulang kata sandi ini untuk akun sungguhan.

Cara kredensial disimpan di aplikasi ini, supaya jelas apa yang harus dijaga saat masuk produksi:

- Kata sandi disimpan sebagai hash **scrypt** dengan garam acak per pengguna, tidak pernah sebagai
  teks biasa (`app/server/src/domain/auth.ts`).
- Token sesi dibuat dari 32 byte acak dan yang disimpan di basis data hanya **hash SHA-256**-nya.
  Karena itu tidak ada kunci rahasia server yang perlu diatur untuk sesi.
- Aplikasi ini tidak butuh rahasia apa pun untuk berjalan lokal. Kredensial hanya muncul pada
  penyalaan produksi: `IHSAN_DB_TOKEN` (Turso), `IHSAN_S3_*` (cadangan offsite), dan
  `CRON_SECRET` (penjadwal serverless). Semuanya opsional bagi mesin pengembangan.
- Variabel lingkungan yang dikenali ada di `app/.env.example`; bentuknya dijaga
  `app/server/src/config.ts` dan `app/server/test/deploy.test.ts`.

## Verifikasi

```bash
cd app
pnpm verify    # typecheck + 106 tes server + 5 tes antarmuka + build produksi
pnpm smoke     # 50 pemeriksaan HTTP nyata terhadap server yang benar-benar berjalan
```

Di mesin 8 GB, jalankan dengan `NODE_OPTIONS=--max-old-space-size=1536 pnpm verify`; tanpa itu Node
bisa berhenti dengan `Zone Allocation failed` saat memori bebas menipis. Hook `pre-commit` memakai
nilai itu sebagai bawaan.

Laporan gerbang anti-slop sebelum penyerahan ada di `docs/DELIVERY_GATE.md`.

Menyalakan cadangan ke luar mesin (S3/R2/B2):

```bash
cd app
pnpm offsite:dump   # hanya dump + pemeriksaan
pnpm offsite        # dump, unggah, lalu pangkas salinan lokal
```

Dump membaca basis data Turso bila `IHSAN_DB_URL` terisi, kalau tidak berkas lokal `IHSAN_DB_PATH`.
Berkasnya ditaruh di `<IHSAN_DATA_DIR>/offsite` (`IHSAN_OFFSITE_DIR` bila perlu tempat lain), bukan
di direktori snapshot `backup.mjs`, supaya retensi keduanya tidak saling menghapus.

Kontrak penyalaan, penjadwal, dan pemulihan ada di `docs/DEPLOY.md`; langkah menyalakan produksi
dari dashboard ada di `docs/PANDUAN_PENYALAAN.md` (mode serverless Vercel + Turso) dan
`docs/PANDUAN_PENYALAAN_VPS.md` (mode satu proses di VPS atau mesin sendiri). Di Windows, jadwal
offsite memakai `deploy/windows/offsite.ps1`.

## Susunan

```
Ihsan Finance/
  PRD_Aplikasi_Keuangan_Pribadi_v1.md   sumber kebenaran produk
  SOUL.md                               nilai dan cara kerja
  AGENTS.md                             aturan yang mengikat semua agen
  docs/                                 arsitektur, desain, keputusan, status, riset, gerbang
  skills/                               skill agen pihak ketiga berlisensi terbuka
  app/
    server/                             Node 24 + TypeScript langsung + @libsql/client (berkas atau Turso)
      src/core/                         uang, tanggal, id, galat
      src/db/                           skema dan pembungkus transaksi
      src/domain/                       jurnal, transaksi, dompet, utang, tujuan, anggaran, laporan
      src/http/                         Fastify 5 + Zod
      src/workers/                      penjadwal kejadian berulang dan pengingat
      test/                             tes server, termasuk seluruh skenario penerimaan PRD
    api/                                fungsi Vercel pembungkus Fastify (mode serverless, D-21)
    vercel.json                         build, rewrite SPA, dan cron penjadwal harian
    web/                                React 19 + Vite 7 + Tailwind v4, PWA
  deploy/
    systemd/                            unit server, snapshot, dan timer cadangan
    windows/offsite.ps1                 dump + unggah offsite terjadwal dari Task Scheduler
```

## Keputusan yang mengikat

Tiga aturan yang tidak boleh dilanggar, dan alasannya:

1. **Uang adalah bilangan bulat Rupiah.** Tidak ada floating point untuk nominal. Dikirim lewat
   API sebagai string desimal. Batas P0 Rp999.999.999.999 per peristiwa.
2. **Jurnal berpasangan.** Setiap peristiwa yang dibukukan punya total debit sama dengan total
   kredit. Tidak ada `UPDATE` atau `DELETE` pada baris jurnal yang sudah dibukukan; koreksi
   dilakukan dengan transaksi pembalikan lalu pengganti.
3. **Isolasi ruang.** Setiap baris finansial punya `workspace_id`, dan setiap query memfilternya
   dari sesi, bukan dari parameter permintaan.

Seluruh keputusan lain beserta alasannya ada di `docs/DECISIONS.md`.

## Dokumentasi

| Berkas | Isi |
|---|---|
| `PRD_Aplikasi_Keuangan_Pribadi_v1.md` | Sumber kebenaran produk. Bila kode dan PRD berbeda, PRD menang. |
| `docs/ARCHITECTURE.md` | Bentuk sistem, modul, dan aliran data |
| `docs/DESIGN.md` | Arah visual: palet, rupa huruf, jarak, motif, gerak |
| `docs/DECISIONS.md` | Keputusan teknis dan penyimpangan yang dicatat terbuka |
| `docs/STATUS.md` | Keadaan tiap fitur, cakupan tes, dan yang belum selesai |
| `docs/DEPLOY.md` | Menjalankan di server: lingkungan, wadah, TLS, cadangan/restore, pilihan hosting |
| `docs/PANDUAN_PENYALAAN.md` | Panduan langkah demi langkah penyalaan produksi (Turso, Vercel, DNS, R2) |
| `docs/PANDUAN_PENYALAAN_VPS.md` | Panduan langkah demi langkah penyalaan mode A (VPS/mesin sendiri, Caddy, DNS, systemd) |
| `docs/DELIVERY_GATE.md` | Laporan gerbang anti-slop sebelum penyerahan |
| `docs/SKILLS.md` | Skill agen yang dipakai, sumber, dan lisensinya |
| `docs/UX_RESEARCH.md` | Riset pola UX aplikasi keuangan sejenis, dengan sumber |

## Skills

Repositori ini menyertakan skill agen pihak ketiga yang membentuk cara proyek ini dikerjakan,
seluruhnya berlisensi terbuka (MIT dan Apache 2.0) dengan teks lisensi disertakan di `skills/`.
Daftar lengkap dan atribusinya ada di `skills/README.md` dan `docs/SKILLS.md`.

## Lisensi

Kode aplikasi ini belum ditetapkan lisensinya oleh pemiliknya. Skill di dalam `skills/` tetap
milik penulis masing-masing dengan lisensinya sendiri, dan tidak tercakup oleh status lisensi
kode aplikasi.
