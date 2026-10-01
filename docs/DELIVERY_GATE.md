# Laporan Delivery Gate: Ihsan Finance P0

Dijalankan: 22 September 2026 (redesain kedua)
Mode: **During** (gerbang dijalankan sebelum penyerahan)
Arah visual: `docs/DESIGN.md` (Design Read: alat ukur untuk uang, ENERGY 2 / RHYTHM 2 / MOTION 2)
Bukti mentah: `pnpm verify`, `pnpm smoke`, dan telusuri klik `agent-browser` pada Chrome 153.

> **Catatan pembaruan (1 Oktober 2026).** Laporan empat blok di bawah dijalankan 22 September 2026
> pada arah D-15. Sejumlah klaim di dalamnya sudah tidak berlaku dan dikoreksi di `# Gerbang D-18`
> pada akhir berkas ini, bukan ditulis ulang di tempatnya supaya jejaknya terbaca; daftar lengkapnya
> ada di bagian "Klaim lama yang dikoreksi". Tiga yang paling terlihat: aksen teal `#0f6b5c` (Blok 3
> dan Blok 4) kini biru `#0256ff`; hitungan `74/74` tes server kini `78/78` tes server ditambah
> `5/5` tes web; dan "0 elemen berbayangan saat diam" tidak lagi berlaku karena kartu kini memakai
> token `--shadow-card` per arah canon.
>
> Rujukan `DESIGN.md §N` di blok D-15 dan D-16 juga memakai penomoran dokumen sebelum penyusunan
> ulang. Padanannya sekarang: `§1` dan `§4` Layout, `§2` Colors, `§3` Typography, `§5` Kolom tanda,
> `§6`, `§9`, `§10`, dan `§12` Components, `§7` Layout (susunan per layar), `§8` Motion. Anggaran
> `§11` (aset dan logo) tidak lagi punya bagian sendiri di `DESIGN.md`.

Aturan gerbang: satu saja jawaban yang salah arah, jangan serahkan. Laporan ini tidak boleh
didelegasikan.

---

## Blok 1: Hard Gate (mutlak). Semua jawaban harus TIDAK.

| # | Pertanyaan | Jawaban | Bukti |
|---|---|---|---|
| R-02 | Ada em dash di teks mana pun di luar pengecualian? | **TIDAK** | Satu-satunya em dash di repositori adalah kutipan aturan ini di baris tabel R-02 pada dokumen ini, yang termasuk pengecualian resmi aturan. |
| R-03 | Ada luapan horizontal atau tata letak rusak di mobile? | **TIDAK** | Pada 360x800 di kelima layar: `scrollWidth 360 = clientWidth 360`, 0 elemen melewati tepi. Target sentuh: **135 kendali per jalan, 0 di bawah 44 px** (dua tema, 270 pemeriksaan). Satu tombol terukur menonjol 14 px di Profil, dan itu tab di dalam wadah bergulir horizontal yang memang disengaja; `scrollWidth` tetap 360. |
| R-17 | Ada statistik tanpa sumber nyata? | **TIDAK** | Tidak ada satu pun angka statistik di antarmuka. Setiap angka berasal dari jurnal; dibuktikan 74 tes server. |
| R-18 | Ada testimoni fiktif? | **TIDAK** | Tidak ada bagian testimoni di aplikasi. |
| R-23 | Ada aset visual dibuat tanpa instruksi atau placeholder jujur? | **TIDAK** | `docs/DESIGN.md` §11 menyatakan belum ada logo disetujui; dipakai penanda jujur `[LOGO]` dan `public/icon.svg` yang berkomentar sebagai penanda sementara. Ikon adalah glyph SVG buatan sendiri. Tidak ada avatar atau foto. |
| R-24 | Ada tautan navigasi ke halaman yang tidak ada? | **TIDAK** | Kelima rute (Beranda, Transaksi, Rencana, Laporan, Profil) diklik satu per satu dan semuanya merender layar berisi. |
| R-25 | Ada teks dengan kontras di bawah WCAG AA? | **TIDAK** | **1.276 pemeriksaan** (637 di tema gelap, 639 di tema terang, lima layar masing-masing). **0 gagal.** Ambang: 4.5:1 teks normal, 3:1 teks besar. |
| R-26 | Ada tombol, dropdown, atau formulir yang tidak melakukan apa pun? | **TIDAK** | Lembar catat terbuka dan menyimpan (toast "Pengeluaran tersimpan: −Rp25.000 pada 22 Sep 2026.", lembar tertutup). Escape menutup lembar. Toggle tema berganti dua arah. Panel Filter mengembang. |
| R-27 | Antarmuka kurang keadaan kosong, memuat, atau galat? | **TIDAK** | `LoadingRows`, `ErrorState`, dan `EmptyState` dipakai di keenam layar. Ketiganya menyebut sebab dan tindakan berikutnya, bukan "tidak ada data". |
| R-28 | FAQ berisi pertanyaan generik? | **TIDAK** | Tidak ada FAQ. |
| R-32 | Tidak dapat dinavigasi papan tombol atau tanpa fokus terlihat? | **TIDAK** | Lima langkah Tab berurutan: setiap elemen terfokus punya `outlineStyle` bukan `none` dan tinggi >= 44 px. Escape menutup lembar dan mengembalikan fokus ke pemicu. Ada tautan lompat ke konten. |
| R-33 | Ada fitur ditambahkan dengan menambal sumber/CSS dari luar? | **TIDAK** | Semua perubahan ada di berkas sumber. |
| R-34 | Satu mode tema rusak? | **TIDAK** | Kedua tema dijalankan penuh di 360 px dan di 1440 px: kontras lolos, tanpa luapan, tata letak utuh. |
| R-35 | Diserahkan tanpa dijalankan atau tanpa catatan telusuri klik? | **TIDAK** | Dibangun (`vite build` lulus) dan dijalankan. Telusuri klik direkam di bagian bawah laporan ini. |
| R-36 | Ada klaim keamanan, kepatuhan, kinerja, atau pelanggan yang dikarang? | **TIDAK** | Satu-satunya kalimat tentang batas produk berbunyi: "Rilis awal tidak melakukan pembayaran dan tidak menyimpan kredensial bank." Itu pernyataan tentang apa yang tidak dilakukan, bukan klaim kemampuan. |
| R-37 | Dibangun tanpa arah dan tidak dilabeli? | **TIDAK** | `docs/DESIGN.md` ada, memuat Design Read, dial, dan alasan satu baris per keputusan. |
| R-38 | Ada konten bergaya realistis yang dikarang? | **TIDAK** | Satu-satunya data contoh dibuat oleh `server/src/tools/seed.ts` dan dijelaskan sebagai data contoh di `docs/STATUS.md`. |

**Blok 1: PASS.**

---

## Blok 2: Purpose-Gate. Teknik boleh, alasan wajib tertulis.

| # | Pertanyaan | Jawaban | Alasan tertulis |
|---|---|---|---|
| R-01 | Gradien atau glow sebagai bawaan tanpa tujuan? | **TIDAK** | 0 deklarasi gradien dan 0 glow di seluruh CSS. `DESIGN.md` §1 menetapkan hierarki datang dari permukaan dan jarak, bukan dari efek. |
| R-04 | Ikon generik atau pustaka ikon tanpa relevansi? | **TIDAK** | 0 pustaka ikon di `package.json`. Glyph digambar sendiri, relevan dengan isi (dompet, baris buku besar, target, kolom angka, orang). Goresan 1.75 dipilih agar setara dengan berat Schibsted Grotesk; alasan di `icons.tsx` dan `DESIGN.md` §11. |
| R-06 | Monospace besar, label kapital jarak lebar, atau rupa tanpa alasan? | **TIDAK** | Monospace **dipakai**, dan alasannya tertulis di `DESIGN.md` §3: angka keuangan harus lurus dalam kolom dan tidak boleh bergeser lebarnya saat digit berubah. Batasnya tajam dan diuji: monospace hanya untuk nominal uang (29 dari 100 simpul teks di Beranda); judul, label, dan paragraf memakai Schibsted Grotesk. Tidak ada monospace untuk judul, tidak ada label kapital jarak lebar. |
| R-07 | Pola latar grid, blueprint, atau titik tanpa tujuan? | **TIDAK** | 0 pola latar. Latar adalah warna permukaan padat (`DESIGN.md` §2). |
| R-08 | Panah pada hampir setiap tombol sebagai hiasan? | **TIDAK** | 0 karakter panah di komponen atau rute. |
| R-09 | Lencana kapsul tanpa fungsi, atau pil di atas H1? | **TIDAK** | `StatusPill` beradius 4 px, bukan kapsul, dan membawa status nyata (mendekati batas, lewat batas, lunas, saldo negatif). Tidak ada pil di atas judul. |
| R-10 | Glassmorphism pada lebih dari 1-2 elemen? | **TIDAK** | 0 pemakaian `backdrop-filter` atau `backdrop-blur`. |
| R-12 | Bayangan besar pada setiap komponen tanpa alasan elevasi? | **TIDAK** | **0 elemen berbayangan terlihat** saat diam. Token `--shadow-float` hanya dipakai `.sheet-enter` (lembar dan dialog); `--shadow-lift` disediakan tetapi belum dipakai satu pun. Diukur di peramban: elemen dengan `boxShadow` terlihat = 0. Catatan kejujuran: cincin `ring-1 ring-inset` pada bilah progres muncul di `getComputedStyle` sebagai `box-shadow` bernilai transparan; probe menghitungnya terpisah dan mengabaikannya. |
| R-13 | Glow pada kartu, tombol, lencana, ikon, latar, dan garis sekaligus? | **TIDAK** | 0 glow. |
| R-14 | Semua kartu fitur identik tanpa alasan hierarki? | **TIDAK BERLAKU** | Tidak ada kartu fitur. Hierarki datang dari kepala bagian berpermukaan sumur dan baris bergaris; alasan di `DESIGN.md` §6. |
| R-19 | Semua animasi templat sekaligus, atau gerak melawan dial MOTION? | **TIDAK** | Gerak yang ada hanya yang terdaftar di `DESIGN.md` §8: hover 120ms, tekan 90ms, lembar 180ms, bilah progres 240ms, dan denyut kerangka baris saat memuat. Sesuai MOTION 2. Tidak ada scroll-reveal, bouncing, atau parallax. `prefers-reduced-motion` mematikan seluruh durasi. |
| R-22 | Ilustrasi generik tanpa kaitan produk? | **TIDAK** | 0 ilustrasi. |

