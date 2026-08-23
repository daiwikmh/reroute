// Calls a Reroute-protected endpoint end to end: 402 -> sign -> retry -> settled.
// Usage: SECRET_KEY=S... node scripts/pay-test.mjs https://api.neurus.xyz/pay/demoe.neurus.xyz

import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { createEd25519Signer } from "@x402/stellar";

const url = process.argv[2];
const secretKey = process.env.SECRET_KEY;

if (!url || !secretKey) {
  console.error("Usage: SECRET_KEY=S... node scripts/pay-test.mjs <pay-url>");
  process.exit(1);
}

const signer = createEd25519Signer(secretKey, "stellar:testnet");
const client = new x402Client();
client.register("stellar:testnet", new ExactStellarScheme(signer));
client.setSpendControls(false);
const http = new x402HTTPClient(client);

const first = await fetch(url);
console.log("first request:", first.status);

if (first.status !== 402) {
  console.log(await first.text());
  process.exit(0);
}

const paymentRequired = http.getPaymentRequiredResponse((name) => first.headers.get(name));
console.log("price:", paymentRequired.accepts[0]);

const paymentPayload = await http.createPaymentPayload(paymentRequired);
const headers = http.encodePaymentSignatureHeader(paymentPayload);

const second = await fetch(url, { headers });
const result = await http.processResponse(second);
console.log("paid request:", result.status, result.paymentStatus);
console.log("body:", result.body);
console.log("settlement:", result.header);
