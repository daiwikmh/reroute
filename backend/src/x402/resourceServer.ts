import { x402ResourceServer } from "@x402/core/server";
import { x402HTTPResourceServer } from "@x402/core/http";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { facilitatorClient } from "./facilitator.js";

const NETWORK = (process.env.X402_NETWORK ?? "stellar:pubnet") as `${string}:${string}`;

const server = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactStellarScheme(),
);

let initialized: Promise<void> | null = null;

// initialize() fetches the facilitator's supported kinds — do it once, lazily,
// not on every request.
export async function readyResourceServer(): Promise<x402ResourceServer> {
  if (!initialized) initialized = server.initialize();
  await initialized;
  return server;
}

export { NETWORK as X402_NETWORK };

// x402HTTPResourceServer.initialize() unconditionally re-calls the shared
// resourceServer's initialize(), which unconditionally re-fetches supported
// kinds from the facilitator over HTTP — there is no internal cache to rely
// on. Building and initializing one per incoming request meant every single
// payment hit the facilitator's network twice before ever checking a
// payment header. Cache per (domain, payTo, asset, amount): unchanged
// pricing reuses the already-initialized instance; a price/payTo change
// naturally gets a fresh key and a one-time re-init, not a stale one.
const cache = new Map<string, Promise<InstanceType<typeof x402HTTPResourceServer>>>();

export async function getHttpResourceServer(
  domain: string,
  payTo: string,
  asset: string,
  amount: string,
) {
  const key = `${domain}|${payTo}|${asset}|${amount}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = (async () => {
      await readyResourceServer();
      const httpServer = new x402HTTPResourceServer(server, {
        [`GET /pay/${domain}`]: {
          accepts: { scheme: "exact", network: NETWORK, payTo, price: { asset, amount } },
          description: `Paid access to ${domain}`,
          mimeType: "application/json",
        },
      });
      await httpServer.initialize();
      return httpServer;
    })();
    cache.set(key, entry);
    // Don't cache a failed init (facilitator hiccup) — let the next request retry.
    entry.catch(() => cache.delete(key));
  }
  return entry;
}
