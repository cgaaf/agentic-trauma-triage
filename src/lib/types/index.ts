import type { z } from "zod";
import type {
  VitalRuleSchema,
  CriterionSchema,
  ExtractedFieldsSchema,
  PlausibilityWarningSchema,
  CriterionMatchSchema,
  EvaluationResultSchema,
  SSEEventSchema,
  ActivationLevelSchema,
  FinalActivationLevelSchema,
  CategorySchema,
  EvaluationMethodSchema,
  MatchSourceSchema,
  VitalFieldSchema,
  VitalOperatorSchema,
  LlmExtractionResponseSchema,
  LlmEvaluationResponseSchema,
} from "./schemas.js";

export type VitalRule = z.infer<typeof VitalRuleSchema>;
export type Criterion = z.infer<typeof CriterionSchema>;
export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;
export type PlausibilityWarning = z.infer<typeof PlausibilityWarningSchema>;
export type CriterionMatch = z.infer<typeof CriterionMatchSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
export type ActivationLevel = z.infer<typeof ActivationLevelSchema>;
export type FinalActivationLevel = z.infer<typeof FinalActivationLevelSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type EvaluationMethod = z.infer<typeof EvaluationMethodSchema>;
export type MatchSource = z.infer<typeof MatchSourceSchema>;
export type VitalField = z.infer<typeof VitalFieldSchema>;
export type VitalOperator = z.infer<typeof VitalOperatorSchema>;
export type LlmExtractionResponse = z.infer<typeof LlmExtractionResponseSchema>;
export type LlmEvaluationResponse = z.infer<typeof LlmEvaluationResponseSchema>;