**Blok 2: PASS.**

---

## Blok 3: Liveliness. Semua jawaban harus YA.

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| Dial ditetapkan dan eksplisit? | **YA** | `DESIGN.md` baris 9: ENERGY 2 / RHYTHM 2 / MOTION 2. |
| Hasil konsisten dengan dial yang diklaim? | **YA** | ENERGY 2 terlihat dari skala huruf berjarak jelas dan radius yang berbeda per peran, bukan satu nilai seragam. RHYTHM 2 dari kepala bagian berpermukaan sumur yang memisahkan kelompok, bukan garis seragam berulang. MOTION 2 dari daftar gerak di Blok 2. |
| Ada satu titik fokus jelas per layar? | **YA** | Ditetapkan per layar di `DESIGN.md` §7. Di Beranda diukur: total saldo 36 px monospace sebagai satu-satunya angka sebesar itu. |
| Ruang putih struktural, bukan sisa? | **YA** | Gutter 16/24/32 px per breakpoint dan jarak antar bagian 32 sampai 48 px ditetapkan di `DESIGN.md` §4 sebagai pemisah, bukan sisa tata letak. |
| Ada satu aksen sengaja? | **YA** | Teal tua `#0f6b5c` (`#4fd1b5` di gelap), dibatasi ke tombol utama, penanda navigasi dan tab aktif, cincin fokus, dan isian bilah progres. Aturan di `DESIGN.md` §2. |
| Ada motif identitas? | **YA** | **Kolom tanda** (`DESIGN.md` §5): posisi tanda selalu ada di kiri setiap nominal, berisi `+`, `−`, atau `·`. Diukur di Beranda: 29 nominal, 29 punya kolom tanda, 0 tanpa. 28 dari 29 berada tepat pada satu tepi kanan 1364 px. |
| Design Read dinyatakan sebelum dibangun? | **YA** | `DESIGN.md` baris 5. |

**Blok 3: PASS.**

---

## Blok 4: Craftsmanship & Quality Locks. Semua jawaban harus TIDAK.

| # | Pertanyaan | Jawaban | Bukti |
|---|---|---|---|
| C-1 | Ada keputusan yang hanya beralasan "bawaan AI"? | **TIDAK** | Setiap keputusan visual besar punya alasan satu baris di tabel `DESIGN.md` §2, §3, §4, §5. |
| C-2 | Ada elemen interaktif yang tidak melakukan apa pun? | **TIDAK** | Sama dengan R-26. |
| C-3 | Ada bagian yang hanya mengisi templat? | **TIDAK** | Setiap layar melayani isi produk: beranda merangkum, transaksi mencatat, rencana mengelola kewajiban dan tujuan, laporan menghitung, profil mengelola sumber data. |
| C-4 | Antarmuka rusak pada suatu keadaan, tema, atau tanpa tetikus? | **TIDAK** | Diuji pada 360x800 dan 1440x900, dua tema, tanpa tetikus (Tab dan Escape), dan pada keadaan memuat, kosong, dan galat. |
| C-5 | Ada testimoni, statistik, atau klaim yang dikarang? | **TIDAK** | Sama dengan R-17, R-18, R-36. |
| R-05 | Tata letak mengikuti templat AI atau irama bagian melawan dial RHYTHM? | **TIDAK** | Tidak ada hero pemasaran, tidak ada kisi kartu seragam, tidak ada bilah logo, tidak ada jendela terminal palsu, tidak ada kolom harga, tidak ada kisi bento. Daftar adalah baris bergaris dengan kolom angka. |
| R-11 | Semua elemen dibuat berbentuk pil tanpa variasi radius? | **TIDAK** | Empat radius dengan peran berbeda di `DESIGN.md` §4 (4 lencana, 8 kendali, 12 panel, 16 lembar). Diukur di Beranda dalam keadaan diam: hanya 4 px (12 pemakaian) dan 8 px (9 pemakaian) yang tampil, dan **0 elemen ber-radius penuh**. Satu-satunya radius penuh di kode adalah pemutar 16 px di dalam tombol saat mengirim, yang memang lingkaran. |
| R-15 | CTA masih generik? | **TIDAK** | Tombol menyebut aksinya: "Simpan transaksi", "Catat cicilan", "Alokasikan dana", "Rekonsiliasi saldo", "Hapuskan (non-kas)". 0 pemakaian "Mulai", "Lanjut", "OK". |
| R-16 | Ada kata pemanis pemasaran AI? | **TIDAK** | 0 kemunculan "seamless", "revolusioner", "cutting edge", "AI powered", "solusi", "canggih", "powerful", "effortless". |
| R-20 | Terasa generik bila logo dan nama ditukar? | **TIDAK** | Yang khas bukan warnanya, melainkan perlakuan angkanya: setiap nominal memakai rupa monospace dengan kolom tanda yang selalu terisi, dan garis pemisah berhenti sebelum kolom itu sehingga angka di sisi kanan terbaca sebagai satu bidang. Bahasa visual ini datang dari sifat uang sebagai deret angka, bukan dari templat yang bisa dipakai produk apa pun. |
| R-21 | Mode gelap dipaksa tanpa alasan, atau toggle ditunda? | **TIDAK** | Toggle ada di rel desktop dan di bilah atas HP, berfungsi dua arah, dan pilihan pengguna disimpan. Bawaan mengikuti sistem. Kedua mode lolos kontras penuh. |
| R-29 | Palet melebihi 2-3 warna inti + 1 aksen tanpa sistem? | **TIDAK** | 2 inti (permukaan, teks) + 1 aksen (teal) + 4 warna data semantik. Tercatat di `DESIGN.md` §2. Hijau data sengaja berbeda hue dari teal aksen agar tidak tertukar. Warna data tidak pernah menjadi satu-satunya pembeda. |
| R-30 | Meniru produk populer lain? | **TIDAK** | Tanpa gradien, tanpa kaca, tanpa kisi kartu, tanpa monospace besar sebagai gaya. Aksen teal dipilih justru untuk menghindari biru bawaan yang dipakai hampir semua produk sejenis. Yang membedakan adalah perlakuan angka, bukan kemiripan tata letak. |
| R-31 | Ada keputusan visual besar yang alasannya tidak bisa ditulis satu baris? | **TIDAK** | Tabel alasan satu baris ada di `DESIGN.md` §2 (palet), §3 (rupa huruf), §4 (jarak dan radius), §5 (motif), §8 (gerak). |

**Blok 4: PASS.**

---

## R-35: Catatan telusuri klik

Dijalankan pada Chrome 153 headless melalui `agent-browser`, jendela 1440x900 dan 360x800,
terhadap server sungguhan di `http://127.0.0.1:8787` dengan data contoh.

| # | Elemen | Hasil |
|---|---|---|
| 1 | Halaman masuk dimuat | Panel putih di tengah, tiga tab (Masuk, Daftar, Pulihkan akses), isian Email dan Kata sandi. |
| 2 | Tombol "Masuk ke akun" dengan isian kosong | Validasi menyebut tindakan konkret, bukan "input tidak valid". |
| 3 | Tombol "Masuk ke akun" dengan isian benar | Berhasil, diarahkan ke Beranda. |
| 4 | Beranda, kolom tanda | Terbaca: `·Rp27.090.000`, `+Rp9.750.000`, `−Rp1.510.000`, `+Rp8.240.000`, `·Rp952.500`, dan seterusnya. |
| 5 | Rupa huruf terpasang | 71 simpul teks memakai Schibsted Grotesk, 29 nominal memakai IBM Plex Mono. Keduanya dilaporkan `loaded` oleh `document.fonts`, bukan fallback sistem. |
| 6 | Tombol "Tambah transaksi" | Lembar "Catat transaksi" terbuka dengan isian `qe-amount`, `qe-wallet`, `qe-category`, `qe-date`; isian nominal memakai IBM Plex Mono. |
| 7 | Isi nominal 25.000 lalu simpan | Berhasil. Toast "Pengeluaran tersimpan: −Rp25.000 pada 22 Sep 2026." Lembar tertutup. |
| 8 | Tombol Escape | Menutup lembar dan mengembalikan fokus ke pemicu. |
| 9 | Navigasi kelima rute | Semuanya merender layar berisi. |
| 10 | Toggle tema | Beralih terang ke gelap dan sebaliknya; kelas `dark` benar-benar dilepas dan dipasang. |
| 11 | Tab lima kali | Setiap elemen terfokus punya cincin fokus terlihat dan tinggi 44 px. |
| 12 | Panel Filter di Transaksi | Mengembang dengan Periode, Jenis, Dompet, Kategori, dan nominal minimum dan maksimum. |
| 13 | Bilah progres | Muncul dengan permukaan sumur dan isian aksen; peringatan 80% dan lewat batas memakai warna data. |

