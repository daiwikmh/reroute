import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./env.js";
import { AGENTS_ZONE, CLOUDFLARE_CONFIGURED, PUBLIC_BASE_URL } from "./dns/config.js";
import { domainSlug } from "./dns/record.js";
import { checkDnsStatus } from "./dns/status.js";
import { domainsForOwner, callsForDomain } from "./store.js";
import { listActiveEndpoints } from "./dns/browse.js";
import { handlePay } from "./x402/proxy.js";
import { syncOnce } from "./dns/sync.js";

const app = new Hono<{ Bindings: Bindings }>();
// x402's payment headers are non-simple response headers — a browser fetch()
// can't read them cross-origin unless the server explicitly exposes them.
app.use("*", cors({ exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"] }));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    cloudflareConfigured: CLOUDFLARE_CONFIGURED,
    agentsZone: AGENTS_ZONE,
    publicBaseUrl: PUBLIC_BASE_URL,
  }),
);

app.get("/dns-record/:domain", async (c) => {
  const domain = c.req.param("domain").trim().toLowerCase();
  return c.json({ domain, recordName: `_agent.${domain}`, target: `${await domainSlug(domain)}.${AGENTS_ZONE}` });
});

app.get("/dns-status/:domain", async (c) => {
  const domain = c.req.param("domain").trim().toLowerCase();
  return c.json(await checkDnsStatus(domain));
});

app.get("/endpoints/:owner", async (c) => {
  const owner = c.req.param("owner").trim();
  return c.json(await domainsForOwner(c.env.DNS_KV, owner));
});

// Public, no-wallet listing for the Browse page — every entry is read
// straight from each domain's DNS TXT record, not from the chain or from
// hitting the seller's server, which is the whole point of the page.
app.get("/endpoints", async (c) => c.json(await listActiveEndpoints(c.env.DNS_KV)));

app.get("/pay/:domain", handlePay);

app.get("/calls/:domain", async (c) => {
  const domain = c.req.param("domain").trim().toLowerCase();
  return c.json(await callsForDomain(c.env.DNS_KV, domain));
});

export default {
  fetch: app.fetch,
  // Replaces the old setInterval-every-30s loop — a Cron Trigger invocation
  // is inherently one-at-a-time, so no re-entrancy guard is needed here the
  // way the Node version needed one.
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(
      syncOnce(env.DNS_KV).catch((err) => console.error("dns-sync failed:", err)),
    );
  },
};
