# Reroute backend

A small Hono service with three jobs: keep DNS in sync with the on-chain
registry, gate a paid route behind x402, and log settled calls.

## `src/dns/`

Polls `endpoint_registry`'s events (`Register`, `UpdatePrice`,
`UpdateAssets`, `SetActive`, `AdminDeactivate`) from a persisted cursor
(`data/dns-cursor.json`), and upserts a Cloudflare TXT record per registered
domain at `<slug>.<AGENTS_ZONE>` — the slug is the first 16 hex chars of the
domain's sha256, matching the contract's own key. Without
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` set, it logs what it would
write instead of calling the API, so the rest of the service still runs.

The contract only stores a domain's *hash*, not its plaintext — `Register`'s
one allowed non-topic field carries the domain string so the sync job can
learn the mapping once, at registration time; every later event only needs
the hash, since the job already has it cached.

`src/dns/status.ts` does the seller-facing half: a live TXT lookup at
`_agent.<domain>` (which follows the seller's CNAME automatically, per
standard resolver behaviour) so the frontend can show "pending" vs "verified"
without polling on-chain state itself.

## `src/x402/`

`GET /pay/:domain` builds x402 payment requirements straight from the
registry's live `Endpoint` (reference asset + price), using
`@x402/stellar`'s `ExactStellarScheme` and Stellar's hosted facilitator
(`X402_FACILITATOR_URL`, `X402_FACILITATOR_API_KEY` — get a free testnet key
at `channels.openzeppelin.com/testnet/gen`). Once payment settles, it fetches
the seller's real site (`https://<domain>`) and returns its actual response —
this is not a stand-in resource.

The facilitator's testnet deployment only recognizes its own specific USDC
contract, not arbitrary assets — a seller can still register any reference
currency, but settlement runs through that USDC underneath.

## `src/calls.ts`

Append-only log (`data/calls.json`) of settled calls — domain, payer, asset,
amount, tx hash, timestamp. Read via `GET /calls/:domain`.

## Env

```
PORT=8787
X402_FACILITATOR_URL=https://channels.openzeppelin.com/x402/testnet
X402_FACILITATOR_API_KEY=
AGENTS_ZONE=agents.neurus.xyz
PUBLIC_BASE_URL=https://neurus.xyz
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
```

## Commands

```
npm run dev     # tsx watch src/server.ts
npm run build   # tsc
npm start       # node dist/server.js
```
