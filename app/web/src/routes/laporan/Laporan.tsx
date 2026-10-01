// routes/laporan/Laporan.tsx : ringkasan periode, komposisi kategori, arus kas, kekayaan bersih,
// utang piutang, dan tujuan.
// FR18: setiap grafik tampil bersama tabel nilai tepatnya, dan setiap angka pembanding disebut
// tanggalnya. FR19: ekspor CSV memakai rentang yang sedang tampil.
// v3 shape: rentang di paling atas, lalu ringkasan dan pembandingnya, komposisi kategori, arus kas
// (12 bulan penuh lalu rincian periode), aset bersih, utang piutang, dan tujuan.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type SummaryReport } from '../../lib/api.ts';
import { useAsync } from '../../lib/hooks.ts';
import { Button, Card, CardHead, ErrorState, LoadingRows, Money, MoneyStat, PageHeader, useToast } from '../../components/ui.tsx';
import { IconDownload } from '../../components/icons.tsx';
import { errorMessage } from '../../components/forms/support.tsx';
import { useShell } from '../../components/layout/AppShell.tsx';
import { formatDateShort, toMinor } from '../../lib/format.ts';
import { RangePicker } from './parts/RangePicker.tsx';
import { CategoryChart } from './parts/CategoryChart.tsx';
import {
  CashflowTables, ComparisonPanel, DebtTables, DeltaLine, GoalTable, MonthlyCashflowCard, NetWorthPanel,
} from './parts/ReportTables.tsx';
import { comparisonPeriodName, defaultRange, directionOf, isRangeUsable, monthlyWindow, resolveRange } from './parts/calc.ts';

export function LaporanPage() {
  const { push } = useToast();
  const { openQuickEntry } = useShell();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(defaultRange);
  const [exporting, setExporting] = useState(false);

  const current = resolveRange(draft);
  const usable = isRangeUsable(current);
  // Grafik arus kas butuh jendela 12 bulan penuh: server hanya membucket per bulan bila rentangnya
  // lebih panjang dari satu bulan, dan bulan tanpa pergerakan tetap ditampilkan bernilai nol.
  const monthlySpan = monthlyWindow(current.to);

  const summary = useAsync(() => api.summary({ from: current.from, to: current.to, compare: true }), [current.from, current.to], { enabled: usable });
  const monthly = useAsync(() => api.cashflow({ from: monthlySpan.from, to: monthlySpan.to }), [monthlySpan.from, monthlySpan.to], { enabled: usable });
  const cashflow = useAsync(() => api.cashflow({ from: current.from, to: current.to }), [current.from, current.to], { enabled: usable });
  const netWorth = useAsync(() => api.netWorth({ asOf: current.to }), [current.to], { enabled: usable });
  const debts = useAsync(() => api.debtsReport({ includeArchived: false }), []);
  const goals = useAsync(() => api.goals(), []);

  const comparison = summary.data?.comparison ?? null;
  const comparisonLabel = comparison ? comparisonPeriodName(comparison.label) : '';

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
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Laporan"
        subtitle={`Rentang aktif: ${current.label}.`}
        action={
          <Button onClick={() => void downloadCsv()} loading={exporting} disabled={!usable}>
            <IconDownload size={18} />
            Unduh CSV
          </Button>
        }
      />

      <RangePicker draft={draft} onChange={setDraft} />

      {!usable ? (
        <ErrorState message="Rentang tanggal belum benar. Tanggal mulai harus lebih dulu dari tanggal akhir, dan keduanya harus terisi.">
          <p className="text-xs text-muted">Perbaiki rentang di atas untuk memuat laporan.</p>
        </ErrorState>
      ) : (
        <>
          {summary.loading && !summary.data ? <LoadingRows rows={4} label="Memuat ringkasan periode" /> : null}
          {summary.error ? <ErrorState message={summary.error.display} onRetry={summary.reload} /> : null}
          {summary.data ? (
            <>
              <SummaryPanel report={summary.data} label={current.label} from={current.from} to={current.to} />

              <ComparisonPanel comparison={comparison}>
                {comparison ? (
                  <>
                    <DeltaLine label="Pendapatan" current={summary.data.income} previous={comparison.income} previousLabel={comparisonLabel} direction="in" />
                    <DeltaLine label="Pengeluaran" current={summary.data.expense} previous={comparison.expense} previousLabel={comparisonLabel} direction="out" />
                    <DeltaLine label="Neto" current={summary.data.net} previous={comparison.net} previousLabel={comparisonLabel} direction={directionOf(summary.data.net)} />
                  </>
                ) : (
                  <li className="py-3 text-sm text-muted">Periode pembanding belum tersedia untuk rentang ini.</li>
                )}
              </ComparisonPanel>

              <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
                <CategoryChart
                  items={summary.data.categoryBreakdown}
                  kind="expense"
                  title="Komposisi pengeluaran per kategori"
                  total={summary.data.expense}
                  emptyBody="Belum ada pengeluaran pada periode ini. Catat pengeluaran lewat tombol tambah supaya komposisinya terisi."
                  emptyAction={
                    <Button variant="secondary" onClick={() => openQuickEntry({ type: 'expense' })}>
                      Catat pengeluaran
                    </Button>
                  }
                />
                <CategoryChart
                  items={summary.data.categoryBreakdown}
                  kind="income"
                  title="Komposisi pendapatan per kategori"
                  total={summary.data.income}
                  emptyBody="Belum ada pendapatan pada periode ini. Catat pendapatan lewat tombol tambah supaya komposisinya terisi."
                  emptyAction={
                    <Button variant="secondary" onClick={() => openQuickEntry({ type: 'income' })}>
                      Catat pendapatan
                    </Button>
                  }
                />
              </div>
            </>
          ) : null}

          {monthly.loading && !monthly.data ? <LoadingRows rows={4} label="Memuat arus kas 12 bulan terakhir" /> : null}
          {monthly.error ? <ErrorState message={monthly.error.display} onRetry={monthly.reload} /> : null}
          {monthly.data ? (
            <MonthlyCashflowCard
              window={monthlySpan}
              buckets={monthly.data.buckets}
              emptyAction={
                <Button variant="secondary" onClick={() => openQuickEntry()}>
                  Catat transaksi
                </Button>
              }
            />
          ) : null}

          {cashflow.loading && !cashflow.data ? <LoadingRows rows={4} label="Memuat arus kas periode" /> : null}
          {cashflow.error ? <ErrorState message={cashflow.error.display} onRetry={cashflow.reload} /> : null}
          {cashflow.data ? <CashflowTables report={cashflow.data} /> : null}

          {netWorth.loading && !netWorth.data ? <LoadingRows rows={4} label="Memuat kekayaan bersih" /> : null}
          {netWorth.error ? <ErrorState message={netWorth.error.display} onRetry={netWorth.reload} /> : null}
          {netWorth.data ? (
            <NetWorthPanel
              report={netWorth.data}
              emptyAction={
                <Button variant="secondary" onClick={() => void navigate('/profil')}>
                  Atur dompet di Profil
                </Button>
              }
            />
          ) : null}

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
        </>
      )}
    </div>
  );
}

