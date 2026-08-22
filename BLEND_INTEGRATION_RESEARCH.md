# Blend + Reflector integration research

Research for wiring `savings_pool` to a yield source (Blend Capital) and a price oracle
(Reflector) on Stellar/Soroban.

Everything here was verified against live chain state via `stellar` CLI 27.0.0, or against
protocol source on GitHub. Claims that could not be verified are marked **unverified**.
Where a doc and the deployed contract disagreed, the deployed contract won.

**Status note.** This document records research findings, not settled product decisions.
Several findings below drove decisions that have since changed the design — most
importantly, the ticket model moved from time-weighted accrual to mint-at-deposit after
this research was done. Section C is retained because its oracle, decimal and overflow
findings still apply, but its time-weighted accrual design is **superseded**. See
"What changed after this research" at the end.

---

## A. Blend Capital

### A1. Which client to use

```toml
blend-contract-sdk = "2.25.0"
```

- Pins `soroban-sdk = "25.0.1"`, matching this workspace's `soroban-sdk = "25"`.
  ([Cargo.toml](https://github.com/blend-capital/blend-contract-sdk/blob/main/Cargo.toml),
  [crates.io](https://crates.io/api/v1/crates/blend-contract-sdk))
- It is a `contractimport!` of shipped WASM blobs, not a hand-written trait
  ([src/lib.rs](https://github.com/blend-capital/blend-contract-sdk/blob/main/src/lib.rs)).

The bundled WASM was verified byte-identical to what is deployed. `wasm/pool.wasm` from the
SDK repo hashes to:

```
a41fc53d6753b6c04eb15b021c55052366a4c8e0e21bc72700f461264ec1350e
```

That equals `hashes.lendingPoolV2` in
[blend-utils/testnet.contracts.json](https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json),
and RPC confirms the **mainnet** FixedV2 pool instance executable is
`Wasm(Hash(a41fc53d…1350e))` — the same hash. One client covers testnet and mainnet.

Do **not** vendor `blend-contracts-v2` as a path/git dependency: its workspace pins
`soroban-sdk = "22.0.7"`
([Cargo.toml](https://github.com/blend-capital/blend-contracts-v2/blob/main/Cargo.toml)),
which conflicts with SDK 25.

### A2. Supply / withdraw interface

From [`pool/src/contract.rs:116-122`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/contract.rs):

```rust
fn submit(
    e: Env,
    from: Address,      // whose position is modified
    spender: Address,   // who sends tokens to the pool
    to: Address,        // who receives tokens from the pool
    requests: Vec<Request>,
) -> Positions;
```

`Request` — [`pool/src/pool/actions.rs:13-19`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/pool/actions.rs).
**Field order is not what you would guess:**

```rust
#[contracttype]
pub struct Request {
    pub request_type: u32,
    pub address: Address,   // asset address, or liquidatee
    pub amount: i128,
}
```

`RequestType` values (same file, lines 23-33):

| Value | Variant | | Value | Variant |
|---|---|---|---|---|
| 0 | `Supply` | | 5 | `Repay` |
| 1 | `Withdraw` | | 6 | `FillUserLiquidationAuction` |
| 2 | `SupplyCollateral` | | 7 | `FillBadDebtAuction` |
| 3 | `WithdrawCollateral` | | 8 | `FillInterestAuction` |
| 4 | `Borrow` | | 9 | `DeleteLiquidationAuction` |

**Use 0/1, not 2/3.** Blend's docs recommend `SupplyCollateral` for end users; that advice
is wrong for this use case, for two reasons.

1. `Positions::effective_count()` is `liabilities.len() + collateral.len()`
   ([`pool/src/pool/user.rs:30-32`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/pool/user.rs)) —
   non-collateral supply positions are **excluded from the max-positions cap**. Mainnet pools
   cap at 6 positions, testnet at 8, so `Supply` means we are never position-limited.
2. `do_check_health()` is only set for `WithdrawCollateral`, `Borrow` and auction fills
   (`actions.rs:328,379,402-403`), and `validate_submit` only runs the health check
   `if check_health && from_state.has_liabilities()`. Since we never borrow, **our
   supply/withdraw path never invokes Blend's oracle at all.** If Blend's oracle breaks or
   goes stale, our deposits and withdrawals still work. That is worth designing to preserve.

Withdraw amounts are in **underlying** tokens and are silently capped at the bToken balance
(`apply_withdraw`), so passing `i128::MAX` withdraws the entire position:

```rust
let mut to_burn = reserve.to_b_token_up(e, request.amount);
let mut tokens_out = request.amount;
if to_burn > cur_b_tokens {
    to_burn = cur_b_tokens;
    tokens_out = reserve.to_asset_from_b_token(e, cur_b_tokens);
}
```

### A3. Contract-as-supplier auth

`submit` does ([`contract.rs:452-466`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/contract.rs)):

```rust
spender.require_auth();
if from != spender { from.require_auth(); }
```

The canonical pattern is
[`script3/fee-vault-v2/src/pool.rs`](https://github.com/script3/fee-vault-v2/blob/main/src/pool.rs) —
a production contract holding Blend positions on behalf of users, written by the Blend team.
Worth copying near-verbatim:

```rust
// deposit: user's tokens go straight into Blend; we take the position
PoolClient::new(&e, &pool).submit(
    &e.current_contract_address(),   // from   = us
    &from,                           // spender= the user
    &from,                           // to     = the user
    &vec![&e, Request { address: reserve.clone(), amount, request_type: 0 }],
);

// withdraw: pool sends underlying directly to the user
PoolClient::new(&e, &pool).submit(
    &e.current_contract_address(),   // from   = us
    &e.current_contract_address(),   // spender= us
    &to,                             // to     = the user
    &vec![&e, Request { address: reserve.clone(), amount, request_type: 1 }],
);
```

> **⚠️ CORRECTED 2026-08-21.** An earlier version of this section claimed no
> `authorize_as_current_contract` was needed because the contract-invoker rule covered it.
> **That is wrong**, and it was proven wrong in implementation: every deposit failed with
> `Error(Auth, InvalidAction)`.
>
> The invoker rule authorizes calls our contract makes *directly*. On the deposit path Blend
> pulls the token itself — `token.transfer(self, pool, amount)` is invoked by **Blend**, one
> level deeper than our call to `submit`. The invoker rule does not reach that depth, so the
> transfer is unauthorized.
>
> **Deposit requires an explicit `authorize_as_current_contract` carrying a
> `SubContractInvocation` for `transfer(self, pool, amount)`.**
>
> **Withdraw needs nothing**, because Blend moves its own tokens out to `to` — no authorization
> from us is involved.
>
> The reason the deposit case differs from what the fee-vault pattern appears to show: when
> `spender` is the *user*, the user's signature in the transaction auth tree covers the deep
> transfer. When our contract supplies its own balance (as it does whenever the pool holds funds
> before routing them onward), there is no user signature to cover it and the contract must
> authorize the sub-invocation itself.

Guard to know about ([`submit.rs:33-39`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/pool/submit.rs)):
`execute_submit` panics with `BadRequest` if `from`, `spender` or `to` equals the **pool's**
own address.

### A4. Yield arithmetic

Positions are bTokens, not a rebasing balance
([`user.rs:8-15`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/pool/user.rs)):

```rust
#[contracttype]
pub struct Positions {
    pub liabilities: Map<u32, i128>,  // reserve index -> dTokens
    pub collateral:  Map<u32, i128>,  // reserve index -> bTokens (collateralized)
    pub supply:      Map<u32, i128>,  // reserve index -> bTokens (non-collateral)
}
```

bTokens are fixed-quantity; the exchange rate `b_rate` grows. **`b_rate` is 12 decimals**
(`SCALAR_12 = 1_000_000_000_000`) — this changed from Blend V1's 9 decimals, so do not carry a
9-decimal assumption over.

```rust
pub fn to_asset_from_b_token(&self, e: &Env, b_tokens: i128) -> i128 {
    b_tokens.fixed_mul_floor(e, &self.data.b_rate, &SCALAR_12)
}
```

The prize-pot harvest:

```rust
const SCALAR_12: i128 = 1_000_000_000_000;

fn harvest(e: &Env, pool: &Address, asset: &Address) -> i128 {
    let reserve  = PoolClient::new(e, pool).get_reserve(asset);
    let b_rate   = reserve.data.b_rate;                       // 12 dp
    let idx      = reserve.config.index;
    let b_tokens = PoolClient::new(e, pool)
        .get_positions(&e.current_contract_address())
        .supply.get(idx).unwrap_or(0);

    let value = b_tokens * b_rate / SCALAR_12;                // underlying now
    let principal: i128 = read(Principal(asset));
    (value - principal).max(0)      // CAN be negative — see A7. Clamp or it panics.
}
```

Two consequences worth internalizing:

1. **No share / ERC-4626 accounting is needed.** Because 100% of yield is skimmed to the pot,
   each user's underlying entitlement is constant between their own actions, so per-user state
   stays in plain underlying units.
2. **Do not cache bTokens.** Read `get_positions` each time — one extra ledger entry, and it is
   self-correcting. Caching creates a rounding-drift invariant to maintain.

Worked example, live mainnet FixedV2 USDC (`b_rate = 1_140_066_575_405`): holding
`10_000_000_0000000` bTokens gives `× 1.140066575405` ≈ 1,140,066.75 USDC. Against 1,000,000
principal, the pot is 140,066.75 USDC.

### A5. Deployed addresses and available assets

**Testnet (V2)**

| What | Address |
|---|---|
| Pool "TestnetV2" | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` |
| Pool factory V2 | `CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6` |
| Backstop V2 | `CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA` |
| XLM | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| USDC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

`get_reserve_list` → `[XLM, wETH, wBTC, USDC]`.
`get_config` → `{"bstop_rate":1000000,"max_positions":8,"min_collateral":"0","oracle":"CAZOKR2Y5E2OSWSIBRVZMJ47RUTQPIGVWSAQ2UISGAVC46XKPGDG5PKI","status":0}`.

**Mainnet (V2)**

| What | Address |
|---|---|
| Fixed V2 pool | `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD` |
| YieldBlox V2 pool | `CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS` |
| Pool factory V2 | `CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU` |
| Backstop V2 | `CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7` |
| XLM (SAC) | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| USDC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

Fixed V2 reserves: XLM, USDC, EURC.
YieldBlox V2 reserves: XLM, USDC, EURC, AQUA, USDGLO, USTRY, CETES, PYUSD.

> **There is no USDT reserve on Blend, on either network.** This drove the decision to drop
> USDT from the product. Reflector *does* carry a USDT price feed, so only the yield leg was
> blocked, not the pricing leg.

### A6. Withdrawal liquidity risk

`apply_withdraw` and `apply_withdraw_collateral` both call
`reserve.require_utilization_below_100(e)` (`actions.rs:328,379`), which panics with
`InvalidUtilRate` at 100% utilization. `submit` is atomic, so **the entire user withdrawal
reverts** — no partial fill, no queue.

Live figures computed from `get_reserve`:

| Pool / reserve | Supplied | Borrowed | Available | Util | `max_util` |
|---|---|---|---|---|---|
| Mainnet FixedV2 XLM | 768,556,548 | 1,356,008 | 767,200,540 | 0.18% | 70% |
| Mainnet FixedV2 USDC | 63,868,913 | 49,193,287 | **14,675,626** | 77.0% | 90% |
| Mainnet YieldBloxV2 USDC | 841,893 | 691,976 | **149,917** | 82.2% | 95% |
| Testnet V2 XLM | 93,844,915 | 83,184,365 | **10,660,550** | 88.6% | 95% |
| Testnet V2 USDC | 141,751 | 61,287 | 80,464 | 43.2% | 95% |

**This contradicts product copy.** `fin/src/app/dashboard/page.tsx` advertises
"No lock-up on principal", and `fin/src/components/HowItWorksSection.tsx` promises withdrawal
whenever the user wants. A lending pool cannot always honour that. Mitigations, cheapest first:

1. **Expose `max_withdrawable(user, asset)`** returning `min(user_balance, reserve_available)`
   and clamp the UI to it. Do this regardless — it turns a failed transaction into a legible number.
2. **Idle buffer.** Route e.g. 90% into Blend, hold 10% in the contract. Costs 10% of the pot;
   makes small withdrawals always succeed.
3. **Withdraw-available + remainder claim.** More state and a second UX step; only if 1 and 2
   prove insufficient.

### A7. Bad debt — the finding that most threatens the product

**Blend pools socialize losses onto suppliers, by design, by reducing `b_rate`**
([`user.rs:106-116`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/pool/user.rs)):

```rust
pub fn default_liabilities(&mut self, e: &Env, reserve: &mut Reserve, amount: i128) {
    self.remove_liabilities(e, reserve, amount);
    let default_amount = reserve.to_asset_from_d_token(e, amount);
    let b_rate_loss = default_amount.fixed_div_ceil(&e, &reserve.data.b_supply, &SCALAR_12);
    reserve.data.b_rate -= b_rate_loss;          // <-- b_rate goes DOWN
    if reserve.data.b_rate < 0 { reserve.data.b_rate = 0; }
}
```

Escalation ([`bad_debt.rs`](https://github.com/blend-capital/blend-contracts-v2/blob/main/pool/src/pool/bad_debt.rs)):
underwater user with no collateral → debt transferred to backstop → bad-debt auction sells
backstop LP → if the backstop falls below ~5% of threshold, remaining debt is **defaulted** and
written into `b_rate` for every supplier pro-rata.

`b_rate` initializes at `SCALAR_12` (1.0) and otherwise only rises, so **`b_rate < 1.0` is direct
evidence of realized supplier losses**. Live mainnet:

```
YieldBloxV2 XLM   b_rate = 475_606_358_009  -> 0.475606  -> 52.4% supplier principal loss
YieldBloxV2 USDC  b_rate = 969_088_594_562  -> 0.969089  ->  3.1% supplier principal loss
```

That is the February 2026 YieldBlox exploit: the attacker inflated the thinly-traded USTRY/USDC
price ~100x inside the oracle's VWAP window, supplied USTRY, and borrowed USDC and XLM, leaving
>$10M of bad debt.
([Bankless](https://www.bankless.com/read/news/lending-market-blend-suffers-10m-exploit),
[QuillAudits](https://www.quillaudits.com/blog/hack-analysis/yeildblox-10m-hack-explained),
[protos](https://protos.com/yieldblox-lending-pool-hit-by-10m-hack-on-stellar/),
[remediation repo](https://github.com/script3/yieldblox-incident-remediation))
Depositors were made whole **by Script3 out of band**, not by the protocol. YieldBlox V2 still
lists USTRY and CETES today.

**Stated plainly: an unconditional "no-loss" claim is not true of Blend as a yield source.**
A pool-level exploit or disorderly liquidation cascade can permanently destroy principal.

Risk reduction actually available:

- **Fixed V2 only** (XLM/USDC/EURC — deep-liquidity assets where the YieldBlox attack has no
  analogue). Avoid YieldBlox V2 and any community pool listing thin assets.
- **Never `SupplyCollateral`, never borrow**, so we cannot be liquidated.
- Monitor `b_rate` per reserve; halt deposits if it ever decreases.
- Revise the product copy. This is a legal-exposure question, not only a marketing one.

---

## B. Reflector oracle

### B1. Interface, verified against the deployed contract

Reflector implements SEP-40. Rust client: `sep-40-oracle = "1.4.0"` (Script3), which
crates.io confirms depends on `soroban-sdk ^25.0.1` — compatible with our 25. Blend uses the
same crate.

```rust
#[contracttype] pub struct PriceData { pub price: i128, pub timestamp: u64 }
#[contracttype] pub enum Asset { Stellar(Address), Other(Symbol) }

fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
fn price(env: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
fn prices(env: Env, asset: Asset, records: u32) -> Option<Vec<PriceData>>;
fn decimals(env: Env) -> u32;
fn resolution(env: Env) -> u32;
```

| Feed | Mainnet | Testnet |
|---|---|---|
| External CEX & DEX | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63` |
| Stellar DEX | `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` | `CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP` |
| Fiat FX | `CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC` | `CCSSOHTBL3LEWUCBBEB5NJFC2OKFRC74OWEIJIZLRJBGAAU4VMU5NV4W` |

**Use the CEX & DEX feed.** Live values:

```
decimals()   -> 14           resolution() -> 300 (5-min rounds)
base()       -> Other("USD")
assets()     -> [BTC, ETH, USDT, XRP, SOL, USDC, ADA, AVAX, DOT, MATIC,
                 LINK, DAI, ATOM, XLM, UNI, EURC]
```

### B2. The asset argument — confirmed empirically

On this feed, assets are `Asset::Other(Symbol)`, **not** `Asset::Stellar(Address)`:

```
lastprice(Other("XLM"))    -> {"price":"18556423436384","timestamp":1787285400}
lastprice(Other("USDC"))   -> {"price":"100040016006402","timestamp":1787285400}
lastprice(Stellar(CDLZFC3S…))  -> null
```

Passing the SAC address returns `None` **silently** rather than erroring. A `None` that gets
`unwrap_or(0)`-ed becomes a zero price. Guard explicitly. The contract needs an
`asset_address -> Symbol` mapping, since the deposit path knows the address and the oracle only
answers to the symbol.

### B3. There is no TWAP function

Older Reflector versions exposed `twap` / `x_price` / `x_twap`, and docs and blog posts still
reference them. **They do not exist on the deployed contracts.** The full function list from the
on-chain spec:

```
base, admin, price, assets, config, prices, expires, version, decimals, lastprice,
set_price, add_assets, cache_size, fee_config, resolution, last_timestamp,
set_cache_size, set_fee_config, update_contract, extend_asset_ttl,
estimate_retention_cost, history_retention_period, set_history_retention_period
```

No `twap`, no `x_price`, no `x_twap`. Grepping the master branch source confirms zero hits.

A TWAP remains **constructible** — `prices(asset, n)` returns the last `n` 5-minute records to
average — it just cannot be called directly. That is a materially different amount of work from
calling a host function.

### B4. Staleness

`lastprice` returns `Option<PriceData>`; `None` means unknown asset or no round — **it does not
mean stale, and there is no staleness flag.** `PriceData` has exactly two fields. Compare
`timestamp` against `e.ledger().timestamp()` yourself.

Blend's in-pool rule is 24h (`pool/src/pool/pool.rs:119-131`), which is far too loose. Blend's
own mainnet oracle-aggregator uses `max_age() = 900` (3 rounds) — **use 900s**:

```rust
let pd = PriceFeedClient::new(&e, &oracle).lastprice(&Asset::Other(sym))
    .ok_or(Error::NoPrice)?;
if pd.price <= 0 || pd.timestamp + 900 < e.ledger().timestamp() {
    return Err(Error::StalePrice);
}
```

**Asymmetry that matters: reject on deposit, never on withdraw.** A stale feed must not be able
to block a user withdrawing their own funds. This mirrors the ungated-withdraw invariant already
in `savings_pool`.

Two operational risks found in the contract instance data:

- **Assets expire.** The instance carries an `expiration` map (`expires(asset)`), currently
  ≈2026-09-06 for all 16 testnet assets. `extend_asset_ttl` renews it against an XRF-denominated
  `fee_config`. An expired asset makes `lastprice` return `None`. Monitor `expires()` for our
  assets.
- **`history_retention_period` is 24h**, so `price(asset, t)` returns `None` for anything older
  than a day. Do not architect around historical price fetches.

### B5. Cost

Simulated `lastprice` against testnet, decoding the returned `SorobanTransactionData`:

```
instructions   1,610,703     diskReadBytes  0     writeBytes  0
resourceFee    14,069 stroops (~0.0014 XLM)
footprint      2 read-only entries (oracle instance + oracle WASM), 0 read-write
```

Against `tx_max_instructions = 400,000,000`, that is **0.4% of the CPU budget**. Reading N assets
does not cost N× — all 16 assets' recent prices live in the single `ScContractInstance` entry, so
after the first call the marginal cost is re-entry into an instantiated contract. Three assets in
one transaction is comfortably under 1% of budget.

### B6. Blend's aggregator — do not share it

Blend's mainnet V2 pools point at `CCVTVW2CVA7JLH4ROQGP3CU4T3EXVCK66AZGSM4MUQPXAI4QHCZPOATS`, an
instance of [oracle-aggregator](https://github.com/blend-capital/oracle-aggregator)
(`decimals = 7`, `max_age = 900`, assets XLM/USDC/EURC as `Asset::Stellar`). It is a Reflector
wrapper that adds backward round-walking and a per-asset `max_dev` circuit breaker — a direct
response to the YieldBlox attack.

Use Reflector directly anyway: (a) the aggregator carries no USDT; (b) **there is no aggregator on
testnet** — Blend's testnet pool uses `oraclemock`
(`CAZOKR2Y5E2OSWSIBRVZMJ47RUTQPIGVWSAQ2UISGAVC46XKPGDG5PKI`, 7 decimals, XLM hardcoded at
`4200000` = $0.42), so sharing it would mean two code paths; (c) consistency with Blend buys
nothing, since per §A2 our Blend path never reads Blend's oracle. Worth stealing the `max_dev`
idea later, via `prices(asset, 2)`.

### B7. The admin-set asset price — SUPERSEDED, retained as a record

> **⚠️ SUPERSEDED 2026-08-21 (commit b893f7a).** The contract no longer holds prices at all.
> `set_asset_price` / `get_asset_price` and error 12 `NoAssetPrice` were removed when pricing and
> ranking moved off chain — the contract now records only deposits and withdrawals, and the
> backend computes stakes from the event ledger.
>
> **Two problems dissolved rather than being solved**, which is worth stating because both were
> live concerns in this document:
> - The **admin trust surface** below is gone. There is no admin-settable rate on chain any more,
>   so no admin can move anyone's future ticket rate.
> - **No asset can be valued at face value by omission.** The earlier failure mode — a non-USD
>   asset silently priced at $1 because nothing said otherwise — is structurally impossible when
>   the contract holds no prices.
>
> Retained because the same question returns the moment the backend needs a price source: it will
> face the identical par-vs-quote decision, the identical staleness question (§B4), and the
> identical manipulation exposure — only with an off-chain trust model instead of an on-chain one.
> The reasoning below still applies; only its location changes.

**Status when written: what shipped at commit bd053c2, explicitly as a placeholder.**

Rather than reading Reflector at deposit time, the contract currently carries an explicit,
admin-set USD price per asset:

```
set_asset_price(asset, price)   // admin only, 7dp — 1_0000000 is one dollar
get_asset_price(asset) -> i128  // 0 means unset
Error 12 NoAssetPrice           // from set_deposits_enabled(true), and from deposit
```

`to_usd` multiplies by that price instead of assuming face value. Deposits cannot be enabled for
an asset that has no price, so the value is always stated rather than assumed. Tickets are minted
at the price current when the deposit lands and are **never re-priced** — a later
`set_asset_price` does not retroactively change already-minted tickets.

**Why it exists.** The earlier behaviour returned face value for every asset, which is exact for
USD stablecoins and simply wrong for anything else — on testnet, 500 XLM minted 5,000 tickets
instead of ~956. The alternative considered was making `to_usd` fail closed for non-USD assets.
That was rejected for a concrete reason: Blend's testnet USDC comes from an issuer we do not
control and there is no faucet (§A5), so **XLM is the only reserve we can actually fund and
deposit**. Failing closed would have made the entire Blend integration untestable end-to-end, to
close a hole the per-asset deposit gate already covers.

**What it costs us, stated plainly.** On mainnet this is an **admin trust surface**. The admin can
set any price for any asset, and that price determines the ticket rate for every future deposit of
that asset. An admin who sets a price 10x too high mints 10x the tickets to whoever deposits next,
diluting every existing holder's odds. Nothing on chain constrains the value against reality.

Three properties limit the blast radius, and they are worth knowing precisely:

- It is **forward-only**. Already-minted tickets are immutable, so a bad price cannot retroactively
  rewrite the existing distribution — only the next deposits.
- It **cannot touch principal**. `get_balance`, `withdraw` and `withdraw_capacity` are all in asset
  units and never consult the price. A wrong price cannot trap or reduce anyone's deposit.
- It **cannot silently apply to a new asset**, because `set_deposits_enabled(true)` fails with
  `NoAssetPrice` unless a price was set deliberately.

**Where it goes.** When the Reflector path lands (§B1–B4), `set_asset_price` either disappears or
becomes the fallback for assets the feed does not carry. Note the feed carries XLM, USDC and USDT
already, so for the current asset set it would disappear entirely. The staleness discipline in §B4
becomes load-bearing at that point: under mint-at-deposit, a mispriced deposit permanently mints
wrong tickets with no later correction, which is exactly the property that makes the admin price
tolerable as a placeholder and intolerable as a permanent design.

**Testnet values in use** (Reflector `lastprice`, read 2026-08-21T09:09:54Z):

```
XLM   14dp 19122439356274   -> 7dp 1912243   ($0.1912243)
USDC  14dp 100018305729928  -> 7dp 10001830  ($1.0001830)
```

USDC is nonetheless set to exactly `1_0000000`. The oracle's 0.018% deviation from par is real
market data, but for a USD-denominated ticket the stablecoin *is* the unit of account, and pricing
it at anything other than $1.00 would make ticket counts drift with quote noise rather than with
deposits.

---

## C. Ticket accrual — SUPERSEDED, retained for the oracle/decimal findings

> The time-weighted design in this section was built for a model that has since been replaced by
> mint-at-deposit. The **decimal normalization and overflow findings below still apply** to any
> price-times-balance arithmetic, including the current model. The accrual machinery does not.

### C1. Decimals and the ticket constant

```rust
const PRICE_DECIMALS: u32  = 14;               // verified live, both networks
const PRICE_DIV:      i128 = 10_000_000;       // 14dp -> 7dp
const MAX_PRICE_AGE:  u64  = 900;              // 3 Reflector rounds
```

**Normalize oracle prices from 14dp to 7dp before doing any arithmetic with them.** This is
load-bearing, not cosmetic.

Keeping raw 14dp prices: `price14` for XLM ≈ `1.8e13`; a position untouched for 10 years gives
`Δ = 1.8e13 × 3.156e8 = 5.7e21`; a $1B XLM position is `bal = 5.55e16`; the product is
**`3.2e38` — overflows i128** (`i128::MAX = 1.7014e38`). Even $100M over 10 years is `3.2e37`,
only 5× from the ceiling.

With `price7` ≈ `1.81e6`: the same 10-year figure is `5.7e14`, product `3.2e31` — **6.4 million×
headroom**.

This matters more than it looks because `contracts/Cargo.toml` sets `overflow-checks = true`:
an overflow is a **panic**, not a wrap. A panic on the withdraw path is a bricked withdrawal.

Precision cost of truncating 14dp→7dp: for XLM at $0.18, one unit of `price7` is `5.5e-7`
relative — 0.000055% error. Immaterial. It *would* matter for a sub-cent asset; such an asset
needs a different `PRICE_DIV` or should be rejected.

### C2. The superseded accrual design (summary only)

Accumulate a per-asset price-seconds index `idx_a(t) = ∫ price_a(s) ds`, updated on any
interaction with that asset plus a periodic keeper poke. Because a user's asset-unit balance
changes only on their own action, `∫ usd_value ds = bal × (idx(t2) − idx(t1))` exactly, with
O(1) per-user reads. Snapshot `idx` at each cycle boundary so a user idle for N cycles is still
credited correctly.

`TICKET_DIVISOR = 604_800_000_000` was derived for "$1 held a full week = 10 tickets" at 7dp
prices and 7dp tickets. Sanity check: 1000 XLM at $0.1810252 for one week →
`1e10 × (1_810_252 × 604_800) / 604_800_000_000` = 1810.25 tickets, matching
$181.0252 × 10 exactly.

Security note that survives the model change: any design that reads a **spot price at a single
decisive moment** is manipulable for the duration of one 5-minute Reflector round, and
Reflector-fed prices have already been manipulated on this network for $10M (§A7). Under
mint-at-deposit, tickets are minted from a single spot read, so this exposure is now structural
rather than diluted across a week. The staleness guard in §B4 is the minimum mitigation; a
`max_dev` deviation check is the natural next one.

---

## D. Multi-asset payout

### D1. What asset do winners receive?

| Option | Assessment |
|---|---|
| (a) Swap all yield to one payout asset | Soroswap is live (mainnet router `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH`, testnet `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`). But a contract-initiated swap needs a slippage bound, which needs a trusted price — reintroducing the oracle as a *value-bearing* dependency and creating an MEV target on a predictable weekly schedule. Aquarius addresses/interface **unverified**. The classic SDEX path is not callable from Soroban. |
| (b) Pro-rata basket of every asset | Zero new dependencies, zero slippage, zero MEV, zero new trust. A loop over per-asset prize balances calling Blend `Withdraw` with `to = winner`. |
| (c) Denominate in USD, pay one asset | Requires covering a USD obligation from one asset's balance, leaving the pool short or long. Reintroduces price risk onto the protocol's balance sheet. |

**Recommendation: (b) for v1.** The prize is displayed in USD regardless, so the UX cost is one
line — "you won $412.60, paid as XLM + USDC". Given §A7 already loads the product with
unavoidable protocol risk, adding avoidable DEX risk is a bad trade.

If a single prize token later becomes mandatory, copy PoolTogether's **Target Period Dutch
Auction** liquidation pair rather than calling a router: it converts yield via permissionless
arbitrage and requires **no price oracle** — the auction discovers the price.

### D2. Displaying the pot

```
pot_usd_7dp = Σ_assets ( prize_underlying_a × price7_a ) / 1e7
```
where `prize_underlying_a = b_tokens_prize_a × b_rate_a / 1e12`. Expose as a contract view
`get_prize_usd(cycle)` so the dashboard makes one call rather than reconstructing client-side and
drifting from the contract's own view.

---

## E. Precedent

### E1. PoolTogether V5

Architecture: many ERC-4626 prize vaults over different yield sources; each has a Liquidation
Pair auctioning its yield for a single prize token; the Prize Pool aggregates contributions and
runs tiered draws; a TwabController holds balances and computes time-weighted average balance.
([design](https://dev.pooltogether.com/protocol/design/),
[v5-prize-pool](https://github.com/pooltogether/v5-prize-pool),
[PrizeVault.sol](https://github.com/code-423n4/2024-03-pooltogether/blob/main/pt-v5-vault/src/PrizeVault.sol))

Four things worth taking:

1. **The independent per-user winner check.** A user wins if
   `hash(drawId, vault, user, tier, randomNumber)` falls in their `winningZone`. Each user checks
   only themselves; claims are permissionless and O(1); multiple winners per tier are expected.
   This is the enabling trick for on-chain draws without global enumeration:
   ```rust
   let r = u256_from(sha256(seed, cycle, user, prize_index)) % total_tickets;
   if r < user_tickets { /* pay */ }
   ```
   Win probability is exactly `user_tickets / total_tickets`.
2. **Oracle-free yield conversion** via TPDA auction (see §D1).
3. **Balances live in one place** — prize vaults store no balances. Our analogue: read bToken
   quantity from Blend, never mirror it.
4. **`vaultPortion`** — PT deliberately weights odds by how much yield each vault actually
   contributed. See §F.

### E2. On Stellar

No prize-linked savings or no-loss-lottery protocol exists on Stellar/Soroban. The 2023
Sorobanathon lottery contracts are pay-to-enter raffles, not prize savings, and the
`stellar/sorobanathon` random library was archived in March 2026.

Reference implementations worth reading, in priority order:

1. **[script3/fee-vault-v2](https://github.com/script3/fee-vault-v2)** — the single most useful
   codebase here. Production contract holding Blend positions for users, by the Blend team.
   `src/pool.rs` is the auth/submit pattern; `src/vault.rs` `update_rate()` is the b_rate yield
   skim. Its 100%-take-rate config is economically identical to a prize pot.
2. **[blend-capital/oracle-aggregator](https://github.com/blend-capital/oracle-aggregator)** — the
   `max_dev` circuit breaker.
3. **[script3/reflector-usdc-oracle](https://github.com/script3/reflector-usdc-oracle)** — Reflector
   wrapper repricing in USDC.
4. **[blend-contract-sdk](https://github.com/blend-capital/blend-contract-sdk) `testutils`** —
   `BlendFixture::deploy` stands up a full Blend deployment inside a unit test. This is how to get
   integration tests without touching testnet.

---

## F. The cross-subsidy problem

**This finding drove the decision to launch USDC-only.** Recorded here because it will resurface
the moment a second asset is enabled.

The assets do not generate comparable yield in Blend. From live mainnet FixedV2:

- **USDC**: 77.0% utilization, `ir_mod = 1.5131798` → borrow APR ≈ 10.4%, **supply APY ≈ 6.4%**
- **XLM**: 0.18% utilization, `ir_mod = 1.0` → borrow APR ≈ 1.01%, **supply APY ≈ 0.0015%**

The XLM `b_rate` of `1.000022245863` — barely above its 1.0 initialization — confirms it
empirically: XLM suppliers in that pool have earned 0.0022% in total, ever.

So **$1 of USDC contributes roughly four thousand times more to the prize pot than $1 of XLM**,
while buying the same number of tickets. The rational move is to deposit XLM and none of the USDC
that funds the prize. The pot collapses toward zero, and the failure is self-reinforcing: USDC
depositors realize they are subsidizing XLM depositors and leave first.

This is not hypothetical — it is why PoolTogether V5 multiplies odds by `vaultPortion`. They
shipped V4 without it and added it in V5.

Three ways out:

- **(a) Weight tickets by yield contribution**, PoolTogether-style. Economically correct;
  contradicts "payout share depends only on ticket count"; harder to explain.
- **(b) Support only assets with comparable yield.** Today that means USDC alone, or USDC + EURC.
  **This is what was chosen for launch.**
- **(c) Per-asset prize pots**, one draw per asset. Keeps fairness and the multi-asset story;
  abandons the single deep pot.

---

## G. Randomness

- **`env.prng()` is unusable.** SDK docs: *"The pseudo-random generator returned is not suitable
  for security-sensitive work"* — transaction-seeded, so it can be ground.
- **No future ledger hash.** `soroban_sdk::ledger::Ledger` exposes only `sequence()`,
  `timestamp()`, `network_id()` and (deprecated) `protocol_version()`. The EVM "future blockhash"
  pattern has no Soroban equivalent.
- **No Stellar-native randomness beacon exists.** Band Protocol has a Stellar oracle
  (`CCQXWMZVM3KRTXTUPTN53YHL272QGKF32L7XEDNZ2S6OSUFK3NFBGG5M` mainnet) but that is a price feed;
  whether Band's VRF is available on Stellar is **unverified**.
- **Strongest available option: drand, verified on-chain.** Soroban exposes BLS12-381 including
  `pairing_check`, `hash_to_g1` and `hash_to_g2` — exactly the primitives needed to verify a drand
  League-of-Entropy beacon signature. A keeper relays `(round, signature)`; the contract verifies
  against a hard-coded group public key and stores it as the cycle seed. Nobody, including us, can
  predict or grind it, and anyone can verify independently. Verification feasibility is
  established; **instruction cost is unverified** — not prototyped.
- **Fallback: operator commit-reveal**, with a bond and timeout, since the operator can abort by
  withholding the reveal. Admin-attested with a published seed is weaker still.

---

## H. ample.money — the reference product

**Sourcing:** ample.money sits behind Cloudflare and returns 403 to every automated fetch
(WebFetch on `/`, `/deposit`, `/faq`, `/team`, `/docs/*`; curl with a browser UA; the
`ampleme.xyz` mirror). The mechanics below come from search-engine-surfaced excerpts of their own
docs pages, which quote their copy directly but are **not** a first-hand read. The UI section that
follows is **first-hand, from a screenshot** relayed by a teammate, and it corrects part of what
the doc excerpts implied.

### H1. Mechanics (from doc excerpts — second-hand)

- Deposit tokens into vaults, keep principal, enter **weekly prize payouts**.
- Their framing: funds move into a "USD-denominated savings layer that taps into short-duration
  USD assets through onchain money markets," and "yield is pooled and redistributed through payout
  cycles to select recipients."
- **Tickets are amount × time**: *"Every dollar you keep in an Ample vault for a full week earns
  100 tickets for that week's draw"*; deposit mid-week and *"the week counts partially; from the
  next cycle onward it counts in full."* Their stated reason: *"Ample weights tickets with time
  instead. Your count reflects your average balance across the whole cycle, so the deposits that
  generated the week's yield are the deposits with weight in its draw."*
- **Claims are pull, not push**: *"your wallet submits the claim with its proof, the contract
  verifies it and transfers the payout"*, and *"There's no expiry of claims."* "With its proof"
  implies a merkle root per round — O(1) settlement regardless of winner count.
- **Bonus tickets** are a growth mechanic layered on top: tap-to-collect floating tickets capped at
  1,000/cycle, plus campaigns and a pre-draw "waiting room". Denominated in dollar-equivalent
  weight — *"a bonus described as '$50 of tickets' means 5,000 tickets."*
- **Teams**: join with a friend's code or start one and invite others.
- Public payouts page listing each cycle's recipients.
- Audited twice by Pashov Audit Group; HackenProof bug bounty.

### H2. UI and scope (first-hand, from screenshot)

These points **correct or extend** the doc-excerpt picture above:

- **It is not USD-savings-only.** Vaults include WETH, Gold and HYPE, with **Crypto / Stocks /
  Commodities** filters. That is materially broader than the "short-duration USD assets" framing,
  and it means ample is running exactly the multi-asset cross-subsidy question analysed in §F.
- **It is a price-aware UI**, not just a savings balance: per-asset Price, Change 24H and Change 7D
  columns, plus sparklines.
- **"Team" is a real top-level destination**, confirming the teams/referral mechanic.
- **"Payouts", "Rewards" and "Amplify" are separate top-level destinations.**
- Payout amounts shown are in the **$3,300–$3,750 range per cycle**, six cycles displayed as bars.
- Layout: top nav with wordmark and chain toggles; split hero (connect card + payout-history bars
  with a Days/Hours/Minutes countdown); trending carousel; vaults table.
- Empty cells render as **"–"** — they show the shape of the data before it exists. Worth copying,
  and it is what the STOX dashboard now does for every column with no on-chain source.

### H3. What does not carry to Stellar

- **Yield source.** Ample sits on money markets on its own chain. Stellar's equivalent is Blend.
  Notably, ample does **not** bridge capital across ecosystems to source its prize — which is why
  `MULTICHAIN_ARCHITECTURE.md` was a far more ambitious design than the reference product and was
  superseded.
- **Randomness.** See §G — Stellar has no VRF, and the landing copy currently promises verifiable
  randomness. The mechanism has to earn the claim the copy already makes.

---

## The withdrawal invariant

**A withdrawal never depends on anything outside contract state.**

Not on a deposit gate, not on Blend's pool status, not on a price oracle, not on the ranking
algorithm, not on backend availability. If a user's balance is recorded on chain, they can get it
out using only data the contract already holds.

This is not a preference that emerged once. It has been rediscovered independently at five
separate points in this design, each time as the correct answer to a different question:

| Dependency introduced | How withdrawals were exempted |
|---|---|
| Per-asset deposit gate (`set_deposits_enabled`) | `withdraw` is deliberately ungated; disabling an asset must never trap funds. Test: `test_frozen_blend_pool_blocks_deposits_but_never_withdrawals`. |
| Blend pool status | Blend's own `require_action_allowed` never lists Withdraw or WithdrawCollateral — even a frozen pool lets suppliers exit (§A/B, `pool/src/pool/pool.rs:75-82`). Verified on chain at status 4. |
| Reflector price oracle | Reject a deposit on a stale price; never block a withdrawal on one (§B4). |
| Admin-set asset price | Price affected minting only; `get_balance`, `withdraw` and `withdraw_capacity` are in asset units and never consult it (§B7). |
| Off-chain ranking + backend settlement | Stakes, roots and claims are settlement concerns. `withdraw` and `withdraw_capacity` touch none of them; a backend outage delays a draw, never an exit. |

**Treat this as a stated rule, not a pattern to rediscover.** Anyone adding a dependency to the
withdraw path should have to argue against this list explicitly, because every one of the five
above looked locally reasonable at the time and would have been wrong.

The one thing that *can* limit a withdrawal is Blend reserve liquidity (§A6), and that is a
property of the money actually being lent out — not a policy decision the protocol imposes. It is
surfaced through `withdraw_capacity` rather than hidden behind a failed transaction.

---

## Open items

1. **USDT** — dropped; no Blend reserve on either network. Revisit only if a pool lists it.
2. **"No-loss" wording** — §A7 means the unconditional claim is false. Decision taken: honest
   disclosure in the copy.
3. **"No lock-up on principal"** vs. §A6 utilization ceiling — **still open.** Needs an idle
   buffer policy or a `max_withdrawable` view the UI clamps to, before launch.
4. **Blend pool choice** — decided: Fixed V2 only, never YieldBlox.
5. **Prize payout form** — basket (recommended) vs. single asset. Open.
6. **Randomness trust model** for launch — open.
7. **`max_dev` deviation check** on the oracle read — recommended, not yet specified.

---

## What changed after this research

- **Ticket model replaced.** Time-weighted accrual → mint-at-deposit: `$1 deposited = 10 tickets`
  immediately, priced at deposit time, with withdrawal removing tickets proportionally. This
  removes the accrual machinery in §C and moots the TWAP question entirely. The decimal,
  overflow, staleness and manipulation findings still apply.
- **Asset set reduced** to USDC-only at launch (§F). XLM stays registered and fully accounted but
  deposit-gated off; USDT dropped entirely (§A5).
- **USD conversion is 1:1 for USD stablecoins** at launch, normalized to 7 decimals — exactly
  correct for USDC-only and requiring no oracle. The Reflector read becomes necessary the day a
  non-USD asset is enabled.

## Testnet deployment record

Deployed from commit `b03bbe4` (mint-at-deposit model) for frontend integration:

| | |
|---|---|
| Pool | `CBHXFO6Z2TM7FPIJDUVGWH7E4UTGRVRDIY5RZ6XB6W4XUQL4544VYIJQ` |
| Oracle (Reflector CEX/DEX, testnet) | `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63` |
| Assets | `[USDC, XLM]`, USDC deposits enabled, XLM disabled |
| USDC (test SAC) | `CD53BVML7SWLPGKA6AQMFWEVZOKGLKDR6BQCBKOYUZD6JIIZZXWYLO57` |
| XLM (native SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Test issuer | `GCODXOQVEBMGBVA4EBUGHSHUAYH33ZZTBOPPACIHOUPE5PL4KVMSGJAS` |

**These are throwaway test assets, not real ones.** Only XLM is a genuine network asset (the
native SAC). The USDC above is a SAC issued by an account created for testing — it is **not**
Circle's USDC. An earlier deployment also carried a USDT SAC from the same issuer; that asset was
dropped. None of these addresses may leak into any mainnet configuration.

Behaviour verified against the live deployment, not only in unit tests:

Deposit gating (verified on the `458ee79` deployment):
```
deposit 100 USDC (enabled)        -> ok, balance 1000000000
deposit XLM (disabled)            -> Error(Contract, #7) DepositsDisabled
enable XLM -> deposit 5 XLM       -> ok, 50000000
disable XLM -> deposit XLM        -> Error(Contract, #7)
disable XLM -> WITHDRAW 5 XLM     -> ok, balance 0      <- funds not trapped
```

Mint-at-deposit ticket semantics (verified on the `b03bbe4` deployment):
```
deposit 100 USDC   -> tickets 10000000000 (1000 tickets at 7dp = 100 USD x 10)
                      usd_balance 1000000000 (100 USD at 7dp)
withdraw 40 USDC   -> tickets  6000000000 (600 tickets = 60 USD x 10)  <- proportional
                      held_seconds settled and preserved; it keeps accruing
                      only because 60 USDC remained on deposit. A full
                      withdrawal settles the accrued value and stops accrual,
                      which is the point of settling at every balance change.
```

Reflector price history reach (verified live, and it constrains the UI):
```
price(XLM, now - 86400)  -> null      <- 24h change is NOT computable
price(XLM, now -  3600)  -> ok        <- 1h change IS computable
prices(XLM, 20)          -> 21 points <- ~100-minute sparkline is real
```
