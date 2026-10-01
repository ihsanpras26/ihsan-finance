// test/ledger.test.ts: the engine must balance before anything else is trusted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, makeWorkspace, type TestCtx } from './helpers.ts';
import { tx, run, one } from '../src/db/index.ts';
import {
  ensureSystemAccounts, systemAccountId, createWalletAccount, postJournal, walletBalance,
  accountBalance, assertBalanced, verifyIntegrity, classTotal, balancesByClass,
} from '../src/domain/ledger.ts';
import { uuidv7, nowIso } from '../src/core/ids.ts';

async function newWallet(ctx: TestCtx, name: string, type: 'cash' | 'bank' | 'ewallet' = 'bank'): Promise<string> {
  const id = uuidv7();
  const accountId = await createWalletAccount(ctx.db, ctx.workspaceId, id, name);
  await run(
    ctx.db,
    `INSERT INTO wallets (id, workspace_id, ledger_account_id, name, type, opened_on, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '2026-01-01', 1, ?, ?)`,
    id, ctx.workspaceId, accountId, name, type, nowIso(), nowIso(),
  );
  return id;
}

async function post(ctx: TestCtx, type: string, date: string, lines: Parameters<typeof postJournal>[1]['lines']): Promise<string> {
  const txId = uuidv7();
  return tx(ctx.db, async () => {
    await run(
      ctx.db,
      `INSERT INTO transactions (id, workspace_id, type, status, amount_minor, currency, effective_date, source, version, created_at, updated_at)
       VALUES (?, ?, ?, 'posted', ?, 'IDR', ?, 'manual', 1, ?, ?)`,
      txId, ctx.workspaceId, type, lines.reduce((s, l) => s + (l.debit ?? 0), 0), date, nowIso(), nowIso(),
    );
    await postJournal(ctx.db, { workspaceId: ctx.workspaceId, transactionId: txId, lines });
    return txId;
  });
}

test('jurnal seimbang: saldo awal + pendapatan - pengeluaran', async () => {
  const ctx = await makeWorkspace(await makeDb());
  const bank = await newWallet(ctx, 'Bank');
  const walletAccount = (await one<{ a: string }>(ctx.db, `SELECT ledger_account_id AS a FROM wallets WHERE id = ?`, bank))!;
  const opening = await systemAccountId(ctx.db, ctx.workspaceId, 'EQ-OPENING');
  const expenseAccount = await systemAccountId(ctx.db, ctx.workspaceId, 'EXP-FEE');
  const incomeAccount = await systemAccountId(ctx.db, ctx.workspaceId, 'INC-INTEREST');

  await post(ctx, 'opening', '2026-01-01', [{ accountId: walletAccount.a, debit: 1_000_000 }, { accountId: opening, credit: 1_000_000 }]);
  await post(ctx, 'income', '2026-01-02', [{ accountId: walletAccount.a, debit: 5_000_000 }, { accountId: incomeAccount, credit: 5_000_000 }]);
  await post(ctx, 'expense', '2026-01-03', [{ accountId: expenseAccount, debit: 100_000 }, { accountId: walletAccount.a, credit: 100_000 }]);

  assert.equal(await walletBalance(ctx.db, ctx.workspaceId, bank), 5_900_000, 'AT01: saldo bank Rp5.900.000');
  assert.equal(await accountBalance(ctx.db, ctx.workspaceId, incomeAccount), 5_000_000, 'pendapatan Rp5.000.000');
  assert.equal(await accountBalance(ctx.db, ctx.workspaceId, expenseAccount), 100_000, 'pengeluaran Rp100.000');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', '2026-01-01', '2026-01-31'), 5_000_000);
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-01-01', '2026-01-31'), 100_000);
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'equity', '2026-01-01', '2026-01-31'), 1_000_000, 'saldo awal masuk ekuitas, bukan pendapatan');

  const report = await verifyIntegrity(ctx.db, ctx.workspaceId);
  assert.equal(report.ok, true, `integritas ledger: ${report.problems.join('; ')}`);
});

test('jurnal tidak seimbang ditolak', () => {
  assert.throws(() => assertBalanced([{ accountId: 'a', debit: 100 }, { accountId: 'b', credit: 99 }]), /tidak seimbang/i);
  assert.throws(() => assertBalanced([{ accountId: 'a', debit: 100, credit: 100 }, { accountId: 'b', credit: 100 }]), /tepat satu sisi/i);
  assert.throws(() => assertBalanced([{ accountId: 'a', debit: 100 }]), /dua baris/i);
  assert.throws(() => assertBalanced([{ accountId: 'a', debit: 0 }, { accountId: 'b', credit: 0 }]), /tepat satu sisi/i);
});

