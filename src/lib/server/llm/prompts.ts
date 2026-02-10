import type Anthropic from "@anthropic-ai/sdk";
import type { Criterion } from "$lib/types/index.js";

export const EXTRACTION_SYSTEM_PROMPT = `You are a medical data extraction assistant for a trauma triage system. Your job is to extract structured clinical fields from free-text EMS trauma reports.

Rules:
- Extract numeric values as integers where applicable (age, SBP, HR, RR, GCS)
- If a value is not mentioned or cannot be determined, return null
- For injuries, return an array of strings describing each injury
- Determine if the input is actually a trauma/EMS report (isTraumaReport)
- Be generous in interpretation — EMS reports come in many formats (MIST, SOAP, free-form narrative)
- Input may be raw speech-to-text transcription with recognition mistakes, missing punctuation, and broken phrasing
- Treat common spoken EMS shorthand/slang (e.g., GCS, SBP/BP, EtOH, GSW, MVC, MCC, peds/pedestrian struck) as high-signal context
- Correct likely transcription mistakes only when context makes the meaning clear
- If a value remains ambiguous after contextual interpretation, return null (do not guess)
- Preserve uncertain but clinically relevant clues in additionalContext`;

export const EXTRACTION_TOOL: Anthropic.Messages.Tool = {
  name: "extract_trauma_fields",
  description: "Extract structured clinical fields from a free-text EMS trauma report.",
  input_schema: {
    type: "object" as const,
    properties: {
      isTraumaReport: {
        type: "boolean",
        description: "Whether the input appears to be a trauma/EMS report",
      },
      age: {
        type: ["integer", "null"],
        description: "Patient age in years",
      },
      sbp: {
        type: ["integer", "null"],
        description: "Systolic Blood Pressure in mmHg",
      },
      hr: {
        type: ["integer", "null"],
        description: "Heart Rate in bpm",
      },
      rr: {
        type: ["integer", "null"],
        description: "Respiratory Rate in breaths/min",
      },
      gcs: {
        type: ["integer", "null"],
        description: "Glasgow Coma Scale score (3-15)",
      },
      airwayStatus: {
        type: ["string", "null"],
        description: 'Airway status description (e.g., "Intubated", "Patent")',
      },
      breathingStatus: {
        type: ["string", "null"],
        description: "Breathing status description",
      },
      mechanism: {
        type: ["string", "null"],
        description: "Mechanism of injury description",
      },
      injuries: {
        type: ["array", "null"],
        items: { type: "string" },
        description: "List of identified injuries",
      },
      additionalContext: {
        type: ["string", "null"],
        description: "Other relevant clinical context",
      },
    },
    required: [
      "isTraumaReport",
      "age",
      "sbp",
      "hr",
      "rr",
      "gcs",
      "airwayStatus",
      "breathingStatus",
      "mechanism",
      "injuries",
      "additionalContext",
    ],
  },
};

export function buildEvaluationSystemPrompt(criteria: Criterion[]): string {
  const criteriaList = criteria
    .map((c) => `- [ID ${c.id}] (${c.activationLevel}, ${c.category}) ${c.description}`)
    .join("\n");

  return `You are a trauma triage evaluation assistant. Given extracted clinical information from an EMS report, evaluate each of the following criteria and determine which ones are met.

CRITERIA TO EVALUATE:
${criteriaList}

Rules:
- Only match criteria that are clearly supported by the clinical information
- Assign a confidence score (0-1) to each match: 1.0 = definitive, 0.7-0.9 = highly likely, 0.5-0.7 = possible
- For hybrid criteria (marked with qualitative conditions), evaluate the qualitative condition (e.g., "poor perfusion")
- Provide a clear trigger_reason explaining why each criterion was matched
- Provide a reasoning_narrative explaining your overall evaluation logic`;
}

export function buildEvaluationTool(hybridIds: number[]): Anthropic.Messages.Tool {
  return {
    name: "evaluate_criteria",
    description:
      "Evaluate trauma triage criteria against extracted patient data and return matches.",
    input_schema: {
      type: "object" as const,
      properties: {
        matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion_id: { type: "integer", description: "The criterion ID that was matched" },
              confidence: { type: "number", description: "Confidence score 0-1" },
              trigger_reason: { type: "string", description: "Why this criterion was triggered" },
            },
            required: ["criterion_id", "confidence", "trigger_reason"],
          },
          description: "List of matched criteria",
        },
        hybrid_confirmations: {
          type: "array",
          items: { type: "integer" },
          description: `Criterion IDs from the hybrid list where the qualitative condition is confirmed. Hybrid IDs to evaluate: [${hybridIds.join(", ")}]`,
        },
        reasoning_narrative: {
          type: "string",
          description: "Step-by-step explanation of evaluation logic",
        },
      },
      required: ["matches", "hybrid_confirmations", "reasoning_narrative"],
    },
  };
}