### Cacat yang ditemukan dan diperbaiki pada redesain ini

1. **Tepi kanan nominal terbelah dua, 1360 dan 1364 px.** Baris daftar membawa `px-1` sehingga
   nominalnya bergeser 4 px dari tepi yang dipakai nominal di luar baris. Diperbaiki dengan
   menghapus padding horizontal pada baris; isi kolom kini rata dengan tepi kolom.
2. **Pasangan label dan nilai di dalam kartu tidak punya kolom.** "Terpakai ·Rp492.000" dan
   "Terkumpul ·Rp4.000.000" adalah teks inline, jadi nominalnya tidak bisa dibandingkan antar
   kartu. Diganti menjadi kolom `dt`/`dd` dengan angka rata kanan, sehingga seluruh nominal kartu
   lurus pada satu tepi. Diverifikasi: 28 dari 29 nominal di Beranda kini tepat di 1364 px.
3. **Skala huruf dan jarak sebelumnya ad-hoc.** Audit menemukan 12 ukuran huruf berbeda
   (10/11/12/13/14/15/16/18/19/20/22/26 px) dan nilai jarak di luar kelipatan 4 px. Seluruhnya
   dipetakan ke skala enam langkah dan skala jarak kelipatan 4 px. Diukur ulang: **0 nilai di
   luar skala** di seluruh `web/src`.
4. **Fraunces hampir tidak terpakai.** Rupa serif deklarasi sebelumnya hanya muncul di 2 sampai 3
   elemen, jadi arahnya tidak benar-benar bekerja. Pada arah baru, monospace untuk angka menjadi
   pembeda yang nyata dan terukur (29 nominal di Beranda).
5. **Lima `rounded-full` pada batang penanda navigasi.** Bukan bentuk pil yang bermasalah pada
   batang 2 px, tetapi saya samakan dengan penanda bilah bawah agar tidak ada pengecualian yang
   perlu diargumentasikan. Hasil: 0 elemen ber-radius penuh dalam keadaan diam.
6. **Klaim `DESIGN.md` §5 lebih luas dari kenyataan.** Draf pertama berbunyi "seluruh nominal di
   seluruh layar lurus dalam satu kolom", padahal angka fokus di Beranda memang tidak berada di
   kolom. Klaimnya dipersempit ke cakupan yang benar dan pengecualiannya dinyatakan terbuka,
   bukan tata letaknya yang dipaksa.

---

## Kesimpulan

Keempat blok **PASS**. Tidak ada item FAIL. Pekerjaan ini boleh diserahkan.

Satu penyimpangan dari `AGENTS.md` aturan 7 tetap dicatat terbuka di `docs/DECISIONS.md` D-13:
dokumen teknis dan sebagian komentar ditulis dalam bahasa Indonesia, bukan Inggris.

Satu batasan kejujuran: saya tidak dapat melihat gambar, jadi audit visual dijalankan lewat
struktur DOM, gaya terhitung, dan pengukuran geometri, bukan lewat tangkapan layar. Yang bisa
diukur sudah diukur dan angkanya dilaporkan di atas; yang murni soal selera visual belum
diverifikasi oleh mata manusia dan sebaiknya Anda lihat sendiri.

---

# Gerbang D-15 · Setel ulang arah visual ke referensi pemilik

**Tanggal:** 22 September 2026
**Ruang lingkup:** seluruh lapisan tampilan `app/web` (28 berkas diubah, 4 berkas baru).
**Tidak berubah:** perilaku, kontrak API, skema basis data, seluruh teks antarmuka, cakupan PRD.

## Yang dikerjakan

Referensi pemilik (dua tangkapan dasbor fintech) direverse-engineering menjadi spesifikasi angka:
kanvas `#f4f4f5`, kartu putih, aksen biru `#0256ff`, warna data kedua `#ffb700`, lencana pil, dan
bilah progres berlabel. Spesifikasi itu ditulis ke `docs/DESIGN.md`, lalu dibangun berlapis:

| Lapisan | Berkas | Isi |
|---|---|---|
| Token | `src/styles/index.css` | Palet terang dan gelap, skala huruf delapan langkah, skala radius, elevasi, `.figure`, `.sign-col`, `.card`, `.row-divide`, `.icon-tile` |
| Primitif | `src/components/ui.tsx` | Kartu, tombol, lencana, bilah progres, lembar, dialog konfirmasi, tab, keadaan wajib |
| Grafik | `src/components/charts.tsx` | Bilah kategori, garis tren, cincin, bilah progres berlabel. SVG gambar sendiri, tanpa pustaka |
| Kerangka | `src/components/layout/AppShell.tsx` | HP: kepala ringkas + bilah bawah 5 tujuan + tombol Tambah jempol. Desktop: rel 248 px |
| Layar | `src/routes/**` | Beranda, Transaksi, Rencana, Laporan, Profil, Masuk, Notifikasi |
| Chrome PWA | `manifest.webmanifest`, `index.html`, `icon.svg`, `icon-maskable.svg` | Warna dan ikon keluar dari palet lama |

Empat layar besar dikerjakan sebagai aliran kerja paralel dengan berkas terpisah supaya tidak ada
tabrakan tulis: Beranda, Transaksi, Laporan (4 berkas), dan Rencana (4 berkas). Lapisan bersama,
layar Masuk, Profil (5 berkas), Notifikasi, dan chrome PWA dikerjakan di jalur utama.

## Verifikasi

Alat: `~/ihsan-verify/` (Playwright + Chromium, viewport HP 390x844, `isMobile`, `hasTouch`).
Berkas bukti: `verify-report.json` dan `shots/` di folder yang sama.

**1. Gerbang repositori**

| Perintah | Hasil |
|---|---|
| `pnpm verify` | typecheck bersih, **74/74** tes server, **6/6** tes web, build sukses |
| `pnpm smoke` | **50/50** cek HTTP lulus |
| `pnpm build` | 436 kB js (gzip 124 kB), 36 kB css |

**2. Click-through nyata di peramban**

`node verify.mjs` menempuh masuk, lima layar, lembar input cepat, mode gelap, dan lebar desktop:

```
HASIL: 24/24 lulus, 0 gagal
```

Termasuk: nol galat konsol, nol galat halaman, nol geser horizontal di 390 px pada kelima layar,
tombol Tambah di y=776 dari 844 (jangkauan jempol), bilah bawah menempel di dasar, rel samping
tampil di 1280 px, dan mode gelap serta terang bolak-balik tanpa kehilangan keadaan.

**3. Angka yang tampil sama dengan angka API**

`node probe.mjs` dan `probe2.mjs` membandingkan teks yang dirender dengan respons API:
saldo `27.090.000` = jumlah tiga dompet, pendapatan `9.750.000`, pengeluaran `1.510.000`, neto
`8.240.000`, dan setiap bilah anggaran (`55%`, `16%`, `64%`, `94%`) sama dengan `ratio` dari
server. Angka Laporan direkonsiliasi: saldo awal `19.350.000` + pendapatan `9.750.000` −
pengeluaran `1.510.000` − pokok utang `500.000` = saldo akhir `27.090.000`, dan `/reports/
networth-check` tetap `derived = ledger = 22.340.000`.

**4. Kontras WCAG AA, diukur bukan dikira**

`node contrast.mjs` menghitung rasio kontras sebenarnya dari gaya terhitung di kelima layar, dua
mode. Temuan awal: **19 kegagalan AA di mode terang** (label 12 px `#6b7280` hanya 4.16:1 di atas
sumur; nominal hijau `#0e9f6e` 3.39:1; merah `#e02424` 4.30:1; peringatan `#b45309` 4.14:1 di atas
tintnya sendiri). Token digelapkan dan diukur ulang: **0 kegagalan di kedua mode**.

Satu penanda yang masih dilaporkan alat adalah label persen di dalam bilah progres, karena label
adalah saudara dari isian sehingga penelusuran gaya menemukan trek, bukan isian. Diselesaikan
dengan mengukur piksel yang benar-benar dicat (`node pixels.mjs`): label `55%` berada di atas
`rgb(2,86,255)` dengan rasio **5.56:1**, lulus AA.

Satu cacat struktural nyata ditemukan dan diperbaiki di sini: label persen sebelumnya selalu putih,
padahal di bawah 22 persen labelnya jatuh di atas trek abu terang sehingga praktis tidak terbaca.
Sekarang label pindah ke sisi kanan berwarna `muted` ketika isian terlalu sempit untuk memuatnya.

**5. Pemeriksaan mata**

Tangkapan layar kelima layar ditinjau dengan model penglihatan. Dua kecurigaan yang muncul
(`55%` terbaca `66%`, dan bilah `0%` terlihat penuh) diperiksa ke DOM dan ternyata salah baca
gambar berukuran kecil, bukan cacat aplikasi; angka sebenarnya sudah dikonfirmasi di poin 3 dan
lewat pengukuran piksel.

## Kesimpulan

Kelima blok **PASS**. Tidak ada item FAIL. Satu catatan jujur: model penglihatan yang dipakai untuk
pemeriksaan mata bekerja tidak stabil pada gambar besar, jadi penilaian selera visual akhir tetap
sebaiknya dilakukan pemilik langsung. Yang bisa diukur sudah diukur dan angkanya ada di atas.

---

# D-16 · Lapisan sentuh diperketat untuk pemakaian harian di HP

