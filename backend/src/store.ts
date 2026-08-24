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
  country?: string; // ISO 3166-1 alpha-2 of the calling agent, from Cloudflare's cf object
  agent?: string; // raw User-Agent header of the calling request
  // Country of the local money-provider (e.g. MoneyGram) off-ramp a seller
  // cashed out through — schema-ready, not populated until that off-ramp
  // integration lands and starts writing it.
  offRampCountry?: string;
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

export type OffRampConfig = {
  country: string;
  currency: string;
};

export type OffRampReceipt = {
  reference: string;
  usdcAmount: string; // smallest units cashed out in this receipt
  currency: string;
  localAmount: number;
  rate: number;
  at: number; // unix seconds
};

const OFFRAMP_CONFIG_KEY = "offramp:config"; // domain -> OffRampConfig
const OFFRAMP_WITHDRAWN_KEY = "offramp:withdrawn"; // domain -> cumulative smallest-units string
const OFFRAMP_HISTORY_KEY = "offramp:history"; // domain -> OffRampReceipt[]

export async function getOffRampConfig(kv: KVNamespace, domain: string): Promise<OffRampConfig | null> {
  const raw = await kv.get(OFFRAMP_CONFIG_KEY);
  const all: Record<string, OffRampConfig> = raw ? JSON.parse(raw) : {};
  return all[domain] ?? null;
}

export async function setOffRampConfig(kv: KVNamespace, domain: string, config: OffRampConfig): Promise<void> {
  const raw = await kv.get(OFFRAMP_CONFIG_KEY);
  const all: Record<string, OffRampConfig> = raw ? JSON.parse(raw) : {};
  all[domain] = config;
  await kv.put(OFFRAMP_CONFIG_KEY, JSON.stringify(all));
}

export async function getWithdrawn(kv: KVNamespace, domain: string): Promise<bigint> {
  const raw = await kv.get(OFFRAMP_WITHDRAWN_KEY);
  const all: Record<string, string> = raw ? JSON.parse(raw) : {};
  return BigInt(all[domain] ?? "0");
}

export async function addWithdrawn(kv: KVNamespace, domain: string, amount: bigint): Promise<void> {
  const raw = await kv.get(OFFRAMP_WITHDRAWN_KEY);
  const all: Record<string, string> = raw ? JSON.parse(raw) : {};
  all[domain] = ((BigInt(all[domain] ?? "0")) + amount).toString();
  await kv.put(OFFRAMP_WITHDRAWN_KEY, JSON.stringify(all));
}

export async function getOffRampHistory(kv: KVNamespace, domain: string): Promise<OffRampReceipt[]> {
  const raw = await kv.get(OFFRAMP_HISTORY_KEY);
  const all: Record<string, OffRampReceipt[]> = raw ? JSON.parse(raw) : {};
  return (all[domain] ?? []).sort((a, b) => b.at - a.at);
}

export async function appendOffRampReceipt(kv: KVNamespace, domain: string, receipt: OffRampReceipt): Promise<void> {
  const raw = await kv.get(OFFRAMP_HISTORY_KEY);
  const all: Record<string, OffRampReceipt[]> = raw ? JSON.parse(raw) : {};
  all[domain] = [...(all[domain] ?? []), receipt];
  await kv.put(OFFRAMP_HISTORY_KEY, JSON.stringify(all));
}
