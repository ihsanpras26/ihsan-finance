// domain/idempotency.ts: PRD §13: same key + same payload returns the same result, never a duplicate.
import { AppError } from '../core/errors.ts';
import { nowIso, payloadHash } from '../core/ids.ts';
import { one, run, type Db } from '../db/index.ts';

interface RecordRow {
  workspace_id: string;
  key: string;
  payload_hash: string;
  status: string;
  entity_id: string | null;
  response_json: string | null;
}

/**
 * Wrap a mutation. The caller must pass the raw request body so the payload hash is stable.
 * Returns the stored response on a repeat with an identical payload.
 */
export function withIdempotency<T>(db: Db, input: { workspaceId: string; userId?: string | null; key: string | null | undefined; payload: unknown }, run_: () => T): { value: T; replayed: boolean } {
  const key = (input.key ?? '').trim();
  if (!key) {
    return { value: run_(), replayed: false };
  }
  if (key.length > 200) {
    throw new AppError('validation_failed', 'Kunci idempotensi terlalu panjang (maksimal 200 karakter).');
  }
  const hash = payloadHash(input.payload);
  const existing = one<RecordRow>(db, `SELECT * FROM idempotency_records WHERE workspace_id = ? AND key = ?`, input.workspaceId, key);

  if (existing) {
    if (existing.payload_hash !== hash) {
      throw new AppError('idempotency_conflict', 'Kunci idempotensi ini sudah dipakai untuk permintaan yang berbeda. Kirim ulang dengan kunci baru.');
    }
    if (existing.status === 'succeeded' && existing.response_json) {
      return { value: JSON.parse(existing.response_json) as T, replayed: true };
    }
    throw new AppError('idempotency_conflict', 'Permintaan dengan kunci ini sedang diproses atau gagal sebelumnya. Coba lagi dengan kunci baru.');
  }

  run(
    db,
    `INSERT INTO idempotency_records (workspace_id, key, user_id, payload_hash, status, created_at)
     VALUES (?, ?, ?, ?, 'in_progress', ?)`,
    input.workspaceId, key, input.userId ?? null, hash, nowIso(),
  );

  let value: T;
  try {
    value = run_();
  } catch (error) {
    run(db, `DELETE FROM idempotency_records WHERE workspace_id = ? AND key = ?`, input.workspaceId, key);
    throw error;
  }

  const entityId = extractEntityId(value);
  run(
    db,
    `UPDATE idempotency_records SET status = 'succeeded', entity_id = ?, response_json = ? WHERE workspace_id = ? AND key = ?`,
    entityId, JSON.stringify(value ?? null), input.workspaceId, key,
  );
  return { value, replayed: false };
}

function extractEntityId(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string') return record.id;
    if (typeof record.transactionId === 'string') return record.transactionId;
    if (typeof record.reversalId === 'string') return record.reversalId;
  }
  return null;
}

export function cleanupIdempotency(db: Db, olderThanDays = 90): number {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const result = run(db, `DELETE FROM idempotency_records WHERE created_at < ?`, cutoff);
  return Number(result.changes);
}
