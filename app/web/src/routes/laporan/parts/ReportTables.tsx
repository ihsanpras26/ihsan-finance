// routes/laporan/parts/ReportTables.tsx : the supporting tables behind the report screen.
// Every figure here comes from the server; nothing is recomputed into a different number.
// v2 shape: bukan tabel berbingkai, melainkan kartu berisi baris daftar. Setiap baris punya label
// di kiri dan nominal di tepi kanan yang sama, dipisah .row-divide, sehingga kolom tanda tetap
// lurus dan arah uang terbaca tanpa warna (DESIGN.md §5, §6). Baris angka sekunder duduk di baris
// berikutnya dengan rata kanan yang sama, jadi tidak ada yang terpotong di lebar 360px.
import type { ReactNode } from 'react';
import type { CashflowReport, Debt, Goal, NetWorthReport } from '../../../lib/api.ts';
import { Card, CardHead, DeltaPill, EmptyState, Money, ProgressBar, StatusPill } from '../../../components/ui.tsx';
import { formatDateShort, formatPercent, relativeDay, toMinor } from '../../../lib/format.ts';
import { deltaOf, deltaText, type ResolvedRange } from './calc.ts';

function directionOf(value: string | number): 'in' | 'out' | 'zero' {
  const minor = toMinor(value);
  if (minor > 0) return 'in';
  if (minor < 0) return 'out';
  return 'zero';
}

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
 */
function AmountRow({
  label, badge, trailing, meta,
}: { label: string; badge?: ReactNode; trailing: ReactNode; meta?: ReactNode }) {
  return (
    <li className="row-divide py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-fg">{label}</span>
          {badge}
        </div>
        <span className="ml-auto">{trailing}</span>
      </div>
      {meta ? <div className="mt-1">{meta}</div> : null}
    </li>
  );
}

export function DeltaLine({
  label, current, previous, previousLabel,
}: { label: string; current: string; previous: string; previousLabel: string }) {
  const delta = deltaOf(current, previous);
  const word = delta.direction === 'in' ? 'naik' : delta.direction === 'out' ? 'turun' : 'tetap';
  return (
    <div className="row-divide flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
      <span className="text-sm text-fg">{label}</span>
      <span className="ml-auto flex flex-col items-end gap-1.5">
        <Money value={Math.abs(delta.difference)} direction={delta.direction} size="md" />
        {delta.percent === null ? (
          <span className="block max-w-[15rem] text-right text-xs text-muted">{deltaText(delta, previousLabel)}</span>
        ) : (
          <DeltaPill
            value={`${word} ${formatPercent(Math.abs(delta.percent))}`}
            tone={delta.direction === 'zero' ? 'neutral' : delta.direction}
            label={`dari ${previousLabel}`}
          />
        )}
      </span>
    </div>
  );
}

export function ComparisonPanel({
  current, previous, children,
}: { current: ResolvedRange; previous: ResolvedRange; children: ReactNode }) {
  return (
    <Card className="px-4 py-4">
      <CardHead
        title="Perbandingan periode"
        subtitle={`Dibandingkan dengan ${previous.label}, ${formatDateShort(previous.from)} sampai ${formatDateShort(previous.to)}. Periode yang dibandingkan: ${formatDateShort(current.from)} sampai ${formatDateShort(current.to)}.`}
      />
      <div className="mt-1">{children}</div>
    </Card>
  );
}

export function CashflowTables({ report }: { report: CashflowReport }) {
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

      {report.buckets.length > 0 ? (
        <Card className="px-4 py-4">
          <CardHead title="Arus kas per periode" />
          <RowHead left="Periode" right="Neto" />
          <ul className="mt-1" aria-label="Uang masuk, uang keluar, dan neto setiap periode">
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
        </Card>
      ) : null}
    </div>
  );
}

