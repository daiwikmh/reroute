import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, REGISTRY_CONTRACT_ID, RPC_URL, SIMULATION_SOURCE } from "./config.js";

const server = () => new rpc.Server(RPC_URL);

async function readContract(method: string, args: xdr.ScVal[]): Promise<unknown> {
  const s = server();
  const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(REGISTRY_CONTRACT_ID).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result) throw new Error(`${method} returned nothing`);
  return scValToNative(sim.result.retval);
}

export type Endpoint = {
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

const domainBytes = (domain: string) =>
  xdr.ScVal.scvBytes(Buffer.from(domain, "utf-8"));

export async function getEndpointByDomain(domain: string): Promise<Endpoint | null> {
  try {
    return (await readContract("get_endpoint", [domainBytes(domain)])) as Endpoint;
  } catch {
    return null;
  }
}

// Delegates the allow/deny decision to the contract itself rather than
// fetching the policy and matching it here — one rule, one place it lives.
export async function isPayerAllowed(domain: string, payer: string): Promise<boolean> {
  try {
    return (await readContract("is_payer_allowed", [
      domainBytes(domain),
      new Address(payer).toScVal(),
    ])) as boolean;
  } catch {
    // A read failure (bad address format, RPC hiccup) should not silently
    // open the gate — fail closed.
    return false;
  }
}

