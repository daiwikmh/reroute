import {
  Client,
  contract,
  rpc,
  Account,
  Contract,
  Address,
  TransactionBuilder,
  BASE_FEE,
  scValToNative,
  xdr,
} from "endpoint_registry_sdk";
import {
  BACKEND_URL,
  CONTRACT_ERRORS,
  NETWORK_PASSPHRASE,
  REGISTRY_CONTRACT_ID,
  RPC_URL,
  SIMULATION_SOURCE,
} from "./config";

export type SignFn = (xdr: string, passphrase: string) => Promise<string>;

const server = () => new rpc.Server(RPC_URL);

async function simulate(method: string, args: xdr.ScVal[]): Promise<unknown> {
  const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(REGISTRY_CONTRACT_ID).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server().simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(
      rpc.Api.isSimulationError(sim) ? sim.error : `Could not read ${method}.`,
    );
  }
  return scValToNative(sim.result.retval);
}

const addr = (value: string) => new Address(value).toScVal();

// Lower-cased before hashing so "Foo.com" and "foo.com" are the same
// registration — the contract has no string-normalisation primitive, so
// every caller (frontend, backend sync job) must normalise the same way.
export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase();
}

export async function domainSlug(domain: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeDomain(domain));
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type Endpoint = {
  domain: string;
  owner: string;
  payTo: string;
  referenceAsset: string;
  referencePrice: bigint;
  acceptedAssets: string[];
  facilitatorUrl: string;
  active: boolean;
  registeredAt: bigint;
  updatedAt: bigint;
};

function domainBytes(domain: string) {
  return xdr.ScVal.scvBytes(Buffer.from(normalizeDomain(domain), "utf-8"));
}

export async function getEndpoint(domain: string): Promise<Endpoint | null> {
  try {
    const raw = (await simulate("get_endpoint", [domainBytes(domain)])) as {
      domain: Buffer;
      owner: string;
      pay_to: string;
      reference_asset: string;
      reference_price: bigint;
      accepted_assets: string[];
      facilitator_url: string;
      active: boolean;
      registered_at: bigint;
      updated_at: bigint;
    };
    return {
      domain: raw.domain.toString("utf-8"),
      owner: raw.owner,
      payTo: raw.pay_to,
      referenceAsset: raw.reference_asset,
      referencePrice: raw.reference_price,
      acceptedAssets: raw.accepted_assets,
      facilitatorUrl: raw.facilitator_url,
      active: raw.active,
      registeredAt: raw.registered_at,
      updatedAt: raw.updated_at,
    };
  } catch {
    // NoSuchEndpoint surfaces as a contract error from simulate — treated as
    // "not registered yet", the only outcome a caller needs to distinguish.
    return null;
  }
}

// The contract's own list_owner_domains only returns hashes (no reverse name
// index on-chain) — the backend's DNS sync job already learns owner ->
// domain from Register events, so it's the one place that can resolve
// names for an address. Each name is then read straight from the contract
// via getEndpoint, keeping the contract the source of truth for state.
export async function listOwnerEndpoints(owner: string): Promise<Endpoint[]> {
  const res = await fetch(`${BACKEND_URL}/endpoints/${encodeURIComponent(owner)}`);
  const domains = (await res.json()) as string[];
  const endpoints = await Promise.all(domains.map((domain) => getEndpoint(domain)));
  return endpoints.filter((e): e is Endpoint => e !== null);
}

async function send(
  build: Promise<contract.AssembledTransaction<contract.Result<void>>>,
  sign: SignFn,
): Promise<string> {
  const tx = await build;
  const sent = await tx.signAndSend({
    signTransaction: async (unsigned: string) => ({
      signedTxXdr: await sign(unsigned, NETWORK_PASSPHRASE),
    }),
  });
  return sent.sendTransactionResponse?.hash ?? "";
}

function client(publicKey: string) {
  return new Client({
    contractId: REGISTRY_CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
  });
}

export async function registerEndpoint(
  owner: string,
  domain: string,
  payTo: string,
  referenceAsset: string,
  referencePrice: bigint,
  acceptedAssets: string[],
  facilitatorUrl: string,
  sign: SignFn,
): Promise<string> {
  return send(
    client(owner).register({
      owner,
      domain: Buffer.from(normalizeDomain(domain), "utf-8"),
      pay_to: payTo,
      reference_asset: referenceAsset,
      reference_price: referencePrice,
      accepted_assets: acceptedAssets,
      facilitator_url: facilitatorUrl,
    }),
    sign,
  );
}

export async function setActive(
  owner: string,
  domain: string,
  active: boolean,
  sign: SignFn,
): Promise<string> {
  return send(
    client(owner).set_active({
      owner,
      domain: Buffer.from(normalizeDomain(domain), "utf-8"),
      active,
    }),
    sign,
  );
}

export type Severity = "failure" | "notice";
export type Explained = { message: string; severity: Severity };

const NOTICE_CODES = new Set([3, 4, 5, 6, 7, 8]);

export function explainError(error: unknown): Explained {
  const text = error instanceof Error ? error.message : String(error);
  const notice = (message: string): Explained => ({ message, severity: "notice" });
  const failure = (message: string): Explained => ({ message, severity: "failure" });

  const code = text.match(/Error\(Contract, #(\d+)\)/);
  if (code) {
    const value = Number(code[1]);
    const mapped = CONTRACT_ERRORS[value];
    if (mapped) return NOTICE_CODES.has(value) ? notice(mapped) : failure(mapped);
  }

  if (/User (declined|rejected)|denied|cancell?ed/i.test(text)) {
    return notice("You cancelled the request in your wallet.");
  }
  if (/fetch|network|Failed to/i.test(text)) {
    return failure("Could not reach the network. Check your connection and retry.");
  }
  return failure(text);
}

export function describeError(error: unknown): string {
  return explainError(error).message;
}

export function toBaseUnits(input: string, decimals: number): bigint {
  const cleaned = input.trim();
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) {
    throw new Error("Enter a valid number.");
  }
  const [whole, fraction = ""] = cleaned.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Maximum ${decimals} decimal places.`);
  }
  const value = BigInt(`${whole || "0"}${fraction.padEnd(decimals, "0")}`);
  if (value <= 0n) throw new Error("Enter an amount greater than zero.");
  return value;
}

export function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const fraction = (abs % base).toString().padStart(decimals, "0").slice(0, 2);
  return `${negative ? "-" : ""}${(abs / base).toLocaleString("en-US")}.${fraction}`;
}
