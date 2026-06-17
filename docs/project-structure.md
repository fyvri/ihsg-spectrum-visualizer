# 03 — Project Structure

Every folder and module, with its responsibility and key exports. Line counts are
approximate and indicate relative size/complexity.

## Root

| Path | Role |
|---|---|
| `index.html` | App shell. Sets `data-theme` default and runs a **pre-paint inline script** (saved pref → device scheme → light) to avoid theme flash. Declares favicons, PWA theme-color metas, Google Fonts preconnect, and mounts `/src/main.tsx`. |
| `vite.config.ts` | Vite config: React plugin, `vite-plugin-pwa` (manifest + Workbox runtime caching), the `song-library` plugin, and the dev `/api` → `:8787` proxy with a 503 fallback. |
| `vite-plugin-song-library.ts` | Build-time Vite plugin exposing `virtual:song-library` — scans `public/audio/` and reads each MP3's ID3 tags (TIT2/TPE1, filename fallback) to build the `SONGS` list. Zero-dep hand-rolled ID3 reader; runs at build/dev only. |
| `wrangler.jsonc` | Cloudflare Worker config: `main` = `worker/index.ts`, Assets binding (`./dist`, SPA fallback, `run_worker_first: /api/*`), optional `IHSG_KV` namespace (commented/unbound by default), cron `*/5 * * * *`, observability on. |
| `tsconfig.app.json` | TypeScript config for the React app (`src/`). |
| `tsconfig.worker.json` | TypeScript config for the Worker (`worker/`) — Cloudflare Workers types. |
| `package.json` | Scripts + deps (see [04-tech-stack](tech-stack.md)). |
| `.env.example` | Documents the 3 public `VITE_*` brand vars. |
| `.env.local` | Local (gitignored) brand overrides. |

## `shared/` — the contract

| File | Role |
|---|---|
| `shared/types.ts` | The **single source of truth** for the quote payload shape: `RangeKey`, `SeriesPoint`, `RangeSeries`, `NewsItem`, `IhsgData`. Imported by BOTH the Worker and the app. Changing the wire format starts here. |

## `worker/` — the edge backend

| File | Role / key functions |
|---|---|
| `worker/index.ts` | The whole backend. `fetch()` (routes `/api/quote` vs ASSETS), `scheduled()` (cron refresh). Caching: `getData`, `refresh`, `writeCache` (KV key `ihsg:data:v1`, 60 s freshness, 600 s TTL). Provider: `IhsgProvider` interface + `YahooProvider` (fetches 8 ranges from Yahoo v8 in parallel). Domain: `pickBaseline` (Google-parity baselines), `seriesFromChart`, `buildTickLabels`, stats from OHLC. News: `fetchNews` (Google News RSS regex parse). Fallback: `emptyData()` (from `shared/types`) — empty/zero cold-start. |

## `public/` — static assets (copied verbatim to `dist/`)

| Path | Role |
|---|---|
| `public/audio/` | Library tracks (same-origin so the Web Audio analyser can read them). **Git-ignored / not shipped** — bring your own MP3s; the `SONGS` list is generated from them at build time (ID3 tags → title/sub). Only `.gitkeep` + `README.md` are committed. |
| `public/icons/*.png` | PWA icons (192/512, maskable) + favicons (16/32) + Apple touch icons (120–180). |
| `public/favicon.ico` | Classic favicon. |

## `src/` — the React app

### Entry & cross-cutting

| File | Role |
|---|---|
| `main.tsx` | Mounts React (`createRoot`, **no StrictMode** — the audio graph must not double-init), imports `styles.css`, imports `save-image` for its `window.StoryImage` side effect, registers the PWA service worker (`registerSW({ immediate: true })`). |
| `App.tsx` | Root view. Owns `Prefs` (theme/lang/model/defaultRange/spectrumIntensity/range) persisted to `ihsg.prefs.v1`. Computes display price/change/%, range baseline, document title. Hosts `useLiveTicker` (headline sings) and `RollingNumber`/`buildReels` (the animated headline value — per-digit odometer + directional flash; ±/% figures are plain). Publishes `window.IHSG_still`. |
| `config.ts` | Reads `VITE_BRAND_NAME` / `VITE_BRAND_URL` / `VITE_SITE_URL` with defaults. |
| `vite-env.d.ts` | Vite client types + `ImportMetaEnv` for the `VITE_*` vars. |
| `data.ts` | Data layer: `useIhsgData()` (10 s poll), `fetchIhsgData`, `initialData` (cached or `emptyData()` from `shared/types`), last-good cache (`ihsg.data.cache.v1`), `isValid` payload guard. |
| `i18n.ts` | `I18N` dictionary for `id` (default) + `en`; `Strings` interface; per-range tab/label strings. |
| `save-image.ts` | Builds the 1080×1920 story canvas from `window.IHSG_still` + `window.IHSG_drawChartStill()`; `StoryImageApi` = `buildStoryCanvas` / `saveImage` / `shareImage` / `canShareImage`. |
| `styles.css` | The complete design system (~1500 lines): `:root` tokens, `html[data-theme="dark|light"]` palettes, layout, responsive `@media (max-width: 560px)`. |

### `src/audio/`

| File | Role / key exports |
|---|---|
| `useAudioEngine.ts` | One transport over 3 sources. Exports `useAudioEngine()` → `AudioEngine`, `SONGS` (the library list, imported from `virtual:song-library` — generated from `public/audio/` at build time), `parseYouTubeId`, `fmtTime`, types `Song` / `SourceKind`. Builds the Web Audio graph (`MediaElementSource → Analyser(fftSize 2048) → destination`), manages the hidden YouTube `YT.Player`, persists volume/mute/loop/position and the last library song. |
| `spectrum.ts` | Shared canvas helpers: `hexToRgb`, `withAlpha`, `lerpColor`, `toAlpha`, `roundTopRect`, and **`idleFreq(n, tms)`** — the synthetic beat-driven spectrum used when there's no analyser (YouTube). |

### `src/components/`

| File | Role / key exports |
|---|---|
| `SpectrumChart.tsx` | The centerpiece canvas renderer. Draws the price line + spectrum for the 5 models, hover crosshair, axis ticks, and the 1D **full-day time axis** (09:00–16:00 WIB via `wibDayBounds`) with a leading current-price dot + lunch-break gap handling. Exposes `window.IHSG_drawChartStill`. Export: `SpectrumChart`. |
| `Player.tsx` | The player bar (play/pause/seek/volume/loop/mute) + the music picker modal (Library / Device upload / YouTube tabs). Export: `PlayerBar`. |
| `Settings.tsx` | The Share menu (`ShareButton` → copy link, save image, share image, X/Facebook) and the `SettingsSidebar` (language, theme, spectrum model). Exports: `ShareButton`, `SettingsSidebar`. |
| `Sections.tsx` | Below-the-fold "About/Profile" (Wikipedia link) and "News" sections. Export: `InfoSections`. |
| `icons.tsx` | Inline SVG glyph components (play, pause, share, gear, arrows, etc.). |

## Build output (`dist/`, generated)

Produced by `npm run build`; served by the Worker's Assets binding. Contains the
hashed JS/CSS bundles, `index.html`, `manifest.webmanifest`, `sw.js` + Workbox runtime,
and the copied `public/` assets. Not committed source — safe to delete and rebuild.

## Notably absent (by design)

- No `migrations/`, no SQL, no ORM (see [06-data-and-api](data-and-api.md)).
- No `tests/` or test config (see [12-development](development.md)).
- No `src/store/` — state is local React + `localStorage` + a few `window` globals.
- No auth/session module (the app is public/anonymous).
