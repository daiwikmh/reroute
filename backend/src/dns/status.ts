import { AGENTS_ZONE } from "./config.js";
import { domainSlug } from "./record.js";
import { resolveTxtFlat } from "./doh.js";

export type DnsStatus = {
  domain: string;
  recordName: string;
  expectedTarget: string;
  state: "pending" | "verified" | "error";
  detail?: string;
};

// A TXT lookup at a CNAME name follows the chain per standard resolver
// behaviour (RFC 1034 §3.6.2) — the DoH resolver does this the same way a
// classic resolver would.
export async function checkDnsStatus(domain: string): Promise<DnsStatus> {
  const recordName = `_agent.${domain}`;
  const expectedTarget = `${await domainSlug(domain)}.${AGENTS_ZONE}`;
  try {
    const flat = await resolveTxtFlat(recordName);
    const aid = flat.find((r) => r.startsWith("v=aid1"));
    if (!aid) {
      return {
        domain,
        recordName,
        expectedTarget,
        state: "pending",
        detail: "No record detected yet — add the CNAME shown above and wait a few minutes.",
      };
    }
    return { domain, recordName, expectedTarget, state: "verified", detail: aid };
  } catch (err) {
    return { domain, recordName, expectedTarget, state: "error", detail: String(err) };
  }
}
