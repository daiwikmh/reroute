# Building a DreamCash-like app on Stellar, on top of STOX

Written 2026-08-21. Scope: answer whether STOX should become, or absorb, something
DreamCash-shaped — and if so, what actually gets reused.

**Short version: DreamCash is not prize-linked savings. It is a mobile-first
leveraged perpetuals exchange on Hyperliquid. Building it on Stellar means
rebuilding, from zero, the product this repo deleted six hours ago
(commit `d94a60c`). The recommendation is: do not build it. Steal exactly one
idea from it — the seasonal points economy — and put that inside STOX.**

---

## 1. What DreamCash actually is (verified)

Confidence: **high** on the product's nature, **medium** on the reward-mechanics
numbers (they come from third-party airdrop-farming write-ups, not first-party docs).

Two unrelated products share the name. Disambiguated:

| | What it is |
|---|---|
| **dreamcash.xyz** | The one that matters. Self-custodial mobile-first trading app on **Hyperliquid**. Perps, spot crypto, equities/commodities/forex via HIP-3 markets, prediction markets. Up to **40x leverage**. Headline copy: *"Your dream trading app."* Reports $7B+ total volume, 10,000+ users. |
| **dreamcash.io** | Unrelated. A generic offerwall/task-rewards app — *"Earn exciting prizes by completing tasks"* — payouts to PayPal or a crypto wallet. No deposits, no yield, no savings. Not a DeFi product at all. |

### dreamcash.xyz mechanics, as verified

- **Custody**: self-custodial; user deposits crypto into a Dreamcash wallet. Fiat on-ramp via card / Apple Pay / Google Pay through third parties.
- **Venue**: Hyperliquid. Dreamcash is a front-end and HIP-3 market deployer, not its own matching engine. HIP-3 RWA markets (USA500, TSLA, NVDA) launched mid-January 2026 with **Tether** and **Selini Capital**, USDT/USDT0-collateralised.
- **Season 1 points**: began **18 Feb 2026, 17:00 UTC**. Mobile 1 XP per $1 traded; web 0.5x that; trading via the Hyperliquid front-end directly earns 0 XP. ~150M XP distributed weekly pro-rata on volume share.
- **Cash rewards**: a **$200,000 USDT weekly pool for the first 10 weeks**, split by trading volume *and open interest* — deterministic pro-rata, **not a draw**.
- **Referrals**: 3 tiers, up to 20% of affiliate trading fees.
- **Token**: ticker **DREAM**. No TGE or airdrop date announced. The airdrop is speculative.
- **CASH markets were sunset 2 July 2026** — worth knowing before treating them as a stable design reference.

### What DreamCash is *not*

No savings product. No deposit-interest product. **No lottery, no draw, no randomness anywhere.** Every reward is a deterministic function of trading volume. The word "prizes" in its marketing means *competition payouts for trading activity*, not *prize-linked savings*.

### Comparison to PoolTogether and ample.money

The brief asked how DreamCash differs from these. The honest answer is that the question rests on a false premise — it is not the same category of thing, so the comparison is a category comparison, not a feature comparison:

- **vs. PoolTogether**: no overlap of substance. PoolTogether V5 is no-loss prize savings — ERC-4626 vaults contribute yield to a Prize Pool, a TWAB Controller tracks time-weighted balances, and a random number (Witnet / Chainlink VRF, obtained via a two-stage Start-RNG / Finish-RNG auction) distributes daily prizes across tiers. STOX is a PoolTogether-lineage product. DreamCash is not. The only shared vocabulary is the word "prize".
- **vs. ample.money**: **first-hand from a user-supplied screenshot** (updated 2026-08-21; see §10 for detail). Automated fetches still return **HTTP 403 (Cloudflare)** and web search surfaces only generic prize-linked-savings explainers, so nothing here comes from fetching the site — it comes from looking at it. ample is a **multi-asset, price-aware portfolio product**: vaults spanning WETH, Gold and HYPE under All / Crypto / Stocks / Commodities filters, a table carrying Price / Change 24H / Change 7D / Unrealized Return per asset, a Home / Payouts / Rewards / Team / Amplify nav, and a payout history of six bars around $3,300–$3,750 per cycle with a countdown to the next. That is much broader than the "short-duration USD assets through onchain money markets" framing the doc excerpts implied, and it is closer to STOX's multi-asset ambition than to DreamCash's perps.

---

## 2. Does this actually make sense? — the recommendation

**No. Do not build a DreamCash-like app on top of STOX.** Three reasons, in order of weight.

### 2.1 It is the product you just deleted

Commit `d94a60c` ("Remove Stox Terminal; STOX prize-linked savings is the product") removed, in one pass:

- `leverage_pool`, `agent_vault`, `zk_auth` Soroban contracts
- `vault_sdk` / `leverage_sdk` TypeScript bindings
- the entire `agent-bridge` Go service — including `internal/matching/engine.go`, `orderbook.go`, `liquidation.go`, `price.go`, `internal/positions/store.go`, `internal/sdex/client.go`

That is a leveraged-trading venue with a matching engine, an order book, and a liquidation engine. It is, structurally, DreamCash. The decision to delete it was made deliberately and the README was rewritten around prize-linked savings on the strength of it. "Build a DreamCash-like app" is a request to reverse that decision. It may be the right call to reverse it — but it should be argued as *reversing a decision*, not as *extending STOX*, because it is not an extension of anything. `git revert d94a60c` recovers more of it than any new work on `savings_pool` would.

### 2.2 The overlap with STOX is one word wide

Take the two products' core loops side by side:

