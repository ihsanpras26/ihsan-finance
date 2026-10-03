# Panduan penyalaan produksi mode A (VPS atau mesin sendiri)

Dokumen ini adalah pasangan `docs/PANDUAN_PENYALAAN.md`: yang itu menyala di **mode B (serverless
Vercel + Turso)**, yang ini menyala di **mode A (satu proses, basis data berkas)**. Pilih satu,
jangan keduanya untuk basis data yang sama — berkas SQLite hanya boleh ditulis satu proses.

| Bentuk | Kapan dipakai | Panduan |
|---|---|---|
| **A. Satu proses + basis data berkas** | VPS (±US$5/bulan), mesin sendiri, atau wadah; penjadwal tiap 15 menit | berkas ini |
| **B. Fungsi serverless + Turso** | gratis (Vercel Hobby + Turso Free), penjadwal harian | `docs/PANDUAN_PENYALAAN.md` |

Yang akan jadi setelah selesai: satu proses Node 24 memegang API, PWA hasil build, dan penjadwal
internal; `ihsan.db` tinggal di volume `/data`; TLS diterminasi Caddy dengan sertifikat otomatis;
snapshot harian dan dump offsite naik ke luar mesin.

Kontrak menjalankannya (bukan langkahnya) ada di `docs/DEPLOY.md` bagian 1–6. Halaman ini hanya
urutan perintah yang bisa disalin, ditulis untuk Ubuntu 24.04 LTS (Debian 12 sama saja).

Perkiraan waktu: 60–90 menit, di luar propagasi DNS.

---

## 1. Yang Anda siapkan

- VPS dengan akses `sudo`, atau mesin sendiri yang menyala terus.
- Nama domain yang catatan DNS-nya bisa Anda ubah.
- (Opsional, sangat disarankan) ember Cloudflare R2 + kunci S3 untuk cadangan keluar mesin,
  langkahnya sama dengan `docs/PANDUAN_PENYALAAN.md` bagian 6.1.
- Port 22, 80, dan 443 terbuka dari luar; port aplikasi (8787) **tidak** dibuka.

Node 24 dipasang di bagian 3. Tidak ada langkah build untuk server: Node 24 menjalankan TypeScript
langsung (D-03), dan skema dijalankan otomatis saat penyalaan.

---

## 2. Domain dan DNS

Kerjakan ini **sebelum** Caddy diminta menerbitkan sertifikat: ACME memverifikasi lewat DNS dan
port 80.

1. Catat IP publik mesin: `curl -sS https://api.ipify.org; echo`
2. Panel DNS tempat domain dikelola (IDWebhost → domain → **DNS Management**):

   | Tipe | Host | Nilai | TTL |
   |---|---|---|---|
   | `A` | `@` | IP publik mesin | 300 |
   | `CNAME` | `www` | `<domain>` | 300 |

   Hapus catatan parkir bawaan untuk `@` dan `www` kalau ada. Apex wajib `A`, bukan `CNAME`.
3. Tunggu propagasi, lalu periksa — jawabannya harus IP mesin, bukan alamat parkir:

```bash
dig +short <domain> @1.1.1.1
dig +short www.<domain> @1.1.1.1
```

Catatan: jangan menyalakan proksi Cloudflare (awan oranye) untuk mode ini. Sertifikat Caddy dan
pencatatan IP klien bersandar pada koneksi langsung ke port 80/443. Bila tetap ingin proksi di
depan, samakan `APP_ORIGIN` dengan domain dan biarkan `IHSAN_TRUST_PROXY=1`.

---

## 3. Mesin

Pengguna, direktori, dan paket — nama-nama ini sudah cocok dengan unit di `deploy/systemd/`:

```bash
# Unit systemd memakai User=ihsan, /opt/ihsan/app, /etc/ihsan, dan /data.
sudo adduser --disabled-password --gecos "" ihsan
sudo mkdir -p /opt/ihsan /data /etc/ihsan
sudo chown ihsan:ihsan /opt/ihsan /data
sudo chmod 750 /etc/ihsan
```

Node 24 + pnpm 10:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install --global pnpm@10
node --version    # harus v24.x; jalur binernya /usr/bin/node (dipakai ExecStart unit)
```

Firewall:

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
```

`8787` sengaja tidak dibuka: aplikasi hanya mendengarkan `127.0.0.1` (bagian 5), dan Caddy yang
menghadap internet.

---

## 4. Kode dan build

