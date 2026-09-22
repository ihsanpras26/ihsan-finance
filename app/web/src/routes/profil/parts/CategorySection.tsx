// routes/profil/parts/CategorySection.tsx : categories: create, rename, archive (PRD FR05).
// Categories are archived rather than deleted, so old transactions keep their grouping.
import { useState } from 'react';
import { api, type Category } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, IconTile, LoadingRows, SectionHead, StatusPill, Tabs, useToast,
} from '../../../components/ui.tsx';
import { IconIn, IconOut } from '../../../components/icons.tsx';
import { CategoryForm } from '../../../components/forms/CategoryForm.tsx';
import { errorMessage } from '../../../components/forms/support.tsx';

type Filter = 'semua' | 'expense' | 'income';

export function CategorySection() {
  const { push } = useToast();
  const [filter, setFilter] = useState<Filter>('semua');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useAsync(() => api.categories({ includeArchived: true }), []);
  const list = categories.data ?? [];
  const filtered = filter === 'semua' ? list : list.filter((entry) => entry.kind === filter);
  const activeCount = (kind: 'income' | 'expense') => list.filter((entry) => entry.kind === kind && !entry.archivedAt).length;

  function refresh(message: string) {
    push('success', message);
    categories.reload();
  }

  async function archiveCategory(category: Category) {
    setBusy(true);
    try {
      await api.archiveCategory(category.id);
      setArchiving(null);
      refresh(`Kategori ${category.name} diarsipkan.`);
    } catch (caught) {
      push('error', `Kategori gagal diarsipkan. ${errorMessage(caught)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHead
        title="Kategori"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            Kategori baru
          </Button>
        }
      />

      <div className="mb-3">
        <Tabs
          label="Saring kategori"
          active={filter}
          onChange={setFilter}
          tabs={[
            { id: 'semua', label: 'Semua', count: list.length },
            { id: 'expense', label: 'Pengeluaran', count: activeCount('expense') },
            { id: 'income', label: 'Pendapatan', count: activeCount('income') },
          ]}
        />
      </div>

      {categories.loading && !categories.data ? <LoadingRows rows={3} label="Memuat kategori" /> : null}
      {categories.error ? <ErrorState message={categories.error.display} onRetry={categories.reload} /> : null}

      {categories.data ? (
        filtered.length === 0 ? (
          <EmptyState
            title={filter === 'income' ? 'Belum ada kategori pendapatan' : filter === 'expense' ? 'Belum ada kategori pengeluaran' : 'Belum ada kategori'}
            body="Kategori mengelompokkan transaksi dan menjadi dasar anggaran bulanan. Kategori yang tidak dipakai lagi diarsipkan, bukan dihapus."
            action={<Button onClick={() => setCreating(true)}>Kategori baru</Button>}
          />
        ) : (
          <Card className="px-4">
            <ul className="flex flex-col">
              {filtered.map((category) => (
                <li key={category.id} className="row-divide flex flex-wrap items-center gap-3 py-3">
                  <IconTile tone={category.kind === 'income' ? 'in' : 'out'}>
                    {category.kind === 'income' ? <IconIn size={18} /> : <IconOut size={18} />}
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-fg">{category.name}</span>
                      <StatusPill tone={category.kind === 'income' ? 'in' : 'out'}>
                        {category.kind === 'income' ? 'Pendapatan' : 'Pengeluaran'}
                      </StatusPill>
                      {category.archivedAt ? <StatusPill tone="neutral">Diarsipkan</StatusPill> : null}
                    </div>
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(category)}>
                      Ubah nama
                    </Button>
                    {category.archivedAt ? null : (
                      <Button variant="ghost" size="sm" onClick={() => setArchiving(category)}>
                        Arsipkan
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {creating ? <CategoryForm open onClose={() => setCreating(false)} onSaved={refresh} /> : null}
      {editing ? <CategoryForm open onClose={() => setEditing(null)} onSaved={refresh} category={editing} /> : null}

      <ConfirmDialog
        open={archiving !== null}
        title="Arsipkan kategori"
        body={`Arsipkan ${archiving?.name ?? ''}? Kategori arsip tidak lagi muncul saat mencatat transaksi baru, tetapi transaksi lama tetap memakainya.`}
        confirmLabel="Arsipkan kategori"
        busy={busy}
        onConfirm={() => {
          if (archiving) void archiveCategory(archiving);
        }}
        onCancel={() => setArchiving(null)}
      />
    </section>
  );
}
