# Multi-Chain Reward Router — Architecture

Stellar is the product. Users only ever deposit, withdraw, and see tickets/odds/prize
on Stellar — they never sign a Solana, Ethereum, or Hyperliquid transaction. Pooled
capital sitting in the Stellar vault is what gets routed out to those ecosystems to
generate the yield that funds the prize pool. This document is the spec for that
routing layer, before any of it gets built.

---

## 1. Trust model — read this first

Everything on Stellar (`savings_pool`: deposits, withdrawals, ticket accounting) is
fully trustless and on-chain today. Everything past "capital leaves Stellar" is
**administratively attested, not cryptographically proven**. There is no light-client
bridge here that lets the Stellar contract verify on-chain what actually happened on
Hyperliquid or Solana — a keeper service reports a number, and the contract trusts it.

This is not a corner being cut out of laziness — no production no-loss-lottery
protocol (PoolTogether included) has ever made the *external yield leg* fully
trustless; the attested boundary always exists somewhere. The right move is to put
that boundary in one clearly-documented place (`settle_round_yield`, below) and be
upfront with users about it, rather than pretend the whole system is trustless when
it isn't.

The admin/keeper key that does this attesting is the same trust tier as the existing
`agent-bridge` admin key already used for `AgentVault`/`LeveragePool` in this repo —
this is not a new trust assumption, it's the same one extended to more destinations.

---

## 2. Components

```
                         STELLAR (home chain, trustless)
                         ┌─────────────────────────────┐
   User deposit/withdraw │   savings_pool               │
   ───────────────────►  │   + RewardRouter extension   │
                         │   settle_round_yield(admin,  │
                         │     round, ecosystem, amount)│
                         └──────────────┬───────────────┘
                                        │ read totals / write settlement
                                        ▼
                         ┌─────────────────────────────┐
                         │  Allocator (agent-bridge,Go) │
                         │  internal/allocator          │
                         │  - allocation policy         │
                         │  - bridge-out / bridge-back  │
                         │  - yield normalization → USDC│
                         └───┬──────────┬──────────┬────┘
                             │          │          │
                    Allbridge Core  Allbridge Core │ (native Hyperliquid
                    (Stellar⇄ETH)  (Stellar⇄SOL)   │  USDC bridge via
                             │          │           \  Arbitrum + Circle CCTP)
                             ▼          ▼            ▼
                    ┌────────────┐┌────────────┐┌──────────────────┐
                    │ Ethereum   ││ Solana     ││ Hyperliquid       │
                    │ adapter    ││ adapter    ││ adapter           │
                    │ (passive:  ││ (passive:  ││ passive: HLP vault│
                    │  Aave/Lido)││  Kamino/   ││ active: agent-     │
                    │            ││  Solend)   ││  operated perps   │
                    └────────────┘└────────────┘└──────────────────┘
```

### 2.1 Stellar layer — `RewardRouter` (extends `savings_pool`)

New storage/entrypoints on top of the contract already built at
`contracts/contracts/savings_pool`:

- `TotalAllocated(ecosystem)` — how much pooled principal is currently deployed to
  each destination (Ethereum / Solana / Hyperliquid), so the dashboard can show
  where capital sits.
- `RealizedYield(round)` — cumulative yield credited into the current round's prize
  pool so far.
- `settle_round_yield(admin, round, ecosystem, amount)` — admin-authorized entrypoint.
  This is the **only** place a cross-chain result becomes real on Stellar. Everything
  upstream is off-chain computation the Allocator vouches for.

Deliberately **not** in this contract: the actual bridging, the actual Aave/Kamino/HLP
calls, any Solidity or Anchor code. Stellar's job is bookkeeping and prize-pool
accounting, nothing else.

### 2.2 Allocator — new package in `agent-bridge` (Go)

Sibling to the existing `internal/soroban`, `internal/matching`, `internal/sdex`
packages. Responsibilities:

1. Read `savings_pool.get_total_deposits()` and current per-ecosystem allocation.
2. Apply an allocation policy (fixed % split to start — see open questions) to decide
   how much idle capital to sweep out this round, and to where.
3. Drive the bridge-out leg (Allbridge Core for ETH/SOL; native Arbitrum→Hyperliquid
   USDC bridge via Circle CCTP for Hyperliquid).
4. Call the destination adapter to deploy capital.
5. On harvest, pull yield/PnL back, convert to a USDC-equivalent figure, bridge back
   to Stellar, and call `settle_round_yield`.

This service holds the custodial keys for every cross-chain leg. Operationally this
should sit in the same 1Password-backed key-injection pattern the repo already uses
for the agent-bridge admin key (see root `README.md` → "1Password Configuration") —
not a new key-management story to invent.

