# PRD Aplikasi Keuangan Pribadi

*Product Requirements Document*

Versi 1.0 • 21 September 2026 • Draf untuk desain dan pengembangan

Kita akan membangun aplikasi keuangan pribadi yang mudah diakses melalui HP dan desktop. Pengguna dapat mencatat pendapatan, pengeluaran, utang, piutang, dan tujuan tabungan dalam satu tempat, lalu melihat saldo serta laporan yang konsisten.

Keputusan produk yang diusulkan adalah web responsif dengan dukungan Progressive Web App atau PWA. Rilis awal memprioritaskan input manual yang cepat, penyimpanan terpusat, dan perhitungan yang dapat ditelusuri. Seluruh target dan pilihan implementasi di dokumen ini merupakan usulan, bukan hasil riset pengguna atau komitmen jadwal.

### Kebutuhan yang menjadi dasar

- Akses mudah dari mobile dengan tampilan yang sederhana dan nyaman digunakan.
- Input pendapatan, pengeluaran, utang, dan goals yang cepat serta tidak membingungkan.
- Database lengkap, riwayat yang tersimpan, serta fitur perencanaan dan pemantauan keuangan.

### Asumsi kerja

| Aspek | Keputusan awal |
| --- | --- |
| Penggunaan | Keuangan pribadi; satu pemilik per ruang keuangan pada rilis awal. |
| Bahasa dan mata uang | Bahasa Indonesia dan IDR. Zona waktu dipilih saat onboarding. |
| Akses | Browser mobile dan desktop; opsi home screen jika perangkat mendukung. |
| Sumber data | Input manual. Integrasi rekening dan pembacaan struk masuk pengembangan lanjutan. |
| Pembaca PRD | Pemilik produk, desainer, developer, dan penguji kualitas. |

### Cara menggunakan dokumen

Bagian 01–03 menjelaskan pengguna, cakupan, dan navigasi. Bagian 04–09 menetapkan kebutuhan fitur. Bagian 10–13 mengatur perhitungan dan database. Bagian 14–16 memuat kualitas layanan, skenario penerimaan, dan rencana rilis. ID FR dipakai untuk kebutuhan fitur, NFR untuk kualitas, dan AT untuk pengujian.

## 01  Pengguna dan hasil yang dituju

### Masalah yang ingin diselesaikan

Catatan yang tersebar membuat pengguna sulit mengetahui uang yang tersedia, pengeluaran terbesar, dan kewajiban yang segera jatuh tempo. Form yang panjang membuat pencatatan tertunda. Produk harus mempermudah kebiasaan mencatat sekaligus menjaga keakuratan saldo saat pengguna melakukan transfer, mencicil utang, atau menabung untuk sebuah tujuan.

| Pengguna awal | Kebutuhan utama | Hasil yang diharapkan |
| --- | --- | --- |
| Penerima pendapatan rutin | Mencatat gaji, pengeluaran harian, dan tagihan. | Mengetahui sisa anggaran bulan berjalan. |
| Pekerja dengan pendapatan berubah | Memisahkan sumber pendapatan serta memantau arus kas. | Melihat pola pemasukan tanpa target gaji tetap. |
| Pengguna dengan utang dan goals | Melacak cicilan, piutang, dan dana tujuan. | Mengetahui kewajiban serta progres tujuan. |

### Pekerjaan utama pengguna

- Setelah membayar sesuatu, saya ingin mencatatnya dalam beberapa detik agar tidak lupa.
- Sebelum berbelanja, saya ingin melihat saldo dompet dan sisa anggaran agar dapat mengambil keputusan sendiri.
- Setelah membayar cicilan, saya ingin sisa utang dan saldo dompet langsung berubah dengan benar.
- Saat menyisihkan uang, saya ingin melihat progres tujuan tanpa mencatatnya sebagai konsumsi.

### Target keberhasilan yang akan divalidasi

| Metrik | Target awal | Cara mengukur |
| --- | --- | --- |
| Input cepat | Median ≤ 15 detik; p90 ≤ 30 detik. | Dari buka form hingga simpan, untuk transaksi harian tanpa lampiran. |
| Aktivasi | ≥ 80% peserta uji berhasil tanpa bantuan. | Membuat dompet dan transaksi pertama; uji 8–12 pengguna sebelum beta. |
| Konsistensi hitungan | 100% skenario finansial wajib lulus. | Saldo ledger, utang, goals, dan laporan cocok dengan hasil yang ditetapkan. |
| Kebiasaan mencatat | Target eksplorasi ≥ 50% pengguna aktif awal kembali di minggu keempat. | Kohor pengguna yang telah mencatat transaksi, bukan seluruh pendaftar. |

Target penggunaan adalah hipotesis produk. Tim meninjaunya setelah beta; nominal transaksi, nama pihak, dan catatan pribadi tidak boleh masuk data analitik penggunaan.

## 02  Cakupan dan prioritas rilis

P0 wajib tersedia sebelum rilis awal. P1 melengkapi penggunaan rutin setelah kualitas P0 teruji. P2 adalah kandidat pengembangan yang memerlukan validasi manfaat dan kelayakan. Prioritas mengatur urutan pengerjaan, bukan mengurangi visi fitur lengkap.

| Area | P0 Rilis awal | P1 dan P2 |
| --- | --- | --- |
| Akses dan akun | Login, pemulihan akun, ruang pribadi, sinkronisasi online. | P1 akses pasangan atau keluarga dengan peran. |
| Dompet | Kas, bank, e-wallet, saldo awal, arsip, rekonsiliasi. | P1 rekening kartu kredit sebagai kewajiban. |
| Transaksi | Pendapatan, pengeluaran, transfer, refund, koreksi, pencarian. | P1 kategori terpisah dalam satu transaksi, lampiran, tag, favorit. |
| Utang dan piutang | Pencatatan, saldo lama, cicilan parsial, pokok dan biaya, pengingat. | P1 jadwal cicilan rinci dan riwayat perubahan kesepakatan. |
| Goals | Target nominal dan tanggal, alokasi dana, penarikan alokasi. | P1 proyeksi setoran, tujuan bersama. |
| Anggaran | Limit bulanan per kategori, progres, ambang peringatan. | P1 rollover dan periode anggaran khusus. |
| Pengulangan | Pengingat berkala dan konfirmasi transaksi manual. | P1 pencatatan otomatis dengan persetujuan per aturan. |
| Laporan | Ringkasan periode, kategori, saldo, utang, goals, ekspor CSV. | P1 impor CSV, tren lanjutan, laporan siap cetak. |
| Koneksi terputus | Draf lokal dan status yang jelas; simpan ke server saat online. | P1 antrean offline dan penanganan konflik penuh. |
| Keamanan data | Isolasi data, audit perubahan, backup, ekspor dan penghapusan akun. | P1 pengaturan keamanan perangkat tambahan. |
| Otomasi eksternal | Belum masuk rilis awal. | P2 OCR struk, input suara, integrasi bank, integrasi pesan. |
| Cakupan lanjutan | Satu mata uang dan satu pemilik. | P2 multi mata uang, valuasi aset dan analitik investasi. |

