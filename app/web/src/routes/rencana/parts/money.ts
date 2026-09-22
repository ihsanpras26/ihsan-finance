// routes/rencana/parts/money.ts : integer rupiah sums for the planning screens.
// Money stays whole rupiah: no floating point arithmetic on amounts.
import { toMinor } from '../../../lib/format.ts';

export function sumMinor(values: (string | number)[]): number {
  let total = 0;
  for (const value of values) total += toMinor(value);
  return total;
}

export function isPositive(value: string | number): boolean {
  return toMinor(value) > 0;
}
