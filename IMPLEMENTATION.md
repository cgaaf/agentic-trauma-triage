# Trauma Triage Agent — Implementation Plan

This document describes the technical implementation plan for the Trauma Triage Agent. Refer to `SPEC.md` for the full product specification.

---

## 1. File Structure

### New Files

#### Types
```
src/lib/types/criteria.ts          — Criterion, ActivationLevel, AgeCategory, VitalRule, EvaluationMethod
src/lib/types/extraction.ts        — ExtractedFields, PlausibilityWarning
src/lib/types/evaluation.ts        — CriterionMatch, EvaluationResult, TriageOutcome
src/lib/types/sse.ts               — SSEEvent discriminated union
src/lib/types/index.ts             — Re-exports
```

#### Data Layer
```
src/lib/server/criteria/criteria.ts       — Hardcoded typed criteria array + Map (server-only)
src/lib/server/criteria/criteria.spec.ts  — Validation tests for criteria data integrity
```

#### Deterministic Engine
```
src/lib/server/engine/deterministic.ts       — Age filtering + vital sign evaluation
src/lib/server/engine/deterministic.spec.ts  — Comprehensive unit tests
src/lib/server/engine/merge.ts               — Merge deterministic + LLM results
src/lib/server/engine/merge.spec.ts          — Tests
```

#### LLM Integration
```
src/lib/server/llm/client.ts       — Anthropic SDK client instantiation
src/lib/server/llm/extraction.ts   — Haiku extraction call (tool_use)
src/lib/server/llm/evaluation.ts   — Sonnet evaluation call (tool_use)
src/lib/server/llm/schemas.ts      — Tool-use JSON schemas for both steps
src/lib/server/llm/mock.ts         — Mock responses (regex extraction + simulated evaluation)
```

#### Server Route
```
src/routes/api/triage/+server.ts   — POST endpoint returning SSE stream
src/routes/+page.server.ts         — Expose isMockMode to client
```

#### UI Components
```
src/lib/components/triage/header.svelte             — App header (title, dark mode, mock badge)
src/lib/components/triage/report-input.svelte       — Textarea + submit button + helper text
src/lib/components/triage/progress-steps.svelte     — Multi-step progress indicator
src/lib/components/triage/recognized-inputs.svelte  — Extracted fields checklist
src/lib/components/triage/criteria-matches.svelte   — Matched criteria grouped by level
src/lib/components/triage/activation-card.svelte    — Color-coded severity card
src/lib/components/triage/agent-reasoning.svelte    — Expandable LLM reasoning
src/lib/components/triage/warning-banner.svelte     — Inline missing-field warnings
src/lib/components/triage/welcome-state.svelte      — Initial welcome/instructional view
src/lib/components/triage/footer-disclaimer.svelte  — Bottom disclaimer text
```

#### Client State
```
src/lib/stores/triage.svelte.ts    — Svelte 5 runes-based triage state machine
```

#### Environment
```
.env.example                       — Template with ANTHROPIC_API_KEY and MOCK_MODE
```

### Modified Files

```
src/routes/+page.svelte            — Replace placeholder with full triage UI
src/routes/+layout.svelte          — Add ModeWatcher, Toaster
src/routes/layout.css              — Add trauma emergency color variables
src/app.d.ts                       — Add env type declarations
src/routes/page.svelte.spec.ts     — Update to test new page structure
```

---

## 2. Data Layer

### TypeScript Types

#### `src/lib/types/criteria.ts`

```typescript
export type ActivationLevel = 'Level 1' | 'Level 2' | 'Level 3';
export type AgeCategory = 'Adult' | 'Pediatric' | 'Geriatric';
export type EvaluationMethod = 'deterministic' | 'hybrid' | 'llm';

export interface VitalRule {
  field: 'gcs' | 'sbp' | 'rr' | 'hr';
  operator: '<' | '<=' | '>' | '>=' | '==' | 'range';
  threshold: number;
  thresholdHigh?: number;               // For range (e.g., GCS 12 or 13)
  requiresLlmConfirmation?: string;     // Qualitative condition (e.g., "poor perfusion")
}

export interface Criterion {
  id: number;
  description: string;
  activationLevel: ActivationLevel;
  category: AgeCategory;
  ageRangeLabel: string;                // Human-readable: "16 - 64", "0 - 15", "> 64"
  ageMin: number;
  ageMax: number | null;                // null = open-ended (geriatric)
  evaluationMethod: EvaluationMethod;
  vitalRule?: VitalRule;                // Only for deterministic/hybrid
}
```

