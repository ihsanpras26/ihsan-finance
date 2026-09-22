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
- Tidak ada rahasia pihak ketiga di proyek ini. Tidak ada kunci API, tidak ada token layanan, dan
  tidak ada berkas `.env` yang diperlukan untuk menjalankan aplikasi.
- Variabel lingkungan yang dikenali hanya menyangkut lokasi dan port, bukan rahasia:
  `IHSAN_DATA_DIR`, `IHSAN_DB_PATH`, `HOST`, `PORT`, `APP_ORIGIN`, `LOG_LEVEL`, `SESSION_DAYS`
  (`app/server/src/config.ts`).

## Verifikasi

```bash
cd app
pnpm verify    # typecheck + 74 tes server + 6 tes antarmuka + build produksi
pnpm smoke     # 50 pemeriksaan HTTP nyata terhadap server yang benar-benar berjalan
```

Laporan gerbang anti-slop sebelum penyerahan ada di `docs/DELIVERY_GATE.md`.

## Susunan

```
Ihsan Finance/
  PRD_Aplikasi_Keuangan_Pribadi_v1.md   sumber kebenaran produk
  SOUL.md                               nilai dan cara kerja
  AGENTS.md                             aturan yang mengikat semua agen
  docs/                                 arsitektur, desain, keputusan, status, riset, gerbang
  skills/                               skill agen pihak ketiga berlisensi terbuka
  app/
    server/                             Node 24 + TypeScript langsung + node:sqlite
      src/core/                         uang, tanggal, id, galat
      src/db/                           skema dan pembungkus transaksi
      src/domain/                       jurnal, transaksi, dompet, utang, tujuan, anggaran, laporan
      src/http/                         Fastify 5 + Zod
      src/workers/                      penjadwal kejadian berulang dan pengingat
      test/                             74 tes, termasuk seluruh skenario penerimaan PRD
    web/                                React 19 + Vite 7 + Tailwind v4, PWA
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
