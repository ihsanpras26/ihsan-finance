// test/deploy.test.ts: production switches for a hosted deployment (FR01, NFR05).
// Env must be in place before src/config.ts is evaluated, so the app imports below are dynamic on
// purpose: this file exercises the module-load boundary, which a static import would skip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';

process.env.APP_ORIGIN = 'https://ihsan.contoh.id';
process.env.IHSAN_ALLOW_REGISTRATION = '0';
process.env.IHSAN_TRUST_PROXY = '1';

const { makeDb } = await import('./helpers.ts');
const { buildServer } = await import('../src/http/server.ts');

const PASSWORD = 'rahasia-uji-123';

async function register(app: FastifyInstance, email: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: PASSWORD, displayName: 'Pemilik', timezone: 'Asia/Jakarta' },
  });
}

function setCookieOf(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  return String(Array.isArray(raw) ? raw[0] : raw);
}

test('pendaftaran tertutup setelah akun pertama lahir', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const first = await register(app, 'pemilik@contoh.id');
    assert.equal(first.statusCode, 200, first.body);

    const second = await register(app, 'orang-lain@contoh.id');
    assert.equal(second.statusCode, 403, second.body);
    assert.equal(second.json().error.code, 'forbidden');
    assert.match(String(second.json().error.message), /Pendaftaran akun baru ditutup/);

    // Login pemilik tetap jalan; yang ditutup hanya pendaftaran baru.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'pemilik@contoh.id', password: PASSWORD },
    });
    assert.equal(login.statusCode, 200, login.body);
  } finally {
    await app.close();
  }
});

test('cookie sesi memakai Secure dan balasan membawa HSTS saat origin https', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const response = await register(app, 'pemilik@contoh.id');
    assert.equal(response.statusCode, 200, response.body);
    const cookie = setCookieOf(response);
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.equal(response.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
  } finally {
    await app.close();
  }
});

test('titik kesehatan publik tetap terjangkau tanpa sesi dan membawa HSTS', async () => {
  const app = await buildServer({ db: await makeDb() });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().data.ok, true);
    assert.equal(response.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
  } finally {
    await app.close();
  }
});
