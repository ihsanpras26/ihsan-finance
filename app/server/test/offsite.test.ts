// offsite.test.ts: SigV4 signing, the S3 upload request shape, and the offsite dump round-trip.
import { test, after } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { amzDate, sha256Hex, signRequest } from '../src/core/sigv4.ts';
import { objectKey, objectUrl, putObject, s3ConfigFromEnv } from '../src/core/s3.ts';
import { dumpDatabase, dumpName, dumpSource, offsiteDir, pruneLocal, sealDump, stamp, tableNames, uploadDump, verifyDump, type DumpReport } from '../src/tools/offsite.ts';
import { migrate, openDatabase } from '../src/db/index.ts';
import { makeWorkspace } from './helpers.ts';

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const dir = mkdtempSync(join(tmpdir(), 'ihsan-offsite-'));
let seq = 0;

/** A source database with one workspace and its system accounts, at a known path. */
async function sourceDb(name: string): Promise<string> {
  seq += 1;
  const path = join(dir, `${name}-${seq}.db`);
  const db = await openDatabase(path);
  await migrate(db);
  await makeWorkspace(db);
  await db.close();
  return path;
}

function signedHeaderNames(authorization: string): string[] {
  const match = /SignedHeaders=([^,]+)/.exec(authorization);
  assert.ok(match, `SignedHeaders missing in ${authorization}`);
  return match[1]!.split(';');
}

after(() => {
  // Best effort: on Windows the native driver may still hold the file handle (see db-port.test.ts).
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // leftovers stay in the OS temp directory, never in the repository
  }
});

test('SigV4 reproduces the published AWS get-vanilla signature', () => {
  // Inputs of the aws-sig-v4-test-suite `get-vanilla` case: GET https://example.amazonaws.com/,
  // headers Host and X-Amz-Date only, empty body. The suite signs no payload header, so the hash
  // appears only in the last line of the canonical request.
  const signed = signRequest({
    method: 'GET',
    url: 'https://example.amazonaws.com/',
    payload: '',
    signPayloadHeader: false,
    region: 'us-east-1',
    service: 'service',
    date: new Date('2015-08-30T12:36:00.000Z'),
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
  });
  assert.equal(
    signed.canonicalRequest,
    ['GET', '/', '', 'host:example.amazonaws.com', 'x-amz-date:20150830T123600Z', '', 'host;x-amz-date', EMPTY_SHA256].join('\n'),
  );
  assert.equal(
    signed.stringToSign,
    ['AWS4-HMAC-SHA256', '20150830T123600Z', '20150830/us-east-1/service/aws4_request', sha256Hex(signed.canonicalRequest)].join('\n'),
  );
  assert.equal(signed.signature, '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
  assert.equal(
    signed.headers.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
  );
});

test('SigV4 sorts query parameters after encoding (AWS get-vanilla-query-order-key-case)', () => {
  // Inputs of the aws-sig-v4-test-suite case: GET https://example.amazonaws.com/?Param2=value2&Param1=value1.
  const signed = signRequest({
    method: 'GET',
    url: 'https://example.amazonaws.com/?Param2=value2&Param1=value1',
    payload: '',
    signPayloadHeader: false,
    region: 'us-east-1',
    service: 'service',
    date: new Date('2015-08-30T12:36:00.000Z'),
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
  });
  assert.equal(signed.canonicalRequest.split('\n')[2], 'Param1=value1&Param2=value2');
  assert.equal(signed.signature, 'b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500');
});

test('SigV4 signs the payload hash, sorts headers and carries the scope', () => {
  const body = new TextEncoder().encode('isi basis data');
  const input = {
    method: 'PUT',
    url: 'https://contoh.r2.cloudflarestorage.com/ember/salinan/ihsan-20261001-000000000.db',
    headers: { 'Content-Type': 'application/vnd.sqlite3' },
    payload: body,
    region: 'auto',
    service: 's3',
    date: new Date('2026-10-01T00:00:00.000Z'),
    credentials: { accessKeyId: 'kunci', secretAccessKey: 'rahasia' },
  };
  const signed = signRequest(input);
  assert.equal(signed.headers['x-amz-content-sha256'], sha256Hex(body));
  assert.equal(signed.headers['x-amz-date'], '20261001T000000Z');
  assert.match(signed.headers.authorization, /Credential=kunci\/20261001\/auto\/s3\/aws4_request/);
  assert.equal(signed.canonicalRequest.split('\n')[1], '/ember/salinan/ihsan-20261001-000000000.db');
  const names = signedHeaderNames(signed.headers.authorization);
  assert.deepEqual(names, [...names].sort());
  assert.ok(names.includes('x-amz-content-sha256'));
  assert.equal(amzDate(new Date('2026-01-02T03:04:05.006Z')), '20260102T030405Z');
  assert.equal(signRequest(input).headers.authorization, signed.headers.authorization);
  assert.equal(sha256Hex(''), EMPTY_SHA256);
});

test('S3 configuration comes from the environment and stays optional', () => {
  assert.equal(s3ConfigFromEnv({}), null);
  assert.equal(s3ConfigFromEnv({ IHSAN_S3_ENDPOINT: 'https://x.r2.cloudflarestorage.com' }), null);
  const config = s3ConfigFromEnv({
    IHSAN_S3_ENDPOINT: 'https://x.r2.cloudflarestorage.com/',
    IHSAN_S3_BUCKET: 'ember',
    IHSAN_S3_ACCESS_KEY_ID: 'kunci',
    IHSAN_S3_SECRET_ACCESS_KEY: 'rahasia',
    IHSAN_S3_PREFIX: '/ihsan/',
  })!;
  assert.equal(config.endpoint, 'https://x.r2.cloudflarestorage.com');
  assert.equal(config.region, 'auto');
  assert.equal(config.prefix, 'ihsan');
  assert.equal(objectUrl(config, 'ihsan/berkas.db'), 'https://x.r2.cloudflarestorage.com/ember/ihsan/berkas.db');
  assert.equal(objectUrl(config, 'folder/berkas nama.db'), 'https://x.r2.cloudflarestorage.com/ember/folder/berkas%20nama.db');
  assert.equal(objectKey(config, 'ihsan-1.db'), 'ihsan/ihsan-1.db');
  assert.equal(objectKey({ ...config, prefix: undefined }, 'ihsan-1.db'), 'ihsan-1.db');
});

test('putObject sends the signed PUT and surfaces the status', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(null, { status: 200, headers: { etag: '"abc"' } });
  };
  const config = s3ConfigFromEnv({
    IHSAN_S3_ENDPOINT: 'https://x.r2.cloudflarestorage.com',
    IHSAN_S3_BUCKET: 'ember',
    IHSAN_S3_ACCESS_KEY_ID: 'kunci',
    IHSAN_S3_SECRET_ACCESS_KEY: 'rahasia',
  })!;
  const body = new TextEncoder().encode('dump');
  const result = await putObject(config, 'ihsan-1.db', body, {
    contentType: 'application/vnd.sqlite3',
    fetchImpl,
    date: new Date('2026-10-01T00:00:00.000Z'),
  });
  assert.equal(result.status, 200);
  assert.equal(result.etag, '"abc"');
  assert.equal(calls.length, 1);
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(calls[0]!.init.method, 'PUT');
  assert.equal(calls[0]!.url, 'https://x.r2.cloudflarestorage.com/ember/ihsan-1.db');
  assert.equal(headers['content-type'], 'application/vnd.sqlite3');
  assert.equal(headers['x-amz-content-sha256'], sha256Hex(body));
  assert.match(headers.authorization, /^AWS4-HMAC-SHA256 Credential=kunci\/20261001\/auto\/s3\/aws4_request/);
  assert.equal(calls[0]!.init.body, body);

  const failing: typeof fetch = async () => new Response('Akses ditolak', { status: 403 });
  await assert.rejects(() => putObject(config, 'ihsan-2.db', body, { fetchImpl: failing }), /403/);
});

