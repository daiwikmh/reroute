export const RPC_URL = process.env.RPC_URL ?? "https://mainnet.sorobanrpc.com";
export const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? "Public Global Stellar Network ; September 2015";
export const REGISTRY_CONTRACT_ID =
  process.env.REGISTRY_CONTRACT_ID ?? "CALTXNYPEFU24UUSYJMHZCTE44ASRNXZ3FOHTIEDKWVQJSZFVZKMVG5D";
export const SIMULATION_SOURCE =
  process.env.SIMULATION_SOURCE ?? "GD4YDGESVMWKAXYO3SXWE7H45SHHZC66DE33KBJXI5VY6Q27NKVOTTNQ";

// The zone we (the platform) control in Cloudflare. A seller's CNAME points
// at <slug>.AGENTS_ZONE; we never touch anything outside this one zone.
export const AGENTS_ZONE = process.env.AGENTS_ZONE ?? "agents.neurus.xyz";

// Where this backend's own /pay/:domain proxy is actually reachable. The DNS
// record's `uri=` field must point here, not at the seller's raw site — an
// agent that skipped straight to the seller's domain would bypass the
// payment gate entirely, since the gate is this proxy, not the seller's own
// server. Update this once the backend has a real public deployment URL.
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? "https://neurus.xyz";
export const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
export const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID ?? "";

// Without real Cloudflare credentials the sync job logs what it *would* do
// instead of failing outright, so the rest of the stack (registration, on
// chain reads, the setup panel's slug/record display) stays usable in a demo
// or a fresh checkout with no secrets configured yet.
export const CLOUDFLARE_CONFIGURED = Boolean(
  CLOUDFLARE_API_TOKEN && CLOUDFLARE_ZONE_ID,
);

// Mirrors fin/src/utils/registry/config.ts's CURRENCIES — kept as a small,
// separately-maintained list rather than a shared package, since both sides
// are demo-scoped for now. Used only to render a human-readable `cur=` code
// in the TXT record; `asset=` always carries the real contract address.
export const CURRENCY_CODES: Record<string, string> = {
  CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: "USDC",
  CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA: "XLM",
  CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA: "USDC",
  CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC: "XLM",
};
