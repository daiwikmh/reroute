import type { Context } from "hono";
import { Transaction, scValToNative } from "@stellar/stellar-sdk";
import type { PaymentPayload } from "@x402/core/types";
import { appendCall } from "../calls.js";
import { getEndpointByDomain, isPayerAllowed } from "../dns/registry.js";
import { NETWORK_PASSPHRASE } from "../dns/config.js";
import { checkDnsStatus } from "../dns/status.js";
import { checkRateLimit } from "./rateLimit.js";
import { getHttpResourceServer } from "./resourceServer.js";
import { requestContext } from "./honoAdapter.js";

// The transaction's own *source account* is whoever submits/pays the fee —
// for an x402 payment that's typically the facilitator's relay, not the
// payer. The real payer is arg[0] ("from") of the token contract's
// transfer(from, to, amount) call inside the transaction's one
// invokeHostFunction operation — confirmed by reading @x402/stellar's own
// facilitator source rather than assumed, since getting this wrong means an
// allow/deny list silently doesn't enforce anything.
function extractPayer(paymentPayload: PaymentPayload): string | null {
  try {
    const payload = paymentPayload.payload as { transaction?: string };
    if (!payload.transaction) return null;
    const tx = new Transaction(payload.transaction, NETWORK_PASSPHRASE);
    if (tx.operations.length !== 1) return null;
    const op = tx.operations[0];
    if (op.type !== "invokeHostFunction") return null;
    const func = op.func;
    if (func.switch().name !== "hostFunctionTypeInvokeContract") return null;
    const args = func.invokeContract().args();
    if (args.length !== 3) return null;
    return scValToNative(args[0]) as string;
  } catch {
    return null;
  }
}

const ORIGIN_TIMEOUT_MS = 8000;
const DNS_GATE_TTL_MS = 60_000;

// On-chain registration alone proves nothing about who controls a domain —
// anyone could register "google.com" with their own payTo and collect
// payment agents believe is going to its real owner. A verified DNS record
// (the seller's own CNAME resolving to what the registry expects) is the
// actual ownership proof, the same principle SPF/DKIM/ACME dns-01 rely on.
// Cached briefly so every payment request doesn't need a live DNS lookup —
// the frontend's own polling (uncached) still shows changes immediately.
const dnsGateCache = new Map<string, { verified: boolean; expiresAt: number }>();

// Escape hatch for local development only, where Cloudflare isn't wired up
// and no test domain can ever pass real DNS verification. Defaults to the
// gate being enforced; must be explicitly opted out of, never the other way.
const DNS_GATE_DISABLED = process.env.DNS_GATE_DISABLED === "true";

async function isDnsVerified(domain: string): Promise<boolean> {
  if (DNS_GATE_DISABLED) return true;
  const cached = dnsGateCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.verified;
  const status = await checkDnsStatus(domain);
  const verified = status.state === "verified";
  dnsGateCache.set(domain, { verified, expiresAt: Date.now() + DNS_GATE_TTL_MS });
  return verified;
}

// Fetches the seller's actual site — https://<domain>, matching the `uri=`
// convention already used in the DNS TXT record — so a paid call really
// reaches them, not a canned stand-in. A seller's origin being unreachable
// is their problem to fix, not a reason to fail the whole request silently:
// the payer already paid, so this still returns a clear response and the
// call still gets logged.
async function fetchOrigin(domain: string): Promise<{ status: number; body: string; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}`, { signal: controller.signal });
    const body = await res.text();
    return { status: res.status, body, contentType: res.headers.get("content-type") ?? "text/plain" };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : "unreachable";
    return {
      status: 502,
      body: JSON.stringify({ error: `Origin ${reason}: https://${domain} did not respond in time.` }),
      contentType: "application/json",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handlePay(c: Context) {
  const domain = (c.req.param("domain") ?? "").trim().toLowerCase();
  const endpoint = await getEndpointByDomain(domain);
  if (!endpoint || !endpoint.active) {
    return c.json({ error: "No active endpoint registered for this domain." }, 404);
  }

  if (!(await isDnsVerified(domain))) {
    return c.json(
      {
        error:
          "This domain's DNS record isn't verified yet — registering on-chain isn't proof of ownership by itself. Add the CNAME shown in the setup panel and wait for it to verify before this endpoint can accept payment.",
      },
      403,
    );
  }

  const httpServer = await getHttpResourceServer(
    domain,
    endpoint.pay_to,
    endpoint.reference_asset,
    endpoint.reference_price.toString(),
  );

  const routePattern = `GET /pay/${domain}`;
  const process = await httpServer.processHTTPRequest(requestContext(c, routePattern));

  if (process.type === "payment-error") {
    console.error("x402 payment-error:", JSON.stringify(process.response, null, 2));
    const { status, headers, body } = process.response;
    Object.entries(headers).forEach(([k, v]) => c.header(k, v));
    return c.json(body as Record<string, unknown>, status as never);
  }

  if (process.type === "no-payment-required") {
    // This route always requires payment; treat as a misconfiguration rather
    // than silently granting access.
    return c.json({ error: "Payment configuration missing for this route." }, 500);
  }

  // payment-verified means the signature already checked out — the payer's
  // identity is known before a single stroop moves, so a denied or
  // rate-limited payer's transaction is rejected here and never broadcast,
  // rather than settled and then refused.
  const payer = extractPayer(process.paymentPayload);
  if (!payer) {
    return c.json({ error: "Could not determine payer identity from the payment payload." }, 400);
  }
  if (!(await isPayerAllowed(domain, payer))) {
    return c.json({ error: "This payer is not permitted to access this endpoint." }, 403);
  }
  if (!checkRateLimit(domain, payer)) {
    return c.json({ error: "Rate limit exceeded for this payer on this endpoint. Try again shortly." }, 429);
  }

  // call the seller's actual site, then settle.
  const origin = await fetchOrigin(domain);

  const settlement = await httpServer.processSettlement(
    process.paymentPayload,
    process.paymentRequirements,
    process.declaredExtensions,
    { request: requestContext(c, routePattern), responseBody: Buffer.from(origin.body) },
    undefined,
    process.beforeHandlerSettlement,
  );

  if ("success" in settlement && settlement.success) {
    Object.entries(settlement.headers).forEach(([k, v]) => c.header(k, v));
    // Payment already cleared regardless of what the origin returned — that's
    // the payer's proof of a genuine attempt, not a reason to skip the log.
    await appendCall({
      domain,
      payer: settlement.payer ?? "unknown",
      asset: process.paymentRequirements.asset,
      amount: process.paymentRequirements.amount,
      txHash: settlement.transaction,
      at: Math.floor(Date.now() / 1000),
    });
    c.header("Content-Type", origin.contentType);
    return c.body(origin.body, origin.status as never);
  }

  return c.json({ error: "errorReason" in settlement ? settlement.errorReason : "Settlement failed." }, 402);
}
