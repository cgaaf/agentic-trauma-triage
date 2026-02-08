# Trauma Triage Agent — Specification

## 1. Overview

The Trauma Triage Agent is a web-based decision-support tool that takes a free-text EMS trauma report as input and determines a trauma activation level. It uses a hybrid approach: deterministic evaluation for numeric vital sign criteria and LLM-based reasoning for mechanism-of-injury and anatomical injury criteria.

The agent processes input in a single-shot flow — the user submits an EMS report and receives a complete triage evaluation. There is no multi-turn conversation.

### Activation Levels

| Level           | Severity                   | Color  |
| --------------- | -------------------------- | ------ |
| Level 1         | Critical activation        | Red    |
| Level 2         | High-priority activation   | Orange |
| Level 3         | Moderate activation        | Yellow |
| Standard Triage | No activation criteria met | Gray   |

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
- **Data**: All 137 criteria hardcoded in a typed TypeScript file (`src/lib/server/criteria/criteria.ts`). The `trauma-criteria.csv` remains as the medical team's reference document but is not imported by the application
- **Package Manager**: pnpm

See `IMPLEMENTATION.md` for the complete file structure, component hierarchy, and implementation order.

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
- RR thresholds (< 10, > 29) — adult only (IDs 4, 5); no RR criteria exist for pediatric or geriatric patients

**Hybrid criteria (numeric + qualitative):**

- Adult: HR > 100 AND poor perfusion (id 2)
- Geriatric: HR > 90 AND poor perfusion (id 100)
- Pediatric tachycardia (id 47): classified as LLM-only because "associated tachycardia" lacks a specific numeric threshold in the CSV (pediatric tachycardia thresholds vary by age)

### Phase 2b: LLM Evaluation (Sonnet, Parallel)

Runs in parallel with the deterministic engine. Uses Claude Sonnet 4.5 with `tool_use`.

**Input to the LLM:**

- The extracted fields from Phase 1
- A pre-filtered subset of criteria: only age-appropriate, LLM-only criteria (mechanism, injury, burn, etc.)
- All hybrid criteria (the full criterion definitions, not results from Phase 2a — since 2a and 2b run in parallel, 2b independently evaluates the qualitative conditions such as "Is there poor perfusion?")

**Output format**: Structured JSON via `tool_use` containing:

- List of matched criteria with `criterion_id`, `confidence` (0-1), and `trigger_reason`
- Hybrid confirmations (whether qualitative conditions are met)
- Free-text `reasoning_narrative` explaining the evaluation logic

**Confidence scores** are retained in the data model for potential future use but are not displayed in the UI.

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

Criteria are defined as a typed array in `src/lib/server/criteria/criteria.ts`. Each criterion has the following fields:

| Field              | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `id`               | Unique criterion identifier                                          |
| `description`      | Human-readable criterion text                                        |
| `activationLevel`  | Level 1, Level 2, or Level 3                                         |
| `category`         | Adult, Pediatric, or Geriatric                                       |
| `ageMin`           | Minimum age (inclusive)                                              |
| `ageMax`           | Maximum age (inclusive), `null` for geriatric (open-ended)           |
| `evaluationMethod` | How the criterion is evaluated: `deterministic`, `hybrid`, or `llm`  |
| `vitalRule`        | (Optional) Numeric comparison rule for deterministic/hybrid criteria |

The `trauma-criteria.csv` remains in the repository as the medical team's reference document but is not imported by the application. VitalRules for deterministic and hybrid criteria are defined inline in the TypeScript file — no CSV parsing or natural-language extraction is needed.

### Age Categories

| Category  | General Range | Notes                                                     |
| --------- | ------------- | --------------------------------------------------------- |
| Adult     | 16-64         | L3 criteria start at 18                                   |
| Pediatric | 0-15          | L3 criteria extend to 17; SBP thresholds are age-specific |
| Geriatric | 65+           | Open-ended (no age_max)                                   |

### Age Filtering

