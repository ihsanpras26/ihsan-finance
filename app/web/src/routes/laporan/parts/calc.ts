// routes/laporan/parts/calc.ts : period resolution and comparison maths for the report screen.
// Every comparison window is named by its real dates, and a zero comparison has no percentage.
import { currentPeriod, formatDateLong, formatPercent, formatPeriod, parseIso, toMinor, todayIso } from '../../../lib/format.ts';

export type RangeMode = 'bulan' | 'tahun' | 'khusus';

export interface RangeDraft {
  mode: RangeMode;
  period: string;
  year: string;
  from: string;
  to: string;
}

export interface ResolvedRange {
  from: string;
  to: string;
  label: string;
}

export function defaultRange(): RangeDraft {
  const period = currentPeriod();
  return { mode: 'bulan', period, year: period.slice(0, 4), from: `${period}-01`, to: todayIso() };
}

export function isRangeUsable(range: ResolvedRange): boolean {
  return Boolean(range.from) && Boolean(range.to) && range.from <= range.to;
}

export function resolveRange(draft: RangeDraft): ResolvedRange {
  if (draft.mode === 'bulan') {
    const [year, month] = draft.period.split('-').map(Number);
    return {
      from: `${draft.period}-01`,
      to: `${draft.period}-${String(daysInMonth(year ?? 1970, month ?? 1)).padStart(2, '0')}`,
      label: formatPeriod(draft.period),
    };
  }
  if (draft.mode === 'tahun') {
    return { from: `${draft.year}-01-01`, to: `${draft.year}-12-31`, label: `Tahun ${draft.year}` };
  }
  return {
    from: draft.from,
    to: draft.to,
    label: `${formatDateLong(draft.from)} sampai ${formatDateLong(draft.to)}`,
  };
}

/** The window the chosen one is compared against: the previous month, year, or window of the same length. */
export function previousRange(draft: RangeDraft, current: ResolvedRange): ResolvedRange {
  if (draft.mode === 'bulan') {
    const [year, month] = draft.period.split('-').map(Number);
    const total = (year ?? 1970) * 12 + ((month ?? 1) - 1) - 1;
    const previousYear = Math.floor(total / 12);
    const previousMonth = (total % 12) + 1;
    const period = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;
    return {
      from: `${period}-01`,
      to: `${period}-${String(daysInMonth(previousYear, previousMonth)).padStart(2, '0')}`,
      label: formatPeriod(period),
    };
  }
  if (draft.mode === 'tahun') {
    const year = (Number(draft.year) || 1970) - 1;
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Tahun ${year}` };
  }
  const length = dayCount(current.from, current.to);
  const end = addDays(current.from, -1);
  const start = addDays(end, -(length - 1));
  return { from: start, to: end, label: `${formatDateLong(start)} sampai ${formatDateLong(end)}` };
}

export interface Delta {
  difference: number;
  /** null when the comparison value is zero: a percentage of nothing is not a number. */
  percent: number | null;
  direction: 'in' | 'out' | 'zero';
}

export function deltaOf(current: string, previous: string): Delta {
  const now = toMinor(current);
  const before = toMinor(previous);
  const difference = now - before;
  const direction = difference > 0 ? 'in' : difference < 0 ? 'out' : 'zero';
  if (before === 0) return { difference, percent: null, direction };
  return { difference, percent: difference / Math.abs(before), direction };
}

export function deltaText(delta: Delta, previousLabel: string): string {
  if (delta.percent === null) {
    return delta.difference === 0
      ? `tidak ada nilai pada kedua periode, jadi persentase tidak dihitung`
      : `persentase tidak dihitung karena ${previousLabel} bernilai Rp0`;
  }
  const word = delta.direction === 'in' ? 'naik' : delta.direction === 'out' ? 'turun' : 'tetap';
  return `${word} ${formatPercent(Math.abs(delta.percent))} dari ${previousLabel}`;
}

export function yearOptions(count = 5, from: string = todayIso()): string[] {
  const end = Number(from.slice(0, 4)) || 1970;
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(String(end - i));
  return out;
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export function dayCount(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000) + 1;
}

function toUtc(date: string): number {
  const { y, m, d } = parseIso(date);
  return Date.UTC(y, m - 1, d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
