// routes/rencana/parts/BudgetTab.tsx : monthly limits per expense category (PRD FR15).
// Spending stays allowed past the limit; the warning is information, not a block.
// Each budget is one card: category, the bar with its percentage, then Terpakai, Batas, and Sisa
// stacked in the sign column so every amount lands on the same right edge.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Budget } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, Card, EmptyState, ErrorState, Field, LoadingRows, Money, ProgressBar, SectionHead, Select, StatusPill, useToast,
} from '../../../components/ui.tsx';
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
  if (budgets.error && !budgets.data) return <ErrorState message={budgets.error.display} onRetry={budgets.reload} />;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {/* Titik fokus layar ini: sisa anggaran bulan yang sedang dilihat. */}
      <Card className="px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-muted">Sisa anggaran {formatPeriod(period)}</p>
            <p className="mt-1">
              <Money value={totalRemaining} direction={totalRemaining < 0 ? 'out' : 'in'} size="lg" />
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Terpakai dari limit</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] items-baseline gap-x-3">
              <dt className="text-xs text-muted">Terpakai</dt>
              <dd className="text-right">
                <Money value={totalSpent} direction="out" />
              </dd>
              <dt className="text-xs text-muted">Limit</dt>
              <dd className="text-right">
                <Money value={totalLimit} />
              </dd>
            </dl>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Pengeluaran tetap boleh dicatat setelah limit terlampaui. Transfer, pokok utang, dan alokasi tujuan tidak mengonsumsi anggaran.
        </p>
      </Card>

      <Card className="px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-[240px]">
            <Field label="Bulan anggaran" htmlFor="anggaran-bulan">
              <Select id="anggaran-bulan" value={period} onChange={(event) => setPeriod(event.target.value)}>
                {periodOptions(12).map((option) => (
                  <option key={option} value={option}>
                    {formatPeriod(option)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {available.length > 0 ? (
            <Button onClick={() => setCreating(true)}>Tetapkan anggaran</Button>
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

      {budgets.error && budgets.data ? <ErrorState message={budgets.error.display} onRetry={budgets.reload} /> : null}

      {list.length === 0 ? (
        <EmptyState
          title={`Belum ada anggaran untuk ${formatPeriod(period)}`}
          body="Anggaran memberi batas bulanan per kategori pengeluaran, lengkap dengan peringatan saat mendekati dan melewati limit."
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
          <p className="text-xs text-muted">
            Limit {formatPercent(ratio)} terpakai · {formatPeriod(budget.periodStart.slice(0, 7))}
          </p>
        </div>
        <Button variant="ghost" onClick={onEdit}>
          Ubah limit
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {over ? <StatusPill tone="out">Limit terlampaui {formatPercent(ratio)}</StatusPill> : null}
        {near ? <StatusPill tone="warn">Mendekati limit {formatPercent(ratio)}</StatusPill> : null}
      </div>

      <div className="mt-3">
        <ProgressBar ratio={ratio} tone={tone} showPercent label={`Pemakaian anggaran ${budget.categoryName}`} />
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs text-muted">
        <dt>Terpakai</dt>
        <dd className="text-right">
          <Money value={budget.spent} direction="out" />
        </dd>
        <dt>Batas</dt>
        <dd className="text-right">
          <Money value={budget.limit} />
        </dd>
        <dt>{remaining < 0 ? 'Kelebihan' : 'Sisa'}</dt>
        <dd className="text-right">
          <Money value={Math.abs(remaining)} direction={remaining < 0 ? 'out' : 'in'} />
        </dd>
      </dl>
    </Card>
  );
}