- Filtering uses `age_min` and `age_max` per criterion row, NOT the broad category labels
- Ages are always integers
- Boundaries are inclusive: a patient matches if `age >= age_min AND (age_max is null OR age <= age_max)`
- Some criteria overlap at boundary ages (e.g., a 16-year-old matches Adult L1 criteria AND Pediatric L3 criteria)
- Pediatric SBP thresholds have narrow age ranges (e.g., SBP < 76 for age 3 only)

### Criteria Classification

Criteria are classified by their `evaluationMethod` field in the typed criteria array.

| Method            | Description                               | Examples                                                    |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------- |
| **Deterministic** | Pure numeric vital sign comparison        | GCS < 12, SBP < 90, RR < 10                                 |
| **Hybrid**        | Numeric check + qualitative condition     | HR > 100 AND poor perfusion                                 |
| **LLM-only**      | Requires clinical language interpretation | Penetrating injury to torso, fall > 15 ft, burns > 20% TBSA |

### Summary

- **137 total criteria** across 3 categories and 3 activation levels
- **20 deterministic criteria** (vital sign thresholds: GCS, SBP, RR)
- **2 hybrid criteria** (HR + qualitative perfusion assessment)
- **115 LLM-only criteria** (mechanism, injury, burn, procedural)

Classification principle: deterministic and hybrid criteria use the structured vital sign fields extracted in Phase 1 (GCS, SBP, HR, RR). Criteria with other numeric values in their description (fall height, vehicle speed, TBSA%) are LLM-only because those values are not extracted as structured fields.

### Criteria Classification Map

This table summarizes the deterministic and hybrid criteria. The typed criteria array in `src/lib/server/criteria/criteria.ts` is authoritative.

#### Deterministic Criteria (20 total)

| ID  | Category     | Rule            | Notes      |
| --- | ------------ | --------------- | ---------- |
| 1   | Adult L1     | GCS < 12        |            |
| 3   | Adult L1     | SBP < 90        |            |
| 4   | Adult L1     | RR < 10         | Adult only |
| 5   | Adult L1     | RR > 29         | Adult only |
| 26  | Adult L2     | GCS == 12 or 13 |            |
| 46  | Pediatric L1 | GCS < 12        |            |
| 48  | Pediatric L1 | SBP < 70        | age 0-1    |
| 49  | Pediatric L1 | SBP < 74        | age 2      |
| 50  | Pediatric L1 | SBP < 76        | age 3      |
| 51  | Pediatric L1 | SBP < 78        | age 4      |
| 52  | Pediatric L1 | SBP < 80        | age 5      |
| 53  | Pediatric L1 | SBP < 82        | age 6      |
| 54  | Pediatric L1 | SBP < 84        | age 7      |
| 55  | Pediatric L1 | SBP < 86        | age 8      |
| 56  | Pediatric L1 | SBP < 88        | age 9      |
| 57  | Pediatric L1 | SBP <= 90       | age 10-15  |
| 78  | Pediatric L2 | GCS == 12 or 13 |            |
| 99  | Geriatric L1 | GCS < 12        |            |
| 101 | Geriatric L1 | SBP < 110       |            |
| 123 | Geriatric L2 | GCS == 12 or 13 |            |

#### Hybrid Criteria (2 total)

| ID  | Category     | Numeric Rule | Qualitative Condition |
| --- | ------------ | ------------ | --------------------- |
| 2   | Adult L1     | HR > 100     | AND poor perfusion    |
| 100 | Geriatric L1 | HR > 90      | AND poor perfusion    |

Note: Pediatric tachycardia (ID 47) is classified as **LLM-only** because "associated tachycardia" lacks a specific numeric HR threshold (pediatric tachycardia thresholds vary by age).

#### LLM-Only Criteria (115 total)

All remaining criteria. Includes mechanism of injury, anatomical injuries, burns, procedural criteria, and criteria with non-vital-sign numeric values (fall height, vehicle speed, TBSA percentage).

---

## 5. API Contract

### Endpoint

`POST /api/triage`

### Request

Content-Type: `application/json`

```json
{ "report": "string" }
```

The `report` field contains the free-text EMS narrative.

### Response

