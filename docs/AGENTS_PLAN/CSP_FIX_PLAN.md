CSP Remediation Plan
====================

Context
-------
- Production logs flagged an invalid `script-src` nonce placeholder (`'nonce-{NONCE}'`), causing Next.js boot scripts to be blocked.
- External resources from Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) violated the strict `style-src` and `font-src` rules.
- Missing favicon produced repeated 404s and prevents tight CSP verification.
- Resulting CSP violations triggered hydration failures (`Connection closed`) on client boot.

Goals
-----
- Restore a valid Content Security Policy that allows required scripts, styles, and fonts while keeping other directives hardened.
- Ensure Next.js inline bootstrap scripts execute safely without per-request nonce generation.
- Serve a deterministic favicon under the CSP to eliminate console noise and improve UX.

Proposed Changes
----------------
1. **Update `next.config.js` CSP header**
   - Remove the placeholder nonce and allow Next.js hydration scripts via `'unsafe-inline'` (documented trade-off until dynamic nonces are implemented).
   - Allow Google Fonts stylesheet (`https://fonts.googleapis.com`) under `style-src`.
   - Allow font files from `https://fonts.gstatic.com` and data URIs under `font-src`.
   - Preserve existing hardening (`default-src`, `connect-src`, `frame-ancestors`, etc.).
2. **Provide application icon**
   - Add `app/icon.tsx` (server-generated favicon) to eliminate 404 and align with Next.js App Router conventions.
3. **Regression pass**
   - Verify CSP headers in production response.
   - Confirm fonts, scripts, and favicon load without console errors.
   - Smoke-test dashboard and statistics pages for hydration success.

TODO Checklist
--------------
- [x] Adjust CSP directives in `next.config.js`.
- [x] Add generated favicon via `app/icon.tsx`.
- [ ] Validate deployment headers and hydration locally and on VPS.
- [ ] Update deployment checklist to reference new CSP expectations if needed.

