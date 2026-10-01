---
name: Ihsan Finance
description: Buku besar pribadi satu pengguna: saldo, arus, anggaran, utang, dan tujuan dalam satu bahasa visual fintech yang tenang.
colors:
  canvas: "#f4f4f5"
  surface: "#ffffff"
  sunken: "#eceef0"
  ink: "#0f1720"
  ink-muted: "#59616d"
  hairline: "#e4e7ea"
  accent: "#0256ff"
  accent-fg: "#ffffff"
  accent-solid: "#0256ff"
  accent-soft: "#0256ff14"
  data-gold: "#946000"
  money-in: "#07714e"
  money-out: "#c81a1a"
  warning: "#96450a"
  overlay: "rgb(15 23 32 / 0.44)"
  dark-canvas: "#050508"
  dark-surface: "#111318"
  dark-sunken: "#090b0f"
  dark-ink: "#f4f6f8"
  dark-ink-muted: "#8b96a5"
  dark-hairline: "#1c222b"
  dark-accent: "#60a5fa"
  dark-accent-fg: "#ffffff"
  dark-accent-solid: "#2563eb"
  dark-accent-soft: "#3b82f624"
  dark-data-gold: "#ffc93c"
  dark-money-in: "#3ddc97"
  dark-money-out: "#ff6b6b"
  dark-warning: "#f0b45c"
  dark-overlay: "rgb(0 0 0 / 0.75)"
typography:
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "16px"
    fontWeight: 400
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Schibsted Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Schibsted Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  title:
    fontFamily: "Schibsted Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.35
  headline:
    fontFamily: "Schibsted Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.2
  display:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "34px"
    fontWeight: 500
    lineHeight: 1.1
rounded:
  chip: "999px"
  control: "14px"
  panel: "24px"
  sheet: "28px"
spacing:
  "2": "2px"
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "32": "32px"
  "36": "36px"
  "40": "40px"
  "48": "48px"
  "64": "64px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.chip}"
    height: "44px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 16px"
  icon-button:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.control}"
    size: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 12px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    height: "44px"
    padding: "0 12px"
  chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.chip}"
    height: "44px"
    padding: "0 12px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "20px"
---

# DESIGN.md: Ihsan Finance

Sumber kebenaran visual. Filter anti-slop memakai berkas ini sebagai arah; tanpa berkas ini hasilnya
steril (R-37). Setiap keputusan visual besar ditulis dengan alasan satu baris (R-31). Token di
frontmatter bersifat normatif; prosa menjelaskan cara memakainya. Nilai token yang sama juga hidup
di `app/web/src/styles/index.css` dan dipetakan ke utilitas lewat `@theme inline`.

Sidecar `.impeccable/design.json` di akar repositori memuat yang tidak muat di frontmatter: ramp
tonal tiap warna, token bayangan dan gerak, breakpoint, potongan HTML/CSS komponen, dan narasi.
Sidecar ini ditulis ulang setiap kali berkas ini ditulis ulang, dan isinya mengikuti berkas ini.

**Design Read:** Aplikasi keuangan harian untuk satu orang yang membuka HP sambil berdiri. Bahasa
visual fintech modern yang bersih: kanvas abu terang, kartu putih dengan sudut membulat dan bayangan
halus, satu biru struktural, satu kuning sebagai warna data kedua, dan angka yang selalu terbaca
sebagai angka. Bukan dasbor perusahaan, bukan pula buku kas kertas.

**Mode:** Operate. Pengguna datang untuk menyelesaikan pekerjaan, bukan mengagumi halaman.

**Dial:** ENERGY 4 / RHYTHM 4 / MOTION 3. Aplikasi ini dibuka beberapa kali sehari, jadi kartu harus
terasa hidup dan responsif, tetapi tetap tenang saat dipindai.

