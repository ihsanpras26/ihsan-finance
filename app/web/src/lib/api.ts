// lib/api.ts: satu-satunya pintu ke server. Bentuk data mengikuti docs/ARCHITECTURE.md §7.
// Uang selalu string desimal Rupiah ("25000"), tanggal efektif "YYYY-MM-DD".

export type Money = string;
export type IsoDate = string;

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  code: string;
  status: number;
  fields: Record<string, string>;
  details: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? {};
    this.details = body.details ?? {};
  }

  /** Pesan siap tampil, menyebut tindakan berikutnya bila ada. */
  get display(): string {
    const first = Object.keys(this.fields)[0];
    if (first) return this.message;
    return this.message;
  }
}

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
  workspaceId: string;
  workspaceName: string;
  timezone: string;
  role: string;
}

export interface Preferences {
  hideAmounts: boolean;
  remindersOn: boolean;
  theme: 'system' | 'light' | 'dark';
  defaultWalletId: string | null;
  lastWalletId: string | null;
  lastCategoryId: string | null;
}

export interface Wallet {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'other';
  openedOn: IsoDate;
  note: string | null;
  archivedAt: string | null;
  balance: Money;
  version: number;
}

export interface Category {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  archivedAt: string | null;
  version: number;
}

export type TxType = 'income' | 'expense' | 'transfer' | 'refund' | 'debt_received' | 'receivable_given' | 'debt_payment' | 'receivable_payment' | 'opening' | 'adjustment' | 'reversal' | 'goal_spend';
export type TxStatus = 'planned' | 'posted' | 'cancelled' | 'reversed';

export interface TxWalletLeg {
  walletId: string;
  walletName: string;
  direction: 'in' | 'out';
  amount: Money;
}

export interface Transaction {
  id: string;
  type: TxType;
  status: TxStatus;
  amount: Money;
  effectiveDate: IsoDate;
  note: string | null;
  source: 'manual' | 'import' | 'automatic' | 'system';
  version: number;
  createdAt: string;
  category: { id: string; name: string; kind: 'income' | 'expense' } | null;
  wallets: TxWalletLeg[];
  reversalOf: string | null;
  replacementOf: string | null;
  replacedBy: string | null;
  reversedBy: string | null;
  counterparty: { id: string; name: string } | null;
}

