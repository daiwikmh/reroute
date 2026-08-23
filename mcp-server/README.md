# reroute-mcp

An MCP server so Claude (or any MCP-speaking agent) can actually use Reroute
from a normal conversation — not just via a hand-run script. Every Reroute
DNS record already advertises `proto=mcp`; this is what makes that true.

Three tools:

- **`resolve_endpoint`** — price a domain straight from its DNS TXT record.
  No network call to the domain's server or to Reroute's backend; DNS only.
- **`pay_endpoint`** — resolves fresh, then pays and calls the domain via
  x402 on Stellar, using the key in `STELLAR_SECRET_KEY`. Pass `maxAmount`
  to refuse paying if the live price is higher than expected.
- **`list_endpoints`** — convenience listing from Reroute's own directory
  (not required; `resolve_endpoint` works on any domain directly via DNS).

## Setup

```bash
cd mcp-server
npm install
npm run build
```

Needs a Stellar secret key to actually pay (not needed for `resolve_endpoint`
or `list_endpoints`). This is a real key with real funds — treat it exactly
like any other credential, never commit it, and use a testnet-only key while
testing:

```bash
export STELLAR_SECRET_KEY=S...
export STELLAR_NETWORK=stellar:testnet   # default; stellar:pubnet for mainnet
```

## Add to Claude Code

```bash
claude mcp add reroute --env STELLAR_SECRET_KEY=S... -- node /absolute/path/to/mcp-server/dist/index.js
```

## Add to Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "reroute": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": { "STELLAR_SECRET_KEY": "S..." }
    }
  }
}
```

## Verified

All three tools tested end to end over the real MCP protocol (a client
speaking stdio to this server, not direct function calls): `resolve_endpoint`
and `list_endpoints` against the live backend, and `pay_endpoint` completing
a real signed Stellar payment — settlement confirmed on Horizon
(`16a814b27241a764a0e1397733801a25035bbef419a83bf1fc112455155d22b6`) — and
the `maxAmount` safety refusal confirmed to stop payment before it happens.
