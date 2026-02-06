# Trauma Triage Agent — Specification

## 1. Overview

The Trauma Triage Agent is a web-based decision-support tool that takes a free-text EMS trauma report as input and determines a trauma activation level. It uses a hybrid approach: deterministic evaluation for numeric vital sign criteria and LLM-based reasoning for mechanism-of-injury and anatomical injury criteria.

The agent processes input in a single-shot flow — the user submits an EMS report and receives a complete triage evaluation. There is no multi-turn conversation.

### Activation Levels

| Level | Severity | Color |
|---|---|---|
| Level 1 | Critical activation | Red |
| Level 2 | High-priority activation | Orange |
| Level 3 | Moderate activation | Yellow |
| Standard Triage | No activation criteria met | Gray |

When multiple activation levels are triggered, the highest level wins. If no criteria are met, the default outcome is "Standard Triage."

---

## 2. Architecture

### Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5
- **Styling**: Tailwind CSS 4 with shadcn-svelte component library
- **LLM Provider**: Anthropic Claude
  - **Extraction**: Claude Haiku 4.5 (fast, cost-efficient for field extraction)
  - **Evaluation**: Claude Sonnet 4.5 (stronger reasoning for clinical criteria matching)
- **Server**: SvelteKit server routes (`+server.ts`) — API keys stay server-side
- **Streaming**: Server-Sent Events (SSE) for real-time result delivery
- **API Key**: `ANTHROPIC_API_KEY` environment variable
- **Package Manager**: pnpm

### High-Level Data Flow

```
User submits EMS report
       │
       ▼
┌──────────────────────┐
│  Phase 1: Extraction │  (Haiku)
│  Extract structured   │
│  fields from text     │
│  + validate relevance │
│  + validate age       │
└──────────┬───────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐ ┌────────────────┐
│ Phase 2a │ │   Phase 2b     │
│ Determ-  │ │ LLM Evaluation │ (Sonnet)
│ inistic  │ │ Mechanism &    │
│ Engine   │ │ Injury Criteria│
│ (vitals) │ │ + confidence   │
└────┬─────┘ └──────┬─────────┘
     │               │
     └───────┬───────┘
             ▼
   ┌─────────────────┐
   │  Phase 3: Merge │
   │  Highest level   │
   │  wins            │
   └─────────────────┘
             │
             ▼
      Streamed Results
      via SSE
```

---

## 3. Pipeline Flow

### Phase 1: Extraction (Haiku)

A single LLM call using Claude Haiku 4.5 with `tool_use` to extract structured fields from the free-text report.

**Extracted Fields:**
- `age` (integer, absolutely required)
- `sbp` (Systolic Blood Pressure, mmHg)
- `hr` (Heart Rate, bpm)
- `rr` (Respiratory Rate, breaths/min)
- `gcs` (Glasgow Coma Scale, 3-15)
- `airwayStatus` (text description)
- `breathingStatus` (text description)
- `mechanism` (mechanism of injury description)
- `injuries` (list of identified injuries)
- `additionalContext` (other relevant clinical context)

**Validation Gates:**
1. **Relevance check**: The extraction step determines if the input is actually a trauma/EMS report. If the user submits something irrelevant (e.g., "order a cheeseburger"), return an error without proceeding to evaluation.
2. **Age gate**: If age cannot be extracted, return an error. Age is absolutely required — triage is rejected without it.

**Output format**: Structured JSON via Claude's `tool_use` feature (forced tool call).

### Phase 2a: Deterministic Engine (Parallel)

Runs immediately after extraction completes. Evaluates all numeric vital-sign criteria deterministically.

**Process:**
1. Filter the criteria database by the patient's age using `age_min` and `age_max` columns (inclusive boundaries, integer ages)
2. Select only deterministic and hybrid criteria from the filtered set
3. For each deterministic criterion: compare the extracted vital sign value against the threshold
4. For hybrid criteria (e.g., "HR > 100 AND poor perfusion"): check the numeric portion; if it matches, flag for LLM confirmation of the qualitative part
5. Return matched criteria with trigger reasons