| | STOX | DreamCash |
|---|---|---|
| User's downside | forgone interest only | full liquidation of margin |
| Position | non-negative custodied principal | leveraged long/short with PnL |
| Capital direction | supplied *into* a lending pool (Blend) | posted as *margin against* a counterparty |
| Payout mechanism | random draw over tickets | deterministic pro-rata on volume |
| Time dimension | balance held × seconds | volume traded, open interest |
| Regulatory frame | prize-linked savings | leveraged derivatives |

Nothing in the right column is reachable by extending the left. `savings_pool`'s entire accounting model — `settle()` computing `principal * elapsed`, per-`(user, asset)` `Principal`/`Checkpoint`/`Accrued` keys — assumes a balance that is non-negative, custodied, and not marked to market. A perps position has none of those properties. You cannot leverage a savings pool; you replace it.

### 2.3 The frontend is a direct contradiction, not a reskin

`fin/` is stated as final design. Its copy is load-bearing and it says the opposite of what a leveraged app must say:

- `HowItWorksSection.tsx`: *"You deposit USDC into the pool and it stays yours."*
- `FaqSection.tsx`: *"Can I actually lose my deposit? Not to the draw…"*
- `HowItWorksSection.tsx`: *"You keep every cent you put in."*

A 40x product cannot ship under that copy. Not a rewrite of a section — a rewrite of the promise. And the dashboard's four tabs (`Overview` / `Deposit` / `Draws` / `Activity`) would become `Markets` / `Trade` / `Positions` / `Orders`; the `Draws` tab has no meaning in a product with no draw. So "fin/ is final" and "build DreamCash" cannot both hold.

### 2.4 What I would do instead

**Steal the seasonal points economy. Leave the trading engine.**

The one genuinely transferable idea in DreamCash is its *reward layer*: a season with a fixed weekly pool, distributed pro-rata against a time-and-activity-weighted score, with a mobile multiplier and a referral tier. Structurally that is **the same shape as STOX's ticket accrual and weekly prize** — an accumulating per-user score settled against a pool on a weekly boundary. STOX already computes the score (`get_tickets`); DreamCash's contribution is what you can *do* with such a score beyond a single winner-takes-all draw.

Concretely, two things worth importing into STOX as features:

1. **A pro-rata consolation tier.** Today's design is one weekly prize, one winner. DreamCash's weekly pool is fully pro-rata — nobody gets nothing. PoolTogether V5 splits the difference with prize tiers. Recommendation: split the weekly pot, e.g. 80% to the random draw, 20% distributed pro-rata by ticket share. This directly addresses the retention problem that a single-winner draw has (a depositor with a small balance may never win anything, ever, and leaves), and it reuses `get_tickets` / `get_total_tickets` with **no new accounting at all**.
2. **Seasons and referrals as an off-chain points layer.** DreamCash's XP is not on-chain and does not need to be. A season leaderboard, referral attribution, and a boost multiplier can be computed entirely from the `deposit` / `withdraw` events `savings_pool` already emits, indexed off-chain. Zero contract risk, zero contract change.

That is a real feature roadmap that makes STOX better. "Add perps to a savings app" is not.

**Uncertainty I want to name:** if what the user actually admires about DreamCash is its *distribution* — mobile-first, fiat on-ramp, self-custodial wallet UX, 10,000 users — then the lesson is about go-to-market, not architecture, and none of the above applies. That would be a genuinely good thing to copy and it has nothing to do with perps. I could not tell from the brief which of the two was meant, and the answer changes the recommendation.

---

## 3. Capability map: built / extension / new construction

Per the brief, no percentages. Each DreamCash capability against a named file or a named missing thing.

| DreamCash capability | Status in STOX | Detail |
|---|---|---|
| Deposit collateral | **(b) small extension** | `savings_pool::deposit` (`lib.rs`) already custodies a token and books principal. A perps venue's collateral deposit is the same transfer, but the balance it credits is *margin*, not principal, and must be debitable below the user's deposit by PnL. `Principal` is `i128` so it can go negative structurally, but nothing in `withdraw` or `settle` handles it. |
| Withdraw collateral | **(b) small extension** | `savings_pool::withdraw`, plus a margin-availability check that does not exist. |
| Multi-asset support | **(a) already built** | `DataKey::Assets` registry, `add_asset`, `require_supported`. Reusable as-is for collateral tokens. Note this is a registry of *tokens*, not of *markets* — a perps venue additionally needs (symbol, index oracle, max leverage, funding rate, tick size), which is a new type. |
| Activity events | **(a) already built** | `deposit` / `withdraw` / `add_asset` events. Sufficient for an off-chain indexer to build a points leaderboard today. |
| Time-weighted score | **(a) already built, for the wrong quantity** | `settle()` gives `principal * seconds`. DreamCash scores *volume traded*, which is a sum over fills, not an integral over held balance. The code is not adaptable — the two are different mathematical objects. |
| Weekly pool distributed pro-rata by score | **(b) small extension** | `get_tickets` / `get_total_tickets` give the numerator and denominator. Needs a rounds/epoch concept (see §5) but no new accounting. **This is the reusable bridge between the two products.** |
| Yield on idle collateral | **(b) small extension** | The Blend leg (not yet built, but decided) supplies to a lending pool. Hyperliquid's analogue is HLP — a *counterparty* vault that takes the other side of trades. Opposite economics: Blend earns from borrowers, HLP earns from traders' losses. The Blend integration is reusable only if the perps venue is external and collateral sits idle between trades. |
| Order book / matching | **(c) new construction** | Nothing in the repo. Deleted in `d94a60c` (`agent-bridge/internal/matching/`). |
| Liquidation engine | **(c) new construction** | Same — deleted `liquidation.go`. Needs a keeper, a mark price, a maintenance-margin rule, and an insurance fund. |
| Leverage / margin accounting | **(c) new construction** | Deleted `leverage_pool`. |
| Funding rate | **(c) new construction** | Never existed here. |
| Index/mark price feed | **(c) new construction, but unblocked** | Reflector is the same oracle STOX needs anyway (§4.2). Mainnet feeds: CEX/DEX aggregate `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN`, Stellar DEX `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`, FX `CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC`. |
| Counterparty liquidity (HLP-equivalent) | **(c) new construction** | The hardest piece. Hyperliquid's HLP holds hundreds of millions. A Stellar perps venue with no counterparty pool has no depth. |
| RWA / equity perps (HIP-3) | **(c) new construction, plus not-technical blockers** | HIP-3 is a Hyperliquid protocol feature. Stellar has no equivalent permissionless-market-deployment primitive. Dreamcash needed **Tether and Selini Capital** to launch theirs — market-maker relationships, not code. |
| Mobile app | **(c) new construction** | `fin/` is a Next.js web app. |
| Fiat on-ramp | **(c) new construction** | Third-party integration. |
| Referral tiers | **(c) new construction, but cheap** | Fully derivable off-chain from existing events. |

