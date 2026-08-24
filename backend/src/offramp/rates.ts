// Live USD -> local currency rates for converting a seller's collected USDC
// into a MoneyGram payout amount. open.er-api.com needs no API key and
// covers every currency in countries.ts. Cached in KV for an hour so the
// dashboard's polling doesn't hammer it on every summary fetch.
const RATE_TTL_SECONDS = 3600;

function cacheKey(currency: string) {
  return `fx:${currency}`;
}

export async function fetchRate(kv: KVNamespace, currency: string): Promise<number> {
  if (currency === "USD") return 1;

  const cached = await kv.get(cacheKey(currency));
  if (cached) return Number(cached);

  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`Exchange rate lookup failed: ${res.status}`);
  const body = (await res.json()) as { rates?: Record<string, number> };
  const rate = body.rates?.[currency];
  if (!rate) throw new Error(`No exchange rate available for ${currency}.`);

  await kv.put(cacheKey(currency), String(rate), { expirationTtl: RATE_TTL_SECONDS });
  return rate;
}
