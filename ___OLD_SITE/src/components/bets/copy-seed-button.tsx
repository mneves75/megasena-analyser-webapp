"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal clipboard fallback para navegadores sem Clipboard API moderna.
function fallbackCopy(text: string) {
  if (typeof document === "undefined") {
    throw new Error("clipboard-unavailable");
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const successful = document.execCommand("copy");
    if (!successful) {
      throw new Error("execCommand-failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

// Preferir Clipboard API; se indisponível, usar fallback baseado em textarea oculto.
async function writeClipboard(text: string) {
  if (typeof navigator === "undefined") {
    throw new Error("clipboard-unavailable");
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopy(text);
}

export function CopySeedButton({ seed }: { seed: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const handleCopy = useCallback(async () => {
    clearTimers();
    try {
      await writeClipboard(seed);
      setError(null);
      setCopied(true);
      resetTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error("copy-seed", copyError);
      setCopied(false);
      setError(
        "Não foi possível copiar automaticamente. Selecione e copie manualmente.",
      );
      errorTimerRef.current = window.setTimeout(() => setError(null), 4000);
    }
  }, [clearTimers, seed]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        onClick={handleCopy}
      >
        {copied ? "Semente copiada" : "Copiar semente"}
      </button>
      {error && (
        <span
          className="block text-xs text-yellow-700 dark:text-yellow-300"
          aria-live="assertive"
        >
          {error}
        </span>
      )}
    </div>
  );
}
