// routes/beranda/Beranda.tsx - urutan informasi mengikuti PRD §03:
// saldo dompet, pendapatan dan pengeluaran bulan ini, sisa anggaran, kewajiban tujuh hari,
// progres tujuan, lalu kekayaan bersih sebagai angka terpisah dengan penjelasan komponennya.
// Titik fokus tunggal layar ini adalah angka total saldo (DESIGN.md §7).
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DataError } from '../../components/layout/DataError.tsx';
import { useShell } from '../../components/layout/AppShell.tsx';
import { IconDebt, IconIn, IconOut, IconReceivable, IconWallet } from '../../components/icons.tsx';
import {
  Button, EmptyState, LedgerRow, LoadingRows, Money, ProgressBar, SectionHead, StatusPill,
} from '../../components/ui.tsx';
import { api, type Budget } from '../../lib/api.ts';
import {
  currentPeriod, formatDateLong, formatPercent, formatPeriod, relativeDay, toMinor, WALLET_TYPE_LABEL,
} from '../../lib/format.ts';
import { useAsync } from '../../lib/hooks.ts';
import { countDrafts } from '../../lib/offline.ts';
import { useSession } from '../../lib/session.tsx';

/** Saldo negatif wajib membawa tanda, jadi arahnya tidak pernah 'zero' saat nilainya di bawah nol. */
function balanceDirection(value: string): 'in' | 'out' | 'zero' {
  return toMinor(value) < 0 ? 'out' : 'zero';
}

function flowDirection(value: string): 'in' | 'out' | 'zero' {
  const minor = toMinor(value);
  if (minor > 0) return 'in';
  if (minor < 0) return 'out';
  return 'zero';
}