Content-Type: `text/event-stream`

The server responds with a Server-Sent Events stream. Each event has a `type` field that the client uses to update the UI progressively.

### SSE Event Types

| Event Type       | Payload                                                                                 | When Sent                         |
| ---------------- | --------------------------------------------------------------------------------------- | --------------------------------- |
| `phase`          | `{ phase: 'extracting' \| 'evaluating_vitals' \| 'analyzing_mechanism' \| 'complete' }` | At each pipeline stage transition |
| `extraction`     | `{ data: ExtractedFields, warnings: PlausibilityWarning[] }`                            | After Phase 1 completes           |
| `deterministic`  | `{ matches: CriterionMatch[] }`                                                         | After Phase 2a completes          |
| `llm_evaluation` | `{ matches: CriterionMatch[], reasoning: string }`                                      | After Phase 2b completes          |
| `result`         | `{ data: EvaluationResult }`                                                            | After Phase 3 merge               |
| `error`          | `{ message: string, phase: string, canRetry: boolean }`                                 | On any pipeline failure           |

### SSE Wire Format

Standard SSE format. Each event is:

```
data: {"type":"<event_type>",...}\n\n
```

### Error Behavior

If the LLM fails after deterministic results are available, the `error` event includes `canRetry: true` and previously-sent deterministic results remain valid on the client.

---

## 6. Input

### Interface

- **Primary input**: Large textarea for free-text EMS narrative
- **Format**: Format-agnostic — accepts any writing style (MIST, SOAP, free-form narrative, etc.)
- **Placeholder text**: "Describe the patient, their vitals, and what happened..."
- **Submission**: Icon-only send button (circular, bottom-right of textarea) with screen-reader-accessible "Evaluate" label + Ctrl/Cmd+Enter keyboard shortcut. The chat-like input paradigm keeps the interface clean and modern.

### Progressive Disclosure Helper

Two collapsible sections below the textarea provide guidance without cluttering the initial view:

1. **"What to include"** — Badge chips listing: Age (marked required), SBP, HR, RR, GCS, Airway, Breathing, Mechanism, Injuries
2. **"How does this work?"** — A 3-column icon grid explaining the pipeline phases (extraction, evaluation, results)

Both sections are collapsed by default, reducing visual noise for experienced users while remaining discoverable for new users.

### Validation

- **Age gate**: Submission is blocked if the extraction step cannot identify the patient's age. An error message asks for more detail.
- **Relevance gate**: If the input is not a trauma/EMS report, an error is shown without running evaluation.
- **No other blocking validation**: Missing fields (SBP, HR, etc.) trigger warnings but do not block submission.

### No Speech Input (MVP)

Speech-to-text input via microphone is deferred to a future phase.

### No Example Reports

No pre-built example reports or templates. The progressive disclosure helper provides sufficient guidance.

---

## 7. Output

### Phased Reveal

Results appear progressively as each pipeline phase completes:

1. **Deterministic results appear first** (fast, no LLM latency)
2. **LLM results stream in after** (as Sonnet generates its evaluation)

This highlights the parallel evaluation and gives the user useful information quickly.

### Progress Steps Indicator

A 3-step progress indicator shown during processing:

1. "Extracting details..." (Phase 1)
2. "Evaluating vitals..." (Phase 2a)
3. "Analyzing mechanism & injuries..." (Phase 2b)

Each step shows: spinner (active), checkmark (done), or gray circle (pending). There is no explicit "Complete" step — instead, the progress steps auto-hide with a slide transition 1 second after the final phase completes. The ActivationCard appearing below serves as the clear completion signal.

### Extracted Data

A two-zone display of all extracted fields using a three-state chip design:

**Chip states:**
- **Present**: Neutral muted border, bold monospace value + unit (e.g., `88 mmHg`, `12`)
- **Warning**: Amber border + inline AlertTriangle icon (for out-of-range values)
- **Missing**: Dashed border + em-dash (—)

**Layout zones:**
1. **Vital Signs** — 5 horizontal flex-wrap chips: Age, SBP, HR, RR, GCS
2. **Clinical Details** — 2-column responsive grid (1 column on mobile): Airway, Breathing, Mechanism, Injuries

