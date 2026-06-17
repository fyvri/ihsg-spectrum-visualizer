# 10 — Logging, Monitoring, Error Handling & Observability

## Worker observability

`wrangler.jsonc` sets `"observability": { "enabled": true }`, so the Worker emits
logs/metrics to the Cloudflare dashboard (Workers → your Worker → Logs / Metrics).
Use `wrangler tail` to stream live logs:

```bash
npx wrangler tail
```

There is **no explicit `console.log` instrumentation** in `worker/index.ts` — it
relies on platform request metrics and the structured error responses below. If you
need deeper tracing, add logs in `getData`/`refresh`/`fetchChart`/`fetchNews`.

## Error-handling philosophy: degrade, never crash

The app is built so that **every failure path yields a usable UI**. There are no
unhandled rejections surfaced to the user.

### Server side (`worker/index.ts`)

| Function | Failure | Handling |
|---|---|---|
| `getData` | KV read throws | `cached = null`, proceeds to rebuild |
| `getData` | rebuild throws | return stale `cached` if any, else `emptyData()` (zero/empty dataset) |
| `refresh` (cron) | rebuild throws | leave previous KV snapshot in place |
| `writeCache` | KV put throws | ignored (best-effort) |
| `fetchChart` | non-200 / empty | throws → bubbles to `getData` fallback |
| `fetchNews` | any error | `buildData` does `.catch(() => [])` → empty news |
| `/api/*` unknown | — | `404 { error: "not found" }` |

### Client side

| Module | Failure | Handling |
|---|---|---|
| `data.ts` `useIhsgData` | fetch/parse error | keep last-good snapshot; retry in 10 s |
| `data.ts` `isValid` | malformed payload | reject; don't overwrite good data |
| `localStorage` (all sites) | quota / private mode | try/catch, silently ignore |
| `useAudioEngine` `toggle` | autoplay rejection | swallowed; UI stays consistent |
| `useAudioEngine` `loadLibrary` | blob fetch fails | fall back to direct URL src |
| Vite dev proxy | Worker down | `503 { error }` JSON, UI keeps last-good |
| `save-image` share | unsupported/cancelled | returns `"unsupported"`/`"cancelled"` (no throw) |

> **Trade-off to be aware of:** because failures are swallowed to keep the UI alive,
> some errors are **silent**. When debugging "data looks stale," check `wrangler tail`
> and the Network tab for the actual `/api/quote` status — the UI won't show an error
> banner.

## Client-side monitoring / analytics

**None.** There is no analytics, RUM, Sentry, or telemetry SDK in the client. No user
events are tracked or transmitted. (The only "monitoring" is Cloudflare's
server-side Worker metrics.)

## Health checks

There is no dedicated health endpoint. `GET /api/quote` doubles as a liveness check —
a `200` with a populated `IhsgData` body (non-zero `latest.value`, non-empty ranges)
means the Worker + data path are healthy. A `200` that is the **empty/zero dataset**
(`latest.value` 0, every range `points: []`) indicates upstream fetches are failing
while the Worker itself is up.

## Suggested additions (not implemented)

- Add `console.error` (or structured logs) in the Worker catch blocks so failures are
  visible in `wrangler tail`, not just inferred.
- Consider a lightweight `/api/health` returning `{ ok, source: "live|stale|empty" }`.
- Consider privacy-respecting client analytics if engagement metrics are desired.
