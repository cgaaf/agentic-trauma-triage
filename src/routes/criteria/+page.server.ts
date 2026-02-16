import type { PageServerLoad } from "./$types.js";
import { getAllCriteria } from "$lib/server/db/criteria.js";

export const load: PageServerLoad = async () => {
  const criteria = await getAllCriteria();
  return { criteria };
};
