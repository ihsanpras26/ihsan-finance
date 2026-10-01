// http/routes/reports.ts: FR18 reports and FR19 export.
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { AppError } from '../../core/errors.ts';
import { toDecimalString } from '../../core/money.ts';
import type { Db } from '../../db/index.ts';
import { contextFor } from '../../domain/workspaces.ts';
import {
  cashflowReport, categoryBreakdown, ledgerNetWorth, netWorthOf, netWorthReport, periodOf, summaryReport,
} from '../../domain/reports.ts';
import { exportCsv, exportFull, getJob, listJobs, storeCsvJob } from '../../domain/export.ts';

export interface RouteDeps { db: Db }

export async function registerReportRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { db } = deps;

  app.get('/reports/summary', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as Record<string, string | undefined>;
    const report = await summaryReport(ctx, {
      period: query.period,
      from: query.from,
      to: query.to,
      compare: query.compare === 'true',
    });
    return {
      data: {
        period: report.period,
        income: toDecimalString(report.income),
        expense: toDecimalString(report.expense),
        net: toDecimalString(report.net),
        openingBalance: toDecimalString(report.openingBalance),
        closingBalance: toDecimalString(report.closingBalance),
        netWorth: toDecimalString(report.netWorth),
        categoryBreakdown: report.categoryBreakdown.map((row) => ({
          categoryId: row.categoryId,
          name: row.name,
          kind: row.kind,
          amount: toDecimalString(row.amount),
          share: row.share,
        })),
        comparison: report.comparison
          ? {
              label: report.comparison.label,
              income: toDecimalString(report.comparison.income),
              expense: toDecimalString(report.comparison.expense),
              net: toDecimalString(report.comparison.net),
            }
          : null,
        crossCheck: toDecimalString(await ledgerNetWorth(ctx)),
      },
    };
  });

  app.get('/reports/categories', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as Record<string, string | undefined>;
    const period = periodOf(ctx, { period: query.period, from: query.from, to: query.to });
    const kind = query.kind === 'income' ? 'income' : 'expense';
    return {
      data: {
        period,
        items: (await categoryBreakdown(ctx, period, kind)).map((row) => ({
          categoryId: row.categoryId,
          name: row.name,
          kind: row.kind,
          amount: toDecimalString(row.amount),
          share: row.share,
        })),
      },
    };
  });

  app.get('/reports/cashflow', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as Record<string, string | undefined>;
    const report = await cashflowReport(ctx, { period: query.period, from: query.from, to: query.to });
    return {
      data: {
        period: report.period,
        opening: toDecimalString(report.opening),
        closing: toDecimalString(report.closing),
        change: toDecimalString(report.change),
        buckets: report.buckets.map((row) => ({
          label: row.label,
          inflow: toDecimalString(row.inflow),
          outflow: toDecimalString(row.outflow),
          net: toDecimalString(row.net),
        })),
        byActivity: report.byActivity.map((row) => ({ label: row.label, amount: toDecimalString(row.amount), kind: row.kind })),
        wallets: report.wallets.map((row) => ({
          walletId: row.walletId,
          name: row.name,
          opening: toDecimalString(row.opening),
          closing: toDecimalString(row.closing),
          change: toDecimalString(row.change),
        })),
      },
    };
  });

  app.get('/reports/networth', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const query = request.query as Record<string, string | undefined>;
    const report = await netWorthReport(ctx, query.asOf);
    return {
      data: {
        asOf: report.asOf,
        cash: toDecimalString(report.cash),
        receivable: toDecimalString(report.receivable),
        payable: toDecimalString(report.payable),
        netWorth: toDecimalString(report.netWorth),
        wallets: report.wallets.map((row) => ({
          id: row.id,
          name: row.name,
          balance: toDecimalString(row.balance),
          archived: row.archived,
        })),
        debts: report.debts.map((row) => ({ ...row, remaining: toDecimalString(row.remaining) })),
        crossCheck: toDecimalString(await ledgerNetWorth(ctx)),
      },
    };
  });

  app.get('/reports/networth-check', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const derived = await netWorthOf(ctx);
    const ledger = await ledgerNetWorth(ctx);
    return { data: { derived, ledger, match: derived === ledger } };
  });

  // ── export ────────────────────────────────────────────────────────────────
  app.post('/export/csv', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const result = await exportCsv(ctx, {
      from: typeof body.from === 'string' ? body.from : undefined,
      to: typeof body.to === 'string' ? body.to : undefined,
    });
    const stored = await storeCsvJob(ctx, result);
    return { data: { jobId: stored.jobId, url: `/api/v1/export/jobs/${stored.jobId}`, rows: result.rows, bytes: stored.bytes, filename: result.filename } };
  });

  app.post('/export/full', async (request) => {
    const session = request.session!;
    const ctx = contextFor(db, session);
    const stored = await exportFull(ctx);
    return { data: { jobId: stored.jobId, url: `/api/v1/export/jobs/${stored.jobId}`, bytes: stored.bytes } };
  });

  app.get('/export/jobs', async (request) => {
    const session = request.session!;
    return { data: await listJobs(contextFor(db, session)) };
  });

  app.get('/export/jobs/:id', async (request, reply) => {
    const session = request.session!;
    const { id } = request.params as { id: string };
    const job = await getJob(db, session.workspaceId, id);
    if (!job || !job.path) throw new AppError('not_found', 'Berkas ekspor tidak ditemukan atau sudah kedaluwarsa. Buat ekspor baru.');
    const body = readFileSync(job.path);
    const filename = job.kind === 'csv_export' ? 'ihsan-transaksi.csv' : 'ihsan-cadangan.json';
    return reply
      .type(job.kind === 'csv_export' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Cache-Control', 'no-store')
      .send(body);
  });
}
