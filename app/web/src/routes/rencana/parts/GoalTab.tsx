// routes/rencana/parts/GoalTab.tsx : savings goals: progress, shortfall, and a monthly plan.
// A passed target date offers to change the plan instead of producing a negative or zero division.
// Each goal is one card: name and date first, the bar with its percentage, then the two figures
// (Terkumpul and Target) stacked in the sign column so a list of goals compares down one edge.
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { api, type Goal } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import { useSession } from '../../../lib/session.tsx';
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, IconTile, LoadingRows, Money, ProgressBar, RowTitle, SectionHead, Sheet, StatusPill, TextInput, useToast,
} from '../../../components/ui.tsx';
import { IconGoal } from '../../../components/icons.tsx';
import { GoalForm } from '../../../components/forms/GoalForm.tsx';
import { AllocationForm } from '../../../components/forms/AllocationForm.tsx';
import { errorMessage, issuesFrom, RadioGroup, type FormIssues } from '../../../components/forms/support.tsx';
import { formatDateLong, formatIDR, parseIso, toMinor, todayIso } from '../../../lib/format.ts';
import { sumMinor } from './money.ts';

type PlanState =
  | { mode: 'allocate' | 'release'; goal: Goal }
  | { mode: 'edit'; goal: Goal }
  | null;

export function GoalTab() {
  const { push } = useToast();
  const { preferences } = useSession();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState<PlanState>(null);
  const [archiving, setArchiving] = useState<Goal | null>(null);

  const goals = useAsync(() => api.goals({ includeArchived: showArchived }), [showArchived]);
  const wallets = useAsync(() => api.wallets(), []);

  const list = goals.data ?? [];
  const activeList = list.filter((entry) => entry.status === 'active');
  const totalAllocated = sumMinor(activeList.map((entry) => entry.allocated));

  function refresh(message: string) {
    push('success', message);
    goals.reload();
    wallets.reload();
  }

  async function markAchieved(goal: Goal) {
    try {
      await api.updateGoal(goal.id, { status: 'achieved', expectedVersion: goal.version });
      refresh(`Tujuan ${goal.name} ditandai tercapai.`);
    } catch (caught) {
      push('error', errorMessage(caught));
    }
  }

  async function reactivate(goal: Goal) {
    try {
      await api.updateGoal(goal.id, { status: 'active', expectedVersion: goal.version });
      refresh(`Tujuan ${goal.name} aktif kembali.`);
    } catch (caught) {
      push('error', errorMessage(caught));
    }
  }

  if (goals.loading && !goals.data) return <LoadingRows rows={4} label="Memuat tujuan" />;
  if (goals.error && !goals.data) return <ErrorState message={goals.error.display} onRetry={goals.reload} />;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <Card className="px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-muted">Total teralokasi</p>
            <p className="mt-1">
              <Money value={totalAllocated} direction="in" size="lg" />
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Tujuan aktif</p>
            <p className="tnum mt-1 text-xl leading-tight font-medium text-fg">{activeList.length}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Alokasi menandai sebagian saldo dompet dan tidak menggerakkan uang. Dana yang sama tidak bisa dipakai dua tujuan sekaligus.
        </p>
      </Card>

      {wallets.error ? (
        <ErrorState message={`Daftar dompet gagal dimuat, jadi alokasi belum bisa disimpan. ${wallets.error.display}`} onRetry={wallets.reload} />
      ) : null}

      {goals.error && goals.data ? <ErrorState message={goals.error.display} onRetry={goals.reload} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreating(true)}>Buat tujuan</Button>
        <Button variant="secondary" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Sembunyikan yang diarsipkan' : 'Tampilkan yang diarsipkan'}
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Belum ada tujuan"
          body="Tujuan menampung dana untuk keperluan tertentu, misalnya dana pendidikan atau uang muka rumah. Buat tujuan lalu alokasikan dana dari dompet."
          action={
            <Button variant="secondary" onClick={() => setCreating(true)}>
              Buat tujuan
            </Button>
          }
        />
      ) : (
        <section>
          <SectionHead title="Tujuan keuangan" />
          <ul className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            {list.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onAllocate={() => setPlan({ mode: 'allocate', goal })}
                onRelease={() => setPlan({ mode: 'release', goal })}
                onEdit={() => setPlan({ mode: 'edit', goal })}
                onArchive={() => setArchiving(goal)}
                onAchieve={() => void markAchieved(goal)}
                onReactivate={() => void reactivate(goal)}
              />
            ))}
          </ul>
        </section>
      )}

      {creating ? <GoalForm open onClose={() => setCreating(false)} onSaved={refresh} /> : null}

      {plan && plan.mode !== 'edit' ? (
        <AllocationForm
          open
          onClose={() => setPlan(null)}
          onSaved={refresh}
          goal={plan.goal}
          wallets={wallets.data ?? []}
          mode={plan.mode}
          defaultWalletId={preferences.defaultWalletId ?? preferences.lastWalletId}
        />
      ) : null}

      {plan && plan.mode === 'edit' ? <GoalForm open onClose={() => setPlan(null)} onSaved={refresh} goal={plan.goal} /> : null}

      {archiving && toMinor(archiving.allocated) > 0 ? (
        <ArchiveGoalSheet goal={archiving} onClose={() => setArchiving(null)} onSaved={refresh} />
      ) : null}

      <ConfirmDialog
        open={archiving !== null && toMinor(archiving.allocated) === 0}
        title="Arsipkan tujuan"
        body={`Arsipkan ${archiving?.name ?? ''}? Progres dan riwayat alokasinya tetap tersimpan.`}
        confirmLabel="Arsipkan tujuan"
        onConfirm={() => {
          const goal = archiving;
          setArchiving(null);
          if (!goal) return;
          api
            .archiveGoal(goal.id, { resolution: 'release' })
            .then(() => refresh(`Tujuan ${goal.name} diarsipkan.`))
            .catch((caught: unknown) => push('error', errorMessage(caught)));
        }}
        onCancel={() => setArchiving(null)}
      />
    </div>
  );
}

