"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => getInitialTheme());

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <Button
      aria-label="Alternar tema"
      variant="secondary"
      onClick={() => setTheme(next)}
      className="px-3 py-2"
      type="button"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </Button>
  );
}
