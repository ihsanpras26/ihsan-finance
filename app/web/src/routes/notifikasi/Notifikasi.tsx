// routes/notifikasi/Notifikasi.tsx : pengingat jatuh tempo dan pemberitahuan lain (PRD FR11).
// Endpoint notifikasi sudah ada di server; layar ini adalah rumahnya di antarmuka.
import { api, type Notification } from '../../lib/api.ts';
import { useAsync } from '../../lib/hooks.ts';
import { Button, Card, EmptyState, ErrorState, IconTile, LoadingRows, PageHeader, StatusPill, useToast } from '../../components/ui.tsx';
import { IconBell, IconCheck, IconClock } from '../../components/icons.tsx';
import { formatDateShort, relativeDay } from '../../lib/format.ts';
import { useShell } from '../../components/layout/AppShell.tsx';

export function NotifikasiPage() {
  const { push } = useToast();
  const { notifyDataChanged } = useShell();
  const state = useAsync(() => api.notifications({ status: 'all' }), []);

  const list = state.data ?? [];
  const unread = list.filter((item) => item.status === 'unread');

  async function markRead(id: string) {
    try {
      await api.readNotification(id);
      state.reload();
      notifyDataChanged();
    } catch {
      push('error', 'Pemberitahuan gagal ditandai terbaca. Coba lagi.');
    }
  }

  async function markAll() {
    try {
      const result = await api.readAllNotifications();
      push('success', result.updated > 0 ? `${result.updated} pemberitahuan ditandai terbaca.` : 'Tidak ada pemberitahuan yang perlu ditandai.');
      state.reload();
      notifyDataChanged();
    } catch {
      push('error', 'Pemberitahuan gagal ditandai terbaca. Coba lagi.');
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Notifikasi"
        subtitle={unread.length > 0 ? `${unread.length} pemberitahuan belum dibaca.` : 'Semua pemberitahuan sudah dibaca.'}
        action={
          unread.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => void markAll()}>
              Tandai semua
            </Button>
          ) : null
        }
      />

      {state.loading && !state.data ? (
        <div className="mt-3">
          <LoadingRows rows={4} label="Memuat pemberitahuan" />
        </div>
      ) : null}

      {state.error ? (
        <div className="mt-3">
          <ErrorState message={state.error.display} onRetry={state.reload} />
        </div>
      ) : null}

      {state.data ? (
        list.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Belum ada pemberitahuan"
              body="Pengingat jatuh tempo utang dan piutang muncul di sini pada H−7, H−1, dan hari jatuh tempo. Pengingat dapat dimatikan di layar Profil."
            />
          </div>
        ) : (
          <Card className="mt-3 px-4">
            <ul className="flex flex-col">
              {list.map((item) => (
                <NotificationRow key={item.id} item={item} onRead={() => void markRead(item.id)} />
              ))}
            </ul>
          </Card>
        )
      ) : null}
    </div>
  );
}

function NotificationRow({ item, onRead }: { item: Notification; onRead: () => void }) {
  const isUnread = item.status === 'unread';
  return (
    <li className="row-divide flex items-start gap-3 py-3">
      <IconTile tone={isUnread ? 'warn' : 'neutral'}>
        {item.dueDate ? <IconClock size={18} /> : <IconBell size={18} />}
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-fg">{item.title}</span>
          {isUnread ? <StatusPill tone="warn">Belum dibaca</StatusPill> : null}
        </div>
        <p className="mt-0.5 text-sm text-muted">{item.body}</p>
        <p className="mt-1 text-xs text-muted">
          {item.dueDate ? `Jatuh tempo ${relativeDay(item.dueDate)} · ${formatDateShort(item.dueDate)}` : formatDateShort(item.createdAt.slice(0, 10))}
        </p>
      </div>
      {isUnread ? (
        <Button variant="ghost" size="sm" onClick={onRead}>
          <IconCheck size={16} />
          Tandai
        </Button>
      ) : null}
    </li>
  );
}
