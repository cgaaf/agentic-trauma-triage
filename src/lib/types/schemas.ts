import { z } from "zod";

// ─── Activation Levels ─────────────────────────────────────────────
export const ActivationLevelSchema = z.enum(["Level 1", "Level 2", "Level 3"]);
export const FinalActivationLevelSchema = z.enum([
  "Level 1",
  "Level 2",
  "Level 3",
  "Standard Triage",
]);
export const CategorySchema = z.enum(["Adult", "Pediatric", "Geriatric"]);
export const EvaluationMethodSchema = z.enum(["deterministic", "hybrid", "llm"]);
export const MatchSourceSchema = z.enum(["deterministic", "llm"]);

// ─── Vital Rule (numeric comparison for deterministic/hybrid criteria) ──
export const VitalFieldSchema = z.enum(["gcs", "sbp", "rr", "hr"]);
export const VitalOperatorSchema = z.enum(["<", "<=", ">", ">=", "==", "range"]);

export const VitalRuleSchema = z.object({
  field: VitalFieldSchema,
  operator: VitalOperatorSchema,
  threshold: z.number(),
  thresholdHigh: z.number().optional(),
  requiresLlmConfirmation: z.string().optional(),
});

// ─── Criterion (data model for one of the 137 triage criteria) ──────
export const CriterionSchema = z.object({
  id: z.number().int().positive(),
  description: z.string(),
  activationLevel: ActivationLevelSchema,
  category: CategorySchema,
  ageRangeLabel: z.string(),
  ageMin: z.number().int().min(0),
  ageMax: z.number().int().nullable(),
  evaluationMethod: EvaluationMethodSchema,
  vitalRule: VitalRuleSchema.optional(),
});

// ─── Phase 1: Extraction Output ────────────────────────────────────
export const ExtractedFieldsSchema = z.object({
  age: z.number().int().nullable(),
  sbp: z.number().nullable(),
  hr: z.number().nullable(),
  rr: z.number().nullable(),
  gcs: z.number().nullable(),
  airwayStatus: z.string().nullable(),
  breathingStatus: z.string().nullable(),
  mechanism: z.string().nullable(),
  injuries: z.array(z.string()).nullable(),
  additionalContext: z.string().nullable(),
});

export const PlausibilityWarningSchema = z.object({
  field: z.string(),
  value: z.number(),
  message: z.string(),
});

// ─── Phase 2: Criterion Match ──────────────────────────────────────
export const CriterionMatchSchema = z.object({
  criterionId: z.number().int(),
  description: z.string(),
  activationLevel: ActivationLevelSchema,
  category: CategorySchema,
  ageRangeLabel: z.string(),
  source: MatchSourceSchema,
  confidence: z.number().min(0).max(1).optional(),
  triggerReason: z.string(),
});

// ─── Phase 3: Final Evaluation Result ──────────────────────────────
export const EvaluationResultSchema = z.object({
  extractedFields: ExtractedFieldsSchema,
  plausibilityWarnings: z.array(PlausibilityWarningSchema),
  criteriaMatches: z.array(CriterionMatchSchema),
  activationLevel: FinalActivationLevelSchema,
  justification: z.string(),
  agentReasoning: z.string(),
  missingFieldWarnings: z.array(z.string()),
});

// ─── SSE Event Types (discriminated union) ─────────────────────────
export const PhaseEventSchema = z.object({
  type: z.literal("phase"),
  phase: z.enum(["extracting", "evaluating_vitals", "analyzing_mechanism", "complete"]),
});

export const ExtractionEventSchema = z.object({
  type: z.literal("extraction"),
  data: ExtractedFieldsSchema,
  warnings: z.array(PlausibilityWarningSchema),
});

export const DeterministicEventSchema = z.object({
  type: z.literal("deterministic"),
  matches: z.array(CriterionMatchSchema),
});

export const LlmEvaluationEventSchema = z.object({
  type: z.literal("llm_evaluation"),
  matches: z.array(CriterionMatchSchema),
  reasoning: z.string(),
});

export const ResultEventSchema = z.object({
  type: z.literal("result"),
  data: EvaluationResultSchema,
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  phase: z.string(),
  canRetry: z.boolean(),
});

export const SSEEventSchema = z.discriminatedUnion("type", [
  PhaseEventSchema,
  ExtractionEventSchema,
  DeterministicEventSchema,
  LlmEvaluationEventSchema,
  ResultEventSchema,
  ErrorEventSchema,
]);
