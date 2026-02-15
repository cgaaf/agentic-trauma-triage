import { getSupabaseClient } from "$lib/server/supabase.js";
import {
  ExampleWithCriterionSchema,
  ExampleRowSchema,
  CriteriaRowSchema,
} from "$lib/types/database.js";
import type { ExampleWithCriterion, ExampleRow, CriteriaRow } from "$lib/types/database.js";

export async function getAllExamplesWithCriteria(): Promise<ExampleWithCriterion[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("examples")
    .select("*, criteria(description)")
    .order("id", { ascending: true });

  if (error) throw new Error(`Failed to fetch examples: ${error.message}`);

  return data.map((row) => ExampleWithCriterionSchema.parse(row));
}

export async function getExampleById(
  id: number,
): Promise<{ example: ExampleRow; criterion: CriteriaRow | null } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("examples")
    .select("*, criteria(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch example ${id}: ${error.message}`);
  if (!data) return null;

  const { criteria, ...exampleData } = data;
  return {
    example: ExampleRowSchema.parse(exampleData),
    criterion: criteria ? CriteriaRowSchema.parse(criteria) : null,
  };
}
