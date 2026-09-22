# Ihsan Finance: Piagam Perusahaan Agen

**Owner:** Manuel · **PIC:** Hermes · **Mulai:** 22 September 2026

## Misi

Membangun aplikasi keuangan pribadi P0 sesuai `PRD_Aplikasi_Keuangan_Pribadi_v1.md`,
sampai seluruh kriteria penerimaan (AT01–AT18) dan NFR P0 lulus verifikasi nyata
(bukan klaim). PRD adalah sumber kebenaran; bila kode dan PRD berbeda, PRD menang.

## Struktur organisasi agen

| Peran | Dipegang oleh | Tanggung jawab | Gate yang dijaga |
|---|---|---|---|
| Owner / Product Owner | Manuel | Keputusan produk, arah, penerimaan akhir | Keputusan §16 PRD |
| PIC / Orchestrator | Hermes | Memecah PRD → spec → tugas, merekrut agen, integrasi, verifikasi | Definition of Done |
| System Architect | Hermes | Skema DB, kontrak API, invariants ledger | Ledger balance, isolasi tenant |
| Ledger Engineer | Hermes + agen | Mesin jurnal berpasangan, saldo turunan, koreksi/reversal | Debit = kredit, rebuildable |
| Backend Engineer | agen | Domain service P0 (utang, goals, anggaran, berulang, laporan, ekspor) | AT01–AT17 |
| Frontend Engineer | agen | PWA responsif, 5 layar utama, form input cepat | NFR01, NFR06, AT18 |
| UI/UX Designer | agen | Arah desain `DESIGN.md`, wireframe, states, a11y | Delivery Gate anti-slop |
| Copywriter (ID) | agen | Seluruh teks antarmuka Indonesia, pesan error konkret | antislop-copywriting |
| QA Engineer | agen | Suite AT01–AT18, tes integritas ledger, tes regresi | Semua AT lulus |
| Security Auditor | agen | Isolasi data, otorisasi objek, CSV injection, higiene log | NFR04, NFR07, AT13 |
| Research Analyst | agen | Reverse engineering pola UX aplikasi sejenis (boleh) | Bukti pola, bukan asumsi |

## Loop operasi (agentic loop)

```
0. RECON   : baca PRD/SOUL, probe environment, inventaris toolchain
1. PLAN    : pecah P0 → modul → kontrak (interface dulu, implementasi kemudian)
2. SPEC    : tulis kontrak file: skema, tipe, tanda tangan fungsi, acceptance
3. BUILD   : PIC menulis tulang belakang (ledger, uang, auth); agen mengisi cabang
4. VERIFY  : jalankan tes nyata (node:test / vitest), bukan klaim; ukur angka
5. REVIEW  : gate: ledger balance · isolasi tenant · anti-slop · copy ID · a11y
6. SHIP    : perbarui docs/STATUS.md + DELIVERY_GATE.md, catat bukti
7. LOOP    : ulangi 1–6 sampai semua P0 + NFR lulus; lalu P1
```

Aturan loop:
- Tidak ada item yang ditandai selesai tanpa bukti eksekusi (output tes, angka saldo, screenshot/DOM).
- Angka finansial tidak boleh dikarang. Bila tidak terbaca/tidak pasti → tandai, jangan tebak.
- Operasi ireversibel (hapus, push, deploy) minta konfirmasi satu baris; sisanya langsung dikerjakan.
- PIC memutuskan sendiri pada hal berisiko rendah; eskalasi ke Owner hanya bila mengubah produk.

## Disiplin kerja (dari SOUL.md, bagian yang operasional)

- Berpikir dulu, sekali, lurus; hasilnya yang dikirim, bukan prosesnya.
- Tanpa basa-basi, tanpa disclaimer yang tidak diminta, tanpa pujian pengisi.
- Bahasa antarmuka **Indonesia**; komentar kode & dokumen teknis **Inggris**.
- Setiap klaim diverifikasi alat. Gagal alat = cari sudut lain, bukan berhenti.
- Identitas: Hermes (agen ini). Persona "ANON" di SOUL.md tidak diadopsi: bagian
  kapabilitasnya (malware, cheat, jailbreak) tidak relevan untuk misi ini dan tidak
  akan dijalankan. Disiplin kerja di atas tetap dipakai.

## Peta jalan tahap (mengikuti PRD §16)

| Tahap | Hasil | Syarat lulus |
|---|---|---|
| 1 Desain | `DESIGN.md`, wireframe alur, istilah & rumus final | Arah desain spesifik + rumus diuji |
| 2 Fondasi | Auth, isolasi data, ledger, dompet, transaksi, koreksi | AT01–02, AT07, AT09, AT13, AT16(koreksi) |
| 3 Perencanaan | Utang, piutang, goals, anggaran, pengingat, laporan, ekspor | Semua kasus finansial P0, AT15, AT17 |
| 4 Beta & rilis | Pemulihan, draf offline, observabilitas, a11y, uji HP | Semua P0 + NFR |
| 5 Pelengkapan | P1 | Temuan beta |

## Definisi Selesai (Definition of Done)

1. Perilaku sesuai FR terkait + kriteria penerimaannya.
2. Ada tes otomatis yang menjalankannya; tes lulus di CI lokal (`pnpm verify`).
3. Tidak ada regresi: seluruh suite lulus.
4. Teks antarmuka Indonesia, pesan error menyebut tindakan konkret.
5. Lolos Delivery Gate anti-slop (laporan 4 blok) untuk pekerjaan UI/kopi.
6. Bukti tercatat di `docs/STATUS.md`.