test('dump copies every row of the source and passes verification', async () => {
  const sourcePath = await sourceDb('sumber');
  const targetPath = join(dir, dumpName());
  const report = sealDump(await dumpDatabase(targetPath, { url: sourcePath }));

  assert.deepEqual(report.problems, []);
  assert.equal(report.integrity, 'ok');
  assert.equal(report.journalBalanced, true);
  assert.equal(report.tables, 24);
  assert.ok(report.rows >= 5, `expected the workspace rows to be copied, got ${report.rows}`);
  const bytes = readFileSync(targetPath);
  assert.equal(report.bytes, bytes.byteLength);
  assert.equal(report.sha256, createHash('sha256').update(bytes).digest('hex'));
  const manifest = JSON.parse(readFileSync(`${targetPath}.json`, 'utf8')) as { sha256: string; rows: number };
  assert.equal(manifest.sha256, report.sha256);
  assert.equal(manifest.rows, report.rows);

  const source = await openDatabase(sourcePath);
  const copy = await openDatabase(targetPath);
  try {
    const tables = await tableNames(source);
    assert.equal(tables.length, 24);
    assert.ok(tables.includes('journal_lines'));
    const verified = await verifyDump(source, copy, tables);
    assert.deepEqual(verified.problems, []);
    assert.equal(verified.rows, report.rows);
  } finally {
    await copy.close();
    await source.close();
  }

  // A copy that lost a row must be reported, not accepted.
  const damaged = await openDatabase(targetPath);
  try {
    // A child row (no dependents of its own) so the delete itself stays legal under foreign keys.
    await damaged.mutate('DELETE FROM user_preferences');
  } finally {
    await damaged.close();
  }
  const source2 = await openDatabase(sourcePath);
  const copy2 = await openDatabase(targetPath);
  try {
    const verified = await verifyDump(source2, copy2, await tableNames(source2));
    assert.ok(
      verified.problems.some((problem) => problem.includes('user_preferences')),
      verified.problems.join('; '),
    );
  } finally {
    await copy2.close();
    await source2.close();
  }
});