export interface TxPage {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Debt {
  id: string;
  direction: 'payable' | 'receivable';
  counterpartyName: string;
  counterpartyId: string | null;
  principal: Money;
  remaining: Money;
  interestPaid: Money;
  feePaid: Money;
  startDate: IsoDate;
  dueDate: IsoDate | null;
  note: string | null;
  status: 'active' | 'paid' | 'written_off' | 'archived';
  reminderOff: boolean;
  version: number;
  overdue: boolean;
  daysToDue: number | null;
}

export interface Goal {
  id: string;
  name: string;
  target: Money;
  targetDate: IsoDate | null;
  priority: number;
  status: 'active' | 'achieved' | 'archived';
  allocated: Money;
  progress: number;
  shortfall: Money;
  monthlyPlan: Money | null;
  note: string | null;
  version: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  limit: Money;
  spent: Money;
  remaining: Money;
  ratio: number;
  warning: 'none' | 'near' | 'over';
  version: number;
}

export interface RecurringRule {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  frequency: 'daily' | 'weekly' | 'monthly';
  anchorDay: number;
  startOn: IsoDate;
  endOn: IsoDate | null;
  nextOn: IsoDate;
  mode: 'reminder' | 'auto_post';
  status: 'active' | 'paused' | 'stopped';
  template: Record<string, unknown>;
  version: number;
}

export interface Occurrence {
  id: string;
  ruleId: string;
  scheduledDate: IsoDate;
  status: 'pending' | 'skipped' | 'confirmed' | 'failed';
  transactionId: string | null;
  label: string;
  amount: Money;
}

export interface DashboardData {
  asOf: IsoDate;
  period: { start: IsoDate; end: IsoDate; label: string };
  totalBalance: Money;
  netWorth: Money;
  netWorthParts: { cash: Money; receivable: Money; payable: Money };
  income: Money;
  expense: Money;
  net: Money;
  wallets: { id: string; name: string; type: string; balance: Money; archived: boolean }[];
  budgetRemaining: Money;
  budgetsOver: number;
  upcoming: { id: string; counterpartyName: string; direction: 'payable' | 'receivable'; amount: Money; dueDate: IsoDate; daysToDue: number }[];
  goals: { id: string; name: string; target: Money; allocated: Money; progress: number; status: string }[];
  unallocated: Money;
  draftsPending: number;
  pendingOccurrences: number;
}

export interface SummaryReport {
  period: { start: IsoDate; end: IsoDate; label: string };
  income: Money;
  expense: Money;
  net: Money;
  openingBalance: Money;
  closingBalance: Money;
  netWorth: Money;
  categoryBreakdown: { categoryId: string | null; name: string; kind: 'income' | 'expense'; amount: Money; share: number }[];
  comparison: { label: string; income: Money; expense: Money; net: Money } | null;
}

export interface CashflowReport {
  period: { start: IsoDate; end: IsoDate; label: string };
  opening: Money;
  closing: Money;
  change: Money;
  buckets: { label: string; inflow: Money; outflow: Money; net: Money }[];
  byActivity: { label: string; amount: Money; kind: string }[];
  wallets: { walletId: string; name: string; opening: Money; closing: Money; change: Money }[];
}

export interface NetWorthReport {
  asOf: IsoDate;
  cash: Money;
  receivable: Money;
  payable: Money;
  netWorth: Money;
  wallets: { id: string; name: string; balance: Money; archived: boolean }[];
  debts: { id: string; counterpartyName: string; direction: 'payable' | 'receivable'; remaining: Money }[];
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  dueDate: IsoDate | null;
  status: 'unread' | 'read';
  createdAt: string;
}

export interface AuthResult {
  user: SessionUser;
  recoveryCode?: string;
}

// ── transport ───────────────────────────────────────────────────────────────

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

async function request<T>(method: string, path: string, options: { body?: unknown; idempotencyKey?: string; query?: Record<string, unknown> } = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, { code: 'offline', message: 'Tidak ada koneksi ke server. Periksa jaringan lalu coba lagi.' });
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = (payload as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(response.status, body ?? { code: 'internal', message: 'Server gagal memproses permintaan. Coba lagi sebentar lagi.' });
  }
  return (payload as { data: T }).data;
}

