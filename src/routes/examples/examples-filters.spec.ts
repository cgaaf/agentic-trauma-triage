import { describe, it, expect } from "vitest";
import type { ExampleWithCriterion } from "$lib/types/database.js";
import {
  parseRange,
  parseFiltersFromUrl,
  filterExamples,
  buildFilterParams,
  buildUpdatedParams,
  countActiveFilters,
  defaultFilterState,
  VITAL_DEFAULTS,
  NULL_FILTER_COLUMNS,
  type ExamplesFilterState,
  type NullFilterColumn,
  type VitalParamKey,
} from "./examples-filters.js";

// ─── Factories ───────────────────────────────────────────────────

function makeExample(overrides: Partial<ExampleWithCriterion> = {}): ExampleWithCriterion {
  return {
    id: 1,
    criteria_id: 100,
    mechanism: "Fall from height",
    descriptors: "20ft fall onto concrete",
    age: 42,
    gender: "male",
    gcs: 15,
    systolic_bp: 120,
    heart_rate: 80,
    respiratory_rate: 16,
    oxygen_saturation: 98,
    pregnancy_in_weeks: null,
    airway: "patent",
    breathing: "Breathing Independently",
    criteria: { description: "Fall > 20 feet" },
    ...overrides,
  };
}

function makeFilters(overrides: Partial<ExamplesFilterState> = {}): ExamplesFilterState {
  const defaults = defaultFilterState();
  return {
    ...defaults,
    ...overrides,
    vitalRanges: { ...defaults.vitalRanges, ...overrides.vitalRanges },
    nullFilters: { ...defaults.nullFilters, ...overrides.nullFilters },
  };
}

// ─── parseRange ──────────────────────────────────────────────────

describe("parseRange", () => {
  it("returns null for null input", () => {
    expect(parseRange(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRange("")).toBeNull();
  });

  it("returns null for single number", () => {
    expect(parseRange("42")).toBeNull();
  });

  it("returns null for three numbers", () => {
    expect(parseRange("1,2,3")).toBeNull();
  });

  it("returns null for non-numeric values", () => {
    expect(parseRange("a,b")).toBeNull();
  });

  it("parses valid range '3,15'", () => {
    expect(parseRange("3,15")).toEqual([3, 15]);
  });

  it("parses range with decimals", () => {
    expect(parseRange("3.5,15.5")).toEqual([3.5, 15.5]);
  });

  it("parses range with negative numbers", () => {
    expect(parseRange("-10,10")).toEqual([-10, 10]);
  });

  it("parses '0,0'", () => {
    expect(parseRange("0,0")).toEqual([0, 0]);
  });
});

// ─── parseFiltersFromUrl ─────────────────────────────────────────

describe("parseFiltersFromUrl", () => {
  it("returns all defaults for empty URLSearchParams", () => {
    const result = parseFiltersFromUrl(new URLSearchParams());
    expect(result).toEqual(defaultFilterState());
  });

  it("parses GCS range", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("gcs=5,12&null_gcs=has_value"));
    expect(result.vitalRanges.gcs).toEqual([5, 12]);
  });

  it("parses SBP range", () => {
    const result = parseFiltersFromUrl(
      new URLSearchParams("sbp=80,160&null_systolic_bp=has_value"),
    );
    expect(result.vitalRanges.sbp).toEqual([80, 160]);
  });

  it("parses HR range", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("hr=50,120&null_heart_rate=has_value"));
    expect(result.vitalRanges.hr).toEqual([50, 120]);
  });

  it("parses RR range", () => {
    const result = parseFiltersFromUrl(
      new URLSearchParams("rr=12,24&null_respiratory_rate=has_value"),
    );
    expect(result.vitalRanges.rr).toEqual([12, 24]);
  });

  it("parses SpO2 range", () => {
    const result = parseFiltersFromUrl(
      new URLSearchParams("spo2=92,100&null_oxygen_saturation=has_value"),
    );
    expect(result.vitalRanges.spo2).toEqual([92, 100]);
  });

  it("falls back to VITAL_DEFAULTS for malformed range param", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("gcs=bad"));
    expect(result.vitalRanges.gcs).toEqual(VITAL_DEFAULTS.gcs);
  });

  it("parses airway category filter", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("airway=intubated"));
    expect(result.airway).toBe("intubated");
  });

  it("parses breathing category filter", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("breathing=Bagging"));
    expect(result.breathing).toBe("Bagging");
  });

  it("parses gender category filter", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("gender=female"));
    expect(result.gender).toBe("female");
  });

  it("defaults gender to empty string when absent", () => {
    const result = parseFiltersFromUrl(new URLSearchParams());
    expect(result.gender).toBe("");
  });

  it("parses mechanism search", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("search=fall"));
    expect(result.search).toBe("fall");
  });

  it("parses criterion search", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("criterion_search=penetrating"));
    expect(result.criterionSearch).toBe("penetrating");
  });

  it("parses descriptors search", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("descriptors_search=burn"));
    expect(result.descriptorsSearch).toBe("burn");
  });

  it("parses null_gender=has_value", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("null_gender=has_value"));
    expect(result.nullFilters.gender).toBe("has_value");
  });

  it("parses null_gender=is_empty", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("null_gender=is_empty"));
    expect(result.nullFilters.gender).toBe("is_empty");
  });

  it("defaults to 'all' for invalid null filter value", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("null_gender=bogus"));
    expect(result.nullFilters.gender).toBe("all");
  });

  it("backward compat: gcs param without null_gcs auto-sets to 'has_value'", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("gcs=3,15"));
    expect(result.nullFilters.gcs).toBe("has_value");
  });

  it("backward compat: sbp param without null_systolic_bp auto-sets to 'has_value'", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("sbp=80,160"));
    expect(result.nullFilters.systolic_bp).toBe("has_value");
  });

  it("backward compat: hr param without null_heart_rate auto-sets to 'has_value'", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("hr=50,120"));
    expect(result.nullFilters.heart_rate).toBe("has_value");
  });

  it("backward compat: rr param without null_respiratory_rate auto-sets to 'has_value'", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("rr=12,24"));
    expect(result.nullFilters.respiratory_rate).toBe("has_value");
  });

  it("backward compat: spo2 param without null_oxygen_saturation auto-sets to 'has_value'", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("spo2=92,100"));
    expect(result.nullFilters.oxygen_saturation).toBe("has_value");
  });

  it("backward compat: does NOT override explicit null_gcs=is_empty", () => {
    const result = parseFiltersFromUrl(new URLSearchParams("gcs=3,15&null_gcs=is_empty"));
    expect(result.nullFilters.gcs).toBe("is_empty");
  });

  it("parses complex URL with all params simultaneously", () => {
    const params = new URLSearchParams(
      "gcs=5,12&sbp=80,160&hr=50,120&rr=12,24&spo2=92,100" +
        "&airway=patent&breathing=Bagging&gender=male&search=fall&criterion_search=burn&descriptors_search=leg" +
        "&null_gcs=has_value&null_systolic_bp=has_value&null_heart_rate=has_value" +
        "&null_respiratory_rate=has_value&null_oxygen_saturation=has_value" +
        "&null_gender=has_value&null_pregnancy_in_weeks=has_value",
    );
    const result = parseFiltersFromUrl(params);

    expect(result.vitalRanges.gcs).toEqual([5, 12]);
    expect(result.vitalRanges.sbp).toEqual([80, 160]);
    expect(result.airway).toBe("patent");
    expect(result.breathing).toBe("Bagging");
    expect(result.gender).toBe("male");
    expect(result.search).toBe("fall");
    expect(result.criterionSearch).toBe("burn");
    expect(result.descriptorsSearch).toBe("leg");
    expect(result.nullFilters.gender).toBe("has_value");
    expect(result.nullFilters.pregnancy_in_weeks).toBe("has_value");
  });
});

