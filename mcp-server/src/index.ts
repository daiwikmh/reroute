#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveAid } from "./aid.js";
import { payAndCall } from "./pay.js";

const NETWORK = process.env.STELLAR_NETWORK ?? "stellar:testnet";
const DIRECTORY_URL = process.env.REROUTE_BACKEND_URL ?? "https://api.neurus.xyz";

const server = new McpServer({ name: "reroute", version: "0.1.0" });

server.registerTool(
  "resolve_endpoint",
  {
    title: "Resolve a Reroute endpoint's price",
    description:
      "Look up what a Reroute-priced domain charges per call — price, currency, settlement asset, and payout address — from a single DNS TXT lookup. Makes zero requests to the domain's own server or to Reroute's backend; this is pure DNS, so it works even if either is down.",
    inputSchema: { domain: z.string().describe("The domain to price, e.g. api.example.com") },
  },
  async ({ domain }) => {
    try {
      const aid = await resolveAid(domain);
      return { content: [{ type: "text", text: JSON.stringify(aid, null, 2) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      };
    }
  },
);

server.registerTool(
  "pay_endpoint",
  {
    title: "Pay a Reroute endpoint and call it",
    description:
      "Pays for one call to a Reroute-priced domain via x402 on Stellar, using the key in STELLAR_SECRET_KEY, then returns the domain's real response. Resolves price fresh from DNS first. Pass maxAmount (in the asset's smallest units, matching the resolved price's units) to refuse paying if the live price is higher than expected — useful before committing to a domain you haven't checked in this conversation.",
    inputSchema: {
      domain: z.string().describe("The domain to pay and call, e.g. api.example.com"),
      maxAmount: z
        .string()
        .optional()
        .describe("Refuse to pay if the resolved price exceeds this (smallest units). Omit to skip this check."),
    },
  },
  async ({ domain, maxAmount }) => {
    const secretKey = process.env.STELLAR_SECRET_KEY;
    if (!secretKey) {
      return {
        isError: true,
        content: [{ type: "text", text: "STELLAR_SECRET_KEY is not set — this tool has no wallet to pay with." }],
      };
    }
    try {
      const aid = await resolveAid(domain);
      if (!aid.active) {
        return { isError: true, content: [{ type: "text", text: `${domain} is registered but marked inactive.` }] };
      }
      if (maxAmount !== undefined && BigInt(aid.price) > BigInt(maxAmount)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Refusing to pay: price is ${aid.price} ${aid.cur}, which exceeds the maxAmount of ${maxAmount}.`,
            },
          ],
        };
      }
      const outcome = await payAndCall(aid.uri, NETWORK, secretKey);
      return { content: [{ type: "text", text: JSON.stringify(outcome, null, 2) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      };
    }
  },
);

server.registerTool(
  "list_endpoints",
  {
    title: "List known Reroute endpoints",
    description:
      "Lists active, DNS-verified Reroute endpoints from Reroute's own directory service (a convenience index, not required — resolve_endpoint works on any domain directly via DNS whether or not it's in this list).",
    inputSchema: {},
  },
  async () => {
    try {
      const res = await fetch(`${DIRECTORY_URL}/endpoints`);
      const body = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
