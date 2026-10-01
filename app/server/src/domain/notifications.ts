// domain/notifications.ts: pengingat dalam aplikasi (PRD FR11, ARCHITECTURE §8).
// dedupe_key unik menjamin satu kejadian tidak pernah menghasilkan notifikasi ganda.
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { formatIDR } from '../core/money.ts';
import { addDays, compareDate, daysBetween, formatDateID, localDateInTz } from '../core/dates.ts';
import { all, one, run, scalar, tx } from '../db/index.ts';
import { accountBalance } from './ledger.ts';
import { recordAudit } from './audit.ts';
import type { TxContext } from './transactions.ts';

export type NotificationKind = 'debt_due' | 'budget_threshold' | 'recurring_pending' | 'goal_reached' | 'goal_short';
export type NotificationStatus = 'unread' | 'read';

export interface NotificationRow {
  id: string;
  workspace_id: string;
  kind: NotificationKind;
  ref_type: string;
  ref_id: string;
  title: string;
  body: string;
  due_date: string | null;
  status: NotificationStatus;
  dedupe_key: string;
  created_at: string;
  read_at: string | null;
}

export interface NotificationView extends NotificationRow {
  /** Sisa hari menuju tanggal terkait; negatif berarti sudah lewat. */
  daysUntil: number | null;
}

/** Pengingat utang: H−7, H−1, dan hari jatuh tempo (FR11). Judulnya menyebut sisa hari sebenarnya. */
export const DEBT_REMINDER_OFFSETS: ReadonlyArray<{ days: number; key: string }> = [
  { days: 7, key: 'h7' },
  { days: 1, key: 'h1' },
  { days: 0, key: 'h0' },
];

/**
 * Sisa hari dalam kata. Pengingat H−7 bisa dibuat terlambat (utang dicatat saat jatuh tempo sudah
 * dekat), jadi judul tidak boleh menyebut "7 hari lagi" ketika sisa harinya sudah berbeda.
 */
function describeDaysLeft(days: number): string {
  if (days <= 0) return 'hari ini';
  if (days === 1) return 'besok';
  return `${days} hari lagi`;
}

function buildView(row: NotificationRow, today: string): NotificationView {
  return { ...row, daysUntil: row.due_date ? daysBetween(today, row.due_date) : null };
}

export async function listNotifications(ctx: TxContext, options: { status?: NotificationStatus; kind?: NotificationKind } = {}): Promise<NotificationView[]> {
  const where = ['workspace_id = ?'];
  const params: unknown[] = [ctx.workspaceId];
  if (options.status) {
    where.push('status = ?');
    params.push(options.status);
  }
  if (options.kind) {
    where.push('kind = ?');
    params.push(options.kind);
  }
  const today = localDateInTz(ctx.timezone);
  const rows = await all<NotificationRow>(
    ctx.db,
    `SELECT * FROM notifications WHERE ${where.join(' AND ')}
     ORDER BY status = 'read', COALESCE(due_date, created_at), created_at DESC`,
    ...params,
  );
  return rows.map((row) => buildView(row, today));
}

export async function unreadCount(ctx: TxContext): Promise<number> {
  return await scalar(ctx.db, `SELECT COUNT(*) FROM notifications WHERE workspace_id = ? AND status = 'unread'`, ctx.workspaceId);
}

export async function getNotification(ctx: TxContext, id: string): Promise<NotificationView> {
  const row = await one<NotificationRow>(ctx.db, `SELECT * FROM notifications WHERE workspace_id = ? AND id = ?`, ctx.workspaceId, id);
  if (!row) throw new AppError('not_found', 'Notifikasi tidak ditemukan di ruang keuangan ini.');
  return buildView(row, localDateInTz(ctx.timezone));
}