```bash
sudo -u ihsan git clone <url-repositori> /opt/ihsan
cd /opt/ihsan/app
sudo -u ihsan pnpm install --frozen-lockfile
sudo -u ihsan pnpm --dir web build      # menghasilkan app/web/dist
```

Bila `sudo -u ihsan pnpm` mengeluh tidak menemukan `pnpm` (paket global tidak ada di PATH-nya),
pakai bentuk eksplisit: `sudo -u ihsan env "PATH=$PATH" pnpm install --frozen-lockfile`.

Yang menjalankan server nanti adalah `node server/src/main.ts` (TypeScript langsung). PWA disajikan
dari `app/web/dist` pada asal yang sama; rute dalam seperti `/transaksi` dilayani fallback SPA dari
`index.html`.

---

## 5. Berkas lingkungan

Buat `/etc/ihsan/ihsan.env`:

```
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
APP_ORIGIN=https://<domain>
IHSAN_DATA_DIR=/data
IHSAN_TRUST_PROXY=1
IHSAN_ALLOW_REGISTRATION=1
SESSION_DAYS=30
LOG_LEVEL=warn
IHSAN_BACKUP_DIR=/data/backups
IHSAN_BACKUP_KEEP=14
```

```bash
sudo chown root:ihsan /etc/ihsan/ihsan.env && sudo chmod 640 /etc/ihsan/ihsan.env
```

- `APP_ORIGIN` wajib `https://` **dan** sama persis dengan domain yang dipakai pengguna. Dari sini
  cookie sesi mendapat `Secure` dan setiap balasan membawa HSTS (terverifikasi di
  `app/server/test/deploy.test.ts`).
- `IHSAN_DATA_DIR` harus `/data`: unit systemd memasang `ProtectSystem=strict` dengan
  `ReadWritePaths=/data`. Memilih jalur lain berarti unitnya ikut diubah.
- `IHSAN_ALLOW_REGISTRATION=1` hanya sampai akun pemilik lahir (bagian 8).
- Mode A tidak memakai `CRON_SECRET`/`IHSAN_CRON_TOKEN`: penjadwal berjalan di dalam proses,
  langsung saat menyala lalu tiap 15 menit (`server/src/main.ts`).
- Nilai ditulis apa adanya; systemd tidak menghapus tanda kutip pembungkus.

---

## 6. TLS di Caddy

```bash
sudo apt-get install -y caddy
sudo install -m 644 /opt/ihsan/deploy/caddy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # ganti keuangan.contoh.id dengan domain Anda
sudo systemctl reload caddy
sudo journalctl -u caddy -n 20 --no-pager
```

Isi berkas itu (ganti `keuangan.contoh.id` dengan domain Anda di tiga tempat):

```
keuangan.contoh.id {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8787
}

www.keuangan.contoh.id {
	redir https://keuangan.contoh.id{uri} permanent
}
```

Caddy menerbitkan dan memperbarui sertifikat Let's Encrypt sendiri, serta meneruskan `Host`,
`X-Forwarded-For`, dan `X-Forwarded-Proto` — itulah sebabnya `IHSAN_TRUST_PROXY=1` cukup. Blok
`www` hanya berhasil bila catatan `www` di bagian 2 sudah ada.

Pengganti dengan nginx + certbot: `proxy_pass http://127.0.0.1:8787;` wajib disertai
`proxy_set_header Host $host;`, `X-Forwarded-For $proxy_add_x_forwarded_for;`, dan
`X-Forwarded-Proto $scheme;`. Tanpa `Host` yang benar, penulisan ber-cookie ditolak pemeriksaan
`sameOrigin`.

Mesin tanpa IP publik (di balik NAT): lewati Caddy, jalankan
`cloudflared tunnel run --url http://127.0.0.1:8787`, lalu set `APP_ORIGIN=https://<domain>` dan
`IHSAN_TRUST_PROXY=1`. Tidak ada port yang perlu dibuka.

---

## 7. Unit systemd aplikasi

```bash
sudo install -m 644 /opt/ihsan/deploy/systemd/ihsan.service /etc/systemd/system/ihsan.service
sudo systemctl daemon-reload
sudo systemctl enable --now ihsan
systemctl status ihsan --no-pager
sudo journalctl -u ihsan -n 30 --no-pager
curl -sS http://127.0.0.1:8787/api/v1/health     # {"data":{"ok":true,...}}
```

Unit sudah memasang `Restart=always`, `RestartSec=3`, `MemoryMax=768M`, dan
`ProtectSystem=strict`. Naikkan `MemoryMax` bila proses di-restart berkali-kali karena memori saat
basis data bertambah besar (batas P0 satu pengguna: puluhan ribu baris).

