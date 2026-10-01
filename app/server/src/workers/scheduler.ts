// workers/scheduler.ts: pekerjaan harian: kejadian berulang dan pengingat jatuh tempo (FR11, FR17).
// Idempoten, jadi aman dijalankan berulang; bisa dipanggil per ruang (ctx) atau untuk semua ruang
// sekaligus (db) dari bootstrap main.ts.
import { localDateInTz } from '../core/dates.ts';
import { all, tx, Db } from '../db/index.ts';
import { ensureOccurrences } from '../domain/recurring.ts';
import { ensureDueNotifications } from '../domain/notifications.ts';
import type { TxContext } from '../domain/transactions.ts';

export interface SchedulerSummary {
  today: string;
  occurrencesCreated: number;
  notificationsCreated: number;
  rulesProcessed: number;
  debtsChecked: number;
  workspacesProcessed: number;
}

export interface SchedulerInput {
  /** Tanggal lokal ruang yang dipakai sebagai "hari ini"; default hari ini di zona waktu ruang. */
  today?: string;
}

function isDb(value: TxContext | Db): value is Db {
  return value instanceof Db;
}

/**
 * Menyiapkan kejadian berulang yang tertinggal dan pengingat H−7/H−1/H−0 dalam satu transaksi.
 * Dipanggil dengan TxContext untuk satu ruang, atau dengan Db untuk menjalankan seluruh ruang.
 */
export async function runScheduler(target: TxContext | Db, input: SchedulerInput = {}): Promise<SchedulerSummary> {
  if (isDb(target)) {
    const db = target;
    const workspaces = await all<{ id: string; timezone: string; owner_id: string }>(
      db, `SELECT id, timezone, owner_id FROM workspaces ORDER BY created_at`,
    );
    const summary: SchedulerSummary = {
      today: input.today ?? localDateInTz(workspaces[0]?.timezone ?? 'Asia/Jakarta'),
      occurrencesCreated: 0,
      notificationsCreated: 0,
      rulesProcessed: 0,
      debtsChecked: 0,
      workspacesProcessed: 0,
    };
    for (const workspace of workspaces) {
      const ctx: TxContext = { db, workspaceId: workspace.id, userId: workspace.owner_id, timezone: workspace.timezone };
      const part = await runScheduler(ctx, input);
      summary.occurrencesCreated += part.occurrencesCreated;
      summary.notificationsCreated += part.notificationsCreated;
      summary.rulesProcessed += part.rulesProcessed;
      summary.debtsChecked += part.debtsChecked;
      summary.workspacesProcessed += 1;
    }
    return summary;
  }

  const ctx = target;
  const today = input.today ?? localDateInTz(ctx.timezone);
  return await tx(ctx.db, async () => {
    const occurrences = await ensureOccurrences(ctx, today);
    const notifications = await ensureDueNotifications(ctx, today);
    return {
      today,
      occurrencesCreated: occurrences.created,
      notificationsCreated: notifications.created,
      rulesProcessed: occurrences.rulesProcessed,
      debtsChecked: notifications.debtsChecked,
      workspacesProcessed: 1,
    };
  });
}
