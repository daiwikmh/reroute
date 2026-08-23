# Roadmap to mainnet

Five milestones. First three are done and tested on real testnet
infrastructure this session — not mocked, not simulated. Last two aren't
started.

## Milestone 1 — Guarded access ✅ done

Every request gets checked before it's served, paid or not. A $0
verify-only endpoint still goes through the same gate as a paid one.

- DNS ownership has to check out before a domain can take a single payment.
  Nobody registers `google.com` with their own payout address and collects
  money meant for someone else.
- Per-payer rate limit and an on-chain allow/deny list, both checked
  **before** settlement is attempted. A blocked payer's transaction never
  gets submitted — it's not settled then refused, it never happens.
- Tested for real: deny-list gives a 403 with nothing on-chain; rate limit
  gives a 429 after the Nth call; both confirmed against the actual
  transaction log, not just the HTTP response.

## Milestone 2 — Real DNS, live ✅ mostly done, one piece open

Point a real domain at Cloudflare, one CNAME record, and pricing is
discoverable for real — not in a local test loop.

- Done: real Cloudflare zone (`neurus.xyz`), real on-chain registration
  syncing to a real DNS TXT record, confirmed independently via
  DNS-over-HTTPS lookups, not just our own tooling checking its own work.
- Done: price, currency, settlement asset, and payout address all resolve
  from that one record — an agent never has to hit the server to find out
  what something costs.
- **Open, not started:** hook up a real Stellar anchor so a seller can
  actually get paid out in EUR, USD, or INR instead of only holding whatever
  crypto asset settled on-chain. Right now pricing can be set in any
  currency, but there's no real off-ramp wired up yet — this is that piece.

## Milestone 3 — Dashboard ✅ done

Manage endpoints without a terminal.

- Register, pause, and resume endpoints from a real UI, not a CLI script.
- DNS setup panel shows the exact record to add and polls for live
  verification — no guessing whether it worked.
- Call log per endpoint with real transaction links, plus a public
  no-wallet Browse page listing every active endpoint's price, read
  straight from DNS.

## Milestone 4 — Independent security review — not started

Someone who didn't write this code needs to look at it before real money
goes through it.

- The contract itself: registration, pricing, the payer allow/deny logic.
- The payment gate: how the payer gets extracted from a transaction, the
  order guard checks happen in relative to settlement, the DNS verification
  step.
- Audit log per step, not just per call — if something goes wrong, it
  should be possible to trace exactly which check ran, in what order, and
  what it decided, not just see that a payment succeeded or failed.

## Milestone 5 — Mainnet — not started

Everything redeployed on Stellar's real network, with real assets. Real
domains, real sellers, real money moving. Public, not a demo.
