// domain/debts.ts: utang, piutang, pembayaran, dan penghapusan (PRD FR09–FR11, §06, §10).
// Sisa pokok selalu turunan dari buku besar; tidak pernah disimpan sebagai kolom yang di-update.
import { AppError } from '../core/errors.ts';
import { uuidv7, nowIso } from '../core/ids.ts';
import { addSafe, formatIDR, parseAmount } from '../core/money.ts';
import { addDays, compareDate, daysBetween, isValidIsoDate, localDateInTz } from '../core/dates.ts';
import { all, one, run, tx, type Db } from '../db/index.ts';
import {
  accountBalance, createDebtAccount, postJournal, systemAccountId,
} from './ledger.ts';
import {
  buildDebtCashReceived, buildDebtPayment, buildLegacyOpening, buildReceivableCollection,
  buildReceivableGiven, buildWriteOffPayable, buildWriteOffReceivable, mirrorLines,
} from './posting.ts';
import { recordAudit } from './audit.ts';
import { withIdempotency } from './idempotency.ts';
import { insertTransaction } from './transaction-store.ts';
import type { TxContext } from './transactions.ts';

export type DebtDirection = 'payable' | 'receivable';
export type DebtStatus = 'active' | 'paid' | 'written_off' | 'archived';
export type OpeningMode = 'cash' | 'legacy';

export interface DebtRow {
  id: string;
  workspace_id: string;
  counterparty_id: string | null;
  ledger_account_id: string;
  direction: DebtDirection;
  opening_mode: OpeningMode;
  principal_minor: number;
  start_date: string;
  due_date: string | null;
  note: string | null;
  reminder_off: number;
  status: DebtStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DebtPaymentRow {
  id: string;
  workspace_id: string;
  debt_id: string;
  transaction_id: string;
  principal_minor: number;
  interest_minor: number;
  fee_minor: number;
  payment_date: string;
  created_at: string;
}

export interface DebtPaymentView extends DebtPaymentRow {
  /** Kas yang benar-benar berpindah: pokok + bunga + biaya (utang), atau pokok + bunga − biaya (piutang). */
  cashAmount: number;
  transactionStatus: string;
  note: string | null;
}

export interface DebtView extends DebtRow {
  counterpartyName: string | null;
  /** Sisa pokok dari saldo akun buku besar (selalu pada sisi normal akun). */
  remaining: number;
  principalPaid: number;
  interestPaid: number;
  feePaid: number;
  overdue: boolean;
  daysToDue: number | null;
  /** "Belum ada jatuh tempo" untuk utang tanpa tanggal. */
  dueLabel: string;
}

export interface DebtDetail extends DebtView {
  payments: DebtPaymentView[];
}

const DIRECTION_LABEL: Record<DebtDirection, string> = {
  payable: 'Utang',
  receivable: 'Piutang',
};

// ── validasi ────────────────────────────────────────────────────────────────

function assertDirection(value: unknown): DebtDirection {
  const direction = String(value ?? '').trim() as DebtDirection;
  if (direction !== 'payable' && direction !== 'receivable') {
    throw new AppError('validation_failed', 'Arah catatan harus Utang (kita meminjam) atau Piutang (kita meminjamkan).', { fields: { direction: 'invalid' } });
  }
  return direction;
}

function assertOpeningMode(value: unknown): OpeningMode {
  const mode = String(value ?? '').trim() as OpeningMode;
  if (mode !== 'cash' && mode !== 'legacy') {
    throw new AppError('validation_failed', 'Pilih "Dana diterima atau diberikan sekarang" atau "Saldo lama".', { fields: { openingMode: 'invalid' } });
  }
  return mode;
}

function assertCounterpartyName(value: unknown): string {
  const name = String(value ?? '').trim();
  if (!name) throw new AppError('validation_failed', 'Nama pihak lain wajib diisi.', { fields: { counterpartyName: 'required' } });
  if (name.length > 120) throw new AppError('validation_failed', 'Nama pihak lain maksimal 120 karakter.', { fields: { counterpartyName: 'too_long' } });
  return name;
}

function assertIsoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isValidIsoDate(value)) {
    throw new AppError('validation_failed', 'Tanggal belum benar. Pakai format tanggal yang benar.', { fields: { [field]: 'invalid' } });
  }
  return value;
}

function assertOptionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return assertIsoDate(value, field);
}

function assertNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const note = String(value).trim();
  if (note.length > 500) throw new AppError('validation_failed', 'Catatan terlalu panjang (maksimal 500 karakter).', { fields: { note: 'too_long' } });
  return note || null;
}

function assertReason(value: unknown): string {
  const reason = String(value ?? '').trim();
  if (reason.length < 3) {
    throw new AppError('validation_failed', 'Sebutkan alasan penghapusan (minimal 3 karakter).', { fields: { reason: 'required' } });
  }
  if (reason.length > 500) throw new AppError('validation_failed', 'Alasan terlalu panjang (maksimal 500 karakter).', { fields: { reason: 'too_long' } });
  return reason;
}

async function assertWallet(db: Db, workspaceId: string, walletId: unknown, field = 'walletId'): Promise<{ id: string; name: string; accountId: string }> {
  if (typeof walletId !== 'string' || !walletId) {
    throw new AppError('validation_failed', 'Dompet wajib dipilih untuk mencatat perpindahan dana.', { fields: { [field]: 'required' } });
  }
  const row = await one<{ id: string; name: string; ledger_account_id: string; archived_at: string | null }>(
    db,
    `SELECT id, name, ledger_account_id, archived_at FROM wallets WHERE workspace_id = ? AND id = ?`,
    workspaceId, walletId,
  );
  if (!row) throw new AppError('not_found', 'Dompet tidak ditemukan di ruang keuangan ini.');
  if (row.archived_at) throw new AppError('validation_failed', 'Dompet ini sudah diarsipkan. Pilih dompet aktif.', { fields: { [field]: 'archived' } });
  return { id: row.id, name: row.name, accountId: row.ledger_account_id };
}

// ── pembacaan ───────────────────────────────────────────────────────────────

async function getDebtRow(db: Db, workspaceId: string, id: string): Promise<DebtRow> {
  const row = await one<DebtRow>(db, `SELECT * FROM debts WHERE workspace_id = ? AND id = ?`, workspaceId, id);
  if (!row) throw new AppError('not_found', 'Catatan utang atau piutang tidak ditemukan di ruang keuangan ini.');
  return row;
}

/** Bunga dan biaya yang masih tercatat: pembayaran yang sudah dibatalkan tidak dihitung. */
async function paidTotals(db: Db, workspaceId: string, debtId: string): Promise<{ principal: number; interest: number; fee: number }> {
  const row = await one<{ principal: number; interest: number; fee: number }>(
    db,
    `SELECT COALESCE(SUM(p.principal_minor), 0) AS principal,
            COALESCE(SUM(p.interest_minor), 0) AS interest,
            COALESCE(SUM(p.fee_minor), 0) AS fee
     FROM debt_payments p JOIN transactions t ON t.id = p.transaction_id
     WHERE p.workspace_id = ? AND p.debt_id = ? AND t.status = 'posted'`,
    workspaceId, debtId,
  );
  return {
    principal: Number(row?.principal ?? 0),
    interest: Number(row?.interest ?? 0),
    fee: Number(row?.fee ?? 0),
  };
}

async function counterpartyName(db: Db, workspaceId: string, counterpartyId: string | null): Promise<string | null> {
  if (!counterpartyId) return null;
  const row = await one<{ name: string }>(db, `SELECT name FROM counterparties WHERE workspace_id = ? AND id = ?`, workspaceId, counterpartyId);
  return row?.name ?? null;
}

