import type { ReactElement } from 'react';

/**
 * Storage key for the persisted theme. MUST match ThemeProvider's `storageKey`
 * (`components/theme-provider.tsx`). No new localStorage key is introduced here
 * (the script only reads the key the provider already writes), so the storage
 * disclosure banner does not need changes.
 */
const THEME_STORAGE_KEY = 'megasena-theme';

/**
 * Blocking, pre-paint script that sets the `dark`/`light` class on `<html>`
 * before the first paint, eliminating the theme flash (FOUC). The ThemeProvider
 * only applies the class in a post-hydration `useEffect`, so without this the
 * first paint always uses the light `:root` tokens (white) and then flips to the
 * resolved theme.
 *
 * Mirrors ThemeProvider's storageKey and `system` default: read the stored theme,
 * else fall back to `prefers-color-scheme`. Rendered as the first child of
 * `<body>` with the CSP nonce. The content is fully static (no request data is
 * interpolated), so inlining it is safe. The `/*theme-init*\/` marker is asserted
 * by `tests/app/theme-flash.spec.ts`.
 */
export function ThemeScript({ nonce }: { nonce?: string | null | undefined }): ReactElement {
  const js =
    `/*theme-init*/(function(){try{` +
    `var k=${JSON.stringify(THEME_STORAGE_KEY)};` +
    `var s=localStorage.getItem(k);` +
    `var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');` +
    `var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(t);` +
    `}catch(e){}})();`;

  // The browser strips the `nonce` attribute from the DOM after using it, so the
  // client-rendered script has `nonce=""` while the server sent `nonce="..."`.
  // That mismatch is expected and harmless; suppress the hydration warning.
  return (
    <script
      nonce={nonce ?? undefined}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: js }}
    />
  );
}