/** Saldo bukan uang masuk atau keluar: hanya saldo negatif yang diberi tanda. */
function balanceDirection(value: string): 'in' | 'out' | 'zero' {
  return toMinor(value) < 0 ? 'out' : 'zero';
}

/** SummaryPanel: neto periode sebagai angka fokus, empat angka pendukungnya di bawah sekali jalan. */
function SummaryPanel({ report, label, from, to }: { report: SummaryReport; label: string; from: string; to: string }) {
  const net = toMinor(report.net);
  return (
    <Card className="px-4 py-4">
      <CardHead
        title={`Ringkasan ${label}`}
        action={
          <Link
            to={`/transaksi?from=${from}&to=${to}`}
            className="inline-flex min-h-[44px] items-center rounded-control px-3 text-sm font-semibold text-accent"
          >
            Lihat transaksi
          </Link>
        }
      />

      <div aria-live="polite">
        <p className="mt-3 text-xs text-muted">Neto {report.period.label}</p>
        <div className="mt-0.5">
          <Money value={Math.abs(net)} direction={directionOf(report.net)} size="2xl" sign={false} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <MoneyStat label="Pendapatan" value={report.income} direction="in" />
          <MoneyStat label="Pengeluaran" value={report.expense} direction="out" />
          <MoneyStat label="Saldo awal periode" value={report.openingBalance} direction={balanceDirection(report.openingBalance)} />
          <MoneyStat label="Saldo akhir periode" value={report.closingBalance} direction={balanceDirection(report.closingBalance)} />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Rentang dihitung dari tanggal efektif {formatDateShort(report.period.start)} sampai {formatDateShort(report.period.end)}. Pokok pinjaman, pokok piutang,
        transfer, saldo awal, dan penyesuaian saldo tidak dihitung sebagai pendapatan atau pengeluaran.
      </p>
    </Card>
  );
}