async function buildDebtView(db: Db, workspaceId: string, row: DebtRow, today: string): Promise<DebtView> {
  const remaining = await accountBalance(db, workspaceId, row.ledger_account_id);
  const paid = await paidTotals(db, workspaceId, row.id);
  const overdue = row.status === 'active' && remaining > 0 && row.due_date !== null && compareDate(row.due_date, today) < 0;
  return {
    ...row,
    counterpartyName: await counterpartyName(db, workspaceId, row.counterparty_id),
    remaining,
    principalPaid: paid.principal,
    interestPaid: paid.interest,
    feePaid: paid.fee,
    overdue,
    daysToDue: row.due_date ? daysBetween(today, row.due_date) : null,
    dueLabel: row.due_date ? (overdue ? `Lewat jatuh tempo ${row.due_date}` : `Jatuh tempo ${row.due_date}`) : 'Belum ada jatuh tempo',
  };
}

export async function listDebts(ctx: TxContext, options: { direction?: DebtDirection; status?: DebtStatus; includeArchived?: boolean } = {}): Promise<DebtView[]> {
  const { db, workspaceId } = ctx;
  const where = ['workspace_id = ?'];
  const params: unknown[] = [workspaceId];
  if (options.direction) {
    where.push('direction = ?');
    params.push(options.direction);
  }
  if (options.status) {
    where.push('status = ?');
    params.push(options.status);
  }
  if (!options.includeArchived) where.push(`status <> 'archived'`);
  const rows = await all<DebtRow>(db, `SELECT * FROM debts WHERE ${where.join(' AND ')} ORDER BY due_date IS NULL, due_date, created_at`, ...params);
  const today = localDateInTz(ctx.timezone);
  const views: DebtView[] = [];
  for (const row of rows) {
    views.push(await buildDebtView(db, workspaceId, row, today));
  }
  return views;
}

