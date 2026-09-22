// routes/laporan/parts/CategoryChart.tsx : category composition as a donut plus its full value list.
// FR18: a chart always ships with its values beside it, so the text list is always rendered.
// DESIGN.md §10: donat paling banyak enam potong; sisanya digabung sebagai "Lainnya", dan seluruh
// nominal asli tetap muncul di daftar teks di bawah grafik.
import type { SummaryReport } from '../../../lib/api.ts';
import { Card, CardHead, EmptyState, Money } from '../../../components/ui.tsx';
import { DonutChart } from '../../../components/charts.tsx';
import { formatPercent, toMinor } from '../../../lib/format.ts';

type Breakdown = SummaryReport['categoryBreakdown'];
type SliceTone = 'accent' | 'accent-2' | 'in' | 'out' | 'warn' | 'muted';

/** Rotasi warna tetap untuk potongan donat, urut supaya dua layar tidak pernah berbagi warna beda. */
const TONES: SliceTone[] = ['accent', 'accent-2', 'in', 'out', 'warn', 'muted'];

/** Paling banyak enam potong, jadi lima kategori terbesar plus satu potong "Lainnya". */
const MAX_SLICES = 6;
const OTHERS_LABEL = 'Lainnya';

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
  const direction: 'in' | 'out' = kind === 'expense' ? 'out' : 'in';
  const totalMinor = toMinor(total);

  if (rows.length === 0) {
    return <EmptyState title="Belum ada data kategori" body={emptyBody} />;
  }

  const ranked = [...rows].sort((a, b) => toMinor(b.amount) - toMinor(a.amount));
  const slices =
    ranked.length <= MAX_SLICES
      ? ranked.map((entry, index) => ({
          label: entry.name,
          value: toMinor(entry.amount),
          tone: TONES[index % TONES.length]!,
        }))
      : [
          ...ranked.slice(0, MAX_SLICES - 1).map((entry, index) => ({
            label: entry.name,
            value: toMinor(entry.amount),
            tone: TONES[index]!,
          })),
          {
            label: OTHERS_LABEL,
            value: ranked.slice(MAX_SLICES - 1).reduce((sum, entry) => sum + toMinor(entry.amount), 0),
            tone: TONES[MAX_SLICES - 1]!,
          },
        ];

  return (
    <Card className="px-4 py-4">
      <CardHead title={title} />
      <div className="mt-4">
        <DonutChart slices={slices} total={totalMinor} label={kind === 'expense' ? 'Total pengeluaran' : 'Total pendapatan'} />
      </div>

      {/* Nilai persis setiap kategori, bukan hanya bentuk potongannya (DESIGN.md §10). */}
      <div className="mt-4 flex items-baseline justify-between gap-3 text-2xs font-semibold text-muted">
        <span>Kategori</span>
        <span>Nominal</span>
      </div>
      <ul className="mt-1" aria-label={`Nilai dan porsi kategori untuk ${title.toLowerCase()}`}>
        {rows.map((entry) => (
          <li key={entry.categoryId ?? 'tanpa-kategori'} className="row-divide flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
            <span className="text-sm text-fg">{entry.name}</span>
            <span className="ml-auto flex items-baseline gap-3">
              <span className="tnum text-xs text-muted">{formatPercent(entry.share)}</span>
              <Money value={entry.amount} direction={direction} size="md" />
            </span>
          </li>
        ))}
        <li className="row-divide flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
          <span className="text-sm font-semibold text-fg">Total</span>
          <span className="ml-auto flex items-baseline gap-3">
            <span className="tnum text-xs text-muted">{formatPercent(shareSum)}</span>
            <Money value={total} direction={direction} size="md" />
          </span>
        </li>
      </ul>
    </Card>
  );
}
