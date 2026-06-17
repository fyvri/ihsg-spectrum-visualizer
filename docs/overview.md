# 01 — Application Overview & Business Objectives

## What it is

The **IHSG Spectrum Visualizer** is a single-page web application (and installable
PWA) that presents the **IDX Composite (IHSG)** — the headline stock index of the
Indonesia Stock Exchange (Bursa Efek Indonesia / IDX) — as a **Google-Finance-style
quote page**, with one defining twist: the **price chart is rendered as a live audio
spectrum**, and the **headline price number "sings the melody"** of whatever music
the visitor plays.

- `IHSG` = *Indeks Harga Saham Gabungan* (Indonesian name).
- `IDX Composite` = the English name (the app's display symbol is `IDX: COMPOSITE`).
- Canonical reference page: Google Finance `COMPOSITE:IDX`.

## Business objectives

This is a **brand / art / engagement piece**, not a trading or brokerage product.
Its objectives:

1. **Showcase** — a memorable, shareable interpretation of a familiar financial page
   that demonstrates design + engineering craft (the brand footer links to the
   owner, default "Membasuh").
2. **Faithful data** — present *accurate* IDX Composite numbers that match Google
   Finance (COMPOSITE:IDX) so the page reads as a legitimate quote page, not a toy.
3. **Engagement via audio** — let visitors bring their own music (library, file, or
   YouTube) and watch the index "perform" it, then export and share a story image.
4. **Zero-friction reach** — public, anonymous, installable, offline-tolerant, and
   bilingual (Indonesian + English).

## Scope (what it does)

- Displays latest value, day open/high/low, previous close, and 52-week high/low.
- Renders the price series across **8 ranges**: 1D, 5D, 1M, 6M, YTD, 1Y, 5Y, Max.
- Computes the per-range change/%-change against a **Google-parity baseline**.
- Visualizes the chart as one of **5 spectrum models** that animate to music.
- Pulls **news headlines** (Google News RSS for "IHSG"/"IDX Composite").
- Exports a **1080×1920 Instagram-Story PNG** of the current (at-rest, real) quote.
- Persists user preferences and player state locally.

## Out of scope (what it deliberately does NOT do)

- No trading, portfolio, watchlist, alerts, or brokerage features.
- No user accounts, authentication, or personalization beyond local prefs.
- No analytics/telemetry of end users (no tracking code in the client).
- No real-time tick streaming — data is **polled** (~10 s client, refreshed ≤5 min
  server side via cron + ≤60 s on-demand).
- No reactive analysis of YouTube audio (cross-origin; see
  [07-business-logic](business-logic.md) and [09-integrations](integrations.md)).

## Target users / personas

| Persona | Need | How the app serves it |
|---|---|---|
| Casual Indonesian retail observer | Glance at "how's the IHSG today" | Familiar Google-Finance layout, ID default language |
| Social sharer | A cool image to post | Save/Share 1080×1920 story export |
| Music/visual tinkerer | Play music and watch it react | Library / file / YouTube + 5 spectrum models |
| Developer / maintainer | Extend or rebrand | Env-driven brand, swappable data provider, typed contract |

## Key product principle

> **The real numbers are sacred.** Music animates the *visualization* and the
> *live* headline ticker, but every "official" artifact (the Save-Image export,
> `window.IHSG_still`) uses the **real quote at rest**. The visualizer never
> fabricates or persists a fake price. See the
> [product invariants](business-logic.md#product-invariants-non-negotiables).

## Glossary

| Term | Meaning |
|---|---|
| IHSG / IDX Composite | The index this app visualizes |
| Range | One of the 8 time windows (1D…Max) |
| Baseline | The reference close a range's % change is measured from |
| Spectrum model | One of BASS / MID / FULL / WAVE / MAX rendering styles |
| "Sings the melody" | The headline number snapping to detected musical onsets |
| Still / at-rest | The non-animated render used for exports and when no music plays |
| Empty data | Zeroed cold-start dataset (value 0, blank chart, `news: []`) shown until the first live quote arrives. The News section still renders a built-in fallback list (see [F8](features.md#f8--news)). |
| Provider | Server-side data source implementing `IhsgProvider` (default: Yahoo) |
