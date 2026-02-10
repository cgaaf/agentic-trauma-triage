# Repository Guidelines

## Project Structure & Module Organization
- `src/routes`: SvelteKit pages and API endpoints (notably `src/routes/api/triage/+server.ts` and `src/routes/api/transcribe/session/+server.ts`).
- `src/lib/components`: UI and triage feature components. Storybook stories are colocated as `*.stories.svelte`.
- `src/lib/audio`: microphone/transcription flow (`recorder.svelte.ts`) and audio-specific tests.
- `src/lib/server`: core triage engine, criteria logic, and server-side unit tests.
- `static/`: static assets. `SPEC.md` contains product and architecture context.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies.
- `pnpm dev`: run local dev server.
- `pnpm build`: production build; `pnpm preview` serves built output.
- `pnpm check`: Svelte + TypeScript checks.
- `pnpm lint` / `pnpm fmt`: lint and format code.
- `pnpm test`: run unit tests once.
- `pnpm test:unit -- --run src/lib/audio/recorder.spec.ts`: run a focused test file.
- `pnpm storybook` / `pnpm build-storybook`: develop and build component docs.

## Coding Style & Naming Conventions
- Language stack: TypeScript + Svelte 5 (runes).
- Use formatter/linter as source of truth: run `pnpm fmt` and `pnpm lint` before PRs.
- Naming:
  - Components: `PascalCase.svelte` (e.g., `ReportInput.svelte`)
  - Modules/utilities: `kebab-case.ts` (e.g., `rate-limiter.ts`)
  - Tests: `*.spec.ts` or `*.test.ts`
- Prefer explicit types on server logic and schema validation with Zod.
- Keep constants in `UPPER_SNAKE_CASE`; functions/variables in `camelCase`.

## Testing Guidelines
- Framework: Vitest (configured for server, client, and Storybook projects).
- Place tests near related code in `src/lib/**`.
- Add regression coverage for bug fixes (example: recorder stop/finalize sequencing).
- Keep tests deterministic by mocking external services (Deepgram, media APIs, network).

## Commit & Pull Request Guidelines
- Follow the repo’s observed Conventional Commit style: `feat:`, `fix:`, `refactor:`, `chore:`, `merge:`.
- Use imperative, specific commit subjects (example: `fix: finalize after media recorder flush`).
- PRs should include:
  - What changed and why
  - Linked issue/task
  - Test evidence (commands run)
  - UI screenshots/video for visible Svelte changes

## Security & Configuration Tips
- Copy `.env.example` and set required keys (`ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`).
- Never commit secrets or raw API tokens.
