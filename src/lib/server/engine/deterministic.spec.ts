import { describe, it, expect } from "vitest";
import { evaluateDeterministic } from "./deterministic.js";
import { filterCriteriaByAge } from "./age-filter.js";
import { checkPlausibility } from "./plausibility.js";
import { CRITERIA } from "$lib/server/criteria/criteria.js";
import type { ExtractedFields } from "$lib/types/index.js";

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

describe("Age filter", () => {
  it("filters adult criteria for age 42", () => {
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    expect(filtered.length).toBeGreaterThan(0);
    // Should include Adult criteria (16-64) but not Pediatric or Geriatric
    expect(filtered.every((c) => 42 >= c.ageMin && (c.ageMax === null || 42 <= c.ageMax))).toBe(
      true,
    );
  });

  it("filters pediatric criteria for age 5", () => {
    const filtered = filterCriteriaByAge(CRITERIA, 5);
    // Should include pediatric criteria but not adult-only criteria (ageMin=16)
    expect(filtered.some((c) => c.category === "Pediatric")).toBe(true);
    expect(filtered.every((c) => c.ageMin <= 5)).toBe(true);
  });

  it("filters geriatric criteria for age 70", () => {
    const filtered = filterCriteriaByAge(CRITERIA, 70);
    expect(filtered.some((c) => c.category === "Geriatric")).toBe(true);
    // Should NOT include pediatric or most adult L3 criteria (ageMax=64)
    expect(filtered.every((c) => c.ageMax === null || c.ageMax >= 70)).toBe(true);
  });

  it("boundary age 16 includes both Adult L1/L2 and Pediatric L3 criteria", () => {
    const filtered = filterCriteriaByAge(CRITERIA, 16);
    const adultCriteria = filtered.filter((c) => c.category === "Adult");
    const pediatricCriteria = filtered.filter((c) => c.category === "Pediatric");
    expect(adultCriteria.length).toBeGreaterThan(0);
    // Pediatric L3 goes up to age 17
    expect(pediatricCriteria.some((c) => c.activationLevel === "Level 3")).toBe(true);
  });

  it("boundary age 65 includes both Adult and Geriatric criteria", () => {
    const filtered = filterCriteriaByAge(CRITERIA, 65);
    expect(filtered.some((c) => c.category === "Geriatric")).toBe(true);
    // Adult criteria with ageMax=64 should NOT be included
    expect(filtered.every((c) => c.ageMax === null || c.ageMax >= 65)).toBe(true);
  });
});