export function BerandaPage() {
  const { user, hideAmounts, setHideAmounts } = useSession();
  const { dataVersion, openQuickEntry } = useShell();
  const period = currentPeriod();

  const state = useAsync(async () => {
    const [dashboard, budgets] = await Promise.all([api.dashboard(), api.budgets({ period })]);
    return { dashboard, budgets };
  }, [dataVersion, period]);

  // Draf lokal: dibaca dari perangkat ini, bukan dari server (PRD FR22).
  const draftCount = useMemo(() => (user ? countDrafts(user.workspaceId) : 0), [user, dataVersion]);

  if (state.loading && !state.data) {
    return (
      <div className="pt-6">
        <LoadingRows rows={6} label="Memuat ringkasan keuangan" />
      </div>
    );
  }

  if (state.error && !state.data) {
    return (
      <div className="pt-6">
        <DataError error={state.error} onRetry={state.reload} />
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="pt-6">
        <EmptyState
          title="Ringkasan belum tersedia"
          body="Data ringkasan tidak terbaca. Muat ulang halaman ini."
          action={
            <Button variant="secondary" onClick={state.reload}>
              Muat ulang ringkasan
            </Button>
          }
        />
      </div>
    );
  }

  const { dashboard, budgets } = state.data;
  const activeWallets = dashboard.wallets.filter((wallet) => !wallet.archived);
  const archivedWallets = dashboard.wallets.filter((wallet) => wallet.archived);
  const activeGoals = dashboard.goals.filter((goal) => goal.status === 'active');
  const overBudgets = budgets.filter((budget) => budget.warning === 'over');
  const nearBudgets = budgets.filter((budget) => budget.warning === 'near');
  const netNegative = toMinor(dashboard.net) < 0;
  const netWorthNegative = toMinor(dashboard.netWorth) < 0;
  const periodKey = period;

  return (
    <div className="flex flex-col">
      {draftCount > 0 ? (
        <div className="row-divide mt-4 flex flex-wrap items-center gap-3 py-3">
          <StatusPill tone="warn">Belum tersinkron</StatusPill>
          <p className="text-sm text-fg">
            {draftCount === 1 ? '1 transaksi masih berupa draf di perangkat ini.' : `${draftCount} transaksi masih berupa draf di perangkat ini.`}{' '}
            Draf belum mengubah saldo.
          </p>
          <Button variant="secondary" className="ml-auto" onClick={() => openQuickEntry()}>
            Buka draf
          </Button>
        </div>
      ) : null}

      {/* Titik fokus: total saldo. */}
      <section aria-labelledby="saldo-heading" className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 id="saldo-heading" className="text-xs font-semibold text-muted">
              Total saldo dompet
            </h1>
            <p className="mt-1">
              <Money value={dashboard.totalBalance} size="xl" />
            </p>
            <p className="mt-1 text-xs text-muted">
              Per {formatDateLong(dashboard.asOf)} · {dashboard.period.label}
            </p>
          </div>
          <Button variant="secondary" onClick={() => void setHideAmounts(!hideAmounts)}>
            {hideAmounts ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
          </Button>
        </div>
      </section>

      <section aria-labelledby="bulan-ini">
        <SectionHead
          title="Bulan ini"
          action={<SectionLink to={`/transaksi?period=${periodKey}`}>Lihat transaksi</SectionLink>}
        />
        <ul className="flex flex-col">
          <LedgerRow as="li">
            <IconIn size={18} className="shrink-0 text-in" />
            <span className="flex-1 text-sm text-fg">Pendapatan</span>
            <Money value={dashboard.income} direction={toMinor(dashboard.income) > 0 ? 'in' : 'zero'} />
          </LedgerRow>
          <LedgerRow as="li">
            <IconOut size={18} className="shrink-0 text-out" />
            <span className="flex-1 text-sm text-fg">Pengeluaran</span>
            <Money value={dashboard.expense} direction={toMinor(dashboard.expense) > 0 ? 'out' : 'zero'} />
          </LedgerRow>
          <LedgerRow as="li">
            <span className="flex-1 text-sm font-semibold text-fg">Selisih bulan ini</span>
            <Money value={dashboard.net} direction={flowDirection(dashboard.net)} />
          </LedgerRow>
        </ul>
        {netNegative ? (
          <p className="text-xs text-muted">Pengeluaran bulan ini lebih besar dari pendapatan. Selisih tampil dengan tanda minus.</p>
        ) : null}
        <p className="mt-1 text-xs text-muted">
          Periode {dashboard.period.label}: {dashboard.period.start} sampai {dashboard.period.end}.
        </p>
      </section>

      <section aria-labelledby="anggaran">
        <SectionHead title="Sisa anggaran" action={<SectionLink to="/rencana">Buka Rencana</SectionLink>} />
        {budgets.length === 0 ? (
          <p className="py-3 text-sm text-muted">
            Belum ada anggaran untuk {formatPeriod(period)}. Anggaran per kategori dibuat di layar Rencana.
          </p>
        ) : (
          <>
            <LedgerRow>
              <span className="flex-1 text-sm text-fg">Sisa dari {budgets.length} anggaran</span>
              <Money value={dashboard.budgetRemaining} direction={balanceDirection(dashboard.budgetRemaining)} />
            </LedgerRow>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {overBudgets.length > 0 ? <StatusPill tone="out">{overBudgets.length} anggaran lewat batas</StatusPill> : null}
              {nearBudgets.length > 0 ? <StatusPill tone="warn">{nearBudgets.length} anggaran mendekati batas</StatusPill> : null}
              {overBudgets.length === 0 && nearBudgets.length === 0 ? (
                <p className="text-xs text-muted">Tidak ada anggaran yang mendekati batas.</p>
              ) : null}
            </div>
            <ul className="mt-2 flex flex-col">
              {budgets.slice(0, 4).map((budget) => (
                <BudgetLine key={budget.id} budget={budget} />
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="kewajiban">
        <SectionHead title="Kewajiban 7 hari ke depan" />
        {dashboard.upcoming.length === 0 ? (
          <p className="py-3 text-sm text-muted">Tidak ada utang atau piutang yang jatuh tempo dalam tujuh hari ke depan.</p>
        ) : (
          <ul className="flex flex-col">
            {dashboard.upcoming.map((item) => (
              <LedgerRow key={item.id} as="li">
                {item.direction === 'payable' ? (
                  <IconDebt size={18} className="shrink-0 text-out" />
                ) : (
                  <IconReceivable size={18} className="shrink-0 text-in" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{item.counterpartyName}</p>
                  <p className="text-xs text-muted">
                    {item.direction === 'payable' ? 'Utang' : 'Piutang'} · jatuh {relativeDay(item.dueDate)}
                  </p>
                </div>
                <Money value={item.amount} direction={item.direction === 'payable' ? 'out' : 'in'} />
              </LedgerRow>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tujuan">
        <SectionHead title="Progres tujuan" action={<SectionLink to="/rencana">Buka Rencana</SectionLink>} />
        {activeGoals.length === 0 ? (
          <p className="py-3 text-sm text-muted">Belum ada tujuan keuangan aktif. Tujuan dan alokasi dana dibuat di layar Rencana.</p>
        ) : (
          <ul className="flex flex-col">
            {activeGoals.map((goal) => (
              <li key={goal.id} className="row-divide flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-fg">{goal.name}</span>
                  <span className="text-xs text-muted">{formatPercent(goal.progress)}</span>
                </div>
                <ProgressBar ratio={goal.progress} label={`Progres tujuan ${goal.name}`} />
                {/* Label left, amount right: every amount in the card lands on the card's right
                    edge, so a stack of goals can be compared down one column (DESIGN.md §5). */}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
                  <dt>Terkumpul</dt>
                  <dd className="text-right">
                    <Money value={goal.allocated} size="sm" />
                  </dd>
                  <dt>Target</dt>
                  <dd className="text-right">
                    <Money value={goal.target} size="sm" />
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
        <div className="row-divide mt-1 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-fg">Dana belum dialokasikan</span>
            <Money value={dashboard.unallocated} direction={balanceDirection(dashboard.unallocated)} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Angka ini hanya mengurangi alokasi tujuan aktif. Bukan batas belanja dan bukan rekomendasi.
          </p>
        </div>
      </section>

      <section aria-labelledby="kekayaan">
        <SectionHead title="Kekayaan bersih tercatat" />
        <ul className="flex flex-col">
          <LedgerRow as="li">
            <span className="flex-1 text-sm text-fg">Kas dompet</span>
            <Money value={dashboard.netWorthParts.cash} direction={balanceDirection(dashboard.netWorthParts.cash)} />
          </LedgerRow>
          <LedgerRow as="li">
            <span className="flex-1 text-sm text-fg">Pokok piutang tersisa</span>
            <Money value={dashboard.netWorthParts.receivable} direction={toMinor(dashboard.netWorthParts.receivable) > 0 ? 'in' : 'zero'} />
          </LedgerRow>
          <LedgerRow as="li">
            <span className="flex-1 text-sm text-fg">Pokok utang tersisa</span>
            <Money value={dashboard.netWorthParts.payable} direction={toMinor(dashboard.netWorthParts.payable) > 0 ? 'out' : 'zero'} />
          </LedgerRow>
          <LedgerRow as="li">
            <span className="flex-1 text-sm font-semibold text-fg">Kekayaan bersih</span>
            <Money value={dashboard.netWorth} direction={balanceDirection(dashboard.netWorth)} size="lg" />
          </LedgerRow>
        </ul>
        <p className="mt-1 text-xs text-muted">
          Kas ditambah pokok piutang tersisa, dikurangi pokok utang tersisa. Angka ini hanya mencakup aset dan kewajiban
          yang sudah dicatat di aplikasi, bukan seluruh kekayaan.
        </p>
        {netWorthNegative ? (
          <p className="mt-1 text-xs text-warn">Kewajiban tercatat lebih besar dari aset tercatat, jadi angkanya negatif.</p>
        ) : null}
      </section>

      <section aria-labelledby="dompet">
        <SectionHead title="Dompet" action={<SectionLink to="/profil">Kelola dompet</SectionLink>} />
        {activeWallets.length === 0 && archivedWallets.length === 0 ? (
          <EmptyState
            title="Belum ada dompet"
            body="Dompet kas, bank, atau e-wallet dibuat di layar Profil beserta saldo awalnya."
            action={
              <Link to="/profil" className="inline-flex min-h-[44px] items-center rounded-control px-3 text-sm font-semibold text-accent">
                Buka Profil
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col">
            {[...activeWallets, ...archivedWallets].map((wallet) => (
              <LedgerRow key={wallet.id} as="li">
                <IconWallet size={18} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{wallet.name}</p>
                  <p className="text-xs text-muted">{WALLET_TYPE_LABEL[wallet.type] ?? wallet.type}</p>
                </div>
                {wallet.archived ? <StatusPill tone="neutral">Arsip</StatusPill> : null}
                {toMinor(wallet.balance) < 0 ? <StatusPill tone="warn">Saldo negatif</StatusPill> : null}
                <Money value={wallet.balance} direction={balanceDirection(wallet.balance)} />
              </LedgerRow>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted">
          Saldo dihitung dari seluruh catatan yang sudah tercatat sampai {formatDateLong(dashboard.asOf)}. Dompet arsip tetap masuk total aset.
        </p>
      </section>

      <section className="pt-6">
        <p className="text-xs text-muted">
          Pendapatan dan pengeluaran dihitung dari tanggal efektif transaksi. Transfer antar dompet, saldo awal, dan
          pokok utang tidak masuk hitungan konsumsi.
        </p>
      </section>
    </div>
  );
}

function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  // min-h 44px supaya tautan ini tetap nyaman ditekan di layar sentuh (R-03).
  return (
    <Link to={to} className="inline-flex min-h-[44px] items-center rounded-chip px-1 text-xs font-semibold text-accent hover:underline">
      {children}
    </Link>
  );
}

function BudgetLine({ budget }: { budget: Budget }) {
  const tone = budget.warning === 'over' ? 'out' : budget.warning === 'near' ? 'warn' : 'accent';
  return (
    <li className="row-divide flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-fg">{budget.categoryName}</span>
        <span className="text-xs text-muted">{formatPercent(budget.ratio)}</span>
      </div>
      <ProgressBar ratio={budget.ratio} tone={tone} label={`Pemakaian anggaran ${budget.categoryName}`} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
        <dt>Terpakai</dt>
        <dd className="text-right">
          <Money value={budget.spent} size="sm" />
        </dd>
        <dt>Batas</dt>
        <dd className="text-right">
          <Money value={budget.limit} size="sm" />
        </dd>
      </dl>
    </li>
  );
}
