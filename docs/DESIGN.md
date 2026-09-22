# DESIGN.md: Ihsan Finance

Sumber kebenaran visual. Filter anti-slop memakai file ini sebagai arah; tanpa file ini hasilnya
steril (R-37). Semua keputusan visual besar ditulis dengan alasan satu baris (R-31).

**Design Read:** Alat ukur untuk uang. Angka adalah produknya, jadi rupa huruf dibangun untuk
angka: tabular, monospace, lurus dalam kolom sungguhan, dengan tanda arah yang selalu ada.
Permukaan netral sejuk; satu warna aksen struktural yang hanya muncul di titik keputusan; warna
uang memegang seluruh perhatian semantik.

**Dial:** ENERGY 2 / RHYTHM 2 / MOTION 2. Naik satu langkah dari arah sebelumnya: aplikasi
keuangan harian perlu hidup dan responsif, tetapi tetap tenang.

**Mode:** Operate. Pengguna datang untuk menyelesaikan pekerjaan, bukan mengagumi halaman.
Keterbacaan cepat, konsistensi, dan kepadatan yang menghormati alur kerja mengalahkan ekspresi.

Arah ini **menggantikan** arah "buku besar kertas" yang hangat dan berserif. Alasan penggantian:
pemilik meminta tampilan modern bersih kelas SaaS, dan arah lama memang dibangun untuk terbaca
seperti buku kas kertas, bukan seperti alat kerja digital. Arah lama diperlakukan sebagai bukti
dan anti-contoh, bukan sebagai dasar untuk ditambal.

## 1. Prinsip

1. **Angka adalah produknya.** Setiap keputusan visual tentang nominal melayani keterbacaan cepat:
   lebar tetap, lurus kanan, tanda eksplisit, tidak pernah bergeser.
2. **Warna tidak pernah sendiri.** Arah uang tidak boleh hanya ditandai warna (NFR06). Setiap
   nominal membawa tanda dan kata; warna hanya memperkuat.
3. **Hirarki dari permukaan dan jarak, bukan dari garis.** Garis dipakai hemat; pemisahan
   terutama dari tint permukaan dan jarak.
4. **Satu aksen, di titik keputusan saja.** Aksen yang muncul di mana-mana berhenti menjadi aksen.
5. **Tenang pada kepadatan tinggi.** Dipakai tiap hari dengan banyak baris; yang ramai harus tetap
   bisa dipindai.

## 2. Palet

Dua warna inti (permukaan, teks) ditambah satu aksen, ditambah empat warna data semantik.

### Terang

| Token | Nilai | Alasan satu baris |
|---|---|---|
| `--surface` | `#fbfaf9` | Latar kerja: putih gading yang nyaris netral, hangat sedikit agar tidak steril. |
| `--surface-raised` | `#ffffff` | Panel dan baris terangkat: putih penuh supaya terpisah dari latar tanpa perlu bayangan. |
| `--surface-sunken` | `#f3f1ee` | Sumur untuk kepala tabel dan area nonaktif: satu langkah lebih gelap dari latar. |
| `--fg` | `#14171a` | Teks utama: hampir hitam dengan sedikit sejuk, kontras tinggi untuk pemindaian cepat. |
| `--fg-muted` | `#696f76` | Teks kedua: label, satuan, keterangan. |
| `--hairline` | `#e7e4e0` | Garis rambut: pemisah baris dan tepi kendali. |
| `--accent` | `#0f6b5c` | Aksen teal tua: struktural dan tegas, dan bukan biru bawaan yang dipakai hampir semua produk buatan agen. |
| `--accent-fg` | `#ffffff` | Teks di atas aksen. |
| `--in` | `#12734a` | Uang masuk: hijau murni, sengaja berbeda hue dari aksen teal agar tidak tertukar. |
| `--out` | `#ad2f22` | Uang keluar: merah bata gelap, terbaca sebagai tanda, bukan sebagai alarm. |
| `--warn` | `#8a5a00` | Peringatan anggaran dan jatuh tempo. |

### Gelap

