// domain/transaction-store.ts: the raw insert used by several domain modules.
// Kept separate so wallets/debts/goals can create their own transactions without importing
// the full transaction engine (which imports them back through types only).
import { uuidv7, nowIso } from '../core/ids.ts';
import { run, type Db } from '../db/index.ts';
import type { TxStatus, TxType } from './transactions.ts';

export interface InsertTransactionInput {
  workspaceId: string;
  type: TxType;
  status: TxStatus;
  amount: number;
  effectiveDate: string;
  note: string | null;
  source: string;
  userId: string | null;
  idempotencyKey: string | null;
  originalId?: string | null;
  reversalOf?: string | null;
  replacementOf?: string | null;
  counterpartyId?: string | null;
  meta?: Record<string, unknown> | null;
}

export function insertTransaction(db: Db, input: InsertTransactionInput): string {
  const id = uuidv7();
  const now = nowIso();
  run(
    db,
    `INSERT INTO transactions (id, workspace_id, type, status, amount_minor, currency, effective_date, note, source,
                               idempotency_key, version, created_by, created_at, updated_at,
                               original_id, reversal_of, replacement_of, counterparty_id, meta_json)
     VALUES (?, ?, ?, ?, ?, 'IDR', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, input.workspaceId, input.type, input.status, input.amount, input.effectiveDate, input.note, input.source,
    input.idempotencyKey, input.userId, now, now,
    input.originalId ?? null, input.reversalOf ?? null, input.replacementOf ?? null, input.counterpartyId ?? null,
    input.meta ? JSON.stringify(input.meta) : null,
  );
  return id;
}
