// core/money.ts: IDR integer arithmetic. No floating point for money.
import { AppError } from './errors.ts';

/** PRD §11: P0 input ceiling per event. */
export const MAX_AMOUNT_MINOR = 999_999_999_999;

/**
 * Parse an amount coming from JSON (string decimal or integer number) or from the DB.
 * Rejects: zero, negatives (unless allowNegative), fractions, non-finite, out of range.
 */
export function parseAmount(input: unknown, opts: { allowNegative?: boolean; allowZero?: boolean; field?: string } = {}): number {
  const field = opts.field ?? 'amount';
  let n: number;
  if (typeof input === 'number') {
    n = input;
  } else if (typeof input === 'string') {
    // Accept "25000", "25.000", "Rp25.000". Reject "1000.5" instead of reading it as 10005.
    const cleaned = input.trim().replace(/^Rp\s*/i, '').replace(/\s/g, '');
    let digits: string;
    if (/^-?\d+$/.test(cleaned)) {
      digits = cleaned;
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      digits = cleaned.replace(/\./g, '');
    } else {
      throw new AppError('validation_failed', 'Nominal harus berupa angka bulat Rupiah tanpa sen.', { fields: { [field]: 'not_integer' } });
    }
    n = Number(digits);
  } else {
    throw new AppError('validation_failed', 'Nominal wajib diisi.', { fields: { [field]: 'required' } });
  }
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new AppError('validation_failed', 'Nominal harus bilangan bulat Rupiah (tanpa sen).', { fields: { [field]: 'not_integer' } });
  }
  if (n > MAX_AMOUNT_MINOR) {
    throw new AppError('validation_failed', `Nominal melebihi batas Rp${formatIDR(MAX_AMOUNT_MINOR)}.`, { fields: { [field]: 'too_large' } });
  }
  if (n < 0 && !opts.allowNegative) {
    throw new AppError('validation_failed', 'Nominal tidak boleh negatif.', { fields: { [field]: 'negative' } });
  }
  if (n < -MAX_AMOUNT_MINOR) {
    throw new AppError('validation_failed', `Nominal melebihi batas Rp${formatIDR(MAX_AMOUNT_MINOR)}.`, { fields: { [field]: 'too_large' } });
  }
  if (n === 0 && !opts.allowZero) {
    throw new AppError('validation_failed', 'Nominal harus lebih dari Rp0.', { fields: { [field]: 'zero' } });
  }
  return n;
}

/** Flip a signed balance without ever producing JavaScript's -0. */
export function negate(value: number): number {
  return value === 0 ? 0 : -value;
}

/** Overflow-checked addition. Throws when the result leaves the safe integer range. */
export function addSafe(a: number, b: number): number {
  const r = a + b;
  if (!Number.isSafeInteger(r)) {
    throw new AppError('internal', 'Penjumlahan nominal melewati batas aman bilangan.', { details: { a, b } });
  }
  return r;
}

export function sumSafe(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total = addSafe(total, v);
  return total;
}

/** Format for display and error messages: 25000 -> "Rp25.000" */
export function formatIDR(minor: number): string {
  const neg = minor < 0;
  const digits = Math.abs(minor).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return `${neg ? '-' : ''}Rp${out}`;
}

/** Wire format: decimal string, no separators, no currency symbol (PRD §11). */
export function toDecimalString(minor: number): string {
  return String(minor);
}

export function fromDbInt(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  throw new AppError('internal', 'Nilai nominal dari database tidak dikenali.', { details: { value } });
}
