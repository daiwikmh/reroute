import { AGENTS_ZONE, CLOUDFLARE_CONFIGURED } from "./config.js";
import { getState, putState } from "../store.js";
import { deleteTxtRecord, upsertTxtRecord } from "./cloudflare.js";
import { latestLedger, readRegistryChanges } from "./events.js";
import { buildTxtRecord, domainSlug } from "./record.js";
import { getEndpointByDomain } from "./registry.js";

// Runs once per Cron Trigger invocation instead of a setInterval loop — a
// scheduled Worker invocation is inherently one-at-a-time, so the old
// re-entrancy guard (the `running` flag in the previous setInterval version)
// isn't needed here.
export async function syncOnce(kv: KVNamespace): Promise<void> {
  const state = await getState(kv);
  // A fresh cache has no cursor at all — RPC only retains recent history, so
  // "from ledger 1" would fail. Nothing on-chain before this run's first
  // tick matters anyway (registrations before that would need a one-off
  // backfill run, not steady-state sync).
  if (state.lastLedger === 0) {
    state.lastLedger = (await latestLedger()) - 1;
    await putState(kv, state);
  }
  const changes = await readRegistryChanges(state.lastLedger + 1);
  if (changes.length === 0) return;

  const touched = new Set<string>();
  for (const change of changes) {
    if (change.kind === "register" && change.domain) {
      state.domains[change.domainHash] = change.domain;
      if (change.owner) state.owners[change.domainHash] = change.owner;
    }
    touched.add(change.domainHash);
  }

  for (const domainHash of touched) {
    const domain = state.domains[domainHash];
    if (!domain) {
      // A change for a hash we never saw a Register event for — can't
      // happen in steady state, but don't crash the whole cycle over it.
      console.warn(`dns-sync: no cached domain for hash ${domainHash}, skipping`);
      continue;
    }

    const endpoint = await getEndpointByDomain(domain);
    const recordName = `${await domainSlug(domain)}.${AGENTS_ZONE}`;

    if (!CLOUDFLARE_CONFIGURED) {
      console.log(
        endpoint && endpoint.active
          ? `dns-sync (dry run, no Cloudflare credentials configured): would upsert ${recordName} -> ${buildTxtRecord(endpoint)}`
          : `dns-sync (dry run): would remove ${recordName}`,
      );
      continue;
    }

    if (endpoint && endpoint.active) {
      await upsertTxtRecord(recordName, buildTxtRecord(endpoint));
    } else {
      await deleteTxtRecord(recordName);
    }
  }

  state.lastLedger = Math.max(state.lastLedger, ...changes.map((c) => c.ledger));
  await putState(kv, state);
}
