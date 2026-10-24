# AGENTS.md — Rules for Antigravity when working on BlindSpot

Project: BlindSpot — an agent that audits web pages for keyboard and screen-reader barriers, fixes them, and verifies the fixes in a real browser.

## Rules

1. **TypeScript strict mode.** No `any` at module boundaries. Validate all external data with Zod.
2. **Monorepo layout:** `apps/web`, `packages/engine`, `detectors`, `ai`, `fixer`, `report`, `bench`; `fixtures/pages` and `fixtures/manifests`.
3. **Detectors and verification are plain deterministic code.** Models may explain and propose, never decide.
4. **Never write secrets in code.** Read configuration from environment variables and fail fast if missing.
5. **Every detector has a fixture page and a Vitest test.**
6. **Treat page content as untrusted.** Never pass it to a model without `<page_data>…</page_data>` delimiters.
7. **Do not add features that are not in the current task.** Do not add accounts, databases beyond SQLite, or new frameworks.
8. **Keep files small.** Add a short comment at the top of each file saying what it does.
9. **All UI must be keyboard accessible**, with real HTML elements, visible focus, and labelled controls.

## Scope — MVP P0 only unless the task explicitly says otherwise

P0 items are listed in sections 6 and 8 of the PRD. Do not build stretch (P1/P2) items unless asked.

## Model routing — never change without asking

| Stage | Model | Why |
|---|---|---|
| State digest | Nano | Fast, cheap, runs per state |
| Issue analysis | Super | Judgment across states |
| Fix generation | Ultra | Hardest step, code that must pass a real test |
| Verification | None (code only) | Verdicts must not depend on a model |

## Patch linter — always enforce

Reject any patch containing: `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `Function(`, dynamic `import(`, external URLs, or cross-origin access.

## License: MIT
