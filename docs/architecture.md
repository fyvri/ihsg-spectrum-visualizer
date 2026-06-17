# 02 — System Architecture

## Topology: single Cloudflare Worker

The app uses a **single-Worker topology**. One Cloudflare Worker (`worker/index.ts`)
serves both the static front-end build (via the **Assets** binding) and the JSON API
(`/api/quote`). A **Cron Trigger** periodically refreshes a cached snapshot in **KV**.

```
                          ┌──────────────────────────────────────────────┐
                          │              Cloudflare Worker                 │
   Browser ──── GET / ───▶│  fetch():                                      │
   (React PWA)            │   • /api/quote  → JSON from KV (refresh if     │
        │                 │                   stale) ───┐                  │
        │                 │   • everything else → ASSETS │ (Vite dist/)    │
        │                 │                              │                 │
        │  GET /api/quote  │  scheduled() (cron */5min):  │                 │
        └────────────────▶│   • refresh() → write KV ◀───┘                 │
                          │                              ▲                 │
                          └──────────────┬───────────────┘                 │
                                         │ server-side fetch               │
                              ┌──────────┴───────────┐                     │
                              ▼                      ▼                      │
                   Yahoo Finance v8 chart    Google News RSS               │
                   (^JKSE, 8 ranges)         (IHSG / IDX Composite)        │
                                         │
                                  Cloudflare KV
                              key: "ihsg:data:v1"  (1 JSON snapshot)
```

### Why single-Worker

- One deploy unit, one origin → no CORS between app and API.
- `/api/*` is routed to the Worker first (`run_worker_first: ["/api/*"]`); all other
  paths fall through to static assets with SPA fallback to `index.html`.
- See [ADR-001](adr.md#adr-001-single-worker-topology).

## Front-end component architecture

```
main.tsx (createRoot, registerSW, import save-image side-effect)
└── App.tsx ─────────────────────────────────────────────── root view + state
     │  prefs (theme/lang/model/range) ↔ localStorage "ihsg.prefs.v1"
     │  useIhsgData()      → polls /api/quote, publishes window.IHSG_DATA
     │  useAudioEngine()   → one transport over library/file/youtube
     │  useLiveTicker()    → headline "sings the melody"
     │
     ├── <ShareButton>           (Settings.tsx)  → window.StoryImage
     ├── <SpectrumChart>         (SpectrumChart.tsx) ← engine, points, model
     │       └── window.IHSG_drawChartStill()  (still snapshot for export)
     ├── <PlayerBar>             (Player.tsx)    ← engine; music picker
     ├── <InfoSections>          (Sections.tsx)  ← news, about/wikipedia
     └── <SettingsSidebar>       (Settings.tsx)  ← theme/lang/model
```

### Cross-cutting globals (`window.*`)

The app uses a few intentional `window` globals as seams between React and the
canvas/imperative layers:

| Global | Producer | Consumer | Purpose |
|---|---|---|---|
| `window.IHSG_DATA` | `data.ts` (`useIhsgData`) | `App`, `useLiveTicker` | Current quote snapshot |
| `window.IHSG_still` | `App.tsx` effect | `save-image.ts` | Real at-rest headline values for export |
| `window.IHSG_drawChartStill` | `SpectrumChart.tsx` | `save-image.ts` | Renders an at-rest chart canvas |
| `window.StoryImage` | `save-image.ts` | `Settings.tsx` (Share) | `saveImage` / `shareImage` / `canShareImage` |
| `window.YT`, `window.onYouTubeIframeAPIReady` | YouTube IFrame API | `useAudioEngine` | YouTube player control |

## Runtime data flow (quote)

1. **First paint (sync):** `initialData()` returns `localStorage["ihsg.data.cache.v1"]`
   if present and valid, else an **empty/zero dataset** (value 0, blank chart, no news)
   — and sets `window.IHSG_DATA`.
2. **Poll loop:** `useIhsgData` calls `GET /api/quote` every **10 s**. On success it
   updates React state, `window.IHSG_DATA`, and the last-good cache. On failure it
   keeps the last good snapshot (never fabricates).
3. **Worker:** `/api/quote` returns KV snapshot if **< 60 s** old; otherwise rebuilds
   from Yahoo + Google News, returns it, and writes KV in the background. If the
   rebuild throws, it falls back to the stale snapshot, or to an empty/zero dataset.
4. **Cron:** every **5 min**, `scheduled()` rebuilds and writes KV so most `/api/quote`
   hits are warm.

## Audio & visualization flow

```
Source select (Player) ─▶ useAudioEngine.loadLibrary/loadFile/loadYouTube
   │
   ├── library / file:  <audio> ─▶ MediaElementSource ─▶ AnalyserNode ─▶ destination
   │        AnalyserNode.getByteFrequencyData() drives the REAL spectrum
   │
   └── youtube:  hidden YT.Player (cross-origin, untappable)
            → SpectrumChart uses a SYNTHETIC spectrum (spectrum.ts idleFreq)
            → useLiveTicker uses a SYNTHETIC 118-BPM melody

SpectrumChart rAF loop:
   playing? → animate (analyser bins OR synthetic idleFreq)
   not playing? → completely still (draws the price line only)

useLiveTicker rAF loop (App):
   onset detected (spectral flux) → headline price snaps to that note's pitch
```

See [05-features](features.md) and [07-business-logic](business-logic.md) for
the spectral-flux and synthetic-beat details.

## Trust & security boundaries

- The browser only ever talks to the **same-origin** Worker (`/` and `/api/quote`)
  plus third-party CDNs it explicitly loads (Google Fonts, YouTube IFrame API).
- All external data fetching (Yahoo, Google News) happens **server-side in the
  Worker**, never from the browser — avoiding CORS and hiding the upstreams.
- No secrets exist anywhere in the client or the Worker (the only config is public
  brand strings). See [08-configuration](configuration.md).
