// routes/beranda/Beranda.tsx - urutan blok tetap: 1 pekerjaan yang menunggu, 2 saldo dompet, 3 arus bulan ini,
// 4 sisa anggaran, 5 kekayaan bersih, 6 jatuh tempo tujuh hari, 7 progres tujuan. Titik fokus: total saldo.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataError } from '../../components/layout/DataError.tsx';
import { useShell } from '../../components/layout/AppShell.tsx';
import { Button, EmptyState, LoadingRows } from '../../components/ui.tsx';
import { api } from '../../lib/api.ts';
import { currentPeriod } from '../../lib/format.ts';
import { useAsync } from '../../lib/hooks.ts';
import { countDrafts } from '../../lib/offline.ts';
import { useSession } from '../../lib/session.tsx';
import { BudgetNearLimit } from './parts/BudgetNearLimit.tsx';
import { GoalList } from './parts/GoalList.tsx';
import { MonthFlow } from './parts/MonthFlow.tsx';
import { NetWorthPanel } from './parts/NetWorthPanel.tsx';
import { SaldoPanel } from './parts/SaldoPanel.tsx';
import { UpcomingList } from './parts/UpcomingList.tsx';
import { WorkBanner } from './parts/WorkBanner.tsx';
import { RecurringSheet } from './parts/RecurringSheet.tsx';

export function BerandaPage() {
  const { user } = useSession();
  const { dataVersion, openQuickEntry } = useShell();
  const navigate = useNavigate();
  const period = currentPeriod();
  const [recurringOpen, setRecurringOpen] = useState(false);
  const state = useAsync(async () => {
    const [dashboard, budgets] = await Promise.all([api.dashboard(), api.budgets({ period })]);
    return { dashboard, budgets };
  }, [dataVersion, period]);

  // Draf lokal: dibaca dari perangkat ini, bukan dari server (PRD FR22). Server selalu melaporkan
  // draftsPending 0 karena draf tidak pernah meninggalkan peramban, jadi keduanya dijumlahkan.
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

  // Pengguna baru (PRD "Alur utama", "Standar tampilan"): tanpa dompet, seluruh panel hanya berisi nol
  // dan pekerjaan yang menunggu pun kosong. Layar ini menampilkan satu aksi berikutnya, bukan ringkasan
  // kosong: membuat dompet lebih dulu, karena transaksi tidak bisa dicatat tanpa dompet (PRD FR02).
  if (dashboard.wallets.length === 0) {
    return (
      <div className="flex flex-col gap-3 pt-4">
        <h1 className="sr-only">Beranda</h1>
        <EmptyState
          title="Mulai dari sini"
          body="Buat dompet pertama — kas harian, rekening bank, atau e-wallet — lalu catat transaksi pertama Anda. Saldo awal dicatat sebagai jurnal pembukaan, bukan pendapatan."
          action={<Button onClick={() => navigate('/profil')}>Buat dompet pertama</Button>}
        />
      </div>
    );
  }
  const nearBudgets = budgets.filter((budget) => budget.warning === 'near');

  return (
    <div className="flex flex-col gap-3 pt-4 lg:gap-4">
      {/* Judul halaman wajib ada satu per layar; di Beranda blok pertama tetap banner pekerjaan,
          jadi judulnya hanya hidup di pohon aksesibilitas (DESIGN.md "Layout"). */}
      <h1 className="sr-only">Beranda</h1>
      <WorkBanner
        counts={{
          drafts: draftCount + dashboard.draftsPending,
          occurrences: dashboard.pendingOccurrences,
          budgetsOver: dashboard.budgetsOver,
          budgetsNear: nearBudgets.length,
        }}
        onWriteDraft={() => openQuickEntry()}
        onReviewBudget={() => navigate('/rencana')}
        onConfirmRecurring={() => setRecurringOpen(true)}
      />
      <SaldoPanel dashboard={dashboard} timezone={user?.timezone} />
      <MonthFlow
        period={dashboard.period}
        income={dashboard.income}
        expense={dashboard.expense}
        net={dashboard.net}
      />
      <BudgetNearLimit budgets={budgets} budgetRemaining={dashboard.budgetRemaining} period={period} />
      <NetWorthPanel dashboard={dashboard} />
      {/* Di layar lebar dua blok terakhir berdampingan; urutan bacanya tetap 6 lalu 7. */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
        <UpcomingList items={dashboard.upcoming} />
        <GoalList goals={dashboard.goals} />
      </div>
      <RecurringSheet open={recurringOpen} onClose={() => setRecurringOpen(false)} />
    </div>
  );
}
