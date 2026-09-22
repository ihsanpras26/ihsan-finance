// routes/laporan/parts/CategoryChart.tsx : category composition as an SVG bar chart plus its table.
// FR18: a chart always ships with the values beside it, so the table is always rendered, not a tooltip.
import type { SummaryReport } from '../../../lib/api.ts';
import { EmptyState, Money, SectionHead } from '../../../components/ui.tsx';
import { formatPercent } from '../../../lib/format.ts';

type Breakdown = SummaryReport['categoryBreakdown'];

export function CategoryChart({
  items, kind, title, total, emptyBody,
}: {
  items: Breakdown;
  kind: 'income' | 'expense';
  title: string;
  total: string;
  emptyBody: string;
}) {
  const rows = items.filter((entry) => entry.kind === kind);
  const shareSum = rows.reduce((sum, entry) => sum + (Number.isFinite(entry.share) ? entry.share : 0), 0);

  return (
    <section>
      <SectionHead title={title} />
      {rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="Belum ada data kategori" body={emptyBody} />
        </div>
      ) : (
        <>
          <ul className="mt-1">
            {rows.map((entry) => (
              <li key={entry.categoryId ?? 'tanpa-kategori'} className="row-divide py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm text-fg">{entry.name}</span>
                  <span className="flex items-baseline gap-x-4">
                    <span className="tnum text-xs text-muted">{formatPercent(entry.share)}</span>
                    <Money value={entry.amount} direction={kind === 'expense' ? 'out' : 'in'} />
                  </span>
                </div>
                <Bar share={entry.share} tone={kind === 'expense' ? 'out' : 'in'} />
              </li>
            ))}
          </ul>

          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">{`Nilai dan porsi kategori untuk ${title.toLowerCase()}`}</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-hairline pb-1.5 text-left text-xs font-semibold text-muted">
                  Kategori
                </th>
                <th scope="col" className="border-b border-hairline pb-1.5 text-right text-xs font-semibold text-muted">
                  Nominal
                </th>
                <th scope="col" className="border-b border-hairline pb-1.5 text-right text-xs font-semibold text-muted">
                  Porsi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.categoryId ?? 'tanpa-kategori'} className="row-divide">
                  <td className="py-2.5 pr-3 align-top text-fg">{entry.name}</td>
                  <td className="num py-2.5 align-top">
                    <Money value={entry.amount} direction={kind === 'expense' ? 'out' : 'in'} size="sm" />
                  </td>
                  <td className="num py-2.5 align-top text-muted">{formatPercent(entry.share)}</td>
                </tr>
              ))}
              <tr className="row-divide">
                <td className="py-2.5 pr-3 font-semibold text-fg">Total</td>
                <td className="num py-2.5 font-semibold">
                  <Money value={total} direction={kind === 'expense' ? 'out' : 'in'} size="sm" />
                </td>
                <td className="num py-2.5 text-muted">{formatPercent(shareSum)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function Bar({ share, tone }: { share: number; tone: 'in' | 'out' }) {
  const ratio = Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 0;
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="mt-2 h-2.5 w-full" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="100" height="10" fill="var(--rule)" />
      <rect x="0" y="0" width={ratio * 100} height="10" fill={tone === 'in' ? 'var(--in)' : 'var(--out)'} />
    </svg>
  );
}
