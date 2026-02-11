import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";
import { getCriterionById, getExamplesForCriterion } from "$lib/server/db/criteria.js";

export const GET: RequestHandler = async ({ params }) => {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) throw error(400, "Invalid criterion ID");

  const criterion = await getCriterionById(id);
  if (!criterion) throw error(404, "Criterion not found");

  const examples = await getExamplesForCriterion(id);

  return json({ criterion, examples });
};
