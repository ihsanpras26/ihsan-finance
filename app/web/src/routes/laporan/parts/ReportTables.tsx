// routes/laporan/parts/ReportTables.tsx : kartu pendukung laporan.
// Setiap angka berasal dari server; tidak ada nominal yang dihitung ulang menjadi angka berbeda.
// v3 shape: baris daftar dengan label di kiri dan nominal di tepi kanan yang sama, dipisah
// .row-divide, sehingga kolom tanda tetap lurus dan arah uang terbaca tanpa warna (DESIGN.md "Kolom tanda", "Components").
// Grafik arus kas bulanan selalu membawa tabel pendampingnya, dan angka penyusun dibuka di tempat.
import { useState, type ReactNode } from 'react';
import type { CashflowReport, Debt, Goal, NetWorthReport, SummaryReport } from '../../../lib/api.ts';
import { Card, CardHead, DeltaPill, DisclosureRow, EmptyState, Money, ProgressBar, StatusPill } from '../../../components/ui.tsx';
import { LineChart, compactIDR } from '../../../components/charts.tsx';
import { formatDateShort, formatPercent, formatPeriodShort, relativeDay, toMinor } from '../../../lib/format.ts';
import { comparisonPeriodName, deltaOf, directionOf, monthlyRows, type MonthRow, type MonthlyWindow } from './calc.ts';


interface AmountItem {
  label: string;
  value: string | number;
  direction?: 'in' | 'out' | 'zero';
}

/** AmountCluster: angka sekunder pada satu baris, masing-masing tetap membawa namanya. */
function AmountCluster({ items }: { items: AmountItem[] }) {
  return (
    <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-0.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-baseline gap-1.5">
          <span className="text-2xs text-muted">{item.label}</span>
          <Money value={item.value} direction={item.direction ?? 'zero'} size="sm" />
        </span>
      ))}
    </div>
  );
}

/**
 * RowHead: satu baris kepala kecil di atas daftar, menyebut nama kolom kiri dan kanan sekali saja
 * supaya label tabel lama tetap ada tanpa mengulanginya di setiap baris.
 */
