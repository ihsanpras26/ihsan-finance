// routes/laporan/Laporan.tsx : period summary, category composition, cashflow, net worth, debts, goals.
// FR18: the chart always ships with its table; FR19: the CSV export uses the range shown on screen.
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type SummaryReport } from '../../lib/api.ts';
import { useAsync } from '../../lib/hooks.ts';
import { Button, ErrorState, LoadingRows, Money, PageHeader, SectionHead, useToast } from '../../components/ui.tsx';
import { errorMessage } from '../../components/forms/support.tsx';
import { formatDateShort, toMinor } from '../../lib/format.ts';
import { RangePicker } from './parts/RangePicker.tsx';
import { CategoryChart } from './parts/CategoryChart.tsx';
import { CashflowTables, ComparisonPanel, DebtTables, DeltaLine, GoalTable, NetWorthPanel } from './parts/ReportTables.tsx';
import { defaultRange, isRangeUsable, previousRange, resolveRange } from './parts/calc.ts';

export function LaporanPage() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(defaultRange);
  const [exporting, setExporting] = useState(false);

  const current = resolveRange(draft);
  const previous = previousRange(draft, current);
  const usable = isRangeUsable(current);

  const summary = useAsync(() => api.summary({ from: current.from, to: current.to }), [current.from, current.to], { enabled: usable });
  const compared = useAsync(() => api.summary({ from: previous.from, to: previous.to }), [previous.from, previous.to], { enabled: usable });
  const cashflow = useAsync(() => api.cashflow({ from: current.from, to: current.to }), [current.from, current.to], { enabled: usable });
  const netWorth = useAsync(() => api.netWorth({ asOf: current.to }), [current.to], { enabled: usable });
  const debts = useAsync(() => api.debtsReport({ includeArchived: false }), []);
  const goals = useAsync(() => api.goals(), []);

  async function downloadCsv() {
    setExporting(true);
    try {
      const job = await api.exportCsv({ from: current.from, to: current.to });
      const target = new URL(job.url, window.location.origin).toString();
      const link = document.createElement('a');
      link.href = target;
      link.download = `ihsan-transaksi-${current.from}-${current.to}.csv`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      push('success', `Unduhan CSV disiapkan: ${job.rows} baris untuk ${current.label}.`);
    } catch (caught) {
      push('error', `Ekspor gagal. ${errorMessage(caught)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan"
        subtitle={`Rentang aktif: ${current.label}.`}
        action={
          <Button variant="secondary" onClick={() => void downloadCsv()} loading={exporting} disabled={!usable}>
            Unduh CSV
          </Button>
        }
      />

      <RangePicker draft={draft} onChange={setDraft} />

      {!usable ? (
        <div className="rounded-panel border border-warn/50 px-4 py-3">
          <p className="text-sm text-fg">Rentang tanggal belum benar. Tanggal mulai harus lebih dulu dari tanggal akhir, dan keduanya harus terisi.</p>
          <p className="mt-1 text-xs text-muted">Perbaiki rentang di atas untuk memuat laporan.</p>
        </div>
      ) : (
        <>
          <section>
            <SectionHead title={`Ringkasan ${current.label}`} />
            {summary.loading && !summary.data ? <LoadingRows rows={4} label="Memuat ringkasan periode" /> : null}
            {summary.error ? <ErrorState message={summary.error.display} onRetry={summary.reload} /> : null}
            {summary.data ? (
              <>
                <SummaryPanel report={summary.data} />
                <ComparisonPanel current={current} previous={previous}>
                  {compared.loading && !compared.data ? <LoadingRows rows={3} label="Memuat periode pembanding" /> : null}
                  {compared.error ? <ErrorState message={compared.error.display} onRetry={compared.reload} /> : null}
                  {compared.data ? (
                    <>
                      <DeltaLine label="Pendapatan" current={summary.data.income} previous={compared.data.income} previousLabel={previous.label} />
                      <DeltaLine label="Pengeluaran" current={summary.data.expense} previous={compared.data.expense} previousLabel={previous.label} />
                      <DeltaLine label="Neto" current={summary.data.net} previous={compared.data.net} previousLabel={previous.label} />
                      <p className="mt-2 text-xs text-muted">
                        Angka pembanding diambil dari {formatDateShort(previous.from)} sampai {formatDateShort(previous.to)}.
                      </p>
                    </>
                  ) : null}
                </ComparisonPanel>
              </>
            ) : null}
          </section>

          {summary.data ? (
            <>
              <CategoryChart
                items={summary.data.categoryBreakdown}
                kind="expense"
                title="Komposisi pengeluaran per kategori"
                total={summary.data.expense}
                emptyBody="Belum ada pengeluaran pada periode ini."
              />
              <CategoryChart
                items={summary.data.categoryBreakdown}
                kind="income"
                title="Komposisi pendapatan per kategori"
                total={summary.data.income}
                emptyBody="Belum ada pendapatan pada periode ini."
              />
            </>
          ) : null}

          <section>
            {cashflow.loading && !cashflow.data ? <LoadingRows rows={4} label="Memuat arus kas" /> : null}
            {cashflow.error ? <ErrorState message={cashflow.error.display} onRetry={cashflow.reload} /> : null}
            {cashflow.data ? <CashflowTables report={cashflow.data} /> : null}
          </section>

          <section>
            {netWorth.loading && !netWorth.data ? <LoadingRows rows={4} label="Memuat kekayaan bersih" /> : null}
            {netWorth.error ? <ErrorState message={netWorth.error.display} onRetry={netWorth.reload} /> : null}
            {netWorth.data ? <NetWorthPanel report={netWorth.data} /> : null}
          </section>

          <section>
            {debts.loading && !debts.data ? <LoadingRows rows={3} label="Memuat daftar utang" /> : null}
            {debts.error ? <ErrorState message={debts.error.display} onRetry={debts.reload} /> : null}
            {debts.data ? (
              <DebtTables
                report={debts.data}
                emptyAction={
                  <Button variant="secondary" onClick={() => void navigate('/rencana')}>
                    Catat utang di Rencana
                  </Button>
                }
              />
            ) : null}
          </section>

          <section>
            {goals.loading && !goals.data ? <LoadingRows rows={3} label="Memuat daftar tujuan" /> : null}
            {goals.error ? <ErrorState message={goals.error.display} onRetry={goals.reload} /> : null}
            {goals.data ? (
              <GoalTable
                goals={goals.data}
                emptyAction={
                  <Button variant="secondary" onClick={() => void navigate('/rencana')}>
                    Buat tujuan di Rencana
                  </Button>
                }
              />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryPanel({ report }: { report: SummaryReport }) {
  const net = toMinor(report.net);
  return (
    <div className="rounded-panel border border-hairline bg-raised px-4 py-4">
      <p className="text-xs text-muted">Neto {report.period.label}</p>
      <Money value={Math.abs(net)} direction={net > 0 ? 'in' : net < 0 ? 'out' : 'zero'} size="xl" />

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Figure label="Pendapatan">
          <Money value={report.income} direction="in" />
        </Figure>
        <Figure label="Pengeluaran">
          <Money value={report.expense} direction="out" />
        </Figure>
        <Figure label="Saldo awal periode">
          <Money value={report.openingBalance} />
        </Figure>
        <Figure label="Saldo akhir periode">
          <Money value={report.closingBalance} />
        </Figure>
      </div>

      <p className="mt-3 text-xs text-muted">
        Rentang dihitung dari tanggal efektif {formatDateShort(report.period.start)} sampai {formatDateShort(report.period.end)}. Pokok pinjaman, pokok piutang, transfer,
        saldo awal, dan penyesuaian saldo tidak dihitung sebagai pendapatan atau pengeluaran.
      </p>
    </div>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-base font-semibold text-fg">{children}</span>
    </div>
  );
}
