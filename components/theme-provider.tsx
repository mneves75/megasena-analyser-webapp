'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = 'megasena-theme';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function createThemeStore(defaultTheme: Theme) {
  let theme = defaultTheme;
  let systemTheme: 'light' | 'dark' = 'light';
  let initialized = false;
  const themeListeners = new Set<() => void>();

  const readStoredTheme = (): Theme => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return isTheme(stored) ? stored : defaultTheme;
    } catch {
      return theme;
    }
  };

  const initialize = (): void => {
    if (initialized) return;
    initialized = true;
    theme = readStoredTheme();
    systemTheme = getSystemTheme();
  };

  const notifyTheme = (): void => themeListeners.forEach((listener) => listener());

  return {
    getTheme: (): Theme => theme,
    getServerTheme: (): Theme => defaultTheme,
    subscribeTheme(callback: () => void): () => void {
      const previousTheme = theme;
      initialize();
      themeListeners.add(callback);
      const handleStorage = (): void => {
        const nextTheme = readStoredTheme();
        if (nextTheme !== theme) {
          theme = nextTheme;
          notifyTheme();
        }
      };
      window.addEventListener('storage', handleStorage);
      if (theme !== previousTheme) callback();
      return () => {
        themeListeners.delete(callback);
        window.removeEventListener('storage', handleStorage);
      };
    },
    setTheme(nextTheme: Theme): void {
      initialize();
      theme = nextTheme;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Keep the provider-local theme when persistence is unavailable.
      }
      notifyTheme();
    },
    getSystemTheme: (): 'light' | 'dark' => systemTheme,
    getServerSystemTheme: (): 'light' | 'dark' => 'light',
    subscribeSystemTheme(callback: () => void): () => void {
      const previousSystemTheme = systemTheme;
      initialize();
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemTheme = mediaQuery.matches ? 'dark' : 'light';
      const handleChange = (event: MediaQueryListEvent): void => {
        systemTheme = event.matches ? 'dark' : 'light';
        callback();
      };
      mediaQuery.addEventListener('change', handleChange);
      if (systemTheme !== previousSystemTheme) callback();
      return () => mediaQuery.removeEventListener('change', handleChange);
    },
  };
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps): React.ReactElement {
  const store = useMemo(() => createThemeStore(defaultTheme), [defaultTheme]);
  const theme = useSyncExternalStore(store.subscribeTheme, store.getTheme, store.getServerTheme);
  const subscribeToSystemTheme = useCallback(
    (callback: () => void) => theme === 'system' ? store.subscribeSystemTheme(callback) : () => {},
    [store, theme]
  );
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    store.getSystemTheme,
    store.getServerSystemTheme
  );

  // Calculate resolved theme
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [theme, resolvedTheme]);

  const setTheme = store.setTheme;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