**Creative North Star: "Buku besar yang tenang".** Aplikasi ini harus terasa seperti buku besar yang
selalu rapi dan tidak pernah menarik perhatian pada dirinya sendiri: angka yang lurus, bahasa yang
jelas, dan tidak ada elemen yang meminta dilihat tanpa alasan.

**Key Characteristics:**
- Kanvas tenang, kartu putih beradius 24px, dan satu biru struktural; tidak ada gradien atau glow.
- Nominal yang berdiri sendiri sebagai angka selalu monospace, rata kanan, dengan kolom tanda yang
  selalu ada, dan nol selalu netral tanpa glif apa pun.
- Satu aksi utama per layar; semua aksi lain menjadi aksi kedua yang lebih tenang.
- Keempat keadaan data (memuat, kosong, galat, berisi) hadir di setiap tampilan.

**Arah:** canon. Konvensi aplikasi keuangan bermerek besar dieksekusi penuh, tanpa keunikan yang
diselundupkan. Patokan mutu yang dipakai sebagai ujian, bukan sebagai hiasan:

| Patokan | Yang diambil | Alasan satu baris |
|---|---|---|
| YNAB | Pekerjaan yang menunggu pengguna diletakkan di banner paling atas dasbor. | Orang membuka aplikasi uang untuk menyelesaikan sesuatu, bukan untuk melihat grafik. |
| Copilot Money | Urutan blok dasbor tetap; nominal selalu punya kolom tanda. | Urutan tetap membuat pemindaian cepat, dan tanda membuat arah uang tidak bergantung warna. |
| Monzo | Detail transaksi dibuka sebagai lembar bawah, bukan halaman baru. | Pengguna tidak kehilangan konteks daftar saat memeriksa satu baris. |
| Jenius | Satu tombol aksi berdiri di tengah bilah bawah. | Pencatatan transaksi adalah tindakan paling sering dan harus dijangkau jempol. |

**Riwayat arah:** D-14 mengganti arah kertas, D-15 menyetel ulang ke bahasa fintech (palet dan
grafik), D-17 melengkungkan radius dan mencoba gradien aurora serta glow, D-18 memilih arah canon
dan mencabut gradien, glow, dan pendaran. Aurora dan glow kini menjadi anti-referensi: tidak ada
`.bg-aurora`, tidak ada `--glow-accent`, tidak ada pendaran di tombol.

## Colors

Kanvas abu terang, kartu putih, satu biru struktural, satu kuning data, ditambah empat warna
semantik uang. Mode gelap memakai nama token yang sama dengan nilai berbeda.

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
| `--accent-solid` | `#0256ff` | Isian aksen yang membawa teks putih (tombol utama, tombol tengah bilah bawah, lencana merek). Di mode gelap menjadi `#2563eb` supaya putih di atasnya mencapai 5.17:1. |
| `--accent-fg` | `#ffffff` | Teks di atas aksen. |
| `--accent-soft` | `#0256ff14` | Tint aksen untuk latar lencana dan keadaan aktif. |
| `--accent-2` | `#946000` | Kuning data: seri kedua grafik, penanda tujuan, dan penanda kategori. Digelapkan dari kuning cerah `#ffb700` yang hanya 1,75:1 di atas kartu putih dan gagal syarat 3:1 untuk objek grafis; nilai ini juga lolos AA sebagai teks. Tidak pernah untuk tombol. |
| `--in` | `#07714e` | Uang masuk: hijau tegas, sengaja berbeda hue dari biru agar tidak tertukar. Digelapkan agar nominal hijau lolos AA (5.19:1) di atas sumur. |
| `--out` | `#c81a1a` | Uang keluar: merah bersih, terbaca sebagai tanda, bukan sebagai alarm. Digelapkan agar nominal merah lolos AA (4.99:1) di atas sumur. |
| `--warn` | `#96450a` | Peringatan anggaran dan jatuh tempo. Digelapkan agar teks lencana lolos AA di atas tint 14 persennya sendiri (5.38:1). |
| `--overlay` | `rgb(15 23 32 / 0.44)` | Selubung di belakang lembar dan dialog: cukup gelap untuk memisahkan lapisan, tidak menghapus konteks. |

