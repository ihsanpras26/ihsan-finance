// routes/rencana/parts/BudgetTab.tsx : batas bulanan per kategori pengeluaran (PRD FR15).
// Pengeluaran tetap boleh dicatat setelah batas terlewati; peringatannya informasi, bukan larangan.
// Bulan dipilih lewat deret chip, dan tiap kartu menaruh Terpakai, Plafon, serta Sisa pada kolom
// angka yang lurus ke tepi kanan, dengan keadaan batas yang selalu disertai kata.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Budget } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, Card, Chip, EmptyState, LoadingRows, Money, ProgressBar, SectionHead, StatusPill, useToast,
} from '../../../components/ui.tsx';
import { DataError } from '../../../components/layout/DataError.tsx';
import { BudgetForm } from '../../../components/forms/BudgetForm.tsx';
import { currentPeriod, formatPercent, formatPeriod, periodOptions, toMinor } from '../../../lib/format.ts';
import { sumMinor } from './money.ts';

export function BudgetTab() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(currentPeriod());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const budgets = useAsync(() => api.budgets({ period }), [period]);
  const categories = useAsync(() => api.categories({ kind: 'expense' }), []);

  const list = budgets.data ?? [];
  const totalLimit = sumMinor(list.map((entry) => entry.limit));
  const totalSpent = sumMinor(list.map((entry) => entry.spent));
  const totalRemaining = sumMinor(list.map((entry) => entry.remaining));

  const usedCategoryIds = new Set(list.map((entry) => entry.categoryId));
  const available = (categories.data ?? []).filter((entry) => !entry.archivedAt && !usedCategoryIds.has(entry.id));

  function refresh(message: string) {
    push('success', message);
    budgets.reload();
  }

  if (budgets.loading && !budgets.data) return <LoadingRows rows={4} label="Memuat anggaran" />;
  if (budgets.error && !budgets.data) return <DataError error={budgets.error} onRetry={budgets.reload} />;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {/* Titik fokus layar ini: sisa anggaran bulan yang sedang dilihat. */}
      <Card className="px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-muted">Sisa anggaran {formatPeriod(period)}</p>
            <p className="mt-1" aria-live="polite">
              <Money value={totalRemaining} direction={totalRemaining < 0 ? 'out' : 'in'} size="lg" />
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs text-muted">
            <dt>Total plafon</dt>
            <dd className="text-right">
              <Money value={totalLimit} />
            </dd>
            <dt>Total terpakai</dt>
            <dd className="text-right">
              <Money value={totalSpent} direction="out" />
            </dd>
          </dl>
        </div>
        <p className="mt-3 text-xs text-muted">
          Pengeluaran tetap boleh dicatat setelah batas terlampaui. Transfer, pokok utang, dan alokasi tujuan tidak mengonsumsi anggaran.
        </p>
      </Card>

      <Card className="px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div role="group" aria-label="Bulan anggaran" className="flex min-w-0 flex-col gap-2">
            <span className="text-2xs font-semibold text-muted">Bulan anggaran</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {periodOptions(12).map((option) => (
                <Chip key={option} selected={option === period} onClick={() => setPeriod(option)}>
                  {formatPeriod(option)}
                </Chip>
              ))}
            </div>
          </div>
          {available.length > 0 ? (
            <Button className="sm:shrink-0" onClick={() => setCreating(true)}>Tetapkan anggaran</Button>
          ) : (
            <p className="text-xs text-muted sm:max-w-[60%] sm:text-right">
              {categories.loading
                ? 'Memuat kategori pengeluaran.'
                : categories.error
                  ? 'Kategori pengeluaran gagal dimuat, jadi anggaran baru belum bisa ditetapkan.'
                  : list.length === 0
                    ? 'Buat kategori pengeluaran dulu di Profil sebelum menetapkan anggaran.'
                    : `Semua kategori pengeluaran sudah punya anggaran untuk ${formatPeriod(period)}.`}
            </p>
          )}
        </div>
      </Card>

      {budgets.error && budgets.data ? <DataError error={budgets.error} onRetry={budgets.reload} /> : null}

      {list.length === 0 ? (
        <EmptyState
          title={`Belum ada anggaran untuk ${formatPeriod(period)}`}
          body="Anggaran memberi batas bulanan per kategori pengeluaran, lengkap dengan peringatan saat mendekati dan melewati batas."
          action={
            available.length > 0 ? (
              <Button variant="secondary" onClick={() => setCreating(true)}>
                Tetapkan anggaran
              </Button>
            ) : !categories.loading && !categories.error ? (
              <Button variant="secondary" onClick={() => void navigate('/profil')}>
                Buka Profil
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section>
          <SectionHead title="Batas per kategori" />
          <ul className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            {list.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} onEdit={() => setEditing(budget)} />
            ))}
          </ul>
        </section>
      )}

      {creating ? (
        <BudgetForm
          open
          onClose={() => setCreating(false)}
          onSaved={refresh}
          categories={available}
          period={period}
        />
      ) : null}

      {editing ? (
        <BudgetForm
          open
          onClose={() => setEditing(null)}
          onSaved={refresh}
          categories={[]}
          period={period}
          budget={editing}
        />
      ) : null}
    </div>
  );
}

function BudgetCard({ budget, onEdit }: { budget: Budget; onEdit: () => void }) {
  const ratio = Number.isFinite(budget.ratio) ? budget.ratio : 0;
  const over = budget.warning === 'over' || ratio >= 1;
  const near = !over && (budget.warning === 'near' || ratio >= 0.8);
  const remaining = toMinor(budget.remaining);
  const tone = over ? 'out' : near ? 'warn' : 'accent';

  return (
    <Card as="li" className="px-4 py-4 lg:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{budget.categoryName}</p>
          <p className="text-xs text-muted">Anggaran {formatPeriod(budget.periodStart.slice(0, 7))}</p>
        </div>
        <Button variant="ghost" onClick={onEdit}>
          Ubah limit
        </Button>
      </div>

      {over || near ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {over ? <StatusPill tone="out">Lewat batas {formatPercent(ratio)}</StatusPill> : null}
          {near ? <StatusPill tone="warn">Mendekati batas {formatPercent(ratio)}</StatusPill> : null}
        </div>
      ) : null}

      <div className="mt-3">
        <ProgressBar ratio={ratio} tone={tone} showPercent label={`Pemakaian anggaran ${budget.categoryName}`} />
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs text-muted">
        <dt>Terpakai</dt>
        <dd className="text-right">
          <Money value={budget.spent} direction="out" />
        </dd>
        <dt>Plafon</dt>
        <dd className="text-right">
          <Money value={budget.limit} />
        </dd>
        <dt>{remaining < 0 ? 'Lewat plafon' : 'Sisa'}</dt>
        <dd className="text-right">
          <Money value={Math.abs(remaining)} direction={remaining < 0 ? 'out' : 'in'} />
        </dd>
      </dl>
    </Card>
  );
}
