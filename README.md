# Reroute

**Reroute prices at the DNS layer.** x402 payments on Stellar are a crowded,
funded category — **ApiCharge** (SCF Round 40, $79k), **REAPP** (SCF Round 43,
combining x402 with AP2 mandate authorization), **TollPay**, **RouteDock**,
**SpendGuard**, and ~20 more from a single April 2026 hackathon all do "agent
pays API via x402 on Stellar" already. Every one of them still makes an agent
send a request and get a `402` back before it learns the price. On Stellar
specifically — checked against the project directory, ~1,300 indexed
hackathon submissions, and the code index, zero matches — nobody puts price,
currency, settlement asset, and payee in the DNS record itself. Reroute's
`_agent.<domain>` TXT record does, so an agent resolves the entire payment in
one DNS lookup, before it ever sends an HTTP request. Verified live:

```
$ dig +short TXT 96bc5082e32eb01d.agents.neurus.xyz
"v=aid1;uri=https://neurus.xyz/pay/m3-test.neurus.xyz;proto=mcp;p=stellar-x402;
price=300000;cur=USDC;asset=CBIE...QDAMA;payto=GDI6...SFCT7;
facilitator=https://channels.openzeppelin.com/x402/testnet;active=true"
```

**Honest caveat on how novel this is chain-wide, not just on Stellar:**
Coinbase's own [x402 Bazaar](https://www.x402bazaar.org/) already solves
discovery-before-payment — 112+ listed services including OpenAI, Anthropic,
Alchemy, and CoinGecko as of mid-2026. It's a directory an agent queries over
HTTP, not a DNS lookup against the seller's own domain, so it doesn't remove
the round-trip Reroute removes and it doesn't work if a seller never bothers
listing there — but it means "nobody solves discovery" is false chain-wide.
The accurate, narrower claim: **no third-party directory dependency** — this
still resolves even if Bazaar is down, rate-limits you, or a seller just
isn't listed. That's the edge to lead with, not "first discovery layer."

