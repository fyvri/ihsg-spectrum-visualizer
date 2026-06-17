# 06 — Data Model & API

## Data model — the `IhsgData` contract

The entire data layer is one shared TypeScript contract: **`shared/types.ts`**.
The Worker produces it; the app consumes it. There is no database schema beyond this
JSON shape.

```ts
type RangeKey = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "Max";

interface SeriesPoint { t: number; v: number; }   // t = epoch ms, v = index value

interface RangeSeries {
  points: SeriesPoint[];
  tickLabels: string[];   // English month/time labels; localized in the view
  baseline?: number;      // close immediately BEFORE the period (Google-parity)
}

interface NewsItem { src: string; mins: number; title: string; url?: string; }

interface IhsgData {
  name: string;     // "IDX Composite"
  symbol: string;   // "IDX: COMPOSITE"
  currency: string; // "IDR"
  latest: { value: number; ts: number; time?: string };
  stats: {
    open: number; high: number; low: number;
    prevClose: number; week52High: number; week52Low: number;
  };
  ranges: Record<RangeKey, RangeSeries>;
  order: RangeKey[];
  news?: NewsItem[];
}
```

### Field semantics

| Field | Meaning | Source (Yahoo provider) |
|---|---|---|
| `latest.value` | Latest index value | `meta.regularMarketPrice` (fallback: last 1D close) |
| `latest.ts` | Timestamp of latest (epoch ms) | `meta.regularMarketTime * 1000` |
| `stats.open` | Session open | First 1D bar's `open` |
| `stats.high/low` | Intraday extremes | `meta.regularMarketDayHigh/Low` or intrabar max/min |
| `stats.prevClose` | Previous close | `meta.chartPreviousClose` |
| `stats.week52High/Low` | 52-week band | Max/min of 1Y daily highs/lows |
| `ranges[k].points` | Price series for range `k` | Yahoo close[] (nulls skipped) |
| `ranges[k].baseline` | %-change reference | `pickBaseline()` (see [07](business-logic.md)) |
| `ranges[k].tickLabels` | ~6 axis labels | `buildTickLabels()` (Asia/Jakarta TZ) |

> **Data integrity rule:** prices are rounded to 2 decimals; bar `null`s (halts /
> lunch) are skipped, not zero-filled. Stats come from **OHLC**, not bar closes,
> because closes alone understate true extremes (that caused prior divergence from
> Google Finance).

---

## API reference

### `GET /api/quote`

The only API endpoint. Returns the full `IhsgData` JSON snapshot.

- **Auth:** none (public).
- **Method:** `GET` (no params used; range selection is client-side — the payload
  contains all 8 ranges). Any non-`GET` still returns the snapshot via `fetch()`.
- **Query params:** none are read by the Worker. (You may see `?range=...` in client
  calls historically, but the Worker ignores it and returns all ranges.)
- **Response:** `200 application/json; charset=utf-8`, header `cache-control: no-store`.
- **Body:** an `IhsgData` object (see contract above).

**Example (abridged):**

```http
GET /api/quote
```
```json
{
  "name": "IDX Composite",
  "symbol": "IDX: COMPOSITE",
  "currency": "IDR",
  "latest": { "value": 6007.66, "ts": 1781254806000 },
  "stats": {
    "open": 5960.42, "high": 6074.07, "low": 5952.85,
    "prevClose": 5886.03, "week52High": 9174.47, "week52Low": 5317.91
  },
  "ranges": {
    "1Y": {
      "points": [{ "t": 1781229600000, "v": 5960.46 }, "…240 pts"],
      "tickLabels": ["Jun","Aug","Oct","Jan","Mar","Jun"],
      "baseline": 7166.06
    },
    "…": "7 more ranges"
  },
  "order": ["1D","5D","1M","6M","YTD","1Y","5Y","Max"],
  "news": [{ "src": "Kontan", "mins": 42, "title": "…", "url": "https://…" }]
}
```

### Other paths under `/api/`

| Path | Behavior |
|---|---|
| `/api/quote` | The snapshot (above). |
| `/api/*` (anything else) | `404 { "error": "not found" }`. |

### All non-`/api` paths

Served from the Vite build via the Assets binding, with **single-page-application**
fallback to `index.html` (so client deep links resolve). `/api/*` is denied from the
SPA navigation fallback.

### Error model

There is no rich error contract — the API is designed to **always return a usable
snapshot**:

| Situation | Server behavior | Client behavior |
|---|---|---|
| KV warm (< 60 s) | Return cached snapshot | Render it |
| KV stale/missing | Rebuild from Yahoo; write KV | Render fresh |
| Rebuild fails, stale exists | Return stale snapshot | Render it |
| Rebuild fails, nothing cached | Return **empty/zero** dataset (`emptyData()`) | Render empty/zero (blank chart) |
| Worker unreachable (dev) | Vite proxy returns `503 {error}` | Keep last-good, else empty/zero |
| Bad payload shape | — | `isValid()` rejects; keep last-good |

---

## Authentication & authorization

**None.** `/api/quote` is an unauthenticated, public, read-only `GET`. There are no
users, roles, permissions, API keys, tokens, sessions, or cookies anywhere in the
app or Worker. This is intentional for a public quote page. There is therefore no
RBAC matrix to document.

---

## Cloudflare KV store (optional)

The only server-side persistence — and it's **optional**. By default no KV namespace is
bound, so the Worker fetches the quote live on every request (no caching). Bind a
namespace as `IHSG_KV` to turn on the cache described below; every KV access in the
Worker is guarded, so an unbound fork still works.

| Aspect | Value |
|---|---|
| Binding | `IHSG_KV` (`wrangler.jsonc`, unbound by default) |
| Key | `ihsg:data:v1` |
| Value | `{ ts: number, data: IhsgData }` (JSON) |
| Freshness window | 60 s (`FRESH_MS`) — serve cached without rebuild |
| TTL | 600 s (`expirationTtl`) on write |
| Writers | `scheduled()` cron (every 5 min) + on-demand rebuild in `getData` |

**"Migrations":** none. KV is schema-less. The `:v1` suffix on the key (and on the
client cache key `ihsg.data.cache.v1`) is the versioning mechanism — to change the
stored shape incompatibly, bump the suffix so old values are ignored.

---

## Client-side persistence (`localStorage`)

| Key | Written by | Holds |
|---|---|---|
| `ihsg.prefs.v1` | `App.tsx` | `{ theme, lang, model, defaultRange, spectrumIntensity, range }` |
| `ihsg.data.cache.v1` | `data.ts` | Last-good `IhsgData` snapshot (offline fallback) |
| `ihsg.lib.song` | `useAudioEngine` | Id of the last library track (restored, not auto-played) |
| `ihsg.player.time` | `useAudioEngine` | Resume position (seconds) for a library track |
| `ihsg.player.volume` | `useAudioEngine` | Volume `0..1` |
| `ihsg.player.muted` | `useAudioEngine` | `"1"`/`"0"` |
| `ihsg.player.loop` | `useAudioEngine` | `"1"`/`"0"` |

All reads/writes are wrapped in try/catch (private mode / quota safe).
