import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";
import { getExampleById } from "$lib/server/db/examples.js";

export const GET: RequestHandler = async ({ params }) => {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) throw error(400, "Invalid example ID");

  const result = await getExampleById(id);
  if (!result) throw error(404, "Example not found");

  return json(result);
};