### Batas produk

Produk mencatat dan merangkum keuangan. Rilis awal tidak melakukan pembayaran, menyalurkan pinjaman, menyimpan kredensial bank, menghitung pajak, atau memberikan rekomendasi investasi. Akuntansi bisnis, payroll, dan pengelolaan stok berada di luar cakupan PRD ini.

Nama produk, model bisnis, jumlah pengguna, dan penyedia infrastruktur belum ditetapkan. Pembangunan dimulai dari ruang pribadi; rancangan data menyisakan jalur untuk penggunaan bersama.

## 03  Navigasi dan pengalaman mobile

### Struktur layar

| Navigasi utama | Isi utama | Aksi penting |
| --- | --- | --- |
| Beranda | Saldo, ringkasan bulan, utang jatuh tempo, progres goals. | Tombol Tambah tetap terlihat dan akses cepat ke dompet. |
| Transaksi | Riwayat, pencarian, filter, detail. | Tambah, duplikasi, koreksi, dan batalkan transaksi. |
| Rencana | Anggaran, Goals, serta Utang dan Piutang sebagai tab. | Buat rencana, alokasi dana, catat cicilan. |
| Laporan | Ringkasan dan rincian periode. | Ubah rentang tanggal dan ekspor. |
| Profil | Dompet, kategori, preferensi, keamanan, pengelolaan data. | Atur dompet, unduh data, kelola sesi. |

Pada HP, gunakan empat tab utama Beranda, Transaksi, Rencana, dan Laporan. Profil dibuka melalui ikon di bagian atas. Tombol Tambah membuka form pendapatan atau pengeluaran; menu lainnya menampilkan transfer, pembayaran utang, dan alokasi goals. Desktop memakai struktur informasi yang sama.

### Urutan informasi Beranda

Tampilkan saldo dompet terlebih dahulu, lalu pendapatan dan pengeluaran bulan ini. Di bawahnya tampilkan sisa anggaran, kewajiban tujuh hari ke depan, dan progres goals. Pengguna dapat menyembunyikan nominal. Kekayaan bersih ditampilkan sebagai angka terpisah dengan penjelasan komponen.

### Alur utama

- Pengguna baru: daftar → pilih zona waktu → buat dompet dan saldo awal → catat transaksi pertama → lihat Beranda. Pembuatan utang, anggaran, dan goals dapat dilakukan belakangan.
- Pengeluaran cepat: Tambah → nominal → kategori → periksa dompet → Simpan. Tanggal hari ini dan dompet terakhir terisi otomatis serta selalu terlihat.
- Cicilan: Rencana → Utang → pilih utang → Bayar cicilan → isi pokok, bunga atau biaya, dan dompet → tinjau ringkasan → Simpan.
- Goals: Rencana → Goals → buat target → Alokasikan dana → pilih dompet dan nominal → lihat progres.

### Standar tampilan

Nominal mendapat fokus pertama dengan keyboard angka. Tombol utama mudah dijangkau satu tangan, memiliki target sentuh minimal 44 × 44 CSS px, dan tidak tertutup keyboard. Form dasar hanya menampilkan isian wajib; detail tambahan dapat dibuka. Gunakan label dan ikon bersama warna agar makna tetap jelas bagi pengguna yang sulit membedakan warna.

Sediakan keadaan kosong dengan satu aksi berikutnya, indikator pemuatan, pesan validasi di dekat isian, dan tombol coba lagi tanpa menghapus input. Format uang menggunakan Rp dan pemisah ribuan; contoh input Rp25.000 tidak boleh terbaca sebagai Rp25.

## 04  Akun dompet dan ringkasan

### FR01  Akun dan ruang pribadi

P0 • Pengguna dapat mendaftar, masuk, keluar, memulihkan akses, dan mengakhiri sesi perangkat lain. Verifikasi kepemilikan akun dilakukan sebelum ekspor sensitif atau penghapusan. Satu ruang pribadi dibuat otomatis.

**Kriteria penerimaan:** pengguna hanya dapat membaca dan mengubah data ruang miliknya melalui UI maupun API. Sesi kedaluwarsa meminta login ulang dan mempertahankan draf pada perangkat tepercaya.

### FR02  Pengaturan dompet

P0 • Buat dompet kas, bank, atau e-wallet dengan nama, jenis, mata uang IDR, saldo awal, dan tanggal mulai. Nama rekening dan nomor rekening lengkap tidak wajib. Arsipkan dompet yang sudah digunakan; penghapusan permanen hanya tersedia jika belum memiliki histori.

**Kriteria penerimaan:** saldo awal dicatat sebagai jurnal pembukaan dan tidak menambah pendapatan; saldo awal nol tidak memerlukan jurnal. Dompet arsip tetap masuk laporan historis serta total aset, tetapi tidak menjadi pilihan transaksi baru.

### FR03  Saldo dan rekonsiliasi

P0 • Saldo dihitung dari seluruh jurnal yang telah dibukukan hingga waktu yang dipilih. Pengguna dapat membandingkan saldo catatan dengan saldo aktual. Selisih hanya disimpan setelah ditinjau, disertai alasan dan jurnal penyesuaian.

**Kriteria penerimaan:** penyesuaian tidak menimpa histori dan tidak dianggap pendapatan atau konsumsi. Saldo negatif boleh tercatat dengan peringatan karena catatan sebelumnya dapat belum lengkap.

### FR04  Ringkasan keuangan

P0 • Beranda menampilkan total saldo dompet, arus kas periode, anggaran, kewajiban mendatang, dan progres tujuan. Setiap kartu membuka rincian transaksi penyusunnya. Piutang dan utang dipisahkan dari saldo uang yang dapat dipakai.

