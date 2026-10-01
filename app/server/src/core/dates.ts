// core/dates.ts: timezone-aware local dates. Effective dates are local, timestamps are UTC.

/** "YYYY-MM-DD" for the given instant in the workspace timezone. */
export function localDateInTz(tz: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  }
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12) return false;
  const dim = daysInMonth(y, m);
  return d >= 1 && d <= dim;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toEpochDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromEpochDay(day: number): string {
  const dt = new Date(day * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromEpochDay(toEpochDay(date) + n);
}

export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function compareDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Add months keeping an anchor day. Day 29-31 that does not exist lands on the last day of
 * that month, and the anchor is NOT dragged (PRD FR17 / AT15: 31 Jan -> 28/29 Feb -> 31 Mar).
 */
export function addMonthsClamped(date: string, months: number, anchorDay?: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const anchor = anchorDay ?? d;
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchor, daysInMonth(ny, nm));
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addWeeks(date: string, weeks: number): string {
  return addDays(date, weeks * 7);
}

/** "YYYY-MM" -> first and last local date of that calendar month. */
export function monthBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number) as [number, number];
  const last = daysInMonth(y, m);
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}` };
}

export function currentPeriod(tz: string, at: Date = new Date()): string {
  return localDateInTz(tz, at).slice(0, 7);
}

export function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Resolve a report period request into concrete inclusive bounds. */
export function resolvePeriod(input: {
  period?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  tz: string;
}): { start: string; end: string; label: string } {
  if (input.from && input.to) return { start: input.from, end: input.to, label: `${input.from} s.d. ${input.to}` };
  if (input.period) {
    const b = monthBounds(input.period);
    return { ...b, label: input.period };
  }
  const p = currentPeriod(input.tz);
  const b = monthBounds(p);
  return { ...b, label: p };
}

/** Next occurrence date for a recurring rule. */
export function nextOccurrence(from: string, frequency: 'daily' | 'weekly' | 'monthly', anchorDay: number): string {
  if (frequency === 'daily') return addDays(from, 1);
  if (frequency === 'weekly') return addWeeks(from, 1);
  return addMonthsClamped(from, 1, anchorDay);
}

export function isoUtc(at: Date = new Date()): string {
  return at.toISOString();
}

export function startOfUtcDayIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

/** "2026-10-06" menjadi "6 Okt 2026" untuk teks yang dibaca pengguna, bukan tanggal mesin. */
export function formatDateID(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}
