# Arsitektur: Ihsan Finance P0

Sumber kebenaran produk: `PRD_Aplikasi_Keuangan_Pribadi_v1.md`. Dokumen ini menerjemahkannya
menjadi keputusan teknis yang mengikat. Perubahan di sini dicatat di `docs/DECISIONS.md`.

## 1. Stack & alasan

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Runtime | Node 24 (TypeScript langsung, type-stripping) | Tanpa build step server; `node:test` bawaan |
| DB | libSQL (`@libsql/client`): berkas lokal atau Turso | Transaksi atomik nyata, dialek SQLite tetap, satu port untuk dua tempat (D-21) |
| API | Fastify 5 + Zod | Routing/validasi matang, `inject()` untuk tes tanpa jaringan |
| Web | React 19 + Vite 7 + Tailwind v4 | PWA responsif, HMR cepat |
| Grafik | SVG buatan sendiri + tabel pendamping | PRD FR18: grafik wajib punya nilai/tabel |
| Tes | `node:test` (server) + `tsc --noEmit` + build (web) | Satu perintah: `pnpm verify` |

Berkas data pengembangan: `app/data/ihsan.db` (di-gitignore). Mode `WAL`, `foreign_keys=ON`.
Produksi boleh memakai basis data Turso: `IHSAN_DB_URL` + `IHSAN_DB_TOKEN` mengalihkan target, dan
penyalaan serverless memakai `server/src/vercel.ts` yang dibundel `app/scripts/build-api.mjs` menjadi
`app/api/index.js`, plus cron `GET /api/v1/internal/tick` (D-21, D-24). Vercel merencanakan fungsi
sebelum perintah build berjalan, jadi `app/api/index.js` ada di git sebagai re-ekspor tipis dan bundel
asli ditulis ke berkas yang sama pada langkah build. Paket fungsinya satu berkas tanpa aset, dan skema
basis data ikut sebagai modul `db/schema.ts`.

## 2. Peta modul

```
server/src/
  main.ts            bootstrap: config → db → migrate → http → scheduler
  vercel.ts          entri fungsi Vercel: satu instance Fastify di belakang satu handler
  config.ts          env (HOST, PORT, APP_ORIGIN, IHSAN_DB_URL/DATA_DIR, token penjadwal)
  core/              ids · money · dates · errors · validate   (tanpa dependensi domain)
  db/                schema.ts · index.ts (port libSQL: query/mutate/tx/migrate)
  domain/            ledger · auth · workspaces · wallets · categories · transactions
                     debts · goals · budgets · recurring · reports · export
                     notifications · audit · idempotency
  http/              server.ts · auth-plugin.ts · serialize.ts · routes/*.ts
  workers/           scheduler.ts (occurrence berulang + pengingat jatuh tempo)
  tools/             seed.ts (data demo) · offsite.ts (dump + unggah S3/R2)
web/src/
  main.tsx · app.tsx · routes/* · components/* · lib/{api,format,offline,store}.ts · styles/
```

Aturan ketergantungan: `core` → `db` → `domain` → `http`. Tidak ada impor balik.
Domain **tidak** menyentuh Fastify; HTTP **tidak** menulis SQL langsung.

## 3. Uang dan tanggal

- Nominal = `INTEGER` rupiah penuh (tanpa sen untuk IDR). API mengirim **string desimal**
  (`"25000"`), menerima string atau number bilangan bulat.
- `money.ts`: `parseAmount(input) → number` (tolak nol, negatif, pecahan, > 999_999_999_999),
  `formatIDR(n) → "Rp25.000"`, `sumSafe(list)` (lempar bila melewati `Number.MAX_SAFE_INTEGER`).
- Tanggal efektif: `TEXT 'YYYY-MM-DD'` (waktu lokal ruang). `created_at`/`updated_at`: ISO UTC.
- Batas periode laporan dihitung dari `effective_date` (bukan waktu request), memakai zona
  waktu ruang (`workspaces.timezone`, default `Asia/Jakarta`).
- Hari ke-29/30/31 yang tidak ada → hari terakhir bulan itu; tanggal acuan **tidak** bergeser
  (`clampToMonth` di `dates.ts`).

## 4. Skema fisik (ringkas)

Semua tabel: `id TEXT PRIMARY KEY` (UUIDv7), `workspace_id TEXT` untuk entitas ruang,
`created_at`/`updated_at` UTC. Kolom `version INTEGER` untuk objek yang dapat diubah.

