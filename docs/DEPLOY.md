# Penyebaran dan Operasi: Ihsan Finance

Dokumen ini adalah kontrak menjalankan aplikasi di server, bukan di mesin pengembangan. Sumber
kebenaran produk tetap `PRD_Aplikasi_Keuangan_Pribadi_v1.md`; keputusan yang menyimpang dicatat di
`docs/DECISIONS.md`.

## 1. Bentuk yang dijalankan

Satu proses Node 24 menjalankan seluruh P0:

| Bagian | Peran |
|---|---|
| `app/server/src/main.ts` | API Fastify, penyaji PWA hasil build, penjadwal internal tiap 15 menit |
| `app/web/dist` | Hasil `pnpm --dir web build`; disajikan dari asal yang sama (`config.webDist`) |
| `<IHSAN_DATA_DIR>/ihsan.db` | Basis data SQLite mode WAL, seluruh uang dan jurnal di dalamnya |

Tidak ada `tsc` pada jalur produksi (type-stripping Node 24, D-03) dan tidak ada proses worker
terpisah untuk P0 (PRD §13: satu layanan aplikasi). Karena itu basis data **tidak boleh** dibagi ke
beberapa replika: satu proses, satu berkas, satu penulis. Menambah replika menuntut pindah ke
Postgres/libSQL dan itu pekerjaan tersendiri, bukan setelan.

## 2. Variabel lingkungan

Salinan acuan ada di `app/.env.example`. Ringkasnya:

| Variabel | Bawaan | Wajib di produksi | Catatan |
|---|---|---|---|
| `HOST` | `127.0.0.1` | ya | `0.0.0.0` di dalam wadah atau di belakang proksi |
| `PORT` | `8787` | tidak | platform biasanya menyuntikkan sendiri |
| `APP_ORIGIN` | kosong | ya | **wajib `https://…`**; dari sinilah cookie `Secure` dan HSTS dinyalakan |
| `IHSAN_DATA_DIR` | `app/data` | ya | harus volume permanen |
| `IHSAN_DB_PATH` | `<data>/ihsan.db` | tidak | |
| `IHSAN_BACKUP_DIR` | `<data>/backups` | tidak | |
| `IHSAN_BACKUP_KEEP` | `14` | tidak | jumlah snapshot tersimpan (NFR07: peluruhan cadangan) |
| `IHSAN_TRUST_PROXY` | `0` | ya (di balik proksi) | mempercayai `X-Forwarded-*` untuk IP klien |
| `IHSAN_ALLOW_REGISTRATION` | `1` | ya (`0`) | `0` menutup pendaftaran setelah akun pertama lahir |
| `SESSION_DAYS` | `30` | tidak | umur sesi |
| `NODE_ENV` | kosong | ya | `production` |
| `LOG_LEVEL` | `warn` | tidak | log tidak pernah memuat nominal, catatan, atau nama pihak (NFR08) |

## 3. Urutan penyalaan pertama

1. Pasang variabel dengan `IHSAN_ALLOW_REGISTRATION=1` dan `APP_ORIGIN=https://<domain>`.
2. Jalankan server, buka `https://<domain>`, daftar akun pemilik. Kode pemulihan muncul sekali.
3. Ubah `IHSAN_ALLOW_REGISTRATION=0`, lalu jalankan ulang. Setelah itu pendaftaran akun baru
   dijawab 403 `Pendaftaran akun baru ditutup di server ini.`
4. Buat dompet pertama. Basis data produksi **tidak boleh** diisi data karangan (D-08); data demo
   `app/server/src/tools/seed.ts` hanya untuk mesin pengembangan.

## 4. TLS, proksi, dan cookie

Aplikasi tidak memegang sertifikat; TLS diterminasi platform atau proksi (Fly/Render/Railway atau
Caddy/nginx). Yang perlu dipastikan:

