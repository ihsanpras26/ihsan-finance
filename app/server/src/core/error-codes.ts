// core/error-codes.ts: codes the client maps to UI behaviour (PRD §13).
export type ErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'version_conflict'
  | 'idempotency_conflict'
  | 'insufficient_principal'
  | 'refund_exceeds'
  | 'has_dependencies'
  | 'wallet_has_history'
  | 'allocation_exceeds'
  | 'goal_over_target'
  | 'rule_inactive'
  | 'rate_limited'
  | 'payload_too_large'
  | 'internal';
