// routes/laporan/parts/calc.ts : period resolution, the 12 month cashflow series, and comparison maths.
// Every comparison window is named by its real dates, and a zero comparison has no percentage.
import type { CashflowReport } from '../../../lib/api.ts';
import {
  currentPeriod, formatDateLong, formatDateShort, formatPeriod, formatPeriodShort, parseIso, toMinor, todayIso,
} from '../../../lib/format.ts';

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

/**
 * Jendela 12 bulan penuh yang berakhir di bulan `endDate`, dipakai grafik arus kas bulanan.
 * Rentangnya sengaja lebih panjang dari satu bulan karena server hanya membucket per bulan bila
 * rentangnya melewati satu bulan penuh.
 */
export interface MonthlyWindow {
  from: string;
  to: string;
  /** 'YYYY-MM' dari bulan terlama ke bulan terbaru. */
  months: string[];
}

export function monthlyWindow(endDate: string, count = 12): MonthlyWindow {
  const { y, m } = parseIso(endDate);
  const months: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const total = y * 12 + (m - 1) - index;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  const first = months[0] ?? `${y}-01`;
  const last = months[months.length - 1] ?? first;
  const [lastYear, lastMonth] = last.split('-').map(Number);
  return {
    from: `${first}-01`,
    to: `${last}-${String(daysInMonth(lastYear ?? y, lastMonth ?? m)).padStart(2, '0')}`,
    months,
  };
}

export interface MonthRow {
  /** 'YYYY-MM' */
  period: string;
  /** Nama bulan pendek untuk sumbu grafik, mis. "Sep". */
  short: string;
  inflow: number;
  outflow: number;
  net: number;
}

/** Satu baris per bulan jendela. Bulan tanpa pergerakan tetap muncul bernilai nol agar sumbu waktu tidak melompat. */
export function monthlyRows(window: MonthlyWindow, buckets: CashflowReport['buckets']): MonthRow[] {
  const byLabel: Record<string, CashflowReport['buckets'][number] | undefined> = Object.fromEntries(
    buckets.map((bucket) => [bucket.label, bucket]),
  );
  return window.months.map((period) => {
    const bucket = byLabel[period];
    return {
      period,
      short: formatPeriodShort(period).split(' ')[0] ?? period,
      inflow: bucket ? toMinor(bucket.inflow) : 0,
      outflow: bucket ? toMinor(bucket.outflow) : 0,
      net: bucket ? toMinor(bucket.net) : 0,
    };
  });
}

/**
 * Nama periode pembanding dari label server ('YYYY-MM-DD s.d. YYYY-MM-DD'). Bulan atau tahun penuh
 * disebut namanya; jendela dengan panjang yang sama disebut tanggalnya, supaya tidak ada pembanding
 * yang tampil tanpa tanggal (PRD FR18).
 */
export function comparisonPeriodName(label: string): string {
  const [from, to] = label.split(' s.d. ');
  if (!from || !to) return label;
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  if (!fromYear || !fromMonth || !fromDay || !toYear || !toMonth || !toDay) return label;
  if (fromYear === toYear && fromMonth === toMonth && fromDay === 1 && toDay === daysInMonth(fromYear, fromMonth)) {
    return formatPeriod(`${fromYear}-${String(fromMonth).padStart(2, '0')}`);
  }
  if (fromYear === toYear && fromMonth === 1 && toMonth === 12 && fromDay === 1 && toDay === 31) {
    return `Tahun ${fromYear}`;
  }
  return `${formatDateShort(from)} sampai ${formatDateShort(to)}`;
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

/** Arah uang dari nilainya sendiri: positif 'in', negatif 'out', nol tanpa tanda. */
export function directionOf(value: string | number): 'in' | 'out' | 'zero' {
  const minor = toMinor(value);
  if (minor > 0) return 'in';
  if (minor < 0) return 'out';
  return 'zero';
}

export function yearOptions(count = 5, from: string = todayIso()): string[] {
  const end = Number(from.slice(0, 4)) || 1970;
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(String(end - i));
  return out;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