Once the agent decides to pay, it does so through the standard
[x402](https://developers.stellar.org/docs/build/agentic-payments/x402)
protocol — no API keys, no Stripe, no subscriptions. DNS is the price sheet;
x402 is still the payment rail.

## Who this is actually for

**Sellers — the sharpest real fit is MCP server operators, not a hypothetical
persona.** The MCP SDK has 120M+ monthly downloads, and under 5% of servers
generate any revenue today
([DEV Community, "How to Monetize Your MCP Server in 2026"](https://dev.to/lexwhiting/how-to-monetize-your-mcp-server-in-2026-the-complete-guide-2pg9)) —
a large population of builders with working tools and no monetization path.
Data/scraping APIs are the second-best fit, with a real, live, named proof
case: Firecrawl already charges $0.01/scrape via x402 on Base (Coinbase case
study). Both groups share the same pain: agent traffic doesn't fit
subscription tiers, and an agent can't fill out a signup form mid-task to get
an API key.

**The pitch that actually lands with them, not "we do x402":**

> Your MCP server already takes x402 payments. Right now an agent still has
> to hit your endpoint and read a 402 response to learn your price — a
> wasted round-trip on every cold call, and it makes you invisible to any
> agent comparison-shopping five providers before choosing one. Add one DNS
> TXT record and your price, currency, and payout address resolve in one
> `dig` query, before any agent touches your server.

**Buyers — the honest state of "agents comparison-shop by price" is:
emerging infrastructure, not observed production behavior.** LLM *model*
routing by cost is proven at scale (OpenRouter, NVIDIA NeMo Switchyard, 60–80%
cost cuts commonly cited). The same pattern for *tool/data API* routing is
real but earlier — AgentRouter and AgenticMarket are building per-call
pricing registries for exactly this — but no case of an agent actually
choosing between two DNS-priced endpoints in production has been found yet.
The buyer this serves is an agent orchestration framework or AI gateway
comparison-shopping many candidate providers, not a single hobbyist agent
calling one API it already knows — DNS-resolved pricing only pays off when
you're picking among candidates *before* committing to a request.

**Where to actually reach either side:** the official
[MCP Registry](https://registry.modelcontextprotocol.io/) and MCP-monetization
communities (sellers, already motivated); x402 Bazaar's own listings (each of
its 112+ sellers has already done the hard integration work); Stellar
Discord/SCF — there is a live SCF RFP (as of Jul 23 2026) explicitly
requesting "a production-ready x402 facilitator for Stellar alongside a
Stellar-native Bazaar discovery layer," a close match to what's already built
here, though a competing submission may already exist for it; and agent
framework / AI gateway communities (buyers) since they're the ones who'd wire
DNS-resolved pricing in as a routing signal.

**Scale reality check:** the whole space is roughly four months old (x402
shipped May 2025; Bazaar and the DNS-AID standardization effort both surfaced
in 2026). Real money moves through x402 today, but by one industry estimate
roughly half of current volume is testing rather than genuine commerce, not
mainstream agent commerce (CoinDesk, Mar 2026). Treat everything above as
proven-in-pockets and early-standards-track, not a mature market.

## How it works

1. **Register.** An owner calls `endpoint_registry::register` with a domain, a
   reference currency + price, an optional list of other accepted assets, and
   a facilitator URL. The contract stores this on chain; nothing about pricing
   or payTo lives off chain.
2. **Discover.** A backend job watches the registry's events and keeps a
   Cloudflare zone in sync, publishing an [AID](https://aid.agentcommunity.org/)-style
   `_agent.<domain>` TXT record via a CNAME the owner adds once. The record
   carries price, currency, settlement-asset address, pay-to address, and
   facilitator URL — everything needed to construct a payment, resolved in
   one DNS lookup before an agent ever makes an HTTP call.
3. **Pay.** An agent hits the paid route, gets a standard x402 402 response
   built from the registry's live on-chain state, pays, and retries with an
   `X-PAYMENT` header. Verification and settlement go through Stellar's
   official hosted facilitator — this project does not run its own. A human
   can do the same thing from the dashboard's Browse page (`/pay?domain=...`)
   with a connected wallet — no code required.
4. **Serve.** Once payment settles, the proxy fetches the owner's actual site
   (`https://<domain>`) and returns its real response. The call is logged and
   shows up live in the dashboard's Calls tab.

## For agents

The DNS record's `proto=mcp` field was, until now, a claim with nothing
behind it — an agent had no actual MCP tool to call. `mcp-server/` is that
tool: add it to Claude Code or Claude Desktop, hand it a Stellar key, and a
normal conversation ("check the price on demoea.neurus.xyz and pay if it's
under $1") resolves via DNS, pays via x402, and calls the real endpoint —
without writing a script. See `mcp-server/README.md` for setup.

## What's verified, on real Stellar testnet

- On-chain registration, and the resulting 402 response, carry the exact
  price/asset/payTo the registry contract holds — confirmed by driving a real
  request through the deployed contract.
- A real signed payment, from a funded testnet wallet, verified and settled
  through Stellar's hosted facilitator (`channels.openzeppelin.com`), in real
  Circle testnet USDC. Confirmed independently against Horizon.
- The proxy fetching a real origin (`example.com`) after settlement and
  returning its actual response, not a stand-in.

**Resolved — non-USDC settlement confirmed for real:** a live testnet
endpoint priced in XLM (not USDC) was paid end to end — 402, signed payment,
verification, on-chain settlement — through the same hosted facilitator used
everywhere else in this project, no code changes to the facilitator
integration. Settlement succeeded
(`c11a749415d3b89d26f8099cd51b954676860d38c6c72ed47cb9e00eaedbcaf7`,
confirmed on Horizon). The facilitator is asset-parameterized, not
USDC-hardcoded. One real caveat found in the process: the `@x402/core`
client library's own spend-control safety default rejects any
non-"default" asset unless the caller explicitly allows it
(`spendControls: false` or an `allowedAssets` entry) — that's a client-side
guard, not a facilitator limitation, but it means a naive integration will
look like it can't pay in anything but USDC until this is set.

**Still not wired up:** the on-chain registry's `accepted_assets` field
exists but is never read by the backend — every endpoint's 402 quote is
hardcoded to its single `reference_asset`. Multi-asset payment per endpoint
(sticker price in one currency, payable in several) is schema-ready, not
implemented.

**Live, not simulated, on real infrastructure:** the backend — DNS sync, the
x402-gated proxy, the call log — runs as a **Cloudflare Worker**
(`reroute-backend`), reachable at `https://api.neurus.xyz`, not a local
process. State (the registry-event cursor and the call log) lives in
**Workers KV**, which survives restarts and redeploys by design — the DNS
sync job runs on a **Cron Trigger** (once a minute) instead of an in-process
timer. The frontend (`fin/`) is deployed the same way, as a static export
served by a Cloudflare Worker (`reroute-fin`) — no local dev server required
to use it. Real on-chain registrations, real CNAME delegation, and real DNS
records were confirmed end-to-end against this live deployment via
independent DNS-over-HTTPS lookups, not just local testing. Without
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` configured, the sync job
falls back to a dry-run/log mode instead of failing, so the rest of the stack
stays usable with no secrets configured.

**Also shipped:** per-payer rate limiting and an on-chain allow/deny
`PayerPolicy`, both checked *before* settlement is attempted — a blocked or
rate-limited payer's transaction never reaches the chain, confirmed by
testing (deny-list → 403, rate limit → 429, with the on-chain transaction log
showing nothing was ever submitted for the blocked attempt).

## Layout

| Path | Contents |
|---|---|
| `fin/` | Next.js 16 frontend, deployed as a static export on Cloudflare (`reroute-fin`) — landing page, the dashboard (light-mode only, with an Analytics tab), a wallet-connected `/pay` page for actually paying an endpoint, and the public no-wallet `/browse` page. |
| `contracts/contracts/endpoint_registry/` | Soroban contract: registration, pricing, accepted assets, payer policy. |
| `contracts/packages/endpoint_registry_sdk/` | Generated TypeScript bindings. |
| `backend/` | Cloudflare Worker — DNS sync (Cron Trigger + KV), the x402-gated proxy, the call log. Deployed as `reroute-backend`. |
| `mcp-server/` | MCP server so Claude (or any MCP-speaking agent) can resolve prices and pay Reroute endpoints from a normal conversation, not just a script. |
| `REROUTE_RESEARCH.md` | External research (protocols, standards, economics) behind Reroute's design decisions. |
| `ROADMAP.md` | The 5 milestones to mainnet — what's done, what's open, what's not started. |

## Develop

```bash
cd contracts && cargo test -p endpoint-registry
cd backend && npm install && npm run dev     # wrangler dev
cd fin && npm install && npm run dev
```

Deploying the backend for real: `cd backend && npm run deploy` (needs
`wrangler login` once, plus `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, and
`X402_FACILITATOR_API_KEY` set via `wrangler secret bulk`).

Deploying the frontend for real: `cd fin && npm run build && npx wrangler
deploy` (static export, served from Cloudflare's edge as `reroute-fin`).
