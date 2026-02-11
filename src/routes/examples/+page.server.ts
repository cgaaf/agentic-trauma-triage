import type { PageServerLoad } from "./$types.js";
import { getAllExamplesWithCriteria } from "$lib/server/db/examples.js";

export const load: PageServerLoad = async () => {
  const examples = await getAllExamplesWithCriteria();
  return { examples };
};