describe("Deterministic engine", () => {
  it("detects GCS < 12 for adult", () => {
    const fields = makeFields({ gcs: 8 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches.some((m) => m.criterionId === 1)).toBe(true);
    expect(result.matches.find((m) => m.criterionId === 1)!.triggerReason).toBe("GCS = 8 < 12");
  });

  it("does NOT trigger GCS < 12 when GCS = 12", () => {
    const fields = makeFields({ gcs: 12 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches.some((m) => m.criterionId === 1)).toBe(false);
  });

  it("detects GCS == 12 or 13 (range) for adult", () => {
    const fields12 = makeFields({ gcs: 12 });
    const fields13 = makeFields({ gcs: 13 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);

    const result12 = evaluateDeterministic(fields12, filtered);
    expect(result12.matches.some((m) => m.criterionId === 26)).toBe(true);

    const result13 = evaluateDeterministic(fields13, filtered);
    expect(result13.matches.some((m) => m.criterionId === 26)).toBe(true);
  });

  it("does NOT trigger GCS range when GCS = 14", () => {
    const fields = makeFields({ gcs: 14 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches.some((m) => m.criterionId === 26)).toBe(false);
  });

  it("detects SBP < 90 for adult", () => {
    const fields = makeFields({ sbp: 75 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches.some((m) => m.criterionId === 3)).toBe(true);
  });

  it("detects SBP < 110 for geriatric", () => {
    const fields = makeFields({ age: 70, sbp: 105 });
    const filtered = filterCriteriaByAge(CRITERIA, 70);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches.some((m) => m.criterionId === 101)).toBe(true);
  });

  it("detects pediatric SBP by age-specific threshold (5yo, SBP < 80)", () => {
    const fields = makeFields({ age: 5, sbp: 78 });
    const filtered = filterCriteriaByAge(CRITERIA, 5);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches.some((m) => m.criterionId === 52)).toBe(true);
  });

  it("does NOT trigger pediatric SBP for wrong age range", () => {
    // Criterion 48 is SBP < 70 for age 0-1; a 5-year-old should not match it
    const fields = makeFields({ age: 5, sbp: 65 });
    const filtered = filterCriteriaByAge(CRITERIA, 5);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches.some((m) => m.criterionId === 48)).toBe(false);
  });

  it("detects RR < 10 and RR > 29 for adults only", () => {
    const lowRR = makeFields({ rr: 8 });
    const highRR = makeFields({ rr: 32 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);

    const resultLow = evaluateDeterministic(lowRR, filtered);
    expect(resultLow.matches.some((m) => m.criterionId === 4)).toBe(true);

    const resultHigh = evaluateDeterministic(highRR, filtered);
    expect(resultHigh.matches.some((m) => m.criterionId === 5)).toBe(true);
  });

  it("does NOT have RR criteria for pediatric patients", () => {
    const fields = makeFields({ age: 5, rr: 5 });
    const filtered = filterCriteriaByAge(CRITERIA, 5);
    const result = evaluateDeterministic(fields, filtered);
    // No criterion IDs 4 or 5 should appear (they're adult-only)
    expect(result.matches.some((m) => m.criterionId === 4)).toBe(false);
    expect(result.matches.some((m) => m.criterionId === 5)).toBe(false);
  });

  it("hybrid criteria go to hybridPending", () => {
    const fields = makeFields({ hr: 110 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    // Criterion 2: Adult HR > 100 AND poor perfusion
    expect(result.hybridPending.some((c) => c.id === 2)).toBe(true);
    expect(result.matches.some((m) => m.criterionId === 2)).toBe(false);
  });

  it("geriatric hybrid HR > 90 goes to hybridPending", () => {
    const fields = makeFields({ age: 70, hr: 95 });
    const filtered = filterCriteriaByAge(CRITERIA, 70);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.hybridPending.some((c) => c.id === 100)).toBe(true);
  });

  it("does NOT trigger hybrid when HR is below threshold", () => {
    const fields = makeFields({ hr: 95 });
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.hybridPending.some((c) => c.id === 2)).toBe(false);
  });

  it("skips criteria when the relevant field is null", () => {
    const fields = makeFields({ gcs: null, sbp: null });
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches).toHaveLength(0);
    expect(result.hybridPending).toHaveLength(0);
  });

  it("normal vitals produce no matches", () => {
    const fields = makeFields();
    const filtered = filterCriteriaByAge(CRITERIA, 42);
    const result = evaluateDeterministic(fields, filtered);
    expect(result.matches).toHaveLength(0);
    expect(result.hybridPending).toHaveLength(0);
  });
});

describe("Plausibility checker", () => {
  it("returns no warnings for normal values", () => {
    const fields = makeFields();
    expect(checkPlausibility(fields)).toHaveLength(0);
  });

  it("warns about out-of-range SBP", () => {
    const fields = makeFields({ sbp: 350 });
    const warnings = checkPlausibility(fields);
    expect(warnings.some((w) => w.field === "sbp")).toBe(true);
  });

  it("warns about GCS out of range", () => {
    const fields = makeFields({ gcs: 1 });
    const warnings = checkPlausibility(fields);
    expect(warnings.some((w) => w.field === "gcs")).toBe(true);
  });

  it("does not warn about null values", () => {
    const fields = makeFields({ sbp: null, hr: null });
    expect(checkPlausibility(fields)).toHaveLength(0);
  });
});
