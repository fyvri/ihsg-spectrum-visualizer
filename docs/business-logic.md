# 07 — Business Rules & Domain Logic

This is the "why the numbers are what they are" document. The defining domain concern
is **matching Google Finance (COMPOSITE:IDX)** while sourcing data from Yahoo Finance.

---

## Product invariants (non-negotiables)

These are the product's hard rules. Preserve them in any change.

1. **The chart IS the price data.** The chart line is the actual index series, not
   decoration.
2. **Completely still when no music plays.** The rAF loop draws only the price line
   when `!engine.playing`.
3. **The headline sings only during playback.** `useLiveTicker` returns `null` when
   not playing; the header shows the real quote.
4. **Save Image uses the real quote.** Exports read `window.IHSG_still` (at-rest) and
   `window.IHSG_drawChartStill()`, never the animated values.
5. **Spectrum color follows range direction.** Up vs down range tints the spectrum.
6. **End-to-end i18n + persistence, no auto-play on reload.** Restored tracks are
   shown, not played.
7. **Fixed footer at 960px** (desktop layout constraint).
8. **Theme:** light default → follow device on first access → saved choice wins.

---

## Range baselines (Google Finance parity)

Every range's change/%-change is measured against a **baseline** = the close
*immediately before* the period. Yahoo and Google snap window boundaries differently,
so the rule is **per range**. Implemented in `worker/index.ts` → `pickBaseline()`.

| Range | Baseline rule | Rationale |
|---|---|---|
| **1D** | `chartPreviousClose` (`previousClose` fallback) | Intraday change vs prior close. |
| **5D / 1M / 6M** | First real close on/after `(periodEnd − rangeDays)` | Matches Google's window edge. `rangeDays` = 5 / 30 / 182. |
| **1Y** | Drop Yahoo's prepended fake anchor bar (a leading bar equal to `chartPreviousClose`), then first real close ~365 days back | Yahoo prepends a duplicate of prevClose; Google measures from the first *real* bar. |
| **5Y** | `chartPreviousClose` | Google measures from the weekly close just before the 5-year window = Yahoo's `chartPreviousClose`. |
| **YTD / Max** | First point of the series | Year start / inception. |
| fallback | First point | When a series is too short for the rule. |

**Verified values (against COMPOSITE:IDX):** 1Y baseline `7166.06` (−16.17% at the
verified time), 5Y `6095.50` (−1.44%). The app's `/api/quote` currently returns 1Y
baseline `7166.06`, confirming the rule.

### Known source divergences (documented, not bugs)

- **Max** — Yahoo's inception value (~636.40, 1990) differs from Google's (~688.52).
  This is a genuine upstream data difference; Max %-change can't be made identical
  without changing providers.
- **5D** — a small (~sub-1%) divergence can occur due to boundary snapping. Of the 8
  ranges, **1D was bit-verified** against Google screenshots; 1M/6M/YTD/1Y/5Y use the
  verified baseline rules; 5D and Max are the known-divergent pair.

---

## Stats derivation rules

In `YahooProvider.fetch()`:

- `open` = first **bar open** of 1D (not first close).
- `high`/`low` = `meta.regularMarketDayHigh/Low`, else **intrabar** max/min of 1D
  highs/lows.
- `prevClose` = `chartPreviousClose`.
- `week52High/Low` = max/min of the **1Y daily highs/lows** (using highs/lows, not
  closes, because closes understate extremes — this previously diverged from Google).
- All values rounded to 2 decimals.

---

## 1D session rendering rules (`SpectrumChart.tsx`)

- **Lunch-break gap:** IDX has a midday session break. 1D points are split into
  contiguous **segments** (`computeSegments`); the chart draws each segment along its
  real points and leaves a visible gap (no line drawn across the break).
- **Time-scaled x-axis:** `xOfT` maps timestamps so spacing is time-proportional
  within sessions.
- **Previous-close reference line:** in 1D the prior close is drawn as a reference.

---

## "Sings the melody" rules (`useLiveTicker` in `App.tsx`)

- **Pitch ↔ price mapping:** detected note pitch (spectral centroid, adaptively
  normalized via tracked `pMin`/`pMax` + an S-curve) maps to a level `∈ [0,1]`; the
  headline value = `min1D + level × (max1D − min1D)` (clamped to the 1D series range).
- **Onset gating:** spectral flux over the melodic band must exceed an adaptive
  threshold (`mean + 1.25·std + floor`), be re-armed below `mean + 0.4·std`, and
  respect a 105 ms minimum gap — so the number snaps on note onsets, not noise.
- **YouTube fallback:** synthetic 8th notes at **118 BPM** (the same tempo the
  synthetic spectrum pulses on) since cross-origin audio can't be analyzed.
- **Change basis during playback:** measured against the **1D baseline**, with the
  "today" label, regardless of the selected range.

---

## Spectrum synthesis rules (`audio/spectrum.ts` → `idleFreq`)

Used when there's no analyser (YouTube). Models a real music spectrum: a **bass kick**
each beat + **snare** on the off-beat at ~118 BPM, over a bass-weighted shape, plus
fast value-noise per bin so bins flicker independently like a real readout. Frozen
when `animT` is constant (i.e., not playing) → satisfies invariant #2.

---

## Data freshness rules

| Layer | Rule |
|---|---|
| Browser poll | Every 10 s (`POLL_MS`). |
| Worker serve | Return KV if < 60 s old (`FRESH_MS`), else rebuild. |
| Cron refresh | Every 5 min (`*/5 * * * *`). |
| KV TTL | 600 s. |
| Upstream edge cache | Yahoo `cacheTtl 30 s`; News `cacheTtl 120 s`. |
| Never cache | `/api/*` responses (`cache-control: no-store`, SW `NetworkOnly`). |

---

## Localization / formatting rules

- Default language **id** (Indonesian); **en** available; persisted.
- Numbers via `Intl.toLocaleString(T.locale, { 2 dp })`.
- Tick labels generated server-side in **Asia/Jakarta** TZ; month names are English in
  the payload and localized in the view via `i18n.ts`.
