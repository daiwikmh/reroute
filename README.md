# Reroute

**Reroute prices at the DNS layer.** x402 payments on Stellar are a crowded,
funded category — **ApiCharge** (SCF Round 40, $79k), **REAPP** (SCF Round 43,
combining x402 with AP2 mandate authorization), **TollPay**, **RouteDock**,
**SpendGuard**, and ~20 more from a single April 2026 hackathon all do "agent
pays API via x402 on Stellar" already. Every one of them still makes an agent
send a request and get a `402` back before it learns the price. **Nobody
found anywhere in Stellar's ecosystem index — not in project descriptions,
not across ~1,300 indexed hackathon submissions, not in the code index —
puts price, currency, settlement asset, and payee in the DNS record itself.**
Reroute's `_agent.<domain>` TXT record does, so an agent resolves the entire
payment in one DNS lookup, before it ever sends an HTTP request. Verified
live:

```
$ dig +short TXT 96bc5082e32eb01d.agents.neurus.xyz
"v=aid1;uri=https://neurus.xyz/pay/m3-test.neurus.xyz;proto=mcp;p=stellar-x402;
price=300000;cur=USDC;asset=CBIE...QDAMA;payto=GDI6...SFCT7;
facilitator=https://channels.openzeppelin.com/x402/testnet;active=true"
```

Once the agent decides to pay, it does so through the standard
[x402](https://developers.stellar.org/docs/build/agentic-payments/x402)
protocol — no API keys, no Stripe, no subscriptions. DNS is the price sheet;
x402 is still the payment rail.

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
   official hosted facilitator — this project does not run its own.
4. **Serve.** Once payment settles, the proxy fetches the owner's actual site
   (`https://<domain>`) and returns its real response. The call is logged and
   shows up live in the dashboard's Calls tab.

## What's verified, on real Stellar testnet

- On-chain registration, and the resulting 402 response, carry the exact
  price/asset/payTo the registry contract holds — confirmed by driving a real
  request through the deployed contract.
- A real signed payment, from a funded testnet wallet, verified and settled
  through Stellar's hosted facilitator (`channels.openzeppelin.com`), in real
  Circle testnet USDC. Confirmed independently against Horizon.
- The proxy fetching a real origin (`example.com`) after settlement and
  returning its actual response, not a stand-in.

**Known constraint, found by testing rather than assumed:** the hosted
facilitator's testnet deployment only recognizes its own specific USDC
contract for settlement — not arbitrary SEP-41 assets, despite docs implying
broader support. A merchant can still *price and discover* in any currency
(that part is genuinely on chain); actual settlement routes through the
facilitator's USDC, with `get_price`'s Reflector-based conversion handling the
difference between a merchant's chosen currency and what actually settles.

**Live, not simulated:** the DNS layer runs against a real Cloudflare zone
(`agents.neurus.xyz`) with a real domain — a real on-chain registration, DNS
sync, and CNAME delegation were confirmed end-to-end via independent
DNS-over-HTTPS lookups, not just local testing. Without `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ZONE_ID` configured, the sync job falls back to a dry-run/log
mode instead of failing, so the rest of the stack stays usable with no
secrets configured.

**Also shipped:** per-payer rate limiting and an on-chain allow/deny
`PayerPolicy`, both checked *before* settlement is attempted — a blocked or
rate-limited payer's transaction never reaches the chain, confirmed by
testing (deny-list → 403, rate limit → 429, with the on-chain transaction log
showing nothing was ever submitted for the blocked attempt).

## Layout

| Path | Contents |
|---|---|
| `fin/` | Next.js 16 frontend — landing page, and the dashboard's Endpoints/Calls tabs. |
| `contracts/contracts/endpoint_registry/` | Soroban contract: registration, pricing, accepted assets. |
| `contracts/packages/endpoint_registry_sdk/` | Generated TypeScript bindings. |
| `backend/` | DNS sync job (registry events → Cloudflare), the x402-gated proxy, the call log. |
| `REROUTE_RESEARCH.md` | External research (protocols, standards, economics) behind Reroute's design decisions. |

## Develop

```bash
cd contracts && cargo test -p endpoint-registry
cd backend && npm install && npm run dev
cd fin && npm install && npm run dev
```
