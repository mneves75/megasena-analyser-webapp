'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'megasena-theme',
}: ThemeProviderProps): React.ReactElement {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Calculate resolved theme
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  useEffect(() => {
    setMounted(true);
    // Load theme from localStorage
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored) {
      setTheme(stored);
    }
    /**
     * DEPENDENCY ARRAY DECISION:
     * storageKey is omitted despite being used in this effect.
     *
     * RATIONALE:
     * - storageKey is always the default value 'megasena-theme' (never passed as prop)
     * - Including it causes unnecessary re-runs with no benefit
     * - Trade-off: If storageKey becomes dynamic, this effect won't re-run
     *
     * FUTURE CONSIDERATION:
     * If storageKey needs to be dynamic, either:
     * 1. Add it back to dependency array
     * 2. Extract as module-level const (preferred if truly static)
     *
     * Per code review: "storageKey is constant, use empty array"
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);

    // Save to localStorage
    localStorage.setItem(storageKey, theme);
    /**
     * DEPENDENCY ARRAY DECISION:
     * storageKey is omitted despite being used in this effect.
     *
     * See comment in first useEffect for full rationale.
     * Same reasoning applies: storageKey is effectively constant.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, resolvedTheme, mounted]);

  // Listen to system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(getSystemTheme());
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

