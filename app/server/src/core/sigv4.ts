// core/sigv4.ts: AWS Signature Version 4 for S3-compatible endpoints (Cloudflare R2).
// Pure functions only: no I/O and no module state, so the published AWS test vector can pin them.
import { createHash, createHmac } from 'node:crypto';

export interface Sigv4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface SignInput {
  method: string;
  url: string;
  headers?: Record<string, string>;
  payload: Uint8Array | string;
  region: string;
  service: string;
  credentials: Sigv4Credentials;
  date?: Date;
  /**
   * S3 requires the payload hash as a signed header. Plain SigV4 requests (the AWS test vectors,
   * and services that do not use S3 signing) only put it in the last line of the canonical request.
   */
  signPayloadHeader?: boolean;
}

export interface SignedRequest {
  headers: Record<string, string>;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
}

export function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** `20150830T123600Z` — the only timestamp format SigV4 accepts. */
export function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/** RFC 3986 encoding. `encodeURIComponent` leaves `!'()*` alone, which does not match AWS. */
function encodeRfc3986(value: string, keepSlash: boolean): string {
  const encoded = encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return keepSlash ? encoded.replace(/%2F/g, '/') : encoded;
}

function canonicalPath(pathname: string): string {
  return pathname === '' ? '/' : encodeRfc3986(pathname, true);
}

function canonicalQuery(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (raw === '') return '';
  const params: Array<[string, string]> = [];
  for (const part of raw.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? '' : part.slice(eq + 1);
    params.push([decodeURIComponent(key), decodeURIComponent(value)]);
  }
  params.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  return params.map(([key, value]) => `${encodeRfc3986(key, false)}=${encodeRfc3986(value, false)}`).join('&');
}

/** Trim, collapse internal whitespace runs, lowercase the name; AWS hashes this exact form. */
function canonicalHeaders(headers: Record<string, string>): { block: string; signed: string } {
  const normalised: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalised[name.toLowerCase()] = String(value).trim().replace(/\s+/g, ' ');
  }
  const names = Object.keys(normalised).sort();
  const block = names.map((name) => `${name}:${normalised[name]!}\n`).join('');
  return { block, signed: names.join(';') };
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp, 'utf8').digest();
  const kRegion = createHmac('sha256', kDate).update(region, 'utf8').digest();
  const kService = createHmac('sha256', kRegion).update(service, 'utf8').digest();
  return createHmac('sha256', kService).update('aws4_request', 'utf8').digest();
}

/**
 * Sign a request and return the headers to send (including `Authorization`, `x-amz-date` and
 * `x-amz-content-sha256`). Intermediate values are returned for tests and diagnostics.
 */
export function signRequest(input: SignInput): SignedRequest {
  const url = new URL(input.url);
  const date = input.date ?? new Date();
  const timestamp = amzDate(date);
  const dateStamp = timestamp.slice(0, 8);
  const payloadHash = typeof input.payload === 'string' ? sha256Hex(input.payload) : sha256Hex(input.payload);

  const headers: Record<string, string> = {
    ...(input.headers ?? {}),
    host: input.headers?.host ?? url.host,
    'x-amz-date': timestamp,
  };
  if (input.signPayloadHeader ?? true) headers['x-amz-content-sha256'] = payloadHash;
  if (input.credentials.sessionToken) headers['x-amz-security-token'] = input.credentials.sessionToken;

  const { block, signed } = canonicalHeaders(headers);
  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalPath(url.pathname),
    canonicalQuery(url.search),
    block,
    signed,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, scope, sha256Hex(canonicalRequest)].join('\n');
  const key = signingKey(input.credentials.secretAccessKey, dateStamp, input.region, input.service);
  const signature = createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');

  return {
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
    },
    canonicalRequest,
    stringToSign,
    signature,
  };
}
