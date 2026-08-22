import { AGENTS_ZONE, CLOUDFLARE_CONFIGURED, SYNC_INTERVAL_MS } from "./config.js";
import { getState, putState } from "./cache.js";
import { deleteTxtRecord, upsertTxtRecord } from "./cloudflare.js";
import { latestLedger, readRegistryChanges } from "./events.js";
import { buildTxtRecord, domainSlug } from "./record.js";
import { getEndpointByDomain } from "./registry.js";

async function syncOnce(): Promise<void> {
  const state = await getState();
  // A fresh cache has no cursor at all — RPC only retains recent history, so
  // "from ledger 1" would fail. Nothing on-chain before this process's first
  // tick matters anyway (registrations before that would need a one-off
  // backfill run, not steady-state sync).
  if (state.lastLedger === 0) {
    state.lastLedger = (await latestLedger()) - 1;
    await putState(state);
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
    const recordName = `${domainSlug(domain)}.${AGENTS_ZONE}`;

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
  await putState(state);
}

export function startSyncJob(): void {
  let running = false;
  const tick = async () => {
    // A slow tick (Cloudflare hiccup, a burst of registrations) must not run
    // concurrently with the next timer fire — two overlapping ticks racing
    // on the same cursor file would corrupt it the same way calls.json could
    // without its own write queue.
    if (running) return;
    running = true;
    try {
      await syncOnce();
    } catch (err) {
      console.error("dns-sync failed:", err);
    } finally {
      running = false;
    }
  };
  tick();
  setInterval(tick, SYNC_INTERVAL_MS);
}
