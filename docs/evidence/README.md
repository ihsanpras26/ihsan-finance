# Bukti verifikasi

Tangkapan layar dan keluaran alat yang mendukung klaim di `docs/DELIVERY_GATE.md`. Berkas di sini
adalah bukti, bukan dokumentasi: kalau ada yang bertentangan dengan angka di dokumen, yang benar
adalah angka yang bisa dijalankan ulang.

| Berkas | Isi | Bagian |
|---|---|---|
| `ui-d15-screens.jpg` | Lima layar versi D-15 (Beranda, Transaksi, Rencana, Laporan, Profil) | D-15 |
| `ui-d15-desktop.png` | Tata letak desktop dengan rel samping | D-15 |
| `ui-d15-quickentry.png` | Lembar entri cepat | D-15 |
| `ui-d16-mobile.jpg` | Lima layar setelah lapisan sentuh diperketat | D-16 |
| `verify-report.json` | Keluaran `verify.mjs`: 24 pemeriksaan click-through di viewport HP | D-15 |

Tangkapan layar diambil pada viewport 390x844 dengan `isMobile: true` dan `hasTouch: true`,
`deviceScaleFactor: 2`.

Cara membuat ulang: harness ada di luar repo (`~/ihsan-verify/`), karena berisi peramban Playwright
dan tidak perlu ikut ke repositori aplikasi. Yang perlu ikut hanyalah keluaran dan skripnya bila
suatu saat dipindahkan ke CI.
