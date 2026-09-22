// domain/posting.ts: line builders for every event in PRD §10. One place, so no module invents its own entries.
import type { JournalLineInput } from './ledger.ts';

export function buildOpening(input: { walletAccountId: string; openingEquityAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.walletAccountId, debit: input.amount },
    { accountId: input.openingEquityAccountId, credit: input.amount },
  ];
}

export function buildIncome(input: { walletAccountId: string; categoryAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.walletAccountId, debit: input.amount },
    { accountId: input.categoryAccountId, credit: input.amount },
  ];
}

export function buildExpense(input: { walletAccountId: string; categoryAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.categoryAccountId, debit: input.amount },
    { accountId: input.walletAccountId, credit: input.amount },
  ];
}

export function buildTransfer(input: { fromAccountId: string; toAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.toAccountId, debit: input.amount },
    { accountId: input.fromAccountId, credit: input.amount },
  ];
}

export function buildTransferFee(input: { fromAccountId: string; feeAccountId: string; fee: number }): JournalLineInput[] {
  return [
    { accountId: input.feeAccountId, debit: input.fee },
    { accountId: input.fromAccountId, credit: input.fee },
  ];
}

/** Refund reduces the expense on the date the money comes back (PRD §10). */
export function buildRefund(input: { walletAccountId: string; categoryAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.walletAccountId, debit: input.amount },
    { accountId: input.categoryAccountId, credit: input.amount },
  ];
}

/** Borrowing: cash up, liability up. Never income. */
export function buildDebtCashReceived(input: { walletAccountId: string; debtAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.walletAccountId, debit: input.amount },
    { accountId: input.debtAccountId, credit: input.amount },
  ];
}

/** Lending: cash down, receivable up. Never consumption. */
export function buildReceivableGiven(input: { walletAccountId: string; receivableAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.receivableAccountId, debit: input.amount },
    { accountId: input.walletAccountId, credit: input.amount },
  ];
}

/** Legacy opening balance: no cash movement, only the obligation/claim appears. */
export function buildLegacyOpening(input: { debtAccountId: string; openingEquityAccountId: string; amount: number; direction: 'payable' | 'receivable' }): JournalLineInput[] {
  return input.direction === 'payable'
    ? [
        { accountId: input.openingEquityAccountId, debit: input.amount },
        { accountId: input.debtAccountId, credit: input.amount },
      ]
    : [
        { accountId: input.debtAccountId, debit: input.amount },
        { accountId: input.openingEquityAccountId, credit: input.amount },
      ];
}

/** Debt payment: principal lowers the liability, interest and fee are consumption, cash leaves once. */
export function buildDebtPayment(input: {
  walletAccountId: string; debtAccountId: string; principal: number; interest: number; fee: number;
  interestAccountId: string; feeAccountId: string;
}): JournalLineInput[] {
  const lines: JournalLineInput[] = [];
  if (input.principal > 0) lines.push({ accountId: input.debtAccountId, debit: input.principal });
  if (input.interest > 0) lines.push({ accountId: input.interestAccountId, debit: input.interest });
  if (input.fee > 0) lines.push({ accountId: input.feeAccountId, debit: input.fee });
  lines.push({ accountId: input.walletAccountId, credit: input.principal + input.interest + input.fee });
  return lines;
}

/** Receivable collection: principal lowers the claim, interest is income, cash arrives once. */
export function buildReceivableCollection(input: {
  walletAccountId: string; receivableAccountId: string; principal: number; interest: number; fee: number;
  interestAccountId: string; feeAccountId: string;
}): JournalLineInput[] {
  const total = input.principal + input.interest - input.fee;
  const lines: JournalLineInput[] = [];
  lines.push({ accountId: input.walletAccountId, debit: total });
  if (input.principal > 0) lines.push({ accountId: input.receivableAccountId, credit: input.principal });
  if (input.interest > 0) lines.push({ accountId: input.interestAccountId, credit: input.interest });
  if (input.fee > 0) lines.push({ accountId: input.feeAccountId, debit: input.fee });
  return lines;
}

/** Reconciliation difference. Not income, not consumption (PRD FR03). */
export function buildAdjustment(input: { walletAccountId: string; adjustmentEquityAccountId: string; difference: number }): JournalLineInput[] {
  if (input.difference > 0) {
    return [
      { accountId: input.walletAccountId, debit: input.difference },
      { accountId: input.adjustmentEquityAccountId, credit: input.difference },
    ];
  }
  return [
    { accountId: input.adjustmentEquityAccountId, debit: Math.abs(input.difference) },
    { accountId: input.walletAccountId, credit: Math.abs(input.difference) },
  ];
}

/** Write-off is non-cash: the obligation or claim disappears against equity (PRD §06). */
export function buildWriteOffPayable(input: { debtAccountId: string; writeOffEquityAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.debtAccountId, debit: input.amount },
    { accountId: input.writeOffEquityAccountId, credit: input.amount },
  ];
}

export function buildWriteOffReceivable(input: { receivableAccountId: string; writeOffEquityAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.writeOffEquityAccountId, debit: input.amount },
    { accountId: input.receivableAccountId, credit: input.amount },
  ];
}

/** Goal spending: the money really leaves the wallet and becomes consumption. */
export function buildGoalSpend(input: { walletAccountId: string; categoryAccountId: string; amount: number }): JournalLineInput[] {
  return [
    { accountId: input.categoryAccountId, debit: input.amount },
    { accountId: input.walletAccountId, credit: input.amount },
  ];
}

/** A reversal mirrors the original lines exactly, so the pair nets to zero. */
export function mirrorLines(lines: readonly JournalLineInput[]): JournalLineInput[] {
  return lines.map((line) => ({ accountId: line.accountId, debit: line.credit ?? 0, credit: line.debit ?? 0 }));
}
