# 13 — Module Dependencies, Limitations, Known Issues & Tech Debt

## Module dependency overview

```
shared/types.ts ─────────────┬──────────────▶ worker/index.ts
        (IhsgData contract)   └──────────────▶ src/data.ts
                                                   │ window.IHSG_DATA
src/main.tsx ─▶ src/App.tsx ◀──────────────────────┘
   │              │
   │              ├─▶ src/data.ts            (useIhsgData)
   │              ├─▶ src/audio/useAudioEngine.ts
   │              ├─▶ src/components/SpectrumChart.tsx ─▶ src/audio/spectrum.ts
   │              ├─▶ src/components/Player.tsx ─▶ useAudioEngine
   │              ├─▶ src/components/Settings.tsx ─▶ window.StoryImage
   │              ├─▶ src/components/Sections.tsx
   │              ├─▶ src/i18n.ts
   │              └─▶ src/config.ts          (VITE_* brand)
   └─▶ src/save-image.ts (side effect) ─▶ window.IHSG_still / IHSG_drawChartStill
```

- The **only** coupling between Worker and app is `shared/types.ts`.
- Imperative seams (`window.*`) couple React ↔ canvas/export (documented in
  [02-architecture](architecture.md#cross-cutting-globals-window)).
- `useAudioEngine.ts` imports `SONGS` from the build-time virtual module
  `virtual:song-library` (`vite-plugin-song-library.ts`), generated from
  `public/audio/` — a build-time edge, not a runtime import.

## Known limitations (inherent / by design)

| # | Limitation | Why | Status |
|---|---|---|---|
| L1 | **YouTube audio isn't analyzed** | Cross-origin audio taints the Web Audio analyser | By design; spectrum + headline are synthetic at 118 BPM |
| L2 | **Max range %-change differs from Google** | Yahoo inception ≠ Google inception | Documented source divergence |
| L3 | **5D can diverge slightly from Google** | Window-boundary snapping | Documented; sub-1% |
| L4 | **Yahoo v8 is an unofficial API** | No SLA; shape can change | Mitigated by stale-KV / empty-zero fallback + swappable provider |
| L5 | **News parsing is regex over RSS** | No XML parser dependency | Brittle to format changes; news is optional (`.catch([])`) |
| L6 | **Brand config is build-time** | `VITE_*` inlined by Vite | Rebuild required to change brand |
| L7 | **No StrictMode** | Single `MediaElementSource` per `<audio>` | Intentional; don't re-enable |

## Known issues / risks

| # | Issue | Impact | Action |
|---|---|---|---|
| I1 | KV (`IHSG_KV`) is unbound by default | No server-side cache → every request fetches the upstream live (more upstream calls, slightly higher latency) | Optional: bind a KV namespace to enable caching (see [11](deployment.md)) |
| I2 | Errors are swallowed app-wide | Silent staleness; hard to notice failures | Add Worker `console.error` / a health field |
| I3 | No tests | Regressions only caught by typecheck + manual QA | Add Vitest for pure fns; Playwright for flows |
| I4 | ~~No LICENSE / not a git repo~~ | ✅ **Resolved:** MIT `LICENSE` present. |
| I5 | ~~Bundled `public/audio/*.mp3` licensing~~ | ✅ **Resolved:** no audio is committed — `public/audio/` is git-ignored (bring-your-own). Deployers serving audio are responsible for rights. |

## Technical debt

| Item | Notes |
|---|---|
| **No automated tests** | Highest-value debt; pure functions are easy wins. |
| **`eslint-disable` without ESLint** | The disable comments document intent but no ESLint is installed; consider adding ESLint + `eslint-plugin-react-hooks` to make them real. |
| **`any` on third-party surfaces** | `window.YT`, `webkitAudioContext`, YT event types — acceptable but could use minimal typings. |
| **`SpectrumChart.tsx` size (~900 lines)** | Cohesive but large; could split paint helpers from the React shell if it grows. |
| **Single-env Wrangler config** | No staging environment; add `[env.*]` if needed. |
| **No CI** | Add a pipeline (typecheck/build/deploy). |

## Capacity / performance notes

- No audio ships with the repo (`public/audio/` is git-ignored). Any MP3s a
  deployer adds locally are **excluded from SW precache** (`globIgnores: audio/**`)
  and served CacheFirst at runtime; keep them under the 25 MiB Workers Assets
  per-file limit.
- `/api/quote` returns all 8 ranges in one payload (hundreds of points); this keeps
  range switching instant at the cost of a larger initial fetch (acceptable; gzipped).
