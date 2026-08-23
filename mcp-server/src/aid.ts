// Resolves a Reroute-priced domain's pricing straight from DNS — no request
// to any server, agent's own or Reroute's. Mirrors backend/src/dns/doh.ts
// and record.ts's parseTxtRecord exactly, since this is the same AID-style
// `_agent.<domain>` TXT convention the backend publishes.

export type AidRecord = {
  uri: string;
  proto: string;
  scheme: string;
  price: string;
  cur: string;
  asset: string;
  payTo: string;
  facilitator: string;
  active: boolean;
};

async function resolveTxtFlat(name: string): Promise<string[]> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) throw new Error(`DoH query failed: ${res.status}`);
  const body = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
  if (!body.Answer) return [];
  return body.Answer.filter((a) => a.type === 16).map((a) => unquoteTxt(a.data));
}

function unquoteTxt(data: string): string {
  const matches = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
  if (matches.length === 0) return data;
  return matches.map((m) => m[1].replace(/\\"/g, '"')).join("");
}

function parseTxtRecord(raw: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    fields[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return fields;
}

export async function resolveAid(domain: string): Promise<AidRecord> {
  const name = `_agent.${domain.trim().toLowerCase()}`;
  const answers = await resolveTxtFlat(name);
  const aid = answers.find((a) => a.startsWith("v=aid1"));
  if (!aid) {
    throw new Error(
      `No AID TXT record at ${name}. Either this domain isn't registered with Reroute, or its DNS hasn't verified yet.`,
    );
  }
  const fields = parseTxtRecord(aid);
  const required = ["uri", "proto", "p", "price", "cur", "asset", "payto", "facilitator", "active"];
  for (const key of required) {
    if (!(key in fields)) throw new Error(`AID record at ${name} is missing "${key}=".`);
  }
  return {
    uri: fields.uri,
    proto: fields.proto,
    scheme: fields.p,
    price: fields.price,
    cur: fields.cur,
    asset: fields.asset,
    payTo: fields.payto,
    facilitator: fields.facilitator,
    active: fields.active === "true",
  };
}
