import { CURRENCY_CODES } from "../dns/config.js";
import {
  addWithdrawn,
  appendOffRampReceipt,
  callsForDomain,
  getOffRampConfig,
  getOffRampHistory,
  getWithdrawn,
  setOffRampConfig,
  type OffRampConfig,
  type OffRampReceipt,
} from "../store.js";
import { OFFRAMP_COUNTRIES } from "./countries.js";
import { fetchRate } from "./rates.js";

// MoneyGram only ever settles USDC on Stellar — a seller's cash-out balance
// is the USDC this domain has actually collected, independent of whatever
// other assets it also accepts.
const USDC_DECIMALS = 7;

function isUsdc(asset: string) {
  return CURRENCY_CODES[asset] === "USDC";
}

async function usdcCollected(kv: KVNamespace, domain: string): Promise<bigint> {
  const calls = await callsForDomain(kv, domain);
  return calls.filter((c) => isUsdc(c.asset)).reduce((sum, c) => sum + BigInt(c.amount), 0n);
}

function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `MG-${code}`;
}

export type OffRampSummary = {
  config: OffRampConfig | null;
  availableUsdc: string;
  quote: { currency: string; rate: number; localAmount: number } | null;
  history: OffRampReceipt[];
};

export async function getOffRampSummary(kv: KVNamespace, domain: string): Promise<OffRampSummary> {
  const [config, collected, withdrawn, history] = await Promise.all([
    getOffRampConfig(kv, domain),
    usdcCollected(kv, domain),
    getWithdrawn(kv, domain),
    getOffRampHistory(kv, domain),
  ]);
  const available = collected > withdrawn ? collected - withdrawn : 0n;

  if (!config) {
    return { config: null, availableUsdc: available.toString(), quote: null, history };
  }

  const rate = await fetchRate(kv, config.currency);
  const localAmount = (Number(available) / 10 ** USDC_DECIMALS) * rate;
  return { config, availableUsdc: available.toString(), quote: { currency: config.currency, rate, localAmount }, history };
}

export async function configureOffRamp(kv: KVNamespace, domain: string, country: string): Promise<OffRampConfig> {
  const entry = OFFRAMP_COUNTRIES.find((c) => c.country === country);
  if (!entry) throw new Error("Unsupported payout country.");
  const config: OffRampConfig = { country: entry.country, currency: entry.currency };
  await setOffRampConfig(kv, domain, config);
  return config;
}

export async function withdraw(kv: KVNamespace, domain: string): Promise<OffRampReceipt> {
  const config = await getOffRampConfig(kv, domain);
  if (!config) throw new Error("Pick a payout country before cashing out.");

  const [collected, withdrawn] = await Promise.all([usdcCollected(kv, domain), getWithdrawn(kv, domain)]);
  const available = collected > withdrawn ? collected - withdrawn : 0n;
  if (available <= 0n) throw new Error("Nothing available to cash out yet.");

  const rate = await fetchRate(kv, config.currency);
  const localAmount = (Number(available) / 10 ** USDC_DECIMALS) * rate;

  const receipt: OffRampReceipt = {
    reference: generateReference(),
    usdcAmount: available.toString(),
    currency: config.currency,
    localAmount,
    rate,
    at: Math.floor(Date.now() / 1000),
  };

  await addWithdrawn(kv, domain, available);
  await appendOffRampReceipt(kv, domain, receipt);
  return receipt;
}