#### `src/lib/types/extraction.ts`

```typescript
export interface ExtractedFields {
  age: number | null;
  sbp: number | null;
  hr: number | null;
  rr: number | null;
  gcs: number | null;
  airwayStatus: string | null;
  breathingStatus: string | null;
  mechanism: string | null;
  injuries: string[] | null;
  additionalContext: string | null;
}

export interface PlausibilityWarning {
  field: keyof ExtractedFields;
  message: string;
}
```

#### `src/lib/types/evaluation.ts`

```typescript
export interface CriterionMatch {
  criterionId: number;
  description: string;
  activationLevel: ActivationLevel;
  category: AgeCategory;         // For display grouping (subheader)
  ageRangeLabel: string;         // For display grouping (e.g., "16 - 64")
  source: 'deterministic' | 'llm';
  confidence?: number;           // 0-1, LLM-sourced only
  triggerReason: string;         // e.g., "GCS = 8 < 12"
}

export interface EvaluationResult {
  extractedFields: ExtractedFields;
  plausibilityWarnings: PlausibilityWarning[];
  criteriaMatches: CriterionMatch[];
  activationLevel: ActivationLevel | 'Standard Triage';
  justification: string;
  agentReasoning: string;
  missingFieldWarnings: string[];
}
```

#### `src/lib/types/sse.ts`

```typescript
export type SSEEvent =
  | { type: 'phase'; phase: 'extracting' | 'evaluating_vitals' | 'analyzing_mechanism' | 'complete' }
  | { type: 'extraction'; data: ExtractedFields; warnings: PlausibilityWarning[] }
  | { type: 'deterministic'; matches: CriterionMatch[] }
  | { type: 'llm_evaluation'; matches: CriterionMatch[]; reasoning: string }
  | { type: 'result'; data: EvaluationResult }
  | { type: 'error'; message: string; phase: string; canRetry: boolean };
```

### Criteria Data (`src/lib/server/criteria/criteria.ts`)

All 137 criteria are hardcoded as a typed TypeScript array. The `trauma-criteria.csv` remains in the repository as the medical team's reference document but is **not imported** by the application.

```typescript
import type { Criterion } from '$lib/types/criteria';

export const CRITERIA: Criterion[] = [
  // === ADULT (16-64) ===

  // Level 1 — Deterministic
  {
    id: 1,
    description: 'Glasgow coma score (GCS) < 12',
    activationLevel: 'Level 1',
    category: 'Adult',
    ageRangeLabel: '16 - 64',
    ageMin: 16,
    ageMax: 64,
    evaluationMethod: 'deterministic',
    vitalRule: { field: 'gcs', operator: '<', threshold: 12 },
  },
  // Level 1 — Hybrid
  {
    id: 2,
    description: 'Injury with associated tachycardia (HR > 100) AND poor perfusion',
    activationLevel: 'Level 1',
    category: 'Adult',
    ageRangeLabel: '16 - 64',
    ageMin: 16,
    ageMax: 64,
    evaluationMethod: 'hybrid',
    vitalRule: { field: 'hr', operator: '>', threshold: 100, requiresLlmConfirmation: 'poor perfusion' },
  },
  // Level 1 — LLM-only (no vitalRule)
  {
    id: 6,
    description: 'Respiratory distress',
    activationLevel: 'Level 1',
    category: 'Adult',
    ageRangeLabel: '16 - 64',
    ageMin: 16,
    ageMax: 64,
    evaluationMethod: 'llm',
  },
  // ... all 137 criteria, grouped by category then level
];

export const CRITERIA_MAP = new Map(CRITERIA.map(c => [c.id, c]));
```