**Kriteria penerimaan:** rentang tanggal dan zona waktu tampak jelas. Mengubah atau membatalkan transaksi memperbarui seluruh ringkasan terkait setelah server mengonfirmasi perubahan.

### Batas perhitungan saldo

Saldo uang = jumlah saldo dompet aset, termasuk dompet yang diarsipkan dan masih bersaldo. Kekayaan bersih tercatat = saldo uang + pokok piutang tersisa − pokok utang tersisa. Angka ini hanya mencakup aset dan kewajiban yang dicatat; bukan estimasi seluruh kekayaan pengguna.

Dana goals tetap merupakan bagian dari saldo dompet. Kartu “Dana belum dialokasikan” hanya mengurangi alokasi goals aktif; angka tersebut tidak menjamin cukup untuk tagihan mendatang. Label dan penjelasan harus mencegah pengguna menganggapnya sebagai rekomendasi belanja.

## 05  Input dan pengelolaan transaksi

| Isian | Aturan P0 |
| --- | --- |
| Jenis dan nominal | Jenis wajib. Nominal bilangan bulat Rupiah > 0; nilai nol dan angka negatif ditolak. |
| Dompet dan kategori | Wajib untuk pendapatan atau pengeluaran; dompet terakhir dan kategori terbaru mempermudah pemilihan. |
| Tanggal dan catatan | Tanggal wajib dengan default hari ini. Catatan opsional. Tanggal masa depan menjadi rencana, belum mengubah saldo. |
| Transfer | Dompet asal dan tujuan harus berbeda. Biaya opsional dipisahkan sebagai pengeluaran. |
| Detail tambahan | P1 lampiran bukti, tag, merchant, transaksi favorit, dan pembagian kategori. |

### FR05  Pendapatan dan pengeluaran

P0 • Simpan transaksi dari form ringkas. Pengguna dapat membuat kategori sendiri; kategori yang pernah digunakan diarsipkan, bukan dihapus. Server memvalidasi nominal, kepemilikan dompet, serta kesesuaian jenis kategori.

**Kriteria penerimaan:** satu simpan yang sukses membuat satu peristiwa keuangan. Menekan Simpan berulang atau mengulang request yang sama tidak menciptakan duplikasi.

### FR06  Transfer dan pengembalian dana

P0 • Transfer menghasilkan perpindahan nilai antar dompet dalam satu proses. Refund mengacu ke pengeluaran asal, boleh parsial, dan mengurangi pengeluaran kategori tersebut pada tanggal refund.

**Kriteria penerimaan:** transfer tidak menaikkan pendapatan atau konsumsi; hanya biayanya menambah pengeluaran. Akumulasi refund tidak boleh melebihi nilai pengeluaran asal yang masih berlaku.

### FR07  Histori dan koreksi

P0 • Cari berdasarkan catatan dan filter menurut periode, jenis, dompet, kategori, serta nominal. Detail menunjukkan histori koreksi. Ubah atau Hapus pada transaksi posted diterjemahkan menjadi pembalikan jurnal dan, untuk perubahan, pencatatan pengganti.

**Kriteria penerimaan:** saldo dan laporan dapat dibangun ulang dari histori. Pembatalan meminta ringkasan dampak; transaksi dengan refund atau pembayaran terkait tidak boleh dibatalkan sebelum dependensinya diselesaikan.

### FR08  Input tambahan

P1 • Favorit atau duplikasi mengisi ulang form sebagai draf. Pembagian kategori mensyaratkan total rincian sama dengan total transaksi. Lampiran gambar atau PDF bersifat privat dan tidak wajib untuk menyimpan transaksi.

**Kriteria penerimaan:** duplikasi tidak langsung mencatat pengeluaran. Lampiran gagal tidak membatalkan transaksi dan dapat diunggah ulang.

## 06  Utang piutang dan cicilan

### FR09  Membuat utang dan piutang

P0 • Simpan arah kewajiban, nama pihak, nilai pokok, tanggal mulai, jatuh tempo opsional, dan catatan. Pilih “Dana diterima atau diberikan sekarang” beserta dompet, atau “Saldo lama” dengan sisa pokok pada tanggal mulai pencatatan.

**Kriteria penerimaan:** utang baru menaikkan kas dan kewajiban; piutang baru menurunkan kas dan menaikkan aset piutang. Saldo lama tidak menciptakan arus kas baru. Kontak pihak lain tidak wajib dan tidak otomatis menerima pesan.

### FR10  Pembayaran sebagian atau penuh

P0 • Pembayaran utang dan penerimaan piutang menghubungkan satu transaksi dengan satu catatan kewajiban. Form memisahkan pokok, bunga, dan biaya aktual. Jumlah kas sama dengan total komponen. Pokok mengurangi saldo kewajiban atau piutang, sedangkan bunga dan biaya diklasifikasikan terpisah.

**Kriteria penerimaan:** pokok yang dibayar tidak melebihi sisa pokok. Saat sisa pokok nol, status menjadi lunas. Pembatalan pembayaran mengembalikan sisa pokok dan saldo dompet secara atomik.

### FR11  Jatuh tempo dan pengingat

P0 • Tampilkan status aktif, lunas, dan lewat jatuh tempo. Jika tanggal belum diketahui, gunakan label “Belum ada jatuh tempo”. Pengingat dalam aplikasi muncul pada H−7, H−1, dan hari jatuh tempo; pengguna dapat menonaktifkannya.

**Kriteria penerimaan:** hanya kewajiban dengan sisa pokok dan tanggal yang memenuhi syarat memicu pengingat. Pembayaran lunas menghentikan pengingat. Satu kejadian tidak menghasilkan notifikasi ganda.

### FR12  Jadwal cicilan lanjutan

P1 • Sediakan jadwal cicilan dengan nominal dan tanggal per termin, pembayaran lintas termin, serta pencatatan bunga atau biaya yang disepakati secara eksplisit. Kartu kredit menjadi akun kewajiban khusus dengan pembelian sebagai pengeluaran dan pembayaran tagihan sebagai pengurangan kewajiban.

**Kriteria penerimaan:** perubahan jadwal menyimpan versi lama dan tidak mengubah pembayaran yang sudah terjadi. Pembayaran tagihan kartu kredit tidak menghitung ulang konsumsi.