### Gelap

| Token | Nilai | Alasan satu baris |
|---|---|---|
| `--surface` | `#050508` | Kanvas gelap: nyaris hitam supaya kertas putih dan aksen biru terbaca sebagai cahaya di atasnya, bukan sebagai dua blok abu. |
| `--surface-raised` | `#111318` | Kartu di mode gelap, satu langkah lebih terang dari kanvas. |
| `--surface-sunken` | `#090b0f` | Sumur di mode gelap. |
| `--fg` | `#f4f6f8` | Teks utama: putih bersih supaya terbaca di atas hitam pekat. |
| `--fg-muted` | `#8b96a5` | Teks kedua di mode gelap. |
| `--hairline` | `#1c222b` | Garis rambut di mode gelap. |
| `--accent` | `#60a5fa` | Biru struktural di mode gelap, dipakai teks, garis grafik, dan garis fokus. Label aksen duduk di atas tint 14% (`bg-accent-soft`); di sana `#3b82f6` hanya mencapai 4.30:1 dan gagal AA, sedangkan `#60a5fa` mencapai 6.23:1 di atas tint dan 7.31:1 di atas panel. Angka ini dari komposit `rgba(59,130,246,0.14)` di atas `#111318`, bukan dari cuplikan piksel, jadi bisa dihitung ulang kapan saja; diukur ulang di Chromium pada server dev hidup 1 Oktober 2026. |
| `--accent-solid` | `#2563eb` | Isian aksen di mode gelap. Biru sesusun lebih tua dari `--accent`: putih di atasnya 5.17:1, sedangkan `#3b82f6` hanya 3.68:1 dan gagal AA untuk label tombol. |
| `--accent-fg` | `#ffffff` | Teks di atas isian aksen, baik di tema terang maupun gelap. |
| `--accent-soft` | `#3b82f624` | Tint aksen di mode gelap. |
| `--accent-2` | `#ffc93c` | Kuning data di mode gelap. |
| `--in` | `#3ddc97` | Uang masuk di mode gelap. |
| `--out` | `#ff6b6b` | Uang keluar di mode gelap. |
| `--warn` | `#f0b45c` | Peringatan di mode gelap. |
| `--overlay` | `rgb(0 0 0 / 0.75)` | Selubung di mode gelap: kanvasnya sudah gelap, jadi selubungnya lebih pekat. |

**Aturan pemakaian aksen:** hanya di tombol utama, penanda navigasi dan tab aktif, cincin fokus,
seri data utama grafik, isian bilah progres, dan tautan teks. Aksen yang muncul di mana-mana berhenti
menjadi aksen. Setiap permukaan aksen yang memuat teks memakai `--accent-solid`, bukan `--accent`:
`--accent` adalah warna teks dan grafik di atas kanvas, `--accent-solid` adalah isian di bawah teks
putih. Keduanya sama di tema terang, berbeda di tema gelap, dan teks putih tidak pernah diletakkan
langsung di atas `--accent` mode gelap.

**Aturan warna data:** hanya pada nominal, lencana status, dan grafik. Tidak pernah sebagai latar
panel. Setiap pemakaian selalu disertai tanda arah dan kata, sehingga tetap terbaca tanpa warna
(NFR06). Tidak ada gradien latar, tidak ada glow, tidak ada `backdrop-filter` sebagai hiasan
(R-01, R-10, R-13). Satu pengecualian yang disengaja: isian area di bawah garis grafik Laporan
(`charts.tsx`: aksen 16 persen yang memudar ke 0) memakai `<linearGradient>` SVG. Itu perangkat
pengkodean data yang memisahkan area terukur dari kanvas, bukan gradien dekoratif pada tombol,
kartu, atau teks.

