# 11 — Deployment, Infrastructure & Environments

## Infrastructure

The entire application runs on **Cloudflare** as a single Worker:

- **Compute:** one Worker (`worker/index.ts`).
- **Static hosting:** Workers **Assets** binding serving `./dist`.
- **Storage (optional):** Workers **KV** (`IHSG_KV`, one snapshot key) — unbound by
  default; bind it to enable the quote cache.
- **Scheduling:** Cloudflare **Cron Trigger** (`*/5 * * * *`).
- **CDN/edge cache:** Cloudflare's `cf` fetch options on upstream calls.

No servers, containers, databases, or other infrastructure to manage.

## One-time setup (before first deploy)

The repo is **fork-and-deploy with no required configuration** — the Worker fetches
the quote live, so you can skip straight to the deploy procedure. The steps below are
all optional refinements:

1. **Confirm the Worker name** in `wrangler.jsonc` (`ihsg-spectrum-visualizer`) matches
   the Worker in the Cloudflare dashboard (Workers Builds fails on a mismatch).
2. **Set build-time env vars** (`VITE_BRAND_NAME`, `VITE_BRAND_URL`, `VITE_SITE_URL`)
   in your build environment if overriding the defaults.
3. Authenticate Wrangler: `npx wrangler login` (run interactively in your shell, e.g.
   via `! npx wrangler login`).
4. **(Optional) Enable the KV cache.** Create a namespace and bind it as `IHSG_KV` —
   in the dashboard (Workers → your Worker → Settings → Bindings → KV namespace), or:
   ```bash
   npx wrangler kv namespace create IHSG_KV
   # → uncomment the kv_namespaces block in wrangler.jsonc and paste the returned id
   ```
   Without this, KV reads/writes are skipped and the cron refresh is a no-op.

## Deploy procedure

```bash
npm install          # if not already
npm run build        # typecheck + vite build → dist/ (incl. sw.js, manifest)
npx wrangler deploy  # uploads the Worker + dist/ assets, applies cron (+ KV if bound)
```

`wrangler deploy` reads `wrangler.jsonc`, uploads the Worker code and the `dist/`
assets, and registers the cron trigger (plus the KV binding if you enabled one). Each
`/api/quote` hit builds the response from the live upstream; when KV is bound, the cron
refreshes that snapshot every 5 minutes and fresh hits are served from cache.

### Optional: route / custom domain

Bind your domain (e.g. the host in `VITE_SITE_URL`) to the Worker via the Cloudflare
dashboard (Workers → Triggers → Custom Domains/Routes). Not encoded in `wrangler.jsonc`
today — configure in the dashboard or add a `routes`/`route` entry.

## Environments

This repo defines **a single (production) configuration**. There are no separate
`[env.staging]` / `[env.production]` blocks in `wrangler.jsonc`. To run a staging
environment you would either:

- add Wrangler environments (`--env staging`) with separate names/KV, or
- deploy to a second Worker with its own KV namespace and brand env vars.

Local "environment" = `npm run dev` (Vite + `wrangler dev`). If you've bound `IHSG_KV`,
Wrangler simulates it locally (no dashboard id needed for `wrangler dev`); if not, dev
runs the same as production — live fetch, no cache.

## CI/CD

No CI pipeline is committed in this repo. Recommended minimal pipeline:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npx wrangler deploy` (with `CLOUDFLARE_API_TOKEN` in CI secrets + `VITE_*` build vars)

(Cloudflare "Workers Builds" can also build+deploy on push if connected to the repo.)

## Rollback

- **Worker:** use the Cloudflare dashboard's Deployments tab to roll back to a prior
  version, or re-`wrangler deploy` a previous build.
- **Data:** KV holds only a transient snapshot (600 s TTL, refreshed every 5 min); no
  data rollback is meaningful — the next cron tick repopulates it.

## Production verification checklist

- `GET /api/quote` returns `200` with live (non-zero) values across all 8 ranges.
- `/` serves the app; deep links (e.g. `/anything`) return the SPA (`200`).
- `/manifest.webmanifest` and `/icons/icon-512x512.png` return `200`.
- `data-theme="light"` present in served HTML; no theme flash.
- Cron is listed under the Worker's Triggers. *(If you bound `IHSG_KV`, it shows the
  `ihsg:data:v1` key after the first refresh; skip this check when KV is unbound.)*