test('transfer tidak menambah pendapatan atau konsumsi (AT02)', async () => {
  const ctx = await makeWorkspace(await makeDb());
  const bank = await newWallet(ctx, 'Bank');
  const ewallet = await newWallet(ctx, 'E-wallet', 'ewallet');
  const bankAcc = (await one<{ a: string }>(ctx.db, `SELECT ledger_account_id AS a FROM wallets WHERE id = ?`, bank))!.a;
  const ewAcc = (await one<{ a: string }>(ctx.db, `SELECT ledger_account_id AS a FROM wallets WHERE id = ?`, ewallet))!.a;
  const opening = await systemAccountId(ctx.db, ctx.workspaceId, 'EQ-OPENING');
  const fee = await systemAccountId(ctx.db, ctx.workspaceId, 'EXP-FEE');

  await post(ctx, 'opening', '2026-02-01', [{ accountId: bankAcc, debit: 1_000_000 }, { accountId: opening, credit: 1_000_000 }]);
  await post(ctx, 'transfer', '2026-02-02', [
    { accountId: ewAcc, debit: 500_000 },
    { accountId: bankAcc, credit: 500_000 },
  ]);
  await post(ctx, 'transfer', '2026-02-02', [
    { accountId: fee, debit: 2_500 },
    { accountId: bankAcc, credit: 2_500 },
  ]);

  assert.equal(await walletBalance(ctx.db, ctx.workspaceId, bank), 497_500, 'AT02: bank Rp497.500');
  assert.equal(await walletBalance(ctx.db, ctx.workspaceId, ewallet), 500_000, 'AT02: e-wallet Rp500.000');
  const totalCash = (await balancesByClass(ctx.db, ctx.workspaceId, 'asset')).filter((a) => a.code.startsWith('A-WALLET')).reduce((s, a) => s + a.balance, 0);
  assert.equal(totalCash, 997_500, 'AT02: total kas Rp997.500');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'income', '2026-02-01', '2026-02-28'), 0, 'transfer bukan pendapatan');
  assert.equal(await classTotal(ctx.db, ctx.workspaceId, 'expense', '2026-02-01', '2026-02-28'), 2_500, 'AT02: konsumsi hanya biaya Rp2.500');
});

test('reversal saling meniadakan dan tetap tersedia di histori', async () => {
  const ctx = await makeWorkspace(await makeDb());
  const bank = await newWallet(ctx, 'Bank');
  const bankAcc = (await one<{ a: string }>(ctx.db, `SELECT ledger_account_id AS a FROM wallets WHERE id = ?`, bank))!.a;
  const opening = await systemAccountId(ctx.db, ctx.workspaceId, 'EQ-OPENING');

  const original = await post(ctx, 'income', '2026-03-01', [{ accountId: bankAcc, debit: 250_000 }, { accountId: opening, credit: 250_000 }]);
  assert.equal(await walletBalance(ctx.db, ctx.workspaceId, bank), 250_000);

  // reversal mirrors the original lines
  await post(ctx, 'reversal', '2026-03-01', [{ accountId: bankAcc, credit: 250_000 }, { accountId: opening, debit: 250_000 }]);
  await run(ctx.db, `UPDATE transactions SET status = 'reversed' WHERE id = ?`, original);

  assert.equal(await walletBalance(ctx.db, ctx.workspaceId, bank), 0, 'pembalikan meniadakan transaksi asal');
  const history = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM transactions WHERE workspace_id = ?`, ctx.workspaceId))!;
  assert.equal(history.n, 2, 'transaksi asal dan pembaliknya tetap ada');
  assert.equal((await verifyIntegrity(ctx.db, ctx.workspaceId)).ok, true);
});

test('ensureSystemAccounts idempoten', async () => {
  const ctx = await makeWorkspace(await makeDb());
  await ensureSystemAccounts(ctx.db, ctx.workspaceId);
  await ensureSystemAccounts(ctx.db, ctx.workspaceId);
  const rows = (await one<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM ledger_accounts WHERE workspace_id = ?`, ctx.workspaceId))!;
  assert.equal(rows.n, 6, 'enam akun sistem, tanpa duplikat');
});