---

## 8. Akun pemilik dan menutup pendaftaran

1. Buka `https://<domain>` — DNS dan sertifikat harus sudah aktif — lalu **Daftar**.
2. Simpan kode pemulihan yang tampil sekali di layar; tanpa itu akun tidak bisa dipulihkan.
3. Ubah `IHSAN_ALLOW_REGISTRATION=0`, lalu `sudo systemctl restart ihsan`.

Akun pertama tetap boleh lahir walau nilainya `0` (pengecualian bootstrap); sesudah itu pendaftaran
dijawab 403 `Pendaftaran akun baru ditutup di server ini.`

Buat dompet pertama dari antarmuka. Basis data produksi **tidak boleh** diisi data karangan:
`server/src/tools/seed.ts` hanya untuk mesin pengembangan (D-08).

---

## 9. Cadangan

### 9.1 Snapshot harian di disk yang sama (NFR05, NFR07)

```bash
sudo install -m 644 /opt/ihsan/deploy/systemd/ihsan-backup.service /opt/ihsan/deploy/systemd/ihsan-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ihsan-backup.timer
sudo systemctl start ihsan-backup.service
sudo journalctl -u ihsan-backup -n 20 --no-pager
```

Timer berjalan 03:10 waktu server (±acak 15 menit). Snapshot `VACUUM INTO` ditulis ke
`/data/backups`, diperiksa integritas/relasi/keseimbangan jurnal, lalu retensi dipangkas ke
`IHSAN_BACKUP_KEEP` (14). Periksa daftarnya:

```bash
cd /opt/ihsan/app && sudo -u ihsan node --env-file=/etc/ihsan/ihsan.env scripts/backup.mjs --list
```

### 9.2 Dump offsite ke R2/B2/S3 (keluar mesin)

Snapshot di atas masih berada di mesin yang sama, jadi ia belum cadangan bencana. Isi kredensial
ember di `/etc/ihsan/ihsan.env`:

```
IHSAN_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
IHSAN_S3_BUCKET=ihsan-backup
IHSAN_S3_REGION=auto
IHSAN_S3_ACCESS_KEY_ID=<access key id>
IHSAN_S3_SECRET_ACCESS_KEY=<secret>
IHSAN_S3_PREFIX=produksi
IHSAN_OFFSITE_KEEP=30
```

```bash
sudo install -m 644 /opt/ihsan/deploy/systemd/ihsan-offsite.service /opt/ihsan/deploy/systemd/ihsan-offsite.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ihsan-offsite.timer
sudo systemctl start ihsan-offsite.service
sudo journalctl -u ihsan-offsite -n 20 --no-pager
```

Keluaran yang benar: `sumber: /data/ihsan.db`, `PASS ihsan-….db — N tabel, … jurnal seimbang,
integritas ok`, lalu `PASS unggah offsite — produksi/ihsan-….db (200)`. Dump lokal tinggal di
`/data/offsite` (sengaja terpisah dari `/data/backups` supaya retensi keduanya tidak saling
menghapus) dan dipangkas ke `IHSAN_OFFSITE_KEEP`; ember tidak pernah dipangkas.

Bila keempat variabel `IHSAN_S3_*` belum lengkap, perintah keluar dengan kode 2 tanpa mengunggah
apa pun — tidak ada kegagalan diam-diam.

---

## 10. Verifikasi

Ganti `<domain>` dengan domain Anda. Baris yang bisa dijalankan di mesin pengembangan sudah dicoba
dalam mode `NODE_ENV=production` (bukti di bagian 15); baris ber-domain menunggu DNS dan Caddy hidup.

