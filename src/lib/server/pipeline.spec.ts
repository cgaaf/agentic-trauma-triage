import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedFields, SSEEvent } from "$lib/types/index.js";

const mockPipelineState = vi.hoisted(() => ({
  extractFields: vi.fn(),
  evaluateWithLlm: vi.fn(),
}));

vi.mock("$lib/server/llm/extraction.js", () => ({
  extractFields: (report: string) => mockPipelineState.extractFields(report),
}));

vi.mock("$lib/server/llm/evaluation.js", () => ({
  evaluateWithLlm: (
    fields: ExtractedFields,
    llmOnlyCriteria: unknown[],
    hybridCriteria: unknown[],
  ) => mockPipelineState.evaluateWithLlm(fields, llmOnlyCriteria, hybridCriteria),
}));

const { runPipeline } = await import("./pipeline.js");

function makeFields(overrides: Partial<ExtractedFields> = {}): ExtractedFields {
  return {
    age: 42,
    sbp: 120,
    hr: 80,
    rr: 16,
    gcs: 15,
    airwayStatus: null,
    breathingStatus: null,
    mechanism: null,
    injuries: null,
    additionalContext: null,
    ...overrides,
  };
}

async function collectEvents(report = "EMS trauma narrative"): Promise<SSEEvent[]> {
  const events: SSEEvent[] = [];
  for await (const event of runPipeline(report)) {
    events.push(event);
  }
  return events;
}

beforeEach(() => {
  mockPipelineState.extractFields.mockReset();
  mockPipelineState.evaluateWithLlm.mockReset();

  mockPipelineState.extractFields.mockResolvedValue({
    isTraumaReport: true,
    fields: makeFields(),
  });
  mockPipelineState.evaluateWithLlm.mockResolvedValue({
    matches: [],
    hybridConfirmations: [],
    reasoning: "",
  });
});

describe("runPipeline", () => {
  it("emits extraction error and exits when extractFields throws", async () => {
    mockPipelineState.extractFields.mockRejectedValueOnce(new Error("anthropic unavailable"));

    const events = await collectEvents();

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: "phase", phase: "extracting" });
    expect(events[1]).toMatchObject({
      type: "error",
      phase: "extraction",
      canRetry: true,
    });
    if (events[1]?.type === "error") {
      expect(events[1].message).toContain("anthropic unavailable");
    }
  });

  it("emits non-retry extraction error when report is not trauma-relevant", async () => {
    mockPipelineState.extractFields.mockResolvedValueOnce({
      isTraumaReport: false,
      fields: makeFields(),
    });

    const events = await collectEvents("shopping list text");

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: "phase", phase: "extracting" });
    expect(events[1]).toMatchObject({
      type: "error",
      phase: "extraction",
      canRetry: false,
    });
    if (events[1]?.type === "error") {
      expect(events[1].message).toContain("doesn't appear to be a trauma/EMS report");
    }
  });

  it("emits non-retry extraction error when age cannot be determined", async () => {
    mockPipelineState.extractFields.mockResolvedValueOnce({
      isTraumaReport: true,
      fields: makeFields({ age: null }),
    });

    const events = await collectEvents();

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: "phase", phase: "extracting" });
    expect(events[1]).toMatchObject({
      type: "error",
      phase: "extraction",
      canRetry: false,
    });
    if (events[1]?.type === "error") {
      expect(events[1].message).toContain("Age could not be determined");
    }
  });

  it("continues to completion with deterministic output when LLM evaluation fails", async () => {
    mockPipelineState.extractFields.mockResolvedValueOnce({
      isTraumaReport: true,
      fields: makeFields({
        gcs: 8,
        sbp: 75,
      }),
    });
    mockPipelineState.evaluateWithLlm.mockRejectedValueOnce(new Error("LLM timeout"));

    const events = await collectEvents();
    const phases = events
      .filter((event): event is Extract<SSEEvent, { type: "phase" }> => event.type === "phase")
      .map((event) => event.phase);
    const llmError = events.find(
      (event): event is Extract<SSEEvent, { type: "error" }> =>
        event.type === "error" && event.phase === "llm_evaluation",
    );
    const resultEvent = events.find(
      (event): event is Extract<SSEEvent, { type: "result" }> => event.type === "result",
    );

    expect(phases).toEqual(["extracting", "evaluating_vitals", "analyzing_mechanism", "complete"]);
    expect(llmError).toMatchObject({
      type: "error",
      phase: "llm_evaluation",
      canRetry: true,
    });
    expect(llmError?.message).toContain("Deterministic results are still valid.");
    expect(resultEvent).toBeDefined();
    expect(resultEvent?.data.agentReasoning).toBe("");
    expect(resultEvent?.data.criteriaMatches.length).toBeGreaterThan(0);
    expect(resultEvent?.data.activationLevel).toBe("Level 1");
  });
});
