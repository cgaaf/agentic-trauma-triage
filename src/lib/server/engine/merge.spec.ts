import { describe, it, expect } from "vitest";
import { mergeMatches, determineActivationLevel, buildJustification } from "./merge.js";
import type { CriterionMatch } from "$lib/types/index.js";

function makeMatch(overrides: Partial<CriterionMatch> = {}): CriterionMatch {
  return {
    criterionId: 1,
    description: "Test criterion",
    activationLevel: "Level 1",
    category: "Adult",
    ageRangeLabel: "16 - 64",
    source: "deterministic",
    triggerReason: "GCS = 8 < 12",
    ...overrides,
  };
}

describe("mergeMatches", () => {
  it("combines matches from multiple sources", () => {
    const a = [makeMatch({ criterionId: 1 })];
    const b = [
      makeMatch({ criterionId: 26, activationLevel: "Level 2", triggerReason: "GCS = 12" }),
    ];
    const merged = mergeMatches(a, b);
    expect(merged).toHaveLength(2);
  });

  it("deduplicates by criterion ID", () => {
    const a = [makeMatch({ criterionId: 1, source: "deterministic" })];
    const b = [makeMatch({ criterionId: 1, source: "llm" })];
    const merged = mergeMatches(a, b);
    expect(merged).toHaveLength(1);
  });

  it("prefers deterministic over llm source", () => {
    const a = [makeMatch({ criterionId: 1, source: "llm" })];
    const b = [makeMatch({ criterionId: 1, source: "deterministic" })];
    const merged = mergeMatches(a, b);
    expect(merged[0].source).toBe("deterministic");
  });

  it("handles empty arrays", () => {
    const merged = mergeMatches([], [], []);
    expect(merged).toHaveLength(0);
  });
});

describe("determineActivationLevel", () => {
  it("returns Standard Triage for no matches", () => {
    expect(determineActivationLevel([])).toBe("Standard Triage");
  });

  it("returns Level 1 as highest", () => {
    const matches = [
      makeMatch({ activationLevel: "Level 2" }),
      makeMatch({ criterionId: 2, activationLevel: "Level 1" }),
    ];
    expect(determineActivationLevel(matches)).toBe("Level 1");
  });

  it("returns Level 2 when no Level 1", () => {
    const matches = [
      makeMatch({ activationLevel: "Level 2" }),
      makeMatch({ criterionId: 2, activationLevel: "Level 3" }),
    ];
    expect(determineActivationLevel(matches)).toBe("Level 2");
  });

  it("returns Level 3 when it is the only level", () => {
    const matches = [makeMatch({ activationLevel: "Level 3" })];
    expect(determineActivationLevel(matches)).toBe("Level 3");
  });
});

describe("buildJustification", () => {
  it("returns standard triage message when no matches", () => {
    const result = buildJustification("Standard Triage", []);
    expect(result).toContain("No trauma activation criteria");
  });

  it("includes trigger reasons for matched level", () => {
    const matches = [
      makeMatch({ activationLevel: "Level 1", triggerReason: "GCS = 8 < 12" }),
      makeMatch({ criterionId: 3, activationLevel: "Level 1", triggerReason: "SBP = 75 < 90" }),
    ];
    const result = buildJustification("Level 1", matches);
    expect(result).toContain("GCS = 8 < 12");
    expect(result).toContain("SBP = 75 < 90");
  });
});
