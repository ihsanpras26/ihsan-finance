// components/charts.tsx: grafik SVG yang digambar sendiri (DESIGN.md "Components").
// Tanpa pustaka pihak ketiga. Setiap grafik membawa aria-label yang menyebut isinya,
// dan nilai persisnya selalu tersedia sebagai teks di dekatnya, bukan hanya sebagai bentuk.
import { useId, useMemo, useState } from 'react';
import { formatIDR, formatPercent, toMinor } from '../lib/format.ts';

/** Angka ringkas untuk label sumbu: 1500000 menjadi "1,5jt", 25000 menjadi "25rb". */
export function compactIDR(value: string | number): string {
  const minor = Math.abs(toMinor(value));
  if (minor >= 1_000_000_000) return `${trimZero(minor / 1_000_000_000)}m`;
  if (minor >= 1_000_000) return `${trimZero(minor / 1_000_000)}jt`;
  if (minor >= 1_000) return `${trimZero(minor / 1_000)}rb`;
  return String(minor);
}

function trimZero(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}

interface Series {
  name: string;
  tone: 'accent' | 'accent-2';
  values: number[];
}

const SERIES_COLOR: Record<Series['tone'], string> = {
  accent: 'var(--accent)',
  'accent-2': 'var(--accent-2)',
};

/**
 * LineChart: dua seri arus kas (pengeluaran dan pemasukan) per bulan.
 * Garis halus dengan titik pada data terakhir, sumbu Y ringkas, sumbu X nama bulan pendek.
 * Nilai persis tampil sebagai legenda berlabel di bawah grafik, jadi bentuk tidak pernah
 * menjadi satu-satunya sumber angka.
 */
export function LineChart({
  labels, series, height = 168, valueLabel = 'Nilai',
}: { labels: string[]; series: Series[]; height?: number; valueLabel?: string }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const W = 320;
  const H = height;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;
  const plotH = H - padTop - padBottom;

  const all = series.flatMap((entry) => entry.values);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const stepX = labels.length > 1 ? (W - padX * 2) / (labels.length - 1) : 0;

  const pointFor = (index: number, value: number) => ({
    x: padX + stepX * index,
    y: padTop + plotH - ((value - min) / span) * plotH,
  });

  // Kurva halus: titik tengah antar titik sebagai kendali, cukup untuk data bulanan.
  const pathFor = (values: number[]) => {
    const points = values.map((value, index) => pointFor(index, value));
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;
    let path = `M${points[0]!.x},${points[0]!.y}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const midX = (prev.x + curr.x) / 2;
      path += ` C${midX},${prev.y} ${midX},${curr.y} ${curr.x},${curr.y}`;
    }
    return path;
  };

  const gridValues = useMemo(() => [0, 0.5, 1].map((ratio) => min + span * ratio), [min, span]);
  const lastIndex = labels.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {series.map((entry) => (
            <span key={entry.name} className="flex items-center gap-2 text-xs text-muted">
              <span className="size-2 shrink-0 rounded-chip" style={{ background: SERIES_COLOR[entry.tone] }} aria-hidden="true" />
              {entry.name}
            </span>
          ))}
        </div>
        <div className="flex flex-col items-end gap-1">
          {series.map((entry) => (
            <span key={entry.name} className="figure text-xs text-fg">
              {formatIDR(active === null ? entry.values[lastIndex] ?? 0 : entry.values[active] ?? 0)}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Grafik garis ${series.map((entry) => entry.name).join(' dan ')} untuk ${labels.join(', ')}. Nilai persis ada di daftar teks di bawah grafik.`}
      >
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((value, index) => {
          const y = pointFor(0, value).y;
          return (
            <g key={index}>
              <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="var(--hairline)" strokeWidth="1" strokeDasharray="2 4" />
              <text x={padX} y={y - 4} className="fill-muted" fontSize="9">
                {compactIDR(value)}
              </text>
            </g>
          );
        })}

        {series[0] ? (
          <path d={`${pathFor(series[0].values)} L${pointFor(lastIndex, series[0].values[lastIndex] ?? 0).x},${padTop + plotH} L${padX},${padTop + plotH} Z`} fill={`url(#${gradientId}-fill)`} stroke="none" />
        ) : null}

        {series.map((entry) => (
          <path
            key={entry.name}
            d={pathFor(entry.values)}
            fill="none"
            stroke={SERIES_COLOR[entry.tone]}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {active !== null ? (
          <line
            x1={pointFor(active, 0).x}
            x2={pointFor(active, 0).x}
            y1={padTop}
            y2={padTop + plotH}
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}

        {series.map((entry) =>
          entry.values.map((value, index) => {
            const { x, y } = pointFor(index, value);
            const isLast = index === lastIndex;
            const isActive = index === active;
            if (!isLast && !isActive) return null;
            return (
              <circle
                key={`${entry.name}-${index}`}
                cx={x}
                cy={y}
                r={isActive ? 4 : 3.5}
                fill={SERIES_COLOR[entry.tone]}
                stroke="var(--surface-raised)"
                strokeWidth="2"
              />
            );
          }),
        )}

        {labels.map((label, index) => (
          <text
            key={label}
            x={padX + stepX * index}
            y={H - 6}
            textAnchor={index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'}
            fontSize="9"
            className={index === active ? 'fill-accent' : 'fill-muted'}
            style={{ cursor: 'pointer' }}
            onClick={() => setActive(index === active ? null : index)}
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Nilai persis: grafik bukan satu-satunya sumber angka (DESIGN.md "Components"). */}
      <ul className="flex flex-col">
        {labels.map((label, index) => (
          <li key={label} className="row-divide flex items-center justify-between gap-3 py-1.5">
            <span className="text-xs text-muted">{label}</span>
            <span className="flex items-center gap-3">
              {series.map((entry) => (
                <span key={entry.name} className="figure text-xs text-fg" title={`${entry.name}: ${valueLabel}`}>
                  {formatIDR(entry.values[index] ?? 0)}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Slice {
  label: string;
  value: number;
  tone: 'accent' | 'accent-2' | 'in' | 'out' | 'warn' | 'muted';
}

const SLICE_COLOR: Record<Slice['tone'], string> = {
  accent: 'var(--accent)',
  'accent-2': 'var(--accent-2)',
  in: 'var(--in)',
  out: 'var(--out)',
  warn: 'var(--warn)',
  muted: 'var(--fg-muted)',
};

/**
 * DonutChart: komposisi kategori. Paling banyak enam potongan, sisanya digabung sebagai "Lainnya".
 * Persentase ditulis di daftar teks, bukan di dalam potongan, supaya tetap terbaca di layar kecil.
 */
export function DonutChart({ slices, total, label }: { slices: Slice[]; total: number; label: string }) {
  const size = 148;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = total > 0 ? total : 1;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
          {slices.map((slice) => {
            const share = slice.value / safeTotal;
            const dash = share * circumference;
            const element = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={SLICE_COLOR[slice.tone]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return element;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xs text-muted">{label}</span>
          <span className="figure text-sm font-medium text-fg">{formatIDR(total)}</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col">
        {slices.map((slice) => (
          <li key={slice.label} className="row-divide flex items-center gap-3 py-2">
            <span className="size-2.5 shrink-0 rounded-chip" style={{ background: SLICE_COLOR[slice.tone] }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{slice.label}</span>
            <span className="tnum text-xs text-muted">{formatPercent(slice.value / safeTotal)}</span>
            <span className="figure w-28 shrink-0 text-xs text-fg">{formatIDR(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
