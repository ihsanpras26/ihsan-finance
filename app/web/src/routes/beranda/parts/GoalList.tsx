// parts/GoalList.tsx : progres tujuan aktif, maksimal tiga baris supaya tinggi Beranda tetap terduga.
// Muatan dashboard tidak membawa tanggal target, jadi sisa hari dibaca di layar Rencana.
import { EmptyState, Card, CardHead, IconTile, Money, ProgressBar } from '../../../components/ui.tsx';
import { IconGoal } from '../../../components/icons.tsx';
import type { DashboardData } from '../../../lib/api.ts';
import { SectionLink } from './SectionLink.tsx';

export function GoalList({ goals }: { goals: DashboardData['goals'] }) {
  const active = goals.filter((goal) => goal.status === 'active');

  if (active.length === 0) {
    return (
      <EmptyState
        title="Belum ada tujuan aktif"
        body="Tujuan dan alokasi dananya dibuat di layar Rencana. Setelah ada tujuan aktif, progresnya muncul di sini."
        action={<SectionLink to="/rencana">Buat tujuan</SectionLink>}
      />
    );
  }

  const shown = active.slice(0, 3);

  return (
    <Card className="px-4 py-4 lg:px-5">
      <CardHead title="Progres tujuan" action={<SectionLink to="/rencana">Kelola tujuan</SectionLink>} />
      <ul className="mt-1 flex flex-col">
        {shown.map((goal) => (
          <li key={goal.id} className="row-divide flex flex-col gap-2 py-3">
            <div className="flex items-center gap-3">
              <IconTile tone="accent-2" size="sm">
                <IconGoal size={17} />
              </IconTile>
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{goal.name}</span>
            </div>
            {/* Persentase sudah dicetak di ujung kanan bilah oleh ProgressBar, jadi tidak diulang di atasnya. */}
            <ProgressBar ratio={goal.progress} label={`Progres tujuan ${goal.name}`} showPercent />
            {/* Label kiri, nominal kanan: seluruh nominal kartu lurus pada satu tepi (DESIGN.md "Kolom tanda"). */}
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs text-muted">
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
      {active.length > shown.length ? (
        <p className="pt-2 text-xs text-muted">{active.length - shown.length} tujuan lain ada di layar Rencana.</p>
      ) : null}
    </Card>
  );
}
