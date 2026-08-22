import { resolveTxt } from "node:dns/promises";
import { AGENTS_ZONE } from "./config.js";
import { domainSlug } from "./record.js";

export type DnsStatus = {
  domain: string;
  recordName: string;
  expectedTarget: string;
  state: "pending" | "verified" | "error";
  detail?: string;
};

// A TXT lookup at a CNAME name follows the chain per standard resolver
// behaviour (RFC 1034 §3.6.2) — no manual CNAME-following needed here, the
// resolver library does it.
export async function checkDnsStatus(domain: string): Promise<DnsStatus> {
  const recordName = `_agent.${domain}`;
  const expectedTarget = `${domainSlug(domain)}.${AGENTS_ZONE}`;
  try {
    const records = await resolveTxt(recordName);
    const flat = records.map((chunks) => chunks.join(""));
    const aid = flat.find((r) => r.startsWith("v=aid1"));
    if (!aid) {
      return {
        domain,
        recordName,
        expectedTarget,
        state: "pending",
        detail: "A record was found, but it doesn't look like an AID record yet.",
      };
    }
    return { domain, recordName, expectedTarget, state: "verified", detail: aid };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return {
        domain,
        recordName,
        expectedTarget,
        state: "pending",
        detail: "No record detected yet — add the CNAME shown above and wait a few minutes.",
      };
    }
    return { domain, recordName, expectedTarget, state: "error", detail: String(err) };
  }
}
