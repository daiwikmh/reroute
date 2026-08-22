import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type CallRecord = {
  domain: string;
  payer: string;
  asset: string;
  amount: string;
  txHash?: string;
  at: number; // unix seconds
};

const FILE = fileURLToPath(new URL("../data/calls.json", import.meta.url));

async function readAll(): Promise<CallRecord[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf-8")) as CallRecord[];
  } catch {
    return [];
  }
}

// Two payments settling concurrently would otherwise both read the same
// array before either writes, and the second write silently drops the
// first's entry. A read-modify-write on a single JSON file needs the whole
// cycle serialized, not just the write — a plain promise chain is enough
// since Node is single-threaded and this is the only writer.
// The queue itself must never end up rejected — that would poison every
// call queued after it — so each link swallows its own error after the
// caller's own promise has already captured it.
let writeQueue: Promise<void> = Promise.resolve();

export function appendCall(record: CallRecord): Promise<void> {
  const result = writeQueue.then(async () => {
    const all = await readAll();
    all.push(record);
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(all, null, 2));
  });
  writeQueue = result.catch(() => {});
  return result;
}

export async function callsForDomain(domain: string): Promise<CallRecord[]> {
  const all = await readAll();
  return all.filter((c) => c.domain === domain).sort((a, b) => b.at - a.at);
}
