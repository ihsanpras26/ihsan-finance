# Laporan Delivery Gate: Ihsan Finance P0

Dijalankan: 22 September 2026 (redesain kedua)
Mode: **During** (gerbang dijalankan sebelum penyerahan)
Arah visual: `docs/DESIGN.md` (Design Read: alat ukur untuk uang, ENERGY 2 / RHYTHM 2 / MOTION 2)
Bukti mentah: `pnpm verify`, `pnpm smoke`, dan telusuri klik `agent-browser` pada Chrome 153.

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
