import type { TriagePhase } from "$lib/state/triage.svelte.js";
import type {
  ExtractedFields,
  PlausibilityWarning,
  CriterionMatch,
  FinalActivationLevel,
} from "$lib/types/index.js";

import {
  allFieldsPresent,
  geriatricFields,
  standardTriageFields,
  sampleReport,
  geriatricReport,
  standardTriageReport,
  level1Deterministic,
  level1Llm,
  level2Match,
  level3Match,
  geriatricLevel2Match,
  geriatricLevel3Anticoag,
  mixedLevelMatches,
  level1Justification,
  geriatricJustification,
  standardTriageJustification,
  sampleReasoning,
} from "./mock-data.js";

// ─── Types ───────────────────────────────────────────────────────────

export interface PhaseStep {
  label: string;
  phase: TriagePhase;
  report?: string;
  extractedFields?: ExtractedFields | null;
  plausibilityWarnings?: PlausibilityWarning[];
  deterministicMatches?: CriterionMatch[];
  llmMatches?: CriterionMatch[];
  allMatches?: CriterionMatch[];
  activationLevel?: FinalActivationLevel | null;
  justification?: string;
  agentReasoning?: string;
  missingFieldWarnings?: string[];
  errorMessage?: string;
  canRetry?: boolean;
}

export interface PhaseScenario {
  name: string;
  description: string;
  steps: PhaseStep[];
}

// ─── Level 1 MVC (Severe Happy Path) ────────────────────────────────

export const level1MvcScenario: PhaseScenario = {
  name: "Level 1 — High-Speed MVC",
  description:
    "Severe Level 1 activation: high-speed MVC with rollover, multiple Level 1 criteria met.",
  steps: [
    {
      label: "Idle — awaiting report",
      phase: "idle",
    },
    {
      label: "Extracting report...",
      phase: "extracting",
      report: sampleReport,
    },
    {
      label: "Evaluating vital signs",
      phase: "evaluating_vitals",
      report: sampleReport,
      extractedFields: allFieldsPresent,
    },
    {
      label: "Analyzing mechanism & injuries",
      phase: "analyzing_mechanism",
      report: sampleReport,
      extractedFields: allFieldsPresent,
      deterministicMatches: [level1Deterministic],
    },
    {
      label: "Complete — Level 1 activation",
      phase: "complete",
      report: sampleReport,
      extractedFields: allFieldsPresent,
      deterministicMatches: [level1Deterministic],
      llmMatches: [level1Llm, level2Match, level3Match],
      allMatches: mixedLevelMatches,
      activationLevel: "Level 1",
      justification: level1Justification,
      agentReasoning: sampleReasoning,
    },
  ],
};

// ─── Geriatric Level 2 ──────────────────────────────────────────────

export const geriatricLevel2Scenario: PhaseScenario = {
  name: "Level 2 — Geriatric Fall",
  description:
    "Geriatric patient with ground-level fall, hip fracture, and anticoagulant use.",
  steps: [
    {
      label: "Idle — awaiting report",
      phase: "idle",
    },
    {
      label: "Extracting report...",
      phase: "extracting",
      report: geriatricReport,
    },
    {
      label: "Evaluating vital signs",
      phase: "evaluating_vitals",
      report: geriatricReport,
      extractedFields: geriatricFields,
    },
    {
      label: "Analyzing mechanism & injuries",
      phase: "analyzing_mechanism",
      report: geriatricReport,
      extractedFields: geriatricFields,
      deterministicMatches: [],
    },
    {
      label: "Complete — Level 2 activation",
      phase: "complete",
      report: geriatricReport,
      extractedFields: geriatricFields,
      deterministicMatches: [],
      llmMatches: [geriatricLevel2Match, geriatricLevel3Anticoag],
      allMatches: [geriatricLevel2Match, geriatricLevel3Anticoag],
      activationLevel: "Level 2",
      justification: geriatricJustification,
      agentReasoning: `Extraction phase identified a 72-year-old female with ground-level fall. Patient on warfarin with INR 2.8.\n\nDeterministic evaluation: no vital sign thresholds exceeded (SBP 102, HR 98, GCS 14 all within normal ranges).\n\nLLM evaluation identified hip fracture in geriatric patient (criterion #105, confidence 0.91) and anticoagulant use with head strike (criterion #110, confidence 0.95).\n\nFinal determination: Level 2 activation based on geriatric hip fracture.`,
    },
  ],
};

// ─── Standard Triage (No Activation) ────────────────────────────────

export const standardTriageScenario: PhaseScenario = {
  name: "Standard Triage — No Activation",
  description:
    "Minor injury with no trauma activation criteria met.",
  steps: [
    {
      label: "Idle — awaiting report",
      phase: "idle",
    },
    {
      label: "Extracting report...",
      phase: "extracting",
      report: standardTriageReport,
    },
    {
      label: "Evaluating vital signs",
      phase: "evaluating_vitals",
      report: standardTriageReport,
      extractedFields: standardTriageFields,
    },
    {
      label: "Analyzing mechanism & injuries",
      phase: "analyzing_mechanism",
      report: standardTriageReport,
      extractedFields: standardTriageFields,
      deterministicMatches: [],
    },
    {
      label: "Complete — Standard Triage",
      phase: "complete",
      report: standardTriageReport,
      extractedFields: standardTriageFields,
      deterministicMatches: [],
      llmMatches: [],
      allMatches: [],
      activationLevel: "Standard Triage",
      justification: standardTriageJustification,
      agentReasoning:
        "No vital sign thresholds exceeded. No mechanism or injury criteria met. Patient suitable for standard triage evaluation.",
    },
  ],
};

// ─── Error Recovery (Partial Results + Error) ───────────────────────

export const errorRecoveryScenario: PhaseScenario = {
  name: "Error Recovery — Partial Results",
  description:
    "Successful extraction and deterministic eval, then LLM error with partial results preserved.",
  steps: [
    {
      label: "Idle — awaiting report",
      phase: "idle",
    },
    {
      label: "Extracting report...",
      phase: "extracting",
      report: sampleReport,
    },
    {
      label: "Evaluating vital signs",
      phase: "evaluating_vitals",
      report: sampleReport,
      extractedFields: allFieldsPresent,
    },
    {
      label: "Error — LLM evaluation failed",
      phase: "analyzing_mechanism",
      report: sampleReport,
      extractedFields: allFieldsPresent,
      deterministicMatches: [level1Deterministic],
      errorMessage:
        "LLM evaluation timed out after 30s. Deterministic results are still available above.",
      canRetry: true,
    },
  ],
};
