import type { ExampleWithCriterion, NullFilterState } from "$lib/types/database.js";

// ─── Constants ───────────────────────────────────────────────────

/** Column names that support null/presence filtering. */
export const NULL_FILTER_COLUMNS = [
  "gender",
  "descriptors",
  "gcs",
  "systolic_bp",
  "heart_rate",
  "respiratory_rate",
  "oxygen_saturation",
  "pregnancy_in_weeks",
  "airway",
  "breathing",
  "criteria_id",
] as const;

export type NullFilterColumn = (typeof NULL_FILTER_COLUMNS)[number];

/** Maps URL param keys to their ExampleWithCriterion column names. */
export const VITAL_PARAM_MAP = {
  gcs: "gcs",
  sbp: "systolic_bp",
  hr: "heart_rate",
  rr: "respiratory_rate",
  spo2: "oxygen_saturation",
} as const;

export type VitalParamKey = keyof typeof VITAL_PARAM_MAP;

/** Default [min, max] range for each vital sign slider. */
export const VITAL_DEFAULTS: Record<VitalParamKey, [number, number]> = {
  gcs: [3, 15],
  sbp: [60, 200],
  hr: [40, 180],
  rr: [10, 30],
  spo2: [90, 100],
};

// ─── Types ───────────────────────────────────────────────────────

/** Complete filter state for the examples data explorer. */
export interface ExamplesFilterState {
  vitalRanges: Record<VitalParamKey, [number, number]>;
  airway: string;
  breathing: string;
  search: string;
  criterionSearch: string;
  descriptorsSearch: string;
  nullFilters: Record<NullFilterColumn, NullFilterState>;
}

// ─── Functions ───────────────────────────────────────────────────

/**
 * Parse a URL param like "3,15" into a [min, max] tuple.
 * Returns null if the param is missing or malformed.
 */
export function parseRange(param: string | null): [number, number] | null {
  if (!param) return null;
  const parts = param.split(",").map(Number);
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    return [parts[0], parts[1]] as [number, number];
  }
  return null;
}

/** Return a fresh filter state with all defaults (no filters active). */
export function defaultFilterState(): ExamplesFilterState {
  const nullFilters = {} as Record<NullFilterColumn, NullFilterState>;
  for (const col of NULL_FILTER_COLUMNS) {
    nullFilters[col] = "all";
  }
  return {
    vitalRanges: {
      gcs: [...VITAL_DEFAULTS.gcs],
      sbp: [...VITAL_DEFAULTS.sbp],
      hr: [...VITAL_DEFAULTS.hr],
      rr: [...VITAL_DEFAULTS.rr],
      spo2: [...VITAL_DEFAULTS.spo2],
    },
    airway: "",
    breathing: "",
    search: "",
    criterionSearch: "",
    descriptorsSearch: "",
    nullFilters,
  };
}

/**
 * Parse all filter state from URL search params.
 *
 * Backward compatibility: if a vital range param (e.g. `gcs=3,15`) exists
 * but no corresponding `null_gcs` param, the null filter is auto-set to
 * "has_value". An explicit `null_*` param always takes precedence.
 */
export function parseFiltersFromUrl(searchParams: URLSearchParams): ExamplesFilterState {
  const state = defaultFilterState();

  // Vital ranges
  for (const key of Object.keys(VITAL_PARAM_MAP) as VitalParamKey[]) {
    const parsed = parseRange(searchParams.get(key));
    if (parsed) {
      state.vitalRanges[key] = parsed;
    }
  }

  // Category / text filters
  state.airway = searchParams.get("airway") ?? "";
  state.breathing = searchParams.get("breathing") ?? "";
  state.search = searchParams.get("search") ?? "";
  state.criterionSearch = searchParams.get("criterion_search") ?? "";
  state.descriptorsSearch = searchParams.get("descriptors_search") ?? "";

  // Null filters
  for (const col of NULL_FILTER_COLUMNS) {
    const param = searchParams.get(`null_${col}`);
    if (param === "has_value" || param === "is_empty") {
      state.nullFilters[col] = param;
    }
  }

  // Backward compat: vital range param present without explicit null_* → "has_value"
  const backwardCompatPairs: [VitalParamKey, NullFilterColumn][] = [
    ["gcs", "gcs"],
    ["sbp", "systolic_bp"],
    ["hr", "heart_rate"],
    ["rr", "respiratory_rate"],
    ["spo2", "oxygen_saturation"],
  ];
  for (const [paramKey, col] of backwardCompatPairs) {
    if (searchParams.has(paramKey) && state.nullFilters[col] === "all") {
      state.nullFilters[col] = "has_value";
    }
  }

  return state;
}

/** Columns whose "has_value" null state is handled by the range filter. */
const VITAL_COLUMNS: ReadonlySet<string> = new Set(Object.values(VITAL_PARAM_MAP));