| Token | Nilai | Alasan satu baris |
|---|---|---|
| `--surface` | `#0e1113` | Latar gelap: hampir hitam dengan sedikit sejuk, bukan hitam murni. |
| `--surface-raised` | `#181c1f` | Panel terangkat di mode gelap. |
| `--surface-sunken` | `#090b0c` | Sumur di mode gelap. |
| `--fg` | `#e9e7e4` | Teks utama: putih gading agar tidak menyilaukan di ruangan gelap. |
| `--fg-muted` | `#9aa0a6` | Teks kedua di mode gelap. |
| `--hairline` | `#272c30` | Garis rambut di mode gelap. |
| `--accent` | `#4fd1b5` | Aksen dinaikkan terangnya agar tetap kontras di latar gelap. |
| `--accent-fg` | `#06201a` | Teks di atas aksen gelap: gelap, bukan putih, karena aksennya terang. |
| `--in` | `#5cc98d` | Uang masuk di mode gelap. |
| `--out` | `#f0857a` | Uang keluar di mode gelap. |
| `--warn` | `#e0b45c` | Peringatan di mode gelap. |

**Aturan pemakaian aksen:** hanya di tombol utama, penanda tab dan navigasi aktif, cincin fokus,
dan isian bilah progres. Tidak pernah sebagai latar bagian, tidak pernah sebagai hiasan, tidak
pernah sebagai warna teks judul.

**Aturan warna data:** hanya pada nominal dan lencana status. Tidak pernah sebagai latar panel.
Setiap pemakaian selalu disertai tanda arah dan kata, sehingga tetap terbaca tanpa warna.

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
| `--text-lg` | 20px | Judul bagian. |
| `--text-xl` | 26px | Judul halaman. |
| `--text-2xl` | 36px | Angka utama beranda. |
| `--text-3xl` | 48px | Angka tunggal di layar fokus, paling banyak satu kali per layar. |

Bobot: 400 untuk isi, 500 untuk penekanan ringan dan label, 600 untuk judul dan tombol, 700 hanya
untuk angka utama. Tidak ada teks di bawah 11.5px.

## 4. Jarak, radius, elevasi

### Skala jarak

Kelipatan 4px. Nilai di luar daftar ini dilarang, termasuk nilai ad-hoc seperti 10px atau 14px.

