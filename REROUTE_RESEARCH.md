# Research behind Reroute

Reroute is an agent-native, pay-per-call gate for HTTP APIs on Stellar: a domain proves
itself via DNS, an AI agent pays on-chain with x402, and only verified, paid, rate-limited
traffic reaches the origin server. This document collects the external research, standards
work, and industry data that Reroute's design choices are actually built on — not a
generic literature survey, but a paper trail from "why does this exist" to "why does it
work this way."

**Sourcing method.** Every quote below was pulled from a primary source (a paper, an IETF
draft, an official protocol doc, a named institutional report) via direct fetch where the
source allowed it. Where a source blocked automated fetching (Coinbase's blog and a couple
of PDFs returned HTTP 403 or unparsable binary), the quote is instead reproduced from a
search engine's cached summary of that exact page and is marked **(via secondary summary,
not directly fetched)** — flagged the same way this repo already flags unverified claims
in `BLEND_INTEGRATION_RESEARCH.md`. Nothing below is paraphrased into a fake quotation;
anything in quotation marks is verbatim from the cited source.

---

## 1. The 25-year-old case against micropayments — and why it stops at the human

Long before "agents," there was a settled, mainstream-economics answer to "why doesn't the
internet just charge a penny per article/API call/click": **it doesn't work, and the
reason isn't technology.**

**Clay Shirky, "The Case Against Micropayments"** (OpenP2P.com, December 19, 2000):

> "Micropayment systems have not failed because of poor implementation; they have failed
> because they are a bad idea. Furthermore, since their weakness is systemic, they will
> continue to fail in the future."

> "There's no such thing as a no-brainer transaction — if a micropayment is large enough to
> be worth the bother to the seller, then it's large enough that the buyer will want to
> consider it before approving it."