export async function getDebt(ctx: TxContext, id: string): Promise<DebtDetail> {
  const { db, workspaceId } = ctx;
  const row = await getDebtRow(db, workspaceId, id);
  const today = localDateInTz(ctx.timezone);
  const payments = (await all<DebtPaymentRow & { transaction_status: string; note: string | null }>(
    db,
    `SELECT p.*, t.status AS transaction_status, t.note AS note
     FROM debt_payments p JOIN transactions t ON t.id = p.transaction_id
     WHERE p.workspace_id = ? AND p.debt_id = ?
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    workspaceId, id,
  )).map((payment) => ({
    id: payment.id,
    workspace_id: payment.workspace_id,
    debt_id: payment.debt_id,
    transaction_id: payment.transaction_id,
    principal_minor: payment.principal_minor,
    interest_minor: payment.interest_minor,
    fee_minor: payment.fee_minor,
    payment_date: payment.payment_date,
    created_at: payment.created_at,
    transactionStatus: payment.transaction_status,
    note: payment.note,
    cashAmount: row.direction === 'payable'
      ? addSafe(addSafe(payment.principal_minor, payment.interest_minor), payment.fee_minor)
      : addSafe(payment.principal_minor, payment.interest_minor) - payment.fee_minor,
  }));
  return { ...(await buildDebtView(db, workspaceId, row, today)), payments };
}

// ── FR09: membuat utang dan piutang ─────────────────────────────────────────

export interface CreateDebtInput {
  direction: DebtDirection | string;
  counterpartyName: string;
  principal: unknown;
  startDate?: string;
  dueDate?: string | null;
  note?: string | null;
  openingMode: OpeningMode | string;
  walletId?: string;
}

/**
 * Pencairan utang dan pemberian piutang memakai `type` sebagai label peristiwa; jurnal yang
 * menentukan dampaknya (§10): utang baru menaikkan kas dan kewajiban, piutang baru menurunkan
 * kas dan menaikkan aset piutang, sedangkan "Saldo lama" tidak menciptakan arus kas baru.
 */
export async function createDebt(ctx: TxContext, input: CreateDebtInput, idempotencyKey?: string | null): Promise<DebtView> {
  const { db, workspaceId } = ctx;
  const direction = assertDirection(input.direction);
  const counterpartyNameInput = assertCounterpartyName(input.counterpartyName);
  const principal = parseAmount(input.principal, { field: 'principal' });
  const openingMode = assertOpeningMode(input.openingMode);
  const today = localDateInTz(ctx.timezone);
  const startDate = input.startDate === undefined || input.startDate === null || input.startDate === ''
    ? today
    : assertIsoDate(input.startDate, 'startDate');
  const dueDate = assertOptionalDate(input.dueDate, 'dueDate');
  if (dueDate && compareDate(dueDate, startDate) < 0) {
    throw new AppError('validation_failed', 'Tanggal jatuh tempo tidak boleh sebelum tanggal mulai.', { fields: { dueDate: 'before_start' } });
  }
  const note = assertNote(input.note);
  const wallet = openingMode === 'cash' ? await assertWallet(db, workspaceId, input.walletId) : null;

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { ...input, direction, counterpartyName: counterpartyNameInput, principal, openingMode, startDate, dueDate } },
    () => tx(db, async () => {
      const existingParty = await one<{ id: string }>(
        db,
        `SELECT id FROM counterparties WHERE workspace_id = ? AND name = ? AND archived_at IS NULL`,
        workspaceId, counterpartyNameInput,
      );
      const counterpartyId = existingParty?.id ?? uuidv7();
      if (!existingParty) {
        await run(
          db,
          `INSERT INTO counterparties (id, workspace_id, name, contact, archived_at, created_at) VALUES (?, ?, ?, NULL, NULL, ?)`,
          counterpartyId, workspaceId, counterpartyNameInput, nowIso(),
        );
      }

      const debtId = uuidv7();
      const accountName = `${DIRECTION_LABEL[direction]}: ${counterpartyNameInput}`;
      const accountId = await createDebtAccount(db, workspaceId, debtId, direction, accountName);
      const now = nowIso();
      await run(
        db,
        `INSERT INTO debts (id, workspace_id, counterparty_id, ledger_account_id, direction, opening_mode,
                            principal_minor, start_date, due_date, note, reminder_off, status, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 1, ?, ?)`,
        debtId, workspaceId, counterpartyId, accountId, direction, openingMode,
        principal, startDate, dueDate, note, now, now,
      );

      // Catatan awal selalu dibukukan pada tanggal mulai: ini peristiwa yang sudah terjadi,
      // bukan rencana pengeluaran yang menunggu konfirmasi.
      if (openingMode === 'legacy') {
        const txId = await insertTransaction(db, {
          workspaceId, type: 'opening', status: 'posted', amount: principal, effectiveDate: startDate,
          note: `Saldo lama ${DIRECTION_LABEL[direction].toLowerCase()} kepada ${counterpartyNameInput}`,
          source: 'manual', userId: ctx.userId, idempotencyKey: null, counterpartyId,
          meta: { debtId, direction, openingMode },
        });
        await postJournal(db, {
          workspaceId, transactionId: txId,
          lines: buildLegacyOpening({
            debtAccountId: accountId,
            openingEquityAccountId: await systemAccountId(db, workspaceId, 'EQ-OPENING'),
            amount: principal,
            direction,
          }),
        });
      } else if (direction === 'payable') {
        const txId = await insertTransaction(db, {
          workspaceId, type: 'debt_received', status: 'posted', amount: principal, effectiveDate: startDate,
          note: `Dana utang diterima dari ${counterpartyNameInput}`,
          source: 'manual', userId: ctx.userId, idempotencyKey: null, counterpartyId,
          meta: { debtId, direction, walletId: wallet?.id },
        });
        await postJournal(db, {
          workspaceId, transactionId: txId,
          lines: buildDebtCashReceived({ walletAccountId: wallet!.accountId, debtAccountId: accountId, amount: principal }),
        });
      } else {
        const txId = await insertTransaction(db, {
          workspaceId, type: 'receivable_given', status: 'posted', amount: principal, effectiveDate: startDate,
          note: `Piutang diberikan kepada ${counterpartyNameInput}`,
          source: 'manual', userId: ctx.userId, idempotencyKey: null, counterpartyId,
          meta: { debtId, direction, walletId: wallet?.id },
        });
        await postJournal(db, {
          workspaceId, transactionId: txId,
          lines: buildReceivableGiven({ walletAccountId: wallet!.accountId, receivableAccountId: accountId, amount: principal }),
        });
      }

      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'create', entityType: 'debt', entityId: debtId,
        after: { direction, counterpartyName: counterpartyNameInput, principal, openingMode, startDate, dueDate },
      });
      return await buildDebtView(db, workspaceId, await getDebtRow(db, workspaceId, debtId), today);
    }),
  );
  return outcome.value;
}

// ── FR09 lanjutan: perubahan data catatan ───────────────────────────────────

export interface UpdateDebtInput {
  counterpartyName?: string;
  dueDate?: string | null;
  note?: string | null;
  reminderOff?: boolean;
  expectedVersion?: number;
}

export async function updateDebt(ctx: TxContext, id: string, input: UpdateDebtInput): Promise<DebtView> {
  const { db, workspaceId } = ctx;
  return tx(db, async () => {
    const row = await getDebtRow(db, workspaceId, id);
    if (input.expectedVersion !== undefined && input.expectedVersion !== row.version) {
      throw new AppError('version_conflict', 'Catatan ini sudah berubah di perangkat lain. Muat ulang lalu ulangi perubahan.', { details: { serverVersion: row.version } });
    }
    if (row.status === 'archived') {
      throw new AppError('validation_failed', 'Catatan ini sudah diarsipkan. Buka arsipnya dulu sebelum mengubah.');
    }
    const name = input.counterpartyName === undefined ? null : assertCounterpartyName(input.counterpartyName);
    const dueDate = input.dueDate === undefined ? row.due_date : assertOptionalDate(input.dueDate, 'dueDate');
    if (dueDate && compareDate(dueDate, row.start_date) < 0) {
      throw new AppError('validation_failed', 'Tanggal jatuh tempo tidak boleh sebelum tanggal mulai.', { fields: { dueDate: 'before_start' } });
    }
    const note = input.note === undefined ? row.note : assertNote(input.note);
    const reminderOff = input.reminderOff === undefined ? row.reminder_off : (input.reminderOff ? 1 : 0);

    if (name && row.counterparty_id) {
      await run(db, `UPDATE counterparties SET name = ? WHERE workspace_id = ? AND id = ?`, name, workspaceId, row.counterparty_id);
    }
    await run(
      db,
      `UPDATE debts SET due_date = ?, note = ?, reminder_off = ?, version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`,
      dueDate, note, reminderOff, nowIso(), workspaceId, id,
    );
    await recordAudit(db, {
      workspaceId, actorUserId: ctx.userId, action: 'update', entityType: 'debt', entityId: id,
      before: { counterpartyName: await counterpartyName(db, workspaceId, row.counterparty_id), dueDate: row.due_date, note: row.note, reminderOff: row.reminder_off },
      after: { counterpartyName: name ?? await counterpartyName(db, workspaceId, row.counterparty_id), dueDate, note, reminderOff },
    });
    return await buildDebtView(db, workspaceId, await getDebtRow(db, workspaceId, id), localDateInTz(ctx.timezone));
  });
}

// ── FR10: pembayaran sebagian atau penuh ────────────────────────────────────

export interface RecordDebtPaymentInput {
  principal: unknown;
  interest?: unknown;
  fee?: unknown;
  walletId: string;
  paymentDate?: string;
  note?: string | null;
}

export interface RecordDebtPaymentResult {
  payment: DebtPaymentView;
  debt: DebtDetail;
}

/**
 * Jumlah kas = pokok + bunga + biaya. Pokok mengurangi saldo kewajiban atau piutang; bunga dan
 * biaya diklasifikasikan terpisah (§10). Pembayaran yang membuat sisa pokok nol melunasi catatan.
 */
export async function recordDebtPayment(ctx: TxContext, id: string, input: RecordDebtPaymentInput, idempotencyKey?: string | null): Promise<RecordDebtPaymentResult> {
  const { db, workspaceId } = ctx;
  const principal = parseAmount(input.principal, { allowZero: true, field: 'principal' });
  const interest = input.interest === undefined || input.interest === null || input.interest === ''
    ? 0
    : parseAmount(input.interest, { allowZero: true, field: 'interest' });
  const fee = input.fee === undefined || input.fee === null || input.fee === ''
    ? 0
    : parseAmount(input.fee, { allowZero: true, field: 'fee' });
  const note = assertNote(input.note);
  const today = localDateInTz(ctx.timezone);
  const paymentDate = input.paymentDate === undefined || input.paymentDate === null || input.paymentDate === ''
    ? today
    : assertIsoDate(input.paymentDate, 'paymentDate');
  if (compareDate(paymentDate, today) > 0) {
    throw new AppError('validation_failed', 'Tanggal pembayaran tidak boleh di masa depan. Catat pembayaran pada tanggal dana benar-benar berpindah.', { fields: { paymentDate: 'future' } });
  }
  const wallet = await assertWallet(db, workspaceId, input.walletId);

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, principal, interest, fee, walletId: wallet.id, paymentDate, note } },
    () => tx(db, async () => {
      const debt = await getDebtRow(db, workspaceId, id);
      if (debt.status === 'written_off' || debt.status === 'archived') {
        throw new AppError('validation_failed', 'Catatan ini sudah ditutup, jadi pembayaran baru tidak dapat dicatat. Buat catatan baru bila ada kesepakatan baru.');
      }
      const remaining = await accountBalance(db, workspaceId, debt.ledger_account_id);
      if (principal > remaining) {
        throw new AppError(
          'insufficient_principal',
          `Pokok yang dibayar melebihi sisa pokok. Sisa pokok saat ini ${formatIDR(remaining)}.`,
          { details: { remaining, requested: principal } },
        );
      }
      const gross = addSafe(addSafe(principal, interest), fee);
      const cash = debt.direction === 'payable' ? gross : addSafe(principal, interest) - fee;
      if (cash <= 0) {
        throw new AppError('validation_failed', 'Jumlah kas yang berpindah harus lebih dari Rp0. Isi pokok, bunga, atau biaya.');
      }

      const isPayable = debt.direction === 'payable';
      const txId = await insertTransaction(db, {
        workspaceId,
        type: isPayable ? 'debt_payment' : 'receivable_payment',
        status: 'posted',
        amount: cash,
        effectiveDate: paymentDate,
        note: note ?? (isPayable ? 'Pembayaran utang' : 'Penerimaan piutang'),
        source: 'manual',
        userId: ctx.userId,
        idempotencyKey: null,
        counterpartyId: debt.counterparty_id,
        meta: { debtId: debt.id, walletId: wallet.id, principal, interest, fee },
      });
      await postJournal(db, {
        workspaceId, transactionId: txId,
        lines: isPayable
          ? buildDebtPayment({
              walletAccountId: wallet.accountId,
              debtAccountId: debt.ledger_account_id,
              principal, interest, fee,
              interestAccountId: await systemAccountId(db, workspaceId, 'EXP-INTEREST'),
              feeAccountId: await systemAccountId(db, workspaceId, 'EXP-FEE'),
            })
          : buildReceivableCollection({
              walletAccountId: wallet.accountId,
              receivableAccountId: debt.ledger_account_id,
              principal, interest, fee,
              interestAccountId: await systemAccountId(db, workspaceId, 'INC-INTEREST'),
              feeAccountId: await systemAccountId(db, workspaceId, 'EXP-FEE'),
            }),
      });

      const paymentId = uuidv7();
      await run(
        db,
        `INSERT INTO debt_payments (id, workspace_id, debt_id, transaction_id, principal_minor, interest_minor, fee_minor, payment_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        paymentId, workspaceId, debt.id, txId, principal, interest, fee, paymentDate, nowIso(),
      );

      const after = await accountBalance(db, workspaceId, debt.ledger_account_id);
      if (after === 0 && debt.status === 'active') {
        await run(db, `UPDATE debts SET status = 'paid', version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`, nowIso(), workspaceId, debt.id);
      }
      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'record_payment', entityType: 'debt', entityId: debt.id,
        before: { remaining }, after: { remaining: after, principal, interest, fee, paymentId, transactionId: txId },
      });

      const detail = await getDebt(ctx, debt.id);
      const payment = detail.payments.find((entry) => entry.id === paymentId);
      if (!payment) throw new AppError('internal', 'Pembayaran tersimpan tetapi tidak dapat dibaca kembali.');
      return { payment, debt: detail };
    }),
  );
  return outcome.value;
}