export function NetWorthPanel({ report }: { report: NetWorthReport }) {
  const walletTotal = report.wallets.reduce((sum, wallet) => sum + toMinor(wallet.balance), 0);

  return (
    <div className="flex flex-col gap-3">
      <Card className="px-4 py-4">
        <CardHead title="Kekayaan bersih tercatat" />
        <p className="mt-2 text-xs text-muted">Kekayaan bersih tercatat per {formatDateShort(report.asOf)}</p>
        <div className="mt-0.5">
          <Money value={Math.abs(toMinor(report.netWorth))} direction={directionOf(report.netWorth)} size="lg" />
        </div>

        <RowHead left="Bagian" right="Nominal" />
        <ul className="mt-1" aria-label="Bagian yang menyusun kekayaan bersih tercatat">
          <AmountRow label="Saldo uang (kas dan dompet)" trailing={<Money value={report.cash} size="md" />} />
          <AmountRow label="Pokok piutang tersisa" trailing={<Money value={report.receivable} direction="in" size="md" />} />
          <AmountRow label="Pokok utang tersisa" trailing={<Money value={report.payable} direction="out" size="md" />} />
        </ul>

        <p className="mt-2.5 text-xs text-muted">
          Kekayaan bersih tercatat = saldo uang + pokok piutang tersisa − pokok utang tersisa. Angka ini hanya mencakup aset dan kewajiban yang dicatat di aplikasi,
          bukan seluruh kekayaan Anda.
        </p>
      </Card>

      {report.wallets.length > 0 ? (
        <Card className="px-4 py-4">
          <CardHead title="Saldo dompet yang dihitung" />
          <RowHead left="Dompet" right="Saldo" />
          <ul className="mt-1" aria-label="Saldo setiap dompet yang masuk perhitungan">
            {report.wallets.map((wallet) => (
              <AmountRow
                key={wallet.id}
                label={wallet.name}
                badge={wallet.archived ? <StatusPill tone="neutral">Diarsipkan</StatusPill> : null}
                trailing={<Money value={wallet.balance} size="md" />}
              />
            ))}
            <AmountRow label="Total saldo dompet" trailing={<Money value={walletTotal} size="md" />} />
          </ul>
          <p className="mt-1.5 text-xs text-muted">Total ini menjumlahkan saldo dompet yang tampil di daftar ini, termasuk dompet yang diarsipkan.</p>
        </Card>
      ) : null}
    </div>
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

  return (
    <div className="flex flex-col gap-3">
      <Card className="px-4 py-4">
        <CardHead title="Daftar utang dan piutang" />
        <RowHead left="Jenis" right="Sisa pokok" />
        <ul className="mt-1" aria-label="Sisa pokok utang dan piutang">
          <AmountRow label="Sisa pokok utang" trailing={<Money value={report.totals.payable} direction="out" size="md" />} />
          <AmountRow label="Sisa pokok piutang" trailing={<Money value={report.totals.receivable} direction="in" size="md" />} />
        </ul>
      </Card>

      {payable.length === 0 && receivable.length === 0 ? (
        <EmptyState
          title="Belum ada utang atau piutang aktif"
          body="Catatan utang dan piutang muncul di laporan ini beserta sisa pokoknya."
          action={emptyAction}
        />
      ) : (
        <>
          <Card className="px-4 py-4">
            <CardHead title="Utang (kewajiban)" />
            {payable.length === 0 ? (
              <p className="mt-2 text-xs text-muted">Tidak ada utang aktif.</p>
            ) : (
              <>
                <RowHead left="Pihak" right="Sisa pokok" />
                <ul className="mt-1" aria-label="Sisa pokok dan jatuh tempo setiap utang">
                  {payable.map((debt) => (
                    <AmountRow
                      key={debt.id}
                      label={debt.counterpartyName}
                      badge={debt.overdue ? <StatusPill tone="out">Lewat jatuh tempo</StatusPill> : null}
                      meta={
                        <p className="text-xs text-muted">
                          {debt.dueDate ? `Jatuh tempo ${relativeDay(debt.dueDate)}` : 'Belum ada jatuh tempo'}
                        </p>
                      }
                      trailing={<Money value={debt.remaining} direction="out" size="md" />}
                    />
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="px-4 py-4">
            <CardHead title="Piutang (hak tagih)" />
            {receivable.length === 0 ? (
              <p className="mt-2 text-xs text-muted">Tidak ada piutang aktif.</p>
            ) : (
              <>
                <RowHead left="Pihak" right="Sisa pokok" />
                <ul className="mt-1" aria-label="Sisa pokok dan jatuh tempo setiap piutang">
                  {receivable.map((debt) => (
                    <AmountRow
                      key={debt.id}
                      label={debt.counterpartyName}
                      badge={debt.overdue ? <StatusPill tone="out">Lewat jatuh tempo</StatusPill> : null}
                      meta={
                        <p className="text-xs text-muted">
                          {debt.dueDate ? `Jatuh tempo ${relativeDay(debt.dueDate)}` : 'Belum ada jatuh tempo'}
                        </p>
                      }
                      trailing={<Money value={debt.remaining} direction="in" size="md" />}
                    />
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}
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
      <CardHead title="Daftar tujuan" />
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
                ]}
              />
            </div>
            <div className="mt-2">
              <ProgressBar ratio={goal.progress} tone="accent" label={`Progres tujuan ${goal.name}`} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