### Aturan untuk rilis awal

P0 menggunakan pokok tersisa dan bunga atau biaya yang dimasukkan saat pembayaran. Aplikasi belum menghitung bunga majemuk, denda otomatis, atau bunga yang masih harus dibayar. Detail utang menyebut “Sisa pokok” agar tidak disalahartikan sebagai seluruh kewajiban masa depan.

Piutang yang tidak tertagih tidak boleh ditandai sebagai sudah dibayar. Penutupan karena penghapusan saldo merupakan penyesuaian nonkas dengan alasan dan audit terpisah. Perlakuan serupa berlaku untuk penghapusan utang; keduanya tidak menciptakan kas masuk atau keluar.

## 07  Goals dan anggaran

### FR13  Tujuan keuangan

P0 • Buat tujuan dengan nama, target Rupiah, tanggal target opsional, dan prioritas. Alokasi dapat berasal dari beberapa dompet. Setiap penambahan atau penarikan alokasi memiliki tanggal dan catatan. Target awal harus lebih besar dari nol.

**Kriteria penerimaan:** progres = alokasi bersih aktif ÷ target. Mengubah target tidak mengubah kas. Dana yang sama tidak dapat dialokasikan ke dua tujuan sekaligus; kelebihan di atas target boleh disimpan dengan label yang jelas.

### FR14  Alokasi dan penggunaan dana goals

P0 • Alokasi menandai sebagian saldo dompet untuk tujuan, tanpa menggerakkan uang. Opsi “Pindahkan uang sekaligus” melakukan transfer ke dompet tujuan lalu alokasi dalam satu proses. Belanja dari goals mengurangi alokasi dan mencatat pengeluaran sebenarnya.

**Kriteria penerimaan:** saldo tidak turun hanya karena alokasi. Total alokasi aktif per dompet tidak melebihi saldo positif dompet saat dialokasikan. Penarikan alokasi hanya melepaskan dana dan tidak menciptakan pendapatan.

### FR15  Anggaran per kategori

P0 • Tetapkan batas bulanan untuk kategori pengeluaran, tampilkan terpakai dan tersisa, serta peringatan pada 80% dan 100%. Periode menggunakan bulan kalender di zona waktu pengguna. Pengeluaran tetap boleh dicatat setelah limit terlampaui.

**Kriteria penerimaan:** pengeluaran bersih setelah refund mengonsumsi anggaran; transfer, pokok utang, dan alokasi goals tidak mengonsumsinya. Perubahan limit langsung tercermin dan terekam di histori.

### FR16  Perencanaan lanjutan

P1 • Proyeksi setoran menggunakan kekurangan target dibagi jumlah periode tersisa. Tampilkan input dan asumsi; pengguna bebas menyesuaikan. Rollover anggaran, siklus berdasarkan tanggal gajian, dan tujuan bersama tersedia setelah aturan dasarnya teruji.

**Kriteria penerimaan:** tanggal target yang lewat menghasilkan ajakan mengubah rencana tanpa proyeksi negatif atau pembagian nol.

### Saat pengeluaran mengurangi dana yang telah dialokasikan

Apabila transaksi baru membuat alokasi lebih besar daripada saldo dompet, simpan transaksi sebenarnya dan beri status “Dana tujuan kurang”. Progres tetap memperlihatkan alokasi tercatat dengan peringatan kekurangan; pengguna dapat memindahkan sumber dana atau mengurangi alokasi. Aplikasi tidak diam-diam mengubah tujuan atau menolak pencatatan kejadian nyata.

Goals memiliki status aktif, tercapai, dan diarsipkan. Progres yang mencapai target memberi tanda tercapai, tetapi penyelesaian tujuan tetap memerlukan aksi pengguna. Arsip dengan alokasi tersisa harus menawarkan pemindahan atau pelepasan alokasi terlebih dahulu.

## 08  Tagihan laporan dan portabilitas data

### FR17  Rencana transaksi berulang

P0 • Buat rencana harian, mingguan, atau bulanan untuk pendapatan, tagihan, dan transfer. P0 membuat pengingat serta form yang telah terisi; transaksi dibukukan setelah pengguna menekan Konfirmasi. Rencana dapat dijeda atau dihentikan.

**Kriteria penerimaan:** tanggal 29–31 yang tidak tersedia jatuh pada hari terakhir bulan tersebut tanpa menggeser tanggal acuan bulan berikutnya. Melewati satu kejadian tidak menghapus aturan pengulangan.

### FR18  Laporan dan rincian

P0 • Tampilkan pendapatan dan pengeluaran bersih, komposisi kategori, arus kas dompet, kekayaan bersih tercatat, daftar utang, serta goals. Tersedia rentang harian, bulanan, tahunan, dan tanggal khusus. Grafik selalu memiliki nilai atau tabel pendamping.

**Kriteria penerimaan:** total setiap ringkasan sama dengan rincian untuk filter yang sama. Perbandingan periode menjelaskan tanggal pembanding; periode dengan nilai nol tidak menghasilkan persentase tak terhingga.

### FR19  Ekspor dan pengelolaan data

P0 • Ekspor CSV UTF-8 memuat ID transaksi, tanggal, jenis, dompet, kategori, nominal, status, dan referensi utang atau goal. Ekspor penuh menyediakan data relasional berversi yang dapat dipulihkan. Pemulihan P0 dilakukan melalui prosedur operasional yang teruji, belum melalui UI.

**Kriteria penerimaan:** ekspor menggunakan snapshot konsisten, tidak menyertakan kredensial, dan menetralkan formula berbahaya pada kolom teks CSV. Penghapusan akun mencakup data terkait sesuai jangka waktu pada NFR07.

### FR20  Impor riwayat

P1 • Impor CSV melalui pemetaan kolom, pratinjau, validasi tanggal dan Rupiah, serta deteksi duplikat. Pengguna meninjau kandidat duplikat. Setiap baris memiliki hasil tersimpan atau ditolak, dan seluruh batch dapat dibatalkan melalui pembalikan jurnal.

**Kriteria penerimaan:** menjalankan ulang batch yang sama tidak menggandakan transaksi. Baris tidak valid tidak mengubah saldo. Transfer harus dipetakan sebagai transfer agar tidak dihitung sebagai pendapatan atau konsumsi.

### FR21  Otomasi lanjutan