export async function markRead(ctx: TxContext, id: string): Promise<NotificationView> {
  const { db, workspaceId } = ctx;
  return await tx(db, async () => {
    const row = await one<NotificationRow>(db, `SELECT * FROM notifications WHERE workspace_id = ? AND id = ?`, workspaceId, id);
    if (!row) throw new AppError('not_found', 'Notifikasi tidak ditemukan di ruang keuangan ini.');
    if (row.status !== 'read') {
      await run(db, `UPDATE notifications SET status = 'read', read_at = ? WHERE workspace_id = ? AND id = ?`, nowIso(), workspaceId, id);
      await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'mark_read', entityType: 'notification', entityId: id });
    }
    return await getNotification(ctx, id);
  });
}

export async function markAllRead(ctx: TxContext): Promise<{ updated: number }> {
  const { db, workspaceId } = ctx;
  return await tx(db, async () => {
    const result = await run(
      db,
      `UPDATE notifications SET status = 'read', read_at = ? WHERE workspace_id = ? AND status = 'unread'`,
      nowIso(), workspaceId,
    );
    const updated = Number(result.changes);
    if (updated > 0) {
      await recordAudit(db, { workspaceId, actorUserId: ctx.userId, action: 'mark_all_read', entityType: 'notification', entityId: workspaceId, after: { updated } });
    }
    return { updated };
  });
}

/**
 * Pengingat jatuh tempo untuk utang dan piutang aktif (FR11). Hanya catatan dengan sisa pokok,
 * tanggal jatuh tempo, dan pengingat yang belum dimatikan yang memicu notifikasi; catatan yang
 * sudah lunas berhenti mengingatkan. `dedupe_key` unik membuat pemanggilan berulang aman.
 */
export async function ensureDueNotifications(ctx: TxContext, today?: string): Promise<{ created: number; debtsChecked: number }> {
  const { db, workspaceId } = ctx;
  const day = today ?? localDateInTz(ctx.timezone);
  return await tx(db, async () => {
    const debts = await all<{ id: string; direction: string; due_date: string; principal_minor: number; ledger_account_id: string; counterparty_id: string | null }>(
      db,
      `SELECT d.id, d.direction, d.due_date, d.principal_minor, d.ledger_account_id, d.counterparty_id
       FROM debts d
       WHERE d.workspace_id = ? AND d.status = 'active' AND d.reminder_off = 0 AND d.due_date IS NOT NULL
         AND d.due_date >= ? AND d.due_date <= ?
       ORDER BY d.due_date`,
      workspaceId, day, addDays(day, 7),
    );
    let created = 0;
    for (const debt of debts) {
      const remaining = await accountBalance(db, workspaceId, debt.ledger_account_id);
      if (remaining <= 0) continue;
      const party = debt.counterparty_id
        ? (await one<{ name: string }>(db, `SELECT name FROM counterparties WHERE workspace_id = ? AND id = ?`, workspaceId, debt.counterparty_id))?.name ?? 'pihak lain'
        : 'pihak lain';
      const isPayable = debt.direction === 'payable';
      const what = isPayable ? 'Utang' : 'Piutang';
      const action = isPayable ? 'Bayar sebelum jatuh tempo' : 'Tagih sebelum jatuh tempo';
      for (const reminder of DEBT_REMINDER_OFFSETS) {
        const notifyOn = addDays(debt.due_date, -reminder.days);
        if (compareDate(notifyOn, day) > 0) continue;
        if (compareDate(day, debt.due_date) > 0) continue;
        const dedupeKey = `debt:${debt.id}:${reminder.key}:${debt.due_date}`;
        const result = await run(
          db,
          `INSERT OR IGNORE INTO notifications (id, workspace_id, kind, ref_type, ref_id, title, body, due_date, status, dedupe_key, created_at, read_at)
           VALUES (?, ?, 'debt_due', 'debt', ?, ?, ?, ?, 'unread', ?, ?, NULL)`,
          uuidv7(), workspaceId, debt.id,
          `Jatuh tempo ${describeDaysLeft(daysBetween(day, debt.due_date))}: ${what.toLowerCase()} ${party}`,
          `${what} kepada ${party} sebesar ${formatIDR(remaining)} jatuh tempo ${formatDateID(debt.due_date)}. ${action}.`,
          debt.due_date, dedupeKey, nowIso(),
        );
        created += Number(result.changes);
      }
    }
    return { created, debtsChecked: debts.length };
  });
}