**Criteria evaluated deterministically:**
- GCS thresholds (< 12, == 12 or 13)
- SBP thresholds (varies by age — Adult < 90, Geriatric < 110, Pediatric age-specific from 70-90 mmHg)
- RR thresholds (< 10, > 29)

**Hybrid criteria (numeric + qualitative):**
- Adult: HR > 100 AND poor perfusion (id 2)
- Geriatric: HR > 90 AND poor perfusion (id 100)
- Pediatric tachycardia (id 47): classified as LLM-only because "associated tachycardia" lacks a specific numeric threshold in the CSV (pediatric tachycardia thresholds vary by age)

### Phase 2b: LLM Evaluation (Sonnet, Parallel)

Runs in parallel with the deterministic engine. Uses Claude Sonnet 4.5 with `tool_use`.

**Input to the LLM:**
- The extracted fields from Phase 1
- A pre-filtered subset of criteria: only age-appropriate, LLM-only criteria (mechanism, injury, burn, etc.)
- Any hybrid criteria needing qualitative confirmation from Phase 2a

**Output format**: Structured JSON via `tool_use` containing:
- List of matched criteria with `criterion_id`, `confidence` (0-1), and `trigger_reason`
- Hybrid confirmations (whether qualitative conditions are met)
- Free-text `reasoning_narrative` explaining the evaluation logic

**Confidence scores** are displayed to the user for LLM-evaluated criteria.

### Phase 3: Merge

Combines results from both parallel evaluations:
1. Promote hybrid criteria where the LLM confirmed the qualitative part
2. Combine deterministic + confirmed hybrid + LLM matches
3. Deduplicate by criterion ID
4. Determine the final activation level: highest level among all matches wins
5. If no criteria matched: "Standard Triage"

---

## 4. Criteria

### Data Source

Criteria are stored in `trauma-criteria.csv` with the following columns:

| Column | Description |
|---|---|
| `description` | Human-readable criterion text |
| `id` | Unique criterion identifier |
| `activation_level` | Level 1, Level 2, or Level 3 |
| `category` | Adult, Pediatric, or Geriatric |
| `Age Range` | Human-readable age range label |
| `age_min` | Minimum age (inclusive) |
| `age_max` | Maximum age (inclusive), empty for geriatric (open-ended) |

### Age Categories

| Category | General Range | Notes |
|---|---|---|
| Adult | 16-64 | L3 criteria start at 18 |
| Pediatric | 0-15 | L3 criteria extend to 17; SBP thresholds are age-specific |
| Geriatric | 65+ | Open-ended (no age_max) |

### Age Filtering

- Filtering uses `age_min` and `age_max` per criterion row, NOT the broad category labels
- Ages are always integers
- Boundaries are inclusive: a patient matches if `age >= age_min AND (age_max is null OR age <= age_max)`
- Some criteria overlap at boundary ages (e.g., a 16-year-old matches Adult L1 criteria AND Pediatric L3 criteria)
- Pediatric SBP thresholds have narrow age ranges (e.g., SBP < 76 for age 3 only)

### Criteria Classification

Criteria are classified by evaluation method:

| Method | Description | Examples |
|---|---|---|
| **Deterministic** | Pure numeric vital sign comparison | GCS < 12, SBP < 90, RR < 10 |
| **Hybrid** | Numeric check + qualitative condition | HR > 100 AND poor perfusion |
| **LLM-only** | Requires clinical language interpretation | Penetrating injury to torso, fall > 15 ft, burns > 20% TBSA |

### Summary

- **138 total criteria** across 3 categories and 3 activation levels
- ~8 deterministic criteria (vital sign thresholds)
- ~3 hybrid criteria (vital sign + qualitative)
- ~127 LLM-only criteria (mechanism, injury, burn, procedural)

---

## 5. Input

### Interface