**Structure:**
- Grouped by category (Adult → Pediatric → Geriatric) then by activation level
- Comments separating sections for readability
- Deterministic criteria (20): include `vitalRule` with field/operator/threshold
- Hybrid criteria (2): include `vitalRule` with `requiresLlmConfirmation`
- LLM-only criteria (115): no `vitalRule`
- Geriatric criteria have `ageMax: null` (open-ended)
- Pediatric SBP criteria have narrow per-year age ranges (e.g., id=50 has ageMin=3, ageMax=3)

**Why hardcoded instead of CSV parsing:** The deterministic criteria descriptions have inconsistent natural-language formatting (=, ==, ≤, trailing text like "mmHg for a 2 year old") that makes reliable VitalRule extraction fragile. Since there are only 22 deterministic/hybrid rules across 137 total criteria, and these are stable medical standards, hardcoding is simpler and more reliable. A validation test ensures data integrity.

**Deterministic criteria IDs** (for reference):
- Adult L1: id=1 (GCS<12), id=3 (SBP<90), id=4 (RR<10), id=5 (RR>29)
- Adult L1 hybrid: id=2 (HR>100 AND poor perfusion)
- Adult L2: id=26 (GCS 12 or 13)
- Pediatric L1: id=46 (GCS<12), id=57 (SBP≤90 for age 10-15), ids 48-56 (SBP by specific age)
- Pediatric L2: id=78 (GCS 12 or 13)
- Pediatric L1 hybrid: id=47 is **LLM-only** (says "associated tachycardia" without numeric threshold)
- Geriatric L1: id=99 (GCS<12), id=101 (SBP<110)
- Geriatric L1 hybrid: id=100 (HR>90 AND poor perfusion)
- Geriatric L2: id=123 (GCS 12 or 13)

---

## 3. Deterministic Engine

### `src/lib/server/engine/deterministic.ts`

#### Core Functions

```typescript
function filterCriteriaByAge(criteria: Map<number, Criterion>, age: number): Criterion[]
```
- Returns criteria where `age >= criterion.ageMin AND (criterion.ageMax === null OR age <= criterion.ageMax)`

```typescript
function evaluateDeterministic(
  fields: ExtractedFields,
  criteria: Map<number, Criterion>
): { matches: CriterionMatch[]; hybridPending: HybridPending[] }
```
1. Filter criteria by age
2. Select `evaluationMethod === 'deterministic'` or `'hybrid'` criteria
3. For each criterion with a `vitalRule`:
   - Get the relevant field value from `ExtractedFields`
   - If the field is `null`, skip (cannot evaluate)
   - Apply the comparison: `<`, `<=`, `>`, `>=`, `==`, `range`
   - Special case for GCS "12 or 13": match if `gcs === 12 || gcs === 13`
4. For deterministic: add to matches with `source: 'deterministic'`
5. For hybrid: if numeric portion matches, add to `hybridPending` (needs LLM confirmation)

```typescript
function checkPlausibility(fields: ExtractedFields): PlausibilityWarning[]
```
- Age: 0-120
- SBP: 20-300 mmHg
- HR: 20-300 bpm
- RR: 0-80 breaths/min
- GCS: 3-15

```typescript
function getMissingFieldWarnings(fields: ExtractedFields): string[]
```
- Per-field contextual messages: "Without SBP, blood pressure criteria cannot be fully evaluated"

### `src/lib/server/engine/merge.ts`

```typescript
function mergeResults(
  deterministicMatches: CriterionMatch[],
  llmMatches: CriterionMatch[],
  hybridPending: HybridPending[],
  hybridConfirmations: HybridConfirmation[]
): { matches: CriterionMatch[]; activationLevel: ActivationLevel | 'Standard Triage' }
```
1. Confirm hybrid criteria where LLM verified the qualitative part
2. Combine all match sources
3. Deduplicate by `criterionId`
4. Determine activation level: `Level 1 > Level 2 > Level 3 > Standard Triage`

---

## 4. Server API

