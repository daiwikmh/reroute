const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_MAX_PER_WINDOW ?? 30);

type Bucket = { count: number; windowStart: number };

// Per-process, in-memory, fixed-window counter keyed by (domain, payer) — a
// restart resets everyone's count, which is an acceptable v1 tradeoff: the
// point is capping one verified identity's call velocity against a single
// endpoint, not building a durable ledger of it.
const buckets = new Map<string, Bucket>();

export function checkRateLimit(domain: string, payer: string): boolean {
  const key = `${domain}|${payer}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}
