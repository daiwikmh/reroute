import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { AGENTS_ZONE, CLOUDFLARE_CONFIGURED, PORT, PUBLIC_BASE_URL } from "./dns/config.js";
import { domainSlug } from "./dns/record.js";
import { startSyncJob } from "./dns/sync.js";
import { checkDnsStatus } from "./dns/status.js";
import { domainsForOwner } from "./dns/owners.js";
import { listActiveEndpoints } from "./dns/browse.js";
import { callsForDomain } from "./calls.js";
import { handlePay } from "./x402/proxy.js";

const app = new Hono();
app.use("*", cors());
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
    publicBaseUrlEnvSet: Boolean(process.env.PUBLIC_BASE_URL),
  }),
);

app.get("/dns-record/:domain", (c) => {
  const domain = c.req.param("domain").trim().toLowerCase();
  return c.json({ domain, recordName: `_agent.${domain}`, target: `${domainSlug(domain)}.${AGENTS_ZONE}` });
});

app.get("/dns-status/:domain", async (c) => {
  const domain = c.req.param("domain").trim().toLowerCase();
  return c.json(await checkDnsStatus(domain));
});

app.get("/endpoints/:owner", async (c) => {
  const owner = c.req.param("owner").trim();
  return c.json(await domainsForOwner(owner));
});

// Public, no-wallet listing for the Browse page — every entry is read
// straight from each domain's DNS TXT record, not from the chain or from
// hitting the seller's server, which is the whole point of the page.
app.get("/endpoints", async (c) => c.json(await listActiveEndpoints()));

app.get("/pay/:domain", handlePay);

app.get("/calls/:domain", async (c) => {
  const domain = c.req.param("domain").trim().toLowerCase();
  return c.json(await callsForDomain(domain));
});

startSyncJob();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`dns service listening on :${info.port} (Cloudflare ${CLOUDFLARE_CONFIGURED ? "configured" : "NOT configured — dry-run mode"})`);
});