## Typography

| Peran | Keluarga | Alasan satu baris |
|---|---|---|
| Antarmuka dan teks | **Schibsted Grotesk** | Grotesk Nordik yang tegas dan sangat terbaca di ukuran kecil, dan bukan Inter atau Geist yang muncul di hampir semua antarmuka buatan agen. |
| Nominal yang berdiri sendiri sebagai angka | **IBM Plex Mono** | Angka keuangan harus lurus dalam kolom dan tidak boleh bergeser lebarnya saat digit berubah; monospace menjaminnya sekaligus menandai bahwa nominal adalah hasil pengukuran. Alasan fungsional, bukan gaya. |

Monospace **tidak pernah** dipakai untuk judul, label, atau paragraf. Batasnya tajam: kalau angkanya
bukan nominal uang, ia memakai Schibsted Grotesk dengan `tabular-nums` (kelas `.tnum`).

Pengecualian yang disengaja: nominal yang tersemat di dalam kalimat yang datang dari server sebagai
satu string utuh (mis. badan pengingat "Piutang kepada Dimas sebesar Rp750.000 jatuh tempo 6 Okt 2026.")
tetap memakai rupa teks. Satu kalimat tidak boleh berganti rupa di tengahnya, dan angkanya pun tetap
memakai angka tabular dari rupa teks itu.

### Skala huruf

Delapan langkah dengan lompatan jelas; tidak ada ukuran di bawah 11.5px dan tidak ada dua langkah
yang berjarak kurang dari 1px.

| Token | Ukuran | Peran |
|---|---|---|
| `--text-2xs` | 11.5px | Label kolom, satuan, lencana, dan meta terkecil, termasuk label pendek di dalam kartu dan di dalam lembar entri cepat. Label bagian tidak memakai ukuran ini: `SectionHead` dan dua subjudul di lembar rincian transaksi memakai `--text-xs` 13px, dicetak dengan huruf kapital, `tracking-wide`, dan warna `--fg-muted`, satu langkah di atas label terkecil supaya judul kartu di bawahnya tetap menjadi judul. |
| `--text-xs` | 13px | Teks kedua, keterangan, label isian, dan label bagian berhuruf kapital. |
| `--text-sm` | 14.5px | Baris tabel padat dan kontrol. |
| `--text-base` | 16px | Teks isi dan semua isian (batas bawah agar iOS tidak mengezoom). |
| `--text-lg` | 20px | Judul kartu dan judul bagian. |
| `--text-xl` | 26px | Judul halaman dan angka kartu utama. |
| `--text-2xl` | 34px | Angka fokus di layar ringkasan. |
| `--text-3xl` | 44px | Angka tunggal di layar fokus, paling banyak satu kali per layar. |

Bobot: 400 untuk isi, 500 untuk penekanan ringan dan label, 600 untuk judul dan tombol, 700 hanya
untuk angka utama.

### Kolom tanda

Motif identitas aplikasi ini, dan ia sebuah aturan penyajian angka, bukan hiasan (lihat bagian
Components untuk komponennya). Setiap nominal yang tersusun vertikal menempati satu posisi karakter
untuk tanda arah, dan posisi itu selalu ada meski isinya kosong:

| Tanda | Arti | Contoh |
|---|---|---|
| `+` | uang masuk | `+Rp1.500.000` |
| `−` | uang keluar | `−Rp25.000` |
| kosong | netral, atau belum ada arah | `Rp1.250.000` (kolom tetap ada, lebar `1ch`) |

