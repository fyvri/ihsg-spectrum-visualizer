# IHSG Spectrum Visualizer

A Google-Finance-style quote page for the **IDX Composite (IHSG)** — the Indonesia
Stock Exchange composite index — where the price chart is rendered as a **live audio
spectrum** and the headline price **"sings the melody"** of whatever music is playing.

> The chart *is* the price data drawn as a spectrum; when no music plays it is
> completely still. Music makes the spectrum pulse and the headline number dance to
> the beat — but the **Save Image** export and all "official" numbers always reflect
> the **real quote**, never the animated values.

---

## Table of contents

- [Business purpose & use cases](#business-purpose--use-cases)
- [Main features](#main-features)
- [Technology stack](#technology-stack)
- [System requirements & prerequisites](#system-requirements--prerequisites)
- [Installation & local setup](#installation--local-setup)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [Project structure overview](#project-structure-overview)
- [Build & deployment](#build--deployment)
- [Testing](#testing)
- [Contribution guidelines & coding standards](#contribution-guidelines--coding-standards)
- [Troubleshooting](#troubleshooting)
- [Detailed documentation](#detailed-documentation)

---

## Business purpose & use cases

The IHSG Spectrum Visualizer is a **single-page web app + PWA** that re-imagines a
financial index quote page as an audio-reactive art piece. It is a public,
read-only, anonymous experience — there are no accounts and no user data is
collected.

**Primary use cases:**

1. **Glanceable quote page** — view the IDX Composite's latest value, day stats,
   52-week band, and a price chart across 8 time ranges (1D → Max), styled to feel
   like Google Finance.
2. **Audio-reactive visualization** — play a library track (bring-your-own audio),
   upload an audio file, or
   paste a YouTube link; the price chart becomes a spectrum that pulses to the music,
   and the headline number "sings the melody."
3. **Shareable story image** — export the current view as a 1080×1920 Instagram-Story
   PNG and share it via the Web Share API or social links.
4. **Installable PWA** — works offline (showing the last fetched quote) and can be
   installed to a phone home screen.

## Main features

- 📈 **Price chart as spectrum** — 5 spectrum models (BASS / MID / FULL / WAVE / MAX);
  the chart line *is* the index price.
- 🎵 **Three audio sources** — built-in library (bring-your-own audio; no files
  shipped, see License), device file upload, and YouTube link.
- 🎚️ **Headline sings the melody** — the big price number snaps to detected musical
  onsets (real spectral-flux analysis for file/library; a synthetic beat for YouTube).
- 🌗 **Light/dark theme** — light by default, follows the device color scheme on first
  visit, and a saved choice always wins (applied pre-paint, no flash).
- 🌐 **Full i18n** — Indonesian (default) and English, persisted.
- 🖼️ **Save / share image** — at-rest 1080×1920 export of the real quote.
- 📦 **PWA** — offline-tolerant, installable, service-worker precached shell.
- 🕒 **8 time ranges** — 1D, 5D, 1M, 6M, YTD, 1Y, 5Y, Max with Google-parity
  change-percent baselines.

See [`docs/features.md`](docs/features.md) for full feature-by-feature detail.

## Technology stack

| Layer | Technology |
|---|---|
| UI | React 18.3, TypeScript 5.7 |
| Build | Vite 6, `@vitejs/plugin-react` |
| PWA | `vite-plugin-pwa` 0.21 (Workbox `generateSW`) |
| Backend / edge | Single Cloudflare Worker (`worker/index.ts`) |
| Edge storage | Cloudflare KV (optional — one snapshot key) |
| Scheduling | Cloudflare Cron Trigger (every 5 min) |
| Data source | Yahoo Finance v8 chart API (`^JKSE`), Google News RSS |
| Audio | Web Audio API (AnalyserNode), YouTube IFrame API |
| Tooling | Wrangler 4, `concurrently` |
| Styling | Hand-written CSS (`src/styles.css`), CSS custom properties for theming |

There is **no** state-management library, CSS framework, component library, ORM, or
database server — the stack is intentionally minimal. Full inventory:
[`docs/tech-stack.md`](docs/tech-stack.md).

## System requirements & prerequisites

- **Node.js ≥ 18** (Vite 6 requirement) and npm.
- A **Cloudflare account** (for deployment and the optional KV namespace) — not
  needed for pure front-end dev (the UI renders an empty/zero state until the Worker
  responds).
- Modern browser with Web Audio API support.

## Installation & local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure brand env vars (optional — sensible defaults exist)
cp .env.example .env.local
#   edit .env.local as needed (see below)

# 3. Run the full stack (Vite web + Wrangler worker)
npm run dev
```

`npm run dev` runs two processes concurrently:

- **web** — Vite dev server (default `http://localhost:5173`, or the next free port).
- **api** — `wrangler dev` on `http://127.0.0.1:8787`, serving `/api/quote`.

Vite proxies `/api/*` to the Worker on `:8787`. If the Worker isn't up yet, the proxy
returns a `503` JSON body and the UI keeps showing the last-good cached data — or an
empty/zero state on a cold first load — and never crashes.

## Environment variables

All env vars are **public**, prefixed `VITE_`, and **baked into the client bundle at
build time**. There are no secret env vars. Set them in `.env`, `.env.local`, or your
deploy environment.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_BRAND_NAME` | `Membasuh` | Linked brand name in the page footer. |
| `VITE_BRAND_URL` | `https://membasuh.com` | Footer brand link target. |
| `VITE_SITE_URL` | `https://ihsg.membasuh.com` | URL printed on the Save-Image story export. |

Defaults live in [`src/config.ts`](src/config.ts); documentation in
[`.env.example`](.env.example) and [`docs/configuration.md`](docs/configuration.md).

## Running the app

| Command | What it does |
|---|---|
| `npm run dev` | Full stack: Vite web + `wrangler dev` worker (concurrently). |
| `npm run dev:web` | Vite dev server only (front-end against the `/api` proxy; empty/zero state until the Worker is up). |
| `npm run cf:dev` | `wrangler dev --port 8787` (Worker + API only). |
| `npm run build` | Type-check (app + worker) then `vite build` into `dist/`. |
| `npm run preview` | Serve the production build locally (Vite preview). |
| `npm run typecheck` | `tsc --noEmit` for both `tsconfig.app.json` and `tsconfig.worker.json`. |

## Project structure overview

```
.
├── index.html              # App shell; pre-paint theme script; favicon/icon links
├── vite.config.ts          # Vite + PWA (Workbox) + dev /api proxy
├── vite-plugin-song-library.ts  # Build-time scan of public/audio → SONGS (ID3 tags)
├── wrangler.jsonc          # Cloudflare Worker config (assets, KV, cron)
├── tsconfig.app.json       # TS config for the React app (src/)
├── tsconfig.worker.json    # TS config for the Worker (worker/)
├── .env.example            # Documented public env vars
├── shared/
│   └── types.ts            # IhsgData contract shared by app + worker
├── worker/
│   └── index.ts            # Cloudflare Worker: /api/quote, cron refresh, Yahoo provider
├── public/
│   ├── audio/              # library tracks (git-ignored, bring-your-own — see README there)
│   ├── icons/*.png         # PWA + favicon images
│   └── favicon.ico
└── src/
    ├── main.tsx            # React entry; registers SW; loads save-image side effect
    ├── App.tsx             # Root view; prefs; headline "sings" ticker
    ├── config.ts           # Brand env config
    ├── data.ts             # Data layer: poll /api/quote, empty/zero initial, last-good cache
    ├── i18n.ts             # ID/EN string dictionary
    ├── save-image.ts       # 1080×1920 story PNG generator + share API
    ├── styles.css          # Full design system (theme tokens, layout)
    ├── audio/
    │   ├── useAudioEngine.ts  # One transport over library/file/youtube sources
    │   └── spectrum.ts        # Color math, rounded rects, synthetic idle spectrum
    └── components/
        ├── SpectrumChart.tsx  # Canvas chart/spectrum renderer (the centerpiece)
        ├── Player.tsx         # Player bar + music picker (library/device/youtube)
        ├── Settings.tsx       # Settings sidebar + Share menu
        ├── Sections.tsx       # About + News sections
        └── icons.tsx          # Inline SVG glyphs
```

Full module-by-module explanation: [`docs/project-structure.md`](docs/project-structure.md).

## Build & deployment

```bash
npm run build        # produces dist/ (app shell + SW + precache manifest)
npx wrangler deploy  # deploys the Worker; serves dist/ via the Assets binding
```

**No required configuration — fork and deploy as-is.** The Worker fetches the quote
live on each request, so it works out of the box with nothing to set up.

**Optional caching:** bind a KV namespace named `IHSG_KV` to add a short-TTL cache
(and make the 5-minute Cron Trigger meaningful). Do it in the Cloudflare dashboard
(Workers → your Worker → Settings → Bindings → KV namespace), or via the CLI:

```bash
npx wrangler kv namespace create IHSG_KV
# then uncomment the kv_namespaces block in wrangler.jsonc and paste the returned id
```

Without `IHSG_KV` bound, KV reads/writes are skipped and the cron refresh is a no-op —
the app still serves live data.

The Worker name in `wrangler.jsonc` must match the Worker name in the Cloudflare
dashboard. Full procedure & environments: [`docs/deployment.md`](docs/deployment.md).

## Testing

There is currently **no automated test suite** in this repository — no test runner,
unit tests, or E2E tests are configured. Quality is gated by:

- `npm run typecheck` — strict TypeScript across app + worker.
- `npm run build` — fails on any type error before bundling.
- Manual / browser verification (the data baselines were verified against Google
  Finance; the chart was pixel-verified via Chrome DevTools).

See [`docs/development.md`](docs/development.md#testing--verification) for the
manual verification checklist and how to add a test runner if desired.

## Contribution guidelines & coding standards

- **Language:** TypeScript everywhere; keep `npm run typecheck` green.
- **Style:** match the surrounding code — 2-space indent, double quotes, descriptive
  block comments explaining *why*. No new dependencies without strong justification
  (the minimal stack is deliberate).
- **`any` / `eslint-disable`:** only where a third-party surface is genuinely untyped
  (YouTube IFrame API, `webkitAudioContext`) — see existing usages for the pattern.
- **The 8 non-negotiables** (product invariants) must be preserved — see
  [`docs/business-logic.md`](docs/business-logic.md#product-invariants-non-negotiables).
- **Data shape:** any change to the quote payload must update `shared/types.ts`
  (the single contract used by both the app and the Worker).
- Run `npm run build` before opening a PR.

Full contributor guide: [`CONTRIBUTING.md`](CONTRIBUTING.md).

> Note: this project is **not currently a git repository** (run `git init` to start
> versioning). See remaining [open questions](docs/README.md#open-questions--missing-information).

## License

Source code is licensed under the [MIT License](LICENSE). The "Membasuh" brand is
**not** covered by MIT — see the scope note in [`LICENSE`](LICENSE).

**Music library is bring-your-own audio.** No audio files are distributed with
this repository — they may be copyrighted, and shipping them publicly would
infringe. The `public/audio/` folder is git-ignored; to use the **Library** tab,
just drop your own legally-obtained / royalty-free MP3s there — the list is
generated at build time, with title/artist read from each file's ID3 tags (see
[`public/audio/README.md`](public/audio/README.md)).
The **Device upload** and **YouTube** tabs need no bundled files. If you deploy
the site, ensuring you have the rights to any audio you serve is your
responsibility.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `/api/quote` returns 503 in dev | The Worker isn't running — start `npm run cf:dev` (or use `npm run dev`). |
| `Address already in use (127.0.0.1:8787)` | A previous `wrangler dev` is still running; kill it or use a different port. |
| Chart stays empty/zero, never updates | The Worker can't reach Yahoo (cold start with no network); check Worker logs. |
| Quotes feel stale / want caching | Optional — bind a KV namespace as `IHSG_KV` (dashboard or `wrangler.jsonc`) to cache snapshots; unbound is fine and serves live data. |
| YouTube spectrum looks "synthetic" | Expected — cross-origin YouTube audio can't be tapped by the analyser; the spectrum is synthesized. |
| Theme flashes on load | Should not happen — the pre-paint script in `index.html` sets `data-theme` before render. |

More: [`docs/observability-and-errors.md`](docs/observability-and-errors.md) and
[`docs/limitations-and-tech-debt.md`](docs/limitations-and-tech-debt.md).

## Detailed documentation

The full as-is documentation lives in [`docs/`](docs/README.md):

| Doc | Contents |
|---|---|
| [Overview](docs/overview.md) | Business objectives, scope, personas |
| [Architecture](docs/architecture.md) | System & component diagrams, data flow |
| [Project structure](docs/project-structure.md) | Folder/module-by-module |
| [Tech stack](docs/tech-stack.md) | Dependencies & rationale |
| [Features](docs/features.md) | Feature docs, workflows, implementation |
| [Data & API](docs/data-and-api.md) | Data model, KV schema, `/api/quote` reference |
| [Business logic](docs/business-logic.md) | Baselines, invariants, domain rules |
| [Configuration](docs/configuration.md) | Env vars, build/runtime config |
| [Integrations](docs/integrations.md) | Yahoo, Google News, YouTube |
| [Observability & errors](docs/observability-and-errors.md) | Logging, error handling |
| [Deployment](docs/deployment.md) | Infra, environments, procedure |
| [Development](docs/development.md) | Local setup, debugging, testing |
| [Limitations & tech debt](docs/limitations-and-tech-debt.md) | Known issues |
| [ADRs](docs/adr.md) | Architecture Decision Records |
| [Security](docs/security.md) | Threat model, posture, hardening |
