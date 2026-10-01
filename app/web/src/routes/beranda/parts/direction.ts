// parts/direction.ts : arah tanda untuk setiap nominal di Beranda.
// Saldo dan kekayaan bersih boleh negatif, jadi arahnya tidak pernah 'in': saldo bukan pemasukan.
import { toMinor } from '../../../lib/format.ts';

/** Arah dari nilai itu sendiri: positif masuk, negatif keluar, nol netral. */
export function flowDirection(value: string | number): 'in' | 'out' | 'zero' {
  const minor = toMinor(value);
  if (minor > 0) return 'in';
  if (minor < 0) return 'out';
  return 'zero';
}

/** Angka saldo: hanya nilai di bawah nol yang membawa tanda, sisanya netral. */
export function balanceDirection(value: string | number): 'in' | 'out' | 'zero' {
  return toMinor(value) < 0 ? 'out' : 'zero';
}