```
users(id, email UNIQUE, password_hash, password_salt, display_name, recovery_hash,
      status, created_at, updated_at)
sessions(id, user_id, token_hash UNIQUE, device_label, created_at, expires_at, revoked_at)
workspaces(id, name, base_currency='IDR', timezone, owner_id, created_at, updated_at)
memberships(id, workspace_id, user_id, role='owner', status, created_at)  UNIQUE(ws,user)
ledger_accounts(id, workspace_id, code, name, class, normal_side, currency, system_key,
                status, created_at)  UNIQUE(workspace_id, code)
wallets(id, workspace_id, ledger_account_id, name, type, opened_on, note,
        archived_at, version, created_at, updated_at)
categories(id, workspace_id, ledger_account_id, name, kind, archived_at, version, created_at)
transactions(id, workspace_id, type, status, amount_minor, currency, effective_date,
             note, source, idempotency_key, version, created_by, created_at, updated_at,
             original_id, reversal_of, replacement_of, counterparty_id, meta_json)
journal_lines(id, workspace_id, transaction_id, ledger_account_id, debit_minor,
              credit_minor, created_at)
transaction_links(id, workspace_id, source_tx_id, target_tx_id, relation_type, created_at)
counterparties(id, workspace_id, name, contact, archived_at, created_at)
debts(id, workspace_id, counterparty_id, ledger_account_id, direction, opening_mode,
      principal_minor, start_date, due_date, note, status, version, created_at, updated_at)
debt_payments(id, workspace_id, debt_id, transaction_id UNIQUE, principal_minor,
              interest_minor, fee_minor, payment_date, created_at)
goals(id, workspace_id, name, target_minor, target_date, priority, status, note,
      version, created_at, updated_at)
goal_allocations(id, workspace_id, goal_id, wallet_id, direction, amount_minor,
                 effective_date, note, linked_tx_id, reversed_by, created_at)
budgets(id, workspace_id, category_id, period_start, period_end, limit_minor, version,
        created_at, updated_at)  UNIQUE(workspace_id, category_id, period_start)
recurring_rules(id, workspace_id, type, frequency, anchor_day, timezone, start_on, end_on,
                next_on, mode='reminder', status, template_json, version, created_at, updated_at)
recurring_occurrences(id, workspace_id, rule_id, scheduled_date, status, transaction_id,
                      created_at)  UNIQUE(rule_id, scheduled_date)
notifications(id, workspace_id, kind, ref_type, ref_id, title, body, due_date, status,
              dedupe_key UNIQUE, created_at, read_at)
audit_logs(id, workspace_id, actor_user_id, action, entity_type, entity_id, before_json,
           after_json, created_at)
idempotency_records(workspace_id, key, payload_hash, status, entity_id, response_json,
                    created_at, PRIMARY KEY(workspace_id, key))
user_preferences(user_id PRIMARY KEY, workspace_id, hide_amounts INTEGER, reminders_on
                 INTEGER, default_wallet_id, last_wallet_id, last_category_id, updated_at)
data_jobs(id, workspace_id, kind, status, payload_json, result_path, expires_at, created_at)
```

Indeks wajib: `transactions(workspace_id, effective_date, id)`,
`journal_lines(workspace_id, ledger_account_id, transaction_id)`,
`debts(workspace_id, status, due_date)`, `goal_allocations(workspace_id, goal_id)`,
`notifications(workspace_id, status, due_date)`.

## 5. Akun buku besar (chart of accounts per ruang)

Dibuat otomatis saat ruang dibuat. `normal_side`: asset/expense = `debit`; liability/income/equity = `credit`.

| code | class | normal | dipakai untuk |
|---|---|---|---|
| `EQ-OPENING` | equity | credit | saldo awal dompet |
| `EQ-ADJUST` | equity | credit | penyesuaian rekonsiliasi |
| `EQ-WRITEOFF` | equity | credit | penghapusan utang/piutang (non-kas) |
| `A-RECEIVABLE:<debtId>` | asset | debit | satu akun per catatan piutang |
| `L-PAYABLE:<debtId>` | liability | credit | satu akun per catatan utang |
| `A-WALLET:<walletId>` | asset | debit | satu akun per dompet |
| `INC:<categoryId>` | income | credit | satu akun per kategori pendapatan |
| `EXP:<categoryId>` | expense | debit | satu akun per kategori pengeluaran |
| `INC-INTEREST` | income | credit | bunga piutang diterima (sistem) |
| `EXP-INTEREST` | expense | debit | bunga utang dibayar (sistem) |
| `EXP-FEE` | expense | debit | biaya transfer & administrasi (sistem) |

