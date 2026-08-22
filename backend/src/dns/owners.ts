import { getState } from "./cache.js";

export async function domainsForOwner(owner: string): Promise<string[]> {
  const state = await getState();
  return Object.entries(state.owners)
    .filter(([, addr]) => addr === owner)
    .map(([hash]) => state.domains[hash])
    .filter((domain): domain is string => Boolean(domain));
}