`2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

| Peran | Nilai |
|---|---|
| Jarak dalam kendali (padding) | 8 / 12 / 16 |
| Jarak antar baris daftar | 12 vertikal |
| Jarak antar kelompok | 24 |
| Jarak antar bagian | 32 sampai 48 |
| Gutter halaman | 16 di HP, 24 di tablet, 32 di desktop |

### Radius

| Token | Nilai | Peran |
|---|---|---|
| `--radius-chip` | 4px | Lencana, penanda status, potongan kecil. |
| `--radius-control` | 8px | Tombol, isian, combobox. |
| `--radius-panel` | 12px | Panel, kartu, kepala tabel. |
| `--radius-sheet` | 16px | Lembar dan dialog yang mengambang. |

### Elevasi

Bayangan hanya untuk lapisan yang benar-benar mengambang (R-12): lembar, dialog, menu turun.
Baris daftar dan panel tidak pernah memakai bayangan; keduanya terpisah lewat tint permukaan.

`--shadow-float`: `0 16px 40px -16px rgb(9 12 14 / 0.28)` di terang, `rgb(0 0 0 / 0.62)` di gelap.

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
fokus tidak sedang dibandingkan dengan angka lain di kolom mana pun. Pada 22 September 2026,
28 dari 29 nominal di Beranda berada tepat pada satu tepi kanan; satu-satunya pengecualian adalah
angka fokus itu.

Nominal selalu rata kanan; angka non-uang memakai `font-variant-numeric: tabular-nums`, angka
uang memakai monospace penuh.

## 6. Susunan

- **Satu kolom isi** dengan lebar maksimum 1120px di desktop. Aplikasi keuangan bukan halaman
  pemasaran; kolom selebar layar membuat mata kehilangan tempat berhenti.
- **Navigasi**: rel kiri 232px di desktop, bilah bawah di HP. Penanda aktif adalah bentuk, bukan
  hanya warna: batang aksen 2px di tepi kiri item aktif plus bobot huruf yang naik.
- **Kepala tabel dan kepala bagian** memakai `--surface-sunken`, bukan garis tebal, sehingga
  hierarki datang dari permukaan.
- **Daftar**: pemisah baris adalah garis rambut `--hairline`. Garis itu berhenti sebelum kolom
  tanda, sehingga kolom angka di sisi kanan terbaca sebagai satu bidang yang menyatu.
- **Kepadatan**: tinggi baris daftar 52px di desktop, 60px di HP (layar sentuh butuh ruang jari).

## 7. Titik fokus per layar

Satu titik fokus, bukan beberapa yang bersaing.

| Layar | Titik fokus | Perlakuan |
|---|---|---|
| Masuk | Formulir masuk | Satu panel putih di tengah, tanpa hiasan, tanpa ilustrasi. |
| Beranda | Angka total saldo | `--text-2xl` monospace dengan kolom tanda, lalu baris ringkas di bawahnya. |
| Transaksi | Daftar transaksi | Baris padat dengan kolom tanda yang lurus; pencarian dan saringan menyatu di atasnya. |
| Rencana | Sisa pokok utang terdekat | Angka besar pada catatan teratas, sisanya baris ringkas. |
| Laporan | Selisih periode | Angka selisih dengan arah eksplisit; grafik sebagai pendamping, bukan bintang. |
| Profil | Daftar dompet | Baris dompet dengan saldo di kolom tanda. |

## 8. Gerak (MOTION 2)

Gerak adalah umpan balik, bukan pertunjukan.

| Kejadian | Gerak | Alasan |
|---|---|---|
| Hover kendali | Perubahan warna latar 120ms | Menandai bahwa kendali hidup. |
| Tekan kendali | Turun 1px 90ms | Umpan balik fisik bahwa tekanan diterima. |
| Lembar muncul | Naik 12px dan pudar 180ms | Menjelaskan asal lapisan. |
| Baris daftar baru | Tidak ada | Daftar yang beranimasi saat memuat membuat mata lelah. |
| Bilah progres berubah | Lebar 240ms | Menghubungkan sebab dan akibat saat dana dialokasikan. |

`prefers-reduced-motion` mematikan seluruh durasi. Tidak ada animasi berulang, tidak ada denyut,
tidak ada parallax.

## 9. Keadaan wajib (R-27)

Setiap layar berdata punya empat keadaan, dan tiap keadaan menyebut sebab serta tindakan
berikutnya.

| Keadaan | Perlakuan |
|---|---|
| Memuat | Kerangka baris sebanyak perkiraan isi memakai `--surface-sunken`, tanpa pemutar di tengah. |
| Kosong | Satu kalimat sebab plus satu tindakan yang mengisinya. Tidak ada ilustrasi. |
| Galat | Pesan yang menyebut apa yang gagal dan apa yang harus dilakukan, plus tombol coba lagi. |
| Padat | Jumlah besar tetap terbaca: kolom angka lurus, pemisah tetap tipis. |

## 10. Suara teks (antislop-copywriting)

- Kalimat pendek, kata konkret, tanpa tanda pisah panjang, tanpa kata pemanis ("seamless",
  "revolusioner", "solusi", "canggih").
- Tombol menyebut aksinya: "Simpan transaksi", "Catat cicilan", "Alokasikan dana", bukan "Mulai",
  "Lanjut", "OK".
- Pesan galat menyebut sebab dan tindakan: "Nominal harus lebih dari Rp0. Isi nominal lalu simpan
  lagi.", bukan "Input tidak valid".
- Angka selalu berformat `Rp25.000` dengan pemisah ribuan; tidak pernah `Rp25`.
- Tidak ada tanda seru, tidak ada "Ups", tidak ada emoji. Aplikasi tidak memberi nasihat keuangan
  dan tidak menyebut angka yang tidak ada.

## 11. Aset (R-23)

Belum ada logo, avatar, atau foto yang disetujui pemilik. Untuk sekarang: nama produk sebagai teks
ber-rupa Schibsted Grotesk, dan penanda jujur `[LOGO]` di tempat logo akan dipasang. Ikon memakai
glyph SVG buatan sendiri yang relevan dengan isinya (dompet, panah masuk, panah keluar, target,
kalender), bukan satu pustaka ikon tipis seragam. Tidak ada testimoni, tidak ada statistik
pengguna, tidak ada klaim keamanan yang belum diverifikasi (R-17, R-18, R-36).
