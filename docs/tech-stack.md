# 04 — Technologies, Frameworks, Libraries & Dependencies

All versions are from `package.json` (semver ranges). The stack is intentionally
**minimal** — no state library, CSS framework, UI kit, ORM, or test runner.

## Runtime dependencies

| Package | Range | Why it's here |
|---|---|---|
| `react` | `^18.3.1` | UI library. |
| `react-dom` | `^18.3.1` | DOM renderer (`createRoot`). |

That's the entire production dependency list. Everything else (charting, audio,
image export, i18n) is **hand-written** against browser APIs.

## Dev dependencies

| Package | Range | Role |
|---|---|---|
| `typescript` | `^5.7.2` | Types + `tsc --noEmit` type-check gate. |
| `vite` | `^6.0.7` | Dev server + production bundler. |
| `@vitejs/plugin-react` | `^4.3.4` | React Fast Refresh + JSX transform. |
| `vite-plugin-pwa` | `^0.21.1` | PWA manifest + Workbox service worker (`generateSW`). |
| `@types/react` | `^18.3.12` | React types. |
| `@types/react-dom` | `^18.3.1` | React DOM types. |
| `@cloudflare/workers-types` | `^4.20250620.0` | Types for the Worker (`Fetcher`, `KVNamespace`, etc.). |
| `wrangler` | `^4.0.0` | Cloudflare CLI: `wrangler dev` + `wrangler deploy`. |
| `concurrently` | `^9.1.0` | Runs web + worker together in `npm run dev`. |

## Platform / browser APIs used directly (no library)

| API | Used in | Purpose |
|---|---|---|
| **Canvas 2D** | `SpectrumChart.tsx`, `save-image.ts` | All chart/spectrum drawing and the story PNG. |
| **Web Audio API** (`AudioContext`, `AnalyserNode`, `MediaElementSource`) | `useAudioEngine.ts` | Real-signal spectrum + onset detection. |
| **YouTube IFrame Player API** | `useAudioEngine.ts` | Play YouTube audio (hidden player). |
| **Web Share API** (`navigator.share`, `canShare`) | `save-image.ts` | Native share of the story image. |
| **`localStorage`** | `App`, `data.ts`, `useAudioEngine` | Prefs, last-good quote cache, player state. |
| **`matchMedia`** | `App.tsx`, `index.html` | Device color-scheme detection. |
| **`Intl.DateTimeFormat` / `toLocaleString`** | worker + `App` | TZ-correct tick labels (Asia/Jakarta) and number formatting. |
| **Service Worker / Workbox** | via `vite-plugin-pwa` | Offline shell + runtime caching. |

## Cloudflare platform features

| Feature | Config | Purpose |
|---|---|---|
| Workers | `wrangler.jsonc` `main` | Runs `worker/index.ts`. |
| Workers Assets | `assets` binding | Serves the Vite `dist/` build, SPA fallback. |
| KV _(optional)_ | `kv_namespaces` (`IHSG_KV`, unbound by default) | Cached quote snapshot when bound; live fetch otherwise. |
| Cron Triggers | `triggers.crons` | 5-minute KV refresh (no-op until `IHSG_KV` is bound). |
| Observability | `observability.enabled` | Worker logs/metrics in the dashboard. |
| `cf` fetch options | in `fetchChart`/`fetchNews` | Edge cache TTLs on upstream fetches. |

## Language / TypeScript setup

- Two separate `tsconfig` files because the app (DOM/React libs) and the Worker
  (Cloudflare Workers libs) target different global type environments.
- `npm run typecheck` runs both. `npm run build` runs typecheck first, so a type
  error anywhere fails the build.

## Versioning & upgrade notes

- **Node ≥ 18** required by Vite 6.
- `compatibility_date` in `wrangler.jsonc` is `2026-06-01` — controls Workers runtime
  behavior; bump deliberately and test.
- No lockfile drift concerns beyond the committed `package-lock.json`.
