export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const REGISTRY_CONTRACT_ID =
  "CCLAFEUKE42FBXJATTADK4XNDUZNEGJERYWQWAI5INIGN3D63SB2RBC6";

export const SIMULATION_SOURCE =
  "GC6XYRAGBDI3LNX52D27S5S5JTMFAYESVBFL3JX6M7KAMNQACF5CI6ML";

// Where the backend's DNS-hosting API lives (record generation + live
// CNAME/TXT verification for the setup panel).
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";

// The zone our own DNS service answers TXT lookups from, once a seller's
// CNAME points at it. Kept as a constant here (not derived) because the
// frontend needs to render the exact record value before any backend round
// trip — see DnsSetupPanel.
export const AGENTS_ZONE = "agents.neurus.xyz";

export type Currency = {
  code: string;
  name: string;
  address: string;
  decimals: number;
  /** Whether Reflector can price this asset against another for automatic
   * conversion. Confirmed false for everything here: Reflector's CEX/DEX
   * aggregate feed only prices assets by symbol (Other("USDC")), never by
   * Stellar contract address — a live lastprice({Stellar: <addr>}) call
   * returns null for every asset below. The registry contract's get_price
   * conversion path currently calls Reflector with Asset::Stellar(address),
   * so it can never find a match — this needs a contract-level fix (map
   * address -> Reflector symbol) before any "accepted asset" beyond the
   * reference asset itself can actually settle. Until then, every endpoint
   * effectively takes payment in its reference asset only. */
  reflectorTracked: boolean;
};

export const CURRENCIES: Currency[] = [
  {
    code: "USDC",
    name: "USD Coin",
    address: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    decimals: 7,
    reflectorTracked: false,
  },
  {
    code: "XLM",
    name: "Stellar Lumens",
    address: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    decimals: 7,
    reflectorTracked: false,
  },
  {
    code: "cBRL",
    name: "Brazilian Real (testnet demo)",
    address: "CDXIABSD6U6T2AZYV3KGORQKYPXV3M3ZLQ7DBARZSNJLWAYUYT2QFTKO",
    decimals: 7,
    reflectorTracked: false,
  },
  {
    code: "cNGN",
    name: "Nigerian Naira (testnet demo)",
    address: "CDABYX6VDPSQJEQXNTUEEWV6PRWR3PG43OQYC3ZKGRV52X576KLFPJWE",
    decimals: 7,
    reflectorTracked: false,
  },
];

export const CONTRACT_ERRORS: Record<number, string> = {
  1: "The registry has not been initialized yet.",
  2: "The registry is already initialized.",
  3: "That domain is already registered.",
  4: "No endpoint is registered for that domain.",
  5: "You don't own that endpoint.",
  6: "Enter a price greater than zero.",
  7: "That currency isn't accepted by this endpoint.",
  8: "No live price is available for that currency.",
};
