// lib/session.tsx: sesi, preferensi, tema. Sumber kebenaran tetap server.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setCsrfToken, type Preferences, type SessionUser } from './api.ts';
import { applyTheme, readHideAmounts, readTheme, writeHideAmounts, writeTheme } from './offline.ts';
import { MoneyVisibilityProvider } from '../components/ui.tsx';

export interface SessionValue {
  user: SessionUser | null;
  preferences: Preferences;
  loading: boolean;
  error: ApiError | null;
  theme: 'system' | 'light' | 'dark';
  hideAmounts: boolean;
  setTheme: (theme: 'system' | 'light' | 'dark') => void;
  setHideAmounts: (hidden: boolean) => Promise<void>;
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
}

const DEFAULTS: Preferences = {
  hideAmounts: false,
  remindersOn: true,
  theme: 'system',
  defaultWalletId: null,
  lastWalletId: null,
  lastCategoryId: null,
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [theme, setThemeState] = useState<'system' | 'light' | 'dark'>(() => readTheme());
  const [hideAmounts, setHideState] = useState<boolean>(() => readHideAmounts());

  const applyLocalTheme = useCallback((next: 'system' | 'light' | 'dark') => {
    setThemeState(next);
    writeTheme(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (readTheme() === 'system') applyTheme('system');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [theme]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await api.me();
      setUser(me);
      const prefs = await api.preferences();
      setPreferences(prefs);
      setHideState(prefs.hideAmounts);
      writeHideAmounts(prefs.hideAmounts);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      if (apiError && apiError.status !== 401) setError(apiError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updatePreferences = useCallback(async (patch: Partial<Preferences>) => {
    const next = await api.updatePreferences(patch);
    setPreferences(next);
    setHideState(next.hideAmounts);
    writeHideAmounts(next.hideAmounts);
  }, []);

  const setHideAmounts = useCallback(
    async (hidden: boolean) => {
      setHideState(hidden);
      writeHideAmounts(hidden);
      try {
        const next = await api.updatePreferences({ hideAmounts: hidden });
        setPreferences(next);
      } catch {
        // keep the local choice; the server will catch up on the next successful call
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // signing out locally is still the right outcome
    }
    setCsrfToken(null);
    setUser(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      preferences,
      loading,
      error,
      theme,
      hideAmounts,
      setTheme: applyLocalTheme,
      setHideAmounts,
      updatePreferences,
      refresh: load,
      signOut,
      setUser,
    }),
    [user, preferences, loading, error, theme, hideAmounts, applyLocalTheme, setHideAmounts, updatePreferences, load, signOut],
  );

  return (
    <SessionContext.Provider value={value}>
      <MoneyVisibilityProvider hidden={hideAmounts} onToggle={() => void setHideAmounts(!hideAmounts)}>
        {children}
      </MoneyVisibilityProvider>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession harus dipakai di dalam SessionProvider.');
  return value;
}