/** Kunci idempotensi stabil untuk satu upaya pengguna; ulangi kirim dengan kunci yang sama. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export const api = {
  // auth
  register: (body: { email: string; password: string; displayName: string; timezone: string; workspaceName?: string }) =>
    request<AuthResult>('POST', '/api/v1/auth/register', { body }),
  login: (body: { email: string; password: string }) => request<AuthResult>('POST', '/api/v1/auth/login', { body }),
  logout: () => request<{ ok: true }>('POST', '/api/v1/auth/logout', {}),
  me: () => request<SessionUser>('GET', '/api/v1/auth/me'),
  recover: (body: { email: string; recoveryCode: string; newPassword: string }) => request<AuthResult>('POST', '/api/v1/auth/recover', { body }),
  revokeOthers: () => request<{ revoked: number }>('POST', '/api/v1/auth/sessions/revoke-others', {}),

  // workspace & preferences
  workspace: () => request<{ id: string; name: string; timezone: string; baseCurrency: string }>('GET', '/api/v1/workspace'),
  updateWorkspace: (body: { name?: string; timezone?: string }) => request<{ id: string }>('PATCH', '/api/v1/workspace', { body }),
  preferences: () => request<Preferences>('GET', '/api/v1/preferences'),
  updatePreferences: (body: Partial<Preferences>) => request<Preferences>('PATCH', '/api/v1/preferences', { body }),

  // wallets
  wallets: (query: { includeArchived?: boolean } = {}) => request<Wallet[]>('GET', '/api/v1/wallets', { query }),
  createWallet: (body: { name: string; type: string; openingBalance: Money; openedOn: IsoDate; note?: string }) =>
    request<Wallet>('POST', '/api/v1/wallets', { body, idempotencyKey: newIdempotencyKey() }),
  updateWallet: (id: string, body: { name?: string; type?: string; note?: string; expectedVersion: number }) =>
    request<Wallet>('PATCH', `/api/v1/wallets/${id}`, { body }),
  archiveWallet: (id: string) => request<Wallet>('POST', `/api/v1/wallets/${id}/archive`, {}),
  deleteWallet: (id: string) => request<{ ok: true }>('DELETE', `/api/v1/wallets/${id}`),
  reconcile: (id: string, body: { actualBalance: Money; reason: string; effectiveDate: IsoDate }) =>
    request<{ walletId: string; difference: Money; transactionId: string | null }>('POST', `/api/v1/wallets/${id}/reconcile`, { body, idempotencyKey: newIdempotencyKey() }),

  // categories
  categories: (query: { kind?: 'income' | 'expense'; includeArchived?: boolean } = {}) => request<Category[]>('GET', '/api/v1/categories', { query }),
  createCategory: (body: { name: string; kind: 'income' | 'expense' }) => request<Category>('POST', '/api/v1/categories', { body }),
  updateCategory: (id: string, body: { name?: string; expectedVersion: number }) => request<Category>('PATCH', `/api/v1/categories/${id}`, { body }),
  archiveCategory: (id: string) => request<Category>('POST', `/api/v1/categories/${id}/archive`, {}),

  // transactions
  transactions: (query: {
    from?: IsoDate; to?: IsoDate; type?: TxType; walletId?: string; categoryId?: string;
    q?: string; min?: Money; max?: Money; page?: number; pageSize?: number; status?: TxStatus;
  } = {}) => request<TxPage>('GET', '/api/v1/transactions', { query }),
  transaction: (id: string) => request<Transaction & { history: Transaction[] }>('GET', `/api/v1/transactions/${id}`),
  createTransaction: (body: Record<string, unknown>, key?: string) =>
    request<Transaction>('POST', '/api/v1/transactions', { body, idempotencyKey: key ?? newIdempotencyKey() }),
  correctTransaction: (id: string, body: Record<string, unknown>) => request<Transaction>('PATCH', `/api/v1/transactions/${id}`, { body }),
  reverseTransaction: (id: string, body: { reason?: string }) =>
    request<{ reversalId: string; transaction: Transaction }>('POST', `/api/v1/transactions/${id}/reverse`, { body, idempotencyKey: newIdempotencyKey() }),
  transactionImpact: (id: string) => request<{ summary: string; blockedBy: string[]; canCancel: boolean }>('GET', `/api/v1/transactions/${id}/impact`),

  // debts
  debts: (query: { direction?: 'payable' | 'receivable'; status?: string; includeArchived?: boolean } = {}) =>
    request<Debt[]>('GET', '/api/v1/debts', { query }),
  debt: (id: string) => request<Debt & { payments: { id: string; transactionId: string; principal: Money; interest: Money; fee: Money; paymentDate: IsoDate }[] }>('GET', `/api/v1/debts/${id}`),
  createDebt: (body: Record<string, unknown>) => request<Debt>('POST', '/api/v1/debts', { body, idempotencyKey: newIdempotencyKey() }),
  updateDebt: (id: string, body: Record<string, unknown>) => request<Debt>('PATCH', `/api/v1/debts/${id}`, { body }),
  payDebt: (id: string, body: { principal: Money; interest?: Money; fee?: Money; walletId: string; paymentDate: IsoDate; note?: string }) =>
    request<{ debt: Debt; transaction: Transaction }>('POST', `/api/v1/debts/${id}/payments`, { body, idempotencyKey: newIdempotencyKey() }),
  writeOffDebt: (id: string, body: { reason: string; effectiveDate: IsoDate }) =>
    request<Debt>('POST', `/api/v1/debts/${id}/write-off`, { body, idempotencyKey: newIdempotencyKey() }),
  upcomingDebts: (days = 7) => request<DashboardData['upcoming']>('GET', '/api/v1/debts/upcoming', { query: { days } }),

  // goals
  goals: (query: { includeArchived?: boolean } = {}) => request<Goal[]>('GET', '/api/v1/goals', { query }),
  createGoal: (body: { name: string; target: Money; targetDate?: IsoDate | null; priority?: number; note?: string }) =>
    request<Goal>('POST', '/api/v1/goals', { body }),
  updateGoal: (id: string, body: Record<string, unknown>) => request<Goal>('PATCH', `/api/v1/goals/${id}`, { body }),
  allocateGoal: (id: string, body: { walletId: string; amount: Money; effectiveDate: IsoDate; note?: string; moveMoney?: boolean }) =>
    request<Goal>('POST', `/api/v1/goals/${id}/allocations`, { body, idempotencyKey: newIdempotencyKey() }),
  releaseGoal: (id: string, body: { walletId: string; amount: Money; effectiveDate: IsoDate; note?: string }) =>
    request<Goal>('POST', `/api/v1/goals/${id}/allocations`, { body: { ...body, direction: 'release' }, idempotencyKey: newIdempotencyKey() }),
  archiveGoal: (id: string, body: { resolution: 'release' | 'keep'; reason?: string }) =>
    request<Goal>('POST', `/api/v1/goals/${id}/archive`, { body }),

  // budgets
  budgets: (query: { period?: string; includeArchived?: boolean } = {}) => request<Budget[]>('GET', '/api/v1/budgets', { query }),
  createBudget: (body: { categoryId: string; period: string; limit: Money }) => request<Budget>('POST', '/api/v1/budgets', { body }),
  updateBudget: (id: string, body: { limit: Money; expectedVersion: number }) => request<Budget>('PATCH', `/api/v1/budgets/${id}`, { body }),

  // recurring
  recurring: () => request<RecurringRule[]>('GET', '/api/v1/recurring'),
  createRecurring: (body: Record<string, unknown>) => request<RecurringRule>('POST', '/api/v1/recurring', { body }),
  updateRecurring: (id: string, body: Record<string, unknown>) => request<RecurringRule>('PATCH', `/api/v1/recurring/${id}`, { body }),
  setRecurringStatus: (id: string, action: 'pause' | 'resume' | 'stop') => request<RecurringRule>('POST', `/api/v1/recurring/${id}/${action}`, {}),
  occurrences: (query: { status?: string } = {}) => request<Occurrence[]>('GET', '/api/v1/recurring/occurrences', { query }),
  confirmOccurrence: (id: string, body: Record<string, unknown> = {}) =>
    request<{ transaction: Transaction; occurrence: Occurrence }>('POST', `/api/v1/recurring/occurrences/${id}/confirm`, { body, idempotencyKey: newIdempotencyKey() }),
  skipOccurrence: (id: string) => request<Occurrence>('POST', `/api/v1/recurring/occurrences/${id}/skip`, {}),

  // reports
  dashboard: (query: { asOf?: IsoDate } = {}) => request<DashboardData>('GET', '/api/v1/dashboard', { query }),
  summary: (query: { period?: string; from?: IsoDate; to?: IsoDate; compare?: boolean } = {}) =>
    request<SummaryReport>('GET', '/api/v1/reports/summary', { query }),
  cashflow: (query: { period?: string; from?: IsoDate; to?: IsoDate } = {}) =>
    request<CashflowReport>('GET', '/api/v1/reports/cashflow', { query }),
  netWorth: (query: { asOf?: IsoDate } = {}) => request<NetWorthReport>('GET', '/api/v1/reports/networth', { query }),
  debtsReport: (query: { includeArchived?: boolean } = {}) => request<{ payable: Debt[]; receivable: Debt[]; totals: { payable: Money; receivable: Money } }>('GET', '/api/v1/reports/debts', { query }),

  // export
  exportCsv: (query: { from?: IsoDate; to?: IsoDate } = {}) => request<{ jobId: string; url: string; rows: number }>('POST', '/api/v1/export/csv', { body: query }),
  exportFull: () => request<{ jobId: string; url: string; bytes: number }>('POST', '/api/v1/export/full', {}),

  // notifications
  notifications: (query: { status?: 'unread' | 'read' | 'all' } = {}) => request<Notification[]>('GET', '/api/v1/notifications', { query }),
  readNotification: (id: string) => request<Notification>('POST', `/api/v1/notifications/${id}/read`, {}),
  readAllNotifications: () => request<{ updated: number }>('POST', '/api/v1/notifications/read-all', {}),
};

export type Api = typeof api;