function RowHead({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-2 flex items-baseline justify-between gap-3 text-2xs font-semibold text-muted">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

/**
 * AmountRow: satu baris angka di dalam kartu. Label (dengan lencana bila ada) di kiri, nominal
 * utama di tepi kanan, dan angka sekunder pada baris kedua yang rata kanan pada tepi yang sama.
 * `as` dipakai saat wadahnya bukan daftar, mis. saat bersebelahan dengan DisclosureRow.
 */
function AmountRow({
  label, badge, trailing, meta, as = 'li',
}: { label: string; badge?: ReactNode; trailing: ReactNode; meta?: ReactNode; as?: 'li' | 'div' }) {
  const Tag = as;
  return (
    <Tag className="row-divide py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-fg">{label}</span>
          {badge}
        </div>
        <span className="ml-auto">{trailing}</span>
      </div>
      {meta ? <div className="mt-1">{meta}</div> : null}
    </Tag>
  );
}

/** Baris penyusun di dalam DisclosureRow: nama di kiri, nominal kecil di tepi kanan yang sama. */
function CompositionRow({ label, value, direction }: { label: string; value: string; direction: 'in' | 'out' | 'zero' }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1">
      <span className="min-w-0 truncate text-xs text-muted">{label}</span>
      <Money value={value} direction={direction} size="sm" />
    </li>
  );
}

/**
 * DeltaLine: satu baris perbandingan. Nominal periode yang dipilih duduk di tepi kanan, nominal
 * pembanding dan selisihnya di baris kedua, sehingga kedua angka selalu terbaca bersama namanya.
 */
export function DeltaLine({
  label, current, previous, previousLabel, direction,
}: { label: string; current: string; previous: string; previousLabel: string; direction: 'in' | 'out' | 'zero' }) {
  const delta = deltaOf(current, previous);
  const word = delta.direction === 'in' ? 'naik' : delta.direction === 'out' ? 'turun' : 'tetap';
  return (
    <li className="row-divide py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm text-fg">{label}</span>
        <Money value={current} direction={direction} size="md" className="ml-auto" />
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-2xs text-muted">Pembanding {previousLabel}</span>
          <Money value={previous} direction={direction} size="sm" />
        </span>
        {delta.percent === null ? (
          <span className="text-xs text-muted">
            {delta.difference === 0
              ? 'Belum ada nilai pada kedua periode, jadi persentase tidak dihitung.'
              : `Persentase tidak dihitung karena ${previousLabel} bernilai Rp0.`}
          </span>
        ) : (
          <DeltaPill value={`${word} ${formatPercent(Math.abs(delta.percent))}`} tone={delta.direction === 'zero' ? 'neutral' : delta.direction} />
        )}
      </div>
    </li>
  );
}

/**
 * ComparisonPanel: pembanding periode sebelumnya dari laporan ringkasan server. Nama periode
 * pembanding ditulis di subjudul supaya tidak ada angka pembanding yang tampil tanpa tanggal.
 */
export function ComparisonPanel({ comparison, children }: { comparison: SummaryReport['comparison']; children: ReactNode }) {
  return (
    <Card className="px-4 py-4">
      <CardHead
        title="Perbandingan periode"
        subtitle={
          comparison
            ? `Dibandingkan dengan ${comparisonPeriodName(comparison.label)}, panjang rentang yang sama dengan periode yang dipilih.`
            : undefined
        }
      />
      <ul className="mt-1">{children}</ul>
    </Card>
  );
}

/** Tabel pendamping grafik: nilai tepat setiap bulan plus jumlahnya (PRD FR18). */
function MonthlyTable({ rows }: { rows: MonthRow[] }) {
  const totals = rows.reduce(
    (sum, row) => ({ inflow: sum.inflow + row.inflow, outflow: sum.outflow + row.outflow, net: sum.net + row.net }),
    { inflow: 0, outflow: 0, net: 0 },
  );
  const head = 'pb-2 font-semibold';
  const cell = 'whitespace-nowrap py-2.5 pl-4 text-right align-baseline';
  const foot = 'whitespace-nowrap py-2.5 pl-4 text-right align-baseline font-semibold';

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Uang masuk, uang keluar, dan selisih setiap bulan</caption>
        <thead>
          <tr className="text-2xs text-muted">
            <th scope="col" className={`${head} text-left`}>Bulan</th>
            <th scope="col" className={`${head} pl-4 text-right`}>Masuk</th>
            <th scope="col" className={`${head} pl-4 text-right`}>Keluar</th>
            <th scope="col" className={`${head} pl-4 text-right`}>Selisih</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.period} className="row-divide">
              <th scope="row" className="whitespace-nowrap py-2.5 pr-3 text-left text-sm font-normal text-fg">{formatPeriodShort(row.period)}</th>
              <td className={cell}><Money value={row.inflow} direction="in" /></td>
              <td className={cell}><Money value={row.outflow} direction="out" /></td>
              <td className={cell}><Money value={Math.abs(row.net)} direction={directionOf(row.net)} /></td>
            </tr>
          ))}
          <tr className="row-divide">
            <th scope="row" className="py-2.5 pr-3 text-left text-sm font-semibold text-fg">Jumlah</th>
            <td className={foot}><Money value={totals.inflow} direction="in" /></td>
            <td className={foot}><Money value={totals.outflow} direction="out" /></td>
            <td className={foot}><Money value={Math.abs(totals.net)} direction={directionOf(totals.net)} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * MonthlyCashflowCard: arus kas 12 bulan penuh terakhir sebagai grafik garis dengan tabel nilai
 * tepat di bawahnya. Pertanyaannya disebut di judul kartu, dan bulan tanpa pergerakan tetap tampil
 * bernilai nol supaya sumbu waktunya tidak melompat.
 */
export function MonthlyCashflowCard({
  window, buckets, emptyAction,
}: { window: MonthlyWindow; buckets: CashflowReport['buckets']; emptyAction?: ReactNode }) {
  const rows = monthlyRows(window, buckets);

  if (!rows.some((row) => row.inflow !== 0 || row.outflow !== 0)) {
    return (
      <EmptyState
        title="Belum ada arus kas dalam 12 bulan terakhir"
        body={`Tidak ada uang masuk atau uang keluar pada ${formatDateShort(window.from)} sampai ${formatDateShort(window.to)}.`}
        action={emptyAction}
      />
    );
  }

  const peak = rows.reduce((best, row) => (Math.abs(row.net) > Math.abs(best.net) ? row : best), rows[0]!);

  return (
    <Card className="px-4 py-4">
      <CardHead
        title="Arus kas per bulan, 12 bulan terakhir"
        subtitle={`Uang masuk dan uang keluar setiap bulan penuh, ${formatDateShort(window.from)} sampai ${formatDateShort(window.to)}.`}
      />
      <div className="mt-4">
        <LineChart
          labels={rows.map((row) => row.short)}
          series={[
            { name: 'Uang keluar', tone: 'accent', values: rows.map((row) => row.outflow) },
            { name: 'Uang masuk', tone: 'accent-2', values: rows.map((row) => row.inflow) },
          ]}
          valueLabel="arus kas bulanan"
          height={180}
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        Sumbu tegak memakai angka ringkas (rb ribu, jt juta). Selisih terbesar ada pada {formatPeriodShort(peak.period)},
        dengan uang masuk Rp{compactIDR(peak.inflow)} dan uang keluar Rp{compactIDR(peak.outflow)}. Nilai tepat setiap bulan ada di tabel di bawah.
      </p>
      <MonthlyTable rows={rows} />
    </Card>
  );
}

