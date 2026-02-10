import type { ExtractedFields } from "$lib/types/index.js";
import { LlmExtractionResponseSchema } from "$lib/types/schemas.js";
import { getClient, EXTRACTION_MODEL } from "./anthropic.js";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL } from "./prompts.js";

export async function extractFields(report: string): Promise<{
  fields: ExtractedFields;
  isTraumaReport: boolean;
}> {
  const client = getClient();

  const response = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "extract_trauma_fields" },
    messages: [
      {
        role: "user",
        content:
          `Extract structured fields from this EMS trauma report. ` +
          `The text may be a speech-to-text transcription with recognition errors, or a typed narrative.\n\n${report}`,
      },
    ],
  });

  const toolBlock = response.content.find(
    (block): block is Extract<(typeof response.content)[number], { type: "tool_use" }> =>
      block.type === "tool_use",
  );

  if (!toolBlock) {
    throw new Error("LLM did not return a tool_use response");
  }

  const input = LlmExtractionResponseSchema.parse(toolBlock.input);

  return {
    isTraumaReport: input.isTraumaReport,
    fields: {
      age: input.age,
      sbp: input.sbp,
      hr: input.hr,
      rr: input.rr,
      gcs: input.gcs,
      airwayStatus: input.airwayStatus,
      breathingStatus: input.breathingStatus,
      mechanism: input.mechanism,
      injuries: input.injuries,
      additionalContext: input.additionalContext,
    },
  };
}
