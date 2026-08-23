// KV-backed replacement for the old file-based cache.ts + calls.ts. This is
// the actual fix for the persistence bug found on Render: KV survives
// restarts/redeploys by design, unlike an ephemeral container disk.

export type SyncState = {
  lastLedger: number;
  // domain hash (hex) -> plaintext domain, learned once from a Register
  // event since the contract keeps no reverse index — see events.ts.
  domains: Record<string, string>;
  // domain hash (hex) -> owner address, learned the same way.
  owners: Record<string, string>;
};

const STATE_KEY = "dns:state";
const CALLS_KEY = "calls";

export async function getState(kv: KVNamespace): Promise<SyncState> {
  const raw = await kv.get(STATE_KEY);
  if (!raw) return { lastLedger: 0, domains: {}, owners: {} };
  const parsed = JSON.parse(raw) as Partial<SyncState>;
  return { lastLedger: parsed.lastLedger ?? 0, domains: parsed.domains ?? {}, owners: parsed.owners ?? {} };
}

export async function putState(kv: KVNamespace, state: SyncState): Promise<void> {
  await kv.put(STATE_KEY, JSON.stringify(state));
}

export async function domainsForOwner(kv: KVNamespace, owner: string): Promise<string[]> {
  const state = await getState(kv);
  return Object.entries(state.owners)
    .filter(([, addr]) => addr === owner)
    .map(([hash]) => state.domains[hash])
    .filter((domain): domain is string => Boolean(domain));
}

export type CallRecord = {
  domain: string;
  payer: string;
  asset: string;
  amount: string;
  txHash?: string;
  at: number; // unix seconds
};

// KV has no transactions — two settlements landing in the same instant could
// still race here, same class of gap the old write-queue solved for a single
// Node process, now open again across Workers' many isolates. Acceptable for
// now (documented, not silently assumed fixed); a Durable Object would be
// the real fix if concurrent settlement volume ever makes this matter.
export async function appendCall(kv: KVNamespace, record: CallRecord): Promise<void> {
  const raw = await kv.get(CALLS_KEY);
  const all: CallRecord[] = raw ? JSON.parse(raw) : [];
  all.push(record);
  await kv.put(CALLS_KEY, JSON.stringify(all));
}

export async function callsForDomain(kv: KVNamespace, domain: string): Promise<CallRecord[]> {
  const raw = await kv.get(CALLS_KEY);
  const all: CallRecord[] = raw ? JSON.parse(raw) : [];
  return all.filter((c) => c.domain === domain).sort((a, b) => b.at - a.at);
}
