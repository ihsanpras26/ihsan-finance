// db/schema.ts: skema fisik Ihsan Finance P0 sebagai modul, bukan berkas .sql.
//
// Alasan: fungsi Vercel dibundel menjadi satu berkas, jadi tidak ada aset yang bisa dibaca saat
// jalan (docs/DECISIONS.md D-24). Modul ini juga satu-satunya sumber skema: migrate() mengimpor
// SCHEMA_SQL dari sini sehingga bundel apa pun otomatis membawa teksnya.
export const SCHEMA_SQL = `-- db/schema.ts: physical schema for Ihsan Finance P0.
-- Money: INTEGER rupiah (no cents). Ids: TEXT UUIDv7. Dates: TEXT 'YYYY-MM-DD' local.
-- Timestamps: TEXT ISO-8601 UTC. Every financial row carries workspace_id.

PRAGMA foreign_keys = ON;

-- ── identity ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  email_norm      TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  password_salt   TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  recovery_hash   TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  device_label  TEXT,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id           TEXT PRIMARY KEY,
  email_norm   TEXT NOT NULL,
  ip           TEXT,
  ok           INTEGER NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(email_norm, created_at);

CREATE TABLE IF NOT EXISTS workspaces (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  base_currency  TEXT NOT NULL DEFAULT 'IDR',
  timezone       TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  owner_id       TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','member')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','removed')),
  created_at    TEXT NOT NULL,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hide_amounts      INTEGER NOT NULL DEFAULT 0,
  reminders_on      INTEGER NOT NULL DEFAULT 1,
  theme             TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  default_wallet_id TEXT,
  last_wallet_id    TEXT,
  last_category_id  TEXT,
  updated_at        TEXT NOT NULL
);

-- ── ledger ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  class         TEXT NOT NULL CHECK (class IN ('asset','liability','income','expense','equity')),
  normal_side   TEXT NOT NULL CHECK (normal_side IN ('debit','credit')),
  currency      TEXT NOT NULL DEFAULT 'IDR',
  system_key    TEXT,                        -- EQ-OPENING, EXP-FEE, ... NULL for wallet/category/debt accounts
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at    TEXT NOT NULL,
  UNIQUE (workspace_id, code)
);
CREATE INDEX IF NOT EXISTS idx_accounts_ws ON ledger_accounts(workspace_id, class);

CREATE TABLE IF NOT EXISTS wallets (
  id                 TEXT PRIMARY KEY,
  workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ledger_account_id  TEXT NOT NULL REFERENCES ledger_accounts(id),
  name               TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('cash','bank','ewallet','other')),
  opened_on          TEXT NOT NULL,
  note               TEXT,
  archived_at        TEXT,
  version            INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallets_ws ON wallets(workspace_id, archived_at);

CREATE TABLE IF NOT EXISTS categories (
  id                 TEXT PRIMARY KEY,
  workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ledger_account_id  TEXT NOT NULL REFERENCES ledger_accounts(id),
  name               TEXT NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('income','expense')),
  archived_at        TEXT,
  version            INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (workspace_id, kind, name)
);

-- ── transactions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('income','expense','transfer','refund','debt_received','receivable_given','debt_payment','receivable_payment','opening','adjustment','reversal','goal_spend')),
  status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('planned','posted','cancelled','reversed')),
  amount_minor    INTEGER NOT NULL CHECK (amount_minor > 0),
  currency        TEXT NOT NULL DEFAULT 'IDR',
  effective_date  TEXT NOT NULL,
  note            TEXT,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import','automatic','system')),
  idempotency_key TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  original_id     TEXT REFERENCES transactions(id),
  reversal_of     TEXT REFERENCES transactions(id),
  replacement_of  TEXT REFERENCES transactions(id),
  counterparty_id TEXT,
  meta_json       TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_ws_date ON transactions(workspace_id, effective_date, id);
CREATE INDEX IF NOT EXISTS idx_tx_ws_type ON transactions(workspace_id, type, effective_date);
CREATE INDEX IF NOT EXISTS idx_tx_reversal_of ON transactions(workspace_id, reversal_of);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_idem ON transactions(workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS journal_lines (
  id                TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  transaction_id    TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  ledger_account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  debit_minor       INTEGER NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor      INTEGER NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  created_at        TEXT NOT NULL,
  CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
);
CREATE INDEX IF NOT EXISTS idx_lines_account ON journal_lines(workspace_id, ledger_account_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_lines_tx ON journal_lines(transaction_id);

CREATE TABLE IF NOT EXISTS transaction_links (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_tx_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  target_tx_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('refund_of','reversal_of','replacement_of','goal_spend_of')),
  created_at    TEXT NOT NULL,
  UNIQUE (source_tx_id, target_tx_id, relation_type)
);

-- ── planning ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counterparties (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact       TEXT,
  archived_at   TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debts (
  id                TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  counterparty_id   TEXT REFERENCES counterparties(id),
  ledger_account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  direction         TEXT NOT NULL CHECK (direction IN ('payable','receivable')),
  opening_mode      TEXT NOT NULL CHECK (opening_mode IN ('cash','legacy')),
  principal_minor   INTEGER NOT NULL CHECK (principal_minor > 0),
  start_date        TEXT NOT NULL,
  due_date          TEXT,
  note              TEXT,
  reminder_off      INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','written_off','archived')),
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_debts_ws ON debts(workspace_id, status, due_date);

CREATE TABLE IF NOT EXISTS debt_payments (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  debt_id         TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  transaction_id  TEXT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  principal_minor INTEGER NOT NULL CHECK (principal_minor >= 0),
  interest_minor  INTEGER NOT NULL DEFAULT 0 CHECK (interest_minor >= 0),
  fee_minor       INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  payment_date    TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(workspace_id, debt_id, payment_date);

CREATE TABLE IF NOT EXISTS goals (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  target_minor  INTEGER NOT NULL CHECK (target_minor > 0),
  target_date   TEXT,
  priority      INTEGER NOT NULL DEFAULT 2,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','archived')),
  note          TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_allocations (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  goal_id        TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  wallet_id      TEXT NOT NULL REFERENCES wallets(id),
  direction      TEXT NOT NULL CHECK (direction IN ('allocate','release')),
  amount_minor   INTEGER NOT NULL CHECK (amount_minor > 0),
  effective_date TEXT NOT NULL,
  note           TEXT,
  linked_tx_id   TEXT REFERENCES transactions(id),
  reversed_by    TEXT REFERENCES goal_allocations(id),
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goal_alloc ON goal_allocations(workspace_id, goal_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_goal_alloc_wallet ON goal_allocations(workspace_id, wallet_id);

CREATE TABLE IF NOT EXISTS budgets (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  period_start  TEXT NOT NULL,
  period_end    TEXT NOT NULL,
  limit_minor   INTEGER NOT NULL CHECK (limit_minor > 0),
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (workspace_id, category_id, period_start)
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  frequency     TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  anchor_day    INTEGER NOT NULL DEFAULT 1,
  timezone      TEXT NOT NULL,
  start_on      TEXT NOT NULL,
  end_on        TEXT,
  next_on       TEXT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'reminder' CHECK (mode IN ('reminder','auto_post')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','stopped')),
  template_json TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_occurrences (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id        TEXT NOT NULL REFERENCES recurring_rules(id) ON DELETE CASCADE,
  scheduled_date TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','skipped','confirmed','failed')),
  transaction_id TEXT REFERENCES transactions(id),
  created_at     TEXT NOT NULL,
  UNIQUE (rule_id, scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_occ_ws ON recurring_occurrences(workspace_id, status, scheduled_date);

-- ── supporting ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('debt_due','budget_threshold','recurring_pending','goal_reached','goal_short')),
  ref_type      TEXT NOT NULL,
  ref_id        TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  due_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read')),
  dedupe_key    TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL,
  read_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_ws ON notifications(workspace_id, status, due_date);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id),
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  before_json   TEXT,
  after_json    TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_ws ON audit_logs(workspace_id, entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS idempotency_records (
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  user_id       TEXT,
  payload_hash  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('in_progress','succeeded','failed')),
  entity_id     TEXT,
  response_json TEXT,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (workspace_id, key)
);

CREATE TABLE IF NOT EXISTS data_jobs (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('csv_export','full_export','delete_request')),
  status        TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('queued','running','done','failed')),
  payload_json  TEXT,
  result_path   TEXT,
  byte_size     INTEGER,
  expires_at    TEXT,
  created_at    TEXT NOT NULL
);
`;
