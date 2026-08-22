import { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } from "./config.js";

const API = "https://api.cloudflare.com/client/v4";

type CfRecord = { id: string; name: string; content: string; type: string };

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json()) as { success: boolean; result: T; errors: unknown[] };
  if (!body.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(body.errors)}`);
  }
  return body.result;
}

async function findTxtRecords(name: string): Promise<CfRecord[]> {
  return cf<CfRecord[]>(
    `/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=TXT&name=${encodeURIComponent(name)}`,
  );
}

// Idempotent upsert, not a blind create — a second TXT record at the same
// name would give an ambiguous multi-value answer for something meant to be
// one canonical record per registered domain.
export async function upsertTxtRecord(name: string, content: string): Promise<void> {
  const existing = await findTxtRecords(name);
  if (existing.length === 0) {
    await cf(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
      method: "POST",
      body: JSON.stringify({ type: "TXT", name, content, ttl: 60 }),
    });
    return;
  }
  const [first, ...extras] = existing;
  if (first.content !== content) {
    await cf(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${first.id}`, {
      method: "PUT",
      body: JSON.stringify({ type: "TXT", name, content, ttl: 60 }),
    });
  }
  // Reconciliation safety net (§2/§4 of the plan) can leave duplicates if a
  // prior upsert partially failed; clean them up as they're found.
  for (const extra of extras) {
    await cf(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${extra.id}`, { method: "DELETE" });
  }
}

export async function deleteTxtRecord(name: string): Promise<void> {
  for (const record of await findTxtRecords(name)) {
    await cf(`/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${record.id}`, { method: "DELETE" });
  }
}
