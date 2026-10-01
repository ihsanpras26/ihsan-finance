// test/format.test.ts: regresi tampilan nominal. Dijalankan dengan node:test tanpa DOM.
// Berkas ini sengaja .ts (bukan .tsx) supaya Node 24 dapat menjalankannya lewat type stripping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatIDR, formatSigned, moneySign, parseAmountInput, toMinor } from '../src/lib/format.ts';

test('saldo negatif tanpa arah tetap menampilkan tanda minus', () => {
  // Regresi: daftar dompet di Profil pernah menampilkan Rp572.000 untuk saldo -Rp572.000.
  assert.equal(moneySign(-572_000), '−');
  assert.equal(moneySign('-572000'), '−');
  assert.equal(moneySign(0), '');
  assert.equal(moneySign(1_000), '');
});

test('arah eksplisit selalu menang atas tanda nilai', () => {
  assert.equal(moneySign(100_000, 'in'), '+');
  assert.equal(moneySign(100_000, 'out'), '−');
  assert.equal(moneySign(-100_000, 'in'), '+');
  assert.equal(moneySign(-100_000, 'out'), '−');
  assert.equal(moneySign(-100_000, 'zero'), '−');
});

test('formatSigned menempelkan tanda pada badan angka', () => {
  assert.equal(formatSigned(25_000, 'in'), '+Rp25.000');
  assert.equal(formatSigned(25_000, 'out'), '−Rp25.000');
  assert.equal(formatSigned(-572_000, 'zero'), '−Rp572.000');
  assert.equal(formatSigned(0, 'zero'), 'Rp0');
});

test('formatIDR memakai pemisah ribuan dan tidak pernah kehilangan tiga nol', () => {
  assert.equal(formatIDR(25_000), 'Rp25.000');
  assert.equal(formatIDR(1_000_000), 'Rp1.000.000');
  assert.equal(formatIDR(-572_000), '-Rp572.000');
  assert.equal(formatIDR(null), 'Rp0');
});

test('toMinor dan parseAmountInput menerima bentuk yang dipakai pengguna', () => {
  assert.equal(toMinor('Rp25.000'), 25_000);
  assert.equal(toMinor('25000'), 25_000);
  assert.equal(toMinor('-572000'), -572_000);
  assert.equal(parseAmountInput('25.000'), 25_000);
  assert.equal(parseAmountInput('Rp1.500.000'), 1_500_000);
  assert.equal(parseAmountInput(''), 0);
});