const PRIORITY_LABEL: Record<string, string> = { '1': 'Prioritas tinggi', '2': 'Prioritas sedang', '3': 'Prioritas rendah' };

function GoalCard({
  goal, onAllocate, onRelease, onEdit, onArchive, onAchieve, onReactivate,
}: {
  goal: Goal;
  onAllocate: () => void;
  onRelease: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onAchieve: () => void;
  onReactivate: () => void;
}) {
  const shortfall = toMinor(goal.shortfall);
  const allocated = toMinor(goal.allocated);
  const archived = goal.status === 'archived';
  const achieved = goal.status === 'achieved';

  return (
    <Card as="li" className={`px-4 py-4 lg:px-5 ${archived ? 'opacity-80' : ''}`}>
      <div className="flex items-start gap-3">
        <IconTile tone={archived ? 'neutral' : 'accent-2'}>
          <IconGoal />
        </IconTile>
        <div className="min-w-0 flex-1">
          <RowTitle title={goal.name} meta={goal.targetDate ? `Target ${formatDateLong(goal.targetDate)}` : 'Belum ada tanggal target'} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {achieved ? <StatusPill tone="in">Tercapai</StatusPill> : null}
        {archived ? <StatusPill tone="neutral">Diarsipkan</StatusPill> : null}
        <StatusPill tone="neutral">{PRIORITY_LABEL[String(goal.priority)] ?? 'Sedang'}</StatusPill>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <ProgressBar
          ratio={goal.progress}
          tone={goal.progress >= 1 ? 'in' : 'accent'}
          showPercent
          label={`Progres tujuan ${goal.name}`}
        />
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs text-muted">
          <dt>Terkumpul</dt>
          <dd className="text-right">
            <Money value={goal.allocated} direction="in" />
          </dd>
          <dt>Target</dt>
          <dd className="text-right">
            <Money value={goal.target} />
          </dd>
          <dt>{shortfall > 0 ? 'Kekurangan' : 'Melebihi target'}</dt>
          <dd className="text-right">
            <Money value={Math.abs(shortfall)} direction={shortfall > 0 ? 'out' : 'in'} />
          </dd>
        </dl>
      </div>

      <div className="mt-3">
        <PlanLine goal={goal} shortfall={shortfall} onChangePlan={onEdit} onAchieve={onAchieve} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!archived ? (
          <Button variant="secondary" onClick={onAllocate}>
            Alokasikan dana
          </Button>
        ) : null}
        {!archived && allocated > 0 ? (
          <Button variant="ghost" onClick={onRelease}>
            Lepas alokasi
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onEdit}>
          Ubah rencana
        </Button>
        {archived ? (
          <Button variant="ghost" onClick={onReactivate}>
            Aktifkan lagi
          </Button>
        ) : (
          <Button variant="ghost" onClick={onArchive}>
            Arsipkan
          </Button>
        )}
      </div>
    </Card>
  );
}

