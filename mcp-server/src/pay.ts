// The actual pay-and-call flow: 402 -> sign -> retry -> settled. Same
// mechanism proven in backend/scripts/pay-test.mjs and fin's payClient.ts —
// this is the only piece that changes per caller (a raw secret key here,
// a browser wallet there).

import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { Network } from "@x402/core/types";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { createEd25519Signer } from "@x402/stellar";

function asNetwork(value: string): Network {
  if (!value.includes(":")) throw new Error(`"${value}" isn't a valid CAIP-2 network id (expected "namespace:reference").`);
  return value as Network;
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
  network: string,
  secretKey: string,
): Promise<PayOutcome> {
  const net = asNetwork(network);
  const signer = createEd25519Signer(secretKey, net);

  const client = new x402Client();
  client.register(net, new ExactStellarScheme(signer));
  // Reroute endpoints can be priced in any asset, not just each network's
  // "default" one — the library's spend-control guard would otherwise
  // silently reject anything but USDC. An agent acting on a human's
  // pre-authorized key is exactly the trust boundary this is meant for.
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
