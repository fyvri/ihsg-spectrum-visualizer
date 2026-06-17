# 09 — Third-Party Integrations & External Services

All integrations are either **server-side in the Worker** (data) or **client-side via
public CDN APIs** (fonts, YouTube). None require credentials or API keys.

---

## 1. Yahoo Finance v8 chart API (server-side) — primary data source

| Aspect | Detail |
|---|---|
| Where | `worker/index.ts` → `fetchChart()`, `YahooProvider` |
| Symbol | `^JKSE` (URL-encoded `%5EJKSE`) — the IDX Composite on Yahoo |
| Endpoint | `https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=…&interval=…&includePrePost=false` |
| Auth | None |
| Per-range params | 1D `1d/1m`, 5D `5d/30m`, 1M `1mo/1d`, 6M `6mo/1d`, YTD `ytd/1d`, 1Y `1y/1d`, 5Y `5y/1wk`, Max `max/1mo` |
| Fetch options | `user-agent: Mozilla/5.0 (compatible; IHSGVisualizer/1.0)`, `cf: { cacheTtl: 30, cacheEverything: true }` |
| Parallelism | All 8 ranges fetched with `Promise.all` |
| Failure handling | Throws → caught upstream → stale KV or empty/zero fallback |

**Why Yahoo, not Google Finance directly:** Google Finance is the canonical page the
UI links to, but it is CORS-locked and brittle to scrape. Yahoo's chart API is a
stable JSON source. The per-range **baseline rules** (see
[07-business-logic](business-logic.md)) reconcile Yahoo's data with Google's
displayed numbers. The provider is swappable — see the `IhsgProvider` interface.

> **Swapping providers:** implement `IhsgProvider.fetch(): Promise<IhsgData>` and use
> it in `buildData()`. The React app is "dumb about data sources" — it only knows the
> `IhsgData` shape. (Per project memory: the Worker defaults to Yahoo `^JKSE` + Google
> News RSS, not Google Finance scraping; the provider is intentionally swappable.)

---

## 2. Google News RSS (server-side) — news headlines

| Aspect | Detail |
|---|---|
| Where | `worker/index.ts` → `fetchNews()` |
| Endpoint | `https://news.google.com/rss/search?q=IHSG OR "IDX Composite"&hl=id&gl=ID&ceid=ID:id` |
| Auth | None |
| Parsing | Regex over `<item>` blocks → `title`, `link`, `source`, `pubDate` (max 12) |
| Transform | Strips trailing " - Source" from titles, decodes HTML entities, computes minutes-ago |
| Fetch options | UA header, `cf: { cacheTtl: 120, cacheEverything: true }` |
| Failure handling | `.catch(() => [])` — news is non-fatal; quote still returns |

---

## 3. YouTube IFrame Player API (client-side) — audio source

| Aspect | Detail |
|---|---|
| Where | `useAudioEngine.ts` → `ensureYTApi`, `loadYouTube` |
| Script | `https://www.youtube.com/iframe_api` (injected once, id `yt-iframe-api`) |
| Player host | A hidden 1×1 off-screen `<div id="yt-audio-host">` |
| Player vars | `autoplay:1, controls:0, disablekb:1, modestbranding:1, playsinline:1, rel:0` |
| Metadata | `getVideoData()` → title/author shown as the track name |
| State sync | `onStateChange` (PLAYING/PAUSED/ENDED) + a 250 ms poll for time/duration |
| **Limitation** | **Cross-origin audio CANNOT be tapped by the Web Audio analyser** (it would taint the analyser). So during YouTube playback the spectrum and the "singing" headline are **synthetic** (118 BPM). This is a hard browser/CORS constraint, not a bug. |

---

## 4. Google Fonts (client-side) — typography

| Aspect | Detail |
|---|---|
| Where | `index.html` (`preconnect` + stylesheet link) |
| Font | IBM Plex Sans (400–700) |
| Caching | Workbox: CSS via StaleWhileRevalidate, font files CacheFirst (1 year) |

---

## 5. Outbound links (informational, no integration)

- Google Finance disclaimer + COMPOSITE:IDX "More details" (`App.tsx`).
- Wikipedia (ID/EN) for the About section (`Sections.tsx`).
- Social share targets X / Facebook (`Settings.tsx`, via share URLs). The native Web
  Share API path (`save-image.ts`) shares the rendered story image, not a URL.

---

## Integration risk summary

| Service | Risk | Mitigation in code |
|---|---|---|
| Yahoo v8 | Unofficial API; shape/availability can change | Try/catch → stale KV → empty/zero; swappable provider |
| Google News RSS | Markup/format drift | `.catch(() => [])`; news is optional |
| YouTube API | API changes; no audio analysis possible | Defensive optional-chaining; synthetic spectrum |
| Google Fonts | CDN dependency | Workbox cache; system fallback via CSS |
