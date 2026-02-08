import type { Criterion, CriterionMatch, ExtractedFields, VitalRule } from "$lib/types/index.js";

export interface DeterministicResult {
  matches: CriterionMatch[];
  hybridPending: Criterion[];
}

/** Evaluate a single vital rule against an extracted value. Returns true if the rule is triggered. */
function evaluateRule(value: number, rule: VitalRule): boolean {
  switch (rule.operator) {
    case "<":
      return value < rule.threshold;
    case "<=":
      return value <= rule.threshold;
    case ">":
      return value > rule.threshold;
    case ">=":
      return value >= rule.threshold;
    case "==":
      return value === rule.threshold;
    case "range":
      if (rule.thresholdHigh == null) throw new Error("Range rule missing thresholdHigh");
      return value >= rule.threshold && value <= rule.thresholdHigh;
    default: {
      const _exhaustive: never = rule.operator;
      throw new Error(`Unknown operator: ${_exhaustive}`);
    }
  }
}

/** Generate a human-readable trigger reason string. */
function buildTriggerReason(field: string, value: number, rule: VitalRule): string {
  const fieldLabel = field.toUpperCase();
  switch (rule.operator) {
    case "<":
      return `${fieldLabel} = ${value} < ${rule.threshold}`;
    case "<=":
      return `${fieldLabel} = ${value} <= ${rule.threshold}`;
    case ">":
      return `${fieldLabel} = ${value} > ${rule.threshold}`;
    case ">=":
      return `${fieldLabel} = ${value} >= ${rule.threshold}`;
    case "==":
      return `${fieldLabel} = ${value} == ${rule.threshold}`;
    case "range":
      return `${fieldLabel} = ${value} (in range ${rule.threshold}-${rule.thresholdHigh})`;
    default: {
      const _exhaustive: never = rule.operator;
      throw new Error(`Unknown operator: ${_exhaustive}`);
    }
  }
}

/**
 * Evaluate all deterministic and hybrid criteria against extracted fields.
 * Returns confirmed deterministic matches and hybrid criteria pending LLM confirmation.
 */
export function evaluateDeterministic(
  fields: ExtractedFields,
  criteria: Criterion[],
): DeterministicResult {
  const matches: CriterionMatch[] = [];
  const hybridPending: Criterion[] = [];

  const deterministicAndHybrid = criteria.filter(
    (c) => c.evaluationMethod === "deterministic" || c.evaluationMethod === "hybrid",
  );

  for (const criterion of deterministicAndHybrid) {
    const rule = criterion.vitalRule;
    if (!rule) continue;

    const value = fields[rule.field];
    if (value === null || value === undefined) continue;

    const triggered = evaluateRule(value, rule);
    if (!triggered) continue;

    if (criterion.evaluationMethod === "hybrid") {
      hybridPending.push(criterion);
    } else {
      matches.push({
        criterionId: criterion.id,
        description: criterion.description,
        activationLevel: criterion.activationLevel,
        category: criterion.category,
        ageRangeLabel: criterion.ageRangeLabel,
        source: "deterministic",
        triggerReason: buildTriggerReason(rule.field, value, rule),
      });
    }
  }

  return { matches, hybridPending };
}
