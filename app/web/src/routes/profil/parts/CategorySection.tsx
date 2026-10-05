// routes/profil/parts/CategorySection.tsx : kategori: buat, ubah nama, arsipkan (PRD FR05).
// Kategori diarsipkan, bukan dihapus, supaya transaksi lama tetap punya pengelompokan.
import { useState } from 'react';
import { api, type Category } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, Card, CardHead, ConfirmDialog, EmptyState, IconTile, LoadingRows, StatusPill, Tabs, useToast,
} from '../../../components/ui.tsx';
import { IconIn, IconOut } from '../../../components/icons.tsx';
import { DataError } from '../../../components/layout/DataError.tsx';
import { CategoryForm } from '../../../components/forms/CategoryForm.tsx';
import { errorMessage } from '../../../components/forms/support.tsx';
import { SectionEmpty } from './Row.tsx';

type Filter = 'semua' | 'expense' | 'income';

const FILTER_TITLE: Record<Filter, string> = {
  semua: 'kategori',
  expense: 'kategori pengeluaran',
  income: 'kategori pendapatan',
};

export function CategorySection() {
  const { push } = useToast();
  const [filter, setFilter] = useState<Filter>('semua');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const categories = useAsync(() => api.categories({ includeArchived: true }), []);
  const list = categories.data ?? [];
  const filtered = filter === 'semua' ? list : list.filter((entry) => entry.kind === filter);
  const archivedCount = list.filter((entry) => entry.archivedAt).length;
  const counts = {
    semua: list.length,
    expense: list.filter((entry) => entry.kind === 'expense' && !entry.archivedAt).length,
    income: list.filter((entry) => entry.kind === 'income' && !entry.archivedAt).length,
  };
  const [busy, setBusy] = useState(false);

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
    <section className="mt-4">
      {categories.loading && !categories.data ? <LoadingRows rows={3} label="Memuat kategori" /> : null}
      {categories.error ? (
        <DataError error={categories.error} onRetry={categories.reload} label="Kategori gagal dimuat." />
      ) : null}

      {categories.data ? (
        list.length === 0 ? (
          <EmptyState
            title="Belum ada kategori"
            body="Kategori mengelompokkan transaksi dan menjadi dasar anggaran bulanan. Kategori yang tidak dipakai lagi diarsipkan, bukan dihapus."
            action={<Button onClick={() => setCreating(true)}>Kategori baru</Button>}
          />
        ) : (
          <Card className="px-4 pb-2">
            <div className="pt-4">
              <CardHead
                title="Kategori"
                subtitle="Pengelompokan transaksi dan anggaran bulanan."
                action={
                  <Button size="sm" onClick={() => setCreating(true)}>
                    Kategori baru
                  </Button>
                }
              />
            </div>

            <div className="mt-3">
              <Tabs
                label="Saring kategori"
                active={filter}
                onChange={setFilter}
                tabs={[
                  { id: 'semua', label: 'Semua', count: counts.semua },
                  { id: 'expense', label: 'Pengeluaran', count: counts.expense },
                  { id: 'income', label: 'Pendapatan', count: counts.income },
                ]}
              />
            </div>

            {filtered.length === 0 ? (
              <SectionEmpty
                title={`Tidak ada ${FILTER_TITLE[filter]}`}
                body="Saringan ini sedang kosong, kategori lain tetap tersimpan. Tampilkan semuanya untuk melihat daftar lengkap."
                action={
                  <Button variant="secondary" onClick={() => setFilter('semua')}>
                    Tampilkan semua kategori
                  </Button>
                }
              />
            ) : (
              <ul className="mt-1 flex flex-col">
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
            )}

            <p className="py-3 text-xs text-muted">
              {archivedCount > 0
                ? `${archivedCount} kategori diarsipkan. Kategori arsip masih dipakai transaksi lama dan masih bisa diubah namanya.`
                : 'Kategori yang diarsipkan tidak lagi muncul saat mencatat transaksi baru, tetapi transaksi lama tetap memakainya.'}
            </p>
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
