// lib/offline.ts: draf lokal (PRD FR22). Draf tidak pernah mengubah saldo sebelum server mengonfirmasi.

const PREFIX = 'ihsan.draft.';
const THEME_KEY = 'ihsan.theme';
const HIDE_KEY = 'ihsan.hideAmounts';

export interface Draft<T = Record<string, unknown>> {
  key: string;
  kind: 'income' | 'expense' | 'transfer' | 'debt_payment' | 'goal_allocation';
  payload: T;
  idempotencyKey: string;
  savedAt: string;
  workspaceId: string;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function draftKey(workspaceId: string, kind: string, id?: string): string {
  return `${PREFIX}${workspaceId}.${kind}${id ? `.${id}` : ''}`;
}

export function saveDraft<T>(workspaceId: string, kind: Draft['kind'], payload: T, idempotencyKey: string, id?: string): Draft<T> {
  const draft: Draft<T> = { key: draftKey(workspaceId, kind, id), kind, payload, idempotencyKey, savedAt: new Date().toISOString(), workspaceId };
  const store = storage();
  if (store) {
    try {
      store.setItem(draft.key, JSON.stringify(draft));
    } catch {
      // quota or private mode: the draft simply is not kept, the form stays in memory
    }
  }
  return draft;
}

export function loadDraft<T>(workspaceId: string, kind: Draft['kind'], id?: string): Draft<T> | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(draftKey(workspaceId, kind, id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft<T>;
  } catch {
    return null;
  }
}

export function clearDraft(workspaceId: string, kind: Draft['kind'], id?: string): void {
  storage()?.removeItem(draftKey(workspaceId, kind, id));
}

export function listDrafts(workspaceId: string): Draft[] {
  const store = storage();
  if (!store) return [];
  const out: Draft[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !key.startsWith(`${PREFIX}${workspaceId}.`)) continue;
    const raw = store.getItem(key);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as Draft);
    } catch {
      // ignore unreadable entry
    }
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function countDrafts(workspaceId: string): number {
  return listDrafts(workspaceId).length;
}

export function clearAllDrafts(workspaceId: string): void {
  for (const draft of listDrafts(workspaceId)) storage()?.removeItem(draft.key);
}

export function readTheme(): 'system' | 'light' | 'dark' {
  const value = storage()?.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function writeTheme(theme: 'system' | 'light' | 'dark'): void {
  storage()?.setItem(THEME_KEY, theme);
}

export function readHideAmounts(): boolean {
  return storage()?.getItem(HIDE_KEY) === '1';
}

export function writeHideAmounts(hidden: boolean): void {
  storage()?.setItem(HIDE_KEY, hidden ? '1' : '0');
}

export function applyTheme(theme: 'system' | 'light' | 'dark'): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', dark);
}
