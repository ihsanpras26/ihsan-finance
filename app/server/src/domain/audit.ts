// domain/audit.ts: change trail (PRD §13). Never stores tokens or free-form secrets.
import { uuidv7, nowIso } from '../core/ids.ts';
import { all, run, type Db } from '../db/index.ts';

export interface AuditEntry {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
}

/** Strip anything that must never reach the audit trail. */
function sanitise(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const json = JSON.stringify(value, (key, item) => {
    if (typeof key === 'string' && /token|password|secret|recovery|authorization/i.test(key)) return '[disunting]';
    return item;
  });
  return json.length > 8000 ? `${json.slice(0, 8000)}…` : json;
}

export function recordAudit(db: Db, input: {
  workspaceId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): void {
  run(
    db,
    `INSERT INTO audit_logs (id, workspace_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuidv7(), input.workspaceId, input.actorUserId ?? null, input.action, input.entityType, input.entityId,
    sanitise(input.before), sanitise(input.after), nowIso(),
  );
}

export function listAudit(db: Db, workspaceId: string, entityType?: string, entityId?: string, limit = 100): AuditEntry[] {
  if (entityType && entityId) {
    return all<AuditEntry>(
      db,
      `SELECT * FROM audit_logs WHERE workspace_id = ? AND entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT ?`,
      workspaceId, entityType, entityId, limit,
    );
  }
  return all<AuditEntry>(db, `SELECT * FROM audit_logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`, workspaceId, limit);
}