/**
 * Pembatalan pembayaran (FR10): membalik jurnal pembayaran dalam satu transaksi database,
 * sehingga kas kembali dan sisa pokok naik kembali secara atomik. Pembatalan lewat layar
 * transaksi umum sengaja ditolak agar selalu melalui layar utang ini.
 */
export async function cancelDebtPayment(
  ctx: TxContext,
  debtId: string,
  paymentId: string,
  input: { reason?: string } = {},
  idempotencyKey?: string | null,
): Promise<RecordDebtPaymentResult['debt']> {
  const { db, workspaceId } = ctx;
  const reason = input.reason === undefined ? null : assertReason(input.reason);
  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { debtId, paymentId, reason } },
    () => tx(db, async () => {
      const debt = await getDebtRow(db, workspaceId, debtId);
      const payment = await one<DebtPaymentRow>(
        db,
        `SELECT * FROM debt_payments WHERE workspace_id = ? AND id = ? AND debt_id = ?`,
        workspaceId, paymentId, debtId,
      );
      if (!payment) throw new AppError('not_found', 'Pembayaran ini tidak ditemukan pada catatan utang atau piutang tersebut.');
      const txRow = await one<{ id: string; status: string; version: number }>(
        db, `SELECT id, status, version FROM transactions WHERE workspace_id = ? AND id = ?`, workspaceId, payment.transaction_id,
      );
      if (!txRow) throw new AppError('internal', 'Transaksi pembayaran tidak ditemukan di buku besar.');
      if (txRow.status !== 'posted') {
        throw new AppError('validation_failed', 'Pembayaran ini sudah dibatalkan sebelumnya, tidak perlu dibatalkan lagi.');
      }
      const lines = await all<{ ledger_account_id: string; debit_minor: number; credit_minor: number }>(
        db, `SELECT ledger_account_id, debit_minor, credit_minor FROM journal_lines WHERE transaction_id = ? ORDER BY id`, txRow.id,
      );
      if (lines.length === 0) throw new AppError('internal', 'Pembayaran ini tidak memiliki baris jurnal untuk dibalik.');

      const now = nowIso();
      const reversalId = await insertTransaction(db, {
        workspaceId, type: 'reversal', status: 'posted', amount: lines.reduce((sum, line) => addSafe(sum, line.debit_minor), 0),
        effectiveDate: payment.payment_date,
        note: reason ? `Pembatalan pembayaran: ${reason}` : 'Pembatalan pembayaran utang atau piutang',
        source: 'system', userId: ctx.userId, idempotencyKey: null, originalId: txRow.id, reversalOf: txRow.id,
      });
      await postJournal(db, {
        workspaceId, transactionId: reversalId,
        lines: mirrorLines(lines.map((line) => ({ accountId: line.ledger_account_id, debit: line.debit_minor, credit: line.credit_minor }))),
      });
      await run(db, `UPDATE transactions SET status = 'reversed', version = version + 1, updated_at = ? WHERE id = ?`, now, txRow.id);
      await run(
        db,
        `INSERT OR IGNORE INTO transaction_links (id, workspace_id, source_tx_id, target_tx_id, relation_type, created_at)
         VALUES (?, ?, ?, ?, 'reversal_of', ?)`,
        uuidv7(), workspaceId, reversalId, txRow.id, now,
      );
      if (debt.status === 'paid') {
        await run(db, `UPDATE debts SET status = 'active', version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`, now, workspaceId, debtId);
      }
      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'cancel_payment', entityType: 'debt', entityId: debtId,
        after: { paymentId, reversalId, reason },
      });
      return await getDebt(ctx, debtId);
    }),
  );
  return outcome.value;
}

