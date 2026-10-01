// core/s3.ts: minimal S3-compatible client (PUT object) for offsite backup storage.
// Works with Cloudflare R2, Backblaze B2 and AWS S3: path-style URL, SigV4, no SDK dependency.
import { signRequest } from './sigv4.ts';

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  prefix?: string;
}

/** Read the storage configuration from the environment; null when it is not configured yet. */
export function s3ConfigFromEnv(env: Record<string, string | undefined> = process.env): S3Config | null {
  const endpoint = env.IHSAN_S3_ENDPOINT?.trim();
  const bucket = env.IHSAN_S3_BUCKET?.trim();
  const accessKeyId = env.IHSAN_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.IHSAN_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket,
    region: env.IHSAN_S3_REGION?.trim() || 'auto',
    accessKeyId,
    secretAccessKey,
    sessionToken: env.IHSAN_S3_SESSION_TOKEN,
    prefix: env.IHSAN_S3_PREFIX?.replace(/^\/+|\/+$/g, '') || undefined,
  };
}

/** Path-style object URL, the form R2 and B2 document. */
export function objectUrl(config: S3Config, key: string): string {
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${config.endpoint}/${config.bucket}/${path}`;
}

export function objectKey(config: S3Config, name: string): string {
  return config.prefix ? `${config.prefix}/${name}` : name;
}

export interface PutResult {
  status: number;
  etag: string | null;
}

/**
 * Upload one object. `fetchImpl` is injectable so tests can assert the signed request without
 * network access. Content length is left to the HTTP layer and therefore not signed.
 */
export async function putObject(
  config: S3Config,
  key: string,
  body: Uint8Array,
  options: { contentType?: string; fetchImpl?: typeof fetch; date?: Date } = {},
): Promise<PutResult> {
  const url = objectUrl(config, key);
  const headers = { 'content-type': options.contentType ?? 'application/octet-stream' };
  const signed = signRequest({
    method: 'PUT',
    url,
    headers,
    payload: body,
    region: config.region,
    service: 's3',
    credentials: config,
    date: options.date,
  });
  const send = options.fetchImpl ?? fetch;
  const response = await send(url, { method: 'PUT', headers: signed.headers, body });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Unggahan ke penyimpanan gagal (${response.status}): ${detail.slice(0, 200)}`);
  }
  return { status: response.status, etag: response.headers.get('etag') };
}