test('dump names, sealing and local pruning follow the snapshot convention', () => {
  assert.equal(stamp(new Date('2026-10-01T13:10:49.438Z')), '20261001131049438');
  assert.equal(dumpName(new Date('2026-10-01T13:10:49.438Z')), 'ihsan-20261001-131049438.db');

  // Own directory: other tests leave their dumps in `dir`.
  const pangkas = join(dir, 'pangkas');
  mkdirSync(pangkas, { recursive: true });

  const names = ['ihsan-20260101-000000000.db', 'ihsan-20260202-000000000.db', 'ihsan-20260303-000000000.db'];
  for (const name of names) {
    writeFileSync(join(pangkas, name), 'salinan');
    writeFileSync(join(pangkas, `${name}.json`), '{}');
  }
  assert.deepEqual(pruneLocal(pangkas, 2), [names[0]]);
  assert.equal(existsSync(join(pangkas, names[0])), false);
  assert.equal(existsSync(join(pangkas, `${names[0]}.json`)), false);
  assert.equal(existsSync(join(pangkas, names[2])), true);

  // Files outside the snapshot naming convention are never touched.
  writeFileSync(join(pangkas, 'catatan.db'), 'x');
  assert.deepEqual(pruneLocal(pangkas, 2), []);
  assert.equal(existsSync(join(pangkas, 'catatan.db')), true);
});

test('sealing writes a manifest that matches the dump bytes', async () => {
  const sourcePath = await sourceDb('segel');
  const report = sealDump(await dumpDatabase(join(dir, dumpName()), { url: sourcePath }));
  const manifest = JSON.parse(readFileSync(`${report.file}.json`, 'utf8')) as DumpReport;
  assert.equal(manifest.sha256, report.sha256);
  assert.equal(manifest.bytes, readFileSync(report.file).byteLength);
  assert.equal(manifest.tables, 24);
  assert.deepEqual(manifest.problems, []);
});

test('uploadDump sends the dump and its manifest under the configured prefix', async () => {
  const sourcePath = await sourceDb('unggah');
  const report = sealDump(await dumpDatabase(join(dir, dumpName()), { url: sourcePath }));
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(null, { status: 200 });
  };
  const config = s3ConfigFromEnv({
    IHSAN_S3_ENDPOINT: 'https://x.r2.cloudflarestorage.com',
    IHSAN_S3_BUCKET: 'ember',
    IHSAN_S3_ACCESS_KEY_ID: 'kunci',
    IHSAN_S3_SECRET_ACCESS_KEY: 'rahasia',
    IHSAN_S3_PREFIX: 'ihsan',
  })!;
  const uploaded = await uploadDump(config, report, { fetchImpl });
  const name = basename(report.file);
  assert.equal(uploaded.key, `ihsan/${name}`);
  assert.deepEqual(
    calls.map((call) => call.url),
    [`https://x.r2.cloudflarestorage.com/ember/ihsan/${name}`, `https://x.r2.cloudflarestorage.com/ember/ihsan/${name}.json`],
  );
  const manifestBody = JSON.parse(new TextDecoder().decode(calls[1]!.init.body as Uint8Array)) as { sha256: string };
  assert.equal(manifestBody.sha256, report.sha256);
  assert.equal((calls[0]!.init.headers as Record<string, string>)['content-type'], 'application/vnd.sqlite3');
  assert.equal((calls[0]!.init.body as Uint8Array).byteLength, readFileSync(report.file).byteLength);
});

test('offsite dumps never share a directory with the VACUUM INTO snapshots', () => {
  // scripts/backup.mjs prunes its snapshots with IHSAN_BACKUP_KEEP; the offsite dump turns them
  // into uploads and prunes them with IHSAN_OFFSITE_KEEP. Same names, so different directories.
  assert.equal(offsiteDir({}, join('C:', 'data')), join('C:', 'data', 'offsite'));
  assert.equal(offsiteDir({ IHSAN_OFFSITE_DIR: join('C:', 'cadangan') }, join('C:', 'data')), join('C:', 'cadangan'));
});

test('the dump source prefers Turso and falls back to the local file', () => {
  const sourcePath = join(dir, 'sumber-lokal.db');
  writeFileSync(sourcePath, 'berkas');

  assert.deepEqual(dumpSource({ IHSAN_DB_URL: ' libsql://ihsan.turso.io ', IHSAN_DB_TOKEN: ' token ' }, sourcePath), {
    url: 'libsql://ihsan.turso.io',
    token: 'token',
  });
  assert.deepEqual(dumpSource({ IHSAN_DB_URL: 'libsql://ihsan.turso.io' }, sourcePath), { url: 'libsql://ihsan.turso.io' });
  assert.deepEqual(dumpSource({ IHSAN_DB_PATH: sourcePath }, 'tidak-ada.db'), { url: sourcePath });
  assert.deepEqual(dumpSource({}, sourcePath), { url: sourcePath });
  assert.equal(dumpSource({}, join(dir, 'tidak-ada.db')), null);
});
