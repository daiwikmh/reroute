import { resolveTxt } from "node:dns/promises";
import { getState } from "./cache.js";
import { parseTxtRecord } from "./record.js";

export type BrowseEntry = {
  domain: string;
  price: string;
  cur: string;
  asset: string;
  payto: string;
  uri: string;
};

// The Browse page's whole point is proving the pitch: every price shown here
// came from a DNS TXT lookup, not from hitting each seller's server. Domains
// are resolved in parallel for the same reason an agent would — comparing
// many candidates by price never needs to touch their origins.
export async function listActiveEndpoints(): Promise<BrowseEntry[]> {
  const state = await getState();
  const domains = Object.values(state.domains);

  const results = await Promise.all(
    domains.map(async (domain): Promise<BrowseEntry | null> => {
      try {
        const records = await resolveTxt(`_agent.${domain}`);
        const flat = records.map((chunks) => chunks.join(""));
        const raw = flat.find((r) => r.startsWith("v=aid1"));
        if (!raw) return null;

        const fields = parseTxtRecord(raw);
        if (fields.active !== "true") return null;

        return {
          domain,
          price: fields.price ?? "0",
          cur: fields.cur ?? "UNKNOWN",
          asset: fields.asset ?? "",
          payto: fields.payto ?? "",
          uri: fields.uri ?? "",
        };
      } catch {
        // Not verified yet, or DNS hasn't propagated — not a browsable
        // endpoint, not an error worth surfacing here.
        return null;
      }
    }),
  );

  return results.filter((entry): entry is BrowseEntry => entry !== null);
}