// ─── filterExamples ──────────────────────────────────────────────

describe("filterExamples", () => {
  describe("vital range filters", () => {
    it("returns all examples when no filters active", () => {
      const examples = [makeExample({ id: 1 }), makeExample({ id: 2 })];
      const result = filterExamples(examples, makeFilters());
      expect(result).toHaveLength(2);
    });

    it("filters by GCS range when nullState is 'has_value'", () => {
      const examples = [
        makeExample({ id: 1, gcs: 3 }),
        makeExample({ id: 2, gcs: 10 }),
        makeExample({ id: 3, gcs: 15 }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [5, 12] },
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("excludes null GCS values when range filter active", () => {
      const examples = [makeExample({ id: 1, gcs: 10 }), makeExample({ id: 2, gcs: null })];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [3, 15] },
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("does NOT filter by GCS range when nullState is 'all'", () => {
      const examples = [makeExample({ id: 1, gcs: 3 }), makeExample({ id: 2, gcs: null })];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "all" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(2);
    });

    it("does NOT filter by GCS range when nullState is 'is_empty'", () => {
      const examples = [makeExample({ id: 1, gcs: 10 }), makeExample({ id: 2, gcs: null })];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "is_empty" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("filters by SBP range", () => {
      const examples = [
        makeExample({ id: 1, systolic_bp: 70 }),
        makeExample({ id: 2, systolic_bp: 130 }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, sbp: [80, 160] },
        nullFilters: { ...defaultFilterState().nullFilters, systolic_bp: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("filters by HR range", () => {
      const examples = [
        makeExample({ id: 1, heart_rate: 30 }),
        makeExample({ id: 2, heart_rate: 90 }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, hr: [40, 180] },
        nullFilters: { ...defaultFilterState().nullFilters, heart_rate: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("filters by RR range", () => {
      const examples = [
        makeExample({ id: 1, respiratory_rate: 8 }),
        makeExample({ id: 2, respiratory_rate: 18 }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, rr: [10, 30] },
        nullFilters: { ...defaultFilterState().nullFilters, respiratory_rate: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("filters by SpO2 range", () => {
      const examples = [
        makeExample({ id: 1, oxygen_saturation: 85 }),
        makeExample({ id: 2, oxygen_saturation: 95 }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, spo2: [90, 100] },
        nullFilters: { ...defaultFilterState().nullFilters, oxygen_saturation: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("range boundaries are inclusive", () => {
      const examples = [
        makeExample({ id: 1, gcs: 5 }),
        makeExample({ id: 2, gcs: 12 }),
        makeExample({ id: 3, gcs: 4 }),
        makeExample({ id: 4, gcs: 13 }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [5, 12] },
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual([1, 2]);
    });

    it("multiple vital filters combine with AND logic", () => {
      const examples = [
        makeExample({ id: 1, gcs: 10, systolic_bp: 90 }),
        makeExample({ id: 2, gcs: 10, systolic_bp: 50 }),
        makeExample({ id: 3, gcs: 3, systolic_bp: 90 }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [5, 15], sbp: [60, 200] },
        nullFilters: {
          ...defaultFilterState().nullFilters,
          gcs: "has_value",
          systolic_bp: "has_value",
        },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("category filters", () => {
    it("filters by airway exact match", () => {
      const examples = [
        makeExample({ id: 1, airway: "patent" }),
        makeExample({ id: 2, airway: "intubated" }),
        makeExample({ id: 3, airway: null }),
      ];
      const result = filterExamples(examples, makeFilters({ airway: "patent" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("filters by breathing exact match", () => {
      const examples = [
        makeExample({ id: 1, breathing: "Bagging" }),
        makeExample({ id: 2, breathing: "Breathing Independently" }),
      ];
      const result = filterExamples(examples, makeFilters({ breathing: "Bagging" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("does not filter when airway is empty string", () => {
      const examples = [
        makeExample({ id: 1, airway: "patent" }),
        makeExample({ id: 2, airway: null }),
      ];
      const result = filterExamples(examples, makeFilters({ airway: "" }));
      expect(result).toHaveLength(2);
    });

    it("does not filter when breathing is empty string", () => {
      const examples = [
        makeExample({ id: 1, breathing: "Bagging" }),
        makeExample({ id: 2, breathing: null }),
      ];
      const result = filterExamples(examples, makeFilters({ breathing: "" }));
      expect(result).toHaveLength(2);
    });

    it("filters by gender exact match", () => {
      const examples = [
        makeExample({ id: 1, gender: "male" }),
        makeExample({ id: 2, gender: "female" }),
        makeExample({ id: 3, gender: null }),
      ];
      const result = filterExamples(examples, makeFilters({ gender: "female" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("does not filter when gender is empty string", () => {
      const examples = [
        makeExample({ id: 1, gender: "male" }),
        makeExample({ id: 2, gender: null }),
      ];
      const result = filterExamples(examples, makeFilters({ gender: "" }));
      expect(result).toHaveLength(2);
    });
  });

  describe("text search filters", () => {
    it("filters mechanism by case-insensitive substring", () => {
      const examples = [
        makeExample({ id: 1, mechanism: "Fall from height" }),
        makeExample({ id: 2, mechanism: "Motor vehicle crash" }),
      ];
      const result = filterExamples(examples, makeFilters({ search: "FALL" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("ignores whitespace-only search string", () => {
      const examples = [makeExample({ id: 1 }), makeExample({ id: 2 })];
      const result = filterExamples(examples, makeFilters({ search: "   " }));
      expect(result).toHaveLength(2);
    });

    it("filters criterion description by case-insensitive substring", () => {
      const examples = [
        makeExample({ id: 1, criteria: { description: "Penetrating injury to torso" } }),
        makeExample({ id: 2, criteria: { description: "Fall > 20 feet" } }),
      ];
      const result = filterExamples(examples, makeFilters({ criterionSearch: "penetrating" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("excludes examples with null criteria from criterion search", () => {
      const examples = [
        makeExample({ id: 1, criteria: { description: "Fall > 20 feet" } }),
        makeExample({ id: 2, criteria: null, criteria_id: null }),
      ];
      const result = filterExamples(examples, makeFilters({ criterionSearch: "fall" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("filters descriptors by case-insensitive substring", () => {
      const examples = [
        makeExample({ id: 1, descriptors: "20ft fall onto concrete" }),
        makeExample({ id: 2, descriptors: "Ejected from vehicle" }),
      ];
      const result = filterExamples(examples, makeFilters({ descriptorsSearch: "CONCRETE" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("excludes examples with null descriptors from descriptors search", () => {
      const examples = [
        makeExample({ id: 1, descriptors: "Some info" }),
        makeExample({ id: 2, descriptors: null }),
      ];
      const result = filterExamples(examples, makeFilters({ descriptorsSearch: "info" }));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("null/presence filters", () => {
    it("has_value filter for gender keeps only non-null rows", () => {
      const examples = [
        makeExample({ id: 1, gender: "male" }),
        makeExample({ id: 2, gender: null }),
      ];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, gender: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("is_empty filter for gender keeps only null rows", () => {
      const examples = [
        makeExample({ id: 1, gender: "male" }),
        makeExample({ id: 2, gender: null }),
      ];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, gender: "is_empty" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("has_value filter for criteria_id keeps rows with non-null criteria_id", () => {
      const examples = [
        makeExample({ id: 1, criteria_id: 100 }),
        makeExample({ id: 2, criteria_id: null, criteria: null }),
      ];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, criteria_id: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("is_empty filter for criteria_id keeps rows with null criteria_id", () => {
      const examples = [
        makeExample({ id: 1, criteria_id: 100 }),
        makeExample({ id: 2, criteria_id: null, criteria: null }),
      ];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, criteria_id: "is_empty" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("has_value filter for descriptors keeps non-null rows", () => {
      const examples = [
        makeExample({ id: 1, descriptors: "Some text" }),
        makeExample({ id: 2, descriptors: null }),
      ];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, descriptors: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("is_empty filter for descriptors keeps null rows", () => {
      const examples = [
        makeExample({ id: 1, descriptors: "Some text" }),
        makeExample({ id: 2, descriptors: null }),
      ];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, descriptors: "is_empty" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("has_value filter for pregnancy_in_weeks keeps non-null rows", () => {
      const examples = [
        makeExample({ id: 1, pregnancy_in_weeks: 32 }),
        makeExample({ id: 2, pregnancy_in_weeks: null }),
      ];
      const filters = makeFilters({
        nullFilters: {
          ...defaultFilterState().nullFilters,
          pregnancy_in_weeks: "has_value",
        },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("is_empty filter for pregnancy_in_weeks keeps null rows", () => {
      const examples = [
        makeExample({ id: 1, pregnancy_in_weeks: 32 }),
        makeExample({ id: 2, pregnancy_in_weeks: null }),
      ];
      const filters = makeFilters({
        nullFilters: {
          ...defaultFilterState().nullFilters,
          pregnancy_in_weeks: "is_empty",
        },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it("'all' state applies no filter", () => {
      const examples = [
        makeExample({ id: 1, gender: "male" }),
        makeExample({ id: 2, gender: null }),
      ];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, gender: "all" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(2);
    });

    it("vital column has_value via null filter is skipped (handled by range filter)", () => {
      // When gcs nullState is "has_value", the null filter loop skips it
      // because the range filter already enforces non-null
      const examples = [makeExample({ id: 1, gcs: 10 }), makeExample({ id: 2, gcs: null })];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [3, 15] },
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
      });
      // Should only return example 1 (range filter already excludes null)
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("vital column is_empty keeps only null rows for that vital", () => {
      const examples = [makeExample({ id: 1, gcs: 10 }), makeExample({ id: 2, gcs: null })];
      const filters = makeFilters({
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "is_empty" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });
  });

  describe("combined filters", () => {
    it("GCS range + airway category combine correctly", () => {
      const examples = [
        makeExample({ id: 1, gcs: 10, airway: "patent" }),
        makeExample({ id: 2, gcs: 10, airway: "intubated" }),
        makeExample({ id: 3, gcs: 3, airway: "patent" }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [5, 15] },
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
        airway: "patent",
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("text search + null filter combine correctly", () => {
      const examples = [
        makeExample({ id: 1, mechanism: "Fall from height", gender: "male" }),
        makeExample({ id: 2, mechanism: "Fall from ladder", gender: null }),
        makeExample({ id: 3, mechanism: "Motor vehicle crash", gender: "female" }),
      ];
      const filters = makeFilters({
        search: "fall",
        nullFilters: { ...defaultFilterState().nullFilters, gender: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("all filter types active simultaneously", () => {
      const examples = [
        makeExample({
          id: 1,
          gcs: 10,
          airway: "patent",
          mechanism: "Fall from height",
          gender: "male",
          descriptors: "Head injury noted",
          criteria: { description: "Fall > 20 feet" },
        }),
        makeExample({
          id: 2,
          gcs: 10,
          airway: "patent",
          mechanism: "Fall from roof",
          gender: "female",
          descriptors: null,
          criteria: { description: "Fall > 20 feet" },
        }),
      ];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [5, 15] },
        nullFilters: {
          ...defaultFilterState().nullFilters,
          gcs: "has_value",
          descriptors: "has_value",
        },
        airway: "patent",
        search: "fall",
        criterionSearch: "fall",
        descriptorsSearch: "head",
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("returns empty array when no examples match all filters", () => {
      const examples = [makeExample({ id: 1, gcs: 3 }), makeExample({ id: 2, gcs: 4 })];
      const filters = makeFilters({
        vitalRanges: { ...VITAL_DEFAULTS, gcs: [10, 15] },
        nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
      });
      const result = filterExamples(examples, filters);
      expect(result).toHaveLength(0);
    });
  });
});

// ─── buildFilterParams ───────────────────────────────────────────

describe("buildFilterParams", () => {
  it("returns empty URLSearchParams for default filter state", () => {
    const params = buildFilterParams(defaultFilterState());
    expect(params.toString()).toBe("");
  });

  it("includes gcs param when nullState is 'has_value'", () => {
    const filters = makeFilters({
      vitalRanges: { ...VITAL_DEFAULTS, gcs: [5, 12] },
      nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
    });
    const params = buildFilterParams(filters);
    expect(params.get("gcs")).toBe("5,12");
  });

  it("does not include gcs param when nullState is 'all'", () => {
    const params = buildFilterParams(defaultFilterState());
    expect(params.has("gcs")).toBe(false);
  });

  it("does not include gcs param when nullState is 'is_empty'", () => {
    const filters = makeFilters({
      nullFilters: { ...defaultFilterState().nullFilters, gcs: "is_empty" },
    });
    const params = buildFilterParams(filters);
    expect(params.has("gcs")).toBe(false);
  });

  it("includes airway param when non-empty", () => {
    const params = buildFilterParams(makeFilters({ airway: "patent" }));
    expect(params.get("airway")).toBe("patent");
  });

  it("does not include airway param when empty string", () => {
    const params = buildFilterParams(makeFilters({ airway: "" }));
    expect(params.has("airway")).toBe(false);
  });

  it("includes gender param when non-empty", () => {
    const params = buildFilterParams(makeFilters({ gender: "male" }));
    expect(params.get("gender")).toBe("male");
  });

  it("does not include gender param when empty string", () => {
    const params = buildFilterParams(makeFilters({ gender: "" }));
    expect(params.has("gender")).toBe(false);
  });

  it("includes search param when non-empty (trimmed)", () => {
    const params = buildFilterParams(makeFilters({ search: " fall " }));
    expect(params.get("search")).toBe("fall");
  });

  it("does not include search param when whitespace-only", () => {
    const params = buildFilterParams(makeFilters({ search: "   " }));
    expect(params.has("search")).toBe(false);
  });

  it("includes criterion_search when non-empty", () => {
    const params = buildFilterParams(makeFilters({ criterionSearch: "burn" }));
    expect(params.get("criterion_search")).toBe("burn");
  });

  it("includes descriptors_search when non-empty", () => {
    const params = buildFilterParams(makeFilters({ descriptorsSearch: "leg" }));
    expect(params.get("descriptors_search")).toBe("leg");
  });

  it("includes null_* params for non-'all' states", () => {
    const filters = makeFilters({
      nullFilters: { ...defaultFilterState().nullFilters, gender: "is_empty" },
    });
    const params = buildFilterParams(filters);
    expect(params.get("null_gender")).toBe("is_empty");
  });

  it("does not include null_* params for 'all' states", () => {
    const params = buildFilterParams(defaultFilterState());
    expect(params.has("null_gender")).toBe(false);
  });

  it("builds correct params for fully populated filter state", () => {
    const filters = makeFilters({
      vitalRanges: { gcs: [5, 12], sbp: [80, 160], hr: [50, 120], rr: [12, 24], spo2: [92, 100] },
      nullFilters: {
        ...defaultFilterState().nullFilters,
        gcs: "has_value",
        systolic_bp: "has_value",
        heart_rate: "has_value",
        respiratory_rate: "has_value",
        oxygen_saturation: "has_value",
        gender: "has_value",
      },
      airway: "patent",
      breathing: "Bagging",
      gender: "female",
      search: "fall",
      criterionSearch: "burn",
      descriptorsSearch: "leg",
    });
    const params = buildFilterParams(filters);

    expect(params.get("gcs")).toBe("5,12");
    expect(params.get("sbp")).toBe("80,160");
    expect(params.get("hr")).toBe("50,120");
    expect(params.get("rr")).toBe("12,24");
    expect(params.get("spo2")).toBe("92,100");
    expect(params.get("airway")).toBe("patent");
    expect(params.get("breathing")).toBe("Bagging");
    expect(params.get("gender")).toBe("female");
    expect(params.get("search")).toBe("fall");
    expect(params.get("criterion_search")).toBe("burn");
    expect(params.get("descriptors_search")).toBe("leg");
    expect(params.get("null_gender")).toBe("has_value");
    expect(params.get("null_gcs")).toBe("has_value");
  });
});

// ─── Roundtrip (buildFilterParams → parseFiltersFromUrl) ─────────

describe("buildFilterParams / parseFiltersFromUrl roundtrip", () => {
  it("default state roundtrips to equivalent default state", () => {
    const original = defaultFilterState();
    const params = buildFilterParams(original);
    const restored = parseFiltersFromUrl(params);
    expect(restored).toEqual(original);
  });

  it("GCS range filter roundtrips correctly", () => {
    const original = makeFilters({
      vitalRanges: { ...VITAL_DEFAULTS, gcs: [5, 12] },
      nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
    });
    const params = buildFilterParams(original);
    const restored = parseFiltersFromUrl(params);
    expect(restored.vitalRanges.gcs).toEqual([5, 12]);
    expect(restored.nullFilters.gcs).toBe("has_value");
  });

  it("complex multi-filter state roundtrips correctly", () => {
    const original = makeFilters({
      vitalRanges: { gcs: [5, 12], sbp: [80, 160], hr: [50, 120], rr: [12, 24], spo2: [92, 100] },
      nullFilters: {
        ...defaultFilterState().nullFilters,
        gcs: "has_value",
        systolic_bp: "has_value",
        heart_rate: "has_value",
        respiratory_rate: "has_value",
        oxygen_saturation: "has_value",
        gender: "has_value",
        pregnancy_in_weeks: "has_value",
      },
      airway: "patent",
      breathing: "Bagging",
      gender: "male",
      search: "fall",
      criterionSearch: "burn",
      descriptorsSearch: "leg",
    });
    const params = buildFilterParams(original);
    const restored = parseFiltersFromUrl(params);
    expect(restored).toEqual(original);
  });

  it("text search with special characters roundtrips correctly", () => {
    const original = makeFilters({
      search: "fall & burn",
      criterionSearch: "20+ feet",
      descriptorsSearch: "head/neck",
    });
    const params = buildFilterParams(original);
    const restored = parseFiltersFromUrl(params);
    expect(restored.search).toBe("fall & burn");
    expect(restored.criterionSearch).toBe("20+ feet");
    expect(restored.descriptorsSearch).toBe("head/neck");
  });
});

// ─── countActiveFilters ──────────────────────────────────────────

describe("countActiveFilters", () => {
  it("returns 0 for default filter state", () => {
    expect(countActiveFilters(defaultFilterState())).toBe(0);
  });

  it("counts airway when non-empty", () => {
    expect(countActiveFilters(makeFilters({ airway: "patent" }))).toBe(1);
  });

  it("counts breathing when non-empty", () => {
    expect(countActiveFilters(makeFilters({ breathing: "Bagging" }))).toBe(1);
  });

  it("counts gender when non-empty", () => {
    expect(countActiveFilters(makeFilters({ gender: "female" }))).toBe(1);
  });

  it("counts search when non-empty after trim", () => {
    expect(countActiveFilters(makeFilters({ search: "fall" }))).toBe(1);
  });

  it("does not count search when whitespace-only", () => {
    expect(countActiveFilters(makeFilters({ search: "   " }))).toBe(0);
  });

  it("counts criterionSearch when non-empty", () => {
    expect(countActiveFilters(makeFilters({ criterionSearch: "burn" }))).toBe(1);
  });

  it("counts descriptorsSearch when non-empty", () => {
    expect(countActiveFilters(makeFilters({ descriptorsSearch: "leg" }))).toBe(1);
  });

  it("counts each non-'all' null filter", () => {
    const filters = makeFilters({
      nullFilters: {
        ...defaultFilterState().nullFilters,
        gender: "has_value",
        descriptors: "is_empty",
      },
    });
    expect(countActiveFilters(filters)).toBe(2);
  });

  it("returns correct total with multiple active filters", () => {
    const filters = makeFilters({
      airway: "patent",
      breathing: "Bagging",
      search: "fall",
      nullFilters: {
        ...defaultFilterState().nullFilters,
        gender: "has_value",
        gcs: "has_value",
      },
    });
    // 3 string filters + 2 null filters = 5
    expect(countActiveFilters(filters)).toBe(5);
  });

  it("counts all possible active filters", () => {
    const nullFilters = {} as Record<NullFilterColumn, "has_value">;
    for (const col of NULL_FILTER_COLUMNS) {
      nullFilters[col] = "has_value";
    }
    const filters: ExamplesFilterState = {
      vitalRanges: { ...VITAL_DEFAULTS },
      airway: "patent",
      breathing: "Bagging",
      gender: "male",
      search: "fall",
      criterionSearch: "burn",
      descriptorsSearch: "leg",
      nullFilters,
    };
    // 6 string/category filters + 11 null filters = 17
    expect(countActiveFilters(filters)).toBe(17);
  });
});

// ─── defaultFilterState ──────────────────────────────────────────

describe("defaultFilterState", () => {
  it("returns all vital ranges at their defaults", () => {
    const state = defaultFilterState();
    expect(state.vitalRanges.gcs).toEqual([3, 15]);
    expect(state.vitalRanges.sbp).toEqual([60, 200]);
    expect(state.vitalRanges.hr).toEqual([40, 180]);
    expect(state.vitalRanges.rr).toEqual([10, 30]);
    expect(state.vitalRanges.spo2).toEqual([90, 100]);
  });

  it("returns empty strings for all text/category filters", () => {
    const state = defaultFilterState();
    expect(state.airway).toBe("");
    expect(state.breathing).toBe("");
    expect(state.gender).toBe("");
    expect(state.search).toBe("");
    expect(state.criterionSearch).toBe("");
    expect(state.descriptorsSearch).toBe("");
  });

  it("returns 'all' for every null filter column", () => {
    const state = defaultFilterState();
    for (const col of NULL_FILTER_COLUMNS) {
      expect(state.nullFilters[col]).toBe("all");
    }
  });

  it("countActiveFilters returns 0 for defaultFilterState()", () => {
    expect(countActiveFilters(defaultFilterState())).toBe(0);
  });
});

// ─── buildUpdatedParams ─────────────────────────────────────────

describe("buildUpdatedParams", () => {
  it("updates a single null filter while preserving all other state", () => {
    const initial = new URLSearchParams("airway=patent&null_gender=is_empty");
    const result = buildUpdatedParams(initial, {
      nullFilters: {
        ...parseFiltersFromUrl(initial).nullFilters,
        gcs: "has_value",
      },
    });
    expect(result.get("airway")).toBe("patent");
    expect(result.get("null_gender")).toBe("is_empty");
    expect(result.get("null_gcs")).toBe("has_value");
  });

  it("updates a vital range while preserving other state", () => {
    const initial = new URLSearchParams("null_gcs=has_value&gcs=3,15&airway=patent");
    const result = buildUpdatedParams(initial, {
      vitalRanges: {
        ...parseFiltersFromUrl(initial).vitalRanges,
        gcs: [5, 12],
      },
    });
    expect(result.get("gcs")).toBe("5,12");
    expect(result.get("airway")).toBe("patent");
    expect(result.get("null_gcs")).toBe("has_value");
  });

  it("updates airway while preserving other state", () => {
    const initial = new URLSearchParams("search=fall&null_gender=has_value");
    const result = buildUpdatedParams(initial, { airway: "intubated" });
    expect(result.get("airway")).toBe("intubated");
    expect(result.get("search")).toBe("fall");
    expect(result.get("null_gender")).toBe("has_value");
  });

  it("updates text search while preserving other state", () => {
    const initial = new URLSearchParams("airway=patent");
    const result = buildUpdatedParams(initial, { search: "gunshot" });
    expect(result.get("search")).toBe("gunshot");
    expect(result.get("airway")).toBe("patent");
  });

  it("clears a null filter by setting to 'all'", () => {
    const initial = new URLSearchParams("null_gcs=is_empty&null_gender=has_value");
    const result = buildUpdatedParams(initial, {
      nullFilters: {
        ...parseFiltersFromUrl(initial).nullFilters,
        gcs: "all",
      },
    });
    expect(result.has("null_gcs")).toBe(false);
    expect(result.get("null_gender")).toBe("has_value");
  });

  it("clears airway by setting to empty string", () => {
    const initial = new URLSearchParams("airway=patent&search=fall");
    const result = buildUpdatedParams(initial, { airway: "" });
    expect(result.has("airway")).toBe(false);
    expect(result.get("search")).toBe("fall");
  });

  it("applies multiple updates simultaneously", () => {
    const initial = new URLSearchParams("airway=patent");
    const result = buildUpdatedParams(initial, {
      airway: "intubated",
      breathing: "Bagging",
      search: "burn",
    });
    expect(result.get("airway")).toBe("intubated");
    expect(result.get("breathing")).toBe("Bagging");
    expect(result.get("search")).toBe("burn");
  });

  it("works from empty URL (all defaults)", () => {
    const result = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: {
        ...defaultFilterState().nullFilters,
        gender: "is_empty",
      },
    });
    expect(result.get("null_gender")).toBe("is_empty");
    // All other params should be absent (defaults are not serialized)
    expect(result.has("gcs")).toBe(false);
    expect(result.has("airway")).toBe(false);
    expect(result.has("search")).toBe(false);
  });

  it("correctly removes vital range param when null filter changes from has_value to all", () => {
    const initial = new URLSearchParams("gcs=5,12&null_gcs=has_value");
    const result = buildUpdatedParams(initial, {
      nullFilters: {
        ...parseFiltersFromUrl(initial).nullFilters,
        gcs: "all",
      },
    });
    expect(result.has("gcs")).toBe(false);
    expect(result.has("null_gcs")).toBe(false);
  });

  it("correctly removes vital range param when null filter changes from has_value to is_empty", () => {
    const initial = new URLSearchParams("gcs=5,12&null_gcs=has_value");
    const result = buildUpdatedParams(initial, {
      nullFilters: {
        ...parseFiltersFromUrl(initial).nullFilters,
        gcs: "is_empty",
      },
    });
    expect(result.has("gcs")).toBe(false);
    expect(result.get("null_gcs")).toBe("is_empty");
  });
});

// ─── State transition roundtrips ────────────────────────────────
// These simulate user workflows: start at URL state A, apply a filter
// change via buildUpdatedParams, verify the resulting URL, parse it
// back, and verify the filter state. This is the category of tests
// that catches the original bug (is_empty → all not clearing the URL).

describe("state transition roundtrips", () => {
  describe("activating and deactivating null filters", () => {
    it("activating GCS is_empty adds null_gcs param, deactivating removes it", () => {
      // Step 1: Start with no filters
      let url = new URLSearchParams();

      // Step 2: User sets GCS to is_empty
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "is_empty" },
      });
      expect(url.get("null_gcs")).toBe("is_empty");

      // Step 3: User sets GCS back to all
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "all" },
      });
      expect(url.has("null_gcs")).toBe(false);
      expect(url.toString()).toBe("");
    });

    it("activating GCS has_value adds params, deactivating removes both", () => {
      let url = new URLSearchParams();

      // Activate: set to has_value (with default range)
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "has_value" },
      });
      expect(url.get("null_gcs")).toBe("has_value");
      expect(url.get("gcs")).toBe("3,15"); // default range

      // Deactivate: set back to all
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "all" },
      });
      expect(url.has("null_gcs")).toBe(false);
      expect(url.has("gcs")).toBe(false);
      expect(url.toString()).toBe("");
    });

    it("cycling GCS: all → is_empty → has_value → all restores empty URL", () => {
      let url = new URLSearchParams();

      // all → is_empty
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "is_empty" },
      });
      expect(parseFiltersFromUrl(url).nullFilters.gcs).toBe("is_empty");

      // is_empty → has_value
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "has_value" },
      });
      expect(parseFiltersFromUrl(url).nullFilters.gcs).toBe("has_value");

      // has_value → all
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "all" },
      });
      expect(parseFiltersFromUrl(url).nullFilters.gcs).toBe("all");
      expect(url.toString()).toBe("");
    });

    it("activating gender has_value then back to all clears null_gender", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gender: "has_value" },
      });
      expect(url.get("null_gender")).toBe("has_value");

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gender: "all" },
      });
      expect(url.has("null_gender")).toBe(false);
      expect(url.toString()).toBe("");
    });

    it("activating criteria_id is_empty then back to all clears null_criteria_id", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, criteria_id: "is_empty" },
      });
      expect(url.get("null_criteria_id")).toBe("is_empty");

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, criteria_id: "all" },
      });
      expect(url.has("null_criteria_id")).toBe(false);
    });

    it("activating descriptors has_value then back to all clears null_descriptors", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, descriptors: "has_value" },
      });
      expect(url.get("null_descriptors")).toBe("has_value");

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, descriptors: "all" },
      });
      expect(url.has("null_descriptors")).toBe(false);
    });

    it("activating pregnancy_in_weeks is_empty then back to all clears param", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, pregnancy_in_weeks: "is_empty" },
      });
      expect(url.get("null_pregnancy_in_weeks")).toBe("is_empty");

      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, pregnancy_in_weeks: "all" },
      });
      expect(url.has("null_pregnancy_in_weeks")).toBe(false);
    });

    it("every null filter column cycles correctly: all → is_empty → has_value → all", () => {
      for (const col of NULL_FILTER_COLUMNS) {
        let url = new URLSearchParams();

        // all → is_empty
        url = buildUpdatedParams(url, {
          nullFilters: { ...parseFiltersFromUrl(url).nullFilters, [col]: "is_empty" },
        });
        expect(parseFiltersFromUrl(url).nullFilters[col]).toBe("is_empty");

        // is_empty → has_value
        url = buildUpdatedParams(url, {
          nullFilters: { ...parseFiltersFromUrl(url).nullFilters, [col]: "has_value" },
        });
        expect(parseFiltersFromUrl(url).nullFilters[col]).toBe("has_value");

        // has_value → all
        url = buildUpdatedParams(url, {
          nullFilters: { ...parseFiltersFromUrl(url).nullFilters, [col]: "all" },
        });
        expect(parseFiltersFromUrl(url).nullFilters[col]).toBe("all");
      }
    });
  });

  describe("activating and deactivating vital ranges", () => {
    it("setting GCS range with has_value adds params, switching to all removes them", () => {
      let url = new URLSearchParams();

      // Activate has_value and set range
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "has_value" },
        vitalRanges: { ...parseFiltersFromUrl(url).vitalRanges, gcs: [5, 12] },
      });
      expect(url.get("gcs")).toBe("5,12");
      expect(url.get("null_gcs")).toBe("has_value");

      // Deactivate
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "all" },
      });
      expect(url.has("gcs")).toBe(false);
      expect(url.has("null_gcs")).toBe(false);
    });

    it("changing GCS range updates the gcs param value", () => {
      let url = new URLSearchParams("gcs=3,15&null_gcs=has_value");

      url = buildUpdatedParams(url, {
        vitalRanges: { ...parseFiltersFromUrl(url).vitalRanges, gcs: [7, 10] },
      });
      expect(url.get("gcs")).toBe("7,10");
      expect(url.get("null_gcs")).toBe("has_value");
    });

    it("every vital range activates and deactivates cleanly", () => {
      const vitalPairs: [VitalParamKey, NullFilterColumn][] = [
        ["gcs", "gcs"],
        ["sbp", "systolic_bp"],
        ["hr", "heart_rate"],
        ["rr", "respiratory_rate"],
        ["spo2", "oxygen_saturation"],
      ];

      for (const [paramKey, col] of vitalPairs) {
        let url = new URLSearchParams();

        // Activate
        url = buildUpdatedParams(url, {
          nullFilters: { ...parseFiltersFromUrl(url).nullFilters, [col]: "has_value" },
        });
        expect(url.has(paramKey)).toBe(true);
        expect(url.get(`null_${col}`)).toBe("has_value");

        // Deactivate
        url = buildUpdatedParams(url, {
          nullFilters: { ...parseFiltersFromUrl(url).nullFilters, [col]: "all" },
        });
        expect(url.has(paramKey)).toBe(false);
        expect(url.has(`null_${col}`)).toBe(false);
      }
    });
  });

  describe("activating and deactivating category filters", () => {
    it("setting airway to 'patent' adds param, clearing to '' removes it", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, { airway: "patent" });
      expect(url.get("airway")).toBe("patent");

      url = buildUpdatedParams(url, { airway: "" });
      expect(url.has("airway")).toBe(false);
      expect(url.toString()).toBe("");
    });

    it("setting breathing to 'Bagging' adds param, clearing removes it", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, { breathing: "Bagging" });
      expect(url.get("breathing")).toBe("Bagging");

      url = buildUpdatedParams(url, { breathing: "" });
      expect(url.has("breathing")).toBe(false);
    });

    it("setting gender to 'male' adds param, clearing to '' removes it", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, { gender: "male" });
      expect(url.get("gender")).toBe("male");

      url = buildUpdatedParams(url, { gender: "" });
      expect(url.has("gender")).toBe(false);
      expect(url.toString()).toBe("");
    });

    it("gender CategoryFilterChip workflow: select value → is_empty → all", () => {
      let url = new URLSearchParams();

      // User selects "Female"
      url = buildUpdatedParams(url, {
        gender: "female",
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gender: "all" },
      });
      expect(url.get("gender")).toBe("female");

      // User selects (Empty)
      url = buildUpdatedParams(url, {
        gender: "",
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gender: "is_empty" },
      });
      expect(url.has("gender")).toBe(false);
      expect(url.get("null_gender")).toBe("is_empty");

      // User selects (All)
      url = buildUpdatedParams(url, {
        gender: "",
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gender: "all" },
      });
      expect(url.has("gender")).toBe(false);
      expect(url.has("null_gender")).toBe(false);
      expect(url.toString()).toBe("");
    });

    it("CategoryFilterChip empty sentinel workflow: select → is_empty → back to all", () => {
      let url = new URLSearchParams();

      // User selects a category
      url = buildUpdatedParams(url, { airway: "patent" });
      expect(url.get("airway")).toBe("patent");

      // User selects (Empty) from the dropdown
      url = buildUpdatedParams(url, {
        airway: "",
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, airway: "is_empty" },
      });
      expect(url.has("airway")).toBe(false);
      expect(url.get("null_airway")).toBe("is_empty");

      // User selects (All) from the dropdown
      url = buildUpdatedParams(url, {
        airway: "",
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, airway: "all" },
      });
      expect(url.has("airway")).toBe(false);
      expect(url.has("null_airway")).toBe(false);
      expect(url.toString()).toBe("");
    });
  });

  describe("activating and deactivating text search", () => {
    it("adding search text adds param, clearing to '' removes it", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, { search: "gunshot" });
      expect(url.get("search")).toBe("gunshot");

      url = buildUpdatedParams(url, { search: "" });
      expect(url.has("search")).toBe(false);
    });

    it("whitespace-only search does not add param", () => {
      const url = buildUpdatedParams(new URLSearchParams(), { search: "   " });
      expect(url.has("search")).toBe(false);
    });

    it("criterion search adds and clears correctly", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, { criterionSearch: "penetrating" });
      expect(url.get("criterion_search")).toBe("penetrating");

      url = buildUpdatedParams(url, { criterionSearch: "" });
      expect(url.has("criterion_search")).toBe(false);
    });

    it("descriptors search adds and clears correctly", () => {
      let url = new URLSearchParams();

      url = buildUpdatedParams(url, { descriptorsSearch: "burn" });
      expect(url.get("descriptors_search")).toBe("burn");

      url = buildUpdatedParams(url, { descriptorsSearch: "" });
      expect(url.has("descriptors_search")).toBe(false);
    });
  });

  describe("clear all from complex state", () => {
    it("from complex multi-filter state, defaultFilterState produces empty URL", () => {
      // Start with many active filters
      let url = new URLSearchParams(
        "gcs=5,12&null_gcs=has_value&null_gender=is_empty&airway=patent" +
          "&breathing=Bagging&search=fall&criterion_search=burn&descriptors_search=leg",
      );

      // Simulate "Clear all" — build params from default state
      url = buildFilterParams(defaultFilterState());
      expect(url.toString()).toBe("");
    });

    it("parsing empty URL restores exact default state", () => {
      const restored = parseFiltersFromUrl(new URLSearchParams());
      expect(restored).toEqual(defaultFilterState());
    });

    it("clear all then re-apply single filter produces clean URL", () => {
      // Complex state
      let url = new URLSearchParams(
        "gcs=5,12&null_gcs=has_value&null_gender=is_empty&airway=patent",
      );

      // Clear all
      url = buildFilterParams(defaultFilterState());
      expect(url.toString()).toBe("");

      // Re-apply single filter
      url = buildUpdatedParams(url, {
        nullFilters: { ...defaultFilterState().nullFilters, gender: "has_value" },
      });
      expect(url.get("null_gender")).toBe("has_value");
      // No stale params from previous state
      expect(url.has("gcs")).toBe(false);
      expect(url.has("null_gcs")).toBe(false);
      expect(url.has("airway")).toBe(false);
    });
  });

  describe("filter independence (changing one doesn't affect others)", () => {
    it("toggling GCS null filter doesn't affect gender null filter", () => {
      let url = new URLSearchParams("null_gender=has_value");

      // Activate GCS
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "is_empty" },
      });
      expect(url.get("null_gender")).toBe("has_value");
      expect(url.get("null_gcs")).toBe("is_empty");

      // Deactivate GCS
      url = buildUpdatedParams(url, {
        nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "all" },
      });
      expect(url.get("null_gender")).toBe("has_value");
      expect(url.has("null_gcs")).toBe(false);
    });

    it("changing airway doesn't affect vital ranges or text search", () => {
      let url = new URLSearchParams("gcs=5,12&null_gcs=has_value&search=fall");

      url = buildUpdatedParams(url, { airway: "intubated" });
      expect(url.get("gcs")).toBe("5,12");
      expect(url.get("null_gcs")).toBe("has_value");
      expect(url.get("search")).toBe("fall");
      expect(url.get("airway")).toBe("intubated");
    });

    it("clearing search doesn't affect null filters or categories", () => {
      let url = new URLSearchParams("search=fall&null_gender=is_empty&airway=patent");

      url = buildUpdatedParams(url, { search: "" });
      expect(url.has("search")).toBe(false);
      expect(url.get("null_gender")).toBe("is_empty");
      expect(url.get("airway")).toBe("patent");
    });
  });
});

// ─── Two-step vital toggle regression (Bug 1) ──────────────────
// VitalFilterChip fires onnullchange then onrangechange as two
// separate sequential calls. The second call must build on the
// URL produced by the first — if it doesn't, the range param is
// lost because the first call's URL is the "current" for the second.

describe("two-step vital toggle regression (Bug 1)", () => {
  it("range param appears when toggling all → has_value via sequential updates", () => {
    // Step 1: onnullchange fires — sets null state to has_value
    const url1 = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
    });
    // Step 2: onrangechange fires — sets the default range [3, 15]
    const url2 = buildUpdatedParams(url1, {
      vitalRanges: { ...parseFiltersFromUrl(url1).vitalRanges, gcs: [3, 15] },
    });

    expect(url2.get("null_gcs")).toBe("has_value");
    expect(url2.get("gcs")).toBe("3,15");

    // Roundtrip: parsing the final URL should restore the range
    const restored = parseFiltersFromUrl(url2);
    expect(restored.vitalRanges.gcs).toEqual([3, 15]);
    expect(restored.nullFilters.gcs).toBe("has_value");
  });

  it("custom range survives the two-step toggle", () => {
    // Step 1: onnullchange fires
    const url1 = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
    });
    // Step 2: onrangechange fires with custom range
    const url2 = buildUpdatedParams(url1, {
      vitalRanges: { ...parseFiltersFromUrl(url1).vitalRanges, gcs: [5, 12] },
    });

    expect(url2.get("gcs")).toBe("5,12");
    expect(url2.get("null_gcs")).toBe("has_value");

    const restored = parseFiltersFromUrl(url2);
    expect(restored.vitalRanges.gcs).toEqual([5, 12]);
  });

  it("range is NOT serialized when nullState stays 'all'", () => {
    // Only a vitalRanges change without setting nullState to has_value
    const url = buildUpdatedParams(new URLSearchParams(), {
      vitalRanges: { ...defaultFilterState().vitalRanges, gcs: [5, 12] },
    });

    // gcs param should not be in URL since nullState is still "all"
    expect(url.has("gcs")).toBe(false);
    expect(url.has("null_gcs")).toBe(false);
  });
});

// ─── Stale-state race condition (documents the bug) ─────────────
// When two separate buildUpdatedParams calls both read from the SAME
// stale base params, the second overwrites the first. This is exactly
// what happened when VitalFilterChip fired onnullchange then
// onrangechange as two separate navigate() calls.

describe("stale-state race condition (documents the bug pattern)", () => {
  it("second call with stale base params loses the first call's null filter", () => {
    const staleBase = new URLSearchParams();

    // Call 1: set null filter (would navigate)
    const _url1 = buildUpdatedParams(staleBase, {
      nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
    });

    // Call 2: set range — but uses STALE base (not url1)
    const url2 = buildUpdatedParams(staleBase, {
      vitalRanges: { ...parseFiltersFromUrl(staleBase).vitalRanges, gcs: [3, 15] },
    });

    // Bug: null_gcs is lost because staleBase didn't have it
    expect(url2.has("null_gcs")).toBe(false);
    expect(url2.has("gcs")).toBe(false);
  });
});

// ─── Atomic vital null+range update (fix path) ─────────────────
// The fix sends both nullFilters and vitalRanges in a single
// buildUpdatedParams call, avoiding the stale-state race.

describe("atomic vital null+range update (fix validation)", () => {
  it("GCS: single call with null filter + range preserves both in URL", () => {
    const url = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, gcs: "has_value" },
      vitalRanges: { ...defaultFilterState().vitalRanges, gcs: [3, 15] },
    });
    expect(url.get("null_gcs")).toBe("has_value");
    expect(url.get("gcs")).toBe("3,15");
    const restored = parseFiltersFromUrl(url);
    expect(restored.nullFilters.gcs).toBe("has_value");
    expect(restored.vitalRanges.gcs).toEqual([3, 15]);
  });

  it("SBP: single call with null filter + slider range [0,300] preserves both", () => {
    const url = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, systolic_bp: "has_value" },
      vitalRanges: { ...defaultFilterState().vitalRanges, sbp: [0, 300] },
    });
    expect(url.get("null_systolic_bp")).toBe("has_value");
    expect(url.get("sbp")).toBe("0,300");
    const restored = parseFiltersFromUrl(url);
    expect(restored.nullFilters.systolic_bp).toBe("has_value");
    expect(restored.vitalRanges.sbp).toEqual([0, 300]);
  });

  it("HR: single call with null filter + slider range [0,250] preserves both", () => {
    const url = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, heart_rate: "has_value" },
      vitalRanges: { ...defaultFilterState().vitalRanges, hr: [0, 250] },
    });
    expect(url.get("null_heart_rate")).toBe("has_value");
    expect(url.get("hr")).toBe("0,250");
    const restored = parseFiltersFromUrl(url);
    expect(restored.nullFilters.heart_rate).toBe("has_value");
    expect(restored.vitalRanges.hr).toEqual([0, 250]);
  });

  it("RR: single call with null filter + slider range [0,60] preserves both", () => {
    const url = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, respiratory_rate: "has_value" },
      vitalRanges: { ...defaultFilterState().vitalRanges, rr: [0, 60] },
    });
    expect(url.get("null_respiratory_rate")).toBe("has_value");
    expect(url.get("rr")).toBe("0,60");
    const restored = parseFiltersFromUrl(url);
    expect(restored.nullFilters.respiratory_rate).toBe("has_value");
    expect(restored.vitalRanges.rr).toEqual([0, 60]);
  });

  it("SpO2: single call with null filter + slider range [0,100] preserves both", () => {
    const url = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, oxygen_saturation: "has_value" },
      vitalRanges: { ...defaultFilterState().vitalRanges, spo2: [0, 100] },
    });
    expect(url.get("null_oxygen_saturation")).toBe("has_value");
    expect(url.get("spo2")).toBe("0,100");
    const restored = parseFiltersFromUrl(url);
    expect(restored.nullFilters.oxygen_saturation).toBe("has_value");
    expect(restored.vitalRanges.spo2).toEqual([0, 100]);
  });

  it("atomic update preserves existing unrelated filters", () => {
    const base = new URLSearchParams("search=fall&null_gender=is_empty&airway=patent");
    const url = buildUpdatedParams(base, {
      nullFilters: { ...parseFiltersFromUrl(base).nullFilters, gcs: "has_value" },
      vitalRanges: { ...parseFiltersFromUrl(base).vitalRanges, gcs: [3, 15] },
    });
    expect(url.get("null_gcs")).toBe("has_value");
    expect(url.get("gcs")).toBe("3,15");
    expect(url.get("search")).toBe("fall");
    expect(url.get("null_gender")).toBe("is_empty");
    expect(url.get("airway")).toBe("patent");
  });

  it("atomic update roundtrips through parse correctly", () => {
    const base = new URLSearchParams("null_gender=has_value");
    const url = buildUpdatedParams(base, {
      nullFilters: { ...parseFiltersFromUrl(base).nullFilters, systolic_bp: "has_value" },
      vitalRanges: { ...parseFiltersFromUrl(base).vitalRanges, sbp: [0, 300] },
    });
    const restored = parseFiltersFromUrl(url);
    expect(restored.nullFilters.gender).toBe("has_value");
    expect(restored.nullFilters.systolic_bp).toBe("has_value");
    expect(restored.vitalRanges.sbp).toEqual([0, 300]);
  });

  it("switching from has_value back to all clears both null filter and range", () => {
    // First: atomically set has_value + range
    let url = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, heart_rate: "has_value" },
      vitalRanges: { ...defaultFilterState().vitalRanges, hr: [0, 250] },
    });
    expect(url.get("null_heart_rate")).toBe("has_value");
    expect(url.get("hr")).toBe("0,250");

    // Then: switch back to all
    url = buildUpdatedParams(url, {
      nullFilters: { ...parseFiltersFromUrl(url).nullFilters, heart_rate: "all" },
    });
    expect(url.has("null_heart_rate")).toBe(false);
    expect(url.has("hr")).toBe(false);
  });

  it("switching from has_value to is_empty clears range but keeps null filter", () => {
    // First: atomically set has_value + range
    let url = buildUpdatedParams(new URLSearchParams(), {
      nullFilters: { ...defaultFilterState().nullFilters, respiratory_rate: "has_value" },
      vitalRanges: { ...defaultFilterState().vitalRanges, rr: [0, 60] },
    });

    // Then: switch to is_empty
    url = buildUpdatedParams(url, {
      nullFilters: { ...parseFiltersFromUrl(url).nullFilters, respiratory_rate: "is_empty" },
    });
    expect(url.get("null_respiratory_rate")).toBe("is_empty");
    expect(url.has("rr")).toBe(false);
  });

  it("multiple vitals can be atomically activated independently", () => {
    let url = new URLSearchParams();

    // Activate GCS
    url = buildUpdatedParams(url, {
      nullFilters: { ...parseFiltersFromUrl(url).nullFilters, gcs: "has_value" },
      vitalRanges: { ...parseFiltersFromUrl(url).vitalRanges, gcs: [3, 15] },
    });

    // Activate SBP (GCS should still be present)
    url = buildUpdatedParams(url, {
      nullFilters: { ...parseFiltersFromUrl(url).nullFilters, systolic_bp: "has_value" },
      vitalRanges: { ...parseFiltersFromUrl(url).vitalRanges, sbp: [0, 300] },
    });

    expect(url.get("null_gcs")).toBe("has_value");
    expect(url.get("gcs")).toBe("3,15");
    expect(url.get("null_systolic_bp")).toBe("has_value");
    expect(url.get("sbp")).toBe("0,300");
  });
});