P1 untuk pengulangan otomatis dan kanal tambahan; P2 untuk ekstraksi dan integrasi • Pencatatan otomatis transaksi berulang, push atau email opsional, pembacaan struk, input suara, dan integrasi rekening dikembangkan setelah kontrol duplikasi dan persetujuan jelas. Semua hasil ekstraksi menjadi draf yang dapat diperiksa.

**Kriteria penerimaan:** pengguna dapat membedakan data manual, impor, dan otomatis serta menghentikan integrasi. Pencatatan otomatis tidak boleh mengulangi kejadian yang sudah dikonfirmasi manual.

## 09  Koneksi sinkronisasi dan kesalahan

### FR22  Draf saat koneksi terputus

P0 • Pertahankan form belum terkirim di penyimpanan lokal perangkat tepercaya. Tampilkan “Draf di perangkat ini” atau “Belum tersinkron”. Draf belum memengaruhi saldo, utang, anggaran, atau goals. Pengguna meninjau dan mengirim draf saat aplikasi terbuka dan kembali online.

**Kriteria penerimaan:** aplikasi tidak menampilkan “Tersimpan” sebelum server mengonfirmasi. Muat ulang pada perangkat yang sama memulihkan draf. Pengguna diberi tahu sebelum logout menghapus draf lokal yang belum dikirim.

### FR23  Perubahan dari beberapa perangkat

P0 • Server menjadi sumber data utama. Setiap mutasi menggunakan kunci idempotensi dan nomor versi record. Permintaan ulang mengembalikan hasil yang sama; pengeditan record versi lama menampilkan konflik untuk ditinjau.

**Kriteria penerimaan:** dua pembayaran bersamaan tidak dapat menurunkan sisa pokok di bawah nol. Dua perangkat yang mengedit transaksi yang sama tidak saling menimpa tanpa pemberitahuan.

### FR24  Sinkronisasi offline lanjutan

P1 • Tambahkan antrean lokal tahan muat ulang, ID sementara, pemetaan ID server, dan urutan operasi yang bergantung satu sama lain. Pengguna melihat item menunggu, berhasil, konflik, atau gagal permanen. Retry menggunakan kunci yang sama.

**Kriteria penerimaan:** satu transaksi menjadi tepat satu hasil bisnis setelah reconnect. Perubahan dompet, utang, atau kategori yang sudah diarsipkan di perangkat lain memerlukan perbaikan, bukan retry tanpa batas.

| Keadaan | Perilaku yang terlihat |
| --- | --- |
| Belum ada data | Jelaskan manfaat layar dan tampilkan satu aksi membuat catatan pertama. |
| Sedang menyimpan | Nonaktifkan tombol ganda dan tampilkan status proses; form tetap ada. |
| Respons server tidak diketahui | Periksa status berdasarkan kunci idempotensi sebelum mengulang. |
| Sesi berakhir | Minta login ulang; draf tidak dikirim sebagai pengguna lain. |
| Konflik versi | Tampilkan versi server dan perubahan pengguna, lalu minta pilih atau revisi. |
| Validasi gagal | Sorot isian bermasalah dan pertahankan seluruh input yang masih valid. |
| Lampiran gagal | Transaksi tetap valid; tampilkan opsi unggah ulang atau hapus lampiran. |

P0 tidak menjanjikan seluruh aplikasi dapat dipakai offline. Saat data terakhir ditampilkan tanpa koneksi, waktu sinkronisasi terakhir terlihat. Saldo cache tidak dipresentasikan seolah sudah mencakup draf yang belum tersimpan.

## 10  Aturan perhitungan keuangan

Di balik antarmuka sederhana, gunakan jurnal berpasangan. Setiap peristiwa yang dibukukan harus memiliki total debit sama dengan total kredit. Pengguna tidak perlu memahami jurnal; lapisan ini menjaga transfer, pembayaran pokok, dan koreksi tetap konsisten.

| Kejadian | Dampak dompet | Dampak lain | Laporan konsumsi |
| --- | --- | --- | --- |
| Pendapatan Rp5.000.000 | Naik Rp5.000.000 | Pendapatan naik. | Pendapatan Rp5.000.000. |
| Belanja Rp100.000 | Turun Rp100.000 | Kategori belanja naik. | Pengeluaran Rp100.000. |
| Transfer Rp500.000 dan biaya Rp2.500 | Asal −Rp502.500; tujuan +Rp500.000. | Kas total turun hanya Rp2.500. | Pengeluaran Rp2.500. |
| Menerima pinjaman Rp1.000.000 | Naik Rp1.000.000 | Utang naik Rp1.000.000. | Bukan pendapatan. |
| Membayar pokok Rp200.000 dan bunga Rp10.000 | Turun Rp210.000 | Utang turun Rp200.000. | Pengeluaran Rp10.000. |
| Memberi piutang Rp300.000 | Turun Rp300.000 | Piutang naik Rp300.000. | Bukan konsumsi. |
| Menerima pelunasan pokok Rp100.000 | Naik Rp100.000 | Piutang turun Rp100.000. | Bukan pendapatan. |
| Alokasi goals Rp400.000 | Tidak berubah. | Alokasi tujuan naik. | Bukan pengeluaran. |
| Refund Rp40.000 | Naik Rp40.000 | Referensi belanja asal. | Pengeluaran bersih turun Rp40.000. |

### Definisi laporan

Pendapatan dan pengeluaran merangkum akun pendapatan serta beban berdasarkan tanggal efektif. Pokok pinjaman, pokok piutang, transfer, saldo awal, dan penyesuaian saldo tidak masuk konsumsi. Refund pada bulan berbeda mengurangi pengeluaran pada bulan refund; nilai kategori boleh menjadi negatif dengan penjelasan.

Arus kas menjelaskan perubahan saldo dompet melalui aktivitas konsumsi, pinjaman, piutang, biaya transfer, dan penyesuaian. Transfer internal saling menghapus pada tingkat seluruh dompet. Saldo akhir = saldo awal periode + seluruh perubahan saldo dalam periode. Alokasi goals tidak termasuk perubahan saldo.

### Tanggal dan koreksi