Kolom tanda netral dibiarkan kosong, dan lebarnya dijamin CSS (`.sign-col` = `1ch`), jadi seluruh
nominal tetap lurus dalam satu kolom tanpa perlu penanda. Dua penanda sudah dicoba dan gagal:
titik tengah `·` yang diketik terbaca sebagai minus pada dua pembacaan tangkapan yang saling bebas
(`·Rp27.090.000` dibaca `-Rp27.090.000`), dan bulatan yang digambar 0.34em masih terbaca sebagai
garis pendek pada pembacaan tangkapan yang sama. Karena itu netral tidak memakai glif apa pun, dan
arah uang tetap terbaca dari `+`/`−` tanpa membaca satu digit pun: kolom kosong tidak pernah bisa
salah dibaca, sedangkan tanda apa pun bisa. Satu-satunya titik yang tersisa adalah penanda nominal
yang disembunyikan (`.sign-dot`), di mana seluruh digit sudah menjadi titik.

**Cakupan aturan.** Kolom tanda berlaku pada nominal yang tersusun vertikal: baris daftar, kolom
tabel, dan kolom kartu. Angka fokus tunggal di setiap layar (total saldo di Beranda, neto di
Laporan, nominal di lembar detail transaksi) sengaja dikecualikan dan duduk di bawah labelnya
sendiri, karena sebuah angka yang menjadi titik fokus tidak sedang dibandingkan dengan angka lain.
Di kode, pengecualian itu ditulis eksplisit sebagai `sign={false}` pada `Money`, sehingga setiap
nominal lain tetap membawa kolom tanda.

## Layout

- **Mobile-first.** Susunan dasar adalah satu kolom untuk layar 360 sampai 430px; layar lebar
  menambah kolom, bukan mengecilkan tata letak HP.
- **Kerangka HP**: kepala setinggi 56px yang opaque (tanpa blur), isi menggulir, bilah navigasi bawah
  yang menempel berisi empat tujuan (Beranda, Transaksi, Rencana, Laporan) dengan tombol Tambah di
  tengah sebagai bentuk utama aplikasi. Profil tidak ikut di bilah karena sudah dijangkau dari avatar
  di kepala.
  Kepala tidak menyimpan kontrol tema; tema ada di Profil, bagian Preferensi.
- **Judul halaman**: satu `<h1>` per layar, dan ia hidup di dalam konten (`PageHeader`), bukan
  diulang di kepala. Kepala HP memuat identitas ruang kerja dan aksi akun saja; mengulang judul di
  kepala membuat nama layar muncul dua kali dalam satu pandangan. Beranda tidak punya judul
  tampak karena blok pertamanya banner pekerjaan, jadi `<h1>`-nya hanya hidup di pohon aksesibilitas.
- **Kerangka desktop (≥1024px)**: rel kiri 248px berisi merek, tombol Tambah, lima tujuan (empat tujuan
  ditambah Profil), dan identitas pengguna; kolom isi maksimum 1120px dengan gutter 32px; pada lebar
  yang sama dua kolom kartu boleh dipakai bila isinya berdiri sendiri.
- **Kartu adalah unit susunan.** Putih, radius panel 24px, padding 16px di HP dan 20px di desktop,
  bayangan paling halus, judul kartu 20px semibold dengan aksi di kanan. Kartu tidak pernah bersarang
  di dalam kartu.
- **Baris daftar**: tinggi 60px, ikon di dalam kotak radius 14px, dua baris teks (nama dan meta),
  nominal di tepi kanan. Pemisah adalah garis rambut di dalam kartu, bukan bingkai.
- **Baris yang menempel**: pencarian dan kepala kelompok memakai `.pin-under-head`, menempel tepat di
  bawah kepala 56px di HP dan di puncak wadah gulir di desktop. Satu aturan bersama, bukan tebakan
  per layar.
- **Kepadatan**: angka uang selalu di tepi kanan yang sama pada satu kartu.

### Skala jarak

Langkah 2px di ujung kecil, lalu melebar ke atas. Nilai di luar daftar ini dilarang, termasuk nilai
ad-hoc seperti 18px atau 22px.

`2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 · 36 · 40 · 48 · 64`

