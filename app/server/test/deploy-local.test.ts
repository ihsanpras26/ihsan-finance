// test/deploy-local.test.ts: the local http defaults must stay open for development.
// Env must be in place before src/config.ts is evaluated, so the app imports below are dynamic on
// purpose: this file exercises the module-load boundary, which a static import would skip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';

delete process.env.APP_ORIGIN;
delete process.env.IHSAN_ALLOW_REGISTRATION;
delete process.env.IHSAN_TRUST_PROXY;

const { makeDb } = await import('./helpers.ts');
const { buildServer } = await import('../src/http/server.ts');

const PASSWORD = 'rahasia-uji-123';

async function register(app: FastifyInstance, email: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: PASSWORD, displayName: 'Pengguna Uji', timezone: 'Asia/Jakarta' },
  });
}

function setCookieOf(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  return String(Array.isArray(raw) ? raw[0] : raw);
}

test('tanpa APP_ORIGIN https: cookie tanpa Secure dan tanpa HSTS', async () => {
  const app = await buildServer({ db: makeDb() });
  try {
    const response = await register(app, 'lokal@contoh.id');
    assert.equal(response.statusCode, 200, response.body);
    assert.doesNotMatch(setCookieOf(response), /; Secure/);
    assert.equal(response.headers['strict-transport-security'], undefined);
  } finally {
    await app.close();
  }
});

test('pendaftaran terbuka secara bawaan supaya pengembangan tidak terkunci', async () => {
  const app = await buildServer({ db: makeDb() });
  try {
    const first = await register(app, 'satu@contoh.id');
    const second = await register(app, 'dua@contoh.id');
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(second.statusCode, 200, second.body);
  } finally {
    await app.close();
  }
});
