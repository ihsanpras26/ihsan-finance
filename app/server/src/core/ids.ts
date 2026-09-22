// core/ids.ts: UUIDv7 + token/hash helpers. No external deps.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const HEX = '0123456789abcdef';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    out += HEX[b >> 4]! + HEX[b & 15]!;
  }
  return out;
}

/**
 * UUIDv7: 48-bit unix ms, 12-bit rand, 62-bit rand. Monotonic within the same ms.
 * Lexicographic order matches creation order, which keeps SQLite index inserts local.
 */
let lastMs = 0;
let lastRand: Uint8Array = new Uint8Array(10);

export function uuidv7(now: number = Date.now()): string {
  if (now === lastMs) {
    // increment the random tail by 1 to preserve order within the same millisecond
    for (let i = 9; i >= 0; i--) {
      if (lastRand[i]! < 0xff) {
        lastRand[i] = lastRand[i]! + 1;
        break;
      }
      lastRand[i] = 0;
    }
  } else {
    lastMs = now;
    lastRand = randomBytes(10);
  }
  const rand = lastRand;
  const bytes = new Uint8Array(16);
  // timestamp (big-endian 48 bits)
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  // rand_a (12 bits) + version 7
  bytes[6] = 0x70 | (rand[0]! & 0x0f);
  bytes[7] = rand[1]!;
  // variant 10 + rand_b (62 bits)
  bytes[8] = 0x80 | (rand[2]! & 0x3f);
  bytes[9] = rand[3]!;
  bytes[10] = rand[4]!;
  bytes[11] = rand[5]!;
  bytes[12] = rand[6]!;
  bytes[13] = rand[7]!;
  bytes[14] = rand[8]!;
  bytes[15] = rand[9]!;
  const h = toHex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Stable JSON hash for idempotency payload comparison (key order independent). */
export function payloadHash(value: unknown): string {
  return sha256(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