### SSE Endpoint (`src/routes/api/triage/+server.ts`)

**Endpoint**: `POST /api/triage`
**Request**: `{ report: string }`
**Response**: `text/event-stream`

#### Pipeline Orchestration

```
1. Validate input (non-empty string)
2. Detect mock mode: !env.ANTHROPIC_API_KEY || env.MOCK_MODE === 'true'
3. Create ReadableStream for SSE
4. Send phase: 'extracting'
5. Run extraction (Haiku or mock regex)
6. Validate: age present? Is trauma report?
7. Send extraction results
8. Send phase: 'evaluating_vitals'
9. Run deterministic engine → send deterministic matches
10. Send phase: 'analyzing_mechanism'
11. Run LLM evaluation (Sonnet or mock) with age-filtered LLM criteria + hybrid pending
12. Send LLM matches + reasoning
13. Send phase: 'complete'
14. Merge all results → send final result
15. Close stream
```

Error at any step sends an error event and closes the stream. Deterministic results that completed before an LLM error are still included.

### LLM Tool-Use Schemas (`src/lib/server/llm/schemas.ts`)

#### Extraction Tool (Haiku)

```typescript
{
  name: 'extract_trauma_fields',
  description: 'Extract structured medical fields from a free-text EMS trauma report',
  input_schema: {
    type: 'object',
    properties: {
      is_trauma_report: { type: 'boolean' },
      age: { type: ['number', 'null'] },
      sbp: { type: ['number', 'null'] },
      hr: { type: ['number', 'null'] },
      rr: { type: ['number', 'null'] },
      gcs: { type: ['number', 'null'] },
      airway_status: { type: ['string', 'null'] },
      breathing_status: { type: ['string', 'null'] },
      mechanism: { type: ['string', 'null'] },
      injuries: { type: ['array', 'null'], items: { type: 'string' } },
      additional_context: { type: ['string', 'null'] },
    },
    required: ['is_trauma_report', 'age'],
  }
}
```

#### Evaluation Tool (Sonnet)

```typescript
{
  name: 'evaluate_trauma_criteria',
  description: 'Evaluate which trauma triage criteria are met based on patient data',
  input_schema: {
    type: 'object',
    properties: {
      matched_criteria: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            criterion_id: { type: 'number' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            trigger_reason: { type: 'string' },
          },
          required: ['criterion_id', 'confidence', 'trigger_reason'],
        },
      },
      hybrid_confirmations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            criterion_id: { type: 'number' },
            qualitative_confirmed: { type: 'boolean' },
            explanation: { type: 'string' },
          },
          required: ['criterion_id', 'qualitative_confirmed'],
        },
      },
      reasoning_narrative: { type: 'string' },
    },
    required: ['matched_criteria', 'hybrid_confirmations', 'reasoning_narrative'],
  }
}
```

### LLM Client (`src/lib/server/llm/client.ts`)

Lazy-initialized Anthropic SDK client using `$env/dynamic/private`.

**Dependency to install**: `pnpm add @anthropic-ai/sdk`

### Mock Mode (`src/lib/server/llm/mock.ts`)

**Mock extraction**: Regex-based field parsing from the report text:
- Age: `/(\d+)\s*(?:year|yr|y\.?o\.?|y\/o)/i`
- SBP: `/(?:sbp|systolic|bp|blood pressure)[:\s]*(\d+)/i`
- HR: `/(?:hr|heart rate|pulse)[:\s]*(\d+)/i`
- RR: `/(?:rr|respiratory rate|resp)[:\s]*(\d+)/i`
- GCS: `/(?:gcs|glasgow)[:\s]*(\d+)/i`

This allows the deterministic engine to run with real extracted data even without an API key.

**Mock evaluation**: Returns empty matches with reasoning: "Mock mode: LLM evaluation simulated. Only deterministic criteria were evaluated."

**Simulated delay**: 500ms per mock call.

---

## 5. Client Components

### Component Hierarchy