| Yang diperiksa | Perintah | Jawaban benar |
|---|---|---|
| Aplikasi hidup di dalam mesin | `curl -sS http://127.0.0.1:8787/api/v1/health` | `{"data":{"ok":true,...}}` |
| Aplikasi hidup lewat TLS | `curl -sS https://<domain>/api/v1/health` | idem |
| HSTS menyala | `curl -sS -D - -o /dev/null https://<domain>/api/v1/health` | ada `strict-transport-security: max-age=31536000; includeSubDomains` |
| Rute web + fallback SPA | `curl -sS -o /dev/null -w "%{http_code}\n" https://<domain>/transaksi` | `200` |
| API tanpa sesi ditolak | `curl -sS -o /dev/null -w "%{http_code}\n" https://<domain>/api/v1/wallets` | `401` |
| Cookie sesi `Secure` | `curl -sS -D - -o /dev/null -X POST https://<domain>/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"<email>","password":"<sandi>"}'` | ada `Set-Cookie: ifsess=…; Secure; HttpOnly; SameSite=Lax` |
| Pendaftaran tertutup | daftar lewat jendela penyamaran | 403 `Pendaftaran akun baru ditutup di server ini.` |
| Penjadwal berjalan | `sudo journalctl -u ihsan --since "20 min ago"` | tanpa galat `Penjadwal gagal dijalankan` |
| Snapshot sah | `… scripts/backup.mjs --list` | baris `PASS … jurnal_seimbang=true` |
| Dump offsite naik | `sudo journalctl -u ihsan-offsite -n 5` | `PASS unggah offsite — produksi/ihsan-….db (200)` |

Pemeriksaan browser: buka `https://<domain>` di ponsel dan desktop, masuk, catat satu transaksi,
lalu muat ulang — angkanya harus tetap (data datang dari `ihsan.db`, bukan dari memori proses).

---

## 11. Penyebaran ulang, rollback, pemulihan

```bash
# Rilis baru
sudo -u ihsan git -C /opt/ihsan pull --ff-only
cd /opt/ihsan/app
sudo -u ihsan pnpm install --frozen-lockfile
sudo -u ihsan pnpm --dir web build
sudo systemctl restart ihsan
```

Skema dimigrasi otomatis saat penyalaan (`schema.sql` + `PRAGMA user_version`, idempoten), jadi
tidak ada langkah basis data manual.

Rollback: `sudo -u ihsan git -C /opt/ihsan checkout <tag-atau-commit>`, ulangi install + build +
restart. Basis data tidak dikembalikan; migrasi P0 bersifat menambah, jadi satu langkah rilis ke
belakang tetap membaca basis data yang sama.

Pemulihan dari snapshot (layanan harus berhenti):

```bash
sudo systemctl stop ihsan
cd /opt/ihsan/app && sudo -u ihsan node --env-file=/etc/ihsan/ihsan.env scripts/backup.mjs --restore /data/backups/ihsan-<stamp>.db
sudo systemctl start ihsan
```

Skrip menyimpan basis data lama sebagai snapshot keamanan dan membuang `-wal`/`-shm` yang
tertinggal. Dari dump offsite: unduh `<berkas>.db` dan `<berkas>.db.json`, hentikan layanan, timpa
`/data/ihsan.db` dengan berkas dump, buang `/data/ihsan.db-wal` dan `/data/ihsan.db-shm`, lalu
jalankan lagi.

---

## 12. Alternatif wadah (Docker)

Dipakai bila Anda lebih suka wadah daripada systemd. Caddy di mesin yang sama tetap menangani TLS.

```bash
cd /opt/ihsan
sudo docker build -t ihsan-finance .
sudo docker run -d --name ihsan --restart unless-stopped \
  -p 127.0.0.1:8787:8787 -v ihsan-data:/data \
  -e APP_ORIGIN=https://<domain> -e IHSAN_TRUST_PROXY=1 -e IHSAN_DATA_DIR=/data \
  ihsan-finance
```

- Cadangan dari dalam wadah: `docker exec ihsan node scripts/backup.mjs` dan
  `docker exec ihsan node server/src/tools/offsite.ts` (butuh variabel `IHSAN_S3_*` di dalam wadah).
- `compose.yaml` **bukan setelan produksi**: ia sengaja memakai `APP_ORIGIN=http://localhost:8787`
  dan pendaftaran terbuka untuk paritas lokal. Jangan jalankan apa adanya di server.
- `Dockerfile` belum pernah dibangun di mesin pengembangan (Docker tidak terpasang di sana,
  tercatat di `docs/STATUS.md`); pembuktian pertama ada di server Anda.

---

## 13. Perawatan

- **Rotasi kredensial.** Token yang pernah muncul di percakapan atau tangkapan layar wajib
  dicabut, lalu nilainya diganti di `/etc/ihsan/ihsan.env` dan layanan di-restart. Jaga berkas itu
  tetap `640 root:ihsan`.
- **Periksa jadwal sebulan sekali:**
  `systemctl list-timers ihsan-backup.timer ihsan-offsite.timer` dan
  `sudo journalctl -u ihsan-backup -u ihsan-offsite --since "7 days ago"`. Unit yang keluar ≠ 0
  adalah alarm; cadangan yang diam-diam gagal selalu muncul sebagai kode keluar.