## 6. Aturan pembukuan (debit = kredit)

| Kejadian | Debit | Kredit |
|---|---|---|
| Saldo awal dompet (> 0) | `A-WALLET` | `EQ-OPENING` |
| Pendapatan | `A-WALLET` | `INC:<kategori>` |
| Pengeluaran | `EXP:<kategori>` | `A-WALLET` |
| Transfer (nominal) | `A-WALLET:tujuan` | `A-WALLET:asal` |
| Transfer (biaya, opsional) | `EXP-FEE` | `A-WALLET:asal` |
| Refund | `A-WALLET` | `EXP:<kategori pengeluaran asal>` |
| Utang diterima (kas) | `A-WALLET` | `L-PAYABLE:<debt>` |
| Piutang diberikan | `A-RECEIVABLE:<debt>` | `A-WALLET` |
| Saldo lama (utang/piutang) | Tanpa arus kas (jurnal antara akun kewajiban/piutang dan `EQ-OPENING`) | |
| Bayar utang | `L-PAYABLE` (pokok) + `EXP-INTEREST` (bunga) + `EXP-FEE` (biaya) | `A-WALLET` (total kas) |
| Terima piutang | `A-WALLET` (total kas) | `A-RECEIVABLE` (pokok) + `INC-INTEREST` (bunga) + `INC-INTEREST`/`EXP-FEE`? (biaya → `INC-INTEREST` negatif tidak dipakai; biaya penerimaan → `EXP-FEE`) |
| Rekonsiliasi dompet | selisih + → `A-WALLET`, − → `EQ-ADJUST` | sisi lawan `EQ-ADJUST` / `A-WALLET` |
| Penghapusan utang | `L-PAYABLE` | `EQ-WRITEOFF` |
| Penghapusan piutang | `EQ-WRITEOFF` | `A-RECEIVABLE` |
| Pembalikan (reversal) | cermin persis baris transaksi asal | |

Setiap transaksi minimal 2 `journal_lines`; tiap baris tepat satu sisi > 0.
Status: `planned` (tanpa jurnal), `posted`, `cancelled`, `reversed`.

Saldo: dompet/piutang (debit-normal) = Σdebit − Σkredit; utang (credit-normal) = Σkredit − Σdebit.
**Saldo selalu dihitung dari ledger**, tidak pernah disimpan sebagai kolom yang di-update.

## 7. Kontrak HTTP

Basis `/api/v1`. Autentikasi: cookie `ifsess` (HttpOnly, SameSite=Lax) atau `Authorization: Bearer <token>`.
Semua respons JSON. Uang = string desimal. Waktu = ISO UTC; tanggal efektif = `YYYY-MM-DD`.

Mutasi menerima header `Idempotency-Key` (wajib untuk POST transaksi/pembayaran/alokasi) dan
`expected_version` pada body untuk objek yang diubah.

| Grup | Endpoint |
|---|---|
| Auth | `POST /auth/register` `POST /auth/login` `POST /auth/logout` `GET /auth/me` `POST /auth/sessions/revoke-others` `POST /auth/recover` |
| Ruang | `GET /workspace` `PATCH /workspace` `GET /preferences` `PATCH /preferences` |
| Dompet | `GET /wallets` `POST /wallets` `PATCH /wallets/:id` `POST /wallets/:id/archive` `DELETE /wallets/:id` `GET /wallets/:id/balance?as_of=` `POST /wallets/:id/reconcile` |
| Kategori | `GET /categories` `POST /categories` `PATCH /categories/:id` `POST /categories/:id/archive` |
| Transaksi | `GET /transactions` `POST /transactions` `GET /transactions/:id` `PATCH /transactions/:id` `POST /transactions/:id/reverse` `GET /transactions/:id/impact` |
| Utang/piutang | `GET /debts` `POST /debts` `GET /debts/:id` `PATCH /debts/:id` `POST /debts/:id/payments` `POST /debts/:id/write-off` `GET /debts/upcoming?days=7` |
| Goals | `GET /goals` `POST /goals` `PATCH /goals/:id` `POST /goals/:id/allocations` `POST /goals/:id/archive` |
| Anggaran | `GET /budgets?period=YYYY-MM` `POST /budgets` `PATCH /budgets/:id` `GET /budgets/progress?period=` |
| Berulang | `GET /recurring` `POST /recurring` `PATCH /recurring/:id` `POST /recurring/:id/pause|resume|stop` `GET /recurring/occurrences?status=pending` `POST /recurring/occurrences/:id/confirm` `POST /recurring/occurrences/:id/skip` |
| Laporan | `GET /reports/summary` `GET /reports/categories` `GET /reports/cashflow` `GET /reports/networth` `GET /reports/debts` `GET /reports/goals` `GET /dashboard` |
| Ekspor | `POST /export/csv` `POST /export/full` `GET /export/jobs/:id` |
| Notifikasi | `GET /notifications` `POST /notifications/:id/read` `POST /notifications/read-all` |
| Sistem | `GET /health` |