**Reading of the table**: everything in the "already built" and "small extension" rows is generic custody-and-scoring plumbing. Every row that is distinctively *DreamCash* — matching, margin, liquidation, funding, counterparty depth, HIP-3, mobile — is new construction, and most of it was in the deleted commit. That is the empirical answer to "does it extend or replace": it replaces.

---

## 4. What does not map cleanly to Stellar

Both of the following are **STOX problems regardless of DreamCash**, and are the real work.

### 4.1 There is no VRF on Stellar, and the site already promises one

**The problem.** `soroban_sdk`'s `Env::prng()` is documented as *"not suitable for security-sensitive work."* It is seeded per-transaction from data the submitter has influence over, and a caller can simulate before submitting and only submit when the outcome is favourable — the classic simulate-then-choose attack. It cannot secure a value-bearing draw.

**The exposure.** `fin/src/components/HowItWorksSection.tsx` already ships:

> *"The randomness is verifiable on-chain, so nobody — including us — can steer the result."*

and `FaqSection.tsx`:

> *"The randomness is produced outside the protocol and verified on-chain, so the operator cannot pick or withhold a result."*

Those two sentences are a specification, not marketing. Note the FAQ one is *more* precise than the How-It-Works one and is closer to what is actually buildable — "produced outside, verified on-chain" is exactly the drand design below. Any draw that ships must satisfy the stronger of the two, or the copy has to change before launch. Flagging per the brief rather than editing: **`fin/` is currently making a claim the contract cannot yet honour.** That is fine while nothing is deployed and becomes a serious problem the moment real money is in the pool.

**Recommended design: drand beacon, verified on-chain via BLS12-381.**

Stellar shipped **BLS12-381 host functions in Protocol 22 (CAP-0059, mainnet December 2024)** — pairing operations, G1/G2 arithmetic, hash-to-curve. This is exactly what is needed to verify a drand beacon signature inside a Soroban contract.

The mechanism:

1. drand (League of Entropy) publishes a BLS-signed random value every 30s on a public schedule. Round numbers map deterministically to wall-clock time.
2. The contract stores drand's chain public key and, at round creation, **commits to a future drand round number** derived from the round's close timestamp — before that beacon exists.
3. After close, anyone (a keeper, a user, an adversary) submits the beacon value and its signature. The contract verifies the BLS signature against the stored public key over the committed round number.
4. Verification either passes or fails. The submitter cannot forge a value, cannot choose among values (only one signature verifies for a given round), and cannot withhold indefinitely — anyone can submit, and drand values are public.

This satisfies both marketing claims *literally*: produced outside the protocol, verified on-chain, unsteerable by the operator.

Costs and caveats, honestly:
- BLS verification is expensive in Soroban resource terms. **Unmeasured.** Must be benchmarked against the transaction resource limits before committing — this is a genuine risk to the design, not a formality. Once per week per round is the best possible case for affordability, but it needs a number.
- Requires pinning drand's public key and chain hash as contract state, with an admin migration path if drand rotates. That is a small trust residue: an admin who can swap the public key can eventually steer draws. Mitigate with a timelock on key changes.
- Liveness: if nobody submits the beacon, the round does not settle. Since anyone can submit and the prize is the incentive, this is acceptable; add a fallback that lets the round roll forward if unsettled past a deadline.

