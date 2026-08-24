export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.sorobanrpc.com";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Public Global Stellar Network ; September 2015";
export const REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? "CALTXNYPEFU24UUSYJMHZCTE44ASRNXZ3FOHTIEDKWVQJSZFVZKMVG5D";

export const SIMULATION_SOURCE =
  process.env.NEXT_PUBLIC_SIMULATION_SOURCE ?? "GD4YDGESVMWKAXYO3SXWE7H45SHHZC66DE33KBJXI5VY6Q27NKVOTTNQ";

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
   * conversion. Mainnet is initialized against Reflector's address-based
   * Stellar-DEX oracle (CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M),
   * which matches what the contract's get_price actually calls
   * (Asset::Stellar(address)) — testnet was very likely pointed at the
   * wrong (symbol-based) Reflector oracle, which is why conversion never
   * worked there. Kept false here regardless: this specific oracle wiring
   * has not yet been exercised with a real conversion call, so every
   * endpoint should still be treated as reference-asset-only until that's
   * verified live. */
  reflectorTracked: boolean;
};

export const CURRENCIES: Currency[] = [
  {
    code: "USDC",
    name: "USD Coin",
    address: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    decimals: 7,
    reflectorTracked: false,
  },
  {
    code: "XLM",
    name: "Stellar Lumens",
    address: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
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