// ── §06: penghapusan non-kas ────────────────────────────────────────────────

export interface WriteOffDebtInput {
  reason: string;
  effectiveDate?: string;
}

/** Penghapusan saldo adalah penyesuaian non-kas dengan alasan dan audit terpisah (§06). */
export async function writeOffDebt(ctx: TxContext, id: string, input: WriteOffDebtInput, idempotencyKey?: string | null): Promise<DebtView> {
  const { db, workspaceId } = ctx;
  const reason = assertReason(input.reason);
  const effectiveDate = input.effectiveDate === undefined || input.effectiveDate === null || input.effectiveDate === ''
    ? localDateInTz(ctx.timezone)
    : assertIsoDate(input.effectiveDate, 'effectiveDate');

  const outcome = await withIdempotency(
    db,
    { workspaceId, userId: ctx.userId, key: idempotencyKey, payload: { id, reason, effectiveDate } },
    () => tx(db, async () => {
      const debt = await getDebtRow(db, workspaceId, id);
      if (debt.status !== 'active') {
        throw new AppError('validation_failed', 'Hanya catatan yang masih aktif yang dapat dihapus. Catatan ini sudah lunas atau sudah ditutup.');
      }
      const remaining = await accountBalance(db, workspaceId, debt.ledger_account_id);
      if (remaining <= 0) {
        throw new AppError('validation_failed', 'Tidak ada sisa pokok yang dapat dihapus pada catatan ini.');
      }
      const isPayable = debt.direction === 'payable';
      const txId = await insertTransaction(db, {
        workspaceId, type: 'adjustment', status: 'posted', amount: remaining, effectiveDate,
        note: `Penghapusan ${DIRECTION_LABEL[debt.direction].toLowerCase()}: ${reason}`,
        source: 'manual', userId: ctx.userId, idempotencyKey: null, counterpartyId: debt.counterparty_id,
        meta: { debtId: debt.id, reason },
      });
      await postJournal(db, {
        workspaceId, transactionId: txId,
        lines: isPayable
          ? buildWriteOffPayable({
              debtAccountId: debt.ledger_account_id,
              writeOffEquityAccountId: await systemAccountId(db, workspaceId, 'EQ-WRITEOFF'),
              amount: remaining,
            })
          : buildWriteOffReceivable({
              receivableAccountId: debt.ledger_account_id,
              writeOffEquityAccountId: await systemAccountId(db, workspaceId, 'EQ-WRITEOFF'),
              amount: remaining,
            }),
      });
      await run(db, `UPDATE debts SET status = 'written_off', version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ?`, nowIso(), workspaceId, id);
      await recordAudit(db, {
        workspaceId, actorUserId: ctx.userId, action: 'write_off', entityType: 'debt', entityId: id,
        before: { remaining, status: debt.status }, after: { status: 'written_off', reason, transactionId: txId },
      });
      return await buildDebtView(db, workspaceId, await getDebtRow(db, workspaceId, id), localDateInTz(ctx.timezone));
    }),
  );
  return outcome.value;
}

// ── FR11: daftar kewajiban yang mendekati jatuh tempo ───────────────────────

export async function upcomingDebts(ctx: TxContext, days = 7): Promise<DebtView[]> {
  const { db, workspaceId } = ctx;
  const today = localDateInTz(ctx.timezone);
  const horizon = addDays(today, Math.max(0, Math.trunc(days)));
  const rows = await all<DebtRow>(
    db,
    `SELECT * FROM debts
     WHERE workspace_id = ? AND status = 'active' AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?
     ORDER BY due_date, created_at`,
    workspaceId, today, horizon,
  );
  const views: DebtView[] = [];
  for (const row of rows) {
    const view = await buildDebtView(db, workspaceId, row, today);
    if (view.remaining > 0) views.push(view);
  }
  return views;
}