function PlanLine({
  goal, shortfall, onChangePlan, onAchieve,
}: { goal: Goal; shortfall: number; onChangePlan: () => void; onAchieve: () => void }): ReactNode {
  const today = todayIso();

  if (shortfall <= 0) {
    if (goal.status === 'achieved') {
      return <p className="text-xs text-muted">Alokasi sudah mencapai target dan tujuan ini ditandai tercapai.</p>;
    }
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted">Alokasi sudah mencapai target. Tandai tercapai bila tujuan ini selesai.</p>
        <Button variant="secondary" onClick={onAchieve}>
          Tandai tercapai
        </Button>
      </div>
    );
  }

  if (!goal.targetDate) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted">
          Belum ada tanggal target, jadi proyeksi setoran bulanan belum bisa dihitung. Tambahkan tanggal target bila sudah ada rencananya.
        </p>
        <Button variant="secondary" onClick={onChangePlan}>
          Ubah rencana
        </Button>
      </div>
    );
  }

  const months = monthsUntil(goal.targetDate, today);
  if (months <= 0) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted">
          Tanggal target {formatDateLong(goal.targetDate)} sudah {goal.targetDate < today ? 'lewat' : 'tiba'}.
          Ubah tanggal target atau sesuaikan kekurangan dananya.
        </p>
        <Button variant="secondary" onClick={onChangePlan}>
          Ubah rencana
        </Button>
      </div>
    );
  }

  const perMonth = Math.ceil(shortfall / months);
  return (
    <p className="text-xs text-muted">
      Proyeksi setoran <Money value={perMonth} direction="in" size="sm" /> per bulan selama {months} bulan tersisa sampai {formatDateLong(goal.targetDate)}.
      Asumsi: kekurangan {formatIDR(shortfall)} dibagi {months} bulan tersisa, tanpa bunga. Sesuaikan bila tidak sesuai kemampuan.
    </p>
  );
}

/** Whole months from today to the target date; a partial month counts as one. Zero means the date has arrived. */
function monthsUntil(targetDate: string, today: string): number {
  if (targetDate <= today) return 0;
  const from = parseIso(today);
  const to = parseIso(targetDate);
  let months = (to.y - from.y) * 12 + (to.m - from.m);
  if (to.d > from.d) months += 1;
  return Math.max(0, months);
}

function ArchiveGoalSheet({
  goal, onClose, onSaved,
}: { goal: Goal; onClose: () => void; onSaved: (message: string) => void }) {
  const formId = useId();
  const [resolution, setResolution] = useState<'release' | 'keep'>('release');
  const [reason, setReason] = useState('');
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIssues({});
    setFailure(null);
    setBusy(true);
    try {
      await api.archiveGoal(goal.id, { resolution, reason: reason.trim() || undefined });
      onSaved(
        resolution === 'release'
          ? `Tujuan ${goal.name} diarsipkan dan alokasinya dilepas.`
          : `Tujuan ${goal.name} diarsipkan dengan alokasi tetap tercatat.`,
      );
      onClose();
    } catch (caught) {
      setIssues(issuesFrom(caught));
      setFailure(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Arsipkan tujuan"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} block>
            Arsipkan tujuan
          </Button>
          <Button variant="ghost" onClick={onClose} block>
            Batal
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {failure ? (
          <p className="rounded-control border border-out/40 px-3 py-2.5 text-sm text-fg" role="alert">
            {failure}
          </p>
        ) : null}

        <p className="text-sm text-fg">
          {goal.name} masih punya alokasi <Money value={goal.allocated} forceVisible />. Pilih dulu perlakuan alokasinya sebelum diarsipkan.
        </p>

        <RadioGroup
          legend="Perlakuan alokasi"
          value={resolution}
          onChange={setResolution}
          options={[
            { value: 'release', label: 'Lepas alokasi dulu', hint: 'Dana kembali bebas dipakai di dompet asalnya.' },
            { value: 'keep', label: 'Pertahankan alokasi', hint: 'Alokasi tetap tercatat pada tujuan yang diarsipkan.' },
          ]}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-reason`} className="text-xs font-semibold text-muted">
            Alasan arsip
          </label>
          <TextInput
            id={`${formId}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Opsional"
            invalid={Boolean(issues.reason)}
          />
        </div>
      </form>
    </Sheet>
  );
}