```
+layout.svelte
  ├── ModeWatcher
  ├── Toaster
  └── +page.svelte
        ├── Header                  (props: isMockMode)
        ├── WelcomeState            (shown when idle + no results)
        ├── ReportInput             (props: onsubmit, disabled)
        ├── ProgressSteps           (props: currentPhase)
        ├── RecognizedInputs        (props: fields, warnings, missingFieldWarnings)
        │   └── WarningBanner       (props: warnings)
        ├── CriteriaMatches         (props: matches)
        ├── ActivationCard          (props: level, justification)
        ├── AgentReasoning          (props: reasoning)
        └── FooterDisclaimer
```

### shadcn-svelte Components to Reuse

| Component | Used In |
|---|---|
| `Button` | ReportInput (submit), Header (dark mode toggle) |
| `Textarea` | ReportInput |
| `Card` | ActivationCard, RecognizedInputs, CriteriaMatches |
| `Badge` | Header (mock indicator), CriteriaMatches (level badges, confidence) |
| `Collapsible` | AgentReasoning |
| `Alert` | WarningBanner |
| `Separator` | CriteriaMatches (between groups) |
| `Kbd` | ReportInput (Ctrl+Enter hint) |
| `Spinner` | ProgressSteps (active phase) |

### Key Component Details

**ReportInput**: Internal `$state` for textarea value. `onkeydown` handler checks for Ctrl/Cmd+Enter. Disabled during evaluation.

**ProgressSteps**: Four-step vertical stepper. Active step shows spinner. Completed steps show checkmark. Pending steps show gray circle.

**RecognizedInputs**: Lists all expected fields (age, SBP, HR, RR, GCS, airway, breathing, mechanism, injuries). Green check + value for present, yellow warning for missing. Plausibility warnings shown inline in amber.

**CriteriaMatches**: Groups matches by `activationLevel`. Each group has a colored header. Each match shows description, trigger reason, and confidence (LLM only).

**ActivationCard**: Full-width card with thick left border in the level color. Large text for the level name. Justification text below.

---

## 6. State Management

### `src/lib/stores/triage.svelte.ts`

A class using Svelte 5 `$state` runes that manages the entire triage lifecycle:

```typescript
export class TriageState {
  phase = $state<TriagePhase>('idle');
  report = $state<string>('');
  extractedFields = $state<ExtractedFields | null>(null);
  plausibilityWarnings = $state<PlausibilityWarning[]>([]);
  deterministicMatches = $state<CriterionMatch[]>([]);
  llmMatches = $state<CriterionMatch[]>([]);
  result = $state<EvaluationResult | null>(null);
  error = $state<{ message: string; canRetry: boolean } | null>(null);
}
```

**Key methods:**
- `evaluate(report)`: Sends POST to `/api/triage`, consumes SSE stream via `ReadableStream`, updates state as events arrive
- `handleEvent(event)`: Processes each SSE event type and updates the corresponding state
- `reset()`: Clears all state back to idle
- `cancel()`: Aborts in-flight request via `AbortController`

**Exported as singleton**: `export const triageState = new TriageState()`

**SSE consumption**: Uses `fetch` with `response.body.getReader()` and `TextDecoder` to parse the `data: {...}\n\n` SSE format.

### Mock Mode Client Detection

`src/routes/+page.server.ts` exposes `isMockMode` via page data:

```typescript
export function load() {
  return { isMockMode: !env.ANTHROPIC_API_KEY || env.MOCK_MODE === 'true' };
}
```

---

## 7. Styling

### Emergency Color Variables

Add to `src/routes/layout.css` in both `:root` and `.dark` blocks:

```css
:root {
  --trauma-level-1: oklch(0.55 0.25 28);          /* Deep red */
  --trauma-level-1-fg: oklch(1 0 0);
  --trauma-level-1-bg: oklch(0.55 0.25 28 / 12%);

  --trauma-level-2: oklch(0.70 0.18 55);          /* Orange */
  --trauma-level-2-fg: oklch(0.15 0 0);
  --trauma-level-2-bg: oklch(0.70 0.18 55 / 12%);

  --trauma-level-3: oklch(0.80 0.16 85);          /* Yellow-amber */
  --trauma-level-3-fg: oklch(0.15 0 0);
  --trauma-level-3-bg: oklch(0.80 0.16 85 / 12%);

  --trauma-standard: oklch(0.65 0.01 250);        /* Neutral gray */
  --trauma-standard-fg: oklch(1 0 0);
  --trauma-standard-bg: oklch(0.65 0.01 250 / 12%);

  --trauma-success: oklch(0.65 0.18 145);         /* Green (extracted fields) */
  --trauma-warning: oklch(0.75 0.16 70);          /* Amber (warnings) */
  --trauma-mock: oklch(0.70 0.15 300);            /* Purple (mock badge) */
}
```

Register in `@theme inline` for Tailwind utility classes:

```css
@theme inline {
  --color-trauma-level-1: var(--trauma-level-1);
  --color-trauma-level-1-fg: var(--trauma-level-1-fg);
  /* ... etc for all trauma colors */
}
```

### Design Patterns

- **Activation card**: `rounded-xl border-l-6 border-trauma-level-N bg-trauma-level-N-bg p-6`
- **Level text**: `text-4xl font-black text-trauma-level-N`
- **Criteria group headers**: `text-lg font-bold text-trauma-level-N`
- **Checklist icons**: Green (`text-trauma-success`) for present, amber (`text-trauma-warning`) for missing
- **Mock badge**: `bg-trauma-mock text-white`

---

## 8. Testing

### Unit Tests (Server, Node environment)

#### `src/lib/server/criteria/criteria.spec.ts`

- All 137 criteria present in the array
- No duplicate IDs
- Every criterion has a non-empty `ageRangeLabel`
- Every `evaluationMethod: 'deterministic'` criterion has a `vitalRule`
- Every `evaluationMethod: 'hybrid'` criterion has a `vitalRule` with `requiresLlmConfirmation`
- No `evaluationMethod: 'llm'` criterion has a `vitalRule`
- Age ranges are valid (`ageMin <= ageMax` where `ageMax` is not null)
- Geriatric criteria have `ageMax === null`
- Pediatric SBP criteria have narrow age ranges (e.g., id=50 has ageMin=3, ageMax=3)
- Spot-check known IDs (e.g., id=1 is GCS<12, id=3 is SBP<90, id=26 is GCS range 12-13)

#### `src/lib/server/engine/deterministic.spec.ts`

**Age filtering tests:**
- 5yo → Pediatric criteria (0-15, 0-17), not Adult/Geriatric
- 17yo → Pediatric L3 (0-17) + Adult L1 (16-64), not Pediatric L1 (0-15)
- 30yo → Adult only
- 70yo → Geriatric only
- 16yo → Adult L1/L2 (16-64) + Pediatric L3 (0-17)
- 65yo → Geriatric (65+), not Adult (16-64)

**Vital sign evaluation tests:**
- GCS=8 on 30yo → Adult L1 (GCS<12)
- GCS=12 on 30yo → Adult L2 (GCS==12 or 13)
- GCS=14 on 30yo → no match
- SBP=85 on 30yo → Adult L1 (SBP<90)
- SBP=105 on 70yo → Geriatric L1 (SBP<110)
- SBP=65 on 1yo → Pediatric L1 (SBP<70 for age 0-1)
- SBP=75 on 3yo → Pediatric L1 (SBP<76 for 3yo)
- SBP=76 on 3yo → NO match (>= threshold)
- RR=8 on 30yo → Adult L1 (RR<10)
- RR=30 on 30yo → Adult L1 (RR>29)
- RR=29 on 30yo → NO match (not > 29)

**Missing field tests:**
- Null SBP skips SBP criteria without crashing
- All vitals null returns empty matches

**Hybrid tests:**
- HR=110 on 30yo → numeric portion matches, flagged for LLM
- HR=90 on 30yo → does NOT match (not > 100)
- HR=95 on 70yo → Geriatric hybrid (HR>90), flagged

**Plausibility tests:**
- Age=150 → warning
- SBP=-5 → warning
- GCS=2 → warning
- Normal values → no warnings

