# 08 — Environment & Configuration

## Environment variables

All env vars are **public** (`VITE_` prefix) and **inlined into the client bundle at
build time** by Vite. There are **no secrets** — nothing here is sensitive, and the
Worker requires no env secrets either.

| Variable | Default (`src/config.ts`) | Where it shows up |
|---|---|---|
| `VITE_BRAND_NAME` | `Membasuh` | Footer linked text; `<title>` suffix. |
| `VITE_BRAND_URL` | `https://membasuh.com` | Footer link `href`. |
| `VITE_SITE_URL` | `https://ihsg.membasuh.com` | URL printed on the Save-Image story export. |

Because they're build-time, **rebuild** after changing them; setting them only at
runtime has no effect on an already-built bundle.

### Where to set them

| Context | File / mechanism |
|---|---|
| Local dev | `.env.local` (gitignored) or `.env` |
| Reference/template | `.env.example` (committed) |
| CI / deploy | Build environment variables in your CI / Cloudflare build settings |

```dotenv
# .env.local
VITE_BRAND_NAME=Membasuh
VITE_BRAND_URL=https://membasuh.com
VITE_SITE_URL=https://ihsg.membasuh.com
```

Types for these live in `src/vite-env.d.ts` (`ImportMetaEnv`). Access is via
`import.meta.env.VITE_*`, centralized in `src/config.ts` — **import from `config.ts`,
don't read `import.meta.env` ad hoc.**

## Worker configuration (`wrangler.jsonc`)

| Key | Value | Notes |
|---|---|---|
| `name` | `ihsg-spectrum-visualizer` | Must match the Worker name in the Cloudflare dashboard. |
| `main` | `worker/index.ts` | Worker entry. |
| `compatibility_date` | `2026-06-01` | Workers runtime behavior pin. |
| `assets.directory` | `./dist` | The Vite build to serve. |
| `assets.binding` | `ASSETS` | Bound as `env.ASSETS` (a `Fetcher`). |
| `assets.not_found_handling` | `single-page-application` | SPA fallback to `index.html`. |
| `assets.run_worker_first` | `["/api/*"]` | `/api/*` always hits `fetch()` first. |
| `kv_namespaces` | _(unset)_ — optional `IHSG_KV` binding | **Optional.** Unbound by default for zero-config forks; bind to enable the quote cache (commented template in `wrangler.jsonc`). |
| `triggers.crons` | `["*/5 * * * *"]` | 5-minute KV refresh (no-op until `IHSG_KV` is bound). |
| `observability.enabled` | `true` | Worker logs/metrics. |

## Build / bundler configuration (`vite.config.ts`)

- **Plugins:** `@vitejs/plugin-react`, `VitePWA`, and the local `song-library`
  plugin (`vite-plugin-song-library.ts`) — exposes `virtual:song-library`, the
  `SONGS` list built from `public/audio/` ID3 tags at build time.
- **PWA manifest:** name "IHSG Spectrum Visualizer", short_name "IHSG", `standalone`,
  `portrait`, `theme_color`/`background_color` `#ffffff` (light default), icons
  192/512 + maskable.
- **Workbox (`generateSW`):**
  - Precache: `**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}`, **ignoring**
    `audio/**` (too large to precache).
  - `navigateFallback: /index.html`, denylist `/api/`.
  - Runtime caching: `/api/` → **NetworkOnly**; `/audio/*.(mp3|m4a|ogg|wav)` →
    **CacheFirst** (`ihsg-audio`, 12 entries); Google Fonts CSS → SWR; font files →
    CacheFirst (1 year, 30 entries).
- **Dev proxy:** `/api` → `http://127.0.0.1:8787`; on connection error returns
  `503 {error}` so the UI degrades gracefully instead of throwing.

## TypeScript configuration

| File | Scope |
|---|---|
| `tsconfig.app.json` | `src/` (DOM + React libs). |
| `tsconfig.worker.json` | `worker/` (Cloudflare Workers types). |

`npm run typecheck` runs both with `--noEmit`; `npm run build` runs it before bundling.

## App-level defaults (in code, not env)

Defined in `App.tsx` `DEFAULTS` and persisted to `ihsg.prefs.v1`:

| Pref | Default | Notes |
|---|---|---|
| `theme` | `light` | Then device scheme on first visit; saved wins. |
| `lang` | `id` | Indonesian. |
| `model` | `FULL` | Spectrum model. |
| `defaultRange` | `1D` | Initial chart range (the "1HR"/"1D" tab). |
| `spectrumIntensity` | `2.0` | Reactive amplitude multiplier. |