Simpan tanggal efektif sebagai tanggal lokal serta waktu pembuatan dalam UTC. Filter menggunakan batas tanggal efektif, bukan waktu request. Transaksi masa depan berstatus planned dan belum memiliki jurnal. Rencana dapat diedit atau dibatalkan tanpa pembalikan; saat waktunya tiba, pengguna mengonfirmasi untuk posting. Koreksi transaksi posted membalik jurnal pada tanggal efektif aslinya dan mencatat pengganti pada tanggal pilihan pengguna. Refund adalah kejadian baru pada tanggal penerimaan uang.

## 11  Rancangan database inti

Gunakan database relasional dengan transaksi atomik. Nama tabel dan kolom di bawah merupakan rancangan logis yang dapat diterjemahkan menjadi skema fisik saat desain teknis. Setiap entitas tenant memiliki workspace_id; seluruh relasi finansial harus berada dalam ruang yang sama.

| Entitas | Kolom utama | Relasi dan aturan |
| --- | --- | --- |
| users | id, identity_subject, email, display_name, created_at, status | Akun identitas; rahasia login dikelola layanan autentikasi. |
| workspaces | id, name, base_currency, timezone, owner_id | IDR untuk P0. Satu pemilik aktif. |
| memberships | id, workspace_id, user_id, role, status | Unik workspace + user. P0 hanya owner; role lain disiapkan untuk P1. |
| ledger_accounts | id, workspace_id, code, class, normal_side, currency, status | Class asset, liability, income, expense, equity. Kode unik per ruang. |
| wallets | id, workspace_id, ledger_account_id, name, type, opened_on, archived_at | Satu dompet aset ke satu akun ledger. Saldo turunan, bukan sumber kebenaran. |
| categories | id, workspace_id, ledger_account_id, name, kind, archived_at | Kategori income atau expense. P0 satu tingkat; tiap kategori memiliki akun ledger. |
| transactions | id, workspace_id, type, status, amount_minor, currency, effective_date, note, source, idempotency_key, version, created_by, created_at | Status planned, cancelled, posted, reversed. Referensi original_id, reversal_of, replacement_of; counterparty_id opsional untuk pihak atau merchant. |
| journal_lines | id, workspace_id, transaction_id, ledger_account_id, debit_minor, credit_minor | Nilai kedua sisi ≥ 0; tepat satu sisi > 0 per baris. Total debit sama dengan total kredit per transaksi. |
| transaction_splits | id, workspace_id, transaction_id, category_id, amount_minor | P1 rincian kategori. Total wajib sama dengan nilai konsumsi transaksi. |
| transaction_links | id, workspace_id, source_tx_id, target_tx_id, relation_type | Refund dan hubungan bisnis lain; sumber serta tujuan harus satu ruang. |

### Konvensi kolom

Gunakan UUID untuk identitas, created_at dan updated_at dalam UTC, serta version untuk objek yang dapat diubah. Nominal menggunakan integer 64 bit dalam unit Rupiah untuk IDR; API mengirim nilai nominal sebagai string desimal agar tidak bergantung pada presisi floating point. Batas input P0 yang diusulkan adalah Rp999.999.999.999 per peristiwa; penjumlahan wajib memeriksa overflow.

Transaksi yang sudah posted tidak dihapus secara fisik selama akun aktif. Jurnal pembalikan merupakan transaksi baru dengan tipe reversal dan hubungan ke transaksi awal. Penanda reversed pada transaksi asal bersifat metadata; saldo ledger tetap menghitung transaksi asal beserta pembalikannya agar nilainya saling meniadakan.

## 12  Rancangan database perencanaan

| Entitas | Kolom utama | Relasi dan aturan |
| --- | --- | --- |
| counterparties | id, workspace_id, name, contact_optional, archived_at | Pihak utang atau piutang. Kontak opsional dan privat. |
| debts | id, workspace_id, counterparty_id, ledger_account_id, direction, opening_mode, principal_minor, start_date, due_date, status, version | Direction payable atau receivable. Satu akun liability atau asset per catatan. Sisa pokok dihitung dari ledger. |
| debt_payments | id, workspace_id, debt_id, transaction_id, principal_minor, interest_minor, fee_minor, payment_date | Satu transaksi pembayaran ke satu debt. Referensi transaksi unik. Pembatalan mengikuti jurnal terkait. |
| installments | id, workspace_id, debt_id, due_date, principal_due, interest_due, fee_due | P1 termin cicilan. Status terbayar dihitung dari payment_allocations. |
| payment_allocations | id, workspace_id, payment_id, installment_id, component, amount_minor | P1 alokasi pembayaran lintas termin; total sama dengan komponen pembayaran. |
| goals | id, workspace_id, name, target_minor, target_date, priority, status, version | Target > 0. Progres berasal dari alokasi, bukan saldo yang diketik ulang. |
| goal_allocations | id, workspace_id, goal_id, wallet_id, direction, amount_minor, effective_date, linked_tx_id, reversed_by | Event allocate atau release. linked_tx_id wajib jika terkait transfer atau belanja. Tidak membuat jurnal sendiri. |
| budgets | id, workspace_id, category_id, period_start, period_end, limit_minor, version | Unik ruang + kategori + periode. P0 satu kategori per anggaran; tidak tumpang tindih. |
| recurring_rules | id, workspace_id, type, template, frequency, anchor_day, timezone, start_on, end_on, next_on, mode, status | Template tervalidasi. P0 mode reminder; P1 dapat auto_post dengan persetujuan. |
| recurring_occurrences | id, workspace_id, rule_id, scheduled_date, status, transaction_id | Unik rule + tanggal jadwal. Status pending, skipped, confirmed, failed. |

### Hubungan utama

Satu workspace memiliki banyak dompet, kategori, transaksi, utang, goals, dan anggaran. Satu transaksi memiliki sedikitnya dua journal_lines saat dibukukan. Debt memiliki banyak pembayaran; goal memiliki banyak alokasi dari beberapa dompet. Hubungan ke transaksi membuat pembatalan pembayaran dan penggunaan dana goals dapat dilacak.

Saldo pembukaan utang lama masuk sebagai jurnal antara akun utang atau piutang dan ekuitas pembukaan. Dana goals pada awal penggunaan tetap harus dialokasikan dari saldo dompet yang sudah dicatat, sehingga saldo awal tujuan tidak menambah aset.

## 13  Integritas data dan kontrak layanan

