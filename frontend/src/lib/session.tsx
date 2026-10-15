import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearSession, currentUser, onSessionLost, SessionUser } from './api';

type Theme = 'light' | 'dark';
const THEME_KEY = 'concrete.theme';

interface SessionContextValue {
  user: SessionUser | null;
  /** True if the user holds any of the given permission codes. No codes → always true. */
  can: (...codes: string[]) => boolean;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  theme: Theme;
  toggleTheme: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(currentUser());
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => onSessionLost(() => setUser(null)), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#12151c' : '#2f4a8a');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const can = useCallback(
    (...codes: string[]) => {
      if (codes.length === 0) return true;
      if (!user) return false;
      return codes.some((c) => user.permissions.includes(c));
    },
    [user],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      can,
      signIn: setUser,
      signOut: () => {
        clearSession();
        setUser(null);
      },
      theme,
      toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
    }),
    [user, can, theme],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
