# Contributing to IHSG Spectrum Visualizer

Thanks for your interest in improving the project. This guide covers how to set up,
the standards we hold code to, and how to propose changes.

## Code of conduct

Be respectful and constructive. Assume good intent.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional brand overrides
npm run dev                  # web (Vite) + api (wrangler dev)
```

See [`docs/development.md`](docs/development.md) for the full local-setup, debugging,
and verification guide, and [`docs/README.md`](docs/README.md) for the documentation hub.

## Project principles

This is a deliberately **minimal-dependency** project (only `react` + `react-dom` at
runtime). Before adding a library, check whether a browser API or a small hand-written
helper does the job — that's the existing pattern for charting, audio, i18n, and image
export.

The product has **8 non-negotiable invariants** (e.g. the chart is the real price
data; it's still when no music plays; exports use the real quote). Read and preserve
them: [`docs/business-logic.md`](docs/business-logic.md#product-invariants-non-negotiables).

## Coding standards

- **TypeScript everywhere.** Keep `npm run typecheck` green (it runs both the app and
  the worker tsconfigs).
- **Style:** match surrounding code — 2-space indentation, double quotes, and
  descriptive block comments that explain the *why*, not the *what*.
- **`any` / `eslint-disable`:** only at genuinely untyped third-party seams (the
  YouTube IFrame API, `webkitAudioContext`). Follow the existing usages; don't
  introduce new ones casually.
- **Data shape changes** start in [`shared/types.ts`](shared/types.ts) — the single
  contract used by both the app and the Worker. Update it, then both sides.
- **No `StrictMode`** in `src/main.tsx` (a single `MediaElementSource` per `<audio>`
  must not be double-initialized). Don't re-enable it.
- **Don't commit secrets.** There are none today; all config is public `VITE_*` brand
  strings. Keep it that way.

## Commit / branch conventions

- Branch off the default branch; use short, descriptive branch names
  (e.g. `fix/1d-lunch-gap`, `feat/share-x`).
- Write clear, imperative commit messages ("Add …", "Fix …", "Refactor …").
- Keep changes focused; avoid mixing unrelated edits in one PR.

## Before opening a pull request

1. `npm run typecheck` — must pass.
2. `npm run build` — must succeed.
3. Manually verify the affected flow (see the checklist in
   [`docs/development.md`](docs/development.md#testing--verification)).
4. Update the relevant doc under [`docs/`](docs/README.md) if behavior changed.

> There is no automated test suite yet. If you're adding non-trivial logic, consider
> adding a test (Vitest fits the pure functions like `pickBaseline`, `parseYouTubeId`,
> `isValid`). See the testing notes in `docs/development.md`.

## Reporting issues

Include: what you did, what you expected, what happened, the browser/OS, and — for
data problems — the `/api/quote` response (or `npx wrangler tail` output). The app
intentionally swallows errors to stay usable, so the Network tab / Worker logs are
where real failures surface (see
[`docs/observability-and-errors.md`](docs/observability-and-errors.md)).

## License

By contributing, you agree that your contributions to the **source code** are licensed
under the [MIT License](LICENSE). Note the LICENSE scope note: bundled audio in
`public/audio/` and the "Membasuh" brand are **not** covered by MIT.
