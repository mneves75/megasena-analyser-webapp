# Fresh Eyes Review — Mega-Sena Analyser (2025-10-01)

Author: Senior Engineer Review (fresh sweep)
Scope: High-signal issues only; concrete fixes and a focused TODO.

---

## Executive Highlights

- App compiles and renders; statistics now computed server-side (no missing API).
- Dual-runtime architecture (Bun API + Next.js) is functional but brittle in prod due to localhost rewrites and env gaps.
- DB and analytics engines are solid; a few hot paths are inefficient but easy to optimize.
- Security headers and disclosure concerns remain (per security audit) and should be addressed.

---

## Key Findings (Top Priority)

1) next.config.js hardcoded proxy to localhost:3201
- Risk: breaks in non-local environments and behind proxies.
- Fix: gate by `NEXT_PUBLIC_API_URL` with fallback to localhost.

2) Dashboard SSR still fetches from API
- `app/dashboard/page.tsx` hits `/api/dashboard`. With Bun API available, this is fine locally but couples page to network even on server.
- Option: mirror what we did for statistics and compute directly on server. Not required if Bun API is guaranteed, but reduces complexity and latency.

3) Frequency update performance (N×6 queries)
- `StatisticsEngine.updateNumberFrequencies()` loops across columns leading to ~360 queries. Replace with single UNION ALL aggregation, then batch update.

4) Missing `.env.example`
- Needed keys: `API_PORT`, `NEXT_PUBLIC_API_URL`, optional `NEXT_PUBLIC_BASE_URL` (or remove usage).

5) Footer exposes version/build (security audit)
- `components/footer.tsx` shows `Versão ... • Build ...`. Consider removing or gating behind admin.

6) Security headers
- Implement CSP, Permissions-Policy, COOP/COEP/CORP in `next.config.js` headers. Remove `x-powered-by`.

7) Test runtime dependencies
- Vitest uses `jsdom`; devDeps are present (`jsdom`, `@types/jsdom`). Verify installation in your environment; keep.

8) API error handling consistency
- `server.ts` does good logging via `logger`, but standardize error payloads and include dev-only details.

---

## Nice-to-Have Improvements

- Migrate `next lint` to ESLint CLI when upgrading to Next 16.
- Add simple in-memory TTL cache for expensive analytics endpoints.
- Unify currency/percent formatting usage across components.
- Consider a `components/index.ts` barrel for convenience (optional).
- Add loading/error states to generator page.

---

## Concrete TODOs (Actionable)

P0 – Reliability & Production Safety
- [ ] Parameterize API proxy URL in `next.config.js` via `NEXT_PUBLIC_API_URL`.
- [ ] Create `.env.example` with `API_PORT`, `NEXT_PUBLIC_API_URL`.
- [ ] Implement security headers in `next.config.js` (CSP Report-Only first; remove `x-powered-by`).
- [ ] Remove version/build from `components/footer.tsx` or gate behind admin flag.

P1 – Performance & DX
- [ ] Optimize `StatisticsEngine.updateNumberFrequencies()` using UNION ALL aggregation and batch updates.
- [ ] Add consistent API error responses in `server.ts` (dev-only details gated by `NODE_ENV`).
- [ ] Optional: compute dashboard data server-side in `app/dashboard/page.tsx` to avoid network on SSR.

P2 – Testing & UX
- [ ] Ensure `jsdom` and `@types/jsdom` are installed; add a trivial component test to validate setup.
- [ ] Add loading and error UI states to generator flow.
- [ ] Consider simple in-memory cache with short TTL (e.g., 60s) for `/api/statistics`.

---

## File-specific Notes

- `next.config.js`: add `poweredByHeader: false`; add `headers()` with CSP (Report-Only), Permissions-Policy, COOP/COEP/CORP; rewrite uses `NEXT_PUBLIC_API_URL`.
- `app/dashboard/page.tsx`: acceptable to leave fetch; consider direct compute later for parity with statistics.
- `lib/analytics/statistics.ts`: replace per-number per-column loops with one aggregated query; keep API intact.
- `components/footer.tsx`: version disclosure; follow security audit recommendation.
- `server.ts`: logging is solid; standardize error payloads across handlers.

---

## Acceptance Criteria

- Prod deploy works without editing `next.config.js` (env-driven).
- Security headers present; `x-powered-by` removed; CSP report-only returns violations near-zero.
- Frequency update runtime drops significantly (single query path verified).
- Tests pass (`bun run test`), jsdom environment verified.

---

## Quick Fix Snippets (to implement during tasks)

- next.config.js – proxy param and poweredByHeader:
```js
/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3201';
module.exports = {
  reactStrictMode: true,
  basePath: '/megasena-analyzer',
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  async headers() {
    const csp = `default-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';`;
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy-Report-Only', value: csp },
        { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      ],
    }];
  },
};
```

- `.env.example`:
```bash
API_PORT=3201
NEXT_PUBLIC_API_URL=http://localhost:3201
NODE_ENV=development
```

- `StatisticsEngine.updateNumberFrequencies()` – outline:
```ts
const q = `WITH alln AS (
  SELECT number_1 AS num FROM draws UNION ALL
  SELECT number_2 FROM draws UNION ALL
  SELECT number_3 FROM draws UNION ALL
  SELECT number_4 FROM draws UNION ALL
  SELECT number_5 FROM draws UNION ALL
  SELECT number_6 FROM draws
) SELECT num AS number, COUNT(*) AS frequency FROM alln GROUP BY num`;
const rows = this.db.prepare(q).all() as Array<{ number: number; frequency: number }>;
const stmt = this.db.prepare('UPDATE number_frequency SET frequency = ?, updated_at = CURRENT_TIMESTAMP WHERE number = ?');
rows.forEach(r => stmt.run(r.frequency, r.number));
```

---

End of review.