| Peran | Nilai |
|---|---|
| Jarak dalam kendali (padding) | 8 / 10 / 12 / 16 / 20 / 36 |
| Padding dalam kartu | 16 di HP, 20 di desktop |
| Jarak antar baris daftar | 12 vertikal |
| Jarak antar kartu | 12 di HP, 16 di desktop |
| Jarak antar kelompok | 24 |
| Jarak antar bagian | 32 sampai 48 |
| Gutter halaman | 16 di HP, 24 di tablet, 32 di desktop |

## Elevation & Depth

Kartu diam memakai bayangan paling halus; hanya lapisan yang benar-benar mengambang (lembar, dialog,
menu turun) memakai bayangan besar (R-12). Tidak ada bayangan literal di luar token, dan tidak ada
pendaran berwarna.

| Token | Nilai | Peran |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgb(16 24 40 / 0.04)` | Kartu diam dan kendali bersudut. |
| `--shadow-lift` | `0 8px 24px -12px rgb(16 24 40 / 0.18)` | Kartu yang mengangkat saat hover karena kartunya sendiri sebuah tautan. |
| `--shadow-float` | `0 24px 48px -20px rgb(16 24 40 / 0.32)` | Lembar, dialog, dan menu yang benar-benar mengambang di atas halaman. |

Mode gelap mengganti ketiganya dengan nilai lebih pekat ditambah garis tipis 1px untuk menjaga tepi
kartu tetap terbaca di kanvas nyaris hitam. Kedalaman tidak pernah dipakai sebagai hiasan.

## Shapes

| Token | Nilai | Peran |
|---|---|---|
| `--radius-chip` | 999px | Lencana, pil status, chip pilihan, dan tombol aksi utama. |
| `--radius-control` | 14px | Isian, tombol sekunder, kendali ikon, kotak ikon baris, dan tab bersarang di dalam strip. |
| `--radius-panel` | 24px | Kartu dan panel. |
| `--radius-sheet` | 28px | Lembar dan dialog yang mengambang. |

Empat radius dengan empat peran; tidak ada radius kelima, dan tidak ada nilai radius literal di dalam
komponen (tanpa `rounded-[9px]`). Batas dan pemisah memakai garis rambut 1px `--hairline`; tidak ada
`border-left` atau `border-right` berwarna di atas 1px. Ikon digambar sendiri dengan goresan 1.75px
supaya setara dengan berat Schibsted Grotesk.

## Motion

Gerak dipakai untuk memberi umpan balik dan menjaga kesinambungan ruang, bukan untuk menghibur.
Semua angka di bawah ini berasal dari kode dan bisa ditelusuri lewat `duration-150`, `.sheet-enter`,
dan `.press` di `app/web/src`.

| Kejadian | Nilai | Alasan |
|---|---|---|
| Perubahan warna, keadaan, dan posisi kendali | 150ms (`duration-150`) | Cukup lama untuk terlihat, cukup singkat untuk terasa langsung. |
| Kartu yang mengangkat saat hover | 150ms `ease-out` pada `transform` dan `box-shadow` | Kartunya sendiri sebuah tautan, jadi angkatnya adalah janji klik. |
| Tombol ditekan | `translateY(1px)` | Umpan balik fisik satu piksel, bukan penskalaan yang mengubah tata letak. |
| Lembar dan panel muncul | 200ms `cubic-bezier(0.2, 0.8, 0.3, 1)` pada `transform` dan `opacity` | Satu-satunya gerak masuk yang lebih lambat dari 150ms, karena lembar mengubah ruang layar. |
| Kerangka baris saat memuat | `animate-pulse` | Menjelaskan bahwa tempatnya akan terisi, tanpa memutar apa pun di tengah layar. |
| Tombol yang sedang menyimpan | `animate-spin` pada lingkaran 16px di dalam tombol | Keadaan sibuk terlihat di tempat aksinya dan lebar tombol tidak berubah. |
| Isian bilah progres | Warna 150ms; lebarnya berubah tanpa animasi | Persentase sudah tertulis di ujung kanan; menggeser isian menambah gerak tanpa menambah informasi. |

`prefers-reduced-motion: reduce` memaksa seluruh durasi animasi dan transisi menjadi 0.01ms
(`!important`), jadi tidak ada gerak yang tersisa. Tidak ada scroll-reveal, parallax, bouncing, atau
animasi tata letak.

## Components

Perilaku tiap komponen yang berulang di seluruh layar. Semua komponen hidup di
`app/web/src/components/`.

| Komponen | Aturan |
|---|---|
| `Card` + `CardHead` | Kartu dengan judul 20px semibold dan aksi di kanan. Satu tingkat saja: kelompok di dalam kartu memakai `row-divide` atau `head-band`, bukan kartu lain. |
| `LedgerRow` / `RowTitle` | Baris daftar tinggi 60px: kotak ikon, judul, baris meta kecil, lalu nominal di tepi kanan. Dipakai di Beranda, Transaksi, Rencana, dan Profil supaya semua daftar berirama sama. |
| `Money` | Satu-satunya jalan menampilkan nominal. Monospace, rata kanan, kolom tanda selalu ada dengan lebar terkunci (`1ch`): kosong saat netral, `+`/`−` saat ada arah. Menghormati "sembunyikan nominal" dengan mengganti angka menjadi titik, bukan menghilangkan barisnya. |
| `MoneyStat` | Label kecil di atas satu angka besar untuk ringkasan berdampingan. Angka di dalamnya selalu `Money`. |
| `Button` | Utama = pil penuh berwarna aksen, teks aksen-fg, tanpa glow. Sekunder = kendali bergaris 14px. Boleh `block` selebar wadah, dan `loading` menampilkan keadaan sibuk tanpa mengubah lebar. Tinggi minimal 44px; kaki sembilan lembar formulir dan lembar entri cepat memakai 52px supaya pasangan tombolnya rata, sedangkan kaki lembar saringan, detail transaksi, arsip tujuan, dan dialog konfirmasi tetap 44px; aksi yang melekat pada satu baris daftar di dalam lembar (mis. konfirmasi kejadian berulang) duduk di tepi konten lembar, bukan menjorok di bawah kolom teks, dan ikut memakai 52px. |
| `IconButton` | Kendali ikon 44x44px dengan `aria-label` wajib. |
| `Field` + `TextInput` + `Textarea` | Label di atas isian, petunjuk di bawahnya, galat menggantikan petunjuk dengan `role="alert"`. Semua isian 16px agar iOS tidak mengezoom. |
| `AmountInput` + papan angka | Papan angka di dalam lembar entri cepat: tiga kolom, tombol setinggi 48px, berisi angka, `000`, dan hapus satu angka. Isian teks tetap bekerja untuk biaya dan isian lain. Batas Rp999.999.999.999 ditegakkan di papan. |
| `Chip` | Pilihan berbentuk pil setinggi 44px dengan `aria-pressed`. Terpilih = tepi aksen + tint aksen. Chip dipakai untuk jenis, dompet, kategori, tanggal, dan saringan. |
| `Tabs` + `TabPanel` | Strip pil dengan penanda pilihan berpindah di dalam wadah sumur, atau tab garis bawah bila berada di dalam kartu. `TabPanel` memberi `role="tabpanel"` yang benar dan hanya dirender saat tabnya aktif, supaya tab yang belum dibuka tidak memanggil API. |
| `ProgressBar` | Trek sumur setinggi 12px dengan isian berwarna semantik. Persentase selalu ditulis di ujung kanan di luar isian, karena teks putih di atas aksen gelap gagal AA dan angka di dalam isian sempit menjadi tebakan. Membawa `role="progressbar"` dengan nilai dan teks. |
| `StatusPill` / `DeltaPill` | Lencana status berisi kata ("Mendekati batas", "Lewat batas", "Lunas", "Belum dibaca") dan selisih bernilai. Tidak pernah warna saja. |
| `DisclosureRow` | Baris yang membuka daftar penyusun di bawahnya. Membawa `aria-expanded` dan `aria-controls`; isinya tidak dimuat sebelum dibuka, sehingga tidak ada permintaan API yang tidak diminta pengguna. |
| `SearchField` | Pencarian dengan ikon di kiri dan tombol bersihkan 44px berlabel. Dipakai di dalam baris `.pin-under-head`. |
| `Sheet` + `ConfirmDialog` | Lembar bawah dengan pegangan, `overscroll-contain`, safe-area, dan badan `min-h-0` yang menggulir. Escape menutup dan fokus kembali ke pemicu. Dialog konfirmasi hanya untuk tindakan merusak. |
| `EmptyState` / `LoadingRows` / `ErrorState` | Tiga keadaan wajib selain berisi: kosong menyebut sebab dan satu tindakan, memuat memakai kerangka baris, galat menyebut yang gagal dan menyediakan tombol coba lagi. Tidak ada pemutar di tengah. |
| Grafik (`charts.tsx`) | SVG yang digambar sendiri: garis arus kas dan cincin. Bilah kategori tidak dipakai; kategori tampil sebagai daftar di samping cincinnya. Nilai persis selalu tersedia sebagai teks di dekat grafiknya, setiap grafik punya `aria-label`, dan tidak ada pustaka grafik pihak ketiga. |

## Do's and Don'ts

**Do**

- Format semua nominal lewat `lib/format.ts` (`formatIDR`, `formatSigned`, `moneySign`), isi kolom tanda
  lewat `SignMark` (`components/ui.tsx`), dan kirim nominal ke API sebagai string desimal; uang adalah bilangan bulat rupiah (AGENTS.md aturan 1, D-02).
- Beri setiap nominal kolom tanda, dan biarkan garis pemisah berhenti sebelum kolom itu.
- Tulis persentase progres di luar isian bilah.
- Hormati safe-area di kepala, bilah bawah, dan kaki lembar; pakai `min-h-dvh`, bukan `100vh`.
- Jaga target sentuh minimal 44x44px, isian minimal 16px, `focus-visible` selalu terlihat, dan
  `prefers-reduced-motion` mematikan seluruh durasi.
- Sediakan keempat keadaan (memuat, kosong, galat, berisi) di setiap tampilan data.
- Pakai kata dari `TYPE_LABEL`, `STATUS_LABEL`, dan `WALLET_TYPE_LABEL` supaya istilah tidak bercabang.
- Tulis teks antarmuka dalam bahasa Indonesia, konkret, menyebut tindakan berikutnya.

**Don't**

- Tidak ada em dash, tanda seru, emoji, atau kata pemanis ("seamless", "revolusioner", "solusi",
  "canggih"). Tombol menyebut aksinya: "Simpan transaksi", "Catat cicilan", "Alokasikan dana".
- Tidak ada gradien, glow, `backdrop-filter`, atau pola latar. Arah canon dicapai lewat hierarki,
  jarak, dan angka (R-01, R-07, R-10, R-13).
- Tidak ada kartu bersarang, dan tidak ada label kecil gaya kicker di atas judul.
- Tidak ada nilai jarak, radius, atau bayangan di luar token yang tertulis di atas (`rounded-[9px]`,
  `shadow-[…]`). Semua lewat token.
- Tidak ada monospace untuk judul, label, atau paragraf.
- Tidak ada makna yang disampaikan warna saja; selalu ada kata atau tanda.
- Tidak ada angka finansial yang dikarang: nilai yang tidak pasti ditandai, bukan ditebak.
- Tidak ada ilustrasi, testimoni, statistik pengguna, atau klaim keamanan yang belum diverifikasi
  (R-17, R-18, R-22, R-23, R-36).
