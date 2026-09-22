// routes/laporan/parts/ReportTables.tsx : the supporting tables behind the report screen.
// Every figure here comes from the server; nothing is recomputed into a different number.
import type { ReactNode } from 'react';
import type { CashflowReport, Debt, Goal, NetWorthReport } from '../../../lib/api.ts';
import { EmptyState, Money, SectionHead, StatusPill } from '../../../components/ui.tsx';
import { formatDateShort, formatIDR, formatPercent, relativeDay, toMinor } from '../../../lib/format.ts';
import { deltaOf, deltaText, type ResolvedRange } from './calc.ts';

function directionOf(value: string | number): 'in' | 'out' | 'zero' {
  const minor = toMinor(value);
  if (minor > 0) return 'in';
  if (minor < 0) return 'out';
  return 'zero';
}

const HEAD = 'border-b border-hairline pb-1.5 text-left text-xs font-semibold text-muted';
const HEAD_NUM = 'border-b border-hairline pb-1.5 text-right text-xs font-semibold text-muted';

export function DeltaLine({
  label, current, previous, previousLabel,
}: { label: string; current: string; previous: string; previousLabel: string }) {
  const delta = deltaOf(current, previous);
  return (
    <div className="row-divide flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Money value={Math.abs(delta.difference)} direction={delta.direction} size="sm" />
        <span className="text-xs text-muted">{deltaText(delta, previousLabel)}</span>
      </span>
    </div>
  );
}

