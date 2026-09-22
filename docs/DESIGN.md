# DESIGN.md: Ihsan Finance

Sumber kebenaran visual. Filter anti-slop memakai file ini sebagai arah; tanpa file ini hasilnya
steril (R-37). Semua keputusan visual besar ditulis dengan alasan satu baris (R-31).

**Design Read:** Aplikasi keuangan harian untuk satu orang yang membuka HP sambil berdiri. Bahasa
visual fintech modern yang bersih: kanvas abu terang, kartu putih dengan sudut membulat dan bayangan
halus, satu biru struktural di titik keputusan, satu kuning sebagai warna data kedua, dan angka yang
selalu terbaca sebagai angka. Bukan dasbor perusahaan, bukan pula buku kas kertas.

**Dial:** ENERGY 4 / RHYTHM 4 / MOTION 3. Naik dari arah sebelumnya: aplikasi ini dibuka beberapa
kali sehari, jadi kartu harus terasa hidup dan responsif, tetapi tetap tenang saat dipindai.

**Mode:** Operate. Pengguna datang untuk menyelesaikan pekerjaan, bukan mengagumi halaman.
Keterbacaan cepat, konsistensi, dan kepadatan yang menghormati alur kerja mengalahkan ekspresi.

Arah ini **menggantikan** arah "alat ukur netral" (aksen teal, kanvas gading, hierarki dari permukaan
tanpa kartu). Alasan penggantian: pemilik menilai arah lama belum memuaskan dan meminta arah
fintech modern yang bersih dan berorientasi HP, dengan referensi desain yang dilampirkan. Arah lama
diperlakukan sebagai bukti dan anti-contoh, bukan sebagai dasar untuk ditambal.

## 1. Prinsip

1. **Angka adalah produknya.** Setiap keputusan visual tentang nominal melayani keterbacaan cepat:
   lebar tetap, lurus kanan, tanda eksplisit, tidak pernah bergeser.
2. **Warna tidak pernah sendiri.** Arah uang tidak boleh hanya ditandai warna (NFR06). Setiap
   nominal membawa tanda dan kata; warna hanya memperkuat.
3. **Hirarki dari kartu, jarak, dan bobot huruf.** Kartu putih di atas kanvas abu adalah unit
   susunan. Garis dipakai hemat: pemisah baris tipis di dalam kartu, bukan bingkai di sekeliling
   segalanya.
4. **Satu aksen, di titik keputusan saja.** Biru hanya untuk tombol utama, item navigasi aktif,
   cincin fokus, dan seri data utama. Aksen yang muncul di mana-mana berhenti menjadi aksen.
5. **Kepadatan yang bisa dipindai.** Dipakai tiap hari dengan banyak baris; baris tinggi 56 sampai
   64px di HP, ikon dalam kotak lembut, dan angka selalu di tepi kanan yang sama.

## 2. Palet

Kanvas abu terang, kartu putih, satu biru struktural, satu kuning data, ditambah empat warna
semantik uang.

### Terang