- **Primary input**: Large textarea for free-text EMS narrative
- **Format**: Format-agnostic — accepts any writing style (MIST, SOAP, free-form narrative, etc.)
- **Submission**: "Evaluate" button + Ctrl/Cmd+Enter keyboard shortcut

### Helper Text

Displayed above the textarea, listing the information needed:

> **Required:** Age (triage will be rejected without it)
>
> **For complete triage, include:** Systolic Blood Pressure (SBP), Heart Rate (HR), Respiratory Rate (RR), Glasgow Coma Scale (GCS), Airway status, Breathing status, Mechanism of injury, Injuries

### Validation

- **Age gate**: Submission is blocked if the extraction step cannot identify the patient's age. An error message asks for more detail.
- **Relevance gate**: If the input is not a trauma/EMS report, an error is shown without running evaluation.
- **No other blocking validation**: Missing fields (SBP, HR, etc.) trigger warnings but do not block submission.

### No Speech Input (MVP)

Speech-to-text input via microphone is deferred to a future phase.

### No Example Reports

No pre-built example reports or templates. The helper text provides sufficient guidance.

---

## 6. Output

### Phased Reveal

Results appear progressively as each pipeline phase completes:

1. **Deterministic results appear first** (fast, no LLM latency)
2. **LLM results stream in after** (as Sonnet generates its evaluation)

This highlights the parallel evaluation and gives the user useful information quickly.

### Progress Steps Indicator

A multi-step progress indicator shown during processing:

1. "Extracting details..." (Phase 1)
2. "Evaluating vitals..." (Phase 2a)
3. "Analyzing mechanism & injuries..." (Phase 2b)
4. "Complete" (Phase 3)

Each step shows: spinner (active), checkmark (done), or gray circle (pending).

### Recognized Inputs

A checklist-style display of all expected fields:

- **Extracted fields**: Green checkmark icon + value with unit label (e.g., "120 mmHg", "14 GCS")
- **Missing fields**: Yellow warning icon + "Not provided"
- **Plausibility warnings**: Amber inline warning for out-of-range values (e.g., "SBP 300 is outside normal clinical range"). The value is still used for triage — warnings are informational, not blocking.

Plausibility ranges:
- Age: 0-120
- SBP: 20-300 mmHg
- HR: 20-300 bpm
- RR: 0-80 breaths/min
- GCS: 3-15

### Criteria Matches

Matched criteria displayed grouped by activation level:

- **Level 1** group (with red accent)
- **Level 2** group (with orange accent)
- **Level 3** group (with yellow accent)

Each matched criterion shows:
- Description text
- What triggered it (e.g., "GCS = 8 < 12" or "Penetrating wound to chest described in report")
- Confidence score (for LLM-evaluated criteria only, 0-1)
- Source indicator (deterministic vs. LLM)

### Activation Level Card

A prominent, color-coded card showing the recommended activation level:

| Level | Color | Label |
|---|---|---|
| Level 1 | Red | "LEVEL 1 — Critical Activation" |
| Level 2 | Orange | "LEVEL 2 — High-Priority Activation" |
| Level 3 | Yellow | "LEVEL 3 — Moderate Activation" |
| Standard Triage | Gray | "STANDARD TRIAGE — No Activation Criteria Met" |

The card includes a justification summary explaining why this level was recommended.

### Agent Reasoning

An expandable section (collapsed by default) showing the LLM's step-by-step evaluation reasoning. Provides transparency into how mechanism/injury criteria were assessed.

### Warnings

- **Inline per-section warnings**: Each results section shows contextual warnings if relevant inputs were missing (e.g., "Without SBP, blood pressure criteria cannot be fully evaluated")
- **No top-level banner**: Warnings are contextual, not global

### Disclaimer

Minimal footer text: *"This is a decision-support tool. Clinical judgment should always take precedence."*

---

## 7. UI/UX

### Layout

- **Single page with vertical scroll**
- Input section at top, results below
- No separate routes for results or history

### Initial State

Before any triage is submitted, the page shows a **welcome/instructional view** explaining:
- What the tool does
- How to use it
- What information to include in the report