- `APP_ORIGIN=https://…` → cookie sesi mendapat atribut `Secure` dan setiap balasan membawa
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` (terverifikasi di
  `app/server/test/deploy.test.ts`).
- Proksi meneruskan `Host` dan `X-Forwarded-Proto`; set `IHSAN_TRUST_PROXY=1` supaya kolom
  perangkat pada daftar sesi mencatat IP asli, bukan IP proksi.
- Penulisan ber-cookie diperiksa asalnya (`sameOrigin`): `Origin` harus sehost dengan `Host`.
- Titik kesehatan untuk platform: `GET /api/v1/health` (tanpa sesi) → `{"data":{"ok":true,…}}`.
  `Dockerfile` memakai titik ini untuk `HEALTHCHECK`.

## 5. Cadangan dan pemulihan (NFR05, AT16)

`app/scripts/backup.mjs` membuat snapshot konsisten dengan `VACUUM INTO` (aman walau server sedang
menulis), lalu memeriksa integritas, relasi, dan keseimbangan jurnal sebelum berkas diakui sah.
Keluaran tidak pernah memuat nominal.

```bash
node scripts/backup.mjs                    # snapshot baru + pangkas retensi
node scripts/backup.mjs --list             # daftar snapshot
node scripts/backup.mjs --check <berkas>   # uji satu snapshot (keluar 1 bila rusak)
node scripts/backup.mjs --restore <berkas> # pasang snapshot (server harus berhenti dulu)
```

Jadwal harian: `deploy/systemd/ihsan-backup.timer` (03:10, `Persistent=true`). Di platform tanpa
systemd, pakai cron/Render Cron Job perintah yang sama. Kegagalan apa pun keluar dengan kode ≠ 0
supaya terbaca sebagai alarm (NFR08).

Snapshot berada di volume yang sama; itu belum cukup untuk RTO 8 jam bila volume hilang. Salinan
luar mesin (S3/R2/B2 lewat Litestream atau unggah snapshot) masih **belum** dipasang dan menunggu
keputusan pemilik soal penyedia penyimpanan.

Bukti uji pada basis data pengembangan (server sedang hidup, mode WAL):

```
PASS  ihsan-20261001-124455329.db  408 KB  transaksi=17  integritas=ok  relasi_melanggar=0  jurnal_seimbang=true
INFO  retensi: ihsan-20261001-124454996.db dihapus (menyimpan 1 terbaru)
FAIL  rusak.db  tidak dapat dibaca: file is not a database          (keluar 1)
PASS  basis data dipasang dari ihsan-20261001-124455329.db. Jalankan server lagi.
transaksi=17 wallets=3 selisih_jurnal=0
```

## 6. Pilihan tempat, dan yang dibutuhkan untuk masing-masing

Belum ada keputusan pemilik soal penyedia. Peta pilihannya, dengan syarat yang tidak bisa dipenuhi
agen (membuat akun, membayar, memegang domain):

| Pilihan | Bentuk | Biaya kasar | Yang agen butuhkan dari pemilik |
|---|---|---|---|
| Fly.io | wadah + volume `[data]`, TLS bawaan | ~US$2–4/bulan | `FLY_API_TOKEN`, nama aplikasi, region (mis. `sin`), metode bayar aktif |
| Render | wadah + disk permanen, TLS bawaan | ~US$7/bulan + disk | akun + `RENDER_API_TOKEN`, izin GitHub App, konfirmasi disk permanen berbayar |
| Railway | wadah + volume | ~US$5/bulan | `RAILWAY_TOKEN` + token proyek, metode bayar |
| VPS (Hetzner/DO) | systemd + Caddy, ukuran `deploy/systemd/` | ±US$5/bulan | IP, akses SSH (agen membuat pasangan kunci, pemilik menempelkan kunci publiknya), DNS A record |
| Mesin sendiri | systemd/compose + Cloudflare Tunnel | gratis + listrik | mesin yang hidup terus, akun Cloudflare, tunnel token |
| Turso/libSQL | basis data terkelola | gratis–kecil | menyentuh seluruh lapisan `node:sqlite` → pekerjaan besar, hanya bila memang diinginkan |

Untuk semua pilihan di atas, yang tetap sama: **satu proses**, volume permanen di `IHSAN_DATA_DIR`,
`APP_ORIGIN` https, dan snapshot harian.

## 7. Yang belum dikerjakan

- Salinan cadangan luar mesin (butuh ember/penyimpanan) dan uji restore terjadwal tiga bulanan (NFR05).
- Domain, DNS, dan sertifikat: menunggu keputusan pemilik.
- Pipelines CI: repo belum punya `.github/workflows`; gerbang saat ini hanya hook `pre-commit`.
- Alarm ketidakseimbangan jurnal di luar proses: saat ini hanya log kode gagal (NFR08).
- Uji restore otomatis di pipeline: belum ada berkasnya; pembuktian saat ini manual dan tercatat di
  bagian 5.