export function ComparisonPanel({
  current, previous, children,
}: { current: ResolvedRange; previous: ResolvedRange; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-panel border border-hairline bg-raised px-4 py-3">
      <p className="text-xs font-semibold text-fg">Perbandingan periode</p>
      <p className="mt-0.5 text-xs text-muted">
        Dibandingkan dengan {previous.label}, {formatDateShort(previous.from)} sampai {formatDateShort(previous.to)}.
        Periode yang dibandingkan: {formatDateShort(current.from)} sampai {formatDateShort(current.to)}.
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function CashflowTables({ report }: { report: CashflowReport }) {
  return (
    <section>
      <SectionHead title="Arus kas per dompet" />
      <p className="text-xs text-muted">
        Saldo akhir = saldo awal periode + seluruh perubahan saldo dalam periode. Alokasi tujuan tidak termasuk perubahan saldo.
      </p>

      {report.wallets.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="Belum ada dompet" body="Buat dompet di Profil supaya arus kas per dompet bisa dihitung." />
        </div>
      ) : (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Saldo awal, perubahan, dan saldo akhir setiap dompet</caption>
          <thead>
            <tr>
              <th scope="col" className={HEAD}>Dompet</th>
              <th scope="col" className={`${HEAD_NUM} hidden sm:table-cell`}>Saldo awal</th>
              <th scope="col" className={HEAD_NUM}>Perubahan</th>
              <th scope="col" className={HEAD_NUM}>Saldo akhir</th>
            </tr>
          </thead>
          <tbody>
            {report.wallets.map((wallet) => (
              <tr key={wallet.walletId} className="row-divide">
                <td className="py-2.5 pr-3 align-top text-fg">{wallet.name}</td>
                <td className="num hidden py-2.5 align-top text-muted sm:table-cell">
                  <Money value={wallet.opening} size="sm" />
                </td>
                <td className="num py-2.5 align-top">
                  <Money value={Math.abs(toMinor(wallet.change))} direction={directionOf(wallet.change)} size="sm" />
                </td>
                <td className="num py-2.5 align-top font-semibold">
                  <Money value={wallet.closing} size="sm" />
                </td>
              </tr>
            ))}
            <tr className="row-divide">
              <td className="py-2.5 pr-3 font-semibold text-fg">Seluruh dompet</td>
              <td className="num hidden py-2.5 font-semibold sm:table-cell">
                <Money value={report.opening} size="sm" />
              </td>
              <td className="num py-2.5 font-semibold">
                <Money value={Math.abs(toMinor(report.change))} direction={directionOf(report.change)} size="sm" />
              </td>
              <td className="num py-2.5 font-semibold">
                <Money value={report.closing} size="sm" />
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {report.byActivity.length > 0 ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-fg">Perubahan saldo menurut aktivitas</h3>
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Perubahan saldo dompet menurut jenis aktivitas</caption>
            <thead>
              <tr>
                <th scope="col" className={HEAD}>Aktivitas</th>
                <th scope="col" className={HEAD_NUM}>Perubahan saldo</th>
              </tr>
            </thead>
            <tbody>
              {report.byActivity.map((entry) => (
                <tr key={entry.label} className="row-divide">
                  <td className="py-2.5 pr-3 align-top text-fg">{entry.label}</td>
                  <td className="num py-2.5 align-top">
                    <Money value={Math.abs(toMinor(entry.amount))} direction={directionOf(entry.amount)} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {report.buckets.length > 0 ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-fg">Arus kas per periode</h3>
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Uang masuk, uang keluar, dan neto setiap periode</caption>
            <thead>
              <tr>
                <th scope="col" className={HEAD}>Periode</th>
                <th scope="col" className={HEAD_NUM}>Masuk</th>
                <th scope="col" className={HEAD_NUM}>Keluar</th>
                <th scope="col" className={HEAD_NUM}>Neto</th>
              </tr>
            </thead>
            <tbody>
              {report.buckets.map((bucket) => (
                <tr key={bucket.label} className="row-divide">
                  <td className="py-2.5 pr-3 align-top text-fg">{bucket.label}</td>
                  <td className="num py-2.5 align-top">
                    <Money value={bucket.inflow} direction="in" size="sm" />
                  </td>
                  <td className="num py-2.5 align-top">
                    <Money value={bucket.outflow} direction="out" size="sm" />
                  </td>
                  <td className="num py-2.5 align-top font-semibold">
                    <Money value={Math.abs(toMinor(bucket.net))} direction={directionOf(bucket.net)} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}

export function NetWorthPanel({ report }: { report: NetWorthReport }) {
  const walletTotal = report.wallets.reduce((sum, wallet) => sum + toMinor(wallet.balance), 0);

  return (
    <section>
      <SectionHead title="Kekayaan bersih tercatat" />
      <div className="mt-2 rounded-panel border border-hairline bg-raised px-4 py-3">
        <p className="text-xs text-muted">Kekayaan bersih tercatat per {formatDateShort(report.asOf)}</p>
        <Money value={Math.abs(toMinor(report.netWorth))} direction={directionOf(report.netWorth)} size="lg" />

        <div className="mt-3">
          <div className="row-divide flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-sm text-muted">Saldo uang (kas dan dompet)</span>
            <Money value={report.cash} size="sm" />
          </div>
          <div className="row-divide flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-sm text-muted">Pokok piutang tersisa</span>
            <Money value={report.receivable} direction="in" size="sm" />
          </div>
          <div className="row-divide flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-sm text-muted">Pokok utang tersisa</span>
            <Money value={report.payable} direction="out" size="sm" />
          </div>
        </div>

        <p className="mt-2.5 text-xs text-muted">
          Kekayaan bersih tercatat = saldo uang + pokok piutang tersisa − pokok utang tersisa. Angka ini hanya mencakup aset dan kewajiban yang dicatat di aplikasi,
          bukan seluruh kekayaan Anda.
        </p>
      </div>

      {report.wallets.length > 0 ? (
        <>
          <h3 className="mt-4 text-sm font-semibold text-fg">Saldo dompet yang dihitung</h3>
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Saldo setiap dompet yang masuk perhitungan</caption>
            <thead>
              <tr>
                <th scope="col" className={HEAD}>Dompet</th>
                <th scope="col" className={HEAD_NUM}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {report.wallets.map((wallet) => (
                <tr key={wallet.id} className="row-divide">
                  <td className="py-2.5 pr-3 align-top text-fg">
                    {wallet.name}
                    {wallet.archived ? (
                      <span className="ml-2 align-middle">
                        <StatusPill tone="neutral">Diarsipkan</StatusPill>
                      </span>
                    ) : null}
                  </td>
                  <td className="num py-2.5 align-top">
                    <Money value={wallet.balance} size="sm" />
                  </td>
                </tr>
              ))}
              <tr className="row-divide">
                <td className="py-2.5 pr-3 font-semibold text-fg">Total saldo dompet</td>
                <td className="num py-2.5 font-semibold">
                  <Money value={walletTotal} size="sm" />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1.5 text-xs text-muted">Total ini menjumlahkan saldo dompet yang tampil di tabel, termasuk dompet yang diarsipkan.</p>
        </>
      ) : null}
    </section>
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
    <section>
      <SectionHead title="Daftar utang dan piutang" />
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-muted">Sisa pokok utang</span>
          <Money value={report.totals.payable} direction="out" />
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-muted">Sisa pokok piutang</span>
          <Money value={report.totals.receivable} direction="in" />
        </span>
      </div>

      {payable.length === 0 && receivable.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Belum ada utang atau piutang aktif"
            body="Catatan utang dan piutang muncul di laporan ini beserta sisa pokoknya."
            action={emptyAction}
          />
        </div>
      ) : (
        <>
          <h3 className="mt-4 text-sm font-semibold text-fg">Utang (kewajiban)</h3>
          <DebtRows items={payable} tone="out" emptyLabel="Tidak ada utang aktif." />
          <h3 className="mt-4 text-sm font-semibold text-fg">Piutang (hak tagih)</h3>
          <DebtRows items={receivable} tone="in" emptyLabel="Tidak ada piutang aktif." />
        </>
      )}
    </section>
  );
}

function DebtRows({ items, tone, emptyLabel }: { items: Debt[]; tone: 'in' | 'out'; emptyLabel: string }) {
  if (items.length === 0) return <p className="mt-1.5 text-xs text-muted">{emptyLabel}</p>;
  return (
    <table className="mt-2 w-full text-sm">
      <caption className="sr-only">Sisa pokok dan jatuh tempo setiap catatan</caption>
      <thead>
        <tr>
          <th scope="col" className={HEAD}>Pihak</th>
          <th scope="col" className={`${HEAD_NUM} hidden sm:table-cell`}>Jatuh tempo</th>
          <th scope="col" className={HEAD_NUM}>Sisa pokok</th>
        </tr>
      </thead>
      <tbody>
        {items.map((debt) => (
          <tr key={debt.id} className="row-divide">
            <td className="py-2.5 pr-3 align-top text-fg">
              {debt.counterpartyName}
              {debt.overdue ? (
                <span className="ml-2 align-middle">
                  <StatusPill tone="out">Lewat jatuh tempo</StatusPill>
                </span>
              ) : null}
            </td>
            <td className="num hidden py-2.5 align-top text-muted sm:table-cell">
              {debt.dueDate ? relativeDay(debt.dueDate) : 'Belum ada'}
            </td>
            <td className="num py-2.5 align-top">
              <Money value={debt.remaining} direction={tone} size="sm" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GoalTable({ goals, emptyAction }: { goals: Goal[]; emptyAction?: ReactNode }) {
  const list = goals.filter((entry) => entry.status !== 'archived');

  return (
    <section>
      <SectionHead title="Daftar tujuan" />
      {list.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Belum ada tujuan"
            body="Tujuan keuangan muncul di laporan ini beserta alokasi dan progresnya."
            action={emptyAction}
          />
        </div>
      ) : (
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">Target, alokasi, dan progres setiap tujuan</caption>
          <thead>
            <tr>
              <th scope="col" className={HEAD}>Tujuan</th>
              <th scope="col" className={`${HEAD_NUM} hidden sm:table-cell`}>Target</th>
              <th scope="col" className={HEAD_NUM}>Teralokasi</th>
              <th scope="col" className={HEAD_NUM}>Progres</th>
            </tr>
          </thead>
          <tbody>
            {list.map((goal) => (
              <tr key={goal.id} className="row-divide">
                <td className="py-2.5 pr-3 align-top text-fg">
                  {goal.name}
                  {goal.status === 'achieved' ? (
                    <span className="ml-2 align-middle">
                      <StatusPill tone="in">Tercapai</StatusPill>
                    </span>
                  ) : null}
                </td>
                <td className="num hidden py-2.5 align-top text-muted sm:table-cell">{formatIDR(goal.target)}</td>
                <td className="num py-2.5 align-top">
                  <Money value={goal.allocated} direction="in" size="sm" />
                </td>
                <td className="num py-2.5 align-top font-semibold">{formatPercent(goal.progress)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