### Header

Minimal header bar containing:
- **App name**: "Trauma Triage Agent"
- **Dark mode toggle**: Sun/moon icon (using mode-watcher)
- **History button**: Clock icon that opens a drawer (future phase)
- **Mock mode indicator**: Purple badge showing "MOCK MODE" when active

### Visual Tone

**High-contrast emergency design** optimized for quick scanning in stressful environments:
- Bold colors for activation levels
- Large text for critical information (activation level uses extra-large, heavy font weight)
- High contrast ratios
- Thick colored left borders on activation cards
- Clear visual hierarchy

### Responsive Design

Full responsive design supporting all form factors equally:
- Mobile (375px+)
- Tablet (768px+)
- Desktop (1280px+)

### Dark Mode

Both light and dark modes supported with a toggle. Uses mode-watcher (already installed). Emergency colors have separate light/dark variants.

### New Triage Behavior

When a user submits a new triage while results from a previous one are visible:
- New results replace the old ones immediately
- Previous results are auto-saved to browser history (future phase)

### Accessibility

Basic semantic HTML for the MVP. No WCAG AA compliance requirement yet.

---

## 8. Error Handling

### LLM Failure

If the Claude API call fails (rate limit, timeout, network error):
- Display the deterministic vital sign results that succeeded
- Show a clear error message explaining the LLM portion failed
- Provide a retry option for the LLM portion

### Invalid Input

- **Not a trauma report**: Error message — "This doesn't appear to be a trauma/EMS report."
- **Missing age**: Error message — "Age could not be determined from the report. Age is required for triage evaluation."

### Plausibility Warnings

Out-of-range values generate visual warnings but do NOT block evaluation. The value is still used for triage.

---

## 9. Mock Mode

### Activation

- **Auto-detect**: When `ANTHROPIC_API_KEY` is not set, mock mode activates automatically
- **Manual override**: Set `MOCK_MODE=true` in `.env` to force mock mode even when an API key exists
- Both conditions trigger mock mode

### Behavior

- **Deterministic engine runs for real** against the actual CSV criteria data
- **LLM calls are mocked**: Extraction uses regex-based field parsing; evaluation returns empty matches with a "mock mode" reasoning note
- **Simulated delays**: 500ms delay on mock LLM calls so the progress UI can be observed

### Visual Indicator

A purple "MOCK MODE" badge in the header when mock mode is active. Prevents confusion about whether results include real LLM analysis.

---

## 10. MVP Scope

### Included in MVP

- Core triage pipeline (input → extraction → parallel evaluation → results)
- Full UI (header, input, results display, progress indicator, all display components)
- Mock mode (auto-detect + env override)
- Dark mode toggle
- Unit tests for deterministic engine

### NOT Included in MVP

- Browser-local history (localStorage + drawer UI)
- Editable recognized inputs with "Re-evaluate" button
- Smart re-run logic (vitals→deterministic only, mechanism→LLM only, age→full re-run)
- Speech-to-text input
- Rate limiting
- Print/export functionality
- Enhanced accessibility (WCAG compliance)

---

## 11. Future Phases

### Phase 2: History & Re-evaluate

- **Browser-local history**: Save triage results in localStorage. Accessible via a history drawer from the header. Simple list showing timestamp + activation level. Click to restore full results.
- **Editable recognized inputs**: Users can correct extracted values in the recognized inputs pane, then click a "Re-evaluate" button.
- **Smart re-run logic**:
  - Vital sign change → re-run deterministic engine only
  - Mechanism/injury change → re-run LLM evaluation only
  - Age change → re-run everything (age affects criteria filtering)

### Phase 3: Speech, Rate Limiting & Polish

- **Speech input**: Web Speech API or Whisper API for voice-to-text EMS report entry
- **Basic rate limiting**: 10 requests/minute per IP to prevent abuse
- **Print/export**: Print-friendly CSS or PDF export
- **Enhanced accessibility**: WCAG 2.1 AA compliance, screen reader support, keyboard navigation improvements
