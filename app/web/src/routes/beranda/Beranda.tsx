// routes/beranda/Beranda.tsx - urutan informasi mengikuti PRD §03:
// saldo dompet, pendapatan dan pengeluaran bulan ini, sisa anggaran, kewajiban tujuh hari,
// progres tujuan, lalu kekayaan bersih sebagai angka terpisah dengan penjelasan komponennya.
// Titik fokus tunggal layar ini adalah angka total saldo (DESIGN.md §7).
// Susunan v2: satu kartu per kelompok informasi, jarak antar kartu 12px, dan setiap nominal
// memakai komponen Money supaya kolom tanda tetap utuh (DESIGN.md §5).
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DataError } from '../../components/layout/DataError.tsx';
import { useShell } from '../../components/layout/AppShell.tsx';
import {
  IconBudget, IconDebt, IconEye, IconEyeOff, IconGoal, IconReceivable, IconSavings, IconWallet,
} from '../../components/icons.tsx';
import {
  Button, Card, CardHead, EmptyState, IconButton, IconTile, LedgerRow, LoadingRows, Money,
  ProgressBar, RowTitle, StatusPill,
} from '../../components/ui.tsx';
import { api, type Budget, type DashboardData } from '../../lib/api.ts';
import {
  currentPeriod, formatDateLong, formatDateShort, formatPeriod, relativeDay, toMinor, WALLET_TYPE_LABEL,
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

/** Warna bilah anggaran mengikuti peringatan server: lewat batas, mendekati batas, atau aman. */
function budgetTone(warning: Budget['warning']): 'out' | 'warn' | 'accent' {
  return warning === 'over' ? 'out' : warning === 'near' ? 'warn' : 'accent';
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
      <div className="pt-4">
        <LoadingRows rows={6} label="Memuat ringkasan keuangan" />
      </div>
    );
  }

  if (state.error && !state.data) {
    return (
      <div className="pt-4">
        <DataError error={state.error} onRetry={state.reload} />
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="pt-4">
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
  const budgetTileTone = overBudgets.length > 0 ? 'out' : nearBudgets.length > 0 ? 'warn' : 'accent';

  return (
    <div className="flex flex-col gap-3 pt-4">
      {draftCount > 0 ? (
        <Card className="flex flex-wrap items-center gap-3 px-4 py-4">
          <StatusPill tone="warn">Belum tersinkron</StatusPill>
          <p className="min-w-0 flex-1 text-sm text-fg">
            {draftCount === 1 ? '1 transaksi masih berupa draf di perangkat ini.' : `${draftCount} transaksi masih berupa draf di perangkat ini.`}{' '}
            Draf belum mengubah saldo.
          </p>
          <Button variant="secondary" onClick={() => openQuickEntry()}>
            Buka draf
          </Button>
        </Card>
      ) : null}

      {/* Titik fokus: total saldo. Angka bulan ini duduk di kartu yang sama sebagai baris statistik,
          karena muatan dashboard tidak membawa deret bulanan untuk digambar sebagai grafik. */}
      <section aria-labelledby="saldo-heading">
        <Card as="div" className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h1 id="saldo-heading" className="text-xs font-semibold text-muted">
              Total saldo dompet
            </h1>
            <IconButton
              label={hideAmounts ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
              onClick={() => void setHideAmounts(!hideAmounts)}
            >
              {hideAmounts ? <IconEye /> : <IconEyeOff />}
            </IconButton>
          </div>
          <p className="mt-1">
            <Money value={dashboard.totalBalance} size="2xl" />
          </p>
          <p className="mt-1 text-xs text-muted">Per {formatDateLong(dashboard.asOf)}</p>

          {/* Angka bulan ini: di HP label kiri dan nominal kanan supaya seluruh nominal kartu lurus
              pada satu tepi (DESIGN.md §5); dari sm ke atas menjadi baris tiga kolom. */}
          <dl className="mt-3 flex flex-col border-t border-hairline pt-2 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:pt-3">
            <div className="flex items-baseline justify-between gap-3 py-1 sm:flex-col sm:items-stretch sm:gap-0.5 sm:py-0">
              <dt className="text-xs text-muted sm:text-2xs">Pendapatan</dt>
              <dd>
                <Money value={dashboard.income} direction={toMinor(dashboard.income) > 0 ? 'in' : 'zero'} size="sm" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1 sm:flex-col sm:items-stretch sm:gap-0.5 sm:py-0">
              <dt className="text-xs text-muted sm:text-2xs">Pengeluaran</dt>
              <dd>
                <Money value={dashboard.expense} direction={toMinor(dashboard.expense) > 0 ? 'out' : 'zero'} size="sm" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1 sm:flex-col sm:items-stretch sm:gap-0.5 sm:py-0">
              <dt className="text-xs font-medium text-fg sm:text-2xs sm:font-normal sm:text-muted">Selisih bulan ini</dt>
              <dd>
                <Money value={dashboard.net} direction={flowDirection(dashboard.net)} size="sm" />
              </dd>
            </div>
          </dl>

          {netNegative ? (
            <p className="mt-2 text-xs text-muted">Pengeluaran bulan ini lebih besar dari pendapatan. Selisih tampil dengan tanda minus.</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-xs text-muted">
              Periode {formatDateShort(dashboard.period.start)} sampai {formatDateShort(dashboard.period.end)}.
            </p>
            <SectionLink to={`/transaksi?period=${periodKey}`}>Lihat transaksi</SectionLink>
          </div>
        </Card>
      </section>

      <Card className="px-4 py-4">
        <CardHead title="Sisa anggaran" action={<SectionLink to="/rencana">Buka Rencana</SectionLink>} />
        {budgets.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Belum ada anggaran untuk {formatPeriod(period)}. Anggaran per kategori dibuat di layar Rencana.
          </p>
        ) : (
          <>
            <LedgerRow
              className="mt-1"
              leading={
                <IconTile tone={budgetTileTone}>
                  <IconBudget />
                </IconTile>
              }
              trailing={<Money value={dashboard.budgetRemaining} direction={balanceDirection(dashboard.budgetRemaining)} />}
            >
              <RowTitle title={`Sisa dari ${budgets.length} anggaran`} />
            </LedgerRow>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {overBudgets.length > 0 ? <StatusPill tone="out">{overBudgets.length} anggaran lewat batas</StatusPill> : null}
              {nearBudgets.length > 0 ? <StatusPill tone="warn">{nearBudgets.length} anggaran mendekati batas</StatusPill> : null}
              {overBudgets.length === 0 && nearBudgets.length === 0 ? (
                <p className="text-xs text-muted">Tidak ada anggaran yang mendekati batas.</p>
              ) : null}
            </div>
            <ul className="flex flex-col">
              {budgets.slice(0, 4).map((budget) => (
                <BudgetLine key={budget.id} budget={budget} />
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="px-4 py-4">
        <CardHead title="Kewajiban 7 hari ke depan" />
        {dashboard.upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tidak ada utang atau piutang yang jatuh tempo dalam tujuh hari ke depan.</p>
        ) : (
          <ul className="mt-1 flex flex-col">
            {dashboard.upcoming.map((item) => (
              <LedgerRow
                key={item.id}
                as="li"
                leading={
                  <IconTile tone={item.direction === 'payable' ? 'out' : 'in'}>
                    {item.direction === 'payable' ? <IconDebt /> : <IconReceivable />}
                  </IconTile>
                }
                trailing={<Money value={item.amount} direction={item.direction === 'payable' ? 'out' : 'in'} />}
              >
                <RowTitle
                  title={item.counterpartyName}
                  meta={`${item.direction === 'payable' ? 'Utang' : 'Piutang'} · jatuh ${relativeDay(item.dueDate)}`}
                />
              </LedgerRow>
            ))}
          </ul>
        )}
      </Card>

      <Card className="px-4 py-4">
        <CardHead title="Progres tujuan" action={<SectionLink to="/rencana">Buka Rencana</SectionLink>} />
        {activeGoals.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada tujuan keuangan aktif. Tujuan dan alokasi dana dibuat di layar Rencana.</p>
        ) : (
          <ul className="mt-1 flex flex-col">
            {activeGoals.map((goal) => (
              <GoalLine key={goal.id} goal={goal} />
            ))}
          </ul>
        )}
        <LedgerRow
          className="mt-1"
          leading={
            <IconTile tone="accent-2">
              <IconSavings />
            </IconTile>
          }
          trailing={<Money value={dashboard.unallocated} direction={balanceDirection(dashboard.unallocated)} />}
        >
          <RowTitle title="Dana belum dialokasikan" />
        </LedgerRow>
        <p className="mt-1 text-xs text-muted">
          Angka ini hanya mengurangi alokasi tujuan aktif. Bukan batas belanja dan bukan rekomendasi.
        </p>
      </Card>

      {/* Di desktop dua kartu ini boleh berdampingan; susunan dasarnya tetap satu kolom untuk HP. */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
        <Card className="px-4 py-4">
          <CardHead title="Kekayaan bersih tercatat" />
          <div className="mt-1">
            <LedgerRow
              leading={
                <IconTile>
                  <IconWallet />
                </IconTile>
              }
              trailing={<Money value={dashboard.netWorthParts.cash} direction={balanceDirection(dashboard.netWorthParts.cash)} />}
            >
              <RowTitle title="Kas dompet" />
            </LedgerRow>
            <LedgerRow
              leading={
                <IconTile tone="in">
                  <IconReceivable />
                </IconTile>
              }
              trailing={
                <Money
                  value={dashboard.netWorthParts.receivable}
                  direction={toMinor(dashboard.netWorthParts.receivable) > 0 ? 'in' : 'zero'}
                />
              }
            >
              <RowTitle title="Pokok piutang tersisa" />
            </LedgerRow>
            <LedgerRow
              leading={
                <IconTile tone="out">
                  <IconDebt />
                </IconTile>
              }
              trailing={
                <Money
                  value={dashboard.netWorthParts.payable}
                  direction={toMinor(dashboard.netWorthParts.payable) > 0 ? 'out' : 'zero'}
                />
              }
            >
              <RowTitle title="Pokok utang tersisa" />
            </LedgerRow>
            {/* Baris total: duduk di blok ringkasan sendiri supaya tidak berpura-pura sejajar
                dengan baris berikon di atasnya. */}
            <div className="mt-1 border-t border-hairline pt-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-fg">Kekayaan bersih</span>
                <Money value={dashboard.netWorth} direction={balanceDirection(dashboard.netWorth)} size="lg" />
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Kas ditambah pokok piutang tersisa, dikurangi pokok utang tersisa. Angka ini hanya mencakup aset dan kewajiban
            yang sudah dicatat di aplikasi, bukan seluruh kekayaan.
          </p>
          {netWorthNegative ? (
            <p className="mt-1 text-xs text-warn">Kewajiban tercatat lebih besar dari aset tercatat, jadi angkanya negatif.</p>
          ) : null}
        </Card>

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
          <Card className="px-4 py-4">
            <CardHead title="Dompet" action={<SectionLink to="/profil">Kelola dompet</SectionLink>} />
            <ul className="mt-1 flex flex-col">
              {[...activeWallets, ...archivedWallets].map((wallet) => (
                <LedgerRow
                  key={wallet.id}
                  as="li"
                  leading={
                    <IconTile>
                      <IconWallet />
                    </IconTile>
                  }
                  trailing={<Money value={wallet.balance} direction={balanceDirection(wallet.balance)} />}
                >
                  <p className="truncate text-sm font-medium text-fg">{wallet.name}</p>
                  {/* Lencana status ikut di baris meta supaya nominal tetap di tepi kanan yang sama. */}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="truncate">{WALLET_TYPE_LABEL[wallet.type] ?? wallet.type}</span>
                    {wallet.archived ? <StatusPill tone="neutral">Arsip</StatusPill> : null}
                    {toMinor(wallet.balance) < 0 ? <StatusPill tone="warn">Saldo negatif</StatusPill> : null}
                  </p>
                </LedgerRow>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Saldo dihitung dari seluruh catatan yang sudah tercatat sampai {formatDateLong(dashboard.asOf)}. Dompet arsip tetap masuk total aset.
            </p>
          </Card>
        )}
      </div>

      <section aria-label="Catatan perhitungan">
        <Card className="px-4 py-4">
          <p className="text-xs text-muted">
            Pendapatan dan pengeluaran dihitung dari tanggal efektif transaksi. Transfer antar dompet, saldo awal, dan
            pokok utang tidak masuk hitungan konsumsi.
          </p>
        </Card>
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
  const tone = budgetTone(budget.warning);
  return (
    <li className="row-divide flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <IconTile tone={tone} size="sm">
          <IconBudget size={17} />
        </IconTile>
        <span className="min-w-0 flex-1 truncate text-sm text-fg">{budget.categoryName}</span>
        {budget.warning === 'over' ? <StatusPill tone="out">Lewat batas</StatusPill> : null}
        {budget.warning === 'near' ? <StatusPill tone="warn">Mendekati batas</StatusPill> : null}
      </div>
      <ProgressBar ratio={budget.ratio} tone={tone} label={`Pemakaian anggaran ${budget.categoryName}`} showPercent />
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

function GoalLine({ goal }: { goal: DashboardData['goals'][number] }) {
  return (
    <li className="row-divide flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <IconTile tone="accent-2" size="sm">
          <IconGoal size={17} />
        </IconTile>
        <span className="min-w-0 flex-1 truncate text-sm text-fg">{goal.name}</span>
      </div>
      {/* Persentase ditulis di dalam isian bilah (DESIGN.md §10), jadi tidak ada angka kembar di atasnya. */}
      <ProgressBar ratio={goal.progress} label={`Progres tujuan ${goal.name}`} showPercent />
      {/* Label kiri, nominal kanan: seluruh nominal kartu lurus pada satu tepi (DESIGN.md §5). */}
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
  );
}