### 2.3 Bridging leg

**Allbridge Core is the only viable bridge out of Stellar** — it's the sole bridge
protocol with native Stellar support (live since 2023, connects Stellar to Ethereum,
Solana, Polygon, and others). Wormhole has no Stellar integration; that route is not
available.

Flag before committing real capital: Allbridge Core was hit by a **$1.65M flash-loan
exploit on its Solana pool in July 2026**. That doesn't disqualify it — it's still the
only production Stellar bridge — but it means (a) start with small allocation caps per
ecosystem, (b) treat bridge-leg exposure as the highest-risk part of this whole
design, worth revisiting before scaling deposit size, and (c) don't assume this
research is still current by the time this gets built — re-verify Allbridge's status
and any newer Stellar-bridge alternatives at build time, not from this document.

For Hyperliquid specifically, the path is two hops: Stellar → Ethereum/Arbitrum (via
Allbridge) → Hyperliquid L1 (via Hyperliquid's native USDC bridge, which uses Circle's
CCTP under the hood). There's no direct Stellar→Hyperliquid route.

### 2.4 Destination adapters

All three implement the same shape, so the Allocator can treat them identically:

```
deploy(amount_usdc) -> position_id
harvest(position_id) -> yield_amount   // in that chain's native unit
withdraw(position_id, amount)
```

- **Ethereum adapter** — passive only. Supply USDC to Aave v3 (and/or Lido for ETH
  legs, if the policy ever allocates non-stable capital there). No trading.
- **Solana adapter** — passive only. Supply to an existing lending market (Kamino or
  Solend — pick one at build time based on current TVL/audit status, not this doc).
- **Hyperliquid adapter** — the one ecosystem doing both, per the product decision:
  - *Passive*: deposit into HLP (Hyperliquid's own market-making vault) via their
    vault-deposit API. 4-day lock-up on withdrawals after the most recent deposit —
    the allocation policy needs to account for this illiquidity when sizing what goes
    here.
  - *Active*: the agent-bridge's existing trading machinery (`internal/matching`,
    `internal/sdex`) gets a Hyperliquid client so admin/agent-operated strategies can
    open real perp positions there, with realized PnL as the yield source. Third-party
    integration on Hyperliquid means creating an API wallet and handing its private
    key to the executing service — i.e., the Allocator/agent-bridge, same trust tier
    as everything else here, but worth being explicit that this key can place real
    leveraged trades.

### 2.5 Yield normalization

Every adapter's `harvest()` returns a number in whatever asset that ecosystem paid
out in (aUSDC interest, HLP vault NAV delta, perp PnL in USDC, etc.). The Allocator
converts everything to a common USDC figure at settlement time using that chain's own
live price/oracle, sums across ecosystems for the round, bridges the net amount back
to Stellar, and that's the number `settle_round_yield` records.

---

## 3. Build sequencing

1. **Stellar `RewardRouter` extension** — small addition on top of the existing,
   tested `savings_pool` contract. Fully testable in isolation, no cross-chain
   dependency yet.
2. **Allocator skeleton in agent-bridge** — policy engine + Stellar read/write calls,
   run in dry-run mode (computes what it *would* allocate, moves nothing) until the
   rest of the plumbing exists.
3. **One destination adapter, end to end** — recommend Hyperliquid's *passive* HLP
   leg first: single API integration, no smart contract to write, simplest custody
   story. Prove the full loop (bridge out → deploy → harvest → normalize → bridge
   back → settle) on this one leg before touching the others.
4. **Solana and Ethereum adapters** — same pattern, once the loop above is proven.
5. **Hyperliquid active trading leg** — last, deliberately. It's the highest-risk
   piece (real leveraged trading with pooled user capital) and should only go live
   once the settlement/attestation plumbing has been running correctly on the passive
   legs.

---

## 4. Open questions to resolve before each phase starts

- **Allocation policy**: fixed percentage split per ecosystem to start, or dynamic
  based on realized APY/utilization? Fixed is simpler and is the recommended MVP.
- **Solana lending venue**: Kamino vs. Solend — needs a current TVL/audit check at
  build time, not a decision baked into this doc.
- **Allbridge exposure limits**: what's the maximum amount ever allowed to sit
  bridged-in-flight at once, given the July 2026 exploit history?
- **Hyperliquid active-trading strategy**: what specifically does the agent trade,
  and what's the max drawdown/loss limit before the allocator pulls capital back?
- **Operational key custody**: confirm the 1Password-backed pattern extends cleanly
  to per-ecosystem keys, or whether each destination needs its own isolation.
