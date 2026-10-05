# Riset UX Aplikasi Keuangan Pribadi Sejenis

Hasil reverse engineering tingkat permukaan atas aplikasi keuangan pribadi sejenis, untuk memutuskan detail layar yang belum diputuskan di `docs/PRD_Aplikasi_Keuangan_Pribadi_v1.md`.

- Pemeriksaan sumber: 22 September 2026.
- Sumber: dokumentasi resmi penerbit, pusat bantuan resmi, kode sumber publik, halaman toko aplikasi.
- Batasan: tidak ada pengujian langsung di perangkat. Jumlah ketukan hanya ditulis bila alurnya dinyatakan eksplisit. Yang tidak dapat diverifikasi ditandai "tidak terverifikasi".

## Ringkasan temuan

1. Dua model goals. Money Lover memakai dompet tujuan terpisah sehingga uang benar-benar berpindah ([sumber](https://moneylover.zendesk.com/hc/en-us/articles/36976160006809-How-to-manage-your-financial-goals-savings-effectively)). Firefly III, Wallet, dan PRD kita hanya menandai uang yang tetap di dompet.
2. Wallet menyatakan eksplisit bahwa goals tidak memindahkan dana dan menyarankan pemindahan manual ke rekening tabungan ([sumber](https://support.budgetbakers.com/hc/en-us/articles/7181571852690-Setting-up-Goals)). Pola ini layak ditiru.
3. Money Lover mencatat pinjaman yang diterima sebagai Cash Inflow sehingga saldo dompet naik ([sumber](https://moneylover.zendesk.com/hc/en-us/articles/36403994024345-Debt-Loan-definition-and-usage)). Jebakan yang harus dihindari, PRD bagian 10 sudah menetapkan pinjaman bukan pendapatan.
4. Tidak ada aplikasi Indonesia yang diperiksa mendokumentasikan pemisahan pokok dan bunga. Finansialku menaruh pelunasan utang sebagai kalkulator di menu Financial Planning ([sumber](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/financial-planning/menghitung-pelunasan-utang/)).
5. Firefly III menampilkan sisa dana yang belum dialokasikan di bawah daftar piggy bank ([sumber](https://docs.firefly-iii.org/explanation/financial-concepts/piggy-banks/)), padanan kartu "Dana belum dialokasikan" di PRD bagian 04.
6. Definisi teknis Rupiah yang bisa diverifikasi berasal dari kode sumber Actual Budget: `Rp` di depan, pemisah ribuan titik, dua desimal ([sumber](https://github.com/actualbudget/actual/blob/master/packages/loot-core/src/shared/currencies.ts)).

## Temuan per aplikasi

### Money Lover (Indonesia, Finsify)

- Input: widget layar utama untuk mencatat transaksi tanpa membuka aplikasi ([sumber](https://moneylover.zendesk.com/hc/en-us/articles/37017675637401-Getting-started-with-MoneyLover-a-short-guide)), dan widget anggaran per kategori pada halaman Play ([sumber](https://play.google.com/store/apps/details?id=com.bookmark.money&hl=id&gl=ID)). Ketukan pasti tidak terverifikasi.
- Navigasi: tab Account, daftar Transaction, layar Report Overview, dan tab Debt/Loan di pemilih kategori ([sumber](https://moneylover.zendesk.com/hc/en-us/articles/36403994024345-Debt-Loan-definition-and-usage)). Jumlah tab utama tidak terverifikasi.
- Utang: Debt untuk yang dibayar, Loan untuk yang ditagih, tab Payable dan Receivable, tombol Pay off/Receive, sisa pinjaman diperbarui otomatis setelah pembayaran sebagian ([sumber](https://moneylover.zendesk.com/hc/en-us/articles/36403994024345-Debt-Loan-definition-and-usage)). Pemisahan pokok dan bunga tidak terdokumentasi.
- Goals: dompet tujuan terpisah dengan setoran manual, perhitungan bunga tabungan belum didukung ([sumber](https://moneylover.zendesk.com/hc/en-us/articles/36976160006809-How-to-manage-your-financial-goals-savings-effectively)).
- Kosong, galat, offline, format angka: tidak terverifikasi.
- Baik: mencatat transaksi dari layar utama. Buruk: pinjaman masuk sebagai arus kas masuk tanpa penanda kewajiban, sehingga saldo bisa terbaca seperti pemasukan.

### Finansialku (Indonesia)

- Input: form pengeluaran memuat Jumlah, Kategori, Dari Akun, Tanggal, Jam, Keterangan ([sumber](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/keuangan/mencatat-pengeluaran/)). Isian yang terisi otomatis tidak dinyatakan.
- Navigasi: menu aplikasi tercermin pada kategori panduan resmi, yaitu Keuangan, Financial Planning, Investasi, Event, dan Akun ([sumber](https://help.finansialku.com/)). Tidak ada menu utang.
- Utang: hanya kalkulator Dana Pelunasan Utang dengan masukan jumlah pinjaman, jangka waktu dalam tahun, dan bunga per tahun, lalu tombol Hitung ([sumber](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/financial-planning/menghitung-pelunasan-utang/)). Status lunas atau jatuh tempo tidak terdokumentasi.
- Goals: tidak ditemukan modul tujuan dengan alokasi dana, yang ada kalkulator dana di menu Financial Planning.
- Kosong, galat, offline, format angka: tidak terverifikasi.
- Baik: laporan bulanan dipakai sebagai rekapitulasi untuk evaluasi ([sumber](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/keuangan/laporan-keuangan/)). Buruk: menambah aset otomatis mengurangi saldo akun sumber dana ([sumber](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/keuangan/membuat-daftar-aset/)).

### Wallet by BudgetBakers

- Input: di Android, `≡` kiri atas, Records, `+` kanan bawah, jenis record, nominal, akun, kategori, lalu simpan di kanan atas. Catatan, label, payee, tanggal, status, dan lampiran tersembunyi di balik panah putih ([sumber](https://support.budgetbakers.com/hc/en-us/articles/7149271363090-Everything-About-Transactions-Add-edit-clone-split-duplicates)). Di iOS alurnya More kanan bawah lalu `+` kanan atas.
- Navigasi: menu tarik `≡` di kiri atas, bukan tab bawah.
- Utang: tipe Lent atau Borrowed dengan isian Nama, Deskripsi, Akun, Jumlah, Tanggal, dan Due Date yang mengirim pengingat. Aksi lanjutan Close, Edit, Forgive, Delete, dan utang kompleks diarahkan ke akun terpisah ([sumber](https://support.budgetbakers.com/hc/en-us/articles/7149520322706-Setting-up-Debts-and-Loans)). Pemisahan pokok dan bunga tidak terdokumentasi.
- Goals: target, jumlah yang sudah disimpan, tanggal target, warna, ikon. Dokumentasi menegaskan dana tidak dipindahkan otomatis ([sumber](https://support.budgetbakers.com/hc/en-us/articles/7181571852690-Setting-up-Goals)), dan Goals tidak tersedia di iOS dan Web.
- Kosong, galat, offline, format angka: tidak terverifikasi.
- Baik: isian wajib dan detail tambahan dipisah tegas. Buruk: perilaku antarplatform berbeda untuk fitur yang sama.

### Actual Budget (open source)

- Input: tersedia bilah aksi mengambang pada komponen mobile ([sumber](https://github.com/actualbudget/actual/tree/master/packages/desktop-client/src/components/mobile)). Ketukan tidak terverifikasi.
- Navigasi: aplikasi native dihentikan, versi web dipakai sebagai PWA yang bisa dipasang ([sumber](https://actualbudget.org/docs/faq)).
- Utang: tidak ada modul utang. Kartu kredit adalah akun bersaldo negatif yang boleh masuk anggaran, dengan panduan terpisah untuk membawa saldo ([sumber](https://actualbudget.org/docs/budgeting/credit-cards)). Bunga tidak dihitung.
- Goals: tidak ada modul tujuan, perencanaan lewat kategori anggaran dengan model amplop yang hanya menganggarkan uang yang benar-benar dimiliki ([sumber](https://actualbudget.org/docs/budgeting/)).
- Offline: basis data ada di perangkat dan di server sendiri, aplikasi bekerja terlepas dari jaringan, dan PWA mobile juga offline ([sumber](https://actualbudget.org/docs/getting-started/sync), [sumber](https://actualbudget.org/docs/install/)). Tampilan galat tidak terverifikasi.
- Format: pengaturan menyediakan format angka, format tanggal, dan opsi sembunyikan desimal ([sumber](https://actualbudget.org/docs/settings/)).
- Baik: local-first, sinkronisasi hanya lapisan tambahan. Buruk: tanpa modul utang dan tujuan, pengguna harus menyusunnya sendiri.

### Firefly III (open source)

- Input: tidak terverifikasi.
- Navigasi: aplikasi web pada server sendiri, dengan halaman seperti `/piggy-banks` dan `/budgets` ([sumber](https://docs.firefly-iii.org/explanation/financial-concepts/piggy-banks/)).
- Utang: kewajiban adalah akun bersaldo negatif dengan tipe Loan, Debt, dan Mortgage. Bunga bisa diisi tetapi tidak dihitung otomatis, dan kartu kredit bukan kewajiban ([sumber](https://docs.firefly-iii.org/how-to/firefly-iii/finances/liabilities/)). Piutang bekerja sebaliknya, tiap pembayaran menurunkan jumlah terutang ([sumber](https://docs.firefly-iii.org/explanation/financial-concepts/liabilities/)).
- Goals: piggy bank menempel pada satu akun aset, dana bisa ditambah atau dikurangi, hanya transfer yang bisa merujuk piggy bank, dan sisa dana yang belum dialokasikan tampil di bawah halaman ([sumber](https://docs.firefly-iii.org/explanation/financial-concepts/piggy-banks/)).
- Offline: tidak ditemukan dokumentasi mode offline. Format: kode ISO 4217 dan maksimal delapan desimal, pemisah ribuan tidak terverifikasi ([sumber](https://docs.firefly-iii.org/explanation/financial-concepts/currencies/)).
- Anggaran: penanda untuk penarikan dengan rentang tanggal dan jumlah. Pemasukan tidak bisa menambah anggaran otomatis, dan auto-budget hanya terbentuk bila cron berjalan di tanggal yang ditentukan ([sumber](https://docs.firefly-iii.org/how-to/firefly-iii/finances/budgets/)).
- Baik: menyatakan terbuka bahwa bunga tidak dihitung otomatis. Buruk: auto-budget gagal terbentuk bila cron tidak berjalan.

### Money Manager EX (open source)

- Input: dialog New Transaction dengan Date bawaan tanggal hari ini, Status, Type, Amount, Account, dan Note opsional. Alurnya pilih New Transaction di menu atas, isi, lalu OK ([sumber](https://github.com/moneymanagerex/mmex.doc/blob/main/02_Transactions%20.md)). Di Android, tombol `+` layar utama memakai Default Account, Default Status, dan Default Payee dari pengaturan ([sumber](http://android.moneymanagerex.org/usermanual/settings)).
- Navigasi: bilah menu atas plus panel akun di desktop, daftar akun di layar utama Android.
- Utang: tidak ditemukan modul utang di bab transaksi. Nilai bersih dihitung aset dikurangi kewajiban pada bab aset ([sumber](https://github.com/moneymanagerex/mmex.doc/blob/main/04_Assets_and_Budgeting.md)).
- Goals: tidak ada modul tujuan, yang tersedia tujuh tipe aset dan anggaran bulanan atau tahunan dengan tahun fiskal.
- Offline: satu basis data lokal yang bisa dienkripsi, dengan sinkronisasi berkala di Android ([sumber](http://android.moneymanagerex.org/usermanual/settings)). Tampilan galat tidak terverifikasi.
- Format: pengaturan menyediakan Base Currency dan Date Format ([sumber](http://android.moneymanagerex.org/usermanual/settings)), pemisah ribuan tidak terverifikasi.
- Baik: nilai bawaan mengurangi isian berulang. Buruk: tanpa modul utang, pengguna harus membuat akun bersaldo negatif sendiri.

### Catatan: BukuKas

Pencarian resmi Google Play untuk kata kunci "bukukas" pada 22 September 2026 tidak menampilkan aplikasi BukuKas milik PT Beegroup Financial Indonesia, hanya aplikasi pihak ketiga bernama serupa ([sumber](https://play.google.com/store/search?q=bukukas&c=apps&hl=id&gl=ID)), dan situs bukukas.com tidak dapat diakses saat pemeriksaan. Deskripsi fitur hanya tersisa di arsip pihak ketiga tahun 2022: hutang piutang dengan pengingat jatuh tempo, pengingat lewat WhatsApp dan SMS, invoice digital, dan pembukuan terpisah ([sumber](https://apkcombo.com/id/bukukas-catatan-kas-digital/com.beecash.app/)). Temuan UX BukuKas dinyatakan tidak terverifikasi dan hanya dipakai sebagai peringatan ketergantungan pada satu vendor.

## Rekomendasi untuk Ihsan Finance

1. Input cepat: pertahankan tombol Tambah di tengah navigasi bawah (PRD 03) dan isi otomatis tanggal serta dompet terakhir, mengikuti Default Account MMEX Android. Jalur mencatat tanpa membuka aplikasi masuk P1 mengikuti widget Money Lover.
2. Form ringkas: isian wajib lebih dulu (jenis, nominal, dompet, kategori), detail di balik panel seperti Wallet. Tombol simpan tetap di bawah, bukan kanan atas.
3. Utang piutang: pisahkan pokok, bunga, dan biaya pada form pembayaran (FR10), lalu tampilkan "Sisa pokok" dengan status aktif, lunas, atau lewat jatuh tempo (FR11). Ikuti keterbukaan Firefly III soal bunga yang tidak dihitung otomatis, dan hindari pola Money Lover yang menaikkan saldo tanpa penanda kewajiban.
4. Goals: tampilkan sisa dana yang belum dialokasikan tepat di bawah daftar tujuan seperti Firefly III, dan sertakan peringatan bahwa alokasi tidak memindahkan uang seperti Wallet, melengkapi aturan di PRD bagian 04.
5. Keadaan gagal dan offline: tidak ada aplikasi dalam riset ini yang mendokumentasikan keadaan kosong atau galat, jadi keputusan mengikuti PRD bagian 09 dan DESIGN.md bagian 8. Model local-first Actual Budget mendukung FR22.
6. Format angka: `Rp` di depan, pemisah ribuan titik, angka tabular, dan sediakan opsi menyembunyikan desimal seperti Actual Budget.

## Yang tidak terverifikasi

- Jumlah ketukan pasti untuk Money Lover, Finansialku, Wallet, dan Actual Budget.
- Tampilan keadaan kosong, galat, dan offline untuk Money Lover, Finansialku, Wallet, dan MMEX.
- Pemisah ribuan dan posisi simbol Rupiah di Money Lover, Finansialku, dan BukuKas.
- Modul tujuan dengan alokasi dana di Finansialku dan MMEX.
- Status resmi BukuKas setelah aplikasinya tidak ditemukan di Google Play dan situs resminya tidak dapat diakses.

## Sumber

- Money Lover: [Debt & Loan](https://moneylover.zendesk.com/hc/en-us/articles/36403994024345-Debt-Loan-definition-and-usage), [Goals](https://moneylover.zendesk.com/hc/en-us/articles/36976160006809-How-to-manage-your-financial-goals-savings-effectively), [panduan mulai](https://moneylover.zendesk.com/hc/en-us/articles/37017675637401-Getting-started-with-MoneyLover-a-short-guide), [halaman Play Indonesia](https://play.google.com/store/apps/details?id=com.bookmark.money&hl=id&gl=ID).
- Finansialku: [pusat bantuan](https://help.finansialku.com/), [mencatat pengeluaran](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/keuangan/mencatat-pengeluaran/), [membuat anggaran](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/keuangan/cara-membuat-anggaran/), [pelunasan utang](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/financial-planning/menghitung-pelunasan-utang/), [daftar aset](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/keuangan/membuat-daftar-aset/), [laporan keuangan](https://help.finansialku.com/docs/panduan-aplikasi-finansialku/keuangan/laporan-keuangan/).
- Wallet by BudgetBakers: [transaksi](https://support.budgetbakers.com/hc/en-us/articles/7149271363090-Everything-About-Transactions-Add-edit-clone-split-duplicates), [utang dan pinjaman](https://support.budgetbakers.com/hc/en-us/articles/7149520322706-Setting-up-Debts-and-Loans), [goals](https://support.budgetbakers.com/hc/en-us/articles/7181571852690-Setting-up-Goals), [tentang Wallet](https://support.budgetbakers.com/hc/en-us/articles/12212428113810-What-is-the-Wallet-app).
- Actual Budget: [FAQ](https://actualbudget.org/docs/faq), [sinkronisasi](https://actualbudget.org/docs/getting-started/sync), [pemasangan](https://actualbudget.org/docs/install/), [pengaturan](https://actualbudget.org/docs/settings/), [anggaran](https://actualbudget.org/docs/budgeting/), [kartu kredit](https://actualbudget.org/docs/budgeting/credit-cards), [daftar mata uang](https://github.com/actualbudget/actual/blob/master/packages/loot-core/src/shared/currencies.ts).
- Firefly III: [piggy bank](https://docs.firefly-iii.org/explanation/financial-concepts/piggy-banks/), [kewajiban](https://docs.firefly-iii.org/explanation/financial-concepts/liabilities/), [cara mengelola kewajiban](https://docs.firefly-iii.org/how-to/firefly-iii/finances/liabilities/), [anggaran](https://docs.firefly-iii.org/explanation/financial-concepts/budgets/), [cara mengelola anggaran](https://docs.firefly-iii.org/how-to/firefly-iii/finances/budgets/), [mata uang](https://docs.firefly-iii.org/explanation/financial-concepts/currencies/).
- Money Manager EX: [transaksi](https://github.com/moneymanagerex/mmex.doc/blob/main/02_Transactions%20.md), [aset dan anggaran](https://github.com/moneymanagerex/mmex.doc/blob/main/04_Assets_and_Budgeting.md), [pengaturan Android](http://android.moneymanagerex.org/usermanual/settings).
- BukuKas: [arsip deskripsi 2022](https://apkcombo.com/id/bukukas-catatan-kas-digital/com.beecash.app/), [hasil pencarian Google Play](https://play.google.com/store/search?q=bukukas&c=apps&hl=id&gl=ID).
