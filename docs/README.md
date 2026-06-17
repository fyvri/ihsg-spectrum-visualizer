# IHSG Spectrum Visualizer — Documentation

As-is documentation reflecting the **current implementation** (not planned features).
This is the single source of truth for development, maintenance, and onboarding.

## Documents

| # | Document | Contents |
|---|---|---|
| — | [README](../README.md) | Quick-start, commands, top-level overview |
| 01 | [Overview](overview.md) | Business objectives, scope, personas, glossary |
| 02 | [Architecture](architecture.md) | System & component diagrams, runtime data flow |
| 03 | [Project structure](project-structure.md) | Every folder & module explained |
| 04 | [Tech stack](tech-stack.md) | Frameworks, libraries, dependencies & rationale |
| 05 | [Features](features.md) | Feature docs, workflows, implementation details |
| 06 | [Data & API](data-and-api.md) | Data model, KV "schema", `/api/quote` reference |
| 07 | [Business logic](business-logic.md) | Baselines, product invariants, domain rules |
| 08 | [Configuration](configuration.md) | Env vars, build/runtime/PWA config |
| 09 | [Integrations](integrations.md) | Yahoo Finance, Google News, YouTube |
| 10 | [Observability & errors](observability-and-errors.md) | Logging, monitoring, error handling |
| 11 | [Deployment](deployment.md) | Infrastructure, environments, procedure |
| 12 | [Development](development.md) | Local setup, debugging, testing |
| 13 | [Limitations & tech debt](limitations-and-tech-debt.md) | Known issues, constraints |
| 14 | [ADRs](adr.md) | Architecture Decision Records |
| 15 | [Security](security.md) | Threat model, posture, hardening recommendations |

## How to read this

- **New developer onboarding:** README → 01 → 02 → 03 → 12.
- **Working on data/quotes:** 06 → 07 → 09.
- **Working on the visualizer/audio:** 05 → 02 (audio flow) → 03 (`src/audio`, `SpectrumChart`).
- **Deploying:** 08 → 11.
- **AI-assisted development:** every doc cites concrete file paths and the exact
  behavior in code, so retrieval points you straight at the implementation.

## Authentication & authorization — at a glance

**There is none.** The app is fully public, read-only, and anonymous. There are no
users, roles, permissions, sessions, tokens, login, or sign-up. The only "API"
(`/api/quote`) is an unauthenticated public `GET`. This is by design (a public quote
page). See [06-data-and-api](data-and-api.md#authentication--authorization) and
[10-observability-and-errors](observability-and-errors.md).

## Database — at a glance

There is **no relational/SQL or document database**. The only persistence is:

1. **Cloudflare KV** — a single key (`ihsg:data:v1`) holding one JSON snapshot
   (server side). See [06-data-and-api](data-and-api.md#cloudflare-kv-store).
2. **Browser `localStorage`** — user prefs and player state (client side). See
   [06-data-and-api](data-and-api.md#client-side-persistence-localstorage).

There are **no migrations** (KV is a schema-less snapshot keyed by a version suffix
`v1`; bumping the suffix is the "migration" mechanism).

## Open questions / missing information

These items are **not determinable from the codebase** and need an owner decision.
Documentation marks them clearly rather than inventing answers.

| # | Question | Why it matters | Current state in repo |
|---|---|---|---|
| Q1 | **Production domain & Cloudflare account/Worker name** | Deploy target | `VITE_SITE_URL` defaults to `ihsg.membasuh.com`; Worker name `ihsg-spectrum-visualizer`. Confirm these are the real production values. |
| ~~Q2~~ | ~~KV namespace id~~ | — | ✅ **Resolved:** KV is now **optional** and unbound by default (zero-config forks). Bind `IHSG_KV` only to enable caching (see [11](deployment.md)). |
| ~~Q3~~ | ~~Music licensing for the bundled tracks~~ | — | ✅ **Resolved:** no audio is committed — `public/audio/` is git-ignored (bring-your-own). See `public/audio/README.md` + LICENSE scope note. |
| Q4 | **Desired automated test strategy** | None exists today | No test runner configured. |

> If you can answer any of these, update the relevant doc and remove the row.
