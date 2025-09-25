"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const detected = detectTheme();
    setTheme(detected);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
  }, [mounted, theme]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      aria-label="Alternar tema"
      variant="secondary"
      aria-pressed={theme === "dark"}
      onClick={() => {
        setTheme(nextTheme);
      }}
      className="group px-3 py-2"
      type="button"
    >
      <span
        aria-hidden
        className="transition-transform duration-150 ease-out group-hover:scale-110"
      >
        {theme === "dark" ? (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        )}
      </span>
    </Button>
  );
}

function detectTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Ignora falhas de acesso ao localStorage (Safari privado, etc.)
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;

  const html = document.documentElement;
  html.classList.toggle("dark", theme === "dark");
  html.dataset.theme = theme;
  html.style.colorScheme = theme;

  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // Ignora se o storage não estiver disponível
  }
}
