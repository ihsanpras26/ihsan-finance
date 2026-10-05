// routes/notifikasi/Notifikasi.tsx - pemberitahuan, dikelompokkan menurut jenisnya (PRD §08).
// Menandai terbaca adalah perubahan pada daftar, jadi barisnya diubah lebih dulu lalu dikembalikan
// bila server menolak; daftarnya tidak dimuat ulang supaya pengguna tidak kehilangan tempat membaca.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Notification } from '../../lib/api.ts';
import { useAsync } from '../../lib/hooks.ts';
import {
  Button, Card, EmptyState, IconTile, LoadingRows, PageHeader, SectionHead, StatusPill, useToast,
} from '../../components/ui.tsx';
import { IconBell, IconBudget, IconCheck, IconClock, IconGoal, IconRepeat } from '../../components/icons.tsx';
import { formatDateShort, relativeDay } from '../../lib/format.ts';
import { useShell } from '../../components/layout/AppShell.tsx';
import { DataError } from '../../components/layout/DataError.tsx';

// Kelompok tetap, dari yang paling mendesak: kewajiban yang bertanggal, lalu batas anggaran,
// lalu rencana jangka panjang. Jenis baru dari server tidak pernah salah masuk kelompok.
type GroupId = 'jatuh_tempo' | 'anggaran' | 'rencana' | 'lain';

const GROUP_ORDER: GroupId[] = ['jatuh_tempo', 'anggaran', 'rencana', 'lain'];

const GROUP_LABEL: Record<GroupId, string> = {
  jatuh_tempo: 'Jatuh tempo',
  anggaran: 'Anggaran',
  rencana: 'Rencana',
  lain: 'Pemberitahuan lain',
};

function groupOf(kind: string): GroupId {
  if (kind === 'debt_due') return 'jatuh_tempo';
  if (kind === 'budget_threshold') return 'anggaran';
  if (kind === 'recurring_pending' || kind === 'goal_reached' || kind === 'goal_short') return 'rencana';
  return 'lain';
}

/** Ikon mengikuti jenis pemberitahuan, supaya isinya terbaca dari bentuknya (R-04). */
function KindIcon({ kind }: { kind: string }) {
  if (kind === 'debt_due') return <IconClock size={18} />;
  if (kind === 'budget_threshold') return <IconBudget size={18} />;
  if (kind === 'recurring_pending') return <IconRepeat size={18} />;
  if (kind === 'goal_reached' || kind === 'goal_short') return <IconGoal size={18} />;
  return <IconBell size={18} />;
}

export function NotifikasiPage() {
  const { push } = useToast();
  const { notifyDataChanged } = useShell();
  const navigate = useNavigate();
  const state = useAsync(() => api.notifications({ status: 'all' }), []);
  const [busy, setBusy] = useState(false);

  const list = state.data ?? [];
  const unread = list.filter((item) => item.status === 'unread');

  const groups: { id: GroupId; label: string; items: Notification[] }[] = [];
  for (const id of GROUP_ORDER) {
    const items = list.filter((item) => groupOf(item.kind) === id);
    if (items.length > 0) groups.push({ id, label: GROUP_LABEL[id], items });
  }

  const subtitle = !state.data
    ? 'Pengingat jatuh tempo, batas anggaran, dan dana tujuan.'
    : list.length === 0
      ? 'Belum ada pemberitahuan masuk.'
      : unread.length > 0
        ? `${unread.length} pemberitahuan belum dibaca.`
        : 'Semua pemberitahuan sudah dibaca.';

  async function markRead(id: string) {
    const snapshot = state.data;
    if (!snapshot || busy) return;
    setBusy(true);
    state.setData(snapshot.map((item) => ({ ...item, status: item.id === id ? 'read' : item.status })));
    try {
      await api.readNotification(id);
      notifyDataChanged();
    } catch {
      state.setData(snapshot);
      push('error', 'Pemberitahuan gagal ditandai terbaca. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    const snapshot = state.data;
    if (!snapshot || busy) return;
    setBusy(true);
    state.setData(snapshot.map((item) => ({ ...item, status: 'read' as const })));
    try {
      await api.readAllNotifications();
      notifyDataChanged();
      push('success', 'Semua pemberitahuan ditandai terbaca.');
    } catch {
      state.setData(snapshot);
      push('error', 'Pemberitahuan gagal ditandai terbaca. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Notifikasi"
        subtitle={subtitle}
        action={
          unread.length > 0 ? (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void markAll()}>
              Tandai semua dibaca
            </Button>
          ) : null
        }
      />

      {/* Jumlah belum dibaca berubah tanpa perpindahan fokus, jadi perubahannya diumumkan di sini. */}
      <p className="sr-only" aria-live="polite">
        {state.data ? subtitle : ''}
      </p>

      {state.loading && !state.data ? (
        <div className="mt-3">
          <LoadingRows rows={4} label="Memuat pemberitahuan" />
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-3">
          <DataError error={state.error} onRetry={state.reload} />
        </div>
      ) : null}

      {state.data && list.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Belum ada pemberitahuan"
            body="Pengingat muncul di sini saat utang atau piutang mendekati jatuh tempo, saat anggaran mendekati batas, dan saat dana tujuan perlu ditambah. Pengingat jatuh tempo dapat dimatikan di layar Profil."
            action={<Button onClick={() => navigate('/')}>Kembali ke Beranda</Button>}
          />
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.id}>
          <SectionHead title={group.label} />
          <Card className="px-4">
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <NotificationRow key={item.id} item={item} busy={busy} onRead={() => void markRead(item.id)} />
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

function NotificationRow({ item, busy, onRead }: { item: Notification; busy: boolean; onRead: () => void }) {
  const isUnread = item.status === 'unread';
  return (
    <li className="row-divide flex flex-col gap-1 py-3">
      <div className="flex items-start gap-3">
        <IconTile tone={isUnread ? 'warn' : 'neutral'}>
          <KindIcon kind={item.kind} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-fg">{item.title}</span>
            {isUnread ? (
              <StatusPill tone="warn">
                <IconBell size={12} className="mr-1" />
                Belum dibaca
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted">{item.body}</p>
          <p className="mt-0.5 text-xs text-muted">
            {item.dueDate
              ? `Jatuh tempo ${relativeDay(item.dueDate)} · ${formatDateShort(item.dueDate)}`
              : `Dibuat ${formatDateShort(item.createdAt.slice(0, 10))}`}
          </p>
        </div>
      </div>
      {isUnread ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onRead}>
            <IconCheck size={16} />
            Tandai dibaca
          </Button>
        </div>
      ) : null}
    </li>
  );
}
