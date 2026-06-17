# 14 — Architecture Decision Records (ADRs)

These ADRs are **reconstructed from the current implementation and its inline
rationale** (code comments, config). They document decisions that are *already in
effect*, with the trade-offs evident in the code.

> Format: Context → Decision → Consequences. Status is "Accepted (implemented)" unless
> noted.

---

## ADR-001 — Single-Worker topology

**Status:** Accepted (implemented). 
**Context:** The app needs both static hosting (SPA) and a small JSON API, on one
origin, cheaply, with no CORS.
**Decision:** One Cloudflare Worker serves the Vite `dist/` via the Assets binding and
handles `/api/quote` in `fetch()`; `run_worker_first: ["/api/*"]` guarantees the API
is reached before static fallback; non-API paths use SPA fallback to `index.html`.
**Consequences:** Single deploy unit, no CORS, simple ops. Couples API + assets
lifecycle (deploy together). The data contract `shared/types.ts` is the only seam.

## ADR-002 — Data via Yahoo `^JKSE`, reconciled to Google Finance numbers

**Status:** Accepted (implemented). 
**Context:** Google Finance (COMPOSITE:IDX) is the page being mirrored, but it's
CORS-locked and brittle to scrape. The displayed numbers must still match Google.
**Decision:** Fetch Yahoo Finance v8 chart JSON server-side for 8 ranges; reconcile
to Google's displayed change via **per-range baseline rules** (`pickBaseline`) and
derive stats from **OHLC** (not closes). Hide the provider behind an `IhsgProvider`
interface so it's swappable.
**Consequences:** Accurate, stable JSON source; numbers match Google for 6 of 8 ranges
(1D verified; 1M/6M/YTD/1Y/5Y by rule). **Max** and **5D** retain documented
divergence due to upstream inception/boundary differences. Provider swap is a
single-file change. (Recorded in project memory: Yahoo + Google News RSS by default,
not Google scraping.)

## ADR-003 — KV snapshot + cron + on-demand refresh (no database)

**Status:** Accepted (implemented). 
**Context:** Data is a single, frequently-refreshed public snapshot; no relational
data, no per-user state.
**Decision:** Store one JSON snapshot in KV (`ihsg:data:v1`). Serve cached if < 60 s;
otherwise rebuild on demand and write back. A 5-minute cron keeps KV warm. No DB, no
migrations (version via the key suffix).
**Consequences:** Minimal infra, fast reads, graceful staleness. Eventual consistency
(up to ~60 s + poll). Schema changes require bumping the `:v1` suffix.

## ADR-004 — Synthetic visualization for YouTube (CORS reality)

**Status:** Accepted (implemented). 
**Context:** YouTube audio is cross-origin and cannot be fed to a Web Audio
`AnalyserNode` without tainting it; real reactive analysis is impossible.
**Decision:** For YouTube, force the analyser to `null` and drive both the spectrum
(`idleFreq`) and the headline ticker with a **synthetic 118 BPM** model; for
library/file sources use the real analyser.
**Consequences:** Consistent, lively UX across all sources; the YouTube animation is
plausible but not signal-accurate (documented limitation L1). Library/Device remain
the "true reactive" paths.

## ADR-005 — Theme: light default → follow device → saved wins (pre-paint)

**Status:** Accepted (implemented). 
**Context:** A light default was desired, but the app should respect the device
scheme on first visit and never flash.
**Decision:** A pre-paint inline script in `index.html` sets `data-theme` from
`localStorage` pref → `matchMedia` device scheme → light, before React mounts;
`App.tsx` mirrors the same precedence (`saved.theme ?? deviceTheme()`).
**Consequences:** No flash; predictable precedence. Logic is duplicated in two places
(HTML script + React) that must stay in sync.

## ADR-006 — Real quote is sacred for exports (`window.IHSG_still`)

**Status:** Accepted (implemented). 
**Context:** The headline "sings" (animates) during playback, but shared artifacts
must show truthful numbers.
**Decision:** `App.tsx` publishes the real at-rest values to `window.IHSG_still`, and
`SpectrumChart` exposes an at-rest render via `window.IHSG_drawChartStill()`;
`save-image.ts` reads only these. The export also omits "More details" and News.
**Consequences:** Exports never leak animated/fake prices (product invariant #4). Adds
imperative `window` seams between React and the export module.

## ADR-007 — No automated tests; typecheck + build as the gate

**Status:** Accepted (implemented), revisit recommended. 
**Context:** Small, fast-moving project; correctness was verified manually against
Google Finance and via DevTools pixel checks.
**Decision:** Rely on strict TypeScript (`npm run typecheck`, run inside `build`) and
manual/browser verification; ship no test runner.
**Consequences:** Fast iteration, but regressions in pure logic (baselines, parsers)
and visual flows aren't caught automatically. Flagged as the top tech debt
([13](limitations-and-tech-debt.md)); pure functions are easy Vitest targets.

## ADR-008 — Minimal dependency footprint (no UI/CSS/state libraries)

**Status:** Accepted (implemented). 
**Context:** The visualizer is bespoke (canvas, Web Audio, custom image export);
generic libraries would add weight without fitting the need.
**Decision:** Only `react`/`react-dom` at runtime; charting, audio, i18n, image
export, and theming are all hand-written against browser APIs; styling is plain CSS
with custom properties.
**Consequences:** Small bundle, full control, no library churn. More in-house code to
maintain; contributors must follow existing patterns rather than reach for a library.

---

## Decision index

| ADR | Decision | Primary evidence |
|---|---|---|
| 001 | Single-Worker topology | `wrangler.jsonc`, `worker/index.ts` |
| 002 | Yahoo source, Google-parity baselines | `worker/index.ts` (`YahooProvider`, `pickBaseline`) |
| 003 | KV snapshot + cron, no DB | `worker/index.ts` (`getData`/`refresh`), `wrangler.jsonc` |
| 004 | Synthetic YouTube visualization | `useAudioEngine.ts`, `spectrum.ts`, `App.tsx` |
| 005 | Theme precedence pre-paint | `index.html`, `App.tsx` |
| 006 | Real quote for exports | `App.tsx`, `save-image.ts`, `SpectrumChart.tsx` |
| 007 | No tests; typecheck gate | `package.json` |
| 008 | Minimal dependencies | `package.json` |
