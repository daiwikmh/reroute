# Yield sources on Stellar

Where STOX deposits can be put to work to generate the prize pot. Companion to
`BLEND_INTEGRATION_RESEARCH.md`, which covers the Blend integration mechanics in depth; this
document is the venue landscape and the routing question.

All chain reads were taken **2026-08-21, 04:44–04:47 UTC**, against Stellar mainnet via
`stellar` CLI 27.0.0, unless marked otherwise. Anything not verified first-hand is marked
**unverified** rather than smoothed over.

---

## 0. The recommendation, up front

**Ship Blend FixedV2, USDC reserve, alone. Do not diversify for launch.**

Not because the landscape is empty — there is more on Stellar than expected, including a
$534M tokenized-Treasury pool — but because exactly one venue clears the bar of *"a Soroban
contract can hold this position on behalf of users, using a maintained Rust SDK that pins
soroban-sdk 25, with testutils, and a production reference implementation to copy."*

That is Blend, and nothing else is close. The gap is not APY, it is integration surface.

The second-best candidate on yield (Gami earnUSDC, 10.00%, $23.5M TVL) routes to **EVM**
strategies, which reintroduces the bridge risk that `MULTICHAIN_ARCHITECTURE.md` was superseded
to avoid. The largest pool on the chain (Ondo USDY, $534.6M, 3.55%) is **allowlist-gated**, so a
contract cannot hold it without being explicitly permissioned — and it pays less than Blend USDC
anyway.

**Diversification is a v2 concern, and §5 explains why adding a second venue is not merely
"more work" — it re-creates the cross-subsidy trap from `BLEND_INTEGRATION_RESEARCH.md` §F one
layer up.**

---

## 1. The SDK bar — the finding that decides this

The brief asked to check each venue for the trap that `blend-contracts-v2` fell into (pins
soroban-sdk 22, unusable) versus `blend-contract-sdk` (pins 25.0.1, works). **The trap is real
and it catches almost everything.**

| Venue | Rust crate | soroban-sdk pin | Verdict |
|---|---|---|---|
| **Blend** | `blend-contract-sdk` **2.25.0** | **^25.0.1** | ✅ Compatible. Ships `testutils` (`BlendFixture::deploy`) for unit tests without testnet. |
| Soroswap | `soroswap-library` 2.0.0 | **^22.0.0-rc.2.1** | ❌ Incompatible with our 25 — **and it is a math library, not a client.** There is no Soroswap client crate. |
| Aquarius | *none published* | n/a | ❌ No crate. Integration means `contractimport!` on a WASM we fetch ourselves. |
| Phoenix | *none published* | n/a | ❌ No crate on crates.io (`phoenix*` hits are unrelated projects — Phoenix channels, a Solana DEX CLI). |
| Comet | *none published* | n/a | ❌ No crate. |

Verified by querying the crates.io API directly for each crate's dependency list on
2026-08-21T04:46Z.

The brief's own tie-breaker — *"the one with a maintained Rust SDK pinning soroban-sdk 25 and
shipping testutils wins"* — is not a tie-breaker here. It is the whole decision. Only one venue
qualifies.

**Why `contractimport!` on a self-fetched WASM is not an equivalent fallback.**
`BLEND_INTEGRATION_RESEARCH.md` §A1 established the discipline: the reason `blend-contract-sdk`
is trustworthy is that its bundled `pool.wasm` hashes to `a41fc53d…1350e`, which was verified
equal to the deployed mainnet executable. Fetching a WASM ourselves and importing it means
*we* own that verification forever, re-checking on every upgrade. That is a standing maintenance
obligation per venue, not a one-off.

---

## 2. Lending markets

### 2.1 Blend FixedV2 — recommended

Pool `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`.
Config read live: `bstop_rate = 2000000` (20% to backstop), `max_positions = 6`,
`min_collateral = 50000000`, `oracle = CCVTVW2CVA7JLH4ROQGP3CU4T3EXVCK66AZGSM4MUQPXAI4QHCZPOATS`.

**USDC reserve**, read 2026-08-21T04:44:23Z:
```
b_rate  = 1140147343951  (1.140147343951)   b_supply = 560624147267992
d_rate  = 1223039483781  (1.223039483781)   d_supply = 402267845028055
ir_mod  = 15111165 (1.5111165)   util target = 80%   max_util = 90%
r_base = 300000 (3%)  r_one = 400000 (4%)  r_two = 1200000  r_three = 50000000
```
Derived: supplied ≈ **63.91M USDC**, borrowed ≈ **49.20M USDC**, **available ≈ 14.71M USDC**,
utilization **77.0%**.

