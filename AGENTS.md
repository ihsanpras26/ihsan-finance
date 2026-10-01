# Ihsan Finance: Aturan Proyek (semua agen)

Aplikasi keuangan pribadi P0. **`PRD_Aplikasi_Keuangan_Pribadi_v1.md` adalah sumber kebenaran.**
Bila kode dan PRD berbeda, PRD menang; jangan diam-diam mengubah cakupan; catat di `docs/DECISIONS.md`.

## Aturan yang tidak boleh dilanggar

1. **Uang = bilangan bulat Rupiah.** Tidak ada floating point untuk nominal. Simpan `INTEGER`
   (rupiah penuh), kirim lewat API sebagai **string desimal**, hitung dengan bilangan bulat.
   Periksa overflow; batas P0 Rp999.999.999.999 per peristiwa.
2. **Jurnal berpasangan.** Setiap peristiwa yang dibukukan: total debit = total kredit.
   Tidak ada `UPDATE`/`DELETE` pada `journal_lines` yang sudah dibukukan. Koreksi = transaksi
   pembalikan + pengganti. Saldo selalu turunan dari ledger, bukan sumber kebenaran.
3. **Isolasi ruang.** Setiap baris finansial punya `workspace_id`. Setiap query wajib memfilter
   `workspace_id` dari sesi, bukan dari parameter request. Otorisasi diperiksa di server.
4. **Idempotensi.** Semua mutasi menerima `Idempotency-Key`. Kunci sama + payload sama →
   respons sama (tidak menggandakan). Kunci sama + payload beda → tolak.
5. **Atomic.** Satu penulisan transaksi + jurnal + pembayaran/alokasi = satu transaksi DB.
   Gagal satu langkah → seluruhnya dibatalkan.
6. **Jangan mengarang angka finansial.** Nilai yang tidak pasti ditandai, bukan ditebak.
7. **Bahasa.** Teks antarmuka **Indonesia** (pesan error menyebut tindakan konkret).
   Kode, komentar, nama variabel, dan dokumen teknis **Inggris**.

## Aturan UI (filter anti-slop)

Core `antislop` selalu aktif. Muat skill tambahan sesuai pekerjaan:
UI → `antislop-ui`, teks → `antislop-copywriting`, orang/a11y → `antislop-human`,
mobile → `antislop-layoutmobile`, komentar kode → `antislop-code`.
Arah estetika berasal dari `docs/DESIGN.md`; itu sumber kebenaran visual, bukan selera agen.
Sebelum menyerahkan pekerjaan UI: jalankan **Delivery Gate** (laporan 4 blok PASS/FAIL) dan
smoke test klik (R-35) di browser nyata. Skill pendukung: `impeccable`, `taste-skill`,
`redesign-skill` (audit), `grill-me` (interogasi rencana sebelum dibangun).

Skill agen ada di `skills/` di akar proyek. Sumber, lisensi, dan daftar yang sengaja tidak
dipublikasikan ada di `docs/SKILLS.md`. Jangan salin ulang skill pihak ketiga ke lokasi lain di
dalam repositori ini; satu lokasi saja supaya isinya tidak ada dua kali.

## Stack

- Node 24 (TypeScript langsung, tanpa build step server) + libSQL (`@libsql/client`): berkas
  lokal atau Turso, lihat `docs/DECISIONS.md` D-21. `node:sqlite` hanya dipakai `app/scripts/backup.mjs`.
- API: Fastify 5 + Zod. Web: React 19 + Vite 7 + Tailwind v4. PWA (manifest + service worker).
- Tes: `node:test` (server, tanpa jaringan). Verifikasi: `pnpm verify` di `app/`.

## Verifikasi wajib sebelum menyatakan selesai

```bash
cd app && pnpm verify     # typecheck + seluruh tes
```

Setiap perbaikan bug mendapat tes regresi. Klaim tanpa output tes tidak dianggap selesai.
