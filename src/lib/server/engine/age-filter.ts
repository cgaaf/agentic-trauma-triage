import type { Criterion } from "$lib/types/index.js";

/** Filter criteria to only those applicable to the given patient age. */
export function filterCriteriaByAge(criteria: Criterion[], age: number): Criterion[] {
  return criteria.filter((c) => age >= c.ageMin && (c.ageMax === null || age <= c.ageMax));
}