Borrow APR = `(0.03 + (0.7699/0.80) × 0.04) × 1.5111165` = **10.35%**
Supply APY ≈ `10.35% × 0.7699 × (1 − 0.20)` = **6.38%**

That figure independently reconciles with DefiLlama's **6.37%** for the same pool (§4) — two
different derivations landing on the same number, which is the strongest confirmation available
here.

**XLM reserve**, same read:
```
b_rate = 1000022247396  (1.000022247396)   b_supply = 7685390070455680
d_rate = 1001528174750                      d_supply = 13539405052716
ir_mod = 1000000 (1.0)   util target = 40%   max_util = 70%
```
Derived: supplied ≈ **768.56M XLM**, borrowed ≈ **1.356M XLM**, utilization **0.176%**.
Borrow APR ≈ **1.01%**, **supply APY ≈ 0.0014%**.

The `b_rate` of 1.000022 is the empirical proof: XLM suppliers in this pool have earned
**0.0022% in total, ever**. This is the number behind the cross-subsidy finding in
`BLEND_INTEGRATION_RESEARCH.md` §F and behind the USDC-only launch decision.

- **Contract-callable:** yes, non-custodial, no KYC, no whitelist. Reference implementation
  [`script3/fee-vault-v2`](https://github.com/script3/fee-vault-v2) holds Blend positions on
  behalf of users.
- **Withdrawal constraints:** reverts entirely at 100% utilization, atomically, no partial fill.
  At 77% util, ~23% of supply is withdrawable at any instant. See §6.
- **Loss modes:** yes, and realized — see §2.2.
- **Audits:** Blend has been audited; specific firms/reports **unverified** (not chased, since
  §2.2's live loss data is more informative than an audit list).
- **⚠️ Flag:** `get_config` returns `status: 1`, not `0`. In Blend, pool status gates which
  operations are permitted (Active / On Ice / Frozen). **What status 1 permits is unverified** —
  confirm before assuming supply is open on this pool. Testnet's pool returns `status: 0`, so
  this differs between the environment we tested against and the one we would ship to. Worth
  settling before any mainnet work.

### 2.2 Blend YieldBlox V2 — do not use

Pool `CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS`, read 2026-08-21T04:45:37Z.

```
USDC: b_rate = 969135473322  -> 0.969135  ->  3.09% realized supplier principal loss
XLM:  b_rate = 475606683009  -> 0.475607  -> 52.44% realized supplier principal loss
```

`b_rate` initializes at 1.0 and otherwise only rises, so any value below 1.0 is realized,
socialized supplier loss written in by `default_liabilities`
(`BLEND_INTEGRATION_RESEARCH.md` §A7). These are not projections — that is over half of XLM
supplier principal, gone, still visible on chain today.

Cause: the February 2026 oracle-manipulation exploit (~$10M bad debt). Depositors were made
whole **by Script3 out of band**, not by the protocol. YieldBlox V2 still lists the thin assets
that enabled it (USTRY, CETES).

USDC there: supplied ≈ 841,940, borrowed ≈ 692,030, **available ≈ 149,910**, util 82.2% — and
DefiLlama independently reports $149,867 TVL for it, matching the derived available liquidity.
Even setting the exploit aside, that pool is far too thin to absorb meaningful deposits.

**Already locked as excluded** by the user's "Fixed V2 only, never YieldBlox" decision. This is
the live evidence for that call.

### 2.3 Slender

First non-custodial lending protocol on Stellar Soroban
([eq-lab/slender-ui](https://github.com/eq-lab/slender-ui)). **Not present in DefiLlama's
Stellar yield data** (§4), and no mainnet contract address or live APY could be verified.
Status, TVL and whether it is still operating are **unverified**. Given it does not appear in
aggregated yield data at all, it is either negligible in size or inactive. Not a candidate
without evidence it is live and deep.

---

## 3. AMM / DEX liquidity

**The category-level objection comes first, because no amount of SDK quality fixes it.**

An LP position can return fewer dollars than went in, even with zero protocol failure, purely
from price divergence between the paired assets. For a product whose entire proposition is
*"you keep your deposit, you only risk the yield"*, that is a **different category of
instrument** from a lending deposit. A lending deposit loses principal only if the protocol
fails; an LP position loses principal as a matter of normal operation.

A USDC/XLM LP position funding a no-loss prize means a depositor can withdraw less USDC than
they put in during an ordinary week where XLM simply moved. That contradicts the product's
core claim more directly than anything in §2.

The one exception worth noting: a **stable-stable** pool (USDC/EURC, USDC/USDT) has bounded IL
because the assets track each other. That is the only LP shape worth revisiting later, and only
with the divergence risk stated explicitly.

Every APY below should be read as *pre-IL*, and is therefore **not comparable** to the lending
APYs in §2.

### 3.1 Aquarius — the only AMM that is genuinely reachable

Router `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK`.

Interface verified live against the deployed mainnet contract with
`stellar contract info interface` on 2026-08-21T04:47Z. Relevant functions:

```
deposit           withdraw          claim              get_user_reward
get_total_shares  share_id          get_reserves       get_liquidity
estimate_swap     swap              swap_chained       get_rewards_info
get_total_accumulated_reward  get_total_claimed_reward  pool_type
init_standard_pool  init_stableswap_pool  init_concentrated_pool
```

- **Contract-to-contract: yes**, in principle. `deposit` / `withdraw` / `claim` are all on the
  router, so a Soroban contract can hold the position. But there is **no published Rust crate**
  (§1), so integration means `contractimport!` on a self-fetched WASM plus permanent hash
  verification.
- **Position value read-back:** via `share_id` (LP share token) and `get_total_shares` /
  `get_reserves`. Value in USD requires pricing both reserve assets — which **pulls Reflector
  back into the value path**, where the Blend design deliberately kept it out
  (`BLEND_INTEGRATION_RESEARCH.md` §A2). That is a real architectural regression: a Blend
  position's value is oracle-free; an LP position's value is not.
- **Rewards require active harvesting.** `claim` and `get_user_reward` exist as separate calls,
  so AQUA rewards do **not** accrue into the position value — a keeper must call `claim`. That
  is a different realization model from Blend's passive `b_rate` growth (§7).
- **Reward eligibility is political, not mechanical.** AQUA rewards flow only to pools in the
  "reward zone", determined by on-chain AQUA/ICE voting. A pool can lose reward eligibility by
  vote, which would silently collapse the yield with no code change on our side. For a prize
  pot that is a governance dependency, not just a market one.
- **Concentrated liquidity pools are under audit** (Halborn, ongoing since June 2026) — not
  something to build against now.
- **Not present in DefiLlama's Stellar yield data**, so no independent APY/TVL cross-check was
  available. Live pool APYs **unverified**.
- **Testutils/mocks:** none, absent a crate.

### 3.2 Soroswap

Routers: mainnet `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH`, testnet
`CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`.

- **`soroswap-library` 2.0.0 pins `soroban-sdk ^22.0.0-rc.2.1`** — verified via crates.io. This
  is precisely the `blend-contracts-v2` trap, and it would not compile against our workspace.
  It is also only a **math library** (pair math, quoting), not a pool client, so even a
  version-compatible release would not give us deposit/withdraw.
- Integration would be `contractimport!` plus self-verified WASM, same standing obligation as
  Aquarius, with less to show for it.
- Not in DefiLlama's Stellar yield data. APY/TVL **unverified**.
- Same IL objection, same oracle-in-the-value-path objection as §3.1.

### 3.3 Phoenix

No published Rust crate. Not in DefiLlama's Stellar yield data. Mainnet addresses, live APY and
TVL all **unverified** — nothing found to substantiate it as a live, deep venue. Not a candidate.

### 3.4 Stellar native protocol-level liquidity pools

Classic (pre-Soroban) AMM built into the Stellar protocol itself, operated via
`LiquidityPoolDeposit` / `LiquidityPoolWithdraw` **classic operations**.

**Structurally unreachable from a Soroban contract.** Classic operations are not host functions;
a contract cannot submit them. Using these would require an off-chain keyed service submitting
classic transactions — a fundamentally different and more custodial architecture than anything
else here. Combined with the IL objection, this is out.

### 3.5 SDEX market making

Would require an off-chain strategy service placing and managing orders, holding keys, and
bearing inventory risk. Not a yield venue in the sense the brief means — it is a trading
business. Out.

---

## 4. Independent cross-check: every yielding pool on Stellar

DefiLlama yields API, read **2026-08-21T04:45:47Z**. It lists **8 Stellar pools in total**:

| Project | Symbol | TVL | APY | Base | Reward | IL risk |
|---|---|---|---|---|---|---|
| ondo-yield-assets | USDY | **$534,608,162** | 3.55% | 3.55 | – | no |
| blend-pools-v2 | XLM | $142,117,673 | 0.05% | 0.00 | 0.05 | no |
| gami-labs | EARNUSDC | $23,506,584 | **10.00%** | 10.00 | – | no |
| **blend-pools-v2** | **USDC** | **$14,716,601** | **6.37%** | 6.37 | – | no |
| gami-labs | EARNXLM | $3,678,952 | 5.00% | 5.00 | – | no |
| blend-pools-v2 | EURC | $867,182 | 4.52% | 4.52 | – | no |
| blend-pools-v2 | XLM | $341,525 | 0.93% | 0.06 | 0.86 | no |
| blend-pools-v2 | USDC | $149,867 | 5.53% | 4.35 | 1.18 | no |

Two observations that matter more than the table:

1. **Aquarius, Soroswap, Phoenix and Slender appear nowhere.** Either they are not tracked, or
   their yield-bearing TVL is negligible. Combined with §1 and §3, the case for any of them as a
   launch venue is weak on independent evidence, not only on integration cost.
2. **The Blend USDC row (6.37%, $14.7M) matches both derivations in §2.1** — my APY computed
   from the raw interest-rate model, and my available-liquidity figure. Three independent
   numbers agreeing is the strongest validation in this document.

### 4.1 Ondo USDY — biggest pool on the chain, and not usable

$534.6M TVL at 3.55% — a tokenized US Treasury product, and the closest thing on Stellar to the
"short-duration USD assets" layer ample describes.

- Stellar asset `USDY-GAJMPX5NBOG6TQFPQGRABJEEB2YE7RFRLUKJDZAZGAD5GFX4J7TADAZ6`, with a Soroban
  contract (`CB3Y…GAGP`, full address **unverified**).
- **Minting requires KYC** — eligible holders wire USD to Ondo's bank and Ondo mints at the
  current token price.
- **Transfers are gated by an allowlist/blocklist.** This is the disqualifier: our pool contract
  would have to be explicitly allowlisted by Ondo to hold USDY at all, and could be removed.
  That is a permissioned dependency at the center of a product that promises withdrawal on
  demand.
- Yield accrues via token price appreciation rather than rebasing, so it *would* read back
  cleanly. But it pays **3.55% versus Blend USDC's 6.37%** — roughly half, for a permissioned
  counterparty. There is no version of this trade that makes sense for launch.
- Whether secondary-market acquisition (SDEX/AMM) avoids the allowlist is **unverified**; even
  if it did, we would be holding a restricted-transfer asset we might not be able to exit.

### 4.2 Gami Labs earnUSDC — highest APY, wrong risk shape

$23.5M TVL at 10.00%, the best headline rate on Stellar.

Gami runs institutional vaults routing to **Aave, Morpho, Silo, Curve, Pendle and Spectra** —
all **EVM** protocols. So the yield does not originate on Stellar; capital is deployed
cross-chain.

That is the same architecture `MULTICHAIN_ARCHITECTURE.md` proposed and that was superseded when
Blend was chosen, and it carries the same objections recorded there: bridge exposure, an
attested rather than proven settlement boundary, and a much larger trusted surface. Taking
10% via Gami is not "Blend plus 3.6%" — it is a different and considerably larger risk budget,
much of it off this chain and outside our observation.

Whether `earnUSDC` is Soroban-contract-callable, its withdrawal terms, and its loss history are
all **unverified**. Worth a proper look for v2 if diversification is ever prioritized; not a
launch candidate.

### 4.3 Others named in the brief

- **Etherfuse USTRY / CETES** — these are listed as *reserves on YieldBlox V2*, i.e. they are the
  thin assets implicated in the exploit that produced the 52.4% XLM supplier loss (§2.2).
  Supplying them is out of the question, and their presence is a reason to avoid that pool.
- **USDGLO** — listed on YieldBlox V2. Same objection.
- **Franklin Templeton BENJI** — no Stellar-native, Soroban-callable yield path found.
  **Unverified**; Stellar presence not substantiated in this pass.
- **Circle / anchor yield on held balances** — nothing found paying yield on a *contract-held*
  USDC balance. Anchor/issuer programs are account-level and typically KYC'd, which is the same
  disqualifier as §4.1. **Unverified.**

---

## 5. The routing question

This section answers the part the user actually asked — but note the recommendation is
**single-venue for launch**, so most of this is design-ahead rather than build-now.

### 5.1 The cross-subsidy trap reappears one layer up

`BLEND_INTEGRATION_RESEARCH.md` §F showed that pooling yield across assets with a 4,000×
APY difference (USDC 6.38% vs XLM 0.0014%) lets low-yield depositors free-ride on high-yield
ones, collapsing the pot. Multi-venue recreates that shape exactly:

- If **depositors choose the venue**, everyone rationally picks the highest-APY one, and the
  others sit empty — or worse, whoever is stuck in the low-yield venue subsidizes the rest while
  earning identical tickets.
- If **we allocate across venues**, we are choosing on depositors' behalf who subsidizes whom,
  which is the same unfairness with our fingerprints on it.

**The only formulations that avoid it** are the same three as before: weight tickets by realized
yield contribution (contradicts "tickets depend only on deposit"), restrict to venues with
comparable yield, or run per-venue prize pots (abandons the single deep pot). This is worth
deciding *before* a second venue is added, not after.

### 5.2 Attribution: per asset, per venue, per round

Keep the accounting keyed on `(asset, venue)`, never aggregated:

```
Principal(asset, venue)   -> underlying deposited from our pool into that venue
Position(asset, venue)    -> venue-native position handle (bTokens, LP shares, ...)
Realized(round, asset)    -> yield credited to this round's pot for that asset
```

Yield for a venue leg is `value(asset, venue) − Principal(asset, venue)`, clamped at zero
(`BLEND_INTEGRATION_RESEARCH.md` §A4 — with `overflow-checks = true`, an unclamped negative is a
panic that would brick withdrawals). A USDC depositor's yield never mixes with an XLM
depositor's because the asset dimension is never summed away until the pot is *displayed*.

### 5.3 One contract, or adapters plus a router?

**Recommend: a single contract for launch; adapter contracts only when a second venue is
actually added.**

The reason is not simplicity for its own sake — it is that the adapter pattern's benefit is
swapping venues without touching core accounting, and that benefit is worth nothing until there
are two venues. Against it: every adapter is a separate contract to deploy, audit, upgrade and
key-manage, and cross-contract calls cost instruction budget.

When a second venue does arrive, the right shape is a uniform adapter interface —

```
deploy(asset, amount) -> position_id
harvest(asset) -> yield_amount        // in that venue's asset
withdraw(asset, amount, to)
value(asset) -> i128                  // current underlying value
max_withdrawable(asset) -> i128       // see §6
```

— with the router holding user-level accounting and the adapters holding only venue mechanics.
Note this is the same shape sketched in `MULTICHAIN_ARCHITECTURE.md` §2.4; the difference is
that these adapters are all **on Stellar**, so no bridging or attestation boundary is involved.

### 5.4 Realization: passive vs harvested

This differs by venue and it changes whether a keeper is required at all:

- **Blend: passive.** `b_rate` grows; position value rises without any transaction from us. The
  pot can be *read* at any time as `b_tokens × b_rate / 1e12 − principal`. A keeper is needed
  only to mark the round boundary, not to collect.
- **Aquarius: active.** AQUA rewards sit in a separate `claim` call and do not accrue into
  position value. **A keeper must call `claim` or the yield is simply not collected.** That is a
  liveness requirement with real money attached, and a missed harvest is lost prize.

This is a genuine architectural difference and an under-appreciated argument for Blend: the
recommended venue needs no harvesting keeper, so there is no keeper to fail.

### 5.5 What breaks if a venue is paused, drained, or exited mid-round

- **Paused / status-changed.** Deposits into that venue must stop while withdrawals continue —
  the same asymmetry as the deposit gate already shipped in `savings_pool` (`set_deposits_enabled`,
  with `withdraw` deliberately ungated). That precedent should extend to venues. Note §2.1's
  `status: 1` flag makes this concrete rather than hypothetical.
- **Drained / bad debt.** Position value falls below principal. The pot is zero (clamped) and
  **principal is impaired**. With one venue that is a pool-wide pro-rata loss; with several, it
  is a loss localized to one `(asset, venue)` leg — which raises a question the current design
  does not answer: does that leg's loss fall on the depositors routed there, or on everyone?
  That is a product decision and it should be made before multi-venue, not during an incident.
- **Exit mid-round.** Realized yield to the exit point must be credited to the current round, and
  the accrual basis reset, or the yield is silently lost. This is the same "settle before you
  move" discipline as `savings_pool`'s held-seconds settling at every balance change.
- **Liquidity crunch.** Covered in §6.

---

## 6. Withdrawal liquidity — the open contradiction

Unchanged from `BLEND_INTEGRATION_RESEARCH.md` §A6 and still the sharpest unresolved gap.
Blend reverts the **entire** withdraw transaction at 100% utilization, atomically, with no
partial fill. At the current 77.0% USDC utilization, roughly 23% of supply is withdrawable at any
instant — comfortable now, and not guaranteed.

The product copy has been corrected to say withdrawal is subject to available liquidity, so the
page no longer asserts something false. But the **mechanism** still needs one of:

1. `max_withdrawable(user, asset)` exposed and clamped in the UI — cheapest, honest, and turns a
   failed transaction into a legible number. A design for this is drafted and parked.
2. An idle buffer (route e.g. 90% to Blend, hold 10%) — costs 10% of the pot, makes small
   withdrawals always succeed.
3. Withdraw-available-plus-claim for the remainder — most state, most UX complexity.

Multi-venue changes this materially: with several venues, a withdrawal can be **routed** to
whichever has liquidity, so the failure mode softens. That is the strongest genuine argument for
diversification, and it is worth weighing against §5.1 — but it does not outweigh it for launch.

---

## 7. Summary table

| Venue | USDC APY | TVL / available | Contract-callable | Rust SDK @ sdk-25 | IL | Realized losses | Verdict |
|---|---|---|---|---|---|---|---|
| **Blend FixedV2** | **6.38%** ✔ | $14.7M available | ✅ non-custodial | ✅ `blend-contract-sdk` 2.25.0 + testutils | no | none in this pool | **Ship this** |
| Blend YieldBlox V2 | 5.53% | $150k available | ✅ | ✅ same SDK | no | **52.4% XLM, 3.1% USDC** | Excluded |
| Ondo USDY | 3.55% | $534.6M | ❌ allowlist-gated | ❌ | no | none known | Out — permissioned |
| Gami earnUSDC | 10.00% | $23.5M | unverified | ❌ | no | unverified | v2 — EVM bridge risk |
| Aquarius | unverified | unverified | ✅ via contractimport | ❌ no crate | **yes** | unverified | Out for launch |
| Soroswap | unverified | unverified | ✅ via contractimport | ❌ pins sdk 22 | **yes** | unverified | Out |
| Phoenix | unverified | unverified | unverified | ❌ no crate | **yes** | unverified | Out |
| Stellar native LPs | n/a | n/a | ❌ classic ops only | n/a | **yes** | n/a | Structurally out |
| Slender | unverified | unverified | unverified | ❌ no crate | no | unverified | No evidence live |

APY figures are pre-IL where IL applies, and therefore not comparable across the IL boundary.

---

## 8. Conflicts with what is already locked

- **USDC-only at launch** — consistent. Blend FixedV2 USDC is the recommendation, and USDC is the
  only asset where Stellar yield is meaningful at all (6.38% vs XLM's 0.0014%).
- **No-lock-up withdrawal** — still contradicted by §6, mitigated in copy, unresolved in
  mechanism. This is the one open item that should not reach launch untouched.
- **Mint-at-deposit tickets** — unaffected by venue choice. Tickets are minted from USD value at
  deposit and never reference yield, so the venue can change without touching ticket accounting.
- **Prize funded purely from yield** — consistent, and the reason §5.4 matters: with Blend the
  yield accrues passively, so there is no harvest step that can silently fail and leave a round
  with no prize.
- **Fixed V2 only, never YieldBlox** — consistent, and §2.2 is the live evidence for it.

---

## 9. What I would ship

1. **Blend FixedV2, USDC reserve, single venue, no adapter layer.** It is the only venue that
   clears the integration bar, and it happens to also be the best real USDC yield on Stellar that
   is not permissioned or bridged.
2. **Resolve the `status: 1` flag on the mainnet Fixed pool (§2.1) before any mainnet work.**
   Testnet reads `status: 0`. Do not discover the difference during deployment.
3. **Ship `max_withdrawable` with it** (§6, design parked). Without it the product promises
   something the venue cannot always deliver, and the user meets that as a failed transaction.
4. **Do not build the adapter/router layer yet.** Its only benefit is venue-swapping, which is
   worth nothing at one venue, and building it now would invite adding a second venue before
   §5.1's fairness question has an answer.
5. **Revisit for v2, in this order:** Gami earnUSDC (best rate, but price the bridge risk
   honestly), then stable-stable Aquarius pools (bounded IL) if a Rust SDK appears. Ondo USDY
   only if Ondo will allowlist a pool contract *and* its rate becomes competitive — today it is
   neither.
