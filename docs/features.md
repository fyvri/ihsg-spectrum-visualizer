# 05 — Feature Documentation, Workflows & Implementation

Each feature below states **what the user sees**, **how it works in code**, and the
**relevant files**.

---

## F1 — Quote header (price, change, stats)

**User:** Sees the index name, symbol (`IDX: COMPOSITE`), the big latest value, a
change badge (`▲/▼ %`), the absolute + percent change with a range label, a
timestamp + disclaimer link, and a stats grid (Open / High / Low / Prev close /
52-wk High / 52-wk Low).

**Code:** `App.tsx`. `D = useIhsgData()` provides the snapshot. The displayed value
is `live ? live.value : D.latest.value`. Change is `dispV - baseStart` where
`baseStart` is the **range baseline** (see [F2](#f2--time-ranges--baselines)). Numbers
are formatted with `Intl.toLocaleString` in the active locale. The document `<title>`
is kept in sync with price/change.

The **big value** renders through `RollingNumber` (+ `buildReels`): a per-digit
vertical **odometer** — each changed digit slides to its new value, rolling through
the digits in between — with a directional **color flash** (green up / red down,
fading back to the text color) on each idle change. **On first load the headline
rolls up from the range baseline (`mountFrom={startV}`) to the live value**
(`animateOnMount`, no flash) instead of snapping in. **While music plays the value
snaps with no animation at all** (`freezeWhenPlaying`), so the dancing headline never
rolls/flashes. The change badge (`%`), the absolute ±change, and the mobile
change-line are **plain text — no animation** at any time (by design). Reel/flash styling
lives in `styles.css` (`.rnum`/`.rdigit`/`.rstrip`, `numFlashUp/Down`); honors
`prefers-reduced-motion`.

---

## F2 — Time ranges & baselines

**User:** A tab strip (1D, 5D, 1M, 6M, YTD, 1Y, 5Y, Max). Selecting a tab swaps the
chart and recomputes the change against that range's baseline. Selection persists.

**Code:** Tabs from `D.order`; `setRange` writes `ihsg.prefs.v1.range`. The baseline
comes from the Worker as `ranges[k].baseline` (`App.tsx`: `startV = rngData.baseline
?? (range === "1D" ? prevClose : pts[0].v)`). The baseline rules (Google parity) are
implemented server-side in `pickBaseline` — see
[07-business-logic](business-logic.md#range-baselines-google-finance-parity).

---

## F3 — Chart as audio spectrum (5 models)

**User:** The price chart. At rest it's a still price line. With music it animates as
a spectrum in one of 5 models: **BASS** (bars), **MID** (filled area), **FULL**
(line, default), **WAVE**, **MAX** (bars). Model is chosen in Settings and persists.

**Code:** `SpectrumChart.tsx` runs a `requestAnimationFrame` loop sharing
`paintSpectrumFrame` with the still snapshot. When `engine.playing`:
- **library/file:** reads `analyserRef.getByteFrequencyData()` (real signal).
- **youtube:** analyser is force-`null`; uses synthetic `idleFreq()` from
  `spectrum.ts`.
The reactive lift is clamped to the plot top; amplitude scales by `spectrumIntensity`
(default 2.0). 1D mode is **time-scaled across the whole Jakarta session
(09:00–16:00 WIB, via `wibDayBounds`)**: while the market is live the price fills only
up to *now*, the rest of the axis stays empty, and a **leading current-price dot**
marks the latest value — like Google Finance. It also handles the lunch-break gap
(segments drawn separately) and a previous-close reference line. **When not playing,
the loop draws the price only — the chart is completely still** (a product invariant).

---

## F4 — Headline "sings the melody"

**User:** While music plays, the big price number and its change jump around in time
with the music — it appears to "sing."

**Code:** `useLiveTicker` in `App.tsx`, a rAF loop:
- **library/file:** spectral-flux **onset detection** over the melodic band. On an
  onset (flux above an adaptive threshold, min-gap 105 ms), it computes the spectral
  **centroid**, maps it through adaptive min/max pitch tracking + an S-curve to a
  `level ∈ [0,1]`, and snaps the headline to `loV + level*(hiV-loV)` (the 1D series
  min/max). 
- **youtube:** no analyser, so it fires a **synthetic 8th-note melody at 118 BPM**
  (`Math.sin` blend) so the number still dances.
The change/% during playback is measured against the **1D baseline**. When playback
stops, `live` resets to `null` and the header returns to the real quote.

---

## F5 — Music sources (library / device / YouTube)

**User:** A player bar + a picker modal with three tabs:
- **Library** — pick one of the bring-your-own tracks. **No audio ships with the
  repo** — `public/audio/` is git-ignored; drop files in locally. The list is
  generated at build time from whatever is present, with `title`/`sub` read from
  each MP3's ID3 tags (filename fallback) — no code edit (see
  `public/audio/README.md`). Without files the Library tab shows an empty state.
- **Device** — upload/drag-drop a local audio file.
- **YouTube** — paste a link (or 11-char id); audio plays from a hidden player.

**Code:** `Player.tsx` (UI) + `useAudioEngine.ts` (transport). `SONGS` is the
generated library list (same-origin `/audio/*` URLs), produced by
`vite-plugin-song-library.ts` (the `virtual:song-library` module) from the files
in `public/audio/`. `loadLibrary` fetches the track as a blob (so the
analyser can read it), `loadFile` uses an object URL, `loadYouTube` parses the id
(`parseYouTubeId`) and drives a hidden `YT.Player`. Transport is unified: `toggle`,
`seek`, `setVolume`, `toggleLoop`, `toggleMute`. The YouTube title/author are pulled
via `getVideoData()` and shown as the track name.

**Workflows / persistence:**
- Volume, mute, loop persist (`ihsg.player.*`).
- A library track's position is saved (`ihsg.player.time`) and the last library song
  (`ihsg.lib.song`) is **restored on reload but not auto-played** (a product invariant).
- Choosing file/YouTube clears the saved library song.

---

## F6 — Theme (light default, follows device, saved wins)

**User:** Light theme by default. On first visit with no saved choice, the app follows
the device OS color scheme. Once you pick a theme it persists and wins. No flash.

**Code:** `index.html` pre-paint inline script sets `data-theme` before render
(saved `ihsg.prefs.v1.theme` → `matchMedia` device → light). `App.tsx` mirrors this:
`theme: saved.theme ?? deviceTheme()`, and an effect applies `data-theme` on change.
Palettes live in `styles.css` under `html[data-theme="dark|light"]`. See
[ADR-005](adr.md#adr-005-theme-default-light--follow-device--saved-wins).

---

## F7 — Internationalization (ID/EN)

**User:** Indonesian by default; switchable to English in Settings; persists.

**Code:** `i18n.ts` `I18N[lang]` flat string maps + month/weekday arrays + per-range
tab/label strings. `App` selects `T = I18N[lang]`; numbers use `T.locale`. Wikipedia
link and news subtitle localize too.

---

## F8 — News

**User:** A "News stories" section with headlines, source, and relative time
("3 hours ago"), with show-more/fewer.

**Code:** Worker `fetchNews()` queries Google News RSS for `IHSG OR "IDX Composite"`
(id/ID), regex-parses up to 12 items (`title`, `link`, `source`, `pubDate`), strips
the trailing " - Source" suffix, decodes entities, and computes minutes-ago.
Rendered by `Sections.tsx` (`InfoSections`). Each item shows a colored source-initial
avatar (`avaColor`, hashed from the source name); relative-time words come from i18n
(`minAgo`/`hourAgo`/`dayAgo`, via `relTime`). An item with no `url` links to a Google
search for its title.

**Fallback:** when the Worker supplies no news — cold start (`emptyData()` → `news: []`)
or an RSS failure — `Sections.tsx` renders a built-in `FALLBACK_NEWS` list of 12
Indonesian headlines so the section is **never empty** (only their relative times
localize). So the News section always shows content even though the cold-start
*dataset* itself carries no news.

---

## F9 — Save / Share image

**User:** A Share button offering **Copy link**, **Save Image**, **Share Image**, and
social targets (X / Facebook). Save Image downloads a 1080×1920 (Instagram-Story sized)
PNG that mirrors the mobile layout.

**Code:** `save-image.ts` exposes `window.StoryImage`. `buildStoryCanvas()` draws the
header, change, chart (via `window.IHSG_drawChartStill()`), and stats onto a
1080×1920 canvas, then `saveImage()` downloads it / `shareImage()` uses the Web Share
API (`canShareImage()` gates availability). **Values always come from
`window.IHSG_still` (the real, at-rest quote)** — never the animated headline. The
export omits the "More details" button and the News section by design. The footer
prints `VITE_SITE_URL`.

---

## F10 — PWA / offline

**User:** Installable to home screen; works offline showing the last fetched quote.

**Code:** `vite-plugin-pwa` (`registerType: autoUpdate`). Workbox precaches the app
shell (JS/CSS/HTML/icons/fonts), **never** caches `/api/*` (`NetworkOnly`), uses
`CacheFirst` for `/audio/*` and Google Fonts. Offline, `data.ts` serves the last-good
`localStorage` snapshot (or an empty/zero dataset on a cold first load). Manifest: name/short_name,
standalone, portrait, white theme/background, 192/512 + maskable icons.

---

## Feature → file quick map

| Feature | Primary files |
|---|---|
| Quote header | `App.tsx` |
| Ranges/baselines | `App.tsx`, `worker/index.ts` (`pickBaseline`) |
| Spectrum chart | `components/SpectrumChart.tsx`, `audio/spectrum.ts` |
| Headline sings | `App.tsx` (`useLiveTicker`) |
| Music sources | `components/Player.tsx`, `audio/useAudioEngine.ts` |
| Theme | `index.html`, `App.tsx`, `styles.css` |
| i18n | `i18n.ts` |
| News | `worker/index.ts` (`fetchNews`), `components/Sections.tsx` |
| Save/Share image | `save-image.ts`, `components/Settings.tsx` |
| PWA | `vite.config.ts`, `main.tsx` |