Shirky's argument, in short: micropayments try to economize on a cheap resource
(bandwidth, content) at the cost of an expensive one — **the user's attention and time
spent deciding**. ([discussed and quoted in Tim Lee, "The Case Against Micropayments,"
Technology Liberation Front, Mar 6 2005](https://techliberation.com/2005/03/06/the-case-against-micropayments/))

**Nick Szabo, "Micropayments and Mental Transaction Costs"** (1999) gave this friction a
name — *mental transaction cost* — and argued it, not compute cost, is the real floor on
how small a priced transaction can be:

> "These mental accounting costs, not the physical or computation or amortized R&D costs
> of a payment or billing method, set the main lower bound on price granularity."

> "A lesson for micropayment efforts is that mental costs usually exceed, and often dwarf,
> the computation costs."

> "The user interface and the cognition of the user thus remain the bottleneck to
> transaction granularity."

([Szabo, "Micropayments and Mental Transaction Costs," reprinted at the Satoshi Nakamoto
Institute](https://nakamotoinstitute.org/library/micropayments-and-mental-transaction-costs/))

**Andrew Odlyzko, "The Case Against Micropayments"** (Financial Cryptography 2003, Springer
LNCS 2742, pp. 77–83) reached the same conclusion from an economist's angle — the obstacle
is "economics, sociology and psychology," not engineering — and closed with a prediction
that aged badly for anyone betting on human micropayments and very well for anyone betting
on machine ones:

> "Micropayments are likely to continue disappointing their advocates. They are an
> interesting technology. However, there are many non-technological reasons why they will
> take far longer than is generally expected to be widely used, and most probably will
> play only a minor role in the economy."
> ([abstract, Springer / ResearchGate](https://www.researchgate.net/publication/2899901_The_Case_Against_Micropayments))

Odlyzko's own paper text drives the point home with real-world pricing data: metered
pricing consistently loses to flat-rate pricing because consumers pay a premium just to
*not have to think about it*:

> "switching from metered to flat-rate pricing increases usage by 50 to 200 percent"
> ([Odlyzko, LaTeX source, University of Minnesota](https://www-users.cse.umn.edu/~odlyzko/doc/case.against.micropayments.tex))

**Why this doesn't kill Reroute.** All three papers are explicitly about *human* buyers
deciding whether a cent-sized purchase is worth the interruption. An AI agent calling an
API doesn't experience "the ticking clock" or budget anxiety — it has no mental
transaction cost at all. The 25-year-old objection to micropayments is an objection to
**putting a human in the loop of a small transaction**, and Reroute's entire pitch is that
there is no human in that loop: the agent reads a price, signs, and moves on in the same
request. This reframing — that x402-style protocols "didn't need better tech, it needed to
ditch humans" — is exactly the argument industry commentary makes when explaining why the
40-year dormant idea works now:

> "The Web's Missing Payment Primitive Didn't Need Better Tech, It Needed to Ditch Humans"
> — headline and thesis of a 2025 piece connecting Shirky/Szabo-era micropayment failure to
> x402's agent-only design.
> **(via secondary summary, not directly fetched — [BeInCrypto](https://beincrypto.com/x402-why-micropayments-work-without-humans/), blocked direct fetch with HTTP 403)**

---

## 2. HTTP 402: a status code that waited three decades for a client that wouldn't mind

Reroute's payment gate literally returns HTTP status `402`. That code has existed since
the first HTTP specs — reserved, unused, waiting:

> "This status code was created to enable digital cash or (micro) payment systems and would
> indicate that requested content is not available until the client makes a payment." ...
> "This status code is *reserved* but not defined."
> ([MDN, "402 Payment Required"](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/402) — still current as of this writing, over two decades after the code was reserved in RFC 2068)

The commonly repeated reason it never shipped is the same reason Section 1's papers give:
credit card rails aren't built for sub-cent charges, and no one had a way to make a machine
decide instead of a human. x402 (Section 3) is the first widely adopted implementation of
that 30-year-old reservation, and Reroute's `/pay/:domain` proxy speaks exactly this status
code on the exact path the spec always intended it for — resource-gated payment, not page
redesign.

---

## 3. x402: the protocol Reroute's payment gate is built on

Reroute doesn't invent its settlement layer — it sits directly on **x402**, the open
standard Coinbase published on May 6, 2025 to let HTTP resources charge per request.

**From the x402 whitepaper / homepage:**

> "x402 is an open, neutral standard for internet-native payments."

> "It absolves the Internet's original sin by natively making payments possible between
> clients and servers."

> "Payments that are amazing for humans and AI agents."

([x402.org](https://www.x402.org/), whitepaper at
[x402.org/x402-whitepaper.pdf](https://www.x402.org/x402-whitepaper.pdf))

The flow x402 defines — client requests a resource, server replies `402` with payment
terms, client retries with a signed payment payload, a facilitator verifies it, the server
returns `200`— is the exact shape of `backend/src/x402/proxy.ts`'s `handlePay()`. From the
protocol's own GitHub README:

> "Client makes an HTTP request to a resource server" → server responds with "402 Payment
> Required status" → client builds a "PaymentPayload" → a facilitator performs
> "verification of the object based on the scheme and network" → server returns "200 OK
> response to the Client with the resource they requested."
> ([github.com/coinbase/x402](https://github.com/coinbase/x402))

Coinbase's own framing of *why* ties directly into Section 1's argument — stablecoins are
what finally make the 1990s HTTP 402 reservation practical, because they remove the
card-rail minimum that made sub-cent payment absurd before:

> "We built x402 because the internet has always needed a native way to send and receive
> payments — and stablecoins finally make that possible." — **Erik Reppel**, Head of
> Engineering, Coinbase Developer Platform, co-author of the x402 whitepaper.
> **(via secondary summary — quote appears in multiple secondary write-ups of the May 2025
> Coinbase launch; Coinbase's own blog post at
> [coinbase.com/developer-platform/discover/launches/x402](https://www.coinbase.com/developer-platform/discover/launches/x402) blocked direct fetch with HTTP 403.)**

Adoption, as of the most recent figures found (~March 2026): over 119M transactions on
Base and 35M on Solana, roughly $600M in annualized volume, zero protocol fees — and a
follow-on Coinbase post specifically about **API monetization** ("APIs That Get Paid:
Monetizing the Agentic Internet With x402") describing exactly Reroute's category: sellers
turning existing HTTP endpoints into paid, agent-callable resources without a subscription
layer. ([Allium, "x402 Protocol Explained"](https://www.allium.so/blog/x402-explained-the-internet-native-payments-standard-for-apis-data-and-agent-commerce/); [Coinbase Developer Platform, "APIs That Get Paid"](https://www.coinbase.com/developer-platform/discover/launches/monetize-apis-on-x402))

**What Reroute adds on top of x402 itself, per the existing build:** x402 defines the
payment handshake but is silent on *how a client finds the right facilitator/price for a
domain it has never seen before* — that gap is what Section 4 covers, and it's the reason
Reroute has a DNS layer at all.

---

## 4. Google's Agent Payments Protocol (AP2) — the same problem, attacked from the identity side

x402 solves "how does a machine pay for one HTTP resource." A parallel, larger effort —
Google's **Agent Payments Protocol (AP2)**, announced September 16, 2025 with 60+ partners
including Mastercard, American Express, PayPal, and Coinbase — solves the adjacent problem
of proving an agent had *permission* to spend at all:

> "While today's payment systems generally assume a human is directly clicking 'buy' on a
> trusted surface, the rise of autonomous agents and their ability to initiate a payment
> breaks this fundamental assumption," raising three questions AP2 is built to answer:
> **Authorization** (did the user actually authorize this?), **Authenticity** (does the
> agent's request match the user's real intent?), and **Accountability** (who is liable if
> it goes wrong?).
> ([Google Cloud Blog, "Announcing Agent Payments Protocol (AP2)," Sept 16 2025](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol))

AP2 solves this with **Mandates** — signed proof of what a human actually authorized:

> "AP2 builds trust by using Mandates — tamper-proof, cryptographically-signed digital
> contracts that serve as verifiable proof of a user's instructions."

Industry partners frame this the same way Reroute's own reframing does — payments
infrastructure as a **trust and accountability layer**, not just a rail:

> "With the rise of AI-driven commerce, trust and accountability are more important than
> ever." — **Luke Gebb**, EVP, Amex Digital Labs, American Express

> "We're playing an essential role in securing the payments ecosystem — ensuring that trust
> and safety remain at the core of every transaction." — **Pablo Fourez**, Chief Digital
> Officer, Mastercard
> (both quotes: [Google Cloud Blog, ibid.](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol))

**Where Reroute sits relative to AP2:** AP2 is about authorizing *the human's agent to
spend on the human's behalf* (consumer-side). Reroute is the mirror image — authorizing
*a request to reach the seller's origin server* (server-side), gated by DNS ownership proof
plus payer allow/deny policy instead of a signed Mandate. The two are complementary, not
competing: an AP2-authorized agent is exactly the kind of client Reroute's `/pay/:domain`
gate is built to receive.

---

## 5. "Verify, then pay" — the emerging academic case for a guard, not a toll booth

This is the research line that most directly matches the mid-project reframing this
codebase already went through: from "monetize your API" to "verify and guard every request
before it reaches your origin."

**TessPay: Verify-then-Pay Infrastructure for Trusted Agentic Commerce** (arXiv, 2026)
argues the naive x402 flow — pay first, then get the resource — is exactly backwards for
adversarial settings, and that verification needs to happen *before* funds move:

> The framework "prioritiz[es] validating transaction details and merchant legitimacy
> before payment authorization, preventing unauthorized or fraudulent transactions from
> draining agent-controlled funds," separating verification from payment execution so
> "agents can confirm service provider authenticity and transaction integrity before
> committing resources."
> ([arXiv:2602.00213](https://arxiv.org/pdf/2602.00213))

Reroute's actual implementation splits the difference in the direction that fits an API
gateway rather than a shopping agent: the **DNS verification gate runs before x402
settlement is even attempted** (`isDnsVerified` in `backend/src/x402/proxy.ts`) — a
domain has to prove ownership of its own DNS before Reroute will quote it a price or accept
a payment for it at all. That is TessPay's "verify legitimacy before committing resources"
principle, applied to *the seller's* identity rather than the buyer's.

The same "don't just trust the request" instinct is the entire premise of **zero trust**
architecture, formalized by NIST:

> NIST SP 800-207 establishes the guiding principle of "never trust, always verify" — no
> entity inside or outside the network is trusted by default, and every request is
> authenticated and authorized.
> **(via secondary summary of NIST SP 800-207;** phrase itself traces to John Kindervag's
> 2008 formulation, formalized into NIST's architecture model in SP 800-207, 2020.)

And the concrete abuse pattern Reroute's rate limiter and payer allow/deny list defend
against is a named, numbered risk in the industry's own API security standard:

> **API4:2023 — Unrestricted Resource Consumption:** "Satisfying API requests requires
> resources such as network bandwidth, CPU, memory, and storage." Mitigation: "Limit/
> throttle how many times or how often a single API client/user can execute a single
> operation."
> ([OWASP API Security Top 10, 2023 edition](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/))

**How this shaped Reroute.** This is the direct research backing for the milestone this
session just shipped: per-payer rate limiting and an allow/deny `PayerPolicy` on the
`endpoint_registry` contract, checked *before* `processSettlement` is ever called — so a
blocked payer's transaction never even reaches the chain. That ordering (deny first, spend
never happens) is exactly what OWASP's API4 mitigation and TessPay's verify-then-pay
principle both prescribe, and exactly what this repo's own testing proved out: setting a
deny-list and confirming the blocked payer got a 403 with no on-chain transaction attempted
at all.

---

## 6. DNS-first agent discovery: an active, unsettled, but converging IETF design space

This is the part of Reroute's design (`_agent.<domain>` TXT record, `AGENTS_ZONE` CNAME
delegation) that turns out not to be a one-off idea — it's one implementation of a genuine
2026 IETF standardization effort, with Reroute's exact record shape matching one specific
draft almost field-for-field.

**Agent Identity and Discovery (AID)** — `draft-nemethi-aid-agent-identity-discovery-00`,
published 16 March 2026 by B. Nemethi (Open Agent Registry, Inc.):

> "Agent Identity and Discovery (AID) is a minimal, DNS-first discovery protocol for
> locating agent service endpoints. Given a domain name, an AID client queries a DNS TXT
> record at the well-known subdomain `_agent.<domain>` and learns the service endpoint
> URI, protocol token, authentication hint, and optional metadata for that agent."
> ([IETF Datatracker](https://datatracker.ietf.org/doc/draft-nemethi-aid-agent-identity-discovery/), [draft text](https://www.ietf.org/archive/id/draft-nemethi-aid-agent-identity-discovery-00.html))

The record format is semicolon-delimited `key=value` pairs — `v` (version, must be
`aid1`), `u` (endpoint URI), `p` (protocol token), `a` (auth hint), plus optional fields —
and the draft gives the reason DNS TXT specifically, over any bespoke registry:

> "TXT is the deployed discovery record type because it is widely available across DNS
> providers and registrars."
> ([ibid.](https://www.ietf.org/archive/id/draft-nemethi-aid-agent-identity-discovery-00.html))

This is, field for field, the mechanism `backend/src/dns/record.ts` builds and
`backend/src/dns/status.ts` verifies via `resolveTxt`. Reroute's `_agent.<domain>` name,
the `v=`/`uri=`/`proto=` key style, and the "DNS ownership proves the seller is who they
claim" logic all line up with AID's own stated rationale.

**AID is not the only draft in this space** — which matters, because it means Reroute is
riding an early-but-real standardization wave, not a solved standard:

- **DNS-AID** (`draft-mozleywilliams-dnsop-dnsaid-02`, 27 May 2026) takes a heavier
  approach — SVCB records plus DNS-SD labels, optional DNSSEC/DANE — explicitly "introduces
  no new DNS resource record types, opcodes, or response codes." ([IETF Datatracker](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/))
- **Agent Discovery Protocol (ADP)** (`draft-pro-adp-agent-discovery-02`, updated 24 July
  2026) layers DNS discovery (delegating to DNS-AID) under a Well-Known JSON metadata
  layer and a WebSocket-based "Agent Gateway Protocol," with clients escalating "from DNS
  to HTTP to WebSocket only when necessary." ([IETF Datatracker](https://datatracker.ietf.org/doc/draft-pro-adp-agent-discovery/))
- **MCP DNS Discovery** (`draft-morrison-mcp-dns-discovery`) does the same `_mcp.<domain>`
  TXT-record trick specifically for Model Context Protocol servers — the closest sibling
  to AID, narrowed to one agent protocol.

**How this shaped Reroute.** AID's minimalism — one TXT record, no new DNS record types,
no signature scheme required to bootstrap discovery — is exactly why Reroute could build a
working DNS-hosting layer (Cloudflare zone + CNAME delegation) in a single milestone
instead of needing DNSSEC/DANE infrastructure first. The heavier drafts (DNS-AID, ADP) are
worth revisiting once Reroute needs stronger seller-identity guarantees than "you control
this DNS zone" — but AID's own justification for TXT ("widely available across DNS
providers") is precisely the property that let this be shipped against a real domain
(neurus.xyz) on real Cloudflare infrastructure in days, not months.

---

## 7. Agents as economic peers: what economists are actually saying

Reroute's premise — that an AI agent, not a human, is the one deciding to pay — isn't just
a product bet. It's the subject of live academic work on what infrastructure autonomous
agents need to function as economic actors at all.

**Gillian K. Hadfield (Johns Hopkins) and Andrew Koh (MIT), "An Economy of AI Agents"**
(prepared for the NBER Handbook on the Economics of Transformative AI, arXiv:2509.01063,
Sept 2025) survey exactly this gap:

> "AI agents deployed in markets might shape prices, search, bargaining, and finance; and
> market forces shape the design and proliferation of AI agents."

> "Identity and registration infrastructure are currently missing for AI agents...
> Building them out will be essential."

> "It [is] unclear what technological capacity users will have to reliably implement
> controls on what an agent can and cannot do."
> ([arXiv:2509.01063](https://arxiv.org/html/2509.01063v1); also published via [NBER](https://www.nber.org/system/files/chapters/c15305/c15305.pdf))

A more infrastructure-focused framing, **"The Agent Economy: A Blockchain-Based Foundation
for Autonomous AI Agents"** (arXiv:2602.14219), argues the missing piece is specifically
settlement, not just identity:

> Blockchain provides "three critical properties enabling genuine agent autonomy:
> permissionless participation, trustless settlement, and machine-to-machine
> micropayments," because "existing human-centric infrastructure cannot support genuine
> agent autonomy."
> ([arXiv:2602.14219](https://arxiv.org/abs/2602.14219))

**How this shaped Reroute.** Hadfield & Koh's "identity and registration infrastructure is
missing" is, almost word for word, the gap the `endpoint_registry` contract plus DNS layer
fill for the *seller* side (a domain has a verifiable, on-chain-registered identity before
it can be paid), and the "controls on what an agent can and cannot do" gap is what the
`PayerPolicy` allow/deny list and rate limiter fill for the *payer* side. Neither paper
prescribes Reroute's specific design — but both independently name the exact two gaps
(seller identity, payer control) that Reroute's guard features exist to close.

---

## 8. Cross-currency settlement: the unfinished part of the thesis, and what the data says about it

The original pitch behind Reroute included: a US agent pays in XLM, an Indian merchant's
dashboard shows INR. The research supporting *why this should be possible* is solid; the
part that turns it into working code is not finished yet (see the Reflector oracle note
below), so this section is as much a gap-check as a citation list.

**Stablecoins are already doing this job at scale, informally.** The IMF's June 2026
Article IV analysis of Nigeria (Annex VII, by Mission Chief Axel Schimmelpfennig and
economist Bo Zhao) found:

> Nigeria received about $59 billion in crypto-asset inflows between July 2023 and June
> 2024, and accounts for roughly 60% of stablecoin inflows into sub-Saharan Africa since
> 2019 — used for remittances and cross-border payments, at a time when "the average cost
> of sending US$200 to sub-Saharan Africa remains around 9 percent of transaction value,
> well above the global average of 6 percent."
> **(via secondary summary, not directly fetched — [IMF, "Stablecoins in Nigeria: A Growing
> Cross-Border Channel," June 16 2026](https://www.imf.org/en/news/articles/2026/06/16/stablecoins-in-nigeria) blocked direct fetch with HTTP 403; figures cross-checked against
> multiple independent news summaries of the same report, e.g.
> [AMBCrypto](https://ambcrypto.com/imf-says-stablecoins-have-become-major-cross-border-payment-channel-in-nigeria/))**

BIS research on the same question found that acquiring a dollar-pegged stablecoin is,
functionally, a currency-conversion event most of the time, not a dollar-native one:

> **BIS Working Papers No. 1340, "Stablecoin flows and spillovers to FX markets"** (2026)
> used data on four major USD-pegged stablecoins traded against 27 fiat currencies across
> 64 exchanges (2021–2025) and found that "more than 70%" of fiat-to-stablecoin conversions
> originate from non-US-dollar currencies — meaning acquiring a dollar-pegged token performs
> a currency-conversion function for most holders, and documented "large and persistent
> price gaps... between buying dollar exposure via stablecoins and via traditional markets."
> ([BIS Working Papers No. 1340](https://www.bis.org/publ/work1340.htm); summarized via [Ledger Insights](https://www.ledgerinsights.com/bis-imf-researchers-find-stablecoins-already-impact-traditional-fx-rates/))

**Stellar's own anchor network is the specific rail Reroute is built on top of**, and it
already carries the multi-currency liquidity the product needs:

> As of the most recent Anchor Directory count, 69 Anchor financial intermediaries
> collectively support more than 170 fiat currencies; cross-border stablecoin settlement on
> Stellar reached $2.3B average monthly volume across 17 stablecoins and 9+ fiat
> currencies.
> ([Stellar Anchor Directory](https://anchors.stellar.org/); Stellar ecosystem reporting)

**The gap.** This is exactly why `CURRENCIES` in `fin/src/utils/registry/config.ts` lists
`cBRL` and `cNGN` as real, liquid Stellar-anchor-backed assets — the demand and the rails
both genuinely exist. What doesn't exist yet, confirmed by direct testing against
Reflector's live mainnet contract (see `reflector-oracle-verified-interface` in this
project's prior research), is automatic on-chain conversion between them: Reflector prices
assets by symbol (`Other("cBRL")`), never by Stellar contract address, so the
`endpoint_registry` contract's `get_price` path — which calls Reflector with
`Asset::Stellar(address)` — can never resolve a match for any accepted asset beyond the one
manually pinned via `PriceOverride`. The research says the cross-currency thesis is sound
and the liquidity exists on Stellar's own rails; the code doesn't yet connect the two
automatically. That remains open, tracked work, not a research gap.

---

## 9. Summary: research claim → Reroute design decision

| Research finding | Reroute decision it grounds |
|---|---|
| Mental transaction cost makes micropayments fail for humans (Szabo, Odlyzko, Shirky) | Reroute charges **agents**, never humans, per call — no UI decision point exists to be fatigued by |
| HTTP 402 was reserved for exactly this and never used | `/pay/:domain` literally returns `402`, matching the spec's original intent |
| x402 defines the pay-and-retry handshake but not discovery | Reroute adds the DNS layer x402 itself doesn't specify |
| AP2's Authorization/Authenticity/Accountability gap (consumer side) | Reroute's DNS-verification + payer policy (seller/server side) is the mirror-image guard |
| TessPay's verify-then-pay ordering; OWASP API4 resource-consumption risk | DNS gate and payer allow/deny check run **before** `processSettlement`; rate limiter enforced pre-settlement too |
| NIST zero trust: never trust, always verify | The whole product's reframe from "monetize" to "verify and guard every request" |
| AID draft: minimal DNS TXT discovery, no new record types needed | `_agent.<domain>` TXT record, Cloudflare CNAME delegation — shippable without DNSSEC |
| Hadfield & Koh: agent identity/registration infra is missing | `endpoint_registry` on-chain contract gives sellers a verifiable identity before they can be paid |
| Nigeria alone drives ~60% of sub-Saharan Africa's stablecoin inflows (IMF); Stellar anchors support 170+ currencies | `CURRENCIES` config lists real anchor-backed local currencies (cBRL, cNGN) as the target, even though auto-conversion isn't wired yet |

---

## Open questions this research doesn't answer

- Whether AID (the draft Reroute's DNS layer matches) or a heavier competitor (DNS-AID,
  ADP) becomes the actual adopted standard — all three are active 2026 drafts, none is an
  RFC yet.
- Whether Reflector or a different oracle path is the right fix for the cross-currency gap
  in Section 8 — the research establishes the *demand* is real, not the implementation.
- Whether AP2-style Mandates are worth adopting on the payer side of Reroute (proving an
  agent's human actually authorized a given spend) — currently Reroute only verifies the
  *seller's* identity (DNS) and the *payer's* standing (allow/deny list, rate limit), not
  the payer's own authorization chain back to a human.
