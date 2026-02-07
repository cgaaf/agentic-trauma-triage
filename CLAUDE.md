# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                             # Dev server at localhost:5173
pnpm build                           # Production build
pnpm check                           # Type check (svelte-kit sync + svelte-check-rs)
pnpm check:watch                     # Continuous type checking (uses svelte-check, not -rs)
pnpm lint                            # Lint with oxlint
pnpm lint:fix                        # Auto-fix lint issues
pnpm fmt                             # Format with oxfmt
pnpm fmt:check                       # Check formatting
pnpm test                            # Run all vitest projects once
pnpm vitest run --project server     # Quick server tests only (~47 tests)
pnpm storybook                       # Storybook dev on port 6006
```

## Architecture

SvelteKit 2 app that triages trauma patients by evaluating EMS narratives against 137 hardcoded medical criteria. Uses Claude API for NLP, with a deterministic engine for vital sign thresholds.

### Pipeline (SSE streaming via `POST /api/triage`)

1. **Extraction** (Haiku 4.5) — LLM extracts structured fields (age, vitals, injuries, mechanism) from free-text EMS report via forced tool call
2. **Deterministic eval** — Evaluates vital sign thresholds (20 criteria) synchronously
3. **LLM eval** (Sonnet 4.5) — Evaluates mechanism/injury criteria (115 LLM + 2 hybrid) via forced tool call, runs in parallel with step 2
4. **Merge** — Combines all matches; highest activation level wins (Level 1 > 2 > 3 > Standard Triage)

All phases stream as discriminated-union SSE events from `src/lib/server/pipeline.ts`. Gates: `isTraumaReport` (relevance) and `age` (required) checked after extraction.

### Mock Mode

Auto-enabled when `ANTHROPIC_API_KEY` is missing or placeholder. Uses regex-based extraction and fake evaluation results for development without API access.

### Key Source Locations

- **Criteria**: `src/lib/server/criteria/criteria.ts` — 137 criteria (20 deterministic, 2 hybrid, 115 LLM-only), each with activation level and age range
- **Pipeline**: `src/lib/server/pipeline.ts` — SSE async generator orchestrating all phases
- **Deterministic engine**: `src/lib/server/engine/deterministic.ts` — VitalRule-based threshold evaluation
- **LLM calls**: `src/lib/server/llm/` — extraction.ts (Haiku), evaluation.ts (Sonnet), prompts.ts (system prompts + tool schemas)
- **Merge logic**: `src/lib/server/engine/merge.ts` — combines results, determines activation level
- **Client state**: `src/lib/state/triage.svelte.ts` — Svelte 5 `$state` class pattern (not stores)
- **API route**: `src/routes/api/triage/+server.ts` — SSE POST endpoint
- **UI components**: `src/lib/components/triage/` — domain-specific components with Storybook stories

## Tech Stack & Patterns

- **Svelte 5 runes**: Use `$state` class pattern for state, `$derived` for computed values, `$props()` for component props. No stores.
- **shadcn-svelte v2**: Uses `child` snippet for composition, NOT `asChild` prop
- **mode-watcher**: Use `mode.current` (rune box), not `$mode`
- **Tailwind CSS 4**: oklch color space, class-based dark mode
- **Zod 4**: Schema validation for all data types (`src/lib/types/schemas.ts`)
- **Tooling**: oxlint (linting), oxfmt (formatting), svelte-check-rs (type checking) — all Rust-based
- **Package manager**: pnpm only (enforced via `.npmrc engine-strict`)

## Testing

Three vitest projects configured in `vite.config.ts`:

| Project | Environment | Includes | Purpose |
|---------|------------|----------|---------|
| `server` | Node | `*.{test,spec}.ts` (not `.svelte.*`) | Criteria integrity, deterministic engine, merge logic |
| `client` | Playwright/Chromium | `*.svelte.{test,spec}.ts` | Component tests |
| `storybook` | Playwright/Chromium | Stories via addon-vitest | Visual/interaction tests |

`requireAssertions: true` is enabled globally — every test must contain at least one assertion.

## Known Issues

Pre-existing TypeScript errors in shadcn-svelte generated code (chart-container, form-fieldset, sidebar-rail). These are upstream issues — ignore them during `pnpm check`.