**Additional Context** — When present, shown as a collapsible section below the clinical details grid (collapsed by default). Uses progressive disclosure to avoid cluttering the primary data view.

**Plausibility warnings** and **missing field warnings** are consolidated into a single amber-bordered section below the extracted data. Warning chips also display an inline AlertTriangle icon for at-a-glance identification.

Plausibility ranges:

- Age: 0-120
- SBP: 20-300 mmHg
- HR: 20-300 bpm
- RR: 0-80 breaths/min
- GCS: 3-15

### Criteria Matches — Two-Component Split

Matched criteria are displayed across two components that create a clear visual hierarchy:

#### ActivationCard (Primary)

A prominent, color-coded card showing **only the winning activation level** and its matched criteria:

| Level           | Color  | Label              |
| --------------- | ------ | ------------------ |
| Level 1         | Red    | "LEVEL 1"          |
| Level 2         | Orange | "LEVEL 2"          |
| Level 3         | Yellow | "LEVEL 3"          |
| Standard Triage | Gray   | "STANDARD TRIAGE"  |

The card includes:
- Level name in large, bold monospace text
- Category and age range labels (e.g., "Adult (≥15 years)")
- Criteria count
- List of matched criteria descriptions in a bordered sub-section

**Progressive disclosure:** A "Show details" toggle reveals:
- Trigger reasons for each criterion (what caused the match)
- Justification summary explaining why this level was recommended
- Agent reasoning showing the LLM's step-by-step evaluation logic

This consolidation of justification and agent reasoning into a single expand section reduces interaction complexity compared to multiple separate expanders.

#### AdditionalCriteria (Secondary)

A secondary, dashed-border card showing all **other matched criteria** from levels below the winning level. Grouped by activation level. Only rendered when additional matches exist.

### Warnings

All plausibility warnings and missing-field warnings are consolidated in the Extracted Data section. This avoids repetition across multiple sections while the inline AlertTriangle icons on individual chips provide at-a-glance field-level indication.

### Disclaimer

Minimal footer text: _"This is a decision-support tool. Clinical judgment should always take precedence."_

---

## 8. UI/UX

### Layout

- **Single page with vertical scroll**
- Input section at top, results below
- No separate routes for results or history

### Initial State

Before any triage is submitted, the page shows a minimal, centered layout:

- **"Enter your report."** heading as a clear call to action
- The textarea input with placeholder text
- Collapsible helper sections below (see Section 6)

This avoids overwhelming first-time users while keeping all guidance accessible via progressive disclosure.

### Header

Minimal header bar containing:

- **App name**: "Trauma Triage Agent"
- **New Triage button**: Stethoscope icon + "New Triage" label, appears only after triage completes (see New Triage Behavior)
- **Dark mode toggle**: Sun/moon icon (using mode-watcher)
- **History button**: Clock icon that opens a drawer (future phase — not currently displayed)
- **Mock mode indicator**: Purple badge showing "MOCK MODE" when active

### Visual Tone

**High-contrast emergency design** optimized for quick scanning in stressful environments:

- Bold colors for activation levels
- Large text for critical information (activation level uses extra-large, heavy font weight)
- High contrast ratios
- Full colored borders on activation cards (uniform border on all sides)
- Clear visual hierarchy

### Responsive Design

Full responsive design supporting all form factors equally:

- Mobile (375px+)
- Tablet (768px+)
- Desktop (1280px+)

### Dark Mode

Both light and dark modes supported with a toggle. Uses mode-watcher (already installed). Emergency colors have separate light/dark variants.

### New Triage Behavior

After triage completes, a "New Triage" button (with stethoscope icon) appears in the header bar, always visible regardless of scroll position. Clicking it:

1. Resets the triage state to idle
2. Clears the report text
3. Returns the user to the centered input view

The button is only visible when a triage is complete (not during processing or on the idle screen). Previous results are discarded (auto-save to browser history is a future phase feature).

### Accessibility