| Token | Nilai | Alasan satu baris |
|---|---|---|
| `--surface` | `#f4f4f5` | Kanvas: abu terang netral supaya kartu putih terbaca sebagai lapisan di atasnya. |
| `--surface-raised` | `#ffffff` | Kartu dan panel: putih penuh, dipisahkan dari kanvas oleh tint dan bayangan halus. |
| `--surface-sunken` | `#eceef0` | Sumur untuk kepala tabel, trek bilah, dan area nonaktif. |
| `--fg` | `#0f1720` | Teks utama: hampir hitam, kontras tinggi untuk pemindaian cepat. |
| `--fg-muted` | `#59616d` | Teks kedua: label, satuan, keterangan. Digelapkan dari `#6b7280` agar lolos AA (5.38:1) di atas sumur, tempat label terkecil berada. |
| `--hairline` | `#e4e7ea` | Garis rambut: pemisah baris dan tepi kendali. |
| `--accent` | `#0256ff` | Biru struktural: tegas, terbaca di kanvas terang, dan dipakai fintech sebagai bahasa kepercayaan. |
| `--accent-fg` | `#ffffff` | Teks di atas aksen. |
| `--accent-soft` | `#0256ff14` | Tint aksen untuk latar lencana dan keadaan aktif. |
| `--accent-2` | `#ffb700` | Kuning data: seri kedua grafik, tujuan, dan penanda kategori. Tidak pernah untuk tombol, dan tidak pernah sebagai warna teks di latar terang. |
| `--in` | `#07714e` | Uang masuk: hijau tegas, sengaja berbeda hue dari biru agar tidak tertukar. Digelapkan agar nominal hijau lolos AA (5.19:1) di atas sumur. |
| `--out` | `#c81a1a` | Uang keluar: merah bersih, terbaca sebagai tanda, bukan sebagai alarm. Digelapkan agar nominal merah lolos AA (4.99:1) di atas sumur. |
| `--warn` | `#96450a` | Peringatan anggaran dan jatuh tempo. Digelapkan agar teks lencana lolos AA di atas tint 14 persennya sendiri (5.38:1). |

### Gelap

| Token | Nilai | Alasan satu baris |
|---|---|---|
| `--surface` | `#0b0f14` | Kanvas gelap: hampir hitam dengan sedikit sejuk, bukan hitam murni. |
| `--surface-raised` | `#141a21` | Kartu di mode gelap, satu langkah lebih terang dari kanvas. |
| `--surface-sunken` | `#090c10` | Sumur di mode gelap. |
| `--fg` | `#e9edf1` | Teks utama: putih gading agar tidak menyilaukan di ruangan gelap. |
| `--fg-muted` | `#98a2b3` | Teks kedua di mode gelap. |
| `--hairline` | `#242c36` | Garis rambut di mode gelap. |
| `--accent` | `#4d8bff` | Biru dinaikkan terangnya agar tetap kontras di latar gelap. |
| `--accent-fg` | `#06132b` | Teks di atas aksen gelap: gelap, bukan putih, karena aksennya terang. |
| `--accent-soft` | `#4d8bff24` | Tint aksen di mode gelap. |
| `--accent-2` | `#ffc93c` | Kuning data di mode gelap. |
| `--in` | `#3ddc97` | Uang masuk di mode gelap. |
| `--out` | `#ff6b6b` | Uang keluar di mode gelap. |
| `--warn` | `#f0b45c` | Peringatan di mode gelap. |

**Aturan pemakaian aksen:** hanya di tombol utama, penanda navigasi aktif, cincin fokus, seri data
utama grafik, dan isian bilah progres. Tidak pernah sebagai latar bagian, tidak pernah sebagai
hiasan, tidak pernah sebagai warna teks judul.

**Aturan warna data:** hanya pada nominal, lencana status, dan grafik. Tidak pernah sebagai latar
panel. Setiap pemakaian selalu disertai tanda arah dan kata, sehingga tetap terbaca tanpa warna.

## 3. Rupa huruf

| Peran | Keluarga | Alasan satu baris |
|---|---|---|
| Antarmuka dan teks | **Schibsted Grotesk** | Grotesk Nordik yang tegas dan sangat terbaca di ukuran kecil, dan bukan Inter atau Geist yang muncul di hampir semua antarmuka buatan agen. |
| Semua nominal uang | **IBM Plex Mono** | Angka keuangan harus lurus dalam kolom dan tidak boleh bergeser lebarnya saat digit berubah; monospace menjaminnya sekaligus menandai bahwa ini alat ukur. Alasan fungsional, bukan gaya. |

Monospace **tidak pernah** dipakai untuk judul, label, atau paragraf. Batasnya tajam: kalau
angkanya bukan nominal uang, ia memakai Schibsted Grotesk dengan `tabular-nums`.

### Skala huruf

Enam langkah dengan lompatan jelas; tidak ada dua langkah yang berjarak kurang dari 1px.

