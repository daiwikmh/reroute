import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CURSOR_FILE } from "./config.js";

type State = {
  lastLedger: number;
  // domain hash (hex) -> plaintext domain, learned once from a Register
  // event since the contract keeps no reverse index — see events.ts.
  domains: Record<string, string>;
  // domain hash (hex) -> owner address, learned the same way — lets
  // /endpoints/:owner answer "which domains does this wallet own" without
  // the contract needing its own reverse index (it only stores hashes).
  owners: Record<string, string>;
};

const path = fileURLToPath(CURSOR_FILE);

async function load(): Promise<State> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf-8")) as Partial<State>;
    return { lastLedger: parsed.lastLedger ?? 0, domains: parsed.domains ?? {}, owners: parsed.owners ?? {} };
  } catch {
    return { lastLedger: 0, domains: {}, owners: {} };
  }
}

async function save(state: State): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2));
}

export async function getState(): Promise<State> {
  return load();
}

export async function putState(state: State): Promise<void> {
  await save(state);
}
