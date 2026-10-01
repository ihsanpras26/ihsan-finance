// parts/BudgetNearLimit.tsx : sisa anggaran bulan berjalan dan kategori yang paling dekat batasnya (FR08).
// Urutannya menurut kedekatan dengan batas, bukan abjad: pengguna membuka layar ini untuk menahan kategori.
import {
  Card, CardHead, IconTile, Money, ProgressBar, StatusPill,
} from '../../../components/ui.tsx';
import { IconBudget } from '../../../components/icons.tsx';
import type { Budget } from '../../../lib/api.ts';
import { formatPeriod, toMinor } from '../../../lib/format.ts';
import { SectionLink } from './SectionLink.tsx';

const WARNING_RANK: Record<string, number> = { over: 2, near: 1, none: 0 };

function budgetTone(warning: Budget['warning']): 'out' | 'warn' | 'accent' {
  return warning === 'over' ? 'out' : warning === 'near' ? 'warn' : 'accent';
}

/** Warna saja tidak pernah menjadi status: lencana teks menemani bilahnya. */
function BudgetLine({ budget }: { budget: Budget }) {
  const tone = budgetTone(budget.warning);
  return (
    <li className="row-divide flex flex-col gap-2 py-3">
      <div className="flex items-center gap-3">
        <IconTile tone={tone} size="sm">
          <IconBudget size={17} />
        </IconTile>
        <span className="min-w-0 flex-1 truncate text-sm text-fg">{budget.categoryName}</span>
        {budget.warning === 'over' ? <StatusPill tone="out">Lewat batas</StatusPill> : null}
        {budget.warning === 'near' ? <StatusPill tone="warn">Mendekati batas</StatusPill> : null}
      </div>
      <ProgressBar ratio={budget.ratio} tone={tone} label={`Pemakaian anggaran ${budget.categoryName}`} showPercent />
      {/* Label kiri, nominal kanan: seluruh nominal kartu lurus pada satu tepi (DESIGN.md "Kolom tanda"). */}
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs text-muted">
        <dt>Terpakai</dt>
        <dd className="text-right">
          <Money value={budget.spent} size="sm" />
        </dd>
        <dt>Batas</dt>
        <dd className="text-right">
          <Money value={budget.limit} size="sm" />
        </dd>
      </dl>
    </li>
  );
}

export function BudgetNearLimit({
  budgets, budgetRemaining, period,
}: {
  budgets: Budget[];
  budgetRemaining: string;
  period: string;
}) {
  const closest = [...budgets]
    .sort((a, b) => (WARNING_RANK[b.warning] ?? 0) - (WARNING_RANK[a.warning] ?? 0) || b.ratio - a.ratio)
    .slice(0, 3);

  // Sisa anggaran bukan arus kas: `+` hanya untuk uang masuk (DESIGN.md "Kolom tanda"). Sisa positif tampil
  // netral, dan hanya keadaan lewat batas yang bertanda minus.
  const remainingDirection: 'out' | 'zero' = toMinor(budgetRemaining) < 0 ? 'out' : 'zero';

  return (
    <Card className="px-4 py-4 lg:px-5">
      <CardHead
        title="Sisa anggaran"
        action={<SectionLink to="/rencana">Tinjau anggaran</SectionLink>}
      />
      {budgets.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Belum ada anggaran untuk {formatPeriod(period)}. Anggaran dibuat di layar Rencana.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <p className="text-xs text-muted">
              {budgets.length} kategori, {formatPeriod(period)}
            </p>
            <Money value={budgetRemaining} direction={remainingDirection} size="lg" />
          </div>
          <ul className="mt-1 flex flex-col">
            {closest.map((budget) => (
              <BudgetLine key={budget.id} budget={budget} />
            ))}
          </ul>
          {budgets.length > closest.length ? (
            <p className="pt-2 text-xs text-muted">
              {budgets.length - closest.length} kategori lain ada di layar Rencana.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
