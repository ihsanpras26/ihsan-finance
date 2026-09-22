// core/errors.ts: one error taxonomy the UI can act on (PRD §13: konflik memberi kode yang dapat ditangani UI).
import type { ErrorCode } from './error-codes.ts';

export type { ErrorCode } from './error-codes.ts';

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  version_conflict: 409,
  idempotency_conflict: 409,
  insufficient_principal: 409,
  refund_exceeds: 409,
  has_dependencies: 409,
  wallet_has_history: 409,
  allocation_exceeds: 409,
  goal_over_target: 409,
  rule_inactive: 409,
  rate_limited: 429,
  payload_too_large: 413,
  internal: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  fields?: Record<string, string>;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, extra: { fields?: Record<string, string>; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code] ?? 500;
    if (extra.fields) this.fields = extra.fields;
    if (extra.details) this.details = extra.details;
  }

  toBody(): Record<string, unknown> {
    const body: Record<string, unknown> = { error: { code: this.code, message: this.message } };
    if (this.fields) (body.error as Record<string, unknown>).fields = this.fields;
    if (this.details) (body.error as Record<string, unknown>).details = this.details;
    return body;
  }
}

export function fail(code: ErrorCode, message: string, extra: { fields?: Record<string, string>; details?: Record<string, unknown> } = {}): never {
  throw new AppError(code, message, extra);
}

export function notFound(what = 'Data'): never {
  throw new AppError('not_found', `${what} tidak ditemukan di ruang keuangan ini.`);
}