Basic semantic HTML for the MVP. No WCAG AA compliance requirement yet.

---

## 9. Error Handling

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

## 10. Mock Mode

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

## 11. MVP Scope

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

## 12. Key Types

### Criterion

All 137 criteria are hardcoded in a typed TypeScript array and exported as both a `Criterion[]` array and a `Map<number, Criterion>` keyed by criterion ID (for O(1) lookup during merge/dedup and hybrid confirmation).

```
id: number
description: string
activationLevel: 'Level 1' | 'Level 2' | 'Level 3'
category: 'Adult' | 'Pediatric' | 'Geriatric'
ageRangeLabel: string           // Human-readable: "16 - 64", "0 - 15", "> 64"
ageMin: number
ageMax: number | null           // null = open-ended (geriatric)
evaluationMethod: 'deterministic' | 'hybrid' | 'llm'
vitalRule?: VitalRule           // Only present for deterministic/hybrid criteria
```

### VitalRule (numeric comparison for deterministic/hybrid criteria)

```
field: 'gcs' | 'sbp' | 'rr' | 'hr'
operator: '<' | '<=' | '>' | '>=' | '==' | 'range'
threshold: number
thresholdHigh?: number          // For range checks (e.g., GCS 12 or 13)
requiresLlmConfirmation?: string // Qualitative condition for hybrid (e.g., "poor perfusion")
```

The `vitalRule` is defined inline in the typed criteria array for deterministic and hybrid criteria (e.g., `{ field: 'gcs', operator: '<', threshold: 12 }`).

### ExtractedFields (Phase 1 output)

```
age: number | null
sbp: number | null
hr: number | null
rr: number | null
gcs: number | null
airwayStatus: string | null
breathingStatus: string | null
mechanism: string | null
injuries: string[] | null
additionalContext: string | null
```

### CriterionMatch (Phase 2 output)

```
criterionId: number
description: string
activationLevel: 'Level 1' | 'Level 2' | 'Level 3'
category: 'Adult' | 'Pediatric' | 'Geriatric'  // For display grouping (subheader)
ageRangeLabel: string           // For display grouping (e.g., "16 - 64")
source: 'deterministic' | 'llm' // Present in data model but not displayed in UI
confidence?: number             // 0-1, LLM-sourced only; present in data model but not displayed in UI
triggerReason: string           // e.g., "GCS = 8 < 12"; shown via progressive disclosure toggle
```

### EvaluationResult (Phase 3 output / final result)

```
extractedFields: ExtractedFields
plausibilityWarnings: PlausibilityWarning[]
criteriaMatches: CriterionMatch[]
activationLevel: 'Level 1' | 'Level 2' | 'Level 3' | 'Standard Triage'
justification: string
agentReasoning: string
missingFieldWarnings: string[]
```

---

## 13. Future Phases

### Phase 2: History & Re-evaluate

- **Browser-local history**: Save triage results in localStorage. Accessible via a history drawer from the header. Simple list showing timestamp + activation level. Click to restore full results.
- **Editable recognized inputs**: Users can correct extracted values in the recognized inputs pane, then click a "Re-evaluate" button.
- **Smart re-run logic**:
  - Vital sign change → re-run deterministic engine only
  - Mechanism/injury change → re-run LLM evaluation only
  - Age change → re-run everything (age affects criteria filtering)

### Phase 3: Speech, Rate Limiting & Polish

- **Speech input**: OpenAI `gpt-4o-transcribe` via the Transcription API (`/v1/audio/transcriptions`) with push-to-talk and `stream=true` for real-time text output. Medical terminology prompting (e.g., "EMS trauma report with terms like GCS, SBP, intubation, pneumothorax, TBSA") improves clinical accuracy. Future enhancement: Realtime API WebSocket streaming with built-in noise reduction for noisy field environments.
- **Basic rate limiting**: 10 requests/minute per IP to prevent abuse
- **Print/export**: Print-friendly CSS or PDF export
- **Enhanced accessibility**: WCAG 2.1 AA compliance, screen reader support, keyboard navigation improvements
