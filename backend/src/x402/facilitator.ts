import { HTTPFacilitatorClient } from "@x402/core/http";

// Stellar's own hosted, production x402 facilitator — verified against
// developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar.
// "any SEP-41 token asset (defaults to USDC)" per that doc, confirming the
// spike's conclusion: this is asset-parameterized, not USDC-only. We call
// it rather than running our own verify/settle logic.
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://channels.openzeppelin.com/x402/testnet";
const FACILITATOR_API_KEY = process.env.X402_FACILITATOR_API_KEY;

export const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  ...(FACILITATOR_API_KEY
    ? {
        createAuthHeaders: async () => {
          const headers = { Authorization: `Bearer ${FACILITATOR_API_KEY}` };
          return { verify: headers, settle: headers, supported: headers };
        },
      }
    : {}),
});
