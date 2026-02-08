import { describe, it, expect } from "vitest";
import { CRITERIA, CRITERIA_MAP } from "./criteria.js";
import { CriterionSchema } from "$lib/types/schemas.js";

describe("Criteria data integrity", () => {
  it("contains exactly 137 criteria", () => {
    expect(CRITERIA).toHaveLength(137);
  });

  it("has unique IDs", () => {
    const ids = CRITERIA.map((c) => c.id);
    expect(new Set(ids).size).toBe(137);
  });

  it("has 20 deterministic criteria", () => {
    const deterministic = CRITERIA.filter((c) => c.evaluationMethod === "deterministic");
    expect(deterministic).toHaveLength(20);
  });

  it("has 2 hybrid criteria", () => {
    const hybrid = CRITERIA.filter((c) => c.evaluationMethod === "hybrid");
    expect(hybrid).toHaveLength(2);
  });

  it("has 115 LLM criteria", () => {
    const llm = CRITERIA.filter((c) => c.evaluationMethod === "llm");
    expect(llm).toHaveLength(115);
  });

  it("every criterion passes Zod schema validation", () => {
    for (const criterion of CRITERIA) {
      const result = CriterionSchema.safeParse(criterion);
      expect(
        result.success,
        `Criterion ${criterion.id} failed validation: ${JSON.stringify(result)}`,
      ).toBe(true);
    }
  });

  it("every deterministic criterion has a vitalRule", () => {
    const deterministic = CRITERIA.filter((c) => c.evaluationMethod === "deterministic");
    for (const c of deterministic) {
      expect(c.vitalRule, `Criterion ${c.id} (deterministic) missing vitalRule`).toBeDefined();
    }
  });

  it("every hybrid criterion has a vitalRule with requiresLlmConfirmation", () => {
    const hybrid = CRITERIA.filter((c) => c.evaluationMethod === "hybrid");
    for (const c of hybrid) {
      expect(c.vitalRule, `Criterion ${c.id} (hybrid) missing vitalRule`).toBeDefined();
      expect(
        c.vitalRule!.requiresLlmConfirmation,
        `Criterion ${c.id} (hybrid) missing requiresLlmConfirmation`,
      ).toBeDefined();
    }
  });

  it("LLM criteria do not have vitalRules", () => {
    const llm = CRITERIA.filter((c) => c.evaluationMethod === "llm");
    for (const c of llm) {
      expect(c.vitalRule, `Criterion ${c.id} (llm) should not have vitalRule`).toBeUndefined();
    }
  });

  it("CRITERIA_MAP contains all criteria", () => {
    expect(CRITERIA_MAP.size).toBe(137);
    for (const c of CRITERIA) {
      expect(CRITERIA_MAP.get(c.id)).toBe(c);
    }
  });

  it("geriatric criteria have null ageMax", () => {
    const geriatric = CRITERIA.filter((c) => c.category === "Geriatric");
    for (const c of geriatric) {
      expect(c.ageMax, `Geriatric criterion ${c.id} should have null ageMax`).toBeNull();
    }
  });

  it("all ageMin values are non-negative", () => {
    for (const c of CRITERIA) {
      expect(c.ageMin >= 0, `Criterion ${c.id} has negative ageMin: ${c.ageMin}`).toBe(true);
    }
  });

  it("known specific criteria exist with correct rules", () => {
    // Adult GCS < 12
    const c1 = CRITERIA_MAP.get(1)!;
    expect(c1.vitalRule!.field).toBe("gcs");
    expect(c1.vitalRule!.operator).toBe("<");
    expect(c1.vitalRule!.threshold).toBe(12);

    // Adult SBP < 90
    const c3 = CRITERIA_MAP.get(3)!;
    expect(c3.vitalRule!.field).toBe("sbp");
    expect(c3.vitalRule!.threshold).toBe(90);

    // Geriatric SBP < 110
    const c101 = CRITERIA_MAP.get(101)!;
    expect(c101.vitalRule!.field).toBe("sbp");
    expect(c101.vitalRule!.threshold).toBe(110);

    // Pediatric SBP < 70 for age 0-1
    const c48 = CRITERIA_MAP.get(48)!;
    expect(c48.ageMin).toBe(0);
    expect(c48.ageMax).toBe(1);
    expect(c48.vitalRule!.threshold).toBe(70);

    // GCS range (12 or 13) criteria
    for (const id of [26, 78, 123]) {
      const c = CRITERIA_MAP.get(id)!;
      expect(c.vitalRule!.operator).toBe("range");
      expect(c.vitalRule!.threshold).toBe(12);
      expect(c.vitalRule!.thresholdHigh).toBe(13);
    }

    // Hybrid HR criteria
    const c2 = CRITERIA_MAP.get(2)!;
    expect(c2.vitalRule!.field).toBe("hr");
    expect(c2.vitalRule!.operator).toBe(">");
    expect(c2.vitalRule!.threshold).toBe(100);
    expect(c2.vitalRule!.requiresLlmConfirmation).toBe("poor perfusion");

    const c100 = CRITERIA_MAP.get(100)!;
    expect(c100.vitalRule!.field).toBe("hr");
    expect(c100.vitalRule!.threshold).toBe(90);
  });
});
