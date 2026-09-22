// routes/rencana/parts/BudgetTab.tsx : monthly limits per expense category (PRD FR15).
// Spending stays allowed past the limit; the warning is information, not a block.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Budget } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, EmptyState, ErrorState, LedgerRow, LoadingRows, Money, ProgressBar, SectionHead, Select, StatusPill, useToast,
} from '../../../components/ui.tsx';
import { BudgetForm } from '../../../components/forms/BudgetForm.tsx';
import { currentPeriod, formatIDR, formatPercent, formatPeriod, periodOptions, toMinor } from '../../../lib/format.ts';
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
    <div className="flex flex-col gap-4">
      <div className="rounded-panel border border-hairline bg-raised px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-muted">Sisa anggaran {formatPeriod(period)}</p>
            <Money value={totalRemaining} direction={totalRemaining < 0 ? 'out' : 'in'} size="lg" />
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Terpakai dari limit</p>
            <span className="tnum text-sm font-semibold text-fg">
              {formatIDR(totalSpent)} dari {formatIDR(totalLimit)}
            </span>
          </div>
        </div>
        <p className="mt-2.5 text-xs text-muted">
          Pengeluaran tetap boleh dicatat setelah limit terlampaui. Transfer, pokok utang, dan alokasi tujuan tidak mengonsumsi anggaran.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[190px] flex-col gap-1.5">
          <label htmlFor="anggaran-bulan" className="text-xs font-semibold text-muted">
            Bulan anggaran
          </label>
          <Select id="anggaran-bulan" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {periodOptions(12).map((option) => (
              <option key={option} value={option}>
                {formatPeriod(option)}
              </option>
            ))}
          </Select>
        </div>
        {available.length > 0 ? (
          <Button onClick={() => setCreating(true)}>Tetapkan anggaran</Button>
        ) : (
          <p className="text-xs text-muted">
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

      {budgets.error && budgets.data ? <ErrorState message={budgets.error.display} onRetry={budgets.reload} /> : null}

      {list.length === 0 ? (
        <EmptyState
          title={`Belum ada anggaran untuk ${formatPeriod(period)}`}
          body="Anggaran memberi batas bulanan per kategori pengeluaran, lengkap dengan peringatan saat mendekati dan melewati limit."
          action={
            available.length > 0 ? (
              <Button onClick={() => setCreating(true)}>Tetapkan anggaran</Button>
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
          <ul className="mt-1">
            {list.map((budget) => (
              <LedgerRow as="li" key={budget.id}>
                <BudgetRow budget={budget} onEdit={() => setEditing(budget)} />
              </LedgerRow>
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

function BudgetRow({ budget, onEdit }: { budget: Budget; onEdit: () => void }) {
  const ratio = Number.isFinite(budget.ratio) ? budget.ratio : 0;
  const over = budget.warning === 'over' || ratio >= 1;
  const near = !over && (budget.warning === 'near' || ratio >= 0.8);
  const remaining = toMinor(budget.remaining);
  const tone = over ? 'out' : near ? 'warn' : 'accent';

  return (
    <div className="flex w-full flex-col gap-2 py-0.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-semibold text-fg">{budget.categoryName}</span>
          {over ? <StatusPill tone="warn">Limit terlampaui {formatPercent(ratio)}</StatusPill> : null}
          {near ? <StatusPill tone="warn">Mendekati limit {formatPercent(ratio)}</StatusPill> : null}
        </span>
        <Button variant="ghost" onClick={onEdit}>
          Ubah limit
        </Button>
      </div>

      <ProgressBar ratio={ratio} tone={tone} label={`Pemakaian anggaran ${budget.categoryName}`} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-muted">Terpakai</span>
          <Money value={budget.spent} direction="out" />
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-muted">{remaining < 0 ? 'Kelebihan' : 'Tersisa'}</span>
          <Money value={Math.abs(remaining)} direction={remaining < 0 ? 'out' : 'in'} />
        </span>
      </div>

      <p className="text-xs text-muted">
        Limit {formatIDR(budget.limit)} · {formatPeriod(budget.periodStart.slice(0, 7))} · terpakai {formatPercent(ratio)}
      </p>
    </div>
  );
}