export function CashflowTables({ report }: { report: CashflowReport }) {
  // Bucket harian hanya muncul bila rentangnya tepat satu bulan penuh. Rentang yang lebih panjang
  // sudah dibahas kartu arus kas bulanan, jadi kartu ini menampilkan rincian harian saja.
  const daily = report.buckets.every((bucket) => bucket.label.length === 2);

  return (
    <div className="flex flex-col gap-3">
      {report.wallets.length === 0 ? (
        <EmptyState title="Belum ada dompet" body="Buat dompet di Profil supaya arus kas per dompet bisa dihitung." />
      ) : (
        <Card className="px-4 py-4">
          <CardHead
            title="Arus kas per dompet"
            subtitle="Saldo akhir = saldo awal periode + seluruh perubahan saldo dalam periode. Alokasi tujuan tidak termasuk perubahan saldo."
          />
          <RowHead left="Dompet" right="Saldo akhir" />
          <ul className="mt-1" aria-label="Saldo awal, perubahan, dan saldo akhir setiap dompet">
            {report.wallets.map((wallet) => (
              <AmountRow
                key={wallet.walletId}
                label={wallet.name}
                trailing={<Money value={wallet.closing} size="md" />}
                meta={
                  <AmountCluster
                    items={[
                      { label: 'Saldo awal', value: wallet.opening },
                      { label: 'Perubahan', value: Math.abs(toMinor(wallet.change)), direction: directionOf(wallet.change) },
                    ]}
                  />
                }
              />
            ))}
            <AmountRow
              label="Seluruh dompet"
              trailing={<Money value={report.closing} size="md" />}
              meta={
                <AmountCluster
                  items={[
                    { label: 'Saldo awal', value: report.opening },
                    { label: 'Perubahan', value: Math.abs(toMinor(report.change)), direction: directionOf(report.change) },
                  ]}
                />
              }
            />
          </ul>
        </Card>
      )}

      {report.byActivity.length > 0 ? (
        <Card className="px-4 py-4">
          <CardHead title="Perubahan saldo menurut aktivitas" />
          <RowHead left="Aktivitas" right="Perubahan saldo" />
          <ul className="mt-1" aria-label="Perubahan saldo dompet menurut jenis aktivitas">
            {report.byActivity.map((entry) => (
              <AmountRow
                key={entry.label}
                label={entry.label}
                trailing={<Money value={Math.abs(toMinor(entry.amount))} direction={directionOf(entry.amount)} size="md" />}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      {daily ? (
        <Card className="px-4 py-4">
          <CardHead title="Arus kas harian pada rentang ini" subtitle="Hanya hari yang punya perubahan saldo yang ditampilkan." />
          {report.buckets.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Belum ada perubahan saldo pada rentang ini.</p>
          ) : (
            <>
              <RowHead left="Tanggal" right="Neto" />
              <ul className="mt-1" aria-label="Uang masuk, uang keluar, dan neto setiap hari">
                {report.buckets.map((bucket) => (
                  <AmountRow
                    key={bucket.label}
                    label={bucket.label}
                    trailing={<Money value={Math.abs(toMinor(bucket.net))} direction={directionOf(bucket.net)} size="md" />}
                    meta={
                      <AmountCluster
                        items={[
                          { label: 'Masuk', value: bucket.inflow, direction: 'in' },
                          { label: 'Keluar', value: bucket.outflow, direction: 'out' },
                        ]}
                      />
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}

/** NetWorthPanel: kekayaan bersih tercatat beserta penyusunnya, dibuka per bagian (PRD FR04, FR18). */
export function NetWorthPanel({ report, emptyAction }: { report: NetWorthReport; emptyAction?: ReactNode }) {
  const [open, setOpen] = useState<'cash' | 'receivable' | 'payable' | null>(null);
  const receivables = report.debts.filter((debt) => debt.direction === 'receivable' && toMinor(debt.remaining) !== 0);
  const payables = report.debts.filter((debt) => debt.direction === 'payable' && toMinor(debt.remaining) !== 0);

  if (toMinor(report.cash) === 0 && receivables.length === 0 && payables.length === 0) {
    return (
      <EmptyState
        title="Belum ada aset atau utang tercatat"
        body="Kekayaan bersih terisi setelah ada saldo dompet, piutang, atau utang yang dicatat di aplikasi."
        action={emptyAction}
      />
    );
  }

  return (
    <Card className="px-4 py-4">
      <CardHead title="Kekayaan bersih tercatat" />
      <p className="mt-2 text-xs text-muted">Kekayaan bersih tercatat per {formatDateShort(report.asOf)}</p>
      <div className="mt-0.5">
        <Money value={Math.abs(toMinor(report.netWorth))} direction={directionOf(report.netWorth)} size="lg" />
      </div>

      <RowHead left="Penyusun" right="Nominal" />
      <div className="mt-1">
        <DisclosureRow
          label="Saldo uang (kas dan dompet)"
          value={report.cash}
          meta={`${report.wallets.length} dompet, termasuk yang diarsipkan`}
          open={open === 'cash'}
          onToggle={() => setOpen(open === 'cash' ? null : 'cash')}
        >
          <ul className="flex flex-col" aria-label="Saldo setiap dompet yang masuk perhitungan">
            {report.wallets.map((wallet) => (
              <CompositionRow
                key={wallet.id}
                label={wallet.archived ? `${wallet.name} (diarsipkan)` : wallet.name}
                value={wallet.balance}
                direction={directionOf(wallet.balance)}
              />
            ))}
          </ul>
        </DisclosureRow>

        {receivables.length > 0 ? (
          <DisclosureRow
            label="Pokok piutang tersisa"
            value={report.receivable}
            direction="in"
            meta={`${receivables.length} piutang belum lunas`}
            open={open === 'receivable'}
            onToggle={() => setOpen(open === 'receivable' ? null : 'receivable')}
          >
            <ul className="flex flex-col" aria-label="Sisa pokok setiap piutang yang masuk perhitungan">
              {receivables.map((debt) => (
                <CompositionRow key={debt.id} label={debt.counterpartyName} value={debt.remaining} direction="in" />
              ))}
            </ul>
          </DisclosureRow>
        ) : (
          <AmountRow as="div" label="Pokok piutang tersisa" trailing={<Money value={report.receivable} direction="in" size="md" />} />
        )}

        {payables.length > 0 ? (
          <DisclosureRow
            label="Pokok utang tersisa"
            value={report.payable}
            direction="out"
            meta={`${payables.length} utang belum lunas`}
            open={open === 'payable'}
            onToggle={() => setOpen(open === 'payable' ? null : 'payable')}
          >
            <ul className="flex flex-col" aria-label="Sisa pokok setiap utang yang masuk perhitungan">
              {payables.map((debt) => (
                <CompositionRow key={debt.id} label={debt.counterpartyName} value={debt.remaining} direction="out" />
              ))}
            </ul>
          </DisclosureRow>
        ) : (
          <AmountRow as="div" label="Pokok utang tersisa" trailing={<Money value={report.payable} direction="out" size="md" />} />
        )}
      </div>

      <p className="mt-2.5 text-xs text-muted">
        Kekayaan bersih tercatat = saldo uang + pokok piutang tersisa − pokok utang tersisa. Angka ini hanya mencakup aset dan kewajiban yang dicatat di
        aplikasi, bukan seluruh kekayaan Anda.
      </p>
    </Card>
  );
}

/** Satu baris jatuh tempo: tanggal persisnya, ditambah jarak hari bila kurang dari sepekan. */
function dueLabel(debt: Debt): string {
  if (!debt.dueDate) return 'Belum ada jatuh tempo';
  const relative = relativeDay(debt.dueDate);
  const exact = formatDateShort(debt.dueDate);
  return relative === exact ? `Jatuh tempo ${exact}` : `Jatuh tempo ${exact} (${relative.toLowerCase()})`;
}

/** Satu kartu daftar utang atau piutang: jumlah catatan aktif, jatuh temponya, dan sisa pokoknya. */
function DebtList({
  title, list, direction, emptyBody,
}: { title: string; list: Debt[]; direction: 'in' | 'out'; emptyBody: string }) {
  const overdue = list.filter((debt) => debt.overdue).length;
  return (
    <Card className="px-4 py-4">
      <CardHead
        title={title}
        subtitle={list.length === 0 ? undefined : `${list.length} catatan aktif${overdue > 0 ? `, ${overdue} lewat jatuh tempo` : ''}.`}
      />
      {list.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{emptyBody}</p>
      ) : (
        <>
          <RowHead left="Pihak" right="Sisa pokok" />
          <ul className="mt-1" aria-label={`Sisa pokok dan jatuh tempo setiap ${direction === 'out' ? 'utang' : 'piutang'}`}>
            {list.map((debt) => (
              <AmountRow
                key={debt.id}
                label={debt.counterpartyName}
                badge={debt.overdue ? <StatusPill tone="out">Lewat jatuh tempo</StatusPill> : null}
                meta={
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs text-muted">{dueLabel(debt)}</p>
                    <AmountCluster items={[{ label: 'Pokok awal', value: debt.principal }]} />
                  </div>
                }
                trailing={<Money value={debt.remaining} direction={direction} size="md" />}
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function DebtTables({
  report, emptyAction,
}: {
  report: { payable: Debt[]; receivable: Debt[]; totals: { payable: string; receivable: string } };
  emptyAction?: ReactNode;
}) {
  const active = (list: Debt[]) => list.filter((entry) => entry.status === 'active');
  const payable = active(report.payable);
  const receivable = active(report.receivable);
  const hasTotals = toMinor(report.totals.payable) !== 0 || toMinor(report.totals.receivable) !== 0;

  if (payable.length === 0 && receivable.length === 0 && !hasTotals) {
    return (
      <EmptyState
        title="Belum ada utang atau piutang"
        body="Catatan utang dan piutang muncul di laporan ini beserta sisa pokok dan jatuh temponya."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="px-4 py-4">
        <CardHead title="Daftar utang dan piutang" subtitle="Sisa pokok seluruh catatan yang belum diarsipkan." />
        <RowHead left="Jenis" right="Sisa pokok" />
        <ul className="mt-1" aria-label="Sisa pokok utang dan piutang">
          <AmountRow label="Sisa pokok utang" trailing={<Money value={report.totals.payable} direction="out" size="md" />} />
          <AmountRow label="Sisa pokok piutang" trailing={<Money value={report.totals.receivable} direction="in" size="md" />} />
        </ul>
      </Card>

      <DebtList title="Utang (kewajiban)" list={payable} direction="out" emptyBody="Tidak ada utang aktif." />
      <DebtList title="Piutang (hak tagih)" list={receivable} direction="in" emptyBody="Tidak ada piutang aktif." />
    </div>
  );
}

export function GoalTable({ goals, emptyAction }: { goals: Goal[]; emptyAction?: ReactNode }) {
  const list = goals.filter((entry) => entry.status !== 'archived');

  if (list.length === 0) {
    return (
      <EmptyState
        title="Belum ada tujuan"
        body="Tujuan keuangan muncul di laporan ini beserta alokasi dan progresnya."
        action={emptyAction}
      />
    );
  }

  return (
    <Card className="px-4 py-4">
      <CardHead title="Daftar tujuan" subtitle="Progres dihitung dari alokasi yang sudah tercatat dibandingkan targetnya." />
      <RowHead left="Tujuan" right="Progres" />
      <ul className="mt-1" aria-label="Target, alokasi, dan progres setiap tujuan">
        {list.map((goal) => (
          <li key={goal.id} className="row-divide py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm text-fg">{goal.name}</span>
                {goal.status === 'achieved' ? <StatusPill tone="in">Tercapai</StatusPill> : null}
              </div>
              <span className="tnum ml-auto text-sm font-semibold text-fg">{formatPercent(goal.progress)}</span>
            </div>
            <div className="mt-1">
              <AmountCluster
                items={[
                  { label: 'Target', value: goal.target },
                  { label: 'Teralokasi', value: goal.allocated, direction: 'in' },
                  ...(toMinor(goal.shortfall) > 0 ? [{ label: 'Kurang', value: goal.shortfall, direction: 'out' as const }] : []),
                  ...(goal.monthlyPlan !== null && toMinor(goal.monthlyPlan) > 0
                    ? [{ label: 'Rencana bulanan', value: goal.monthlyPlan }]
                    : []),
                ]}
              />
            </div>
            {goal.targetDate ? <p className="mt-1 text-xs text-muted">Target {formatDateShort(goal.targetDate)}</p> : null}
            <div className="mt-2">
              <ProgressBar ratio={goal.progress} tone="accent" label={`Progres tujuan ${goal.name}`} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
