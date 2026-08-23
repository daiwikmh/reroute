import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import type { ClientStellarSigner } from "@x402/stellar";
import { NETWORK_PASSPHRASE } from "@/utils/registry/config";

const STELLAR_TESTNET_NETWORK = "stellar:testnet";

export type AuthEntrySigner = (authEntry: string, networkPassphrase: string) => Promise<string>;

export type Quote =
  | { ok: true; amount: string; asset: string; payTo: string }
  | { ok: false; status: number; message: string };

// A GET with no payment header is free and side-effect-free — the proxy
// only ever returns pricing on this path, never settles anything.
export async function readQuote(url: string): Promise<Quote> {
  const res = await fetch(url);
  if (res.status !== 402) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Unexpected response (${res.status}).`;
    return { ok: false, status: res.status, message };
  }
  const header = res.headers.get("payment-required");
  if (!header) return { ok: false, status: res.status, message: "Missing payment-required header." };
  const decoded = JSON.parse(atob(header)) as {
    accepts: Array<{ amount: string; asset: string; payTo: string }>;
  };
  const accept = decoded.accepts[0];
  if (!accept) return { ok: false, status: res.status, message: "No payment option offered." };
  return { ok: true, amount: accept.amount, asset: accept.asset, payTo: accept.payTo };
}

export type PayOutcome = {
  status: number;
  paymentStatus: string;
  body: unknown;
  transaction?: string;
  payer?: string;
};

export async function payAndCall(
  url: string,
  address: string,
  signAuthEntry: AuthEntrySigner,
): Promise<PayOutcome> {
  const signer: ClientStellarSigner = {
    address,
    signAuthEntry: async (authEntry, opts) => {
      const signedAuthEntry = await signAuthEntry(authEntry, opts?.networkPassphrase ?? NETWORK_PASSPHRASE);
      return { signedAuthEntry, signerAddress: address };
    },
  };

  const client = new x402Client();
  client.register(STELLAR_TESTNET_NETWORK, new ExactStellarScheme(signer));
  // The library's default spend-control guard only auto-approves a
  // per-network "default" asset (USDC) — Reroute endpoints can be priced in
  // anything, so this app has to make that trust decision itself instead of
  // silently failing on non-USDC endpoints.
  client.setSpendControls(false);
  const http = new x402HTTPClient(client);

  const first = await fetch(url);
  if (first.status !== 402) {
    return { status: first.status, paymentStatus: "none", body: await first.json().catch(() => null) };
  }

  const paymentRequired = http.getPaymentRequiredResponse((name) => first.headers.get(name));
  const paymentPayload = await http.createPaymentPayload(paymentRequired);
  const headers = http.encodePaymentSignatureHeader(paymentPayload);

  const second = await fetch(url, { headers });
  const result = await http.processResponse(second);
  const settlement = result.header as { success?: boolean; payer?: string; transaction?: string } | undefined;

  return {
    status: result.status,
    paymentStatus: result.paymentStatus,
    body: result.body,
    transaction: settlement?.transaction,
    payer: settlement?.payer,
  };
}
