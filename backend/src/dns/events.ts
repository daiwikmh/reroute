import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { REGISTRY_CONTRACT_ID, RPC_URL } from "./config.js";

export type RegistryChange = {
  kind: "register" | "update_price" | "update_assets" | "set_active" | "admin_deactivate";
  domainHash: string; // hex, matches the contract's sha256 domain key
  domain?: string; // only ever present on "register" — see lib.rs's Register event
  owner?: string; // only ever present on "register" — same event, see lib.rs's Register event
  ledger: number;
  at: number;
};

const server = () => new rpc.Server(RPC_URL);

export async function latestLedger(): Promise<number> {
  return (await server().getLatestLedger()).sequence;
}

// Everything the DNS sync job needs to know changed on-chain. Only Register
// carries the plaintext domain (the contract has no reverse hash index), so
// every other event is a "go re-read this hash" signal against the cache
// register already populated — see sync.ts.
export async function readRegistryChanges(fromLedger: number): Promise<RegistryChange[]> {
  const s = server();
  const latest = (await s.getLatestLedger()).sequence;
  const changes: RegistryChange[] = [];
  let cursor: string | undefined;
  const filters = [
    { type: "contract" as const, contractIds: [REGISTRY_CONTRACT_ID] },
  ];

  for (;;) {
    const page = await s.getEvents(
      cursor
        ? { cursor, filters, limit: 200 }
        : { startLedger: Math.min(fromLedger, latest), filters, limit: 200 },
    );

    for (const ev of page.events) {
      if (ev.ledger > latest) continue;
      const topics = ev.topic.map((t: xdr.ScVal) => scValToNative(t));
      const kind = topics[0] as RegistryChange["kind"];
      const at = Math.floor(new Date(ev.ledgerClosedAt).getTime() / 1000);

      if (kind === "register") {
        const owner = topics[1] as string;
        const domainHash = Buffer.from(topics[2]).toString("hex");
        const domain = (scValToNative(ev.value) as Buffer).toString("utf-8");
        changes.push({ kind, domainHash, domain, owner, ledger: ev.ledger, at });
      } else if (
        kind === "update_price" ||
        kind === "update_assets" ||
        kind === "set_active" ||
        kind === "admin_deactivate"
      ) {
        const domainHash = Buffer.from(topics[1]).toString("hex");
        changes.push({ kind, domainHash, ledger: ev.ledger, at });
      }
    }

    if (!page.cursor || page.events.length === 0) break;
    cursor = page.cursor;
  }

  return changes.sort((a, b) => a.at - b.at || a.ledger - b.ledger);
}
