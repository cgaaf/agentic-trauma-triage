# Trauma Triage Agent

A research project exploring LLM-assisted trauma triage decision support. The agent takes free-text EMS trauma reports and determines a trauma activation level using a hybrid approach: deterministic evaluation for vital signs and LLM-based reasoning for mechanism-of-injury and anatomical criteria.

Built in collaboration between Clemson University Industrial Engineering and Anthropic.

## How It Works

1. **Extraction** — An LLM extracts structured fields (vitals, injuries, mechanisms) from the free-text report
2. **Deterministic Evaluation** — Vital sign criteria are evaluated against age-appropriate thresholds
3. **LLM Evaluation** — Mechanism-of-injury and anatomical injury criteria are evaluated with clinical reasoning
4. **Triage Decision** — Results are merged and the highest activation level is reported

Activation levels: **Level 1** (critical), **Level 2** (high-priority), **Level 3** (moderate), or **Standard Triage** (no criteria met).

## Documentation

- [`SPEC.md`](./SPEC.md) — Full product specification (architecture, data flow, criteria definitions)
- [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) — Technical implementation plan (file structure, component hierarchy, build order)

## Tech Stack

SvelteKit 2 + Svelte 5, Tailwind CSS 4, shadcn-svelte, Anthropic Claude (Haiku for extraction, Sonnet for evaluation), Zod for schema validation.

## Development

```sh
pnpm install
pnpm dev
```

Requires an `ANTHROPIC_API_KEY` environment variable (see `.env.example`).
For live speech-to-text input, also set `DEEPGRAM_API_KEY`.
