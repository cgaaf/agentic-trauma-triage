import type { Criterion, CriterionMatch, ExtractedFields } from "$lib/types/index.js";
import { CRITERIA_MAP } from "$lib/server/criteria/criteria.js";
import { getClient, EVALUATION_MODEL } from "./anthropic.js";
import { buildEvaluationSystemPrompt, buildEvaluationTool } from "./prompts.js";

export async function evaluateWithLlm(
  fields: ExtractedFields,
  llmCriteria: Criterion[],
  hybridCriteria: Criterion[],
): Promise<{
  matches: CriterionMatch[];
  hybridConfirmations: number[];
  reasoning: string;
}> {
  const allCriteria = [...llmCriteria, ...hybridCriteria];
  if (allCriteria.length === 0) {
    return { matches: [], hybridConfirmations: [], reasoning: "No criteria to evaluate." };
  }

  const client = getClient();
  const hybridIds = hybridCriteria.map((c) => c.id);
  const tool = buildEvaluationTool(hybridIds);

  const fieldsDescription = [
    fields.age !== null ? `Age: ${fields.age}` : null,
    fields.sbp !== null ? `SBP: ${fields.sbp} mmHg` : null,
    fields.hr !== null ? `HR: ${fields.hr} bpm` : null,
    fields.rr !== null ? `RR: ${fields.rr} breaths/min` : null,
    fields.gcs !== null ? `GCS: ${fields.gcs}` : null,
    fields.airwayStatus ? `Airway: ${fields.airwayStatus}` : null,
    fields.breathingStatus ? `Breathing: ${fields.breathingStatus}` : null,
    fields.mechanism ? `Mechanism: ${fields.mechanism}` : null,
    fields.injuries?.length ? `Injuries: ${fields.injuries.join(", ")}` : null,
    fields.additionalContext ? `Additional: ${fields.additionalContext}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: EVALUATION_MODEL,
    max_tokens: 4096,
    system: buildEvaluationSystemPrompt(allCriteria),
    tools: [tool],
    tool_choice: { type: "tool", name: "evaluate_criteria" },
    messages: [
      {
        role: "user",
        content: `Evaluate the following extracted patient data against the criteria:\n\n${fieldsDescription}`,
      },
    ],
  });

  const toolBlock = response.content.find(
    (block): block is Extract<(typeof response.content)[number], { type: "tool_use" }> =>
      block.type === "tool_use",
  );

  if (!toolBlock) {
    throw new Error("LLM did not return a tool_use response for evaluation");
  }

  const input = toolBlock.input as {
    matches: Array<{ criterion_id: number; confidence: number; trigger_reason: string }>;
    hybrid_confirmations: number[];
    reasoning_narrative: string;
  };

  const matches: CriterionMatch[] = [];
  for (const m of input.matches) {
    const criterion = CRITERIA_MAP.get(m.criterion_id);
    if (!criterion) continue;
    matches.push({
      criterionId: m.criterion_id,
      description: criterion.description,
      activationLevel: criterion.activationLevel,
      category: criterion.category,
      ageRangeLabel: criterion.ageRangeLabel,
      source: "llm" as const,
      confidence: m.confidence,
      triggerReason: m.trigger_reason,
    });
  }

  return {
    matches,
    hybridConfirmations: input.hybrid_confirmations ?? [],
    reasoning: input.reasoning_narrative,
  };
}
