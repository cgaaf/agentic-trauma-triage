import { getSupabaseClient } from "$lib/server/supabase.js";
import { CriteriaRowSchema, ExampleRowSchema } from "$lib/types/database.js";
import type { CriteriaRow, ExampleRow } from "$lib/types/database.js";

export async function getAllCriteria(): Promise<CriteriaRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("criteria")
    .select("*")
    .order("id", { ascending: true });

  if (error) throw new Error(`Failed to fetch criteria: ${error.message}`);

  return data.map((row) => CriteriaRowSchema.parse(row));
}

export async function getCriterionById(id: number): Promise<CriteriaRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("criteria").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`Failed to fetch criterion ${id}: ${error.message}`);
  if (!data) return null;

  return CriteriaRowSchema.parse(data);
}

export async function getExamplesForCriterion(criterionId: number): Promise<ExampleRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("examples")
    .select("*")
    .eq("criteria_id", criterionId)
    .order("id", { ascending: true });

  if (error)
    throw new Error(`Failed to fetch examples for criterion ${criterionId}: ${error.message}`);

  return data.map((row) => ExampleRowSchema.parse(row));
}