**Alternatives considered and why not:**
- *VRF-Soroban* (SCF #44, ~$50k XLM, July 2026) and *NebulaVRF* (SCF #34, ~$34k XLM, April 2025). Both exist as funded SCF projects. **I could not verify that either is deployed on mainnet, audited, or production-ready** — SCF funding is not a shipping signal. Worth an hour of due diligence; if one is live and audited, it is likely simpler than rolling drand verification.
- *Commit-reveal among participants*: the last revealer can always abort by withholding, which biases the outcome. Needs bonding and slashing to be safe, which is more machinery than the drand path.
- *Future ledger hash*: validators have influence and it is not verifiable as unbiased. No.

### 4.2 USD-normalised time-weighted tickets cannot be integrated exactly on-chain

**The problem.** The target model is "$1 held a full week = 10 tickets", which means the ticket count is `∫ balance(t) · price(t) dt`. Price moves continuously; a contract only executes at discrete transactions. The exact integral is not computable on-chain, ever, by anyone. The question is only which approximation, and what it costs.

**The key observation: `lib.rs` already got this right by accident (or by good instinct).**

`settle()` accrues **asset-denominated ticket-seconds** — `principal * elapsed`, stored per `(user, asset)` in `DataKey::Accrued`, with `TotalAccrued` per asset. Crucially it does *not* convert to USD at deposit time. That separation is the whole ballgame, and the in-code comment already names it:

> *"These are asset-denominated ticket-seconds. Normalising them to USD so that tickets are comparable across assets is a separate layer, not yet built."*

**Recommended design: convert once, at the round boundary, using a round-length TWAP.**

```
tickets_usd(user) = Σ_asset  accrued[user][asset] × twap[asset] / 10^decimals(asset)
```

where `twap[asset]` is read from Reflector once at round close, over a window covering the round.

Why this is the right approximation:

- **It is a small extension, not new construction.** Per-asset accrual already exists and is already tested. What is added is a per-round price snapshot and a summation in a read path. No change to `settle()`, no change to the storage layout.
- **One oracle read per asset per round**, not one per user transaction. Cheap, and bounded by the asset registry size.
- **The manipulation surface collapses to one point.** Under the naive alternative (price at each checkpoint), a user times deposits and withdrawals to moments when their asset's oracle price is spiking, and mints tickets from volatility. Under round-boundary conversion there is nothing to time — every holder of a given asset is converted at the same rate. The remaining attack is manipulating the round-close TWAP itself, which is Reflector's problem and is what TWAP windows exist to resist. (Cautionary precedent on Stellar: the YieldBlox incident, where a single DEX trade moved an oracle price enough to drain a lending pool. Use the CEX/DEX aggregate feed, not the Stellar-DEX-only feed, for anything thin.)

**The error this leaves, stated plainly.** A holder is credited at one price for the whole week, so if XLM doubles mid-week, XLM depositors are over-credited relative to the true integral, and USDC depositors are correspondingly diluted. The error is real, bounded by the asset's intra-round price range, and structurally zero for the stablecoins that will be most of the pool. Nobody can time it — it applies uniformly to everyone holding that asset — so it is a fairness imprecision, not an exploit.

**Refinement if the imprecision proves material:** segment accrual at price checkpoints — a permissionless `checkpoint_price(asset)` that anyone (or a keeper, hourly) can call, which closes the current accrual segment at the current price and opens a new one. This turns the piecewise-constant approximation from 1 segment per round into N, converging on the true integral as N grows, at a storage and gas cost per segment. **Do not build this first.** Ship the single-TWAP version, measure the divergence against off-chain-computed true integrals, and only add segmentation if the numbers justify it.

**Unverified detail:** Reflector's exact TWAP signature. SEP-40 defines `lastprice`, `price`, `prices`, `decimals`, `resolution`; Reflector extends with TWAP functions (`twap` / `x_twap`), but I could not fetch the contract source to confirm argument shapes — it takes a records/periods count rather than a time window, which interacts with the oracle's `resolution`. Confirm against the deployed contract before writing the integration.

---

## 5. Build sequence

Ordered by what unblocks the most. This is the **STOX** sequence — §2 recommends not building DreamCash, so this sequence delivers the product that exists, with the one DreamCash idea worth taking folded into step 6.

```
1. Rounds/epochs in savings_pool
   → unblocks: 2, 3, 5, 6.  Depends on: nothing.
   The single largest missing primitive. Today accrual runs forever with no
   boundary; there is no concept of a round to draw for. Needs: round id, open
   /close timestamps, and per-round snapshotting of accrued ticket-seconds so
   that closing a round does not destroy in-flight accrual.
   Verify: a user depositing mid-round has tickets in that round and the next,
   and the two sum to their continuous accrual.

2. Reflector integration + USD ticket normalisation (§4.2)
   → unblocks: 3, 6.  Depends on: 1 (needs a round boundary to snapshot at).
   Add per-round per-asset TWAP snapshot; add a read path summing
   accrued × twap across assets. Do NOT touch settle().
   Verify: 1 USDC and $1-worth of XLM held the same duration yield equal
   tickets, to within the documented TWAP error.

3. Blend integration (the yield leg)
   → unblocks: 5.  Depends on: 1 (yield must be attributable to a round).
   Route deposits into Blend via submit() with SupplyCollateral; track the
   position in bTokens and convert with the reserve's b_rate. Prize for a round
   = (underlying value at close) − (underlying value at open) − net flows.
   Verify: a round with known Blend yield produces exactly that prize figure.
   Risk to confirm first: withdrawal liquidity. STOX promises no lock-up on
   principal; Blend utilisation can make an immediate full withdrawal
   impossible. Decide the buffer policy here, not later.

4. Randomness: drand + BLS verification (§4.1)
   → unblocks: 5.  Depends on: nothing (parallelisable with 1–3).
   Start with the resource benchmark, not the implementation — if BLS
   verification does not fit the transaction budget, the whole approach dies
   and the earlier that is known the better. Do the VRF-Soroban / NebulaVRF
   mainnet-readiness check in the same hour.
   Verify: a beacon signature for the wrong round fails; the right one passes;
   the operator cannot produce a passing signature for a value of their choice.

5. Draw + prize payout
   → Depends on: 1, 2, 3, 4. This is where the product becomes real.
   Select winner by walking the USD ticket distribution with the verified
   random value; transfer the prize; emit a round-settled event.

6. Prize tiers — the DreamCash borrow (§2.4)
   → Depends on: 5. Small once 5 exists.
   Split the pot: majority to the random winner, a minority distributed
   pro-rata by ticket share. Uses only get_tickets / get_total_tickets.

7. Frontend wiring
   → Depends on: 1–5 for real data, but the read paths can be built against
   testnet deploys incrementally. PrizesSection's three "—" stats and the
   dashboard's four tabs are already shaped for exactly this data.

8. Off-chain points/seasons/referrals layer — the other DreamCash borrow
   → Depends on: nothing. Buildable today from existing deposit/withdraw
   events. Lowest risk item in the list; zero contract change.
```

Critical path is `1 → 2 → 3 → 5`. Step 4 is the only item that can be fully parallelised and is the only one with a *binary* risk of invalidating its own approach, which is why its benchmark should happen first even though its position in the dependency graph does not demand it.

---

## 6. Open questions — decisions, each with a recommendation

**Q1. Is DreamCash the reference, or was the reference actually its distribution?**
The design above assumes the former and recommends against it. If what is admired is mobile-first UX, fiat on-ramp, and self-custodial wallet flow, that is worth copying and is orthogonal to perps.
→ **Recommendation: confirm which. If it is distribution, the next piece of work is a mobile client and an on-ramp for STOX, not a trading engine.**

**Q2. Do we reverse `d94a60c` and run a trading product alongside savings?**
Two products, two regulatory frames, two audit surfaces, one team.
→ **Recommendation: no. Ship STOX to mainnet with a working draw first. Nothing in the deleted code is lost — it is one `git revert` away if the decision changes with evidence.**

**Q3. Single winner, or prize tiers?**
Current design implies one winner per week. A small depositor may never win and will leave.
→ **Recommendation: tiers — 80% random draw, 20% pro-rata by ticket share. Costs almost nothing on top of step 5, and directly addresses retention. Revisit the split after the first ten rounds of real data.**

**Q4. drand+BLS, or an existing Soroban VRF?**
→ **Recommendation: spend one hour checking whether VRF-Soroban or NebulaVRF is deployed and audited on mainnet. If yes, integrate it. If no, build the drand path — but benchmark BLS verification cost before writing anything else.**

**Q5. TWAP window, and how much price-integration error is acceptable?**
→ **Recommendation: one TWAP per asset per round at close, from Reflector's CEX/DEX aggregate feed. Ship it, measure divergence against an off-chain true integral for ten rounds, and only add price-checkpoint segmentation if the divergence exceeds a threshold worth defending — likely never, if the pool is majority stablecoin.**

**Q6. `fin/` promises verifiable randomness the contract cannot yet honour (§4.1).**
→ **Recommendation: leave the copy alone — it is a correct specification of what step 4 must deliver, and it is better to build to the promise than to weaken it. But it becomes a launch blocker: do not accept mainnet deposits until the drand (or VRF) path is live, because at that point the copy is a false statement about live money.**

**Q7. What happens to withdrawals when Blend utilisation is high?**
Not raised in the brief, but it is the sharpest unaddressed contradiction between the marketing and the architecture: `HowItWorksSection.tsx` says *"withdraw the full amount whenever you want"*, and a lending pool cannot always honour that.
→ **Recommendation: hold a liquidity buffer outside Blend (start at 10% of TVL, tune from real withdrawal patterns), and decide before launch what the UI says when the buffer is exhausted. Do not discover this in production.**

---

## 7. Sources

DreamCash: [dreamcash.xyz](https://dreamcash.xyz/) · [dreamcash.io](https://dreamcash.io/) · [airdrops.io/dreamcash](https://airdrops.io/dreamcash/) · [BTCC review](https://www.btcc.com/en-AU/academy/crypto-basics/dreamcash-app-review-everything-you-need-to-know-about-it) · [Google Play](https://play.google.com/store/apps/details?id=xyz.dreamcash.app)

PoolTogether: [V5 protocol design](https://dev.pooltogether.com/protocol/design/) · [prize pool](https://dev.pooltogether.com/protocol/design/prize-pool/) · [draw auction](https://dev.pooltogether.com/protocol/design/draw-auction/)

Stellar: [CAP-0059 BLS12-381](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md) · [Protocol 22 announcement](https://stellar.org/blog/developers/announcing-protocol-22) · [oracle providers](https://developers.stellar.org/docs/data/oracles/oracle-providers) · [soroban_sdk Env](https://docs.rs/soroban-sdk/latest/soroban_sdk/struct.Env.html) · [Reflector](https://reflector.network/docs) · [Blend pool integration](https://docs.blend.capital/tech-docs/integrations/integrate-pool)

VRF on Stellar: [SCF #44 recap](https://medium.com/stellar-community/scf-44-round-recap-b5e8acd87045) (VRF-Soroban) · [SCF #34 recap](https://medium.com/stellar-community/scf-34-round-recap-ea0ea6564d3a) (NebulaVRF)

**Not verified at the time §1–§7 were written:** ample.money (HTTP 403, Cloudflare) — since resolved first-hand by screenshot, §10. Reflector TWAP argument shape — since resolved, and the premise was wrong: §8. Soroban resource cost of BLS12-381 verification — since **measured**, §9. Still open: VRF-Soroban / NebulaVRF mainnet status.

---

## 8. CORRECTION to §4.2 — Reflector has no TWAP, verified first-hand

Added 2026-08-21, after §4.2 was challenged. **§4.2's recommended mechanism is wrong
and not implementable as written.** The research session was right. This section
supersedes the TWAP mechanism in §4.2; the *design principle* in §4.2 still holds
(see "What survives", below).

### Provenance of the original error

The §4.2 claim that Reflector "extends SEP-40 with TWAP functions (`twap` / `x_twap`)"
was **not** first-hand. The contract source fetch 404'd and `reflector.network/docs`
returned nothing usable, so the claim came from documentation, blog posts, and
inference about what a SEP-40 oracle "should" have. §4.2 flagged the *argument shape*
as unverified but still asserted the functions exist. That was the error: the
uncertainty was real but was scoped far too narrowly.

### What is actually deployed — verified

Method: `stellar contract info interface` and simulated read-only invokes against
Stellar **mainnet**, cross-checked on two independent RPC providers
(`mainnet.sorobanrpc.com`, `soroban-rpc.mainnet.stellar.gateway.fm`), against all
three Reflector oracle contracts. Both providers and all three contracts return
byte-identical specs.

**There is no `twap`. There is no `x_twap`. There are no cross-price functions at
all.** The complete deployed interface is:

```rust
fn base() -> Asset;                                   // = Other("USD")
fn assets() -> Vec<Asset>;
fn decimals() -> u32;                                 // = 14
fn resolution() -> u32;                               // = 300 (seconds)
fn last_timestamp() -> u64;
fn cache_size() -> u32;                               // = 2
fn history_retention_period() -> Option<u64>;         // = 86400
fn lastprice(asset: Asset) -> Option<PriceData>;
fn price(asset: Asset, timestamp: u64) -> Option<PriceData>;
fn prices(asset: Asset, records: u32) -> Option<Vec<PriceData>>;
fn expires(asset: Asset) -> Option<u64>;
fn estimate_retention_cost(period: u64) -> (Address, i128);
// + admin-only: config, set_price, add_assets, set_cache_size, set_fee_config,
//   update_contract, extend_asset_ttl, set_history_retention_period
// PriceData { price: i128, timestamp: u64 }
// Asset = Stellar(Address) | Other(Symbol)
```

Measured limits, all confirmed by invocation:

| Property | Value | How it was established |
|---|---|---|
| `prices(asset, N)` maximum N | **20** | N=20 returns; N=21 and above return nothing. Bisected. |
| Window from one `prices()` call | **100 minutes** | 20 records × 300s resolution, newest-first, timestamps confirmed descending by exactly 300. |
| `price(asset, t)` at arbitrary t | **works**, resolution-aligned | Confirmed at 1h/6h/12h/14h/16h/18h/20h/21h back. |
| Effective usable history | **~21 hours** | 21h returns data; 22h returns `null`. Nominal retention is 86400s; the rolling window trims. |
| Price decimals | **14** | XLM read as `18569232143722` = $0.18569; USDC `100040016006402` = $1.00040. |
| Retention extension cost, 7 days | **1,400 XRF** | `estimate_retention_cost(604800)` → `14000000000` of token `CBLLEW7HD2RWATVSMLAGWM4G3WCHSHDJ25ALP4DI6LULV5TU35N2CIZA`, symbol **XRF**, 7 decimals. (24h = 200 XRF.) |

**Two integration gotchas neither §4.2 nor the docs mention:**

1. **Assets on the CEX/DEX aggregate feed are `Other(Symbol)`, not `Stellar(Address)`.** Its asset list is `BTC, ETH, USDT, XRP, SOL, USDC, ADA, AVAX, DOT, MATIC, LINK, DAI, ATOM, XLM, UNI, EURC` — all symbols. So the normalisation layer needs an explicit **token `Address` → oracle `Symbol`** mapping in contract storage. `savings_pool`'s registry keys everything by `Address`, so this is a new map, not a lookup it can already do.
2. **The retention fee is payable in XRF, Reflector's own token — not XLM.** Any design depending on extended retention acquires a token dependency.

### Why this kills the §4.2 mechanism outright

A 7-day round TWAP cannot be read from Reflector by any combination of these calls:

- no `twap` function to call;
- `prices()` caps at 20 records = 100 minutes, so a week needs ~101 paged calls;
- and only ~21h of history exists regardless, so pages 6 through 101 return `null`.

Note that **paying for 7-day retention does not fix this.** It removes only the third
constraint. The 20-record cap and the absent `twap` remain, so 1,400 XRF buys history
that still cannot be read in a transaction. Do not spend it.

### Corrected design — three tiers, in the order they should be built

**v1 — trailing 100-minute TWAP. Implementable today, zero cost, no keeper.**
One `prices(asset, 20)` call at round close; mean the 20 records. This is not a
round-length TWAP, it is a *round-close* TWAP — but 100 minutes of CEX-medianed
prices is a genuinely hard thing to move, and it is strictly better than `lastprice`
spot for one call's worth of effort. **Recommend shipping this first.**

**v1.5 — spread sampling across the final ~21h.** N `price(asset, t)` calls at
chosen resolution-aligned timestamps. Better coverage of the round than 100
contiguous minutes at its end. Cost is N ledger reads; the number of `price()` calls
that fit in one transaction's resource budget is **unmeasured** and must be
benchmarked before committing to an N.

**v2 — true round-length TWAP via a contract-side price accumulator.** Stop trying to
read history; accumulate it. A permissionless `checkpoint_price(asset)` reads
`lastprice` and accumulates `Σ price_i × Δt_i` plus total elapsed into contract
storage; at round close `twap = accumulated / elapsed`. This needs **no oracle
history at all**, only `lastprice`.

The reason to prefer this over anything else long-term: it is *the same
checkpoint-and-accumulate shape `settle()` already uses in `lib.rs`* — settle on
write, accumulate the integral, move the checkpoint forward. It reuses a pattern the
codebase already has and tests.

Its one real hazard, which must be designed for: a caller who lets a long interval
elapse and then fires `checkpoint_price` exactly at a price spike credits that spike
for the whole preceding interval. Mitigate by **capping the Δt any single checkpoint
may contribute** (e.g. 1 hour) and running a keeper at that cadence; uncapped, this
is an exploit, not an imprecision.

### The scheduling consequence — this is now off the critical path

Per commit `458ee79`, launch is **USDC-only**, XLM registered but gated off, USDT
dropped. The only priced asset at launch trades at $1.00040. USD normalisation across
assets is therefore **very close to a no-op for mainnet launch**, and none of v1/v1.5/v2
blocks shipping.

That changes the build sequence in §5: step 2 (Reflector integration) drops off the
critical path, which becomes `1 → 3 → 5`. The right move is to ship v1 as a
correctly-shaped stub, then run v2's accumulator in shadow — writing to storage,
read by nothing — for as many weeks as it takes to gain confidence, well before XLM is
ungated and the number becomes load-bearing. That is a much better position than
needing it to be right on day one.

### What survives from §4.2

The design principle, which was the valuable part and is unaffected: **convert
asset-denominated ticket-seconds to USD once at the round boundary, not per
checkpoint.** Per-checkpoint conversion lets a depositor time deposits and withdrawals
to their asset's price spikes and mint tickets from volatility; round-boundary
conversion leaves nothing to time, because every holder of an asset converts at the
same rate. `lib.rs` keeping accrual asset-denominated remains exactly right. Only the
mechanism for producing the conversion rate changes — from "call `twap`" to "build
the average yourself", which is materially more work and one fewer dependency.

Also unaffected: use the CEX/DEX aggregate feed, not the thin Stellar-DEX-only one.

### Still unverified after this pass

- Resource cost of N `price()` calls in one transaction (blocks choosing v1.5's N).
- Whether Reflector's rolling retention window is stable at ~21h or varies.
- BLS12-381 verification cost from §4.1 — unchanged, still the highest-risk unknown.

---

## 9. RESOLVED — BLS12-381 verification cost, measured

Added 2026-08-21. §4.1 called this "the highest-risk unknown in the whole design"
because a bad number would have invalidated the drand approach entirely. **It is
measured now, and the answer is comfortable: a full drand-beacon verification costs
about 7% of a transaction's compute budget.** The randomness design is affordable.

### Method

A standalone `soroban-sdk 25.1.1` contract implementing the real verification path —
`sha256(round_be_u64)` → `hash_to_g1(msg, DST)` → `pairing_check` over two (G1, G2)
pairs — measured with `env.cost_estimate().budget()`. Built outside this repo's
workspace to avoid colliding with in-flight `Cargo.toml` edits.

The test constructs a genuine valid signature in-contract (`pk = P·s`,
`sig = H(m)·(−s)` for a fixed G2 point `P`), so `pairing_check` returns **true** for a
good beacon and **false** for a wrong round. It is a positive control, not just a cost
probe: the pairing algebra is verified end-to-end, not assumed.

### Results

Denominators are **live mainnet values**, read from the network rather than assumed —
`ConfigSettingContractComputeV0` via `getLedgerEntries`: `tx_max_instructions` =
**400,000,000**, `tx_memory_limit` = **41,943,040** (40 MiB), `ledger_max_instructions`
= 580,000,000, `fee_rate_per_instructions_increment` = 7 stroops.

| Operation | CPU insns | % of 400M tx limit | Memory | % of 40 MiB |
|---|---|---|---|---|
| **`verify_beacon` (sha256 + hash_to_g1 + pairing_check)** | **27,296,351** | **6.82%** | 164,866 B | 0.39% |
| — of which sha256 + `hash_to_g1` | 3,240,028 | 0.81% | 15,862 B | 0.04% |
| — remainder is `pairing_check` (2 pairs) | ~24,056,000 | ~6.01% | — | — |
| `g1_is_in_subgroup` + `g2_is_in_subgroup` | 1,818,971 | 0.45% | 5,787 B | 0.01% |
| **Total, verification + subgroup checks** | **~29,115,000** | **~7.3%** | ~171 KB | 0.41% |

Fee for the compute: `ceil(29,115,322 / 10,000) × 7` = 20,384 stroops ≈ **0.00204 XLM
≈ $0.0004** at $0.18569/XLM. Negligible, and it is paid once per weekly draw.

### What this settles

- **The drand + BLS12-381 path in §4.1 is viable.** ~7.3% of budget leaves the other
  93% for the thing that actually needs it — walking the ticket distribution to select
  a winner and paying out — inside the same transaction if desired.
- **A correction to my own earlier framing:** I had assumed a 100M-instruction tx limit.
  Mainnet is **400M**, so the headroom is 4× what I would have reported. Reading the
  live config rather than trusting recollection changed the conclusion's comfort
  margin materially. Worth doing for any other budget question in this project.
- **Cost is identical for a passing and a failing verification** (27,296,351 both
  ways). No cost-based side channel, and no way for a submitter to learn the outcome
  more cheaply than by paying for it.
- **Subgroup checks are cheap (0.45%) and must not be skipped.** Soroban has no point
  decompression host function, so the relayer submits *uncompressed* points — 96 bytes
  G1 for the signature, 192 bytes G2 for the public key. Uncompressed input means the
  contract cannot assume well-formedness; validate subgroup membership on anything a
  submitter provides. At 0.45% there is no excuse not to.
- **Implementation note for whoever builds it:** `pairing_check(vp1, vp2)` tests
  `∏ e(vp1[i], vp2[i]) == 1`, so the negation has to be folded in somewhere. The clean
  way is to hardcode the *negated* G2 generator as a contract constant and check
  `pairing_check([H(m), sig], [pk, −g2])`. Do not negate at runtime.

### Caveat

Measured in the native test harness. Host-function costs — which are ~99% of this
total, since `pairing_check` and `hash_to_g1` are host functions — are metered with the
real cost model and are accurate. The thin contract wrapper's own WASM execution adds a
small amount not fully captured here. That does not threaten a 7% figure; it would
matter if the number were near the limit.

### Still open from §4.1

Whether **VRF-Soroban** (SCF #44) or **NebulaVRF** (SCF #34) is deployed and audited on
mainnet. Now a lower-stakes question: with the drand path measured and affordable,
an existing VRF would be a convenience, not a rescue.

---

## 10. Two updates that change the earlier reasoning

Added 2026-08-21.

### 10.1 The ticket model changed — commit `b03bbe4`

Tickets are now **minted at deposit** at that instant's USD value ($1 = 10 tickets) and
do **not** grow with time; withdrawal removes them proportionally at the rate they were
minted. Duration was not discarded — it is now a **separate stored quantity**
(held-seconds: USD-at-deposit × seconds held, settled at every balance change). Two
independent on-chain facts, tickets and duration, with the combining rule still
undecided. This was chosen over a second explicit warning about the flash-deposit
attack; recording that here because §5 and §8 were written against the time-weighted
model and a later reader needs to know the order of events.

**Effect on §8: the requirement is reframed, not removed.** There is no longer any
round-length average to compute, because nothing integrates over a cycle. But the price
read *at the instant of deposit* now permanently mints tickets with no later
correction — so the requirement becomes **a deposit-time price that the depositor
cannot game**, which is a genuinely different problem from a round-close average.

Consequently, of §8's three tiers:

- **v1 survives and is now the whole answer**: one `prices(asset, 20)` call giving a
  trailing 100-minute TWAP, used **at deposit** as a manipulation-resistant price rather
  than at round close as an average. One call, no fee, no keeper, and much harder to
  move than `lastprice` spot — which matters far more under the new model than the old
  one, because a manipulated spot price at deposit is now *permanent*, not something a
  later checkpoint dilutes.
- **v1.5 and v2 are moot.** v2's accumulator existed only to build a round-length
  average. There is no round-length average. **Do not build the shadow accumulator.**

The measurement work behind §8 was not wasted: it is what established that `prices()`
caps at 20 records and that ~21h of history exists, which is what makes v1 the right
shape and bounds what the deposit-time price can be averaged over.

Everything here remains off the critical path: launch is USDC-only, so `to_usd` is
exact at face value and XLM is gated off.

### 10.2 ample.money, seen first-hand

A user-supplied screenshot gave the first real look past the Cloudflare wall. Recorded
in §1; the substance is that ample is **not** a USD-savings-only product. Vaults span
**WETH, Gold and HYPE** with All / Crypto / Stocks / Commodities filters; the table
carries Price, Change 24H, Change 7D and Unrealized Return per asset; the nav is Home /
Payouts / Rewards / **Team** / Amplify (confirming the referral mechanic); payout
history shows six bars around **$3,300–$3,750 per cycle** with a countdown to the next.
It is a price-aware portfolio UI, not a savings-balance screen.

**Why this matters beyond the comparison — it sharpens the yield-asymmetry problem
rather than softening it.** §8's correction already noted that Blend's USDC reserve
yields ~6.4% against XLM's ~0.0015%, which is what drove the USDC-only launch in
`458ee79`. ample's asset mix is the same trap one step further out: a Gold vault and a
WETH vault generate wildly different yield per dollar, so any ticket model that treats
a dollar of Gold and a dollar of USDC as equal odds hands the pot to whichever asset
funds the prize least. Under the **new** mint-at-deposit model this is worse, not
better, because odds are fixed permanently at deposit and cannot be re-weighted later
as an asset's contribution to the prize changes.

So if STOX follows ample toward a broad multi-asset vault list, **the combining rule
left undecided in `b03bbe4` has to price yield contribution, not just dollars held.**
Recommendation: weight tickets by each asset's realised contribution to the prize pool,
not by face USD value. That is the single most consequential open decision in the
product right now, and it is a *product* decision, not an implementation detail.

---

## 11. RESOLVED — neither VRF-Soroban nor NebulaVRF is deployed or audited on mainnet

Added 2026-08-21, via `stellar-raven` (Scout directory + SCF submission corpus, live).
This was the one item §9 left open. It is closed now, and it closes in favour of the
drand+BLS design already recommended in §4.1/§9 — there is no existing VRF to adopt
instead.

**NebulaVRF (SCF #34, $34K, Build award).** Read its own SCF application text
first-hand (`lumenloop.get_scf_submissions`, slug `recIVYl2W3XMucMsJ`):

- Its own "Traction Evidence" section states: *"NebulaVRF is in the idea and technical
  design phase... While not yet launched."*
- Its own roadmap put testnet deployment at Month 3 and **mainnet deployment at
  Month 5-6** of the grant — i.e. mainnet was never claimed as done, only planned.
- Team is two university sophomores; one "relatively new to web3."
- `scout.listContracts` (the evidence-gated registry of *verified* mainnet Soroban
  contracts) returns **zero** rows for `vrf` or `nebula`. Absence there isn't proof of
  nonexistence in general, but combined with the rest it is corroborating, not neutral.
- `scout.listAudits` returns **zero** rows for `vrf` or `nebula` — no audit on record.
- Its three GitHub repos (`vrf-contract`, `vrf-core`, `landing`) last committed
  **2026-02-05 / 2026-02-14** — over six months stale as of today (2026-08-21), past
  its own Month 5-6 mainnet target with no visible follow-through.

**VRF-Soroban (SCF #44, $50K, Build award).** Has **no linked directory project at
all** (`linked_project_slug: null`, `linked_project_slugs: []`), and querying its exact
SCF slug directly returns zero submissions — it isn't resolvable as a tracked, live
project by anything in the corpus beyond the original proposal.

**What this settles:** the drand + BLS12-381 path (§4.1, measured affordable at ~7.3%
of tx budget in §9) is not a second-best fallback while the ecosystem catches up — it
is the *only* viable randomness design available. Do not spend further time evaluating
VRF-Soroban or NebulaVRF as an integration shortcut; there is nothing shipped to
integrate.
