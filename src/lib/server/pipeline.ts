import type { SSEEvent, ExtractedFields, CriterionMatch } from "$lib/types/index.js";
import { CRITERIA } from "$lib/server/criteria/criteria.js";
import { filterCriteriaByAge } from "$lib/server/engine/age-filter.js";
import { evaluateDeterministic } from "$lib/server/engine/deterministic.js";
import { checkPlausibility } from "$lib/server/engine/plausibility.js";
import {
  mergeMatches,
  determineActivationLevel,
  buildJustification,
} from "$lib/server/engine/merge.js";
import { isMockMode } from "$lib/server/config.js";

export async function* runPipeline(report: string): AsyncGenerator<SSEEvent> {
  const mockMode = isMockMode();
  let fields: ExtractedFields;
  let isTraumaReport: boolean;

  // ─── Phase 1: Extraction ────────────────────────────────────────
  yield { type: "phase", phase: "extracting" };

  try {
    if (mockMode) {
      const { mockExtract } = await import("$lib/server/mock/mock-extraction.js");
      const result = await mockExtract(report);
      fields = result.fields;
      isTraumaReport = result.isTraumaReport;
    } else {
      const { extractFields } = await import("$lib/server/llm/extraction.js");
      const result = await extractFields(report);
      fields = result.fields;
      isTraumaReport = result.isTraumaReport;
    }
  } catch (error) {
    yield {
      type: "error",
      message: `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      phase: "extraction",
      canRetry: true,
    };
    return;
  }

  // Relevance gate
  if (!isTraumaReport) {
    yield {
      type: "error",
      message:
        "This doesn't appear to be a trauma/EMS report. Please provide a trauma-related EMS narrative.",
      phase: "extraction",
      canRetry: false,
    };
    return;
  }

  // Age gate
  if (fields.age === null) {
    yield {
      type: "error",
      message:
        "Age could not be determined from the report. Age is required for triage evaluation.",
      phase: "extraction",
      canRetry: false,
    };
    return;
  }

  const warnings = checkPlausibility(fields);
  yield { type: "extraction", data: fields, warnings };

  // ─── Filter criteria by age ─────────────────────────────────────
  const ageCriteria = filterCriteriaByAge(CRITERIA, fields.age);
  const llmOnlyCriteria = ageCriteria.filter((c) => c.evaluationMethod === "llm");
  const hybridCriteria = ageCriteria.filter((c) => c.evaluationMethod === "hybrid");

  // ─── Start LLM evaluation async (runs in parallel with deterministic) ──
  let llmPromise: Promise<{
    matches: CriterionMatch[];
    hybridConfirmations: number[];
    reasoning: string;
  }>;

  if (mockMode) {
    llmPromise = import("$lib/server/mock/mock-evaluation.js").then((m) => m.mockEvaluate());
  } else {
    llmPromise = import("$lib/server/llm/evaluation.js").then((m) =>
      m.evaluateWithLlm(fields, llmOnlyCriteria, hybridCriteria),
    );
  }

  // ─── Phase 2a: Deterministic (instant, synchronous) ─────────────
  yield { type: "phase", phase: "evaluating_vitals" };
  const deterministicResult = evaluateDeterministic(fields, ageCriteria);
  yield { type: "deterministic", matches: deterministicResult.matches };

  // ─── Phase 2b: LLM Evaluation (await parallel call) ─────────────
  yield { type: "phase", phase: "analyzing_mechanism" };

  let llmMatches: CriterionMatch[] = [];
  let hybridConfirmations: number[] = [];
  let reasoning = "";

  try {
    const llmResult = await llmPromise;
    llmMatches = llmResult.matches;
    hybridConfirmations = llmResult.hybridConfirmations;
    reasoning = llmResult.reasoning;
    yield { type: "llm_evaluation", matches: llmMatches, reasoning };
  } catch (error) {
    yield {
      type: "error",
      message: `LLM evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}. Deterministic results are still valid.`,
      phase: "llm_evaluation",
      canRetry: true,
    };
  }

  // ─── Phase 3: Merge ─────────────────────────────────────────────
  // Promote hybrid criteria confirmed by LLM
  const confirmedHybridMatches: CriterionMatch[] = deterministicResult.hybridPending
    .filter((c) => hybridConfirmations.includes(c.id))
    .map((c) => ({
      criterionId: c.id,
      description: c.description,
      activationLevel: c.activationLevel,
      category: c.category,
      ageRangeLabel: c.ageRangeLabel,
      source: "deterministic" as const,
      triggerReason: `${c.vitalRule!.field.toUpperCase()} = ${fields[c.vitalRule!.field]} > ${c.vitalRule!.threshold} AND ${c.vitalRule!.requiresLlmConfirmation} confirmed`,
    }));

  const allMatches = mergeMatches(deterministicResult.matches, confirmedHybridMatches, llmMatches);
  const activationLevel = determineActivationLevel(allMatches);
  const justification = buildJustification(activationLevel, allMatches);

  const missingFieldWarnings: string[] = [];
  if (fields.sbp === null)
    missingFieldWarnings.push("Without SBP, blood pressure criteria cannot be fully evaluated.");
  if (fields.hr === null)
    missingFieldWarnings.push("Without HR, heart rate criteria cannot be fully evaluated.");
  if (fields.rr === null)
    missingFieldWarnings.push("Without RR, respiratory rate criteria cannot be fully evaluated.");
  if (fields.gcs === null)
    missingFieldWarnings.push(
      "Without GCS, Glasgow Coma Scale criteria cannot be fully evaluated.",
    );

  yield { type: "phase", phase: "complete" };
  yield {
    type: "result",
    data: {
      extractedFields: fields,
      plausibilityWarnings: warnings,
      criteriaMatches: allMatches,
      activationLevel,
      justification,
      agentReasoning: reasoning,
      missingFieldWarnings,
    },
  };
}
