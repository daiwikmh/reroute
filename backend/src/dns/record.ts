import { createHash } from "node:crypto";
import { CURRENCY_CODES, PUBLIC_BASE_URL } from "./config.js";
import type { Endpoint } from "./registry.js";

// Matches fin/src/utils/registry/client.ts's domainSlug exactly — both sides
// must derive the same short id from the same normalised (lower-cased)
// domain for the CNAME target and the Cloudflare record name to line up.
export function domainSlug(domain: string): string {
  return createHash("sha256").update(domain.trim().toLowerCase()).digest("hex").slice(0, 16);
}

// AID-style key=value TXT content. A single TXT character-string caps at 255
// bytes, but resolvers split/rejoin longer values across multiple strings
// transparently (Cloudflare stores it, node:dns's resolveTxt + status.ts's
// `chunks.join("")` reassembles it) — so this isn't the hard limit the old
// comment here claimed. If it ever grows past a couple hundred bytes anyway,
// switch to a `ref=` pointer to a JSON blob instead of inlining everything.
//
// `payto=` is what makes the DNS record alone enough to construct a payment:
// without it, an agent knows the price/currency/asset but still has to hit
// /pay once just to learn who to pay before it can build the transfer.
export function buildTxtRecord(endpoint: Endpoint): string {
  const domain = endpoint.domain.toString("utf-8");
  const cur = CURRENCY_CODES[endpoint.reference_asset] ?? "UNKNOWN";
  const fields = [
    "v=aid1",
    `uri=${PUBLIC_BASE_URL}/pay/${domain}`,
    "proto=mcp",
    "p=stellar-x402",
    `price=${endpoint.reference_price.toString()}`,
    `cur=${cur}`,
    `asset=${endpoint.reference_asset}`,
    `payto=${endpoint.pay_to}`,
    `facilitator=${endpoint.facilitator_url}`,
    `active=${endpoint.active}`,
  ];
  return fields.join(";");
}

// Inverse of buildTxtRecord — what the Browse listing uses to turn a
// resolved TXT string back into structured fields, entirely from DNS.
export function parseTxtRecord(raw: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    fields[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return fields;
}