Kode error (UI menanganinya, bukan menimpa data):

| code | HTTP | arti |
|---|---|---|
| `validation_failed` | 400 | payload tidak valid (sertakan `fields`) |
| `unauthorized` | 401 | tanpa sesi / sesi kedaluwarsa |
| `forbidden` | 403 | objek milik ruang lain |
| `not_found` | 404 | tidak ada / sudah diarsipkan |
| `version_conflict` | 409 | `expected_version` tidak cocok (sertakan versi server) |
| `idempotency_conflict` | 409 | kunci sama, payload beda |
| `insufficient_principal` | 409 | pokok dibayar > sisa pokok |
| `refund_exceeds` | 409 | akumulasi refund > pengeluaran asal |
| `has_dependencies` | 409 | dibatalkan sebelum dependensi (refund/pembayaran) selesai |
| `wallet_has_history` | 409 | hapus dompet yang sudah punya histori |
| `allocation_exceeds` | 409 | alokasi melebihi saldo positif dompet |
| `rate_limited` | 429 | terlalu banyak percobaan login |
| `internal` | 500 | kesalahan tak terduga (tanpa detail sensitif) |

## 8. Alur kritis

**Input cepat (≤15 detik):** form menampilkan nominal lebih dulu dengan keyboard angka,
dompet & kategori terakhir terisi otomatis, tanggal = hari ini, satu tombol Simpan.
Tanggal & dompet selalu terlihat sebelum simpan (PRD §03).

**Koreksi transaksi posted:** `PATCH /transactions/:id` → transaksi `reversal` pada tanggal
efektif asli + transaksi pengganti pada tanggal pilihan pengguna, dihubungkan lewat
`reversal_of`/`replacement_of`. Keduanya dibuat dalam satu transaksi DB.

**Pembatalan:** `POST /transactions/:id/reverse` menolak bila ada refund/pembayaran terkait
(`has_dependencies`) atau ada anak pembalikan. `GET /transactions/:id/impact` memberi ringkasan dampak.

**Draf offline:** form disimpan di `localStorage` (`draft:<workspace>:<jenis>`), ditampilkan
sebagai “Draf di perangkat ini”, tidak memengaruhi saldo, dikirim saat online dengan kunci
idempotensi tetap. Aplikasi tidak pernah menampilkan “Tersimpan” sebelum server mengonfirmasi.

**Pengulangan:** scheduler harian membuat `recurring_occurrences` (`pending`) dan
`notifications` (H−7, H−1, H−0) dengan `dedupe_key` unik agar tidak ganda. Konfirmasi
pengguna membuat transaksi nyata; melewati satu kejadian tidak menghapus aturan.

## 9. Keamanan (NFR04/07/08)

- Kata sandi: `scrypt` (N=16384) + salt acak 16 byte; token sesi acak 32 byte, disimpan `sha256`.
- Pembatasan percobaan login per email+IP (jendela 15 menit). Sesi kedaluwarsa 30 hari.
- Setiap route objek memverifikasi `workspace_id` dari sesi; 404/403 untuk objek ruang lain.
- Ekspor CSV: netralkan formula (`= + - @ tab CR`) dengan prefiks `'`; UTF-8 dengan BOM.
- Log: `request_id`, kode gagal, durasi: tanpa token, catatan keuangan, atau nama pihak.