| Token | Ukuran | Peran |
|---|---|---|
| `--text-2xs` | 11.5px | Label kolom, satuan, meta terkecil. |
| `--text-xs` | 13px | Teks kedua, keterangan, label isian. |
| `--text-sm` | 14.5px | Baris tabel padat dan kontrol. |
| `--text-base` | 16px | Teks isi. |
| `--text-lg` | 20px | Judul kartu dan judul bagian. |
| `--text-xl` | 26px | Judul halaman dan angka kartu utama. |
| `--text-2xl` | 34px | Angka fokus beranda (saldo). |
| `--text-3xl` | 44px | Angka tunggal di layar fokus, paling banyak satu kali per layar. |

Bobot: 400 untuk isi, 500 untuk penekanan ringan dan label, 600 untuk judul dan tombol, 700 hanya
untuk angka utama. Tidak ada teks di bawah 11.5px.

## 4. Jarak, radius, elevasi

### Skala jarak

Kelipatan 4px. Nilai di luar daftar ini dilarang, termasuk nilai ad-hoc seperti 10px atau 14px.

`2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

| Peran | Nilai |
|---|---|
| Jarak dalam kendali (padding) | 8 / 12 / 16 |
| Padding dalam kartu | 16 di HP, 20 di desktop |
| Jarak antar baris daftar | 12 vertikal |
| Jarak antar kartu | 12 di HP, 16 di desktop |
| Jarak antar kelompok | 24 |
| Jarak antar bagian | 32 sampai 48 |
| Gutter halaman | 16 di HP, 24 di tablet, 32 di desktop |

### Radius

| Token | Nilai | Peran |
|---|---|---|
| `--radius-chip` | 999px | Lencana dan pil status: bentuk pil penuh. |
| `--radius-control` | 12px | Tombol, isian, combobox, ikon kotak. |
| `--radius-panel` | 18px | Kartu dan panel. |
| `--radius-sheet` | 26px | Lembar dan dialog yang mengambang. |

### Elevasi

Kartu diam memakai bayangan paling halus; hanya lapisan yang benar-benar mengambang (lembar,
dialog, menu turun) memakai bayangan besar (R-12).

| Token | Nilai |
|---|---|
| `--shadow-card` | `0 1px 2px rgb(16 24 40 / 0.04)` |
| `--shadow-lift` | `0 8px 24px -12px rgb(16 24 40 / 0.18)` |
| `--shadow-float` | `0 24px 48px -20px rgb(16 24 40 / 0.32)` |

## 5. Motif identitas: kolom tanda

Motifnya bukan hiasan, melainkan satu aturan penyajian angka yang berlaku di seluruh aplikasi.

**Setiap nominal menempati kolom tanda.** Di sebelah kiri setiap angka selalu ada satu posisi
karakter untuk tanda arah, dan posisi itu selalu ada meski isinya kosong:

| Tanda | Arti | Contoh |
|---|---|---|
| `+` | uang masuk | `+Rp1.500.000` |
| `−` | uang keluar | `−Rp25.000` |
| `·` | netral, atau belum ada arah | `·Rp1.250.000` |

Akibatnya seluruh nominal yang tersusun vertikal lurus dalam satu kolom, dan arah uang terbaca
tanpa membaca satu digit pun. Ini juga yang membuat NFR06 patuh secara struktural: arah tidak
pernah ditandai warna saja, karena tandanya selalu ada.

**Cakupan aturan.** Kolom tanda berlaku pada nominal yang tersusun vertikal: baris daftar, kolom
tabel, dan kolom kartu. Angka fokus tunggal di setiap layar (misalnya total saldo di Beranda)
sengaja dikecualikan dan duduk di bawah labelnya sendiri, karena sebuah angka yang menjadi titik
fokus tidak sedang dibandingkan dengan angka lain di kolom mana pun.

Nominal selalu rata kanan; angka non-uang memakai `font-variant-numeric: tabular-nums`, angka uang
memakai monospace penuh.

## 6. Susunan

- **Mobile-first.** Susunan dasar adalah satu kolom untuk layar 390px; layar lebar menambah kolom,
  bukan mengecilkan tata letak HP. Bilah navigasi bawah 5 tujuan dengan tombol Tambah di tengah
  adalah bentuk utama aplikasi.
- **Desktop**: rel kiri 248px berisi merek, tombol Tambah, tujuan, dan identitas pengguna. Kolom isi
  maksimum 1120px, boleh dua kolom kartu di atas 1024px.
- **Kartu adalah unit susunan.** Putih, radius 18px, padding 16 sampai 20px, bayangan halus,
  judul kartu 20px semibold dengan aksi di kanan.
- **Kepala layar**: sapaan atau judul halaman, subjudul tanggal, dan aksi utama di kanan.
- **Daftar**: baris tinggi 56px di HP dan 60px di desktop, ikon di dalam kotak radius 12px, dua
  baris teks (nama dan meta), nominal di tepi kanan. Pemisah adalah garis rambut di dalam kartu.
- **Kepadatan**: angka uang selalu di tepi kanan yang sama pada satu kartu.

## 7. Titik fokus per layar

Satu titik fokus, bukan beberapa yang bersaing.

| Layar | Titik fokus | Perlakuan |
|---|---|---|
| Masuk | Formulir masuk | Satu kartu putih di tengah kanvas abu, tanpa hiasan, tanpa ilustrasi. |
| Beranda | Saldo dompet dan arus bulan ini | Kartu saldo sebagai kartu pertama, lalu arus masuk/keluar, grafik, dan daftar. |
| Transaksi | Daftar transaksi | Baris padat dengan kolom tanda yang lurus; pencarian dan saringan menyatu di atasnya. |
| Rencana | Sisa anggaran dan kewajiban | Pil tab di dalam kartu; progres sebagai bilah dengan persentase di dalam isian. |
| Laporan | Selisih periode | Angka selisih dengan arah eksplisit; grafik sebagai pendamping, bukan bintang. |
| Profil | Daftar dompet | Baris dompet dengan saldo di kolom tanda. |

## 8. Gerak (MOTION 3)

Gerak adalah umpan balik, bukan pertunjukan.

| Kejadian | Gerak | Alasan |
|---|---|---|
| Hover kendali | Perubahan warna latar 120ms | Menandai bahwa kendali hidup. |
| Tekan kendali | Turun 1px 90ms | Umpan balik fisik bahwa tekanan diterima. |
| Lembar muncul | Naik 12px dan pudar 200ms | Menjelaskan asal lapisan. |
| Baris daftar baru | Tidak ada | Daftar yang beranimasi saat memuat membuat mata lelah. |
| Bilah progres berubah | Lebar 240ms | Menghubungkan sebab dan akibat saat dana dialokasikan. |

`prefers-reduced-motion` mematikan seluruh durasi. Tidak ada animasi berulang, tidak ada denyut,
tidak ada parallax.

## 9. Keadaan wajib (R-27)

Setiap layar berdata punya empat keadaan, dan tiap keadaan menyebut sebab serta tindakan
berikutnya.

| Keadaan | Perlakuan |
|---|---|
| Memuat | Kerangka kartu dan baris sebanyak perkiraan isi memakai `--surface-sunken`, tanpa pemutar di tengah. |
| Kosong | Satu kalimat sebab plus satu tindakan yang mengisinya. Tidak ada ilustrasi. |
| Galat | Pesan yang menyebut apa yang gagal dan apa yang harus dilakukan, plus tombol coba lagi. |
| Padat | Jumlah besar tetap terbaca: kolom angka lurus, pemisah tetap tipis. |

## 10. Grafik

Grafik adalah pendamping angka, bukan pengganti angka. Nilai yang persis selalu tersedia sebagai
teks di dekat grafiknya.

| Jenis | Pemakaian | Aturan |
|---|---|---|
| Garis dua seri | Arus kas masuk dan keluar per bulan | Dua seri: biru untuk pengeluaran, kuning untuk pemasukan. Sumbu Y ringkas (5K, 10K), sumbu X nama bulan pendek. Tidak ada legenda tanpa label teks. |
| Donat | Komposisi kategori pada Laporan | Paling banyak enam potong; sisanya digabung sebagai "Lainnya". Label persentase di luar potongan terbesar saja. |
| Bilah progres | Anggaran dan tujuan | Isian memakai warna semantik, sisa trek memakai `--surface-sunken`, persentase ditulis di dalam isian bila lebarnya cukup, jika tidak di luar. |

Grafik dibuat dari SVG yang digambar sendiri, tanpa pustaka pihak ketiga. Setiap grafik punya
`aria-label` yang menyebut isinya dan tabel teks pendamping.

## 11. Suara teks (antislop-copywriting)

- Kalimat pendek, kata konkret, tanpa tanda pisah panjang, tanpa kata pemanis ("seamless",
  "revolusioner", "solusi", "canggih").
- Tombol menyebut aksinya: "Simpan transaksi", "Catat cicilan", "Alokasikan dana", bukan "Mulai",
  "Lanjut", "OK".
- Pesan galat menyebut sebab dan tindakan: "Nominal harus lebih dari Rp0. Isi nominal lalu simpan
  lagi.", bukan "Input tidak valid".
- Angka selalu berformat `Rp25.000` dengan pemisah ribuan; tidak pernah `Rp25`.
- Tidak ada tanda seru, tidak ada "Ups", tidak ada emoji. Aplikasi tidak memberi nasihat keuangan
  dan tidak menyebut angka yang tidak ada.

## 12. Aset (R-23)

Belum ada logo, avatar, atau foto yang disetujui pemilik. Untuk sekarang: nama produk sebagai teks
ber-rupa Schibsted Grotesk dengan penanda jujur `[LOGO]` di tempat logo akan dipasang. Ikon memakai
glyph SVG buatan sendiri yang relevan dengan isinya (dompet, panah masuk, panah keluar, target,
kalender), bukan satu pustaka ikon tipis seragam. Tidak ada testimoni, tidak ada statistik
pengguna, tidak ada klaim keamanan yang belum diverifikasi (R-17, R-18, R-36).

## 13. Perilaku khusus perangkat sentuh

Aplikasi ini dipakai di HP lebih dulu. Aturan berikut mengikat, bukan opsional:

- **Safe-area dihormati di tiga tempat**: bilah bawah (`padding-bottom`), kepala (`padding-top`),
  dan kaki lembar. Tanpa ini judul tertutup poni dan tombol tertutup home indicator.
- **Target sentuh minimum 44x44px** untuk semua kontrol yang terlihat, tanpa kecuali.
- **`touch-action: pan-x pan-y`** pada setiap strip yang bisa digeser mendatar, supaya geser
  vertikal di dalamnya tetap menggulir halaman. Scrollbar strip disembunyikan.
- **Tidak ada zoom otomatis iOS**: semua `input`, `select`, dan `textarea` memakai 16px atau lebih.
- **`overscroll-behavior: contain`** di dalam lembar, supaya gulir tidak menembus ke halaman.
- **`min-h-0`** pada badan lembar yang menggulir, supaya papan ketik tidak memotong isian.
- **Umpan tekan** (`translateY(1px)` saat `:active`) pada setiap kontrol yang bisa ditekan, dan
  sorotan ketuk berwarna aksen tipis, bukan blok abu-abu bawaan peramban.
- **`min-h-dvh`**, bukan `100vh`: `vh` di HP menghitung tinggi yang tertutup bilah alamat.
- **Penanda tab aktif tidak hanya warna**: ada bilah aksen pendek di atas ikon, supaya arah
  navigasi terbaca tanpa bergantung pada warna saja (NFR06).
- **Lembar punya pegangan** (garis pendek di atas) sebagai isyarat bahwa panel bisa ditutup.
- Hormati `prefers-reduced-motion`: semua animasi dan transisi dipangkas ke 0,01ms.