| Entitas pendukung | Isi yang disimpan |
| --- | --- |
| reminders dan notifications | Referensi objek, jadwal, kanal, status baca atau kirim, kunci deduplikasi, retry_count, last_error. |
| audit_logs | Pelaku, ruang, waktu, aksi, entitas, versi sebelum dan sesudah atau perubahan terstruktur. Tanpa token autentikasi. |
| idempotency_records | Ruang, pengguna, kunci request, hash payload, status, entity_id, respons tersanitasi. Unik ruang + kunci. |
| user_preferences | Zona waktu tampilan, dompet default, sembunyikan nominal, pengingat, preferensi perangkat tepercaya. |
| attachments | P1 transaction_id, storage_key, mime_type, byte_size, checksum, scan_status. Akses privat bertempo. |
| tags dan transaction_tags | P1 label pengguna dan relasi many to many ke transaksi. |
| transaction_templates | P1 nama favorit, tipe, template isian tervalidasi, dan urutan. Membuka template selalu membuat draf baru. |
| import_batches dan import_rows | P1 file hash, pemetaan, status; baris asal, row_hash, hasil validasi, transaction_id. |
| data_jobs dan deletion_requests | Jenis export, restore, delete; requester, status, waktu kedaluwarsa hasil, cakupan, audit eksekusi. |

### Kendala yang wajib ditegakkan

- Semua penulisan transaksi, journal_lines, pembayaran, dan alokasi terkait dilakukan dalam satu transaksi database. Bila satu langkah gagal, seluruh langkah dibatalkan.
- Foreign key tenant memakai pasangan workspace_id dan id, atau pemeriksaan ekuivalen di database. Izin diperiksa di server dan lapisan data; UUID sulit ditebak tidak menggantikan otorisasi.
- Sebelum posting, jumlah debit dan kredit harus sama. Tidak ada pembaruan langsung journal_lines yang sudah dibukukan. Constraint dan validasi servis saling melengkapi.
- Pembayaran, refund, serta alokasi memakai lock atau isolasi transaksi yang memadai. Dua operasi bersamaan tidak boleh melampaui sisa pokok, nilai refund, atau dana yang dapat dialokasikan.
- Indeks utama: workspace_id + effective_date + id pada transaksi; workspace_id + ledger_account_id + transaction_id pada jurnal; workspace_id + status + due_date pada utang; kunci unik untuk idempotensi dan kejadian berulang.

### Kontrak layanan utama

Layanan menyediakan createTransaction, reverseTransaction, transferFunds, recordDebtPayment, allocateGoal, releaseGoal, reconcileWallet, dan queryReport. Semua mutasi menerima idempotency_key; koreksi juga menerima expected_version. Respons sukses menyertakan ID server dan versi. Konflik memberi kode yang dapat ditangani UI, bukan menimpa data.

Hash payload berbeda dengan kunci idempotensi yang sama ditolak. Kunci posting yang sukses disimpan sepanjang umur data terkait. Respons gagal validasi tidak mengunci pengguna dari mengirim payload yang telah diperbaiki dengan kunci baru. Saldo cache serta ringkasan adalah turunan yang harus dapat dibangun ulang dari ledger.

## 14  Keamanan dan kualitas layanan

Angka berikut adalah target penerimaan untuk pengembangan dan beta. Estimasi biaya serta pilihan infrastruktur dibuat setelah ukuran pengguna dan kebijakan operasional disepakati.

| ID | Kebutuhan | Target dan cara verifikasi |
| --- | --- | --- |
| NFR01 | Akses mobile | Layout berfungsi pada lebar 360–1440 CSS px; uji Safari iOS dan Chrome Android pada versi yang didukung saat rilis. Tidak ada scroll horizontal pada alur utama. |
| NFR02 | Kecepatan | p95 respons simpan ≤ 1,5 detik dan laporan bulanan ≤ 2 detik di server, pada dataset 100.000 transaksi per ruang dan 50 pengguna aktif bersamaan. Uji buka Beranda ≤ 3 detik pada simulasi 4G yang disepakati. |
| NFR03 | Ketersediaan | Target 99,5% per bulan untuk layanan inti setelah beta. Pantau kegagalan simpan, antrean, dan notifikasi; tampilkan gangguan secara jelas. |
| NFR04 | Keamanan akses | Enkripsi saat transit dan tersimpan, pembatasan percobaan login, session expiry, pencabutan sesi, serta otorisasi setiap objek dan lampiran. Pengguna tidak melihat data ruang lain. |
| NFR05 | Pemulihan | Backup otomatis harian. Target kehilangan data maksimal 24 jam dan waktu pemulihan maksimal 8 jam. Uji restore sebelum rilis dan setiap tiga bulan dengan pembatasan akses yang sama. |
| NFR06 | Aksesibilitas | Kontras teks biasa ≥ 4,5 banding 1; ukuran teks utama 16 CSS px; zoom 200%; label pembaca layar; fokus keyboard; nominal tidak dibedakan hanya oleh warna. |
| NFR07 | Privasi dan penghapusan | Data keuangan tidak dimasukkan ke log analitik. Link ekspor kedaluwarsa maksimal 24 jam. Usulan penghapusan data aktif ≤ 7 hari dan peluruhan backup ≤ 30 hari; kebijakan ditampilkan sebelum pengguna menyetujui. |
| NFR08 | Observabilitas | Catat request_id, kode gagal, dan durasi tanpa token, catatan keuangan, atau identitas pihak lain. Alarm untuk ketidakseimbangan jurnal, posting gagal, dan job berhenti. |
| NFR09 | Lampiran P1 | JPEG, PNG, dan PDF maksimum 10 MB per file; validasi isi, pemindaian file, otorisasi unduh, dan pembersihan metadata lokasi jika relevan. |

### Rancangan sistem yang diusulkan

Antarmuka web responsif berkomunikasi dengan API terautentikasi. API menangani aturan bisnis dan menulis database relasional. Worker terpisah menjalankan pengingat, ekspor, impor, dan backup; penyimpanan privat menyimpan lampiran. Tidak ada kredensial server atau koneksi database langsung di perangkat pengguna.

Untuk P0, utamakan satu layanan aplikasi dengan modul yang terpisah secara jelas. Vendor, bahasa pemrograman, dan hosting dipilih dalam desain teknis berdasarkan kebutuhan tim. Pembagian menjadi banyak layanan belum menjadi kebutuhan produk.

## 15  Skenario penerimaan rilis awal

