// lib/format.ts: tampilan angka dan tanggal. Uang: integer rupiah, kolom tabular.

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function toMinor(value: string | number): number {
  if (typeof value === 'number') return Math.trunc(value);
  const cleaned = value.replace(/[^\d-]/g, '');
  return cleaned ? Number.parseInt(cleaned, 10) : 0;
}

/** Rp25.000. Tidak pernah menampilkan Rp25 untuk 25000 (PRD §03). */
export function formatIDR(value: string | number | null | undefined, opts: { withSymbol?: boolean } = {}): string {
  if (value === null || value === undefined) return 'Rp0';
  const minor = toMinor(value);
  const negative = minor < 0;
  const digits = Math.abs(minor).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  const symbol = opts.withSymbol === false ? '' : 'Rp';
  return `${negative ? '-' : ''}${symbol}${out}`;
}

/** Selalu membawa tanda eksplisit supaya arah uang tidak hanya ditandai warna (NFR06). */
export function formatSigned(value: string | number, direction: 'in' | 'out' | 'zero'): string {
  const body = formatIDR(Math.abs(toMinor(value)));
  const sign = moneySign(value, direction);
  return `${sign}${body}`;
}

/**
 * Tanda teks untuk sebuah nominal. Arah eksplisit ('in'/'out') selalu menang. Tanpa arah, tanda
 * diambil dari nilainya sendiri, sehingga saldo negatif tidak pernah tampil sebagai angka positif
 * (regresi: saldo kas minus). Nilai netral mengembalikan string kosong: kolom tanda tetap terisi,
 * tetapi isinya digambar `SignMark` (`components/ui.tsx`), bukan glif teks.
 */
export function moneySign(value: string | number, direction: 'in' | 'out' | 'zero' = 'zero'): '' | '+' | '−' {
  // Nol tidak punya arah: "+Rp0" mengklaim ada uang masuk, jadi nol selalu netral di sini.
  if (toMinor(value) === 0) return '';
  if (direction === 'in') return '+';
  if (direction === 'out') return '−';
  return toMinor(value) < 0 ? '−' : '';
}

/** Rp25.000 menjadi "25.000" untuk isian teks. */
export function formatAmountInput(value: string | number): string {
  const minor = toMinor(value);
  return minor === 0 ? '' : new Intl.NumberFormat('id-ID').format(minor);
}

/** Menerima "25.000", "25000", "Rp25.000" dan mengembalikan integer rupiah. */
export function parseAmountInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function currentPeriod(): string {
  return todayIso().slice(0, 7);
}

export function parseIso(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

/** 5 Februari 2026 */
export function formatDateLong(date: string): string {
  const { y, m, d } = parseIso(date);
  return `${d} ${MONTHS_ID[m - 1] ?? ''} ${y}`;
}

/** 5 Feb 2026 */
export function formatDateShort(date: string): string {
  const { y, m, d } = parseIso(date);
  return `${d} ${MONTHS_SHORT_ID[m - 1] ?? ''} ${y}`;
}

/** Februari 2026 */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS_ID[(m ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

export function formatPeriodShort(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS_SHORT_ID[(m ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

export function periodOptions(count = 12, from: string = currentPeriod()): string[] {
  const [y, m] = from.split('-').map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const total = (y ?? 2026) * 12 + ((m ?? 1) - 1) - i;
    const py = Math.floor(total / 12);
    const pm = (total % 12) + 1;
    out.push(`${py}-${String(pm).padStart(2, '0')}`);
  }
  return out;
}

export function relativeDay(date: string, today: string = todayIso()): string {
  const a = Date.UTC(...(Object.values(parseIso(date)) as [number, number, number]));
  const b = Date.UTC(...(Object.values(parseIso(today)) as [number, number, number]));
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  if (diff > 1 && diff <= 7) return `${diff} hari lagi`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} hari lalu`;
  return formatDateShort(date);
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

export const TYPE_LABEL: Record<string, string> = {
  income: 'Pendapatan',
  expense: 'Pengeluaran',
  transfer: 'Transfer',
  refund: 'Pengembalian dana',
  debt_received: 'Utang diterima',
  receivable_given: 'Piutang diberikan',
  debt_payment: 'Pembayaran utang',
  receivable_payment: 'Penerimaan piutang',
  opening: 'Saldo awal',
  adjustment: 'Penyesuaian saldo',
  reversal: 'Pembalikan',
  goal_spend: 'Belanja dari dana tujuan',
};

export const STATUS_LABEL: Record<string, string> = {
  planned: 'Rencana',
  posted: 'Tercatat',
  cancelled: 'Dibatalkan',
  reversed: 'Dibalik',
};

export const WALLET_TYPE_LABEL: Record<string, string> = {
  cash: 'Kas',
  bank: 'Bank',
  ewallet: 'E-wallet',
  other: 'Lainnya',
};

export function directionOf(type: string): 'in' | 'out' | 'zero' {
  if (type === 'income' || type === 'receivable_payment' || type === 'debt_received') return 'in';
  if (type === 'expense' || type === 'debt_payment' || type === 'receivable_given' || type === 'goal_spend') return 'out';
  return 'zero';
}
