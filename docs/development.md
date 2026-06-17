# 12 — Development, Testing, Debugging & Local Setup

## Prerequisites

- Node.js ≥ 18 + npm.
- (For the API/worker) Wrangler — installed as a dev dependency; a Cloudflare login
  is only needed to deploy, not for local `wrangler dev`.

## First-time setup

```bash
npm install
cp .env.example .env.local   # optional brand overrides
```

## Run

```bash
npm run dev        # web (Vite) + api (wrangler dev) together
# or individually:
npm run dev:web    # Vite only (uses the /api proxy; 503 if worker is down)
npm run cf:dev     # wrangler dev on :8787 (Worker + /api/quote)
```

- Web: `http://localhost:5173` (or the next free port — watch the log).
- API: `http://127.0.0.1:8787/api/quote`.

If the front-end runs without the Worker, the page still renders using the last-good
cache — or an empty/zero state on a cold first load (the `/api` proxy returns `503` JSON).

## Common scripts

| Command | Purpose |
|---|---|
| `npm run typecheck` | `tsc --noEmit` for app + worker tsconfigs. |
| `npm run build` | Typecheck then `vite build` → `dist/`. |
| `npm run preview` | Serve the built `dist/` via Vite preview. |

## Code layout for newcomers

Read in this order: `README.md` → `docs/architecture.md` →
`shared/types.ts` (the contract) → `src/data.ts` (how data arrives) → `src/App.tsx`
(the view) → `src/components/SpectrumChart.tsx` + `src/audio/*` (the visualizer).

## Debugging

### Data / API

```bash
# Inspect the live snapshot
curl -s http://localhost:8787/api/quote | python3 -m json.tool | head -40
# Stream Worker logs (deployed)
npx wrangler tail
```

- If the page shows the **empty/zero dataset** (`latest.value` 0, blank chart),
  upstream fetches are failing — check `fetchChart`/`fetchNews` and network egress.
- The UI **won't** show an error on API failure (it keeps last-good); use the
  Network tab / `wrangler tail` to see the real status. See
  [10-observability-and-errors](observability-and-errors.md).

### Chart / audio (browser)

- The visualizer is canvas-based; use the browser's Performance panel for frame
  issues. `window.IHSG_DATA`, `window.IHSG_still`, and `window.StoryImage` are
  inspectable in the console.
- **No StrictMode** is intentional (`main.tsx`): double-mounting would create two
  `MediaElementSource` nodes on one `<audio>`, which Web Audio forbids. Don't re-add it.
- YouTube spectrum is **expected** to be synthetic (cross-origin audio). To test the
  *real* analyser path, use the Library or Device source.

### Theme

- `data-theme` is set pre-paint by the inline script in `index.html`. To test
  device-follow, clear `localStorage["ihsg.prefs.v1"]` and toggle the OS scheme.

## Testing & verification

There is **no automated test suite** today (no runner, no unit/E2E tests). Current
quality gates and manual checks:

**Automated gates**
- `npm run typecheck` — must stay green.
- `npm run build` — fails on any type error.

**Manual verification checklist (as used historically)**
- Quote numbers per range match Google Finance COMPOSITE:IDX where the baseline rules
  apply (1D bit-verified; 1M/6M/YTD/1Y/5Y by rule; 5D & Max have documented
  divergence — see [07](business-logic.md)).
- Chart is **still** with no music; **pulses** with music; hover crosshair tracks the
  series end (no gap); 1D lunch break renders as a gap.
- Headline "sings" only during playback and resets after.
- Save Image exports the **real at-rest** quote (not animated values).
- Theme: light default, follows device on first load, saved choice wins, no flash.
- PWA: installable; offline shows last-good; `/api/*` never served from cache.

**If you want to add tests**
- Unit: Vitest fits Vite naturally — good first targets are pure functions:
  `pickBaseline`, `buildTickLabels`, `parseYouTubeId`, `fmtTime`, `idleFreq`,
  `isValid`.
- E2E: Playwright for the render/visual flows (chart still vs playing, theme, share).
- None of this is wired up yet — adding a `test` script + runner is an open task
  (see [13-limitations-and-tech-debt](limitations-and-tech-debt.md)).

## The fact-forcing gate (local harness)

This environment runs a "GateGuard" hook that blocks the **first** Edit/Write/Bash per
file and asks for a short facts preamble (importers, affected API, data schema, the
user's instruction), after which you retry the same operation. It's a local
development guardrail, not part of the app. Set `ECC_GATEGUARD=off` to disable.
