# 15 — Security

This document describes the security posture of the IHSG Spectrum Visualizer as
implemented today, the threat model, what is covered, and hardening recommendations.

## Security model in one paragraph

The app is **public, read-only, and anonymous** — there are no accounts, sessions,
tokens, cookies, or personal data. The browser talks only to the **same-origin**
Cloudflare Worker (`/` and `/api/quote`) plus a few explicitly-loaded third-party
CDNs (Google Fonts, the YouTube IFrame API). **All upstream data fetching (Yahoo,
Google News) happens server-side in the Worker**, so the client never makes
cross-origin data calls and there are no API credentials anywhere. There are **no
secrets** in the client bundle or the Worker — the only configuration is public
brand strings.

## Attack surface

| Surface | Exposure | Notes |
|---|---|---|
| `GET /api/quote` | Public, unauthenticated, read-only | Returns a static-shaped JSON snapshot; reads no query/body input. |
| Static assets (`/*`) | Public | Served from the immutable Vite build via the Assets binding. |
| External feeds (Yahoo, Google News) | Server-side fetch | Fixed URLs, no user input → no SSRF. |
| YouTube IFrame | Client, sandboxed iframe | Video id is regex-validated to `[\w-]{11}`. |
| `localStorage` | Client | Only non-sensitive prefs/player state. |

## Threats considered & status

### Injection / XSS — covered
- **No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function`** anywhere in
  `src/`. All dynamic text (including external **news titles and source names** from
  Google News RSS) is rendered as **React text nodes**, which React escapes. A
  poisoned headline cannot inject markup or script.
- **`href` scheme sanitization:** news item links come from an external feed and are
  rendered as `<a href>`. React does *not* sanitize href schemes, so the Worker now
  **drops any non-`http(s)` link** at ingestion (`worker/index.ts` `fetchNews`),
  preventing a `javascript:`/`data:` href from becoming a clickable XSS. App-built
  share URLs (X/Facebook) are constructed from `location`/encoded text, not user input.

### SSRF — covered
The Worker fetches only **hardcoded** Yahoo and Google News URLs. No part of the
request URL is derived from client input, so `/api/quote` cannot be used to make the
Worker fetch arbitrary destinations.

### Secrets exposure — covered
There are **no secrets**. `VITE_*` vars are public brand strings, intentionally
inlined into the client bundle. The Worker requires no API keys. A repo-wide scan for
key/secret/token/password patterns finds nothing sensitive.

### Tabnabbing / window.opener — covered
**Every** external link (`target="_blank"`) includes `rel="noopener noreferrer"`
(news, Wikipedia, Google Finance, X, Facebook). The opened page cannot access
`window.opener`.

### Clickjacking / framing — partial (recommendation below)
No `X-Frame-Options`/`frame-ancestors` is set. Low impact (no authenticated actions
to hijack), but see hardening.

### Denial of service / abuse — mitigated by platform
`/api/quote` does no expensive per-request work in the warm path (KV read). Cron +
60 s freshness bound upstream calls. Cloudflare provides edge-level DDoS protection.
There is no rate limiting in app code (not needed for a cacheable read-only endpoint).

### Data integrity / fabrication — covered (product rule)
Live prices are never fabricated: on upstream failure the Worker serves the last KV
snapshot or an empty/zero dataset (value 0, blank chart), and the client keeps its
last-good value.
Animated ("singing") values never leak into exports — those use the real at-rest
quote (`window.IHSG_still`). See [business-logic](business-logic.md).

### Dependencies — low footprint
Runtime deps are only `react` + `react-dom`; everything else is hand-written against
browser APIs. Smaller supply-chain surface. Run `npm audit` periodically.

## Transport & headers

| Aspect | Current state |
|---|---|
| HTTPS | Enforced by Cloudflare (the deploy platform). |
| `/api/quote` caching | `cache-control: no-store` (never cached by browser/SW). |
| CORS | None set → same-origin only (the app and API share an origin). |
| Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy) | **Not set in app code** (see hardening). |

## Hardening recommendations (not yet implemented)

These are optional improvements; none are current vulnerabilities.

1. **Content Security Policy.** Add a CSP (via a Worker response header on document
   responses, or Cloudflare Transform Rules). Note constraints: the app uses an
   **inline `<script>`** in `index.html` (pre-paint theme) — a strict CSP would need a
   nonce/hash for it — and loads Google Fonts + the YouTube IFrame API + a YouTube
   iframe, which the policy must allow (`script-src https://www.youtube.com`,
   `frame-src https://www.youtube.com`, `style-src/font-src` for Google Fonts).
2. **Standard security headers.** `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (or
   CSP `frame-ancestors 'none'`), and HSTS. Easiest via Cloudflare rules or a small
   header pass in the Worker `fetch()` for non-API responses.
3. **`npm audit` in CI.** Add a dependency-audit step to the (currently absent) CI
   pipeline. See [deployment](deployment.md) and [limitations-and-tech-debt](limitations-and-tech-debt.md).
4. **Subresource Integrity** for the Google Fonts stylesheet/YouTube script if you
   want to pin third-party resources (trade-off: breaks on legitimate CDN updates).

## Reporting a vulnerability

There is no published security contact in the repo. Until one is added, report
privately to the brand owner (the footer link, default `https://membasuh.com`).
See [open questions](README.md#open-questions--missing-information).