Semua nilai pada tabel ini merupakan data uji sintetis. Setiap skenario dimulai dari kondisi yang disebutkan. Pengujian otomatis difokuskan pada hitungan, akses data, dan konsistensi; uji pengguna memeriksa kemudahan alur di HP.

| ID | Skenario | Hasil wajib |
| --- | --- | --- |
| AT01 | Saldo awal bank Rp1.000.000; pendapatan Rp5.000.000; belanja Rp100.000. | Saldo bank Rp5.900.000; pendapatan Rp5.000.000; pengeluaran Rp100.000. Saldo awal tidak masuk pendapatan. |
| AT02 | Bank Rp1.000.000, e-wallet Rp0; transfer Rp500.000 dan biaya Rp2.500. | Bank Rp497.500, e-wallet Rp500.000, total kas Rp997.500; konsumsi hanya Rp2.500. |
| AT03 | Kas awal nol; terima utang Rp1.000.000 lalu bayar pokok Rp200.000 dan bunga Rp10.000. | Kas Rp790.000, sisa pokok Rp800.000, pendapatan nol, pengeluaran Rp10.000. |
| AT04 | Kas Rp1.000.000; beri piutang Rp300.000; terima pelunasan pokok Rp100.000. | Kas Rp800.000, piutang Rp200.000; tidak ada pendapatan atau konsumsi dari pokok. |
| AT05 | Dompet Rp1.000.000; alokasikan Rp400.000 ke goal Rp1.000.000. | Saldo tetap Rp1.000.000; alokasi Rp400.000; progres 40%; dana belum dialokasikan Rp600.000. |
| AT06 | Kondisi AT05; belanja dari goal Rp100.000. | Saldo Rp900.000; alokasi Rp300.000; progres 30%; pengeluaran bertambah Rp100.000. |
| AT07 | Belanja Rp100.000 lalu refund Rp40.000 pada bulan yang sama. | Pengeluaran bersih Rp60.000. Refund berikutnya > Rp60.000 ditolak. |
| AT08 | Utang Rp200.000; dua pembayaran pokok Rp150.000 tiba bersamaan. | Hanya satu berhasil. Sisa pokok Rp50.000; request kedua meminta revisi. |
| AT09 | Request transfer diulang setelah koneksi terputus. | ID transaksi sama; saldo berubah satu kali; tidak ada satu sisi transfer tanpa pasangannya. |
| AT10 | Batalkan pembayaran pokok Rp200.000 dan bunga Rp10.000. | Kas kembali Rp210.000; utang naik Rp200.000; bunga bersih kembali nol; audit tetap ada. |
| AT11 | Anggaran Rp500.000; belanja Rp450.000 lalu refund Rp100.000. | Terpakai Rp350.000 dan tersisa Rp150.000; peringatan 80% tidak tetap aktif. |
| AT12 | Utang lama Rp2.000.000 dicatat saat onboarding. | Kewajiban bertambah Rp2.000.000; kas dan pendapatan tidak berubah. |

Cakupan: AT01–02 menguji FR02–06; AT03–04, AT08, AT10, dan AT12 menguji FR09–10; AT05–06 menguji FR13–14; AT07 menguji FR06; AT09 menguji FR23; AT11 menguji FR15. Seluruhnya juga memeriksa FR18 dan integritas ledger.

## 16  Kesiapan rilis dan keputusan lanjutan

### Pengujian tambahan yang wajib lulus

- AT13 • Akses ID transaksi atau ekspor milik pengguna lain ditolak, termasuk lewat endpoint langsung. Tidak ada data sensitif muncul di log.
- AT14 • Draf offline tidak mengubah saldo. Setelah koneksi pulih, simpan ulang menghasilkan satu transaksi. Dua edit versi berbeda memunculkan konflik.
- AT15 • Pengingat tanggal 31 menghasilkan 28 atau 29 Februari dan kembali ke 31 Maret. Zona waktu dipakai konsisten di laporan dan pengingat.
- AT16 • Koreksi transaksi memperbarui anggaran serta laporan, tetapi jurnal lama dan pembalikannya tetap tersedia. Restore dari backup menghasilkan saldo dan relasi yang sama.
- AT17 • Alokasi Rp400.000 dengan saldo turun menjadi Rp300.000 memunculkan kekurangan Rp100.000; pencatatan pengeluaran nyata tetap berhasil.
- AT18 • Pada HP, pengguna menyelesaikan alur onboarding, input, cicilan, dan goals tanpa tombol terpotong. Target kecepatan, aksesibilitas, dan kegagalan simpan diperiksa sesuai NFR.

### Urutan pembangunan

| Tahap | Hasil yang harus tersedia | Syarat melanjutkan |
| --- | --- | --- |
| 1 Desain | Wireframe alur utama, prototipe mobile, istilah dan rumus final. | Uji kemudahan dengan calon pengguna; asumsi kritis dikonfirmasi. |
| 2 Fondasi | Autentikasi, isolasi data, ledger, dompet, transaksi dan koreksi. | AT01–02, AT07, AT09, AT13, dan bagian koreksi AT16 lulus. |
| 3 Perencanaan | Utang, piutang, goals, anggaran, pengingat, laporan dan ekspor. | Seluruh kasus finansial P0 dan AT15, AT17 lulus. |
| 4 Beta dan rilis | Pemulihan, draf offline, observabilitas, aksesibilitas, uji HP. | Seluruh P0 dan NFR terverifikasi; tidak ada bug kritis atau bug hitungan terbuka. |
| 5 Pelengkapan | P1, kemudian kandidat P2 yang tervalidasi. | Prioritas mengikuti temuan beta dan biaya implementasi. |

Durasi dan anggaran proyek belum diestimasi karena kapasitas tim, platform implementasi, serta kebutuhan integrasi belum diketahui. Setiap tahap diakhiri demo menggunakan data uji yang sama dan pemeriksaan kriteria penerimaan.

### Keputusan yang perlu dikonfirmasi sebelum implementasi

Pemilik produk menetapkan apakah pemakaian awal benar-benar pribadi atau juga bersama pasangan, metode login yang diinginkan, kebutuhan kartu kredit sejak awal, serta apakah impor riwayat harus masuk rilis pertama. Tim teknis menetapkan kapasitas awal, penyedia infrastruktur, kebijakan retensi, dan pemilik operasional backup. Sampai ada keputusan baru, asumsi dan prioritas P0 di dokumen ini menjadi acuan kerja.