/** Apply all active filters to an array of examples. */
export function filterExamples(
  examples: readonly ExampleWithCriterion[],
  filters: ExamplesFilterState,
): ExampleWithCriterion[] {
  let result = [...examples];

  // ── Vital range filters (only when nullState === "has_value") ──
  if (filters.nullFilters.gcs === "has_value") {
    const [min, max] = filters.vitalRanges.gcs;
    result = result.filter((e) => e.gcs !== null && e.gcs >= min && e.gcs <= max);
  }
  if (filters.nullFilters.systolic_bp === "has_value") {
    const [min, max] = filters.vitalRanges.sbp;
    result = result.filter(
      (e) => e.systolic_bp !== null && e.systolic_bp >= min && e.systolic_bp <= max,
    );
  }
  if (filters.nullFilters.heart_rate === "has_value") {
    const [min, max] = filters.vitalRanges.hr;
    result = result.filter(
      (e) => e.heart_rate !== null && e.heart_rate >= min && e.heart_rate <= max,
    );
  }
  if (filters.nullFilters.respiratory_rate === "has_value") {
    const [min, max] = filters.vitalRanges.rr;
    result = result.filter(
      (e) => e.respiratory_rate !== null && e.respiratory_rate >= min && e.respiratory_rate <= max,
    );
  }
  if (filters.nullFilters.oxygen_saturation === "has_value") {
    const [min, max] = filters.vitalRanges.spo2;
    result = result.filter(
      (e) =>
        e.oxygen_saturation !== null && e.oxygen_saturation >= min && e.oxygen_saturation <= max,
    );
  }

  // ── Category filters ──
  if (filters.airway) {
    result = result.filter((e) => e.airway === filters.airway);
  }
  if (filters.breathing) {
    result = result.filter((e) => e.breathing === filters.breathing);
  }

  // ── Text search (case-insensitive substring) ──
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter((e) => e.mechanism.toLowerCase().includes(q));
  }
  if (filters.criterionSearch.trim()) {
    const q = filters.criterionSearch.toLowerCase();
    result = result.filter((e) => e.criteria?.description?.toLowerCase().includes(q));
  }
  if (filters.descriptorsSearch.trim()) {
    const q = filters.descriptorsSearch.toLowerCase();
    result = result.filter((e) => e.descriptors?.toLowerCase().includes(q));
  }

  // ── Null/presence filters ──
  // Skip vital columns when state is "has_value" (already handled by range filter)
  for (const col of NULL_FILTER_COLUMNS) {
    const state = filters.nullFilters[col];
    if (state === "all") continue;
    if (VITAL_COLUMNS.has(col) && state === "has_value") continue;

    const key = col as keyof ExampleWithCriterion;
    if (state === "has_value") {
      result = result.filter((e) => {
        if (key === "criteria_id") return e.criteria_id !== null;
        return e[key] !== null && e[key] !== undefined;
      });
    } else {
      // is_empty
      result = result.filter((e) => {
        if (key === "criteria_id") return e.criteria_id === null;
        return e[key] === null || e[key] === undefined;
      });
    }
  }

  return result;
}

/** Serialize active filters into URLSearchParams (sparse — omits defaults). */
export function buildFilterParams(filters: ExamplesFilterState): URLSearchParams {
  const params = new URLSearchParams();

  // Vital ranges (only when null state is "has_value")
  if (filters.nullFilters.gcs === "has_value") params.set("gcs", filters.vitalRanges.gcs.join(","));
  if (filters.nullFilters.systolic_bp === "has_value")
    params.set("sbp", filters.vitalRanges.sbp.join(","));
  if (filters.nullFilters.heart_rate === "has_value")
    params.set("hr", filters.vitalRanges.hr.join(","));
  if (filters.nullFilters.respiratory_rate === "has_value")
    params.set("rr", filters.vitalRanges.rr.join(","));
  if (filters.nullFilters.oxygen_saturation === "has_value")
    params.set("spo2", filters.vitalRanges.spo2.join(","));

  // Category filters
  if (filters.airway) params.set("airway", filters.airway);
  if (filters.breathing) params.set("breathing", filters.breathing);

  // Text search (trimmed)
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.criterionSearch.trim())
    params.set("criterion_search", filters.criterionSearch.trim());
  if (filters.descriptorsSearch.trim())
    params.set("descriptors_search", filters.descriptorsSearch.trim());

  // Null filters (only non-"all")
  for (const col of NULL_FILTER_COLUMNS) {
    if (filters.nullFilters[col] !== "all") {
      params.set(`null_${col}`, filters.nullFilters[col]);
    }
  }

  return params;
}

/**
 * Merge a partial filter update into the current URL state and serialize.
 * Used by event handlers that change one filter dimension at a time.
 */
export function buildUpdatedParams(
  currentParams: URLSearchParams,
  update: Partial<ExamplesFilterState>,
): URLSearchParams {
  const current = parseFiltersFromUrl(currentParams);
  const merged: ExamplesFilterState = {
    ...current,
    ...update,
    vitalRanges: { ...current.vitalRanges, ...update.vitalRanges },
    nullFilters: { ...current.nullFilters, ...update.nullFilters },
  };
  return buildFilterParams(merged);
}

/** Count the number of active (non-default) filters. */
export function countActiveFilters(filters: ExamplesFilterState): number {
  return (
    (filters.airway ? 1 : 0) +
    (filters.breathing ? 1 : 0) +
    (filters.search.trim() ? 1 : 0) +
    (filters.criterionSearch.trim() ? 1 : 0) +
    (filters.descriptorsSearch.trim() ? 1 : 0) +
    Object.values(filters.nullFilters).filter((s) => s !== "all").length
  );
}