Audit kedua dijalankan karena pemilik menegaskan aplikasi akan banyak dipakai di HP. Semua angka di
bawah diukur pada viewport 390x844 dengan `isMobile: true` dan `hasTouch: true`, ditambah 360x740
dan 320x568 untuk pemeriksaan tepi.

**1. Yang diperbaiki**

| Temuan | Ukuran sebelum | Ukuran sesudah |
| --- | --- | --- |
| Radius kontrol / panel / lembar | 10 / 16 / 24 px | 12 / 18 / 26 px |
| Tab di dalam strip | 8 px (terlihat setingkat dengan strip) | 9 px (bersarang) |
| Strip gulir horizontal: `touch-action` | tidak ada (sapuan vertikal tertelan) | `pan-x pan-y` |
| Lembar: `overscroll-behavior` | `auto` (gulir menembus ke halaman) | `contain` |
| Baris buku besar | 56 px | 60 px, dengan `:active` |
| Kepala layar: safe-area atas | tidak ada | `pt-[env(safe-area-inset-top)]` |
| Target ber-anchor: `scroll-margin-top` | tidak ada | `calc(72px + env(safe-area-inset-top))` |
| Padding kartu strip tab Rencana | 12 px (kartu lain 16 px) | 16 px |
| Penanda wajib `Nominal` / `Jenis` | tidak ada | ada, dengan `sr-only` |
| Aksi per dompet di Profil | 3 tombol teks per baris | 1 menu `Lainnya` |

**2. Yang diperiksa dan ternyata bukan cacat**

Dua kecurigaan awal gugur setelah diukur ulang, dan dicatat supaya tidak dikejar lagi:

- **Klirens konten terhadap bilah navigasi.** Probe pertama melaporkan tumpang tindih 61px. Probe
  itu salah: ia mengambil elemen terakhir dari pemilih yang terlalu luas sehingga kena pembungkus
  setinggi viewport, bukan konten. Setelah dibatasi ke elemen berteks di dalam `main`, klirens
  sebenarnya **37 sampai 63 px** di semua layar dan semua tinggi viewport yang diuji.
- **Aturan safe-area.** Pemindaian `document.styleSheets` mengembalikan nol kemunculan
  `env(safe-area-inset-*)` dan tampak seperti aturan yang hilang. Penyebabnya CSSOM tidak
  mengekspos aturan dari stylesheet yang disuntik Vite. Membaca CSS terkompilasi menunjukkan aturan
  itu **ada**: `pt-[env(safe-area-inset-top)]`, `pb-[calc(5.75rem+env(safe-area-inset-bottom))]`,
  dan `pb-[max(1rem,env(safe-area-inset-bottom))]`.