#### `src/lib/server/engine/merge.spec.ts`

- Empty + empty = Standard Triage
- L1 deterministic + L2 LLM = Level 1
- Only L3 matches = Level 3
- Hybrid confirmed → included
- Hybrid not confirmed → excluded

---

## 9. Implementation Order

Build in this sequence to maintain testability at each step:

### Step 1: Types (zero dependencies)
Create all TypeScript types in `src/lib/types/`. These are the foundation everything else depends on.

### Step 2: Criteria Data + Validation Tests
Create `src/lib/server/criteria/criteria.ts` with all 137 hardcoded criteria. Write validation tests to ensure data integrity (count, uniqueness, VitalRule presence for deterministic/hybrid, age range validity).

### Step 3: Deterministic Engine + Tests
Implement `src/lib/server/engine/deterministic.ts` and `merge.ts`. Write comprehensive unit tests. This is the most critical and most testable module.

### Step 4: Install Anthropic SDK
`pnpm add @anthropic-ai/sdk`

### Step 5: LLM Layer
Implement client, schemas, extraction, evaluation, and mock modules in `src/lib/server/llm/`.

### Step 6: SSE Endpoint
Wire up the full pipeline in `src/routes/api/triage/+server.ts`. Test manually with `curl` in mock mode.

### Step 7: Environment Setup
Create `.env.example`. Add env type declarations to `src/app.d.ts`. Create `src/routes/+page.server.ts` to expose mock mode.

### Step 8: Styling
Add trauma color variables to `src/routes/layout.css`. Register in `@theme inline`.

### Step 9: Layout Updates
Update `src/routes/+layout.svelte` to include `ModeWatcher` and `Toaster`.

### Step 10: State Management
Implement `src/lib/stores/triage.svelte.ts` with the `TriageState` class.

### Step 11: Components (bottom-up)
Build in order of dependency:
1. `footer-disclaimer.svelte` (static)
2. `welcome-state.svelte` (static)
3. `warning-banner.svelte` (simple props)
4. `header.svelte` (dark mode + mock badge)
5. `progress-steps.svelte` (phase tracking)
6. `recognized-inputs.svelte` (extraction data display)
7. `criteria-matches.svelte` (grouped results)
8. `activation-card.svelte` (severity card)
9. `agent-reasoning.svelte` (collapsible)
10. `report-input.svelte` (textarea + submit + keyboard shortcut)

### Step 12: Page Assembly
Replace `src/routes/+page.svelte` with the full composition of all components wired to `triageState`.

### Step 13: Manual E2E Testing
- Mock mode (no API key): full pipeline with regex extraction + real deterministic
- Real mode (with API key): full pipeline with Haiku + Sonnet
- Dark mode toggle
- Responsive layouts (mobile, tablet, desktop)
- Error scenarios (network failure, invalid input, non-trauma text)
- Edge cases (boundary ages, missing vitals, implausible values)

---

## Key Design Decisions

1. **Criteria hardcoded in TypeScript**: All 137 criteria are defined as a typed array in `src/lib/server/criteria/criteria.ts`. VitalRules for deterministic/hybrid criteria are defined inline — no CSV parsing or natural-language extraction needed. The `trauma-criteria.csv` remains as the medical team's reference document but is not imported by the application. Validation tests ensure data integrity.

2. **Class-based state with `$state` runes**: Idiomatic Svelte 5. Co-locates state and methods. Fully reactive when properties are read in `.svelte` files.

3. **SSE over WebSocket**: The pipeline is unidirectional (server → client). SSE is simpler and works naturally with `fetch` + `ReadableStream`.

4. **No Superforms for input**: A single textarea doesn't warrant Superforms + Formsnap complexity. Validation happens server-side in the pipeline.

5. **Mock extraction uses real regex**: The deterministic engine can be properly exercised even in mock mode, making development significantly easier.

6. **Hybrid criteria pattern**: The deterministic engine checks the numeric part, flags matches for LLM confirmation. This prevents false positives (e.g., HR > 100 without poor perfusion) while keeping numeric evaluation fast and deterministic.
