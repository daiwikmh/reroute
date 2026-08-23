// Workers has no node:dns — this is the DNS-over-HTTPS replacement for
// resolveTxt, using Cloudflare's own resolver (the same one used to verify
// records live throughout this project's testing). Follows CNAME chains
// automatically, same as a normal resolver would.
export async function resolveTxtFlat(name: string): Promise<string[]> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) throw new Error(`DoH query failed: ${res.status}`);
  const body = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
  if (!body.Answer) return [];
  return body.Answer.filter((a) => a.type === 16).map((a) => unquoteTxt(a.data));
}

// The JSON DNS API represents a multi-string TXT record as space-separated
// quoted segments (e.g. `"seg1" "seg2"`) — this reassembles them the same
// way node:dns's chunks.join("") did.
function unquoteTxt(data: string): string {
  const matches = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
  if (matches.length === 0) return data;
  return matches.map((m) => m[1].replace(/\\"/g, '"')).join("");
}