**3. Angka akhir**

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm verify` | 74/74 server, 6/6 web |
| `pnpm smoke` | 50/50 |
| Click-through HP (`verify.mjs`) | 24/24, 0 gagal |
| Overflow horizontal di 6 layar | 0 px di semuanya |
| Kontras di bawah AA (dua mode) | 0 |
| Target sentuh di bawah 44 px | 0 (di luar tautan lewati `.sr-only`) |
| Angka uang tanpa mono/tabular | 0 dari 141 |
| Strip gulir tanpa `touch-action` | 0 |
| Status fokus saat lembar dibuka | fokus di dalam dialog |

**4. Catatan kejujuran**

Dua probe pertama sesi ini menghasilkan temuan palsu sebelum diperbaiki, dan keduanya berasal dari
alat ukur yang salah sasaran, bukan dari aplikasi. Pelajarannya dicatat di berkas skill: CSSOM bukan
sumber kebenaran untuk aturan yang disuntik, dan pengukuran klirens harus dibatasi ke elemen berteks.


---

# Gerbang D-18 · Arah canon: konvensi aplikasi keuangan besar

**Tanggal:** 1 Oktober 2026 (redesain keempat, arah `D-18`; angka diperbarui setelah tinjauan desain kelima)
**Ruang lingkup:** seluruh lapisan tampilan `app/web` (enam slice rute: Beranda, Transaksi, Rencana,
Laporan, Notifikasi, Profil, plus layar masuk), teks antarmuka, dan tiga celah PRD yang ditutup.
**Tidak berubah:** perilaku finansial (uang integer Rupiah, jurnal berpasangan, `workspace_id` dari
sesi, idempotensi, batas Rp999.999.999.999), kontrak API, dan skema basis data.
**Build yang dinilai:** `index-HPQJsJuM.js` 465.002 B (gzip 136.330 B) dan `index-Db3C64u0.css`
36.773 B (gzip 8.041 B); `vite build` EXIT=0. Halaman diukur lewat dev server atas berkas sumber
yang sama, dan `impeccable detect` dijalankan atas `dist` hasil build ini (`[]` untuk `dist`,
`index.html`, dan `src`).
**Alat ukur:** Chrome headless lewat `agent-browser` (DOM, gaya terhitung, geometri), `impeccable
detect`, `node --test`, `node scripts/smoke.mjs`. Bukti mentah audit ada di
`.impeccable/review/audit-d18.json` (24 halaman: 6 rute x 2 viewport x 2 tema), ditulis ulang setelah
perbaikan tinjauan; tangkapan layar tema terang ada di `.impeccable/review/*.png`.

## Blok 1 · Hard Gate (semua jawaban harus TIDAK)

| # | Pertanyaan | Jawaban | Bukti |
|---|---|---|---|
| R-02 | Ada em dash di teks mana pun di luar pengecualian? | **TIDAK** | Pemindaian teks antarmuka pada 24 halaman: 0 em dash di dalam DOM. |
| R-03 | Ada luapan horizontal atau tata letak rusak di mobile? | **TIDAK** | 390x844, enam rute, dua tema: `scrollWidth - innerWidth = 0` di 12 halaman. Target sentuh pada Beranda: 16 kendali, tinggi terkecil **44 px**. Di 24 halaman: **0 kendali** di bawah 44 px (di luar tautan lewati `.sr-only` 1x1 px yang memakai `focus:min-h-[44px]`). Seluruh aksi di kaki lembar (sembilan formulir) dan aksi per-baris di lembar berulang diukur **52 px**. |
| R-17 | Ada statistik tanpa sumber nyata? | **TIDAK** | Tidak ada satu pun angka statistik di antarmuka. Setiap angka berasal dari jurnal; 78 tes server lulus. |
| R-18 | Ada testimoni fiktif? | **TIDAK** | Tidak ada bagian testimoni di aplikasi. |
| R-23 | Ada aset visual dibuat tanpa instruksi atau placeholder jujur? | **TIDAK** | `DESIGN.md` menyatakan belum ada logo disetujui; penanda jujur `[LOGO]` dan `public/icon.svg` yang berkomentar sebagai penanda sementara. Ikon adalah glyph SVG buatan sendiri, 0 pustaka ikon di `package.json`. Tidak ada avatar atau foto. |
| R-24 | Ada tautan navigasi ke halaman yang tidak ada? | **TIDAK** | Keenam rute dibuka satu per satu dan semuanya merender layar berisi (`h1` ada, tanpa galat). |
| R-25 | Ada teks dengan kontras di bawah WCAG AA? | **TIDAK** | **3.724 pemeriksaan** (simpul teks berisi x 24 halaman, dua tema), latar efektif dihitung dengan mengompositkan nilai `oklab(... / alfa)` di atas rantai latar; kendali kustom (kotak centang, tombol radio) diukur pada label pembungkusnya. **0 gagal.** Ambang 4.5:1 teks normal, 3:1 teks besar. Pasangan terketat yang lulus 4,74:1 (terang, `/profil`, label nada "Pengeluaran" `#c81a1a` di atas tint 12 persen). |
| R-26 | Ada tombol, dropdown, atau formulir yang tidak melakukan apa pun? | **TIDAK** | Lembar konfirmasi berulang baru: `Konfirmasi` mencatat transaksi (toast "Transaksi berulang tercatat: +Rp8.500.000 pada 1 Okt 2026."), `Lewati` melewati kejadian (toast "Kejadian 1 Okt 2026 dilewati. Rencananya tetap berjalan."). Keduanya mengubah basis data, lihat R-35. |
| R-27 | Antarmuka kurang keadaan kosong, memuat, atau galat? | **TIDAK** | Setiap daftar memakai `LoadingRows`, `EmptyState`, dan `DataError`. Lembar konfirmasi berulang punya ketiganya, termasuk `EmptyState` "Tidak ada yang menunggu" setelah baris terakhir diputuskan. |
| R-28 | FAQ berisi pertanyaan generik? | **TIDAK** | Tidak ada FAQ. |
| R-32 | Tidak dapat dinavigasi papan tombol atau tanpa fokus terlihat? | **TIDAK** | Escape menutup lembar konfirmasi berulang dan mengembalikan fokus ke tombol pemicunya (diukur: `document.activeElement` = "Konfirmasi transaksi berulang"). Semua kendali >= 44 px dan punya cincin fokus; tidak ada jebakan fokus. |
| R-33 | Ada fitur ditambahkan dengan menambal sumber/CSS dari luar? | **TIDAK** | Semua perubahan ada di berkas sumber. |
| R-34 | Satu mode tema rusak? | **TIDAK** | 24 halaman dijalankan penuh di tema terang dan gelap: kontras 0 gagal, luapan 0, `h1` tunggal, dan token bayangan kartu berbeda per tema tetapi geometrinya sama. |
| R-35 | Diserahkan tanpa dijalankan atau tanpa catatan telusuri klik? | **TIDAK** | Dibangun (`vite build` EXIT=0) dan dijalankan; telusuri klik ada di bagian bawah laporan ini. |
| R-36 | Ada klaim keamanan, kepatuhan, kinerja, atau pelanggan yang dikarang? | **TIDAK** | Satu-satunya kalimat tentang batas produk berbunyi "Rilis awal tidak melakukan pembayaran dan tidak menyimpan kredensial bank". |
| R-37 | Dibangun tanpa arah dan tidak dilabeli? | **TIDAK** | `docs/DESIGN.md` memuat arah canon, dial, dan alasan satu baris per keputusan; keputusan arahnya di `docs/DECISIONS.md` D-18 dan D-19. |
| R-38 | Ada konten bergaya realistis yang dikarang? | **TIDAK** | Data contoh dibuat `server/src/tools/seed.ts` dan dijelaskan sebagai data contoh di `docs/STATUS.md`. |

**Blok 1: PASS.**

## Blok 2 · Purpose Gate (semua jawaban harus TIDAK)

| # | Pertanyaan | Jawaban | Alasan tertulis |
|---|---|---|---|
| R-01 | Gradien atau glow sebagai bawaan tanpa tujuan? | **TIDAK** | 0 elemen dengan `background-image: linear-gradient/radial-gradient` di 24 halaman. Empat gradien SVG di `/laporan` (satu per halaman) mengisi area grafik sebagai pengkodean data, bukan hiasan; `--glow-accent` dan `.bg-aurora` sudah dihapus oleh D-18 butir 2. Pengecualian ini tercatat di `DESIGN.md` dan di `expectedExceptions` berkas audit. |
| R-04 | Ikon generik atau pustaka ikon tanpa relevansi? | **TIDAK** | 0 pustaka ikon di `package.json`; glyph SVG digambar sendiri dan relevan dengan isinya. |
| R-06 | Monospace besar, label kapital jarak lebar, atau rupa tanpa alasan? | **TIDAK** | Monospace dipakai untuk 1.256 simpul `.figure` dan **0 di antaranya bukan monospace**; angka terbesar di layar adalah total saldo 34 px pada Beranda, yaitu angka fokus. Label kapital 11,5 px hanya dipakai untuk label kolom pendek di dalam kartu (`--text-2xs`) dan alasannya tertulis di `DESIGN.md` baris tipografi. Judul, label, dan paragraf tetap Schibsted Grotesk. |
| R-07 | Pola latar grid, blueprint, atau titik tanpa tujuan? | **TIDAK** | 0 pola latar; latar adalah warna permukaan padat. |
| R-08 | Panah pada hampir setiap tombol sebagai hiasan? | **TIDAK** | Satu karakter panah di seluruh antarmuka: `→` pada baris transfer ("Bank BCA → GoPay"), yang membawa informasi asal dan tujuan. Tidak ada panah pada tombol; pemindaian sumber untuk `→ ← ↑ ↓ ▲ ▼ › »` menemukan 1 kemunculan saja, yaitu baris transfer itu. |
| R-09 | Lencana kapsul tanpa fungsi, atau pil di atas H1? | **TIDAK** | `StatusPill` adalah kapsul 999 px yang selalu berisi kata ("Mendekati batas", "Lewat batas", "Tercapai"), jadi bentuknya membawa status nyata. Tidak ada pil di atas judul: kepala halaman hanya teks judul dan satu aksi. |
| R-10 | Glassmorphism pada lebih dari 1-2 elemen? | **TIDAK** | 0 elemen dengan `backdrop-filter` pada 24 halaman. |
| R-12 | Bayangan besar pada setiap komponen tanpa alasan elevasi? | **TIDAK** | Satu-satunya bayangan yang tampil saat diam adalah token `--shadow-card` pada `.card`: `0 1px 2px rgb(16 24 40 / 0.04)` di terang dan `0 1px 3px rgb(0 0 0 / 0.4), 0 0 0 1px rgb(255 255 255 / 0.02)` di gelap. Pemindaian 24 halaman: 0 elemen memakai `--shadow-lift` atau `--shadow-float` dalam keadaan diam. |
| R-13 | Glow pada kartu, tombol, lencana, ikon, latar, dan garis sekaligus? | **TIDAK** | 0 glow. |
| R-14 | Semua kartu fitur identik tanpa alasan hierarki? | **TIDAK BERLAKU** | Tidak ada kartu fitur; hierarki datang dari urutan blok tetap, kepala bagian, dan baris bergaris. |
| R-19 | Semua animasi templat sekaligus, atau gerak melawan dial MOTION? | **TIDAK** | Gerak yang ada hanya hover 120 ms, tekan 90 ms, lembar 180 ms, bilah progres 240 ms, dan denyut kerangka baris. Sesuai MOTION 3. `prefers-reduced-motion` mematikan seluruh durasi. |
| R-22 | Ilustrasi generik tanpa kaitan produk? | **TIDAK** | 0 ilustrasi. |

**Blok 2: PASS.**

## Blok 3 · Liveliness (semua jawaban harus YA)

| Pertanyaan | Jawaban | Bukti |
|---|---|---|
| Dial ditetapkan dan eksplisit? | **YA** | `DESIGN.md`: ENERGY 4 / RHYTHM 4 / MOTION 3. |
| Hasil konsisten dengan dial yang diklaim? | **YA** | ENERGY 4 lewat skala huruf berjarak jelas dan radius berbeda per peran; RHYTHM 4 lewat urutan blok tetap dan pemisah kelompok; MOTION 3 lewat daftar gerak di `DESIGN.md` bagian Motion. |
| Ada satu titik fokus jelas per layar? | **YA** | Beranda: total saldo `Rp27.090.000`, 34 px IBM Plex Mono, satu-satunya angka sebesar itu di layar. |
| Ruang putih struktural, bukan sisa? | **YA** | Gutter dan jarak antar bagian ditetapkan di `DESIGN.md` bagian Layout; diukur: `#konten` 284-1404 px pada jendela 1440 px, anak pertama 316-1372 px. |
| Ada satu aksen sengaja? | **YA** | Biru `#0256ff` (`--accent`) dan `#2563eb` (`--accent-solid`) di mode terang, `#60a5fa` (`--accent`) dengan isian `#2563eb` di mode gelap, dibatasi ke titik keputusan: tombol utama, penanda navigasi dan tab aktif, cincin fokus, isian bilah progres. Kontras putih di atas `#2563eb` = 5,17:1; label aksen di atas tint aksen 14 persen = 6,23:1 di gelap (kandidat `#3b82f6` hanya 4,30:1 dan gagal AA). Angka tint dihitung dari komposit `rgba(59,130,246,0.14)` di atas `#111318`, metode yang sama dipakai pemeriksa audit, bukan cuplikan piksel. |
| Ada motif identitas? | **YA** | Kolom tanda: Beranda punya 24 kolom tanda dan 32 simpul `.figure`. Kolom hanya diisi saat nominal punya arah (`+`/`−`); nominal netral dibiarkan kosong dengan lebar terkunci `1ch`, karena tanda apa pun pada nilai tanpa arah bisa disalahbaca sebagai minus. Terukur di 24 halaman: 1.044 kolom tanda, 0 titik netral, 0 sisa glif titik tengah, 0 nominal bernilai nol yang memakai tanda palsu. |
| Design Read dinyatakan sebelum dibangun? | **YA** | `DESIGN.md`, bagian arah canon. |

**Blok 3: PASS.**

## Blok 4 · Craftsmanship & Quality Locks (semua jawaban harus TIDAK)

| # | Pertanyaan | Jawaban | Bukti |
|---|---|---|---|
| C-1 | Ada keputusan yang hanya beralasan "bawaan AI"? | **TIDAK** | Setiap keputusan visual besar punya alasan satu baris di `DESIGN.md`. |
| C-2 | Ada elemen interaktif yang tidak melakukan apa pun? | **TIDAK** | Sama dengan R-26. |
| C-3 | Ada bagian yang hanya mengisi templat? | **TIDAK** | Setiap blok melayani pekerjaan nyata: mencatat, membuka rincian, menandai yang menunggu. |
| C-4 | Antarmuka rusak pada suatu keadaan, tema, atau tanpa tetikus? | **TIDAK** | 24 halaman (6 rute x 2 viewport x 2 tema) tanpa luapan, tanpa teks `undefined`/`NaN`, `h1` tunggal di setiap halaman, font `loaded` di setiap halaman. |
| C-5 | Ada testimoni, statistik, atau klaim yang dikarang? | **TIDAK** | Sama dengan R-17, R-18, R-36. |
| R-05 | Tata letak mengikuti templat AI atau irama bagian melawan dial RHYTHM? | **TIDAK** | Tidak ada hero pemasaran, kisi kartu seragam, bilah logo, jendela terminal palsu, kolom harga, atau kisi bento. |
| R-11 | Semua elemen dibuat berbentuk pil tanpa variasi radius? | **TIDAK** | Empat radius dengan empat peran, diukur di DOM: pil 999 px (chip, tombol, tab, lencana), kendali 14 px (isian, kotak ikon baris), panel 24 px (kartu), lembar 28 px. 0 nilai radius literal di komponen. |
| R-15 | CTA masih generik? | **TIDAK** | Tombol menyebut aksinya: "Konfirmasi transaksi berulang", "Tulis draf yang belum terkirim", "Tinjau anggaran", "Simpan transaksi". 0 pemakaian "Mulai", "Lanjut", "OK". |
| R-16 | Ada kata pemanis pemasaran AI? | **TIDAK** | 0 kemunculan "seamless", "revolusioner", "cutting edge", "AI powered", "solusi", "canggih". |
| R-20 | Terasa generik bila logo dan nama ditukar? | **TIDAK** | Yang khas adalah perlakuan angkanya: monospace dengan kolom tanda berlebar terkunci yang kosong saat netral, baris nol tanpa tanda palsu, dan kotak kiri baris ledger yang memakai glif transfer untuk perpindahan antar dompet. |
| R-21 | Mode gelap dipaksa tanpa alasan, atau toggle ditunda? | **TIDAK** | Toggle ada di rel desktop dan di Profil, berfungsi dua arah, pilihan disimpan; kedua mode lolos kontras penuh. |
| R-29 | Palet melebihi 2-3 warna inti + 1 aksen tanpa sistem? | **TIDAK** | 2 inti + 1 aksen + 4 warna data semantik, tercatat di `DESIGN.md` Colors. |
| R-30 | Meniru produk populer lain? | **TIDAK** | Arah canon justru **meniru konvensi** aplikasi keuangan besar, dan itu keputusan pemilik yang dicatat di D-18 butir 1; yang tidak ditiru adalah hiasannya (0 gradien CSS, 0 glow, 0 kaca, 0 monospace besar sebagai gaya). Satu-satunya gradien adalah isian area grafik di `/laporan`, yaitu pengkodean data. |
| R-31 | Ada keputusan visual besar yang alasannya tidak bisa ditulis satu baris? | **TIDAK** | Alasan satu baris ada di tabel `DESIGN.md` untuk palet, rupa huruf, jarak dan radius, motif, serta gerak. |

**Blok 4: PASS.**

## Angka akhir

| Pemeriksaan | Hasil |
|---|---|
| `tsc --noEmit` web / server | EXIT=0 / EXIT=0 |
| Tes web (`node --test`) | **5/5 lulus** |
| Tes server (`node --test`, satu concurrency) | **78/78 lulus** |
| `node scripts/smoke.mjs` (HTTP) | **50/50 lulus** |
| `vite build` | EXIT=0, js `index-HPQJsJuM.js` 465.002 B (gzip 136.330 B), css `index-Db3C64u0.css` 36.773 B (gzip 8.041 B) |
| `impeccable detect` (`dist`, `index.html`, `src`) | `[]` di ketiganya |
| Luapan horizontal, 24 halaman | 0 px |
| Kontras di bawah AA, 24 halaman | 0 dari **3.724** pemeriksaan (terketat yang lulus 4,74:1) |
| Simpul `.figure` non-monospace | 0 dari 1.256 |
| Elemen `.tnum` yang memakai monospace padahal bukan nominal | 0 dari 88 |
| Tanda nol yang berbohong (`+Rp0`, `−Rp0`) | 0 dari 500 angka bernilai nol di 24 halaman |
| Titik netral di kolom tanda / sisa glif titik tengah | 0 / 0 dari 1.044 kolom tanda |
| Kotak ikon baris kosong di `/transaksi` | 0 dari 17 kotak |
| Target sentuh di bawah 44 px | 0 |
| Gradien CSS / `backdrop-filter` / bayangan mengambang saat diam | 0 / 0 / 0 |
| Gradien SVG isian grafik (`/laporan`) | 4 (satu per halaman, pengecualian tercatat) |
| Mode gelap: label aksen di atas tint 14 persen | 6,23:1 (`#60a5fa`), sebelumnya 4,30:1 dan gagal AA |
| Gerak di luar daftar `DESIGN.md` bagian Motion | 0: tidak ada scroll-reveal, parallax, atau bouncing; 0 deklarasi `@keyframes` di CSS produk (denyut kerangka dan putar tombol berasal dari Tailwind), dan `prefers-reduced-motion` memaksa seluruh durasi ke 0.01ms |

## Klaim lama yang dikoreksi

1. **Aksen.** Laporan D-15 menyebut aksen teal `#0f6b5c` (dan `#4fd1b5` di gelap). Sejak arah canon
   aksennya biru: di mode terang `--accent` dan `--accent-solid` sama-sama `#0256ff` (putih di
  atasnya 5,56:1), di mode gelap `--accent: #60a5fa` dengan isian pekat `--accent-solid: #2563eb`
  (putih di atasnya 5,17:1). Kandidat `#3b82f6` gagal di dua peran: sebagai isian 3,68:1, dan sebagai
  label aksen di atas tint aksen 14 persen 4,30:1; `#60a5fa` menaikkannya ke 6,23:1 pada tint dan
  7,31:1 pada panel.
2. **Hitungan tes.** 74/74 menjadi **78/78 tes server** ditambah **5/5 tes web** (semula 6/6; satu blok
   tes kolom tanda dihapus bersama glif netralnya).
3. **Bayangan.** Klaim D-15 "0 elemen berbayangan terlihat saat diam" tidak lagi berlaku: kartu kini
   memakai token `--shadow-card` (1 px, alfa 4 persen di terang; 1 px 3 px + cincin 1 px di gelap)
   sesuai `DESIGN.md` pada bagian elevasi. Yang tetap nol adalah bayangan mengambang
   (`--shadow-lift`, `--shadow-float`) di luar lembar dan dialog.
4. **Monospace untuk semua nominal.** Diperjelas, bukan dibatalkan: nominal yang **berdiri sendiri
   sebagai angka** memakai IBM Plex Mono; nominal yang **tersemat di dalam kalimat** yang datang dari
   server sebagai satu string (mis. badan pengingat "Piutang kepada Dimas sebesar Rp750.000 jatuh
   tempo 6 Okt 2026.") memakai rupa teks bertabular. `DESIGN.md` bagian typography sudah disempitkan
   ke cakupan itu pada sesi ini.
5. **Skala jarak.** Klaim D-15 "0 nilai jarak di luar kelipatan 4 px" tidak lagi berlaku apa adanya:
   kode memakai juga 10 px (`py-2.5` pada tombol dan isian `md`), 14 px (`px-3.5` pada pil tab), dan
   36 px (`pr-9` pada pemilih untuk memberi ruang tanda panah 14 px). `DESIGN.md` mencatat skala yang
   sebenarnya: langkah 2 px di ujung kecil (2/4/6/8/10/12/14) lalu melebar ke atas
   (16/20/24/32/36/40/48/64).
6. **Cakupan kaki lembar 52 px.** Janji "seluruh aksi di kaki lembar memakai 52 px" terlalu luas:
   yang memakai 52 px adalah kaki sembilan lembar formulir, lembar entri cepat, dan lembar berulang;
   kaki lembar saringan, detail transaksi, arsip tujuan, dan dialog konfirmasi tetap 44 px. `DESIGN.md`
   baris `Button` sudah dipersempit ke cakupan itu. Yang dijaga tetap sama di semua tempat: kedua
   tombol dalam satu kaki selalu setinggi satu sama lain.
7. **Grafik Laporan.** `DESIGN.md` menyebut "garis arus kas, bilah kategori, dan cincin"; `charts.tsx`
   hanya punya `LineChart` dan `DonutChart`, dan bilah kategori memang tidak pernah dipakai karena
   kategori tampil sebagai daftar di samping cincinnya. Kalimat dokumen itu disesuaikan.
8. **Label bagian.** `--text-2xs` (11,5 px) ternyata juga dipakai label pendek di dalam kartu dan
   lembar, sementara label bagian memakai `--text-xs` (13 px) kapital; `DESIGN.md` baris tipografi
   diperbaiki mengikuti kode.
9. **Gerak.** Blok D-15 menyebut hover 120ms, tekan 90ms, lembar 180ms, dan isian bilah progres
   240ms. Kode hari ini: transisi kendali dan warna 150ms (`duration-150`), umpan balik tekan
   `translateY(1px)` tanpa durasi sendiri, lembar 200ms `cubic-bezier(0.2, 0.8, 0.3, 1)`, isian bilah
   progres hanya bertransisi warna 150ms (lebarnya berubah tanpa animasi), kerangka baris
   `animate-pulse`, dan tombol sibuk `animate-spin` 16px di dalam tombol. `DESIGN.md` kini punya
   bagian **Motion** yang mencatat angka itu; yang tetap benar dari klaim lama: tidak ada
   scroll-reveal, parallax, atau bouncing, dan `prefers-reduced-motion` mematikan seluruh durasi.
10. **Rujukan bagian.** Komentar kode dan blok laporan lama menulis `DESIGN.md §N` dengan penomoran
   yang sudah tidak ada sejak `DESIGN.md` disusun ulang. Komentar di `app/web/src` kini menyebut nama
   bagian (`DESIGN.md "Kolom tanda"`, `DESIGN.md "Motion"`, dan seterusnya) supaya rujukannya bisa
   dibuka; padanan lengkap untuk blok lama ada di catatan pembaruan di kepala berkas ini.
11. **Radius.** Baris R-11 di blok D-15 menyebut empat radius 4/8/12/16 px. Token yang benar-benar
   dipakai kode dan terukur di DOM: pil 999 px, kendali 14 px, panel 24 px, lembar 28 px, dengan 0
   nilai radius literal di komponen. Baris R-11 di blok D-18 sudah memakai angka itu; kalimat lama di
   blok D-15 dibiarkan sebagai jejak.
12. **Label kapital.** Baris R-06 di blok D-15 menutup dengan "tidak ada label kapital jarak lebar",
   padahal label bagian di dalam kartu memang kapital 11,5 px dengan `tracking-wide` (`ui.tsx:350`,
   `Transaksi.tsx:772` dan `:791`). Baris R-06 di blok D-18 sudah menyebut pemakaian itu beserta
   alasan dan batasnya; `DESIGN.md` baris tipografi juga sudah diperbaiki mengikuti kode.

## Penyimpangan yang sengaja

1. `TabPanel` memakai `tabIndex={0}` supaya panel bisa digulir dengan papan tombol.
2. `h1` Beranda ada tetapi `sr-only`; kepala HP tidak mencetak judul halaman. Urutan informasi sudah
   memberi konteks, dan judul besar di HP memakan tinggi layar.
3. Tab tidak menyinkronkan URL. Keadaan tab tidak perlu dibagikan, dan URL tetap pendek.
4. Daftar panjang memakai tombol "Muat lebih banyak", bukan paginasi bernomor; daftar transaksi
   dipakai untuk menggulir, bukan untuk melompat ke halaman.
5. Ada **dua** landmark `<nav aria-label="Navigasi utama">`: satu `hidden lg:flex` untuk rel desktop
   dan satu `lg:hidden` untuk bilah bawah. Keduanya perlu ada karena tujuan navigasinya berbeda, dan
   hanya satu yang terlihat pada satu waktu.
6. Baris transaksi memakai glif tanda (`-`/`+`) di `.icon-tile` untuk nominal berarah, dan glif
   transfer untuk perpindahan antar dompet yang tidak punya arah; tanda adalah penanda yang lebih
   penting daripada ikon kategori. Kolom tanda netral dibiarkan kosong (sebelumnya `·`).
7. Judul pengingat memakai sisa hari yang sebenarnya pada saat dibuat ("H-7", "hari ini"), bukan
   selisih yang dihitung ulang di layar.
8. Lembar konfirmasi berulang **tidak** menyediakan penyuntingan per-isian, padahal server menerima
   `overrides` (`amount`, `walletId`, `categoryId`, `toWalletId`, `fee`, `effectiveDate`, `note`).
   Alasannya dicatat di `docs/DECISIONS.md` D-19.
9. "Lewati" tidak menghapus rencana; `next_on` hanya maju ke jadwal berikutnya.
10. Draf lokal yang belum terkirim dihapus saat keluar, sesuai janji di layar Profil, Keamanan.
11. Kartu "Dana belum dialokasikan" (FR04) diletakkan di dalam panel saldo, bukan sebagai blok
    tersendiri, supaya urutan tujuh blok Beranda tidak berubah.
12. Nominal yang tersemat di dalam kalimat yang disusun server memakai rupa teks, bukan monospace
    (`DESIGN.md` bagian typography); angka yang berdiri sendiri sebagai angka tetap monospace.
13. Nominal yang disembunyikan ("sembunyikan nominal") mengganti seluruh digit dengan titik dan tetap
    memakai titik penanda di kolom tanda (`.sign-dot`); nominal netral yang terlihat **tidak** memakai
    titik itu, karena pada ukuran 13-14,5 px pembacaan tangkapan membacanya sebagai tanda minus.
14. Label kapital `--text-2xs` (11,5 px) dipertahankan untuk label kolom pendek di dalam kartu, dengan
    alasan tertulis di `DESIGN.md`; teks isi dan judul tidak memakainya.

## Cacat yang ditemukan dan diperbaiki pada sesi ini

1. **Janji yang tidak punya jalannya (FR17).** Tombol banner "Catat transaksi berulang" membuka
   formulir kosong, dan `api.confirmOccurrence`/`api.skipOccurrence` tidak dipanggil berkas web mana
   pun. Dibangun lembar konfirmasi yang menampilkan label, jadwal, dan nominal bertanda, lalu
   memanggil kedua endpoint itu.
2. **Arah nominal kejadian berulang di-hardcode `out`.** Kejadian pendapatan akan tampil
   "-Rp8.500.000". Diperbaiki: arah dibaca dari `ruleType` (`income`/`expense`/`transfer`), dan
   `Occurrence` di klien diperluas dengan medan itu (server sudah mengirimnya).
3. **Meta terpotong di 390 px** ("Jadwal 1 Okt 2026 - belum di..."). Nominal dipindah ke baris judul,
   meta memakai lebar penuh; `scrollWidth > clientWidth` = 0.
4. **Nol memakai tanda arah.** Baris pembanding di Laporan menampilkan "+Rp0" dan pembaca layar
   mengucapkan "plus nol". `moneySign` sekarang mengembalikan tanda kosong untuk nilai nol, `Money`
   memperlakukan nominal nol sebagai netral, dan kolom tandanya dibiarkan kosong, sehingga tidak ada
   lagi tanda yang mengklaim arah pada angka yang tidak bergerak.
5. **Kartu "Dana belum dialokasikan" (FR04) dihitung server tetapi tidak pernah tampil.** Kini
   tampil di panel saldo dengan label dan penjelasan pencegah salah tafsir. Diperiksa silang:
   `27.090.000 - (4.000.000 + 2.500.000 + 0) = 20.590.000`, sama dengan `unallocated` dari API dan
   dengan teks di DOM.
6. **Cacat sesi sebelumnya yang sudah diverifikasi:** bug bulan pada `seed.ts` (helper
   `bookedThisMonth`, `seedDemo(db, at)`, penjaga entrypoint, tes `seed.test.ts`); bug jarak hari
   pengingat jatuh tempo (`DEBT_REMINDER_OFFSETS`, `describeDaysLeft`, `formatDateID`); a11y `Money`
   yang mengucapkan arah lewat kata `sr-only`; dan 16 ekspor mati yang dihapus bersama `BarChart`,
   ikon, `loadDraft`, `DAYS_ID`, `formatDayName`, `FREQUENCY_LABEL`, `isPositive`, `useMediaQuery`.
7. **Sisa anggaran yang belum terpakai memakai tanda `+`.** Baris "Sisa anggaran" memakai arah `in`
   selama sisanya positif, sehingga angkanya berbunyi `+Rp952.500` untuk uang yang baru *belum*
   dibelanjakan, bukan uang yang masuk. Arahnya sekarang dibaca dari nilainya: hanya saldo negatif
   (lewat batas) yang bertanda minus, sisanya netral.
8. **Titik netral di kolom tanda.** Titik tengah `·` yang diketik dibaca sebagai tanda minus pada dua
   pembacaan tangkapan yang saling bebas; penggantinya (bulatan digambar 0.34em) juga masih terbaca
   sebagai garis pendek pada pembesaran 8x. Hasilnya: kolom tanda netral kosong, lebarnya dikunci CSS
   `1ch` supaya angka tetap lurus.
9. **Kotak ikon kosong pada baris transfer.** Setelah glif netral dihapus, baris "Bank BCA -> GoPay"
   meninggalkan kotak ikon kosong. Ditambahkan glif transfer (dua panah berlawanan) di `icons.tsx`,
   dipakai untuk baris tanpa arah; terukur 17 kotak di `/transaksi`, 0 kosong.
10. **Tombol kaki lembar tidak seragam.** Sembilan formulir memakai tombol Batal `md` (44 px) di
    samping tombol Simpan `lg` (52 px), sehingga pasangannya tidak rata. Aksi di kaki sembilan lembar
    formulir kini 52 px (`size="lg"`), sesuai janji `DESIGN.md` baris `Button`; kaki lembar lain
    (saringan, detail transaksi, arsip tujuan, dialog konfirmasi) tetap 44 px dan tetap menyejajarkan
    kedua tombolnya.
11. **Titik rendah pada label aksen mode gelap.** Penanda navigasi aktif memakai `bg-accent-soft`
    (aksen 14 persen) dengan teks `#3b82f6`: komposit terhitung 4,30:1 dan gagal AA. `--accent` gelap
    menjadi `#60a5fa` -> 6,23:1 pada tint dan 7,31:1 pada panel.
12. **Aksi per-baris di lembar berulang menjorok.** Tombol "Konfirmasi"/"Lewati" menjorok di bawah
    kolom teks (`pl-[52px]`). Kini duduk di tepi konten lembar dengan dua tombol 52 px.

## R-35 · Catatan telusuri klik (1 Oktober 2026)

| # | Langkah | Hasil |
|---|---|---|
| 1 | Beranda 390x844 memuat | Blok berurutan: banner pekerjaan, Total saldo dompet, Arus bulan ini, Sisa anggaran, Kekayaan bersih, Jatuh tempo 7 hari, Progres tujuan. |
| 2 | Kartu saldo dibaca | `Total saldo dompet Rp27.090.000`; baris "Dompet penyusun saldo 3 dompet"; `Dana belum dialokasikan Rp20.590.000` dengan penjelasan dua baris. |
| 3 | Angka disilang ke API | `unallocated = 20590000`, `totalBalance = 27090000`, alokasi tujuan `4000000 + 2500000 + 0`; DOM cocok. |
| 4 | Tepi kanan nominal diukur | Tepi kanan nominal baru = tepi kanan kendali di kartu yang sama (358 px di 390 px; 1352 px di 1440 px). |
| 5 | Tombol "Konfirmasi transaksi berulang" | Lembar "Transaksi berulang menunggu" terbuka: satu baris "Gaji bulanan / Jadwal 1 Okt 2026 / +Rp8.500.000 / Konfirmasi / Lewati". |
| 6 | Ukuran lembar | Desktop 512x209 px di tengah; HP 390x217 px menempel di dasar (bawah 844). 0 teks terpotong, 0 kendali di bawah 44 px. Tepi kanan nominal 956 px = tepi kanan tombol Tutup 956 px di desktop. |
| 7 | Tombol "Konfirmasi" | Toast "Transaksi berulang tercatat: +Rp8.500.000 pada 1 Okt 2026."; lembar berubah menjadi `EmptyState`; saldo Beranda 27.090.000 menjadi 35.590.000. Basis data: `recurring_occurrences.status='confirmed'`, `transaction_id` terisi, `transactions` 17 menjadi 18, `SUM(debit) - SUM(credit) = 0`. |
| 8 | Tombol "Lewati" | Toast "Kejadian 1 Okt 2026 dilewati. Rencananya tetap berjalan."; `status='skipped'`, `transactions` tetap 18, `recurring_rules.next_on` maju ke 2026-11-01. |
| 9 | Escape di lembar | Lembar tertutup; fokus kembali ke "Konfirmasi transaksi berulang". |
| 10 | Nol tanpa arah | `/laporan`: "Pendapatan +Rp9.750.000 / Pembanding 31 Agu 2026 sampai 30 Sep 2026 **Rp0**" dengan kolom tanda kosong; 500 angka bernilai nol di 24 halaman, 0 di antaranya bertanda. |
| 11 | Pemulihan data demo | Basis data dikembalikan dari salinan berkas ke keadaan kanonik: 17 transaksi, 1 `recurring_occurrences` `pending`, 2 aturan berulang, saldo Beranda `Rp27.090.000`. |
| 12 | Tab Rencana | "Utang" menampilkan "Utang (kewajiban) / Piutang (hak tagih)", "Tujuan" menampilkan "Tujuan keuangan", "Anggaran" menampilkan "Batas per kategori"; luapan 0 di ketiganya dan fokus tetap di tab yang ditekan. |
| 13 | Rentang Laporan | "Bulan" -> "Ringkasan Oktober 2026", "Tahun" -> "Ringkasan Tahun 2026", "Tanggal khusus" -> ringkasan tanggal yang dipilih; grafik, tabel, dan unduhan CSV ikut berubah. |
| 14 | Lembar saringan dan menu tindakan | "Filter" membuka dialog dengan 4 kelompok chip berlabel (`saring-jenis`, `saring-dompet`, `saring-kategori`, `saring-rentang`, 25 chip); Escape menutup dialog dan mengembalikan fokus ke "Filter". "Aksi lain untuk Bank BCA" membuka menu (Ubah, Rekonsiliasi, Arsipkan dompet, Hapus dompet); Escape menutup dan mengembalikan fokus ke tombolnya. |
| 15 | Profil dan Notifikasi | Profil memuat enam bagian: Dompet, Kategori, Preferensi, Keamanan, Data, Masa simpan data. Notifikasi memuat 1 pengingat dengan "Tandai dibaca" per baris dan "Tandai semua dibaca". |
| 16 | Baris transfer di `/transaksi` | "Bank BCA -> GoPay / Transfer - Top up dompet digital / Rp1.000.000": kotak kiri berisi glif transfer (17 kotak diperiksa, 0 kosong), kolom tanda nominal kosong, tanpa tanda palsu. |
| 17 | Mode sembunyikan nominal | Tombol "Menyembunyikan nominal" di Beranda: seluruh digit menjadi titik, kolom tanda tetap memakai `.sign-dot` (27 simpul, 29 nominal bertopeng, 30 pengumuman `sr-only`); setelah "Menampilkan nominal", kembali 0 titik. |
| 18 | Sisa anggaran | Beranda: `Rp952.500` tanpa tanda apa pun di depannya, dibuktikan pada pembesaran 8x (`.impeccable/review/desktop.png`, potongan `Rp952.500` tanpa penanda). |
| 19 | Kaki lembar formulir | "Ubah dompet" di `/profil`: "Simpan perubahan" dan "Batal" keduanya 52 px, kaki lembar `padding 16px 20px`, menempel di dasar lembar. |

## R-36 · Telusuri live (server dev hidup, 1 Oktober 2026)

API (`node --watch server/src/main.ts`) di `http://127.0.0.1:8787` dan Vite 7.3.6 di
`http://localhost:5173` (proksi `/api`). Chromium mengemudikan 9 halaman: 5 rute desktop 1440x900,
4 rute mobile 390x844, ditambah 2 lembar mobile. Tangkapan tanpa pemaskan ada di
`.impeccable/review/live/` (10 PNG; DPR 1,25 sehingga berkas 1800x1125 dan 488x1055), dengan tema
terang dan gelap keduanya hadir.

| # | Pemeriksaan | Hasil live |
|---|---|---|
| 1 | 5 rute desktop: `/`, `/transaksi`, `/rencana`, `/laporan`, `/profil` | `h1` benar, `scrollX` 0 di kelimanya; kolom tanda 27 / 22 / 15 / 193 / 4, titik netral 0 |
| 2 | Kotak ikon `/transaksi` | 17 kotak, tiap kotak tepat 1 anak: 13 glif arah (`bg-out/12`, `bg-in/12`) dan 4 SVG transfer; 0 kosong. Metrik "kosong" harus menghitung anak, bukan `svg` |
| 3 | Galat konsol | 0 pada seluruh penelusuran (`tab.errors()` → `entries: []`, `dropped: 0`) |
| 4 | 4 rute mobile 390x844 | `scrollX` 0, titik netral 0; target < 44 px hanya tautan lompat 1x1 (`sr-only`) dan tiga `input` checkbox 16 px di `/profil`, yang sasaran ketuknya label pembungkus |
| 5 | Lembar berulang di mobile | 1 `[role="dialog"]`; "Konfirmasi" dan "Lewati" 52 px pada `y` sama (764); tombol tutup 44 px; dasar lembar = tinggi viewport (844); `Escape` menutup (0 dialog terbuka) |
| 6 | Lembar saringan `/transaksi` | 4 tombol kaki 44 px (Bulan ini, Pilih tanggal, Terapkan, Bersihkan), sesuai cakupan 44 px yang dinyatakan |
| 7 | Mode gelap | `className = "dark"`, kanvas `#050508`, panel `#111318`, tint nav aktif `rgba(59,130,246,0.14)`, label `#60a5fa` → **6,23:1** dari `getComputedStyle` + komposit |
| 8 | Sembunyikan nominal | `.sign-dot` 0 → 27 saat disembunyikan (digit menjadi `••••••`) → 0 lagi saat ditampilkan; `.sign-col` tetap 27 |
| 9 | Teks ganda / tumpang | 27 `.figure` beranak `.sign-col` berukuran 0-9 px x 0 px (tak melukis apa pun), 0 `text-shadow`, dan geometri 6 bilah progres tidak menimpa label persen (0 tumpang) |

Catatan metode: pemeriksaan 1-9 dijalankan pada DOM dan gaya terhitung di halaman hidup, bukan pada
gambar. Klaim model penglihatan pada satu pembacaan gambar penuh ("angka terlihat ganda", "bilah
progres menimpa label 94%") diuji ulang lewat geometri DOM dan pembesaran 2x: keduanya tidak
terbukti.

## Catatan kejujuran

Penilaian di laporan ini datang dari pengukuran: DOM, gaya terhitung, geometri, dan respons API.
Model penglihatan tetap tidak stabil pada gambar besar, jadi selera visual akhir (apakah kartu
terasa "profesional") adalah penilaian yang harus Anda lakukan sendiri; yang bisa dibuktikan sudah
dibuktikan dan angkanya ada di atas.

Dua batas kejujuran pada bukti tangkapan layar. Pertama, `.impeccable/review/*.png` (empat berkas
lama, 1440x900 dan 390x844) melewati alat tangkap yang memaskan gambar ke kotak 1024 px, jadi
berkas itu hasil pengubahan ukuran Lanczos, bukan piksel asli pada ukuran tersebut, dan keempatnya
bertema terang. Kedua, angka di tabel diukur di DOM, bukan dari gambar: selera visual akhir tetap
penilaian Anda, dan model penglihatan terbukti tidak stabil pada gambar besar (dua klaimnya pada
satu pembacaan gambar penuh - "angka terlihat ganda" dan "bilah progres menimpa label 94%" - tidak
terbukti saat diuji ulang lewat geometri DOM dan pembesaran 2x). Set tangkapan R-36 di
`.impeccable/review/live/` menutup dua batas itu: berkasnya ditulis langsung oleh browser tanpa
pemaskan, dan tema terang maupun gelap keduanya tersedia.

Dua koreksi angka yang saya lakukan setelah laporan awal. Angka kontras mode gelap dulu ditulis
4,38:1 dan 6,34:1 dari cuplikan piksel; dihitung ulang dari komposit `rgba(59,130,246,0.14)` di atas
`#111318` (nilai yang sama dengan cara kerja pemeriksa audit), hasilnya **4,30:1** untuk `#3b82f6`
dan **6,23:1** untuk `#60a5fa`. Angka itu juga diukur ulang di Chromium pada server dev yang hidup
(1 Oktober 2026) lewat `getComputedStyle` ditambah komposit, hasilnya sama: 6,23:1. Selisihnya kecil
dan tidak mengubah keputusan (keduanya di sisi
berbeda dari ambang AA 4,5), tetapi angka yang bisa dihitung ulang lebih baik daripada angka yang
bergantung pada satu cuplikan. `DESIGN.md`, `STATUS.md`, dan komentar `styles/index.css` sudah
memakai angka baru itu. Sejalan dengan itu, `.impeccable/design.json` diperbaiki di tempat pada
1 Oktober 2026 (nilai dan redaksi) tetapi `generatedAt` di dalamnya tetap 29 September 2026 karena
field itu mencatat kapan lembar itu dibangkitkan, bukan kapan terakhir disentuh.