- **Uji restore tiap tiga bulan** (NFR05) ke basis data sementara, bukan produksi.
- **Pembaruan sistem:** `sudo apt-get update && sudo apt-get upgrade`; Node dari NodeSource ikut
  terbarui dan hanya berlaku setelah `systemctl restart ihsan`.
- **Mesin sendiri:** pastikan tidak tidur, dan hidup lagi setelah listrik mati — `enable` +
  `Restart=always` menutup sisanya.

---

## 14. Kalau bermasalah

| Gejala | Penyebab paling mungkin | Tindakan |
|---|---|---|
| `systemctl status ihsan` gagal menulis `/data` | `IHSAN_DATA_DIR` bukan `/data` padahal unit memasang `ProtectSystem=strict` | Samakan dengan `ReadWritePaths=/data`, atau tambahkan jalur Anda ke unit |
| Aplikasi hidup lokal, domain 502 | Caddy tidak jalan atau `reverse_proxy` salah port | `sudo journalctl -u caddy -n 40 --no-pager`; pastikan `127.0.0.1:8787` |
| Sertifikat tidak terbit | DNS belum mengarah ke mesin, atau port 80 tertutup | `dig +short <domain> @1.1.1.1`; `sudo ufw status` |
| Cookie sesi hilang setelah login | `APP_ORIGIN` bukan https atau beda domain dari yang dibuka | Samakan, lalu `sudo systemctl restart ihsan` |
| `/transaksi` 404 saat dimuat ulang | `web/dist` belum dibangun | `sudo -u ihsan pnpm --dir web build`, restart |
| `/api/v1/health` 500 | Basis data tidak bisa dibuka (izin `/data`) | `sudo journalctl -u ihsan -n 50 --no-pager` |
| Pendaftaran akun kedua tetap lolos | Berkas env yang dibaca unit bukan yang Anda sunting | Periksa `EnvironmentFile=/etc/ihsan/ihsan.env`, lalu restart |
| Snapshot gagal | Disk `/data` penuh | `df -h /data`; perbesar disk atau turunkan `IHSAN_BACKUP_KEEP` |
| `offsite` keluar 2 tanpa unggahan | `IHSAN_S3_*` belum lengkap | Isi keempat variabel di `/etc/ihsan/ihsan.env`, ulangi unitnya |
| Ikon PWA basi setelah rilis baru | Service worker masih memegang `index.html` lama | Muat ulang paksa sekali; berkas `assets/` memang `immutable` |

---

## 15. Daftar periksa akhir

- [ ] DNS: `A @` → IP mesin, `CNAME www` → apex, keduanya menjawab dari resolver publik.
- [ ] Node 24 di `/usr/bin/node`, `pnpm` 10, pengguna `ihsan`, `/data` milik `ihsan`.
- [ ] `/opt/ihsan/app` berisi kode terbaru dan `web/dist` hasil build.
- [ ] `/etc/ihsan/ihsan.env` mode 640, `APP_ORIGIN=https://<domain>`, `IHSAN_DATA_DIR=/data`.
- [ ] Caddy menerbitkan sertifikat; `https://<domain>` menjawab 200.
- [ ] `ihsan.service` aktif dan `enable`; `journalctl` tanpa galat penjadwal.
- [ ] Akun pemilik ada, kode pemulihan tersimpan, `IHSAN_ALLOW_REGISTRATION=0` + restart.
- [ ] `ihsan-backup.timer` terpasang, snapshot pertama `PASS`.
- [ ] Ember R2 berisi `produksi/ihsan-….db`, `ihsan-offsite.timer` terpasang.
- [ ] Uji restore di basis data sementara berhasil.
- [ ] Token yang pernah bocor sudah dicabut dan diganti.

Bukti lokal yang sudah ada (mesin pengembangan, 3 Oktober 2026): `NODE_ENV=production` +
`APP_ORIGIN=https://keuangan.contoh.id` + basis data berkas di direktori sementara →
`/api/v1/health` 200 dengan header `strict-transport-security`, `/` 200, `/transaksi` 200 lewat
fallback SPA, `/api/v1/wallets` 401 tanpa sesi; `scripts/backup.mjs --list` keluar 0;
`node server/src/tools/offsite.ts` keluar 2 saat sumber/`IHSAN_S3_*` belum ada. Yang belum pernah
dijalankan di mesin ini: Caddy, systemd, dan `Dockerfile` (tidak tersedia di Windows).
