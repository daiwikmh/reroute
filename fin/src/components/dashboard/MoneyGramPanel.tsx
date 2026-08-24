"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "@/utils/registry/client";
import { BACKEND_URL } from "@/utils/registry/config";

type Country = { country: string; name: string; currency: string };

type OffRampReceipt = {
  reference: string;
  usdcAmount: string;
  currency: string;
  localAmount: number;
  rate: number;
  at: number;
};

type OffRampSummary = {
  config: { country: string; currency: string } | null;
  availableUsdc: string;
  quote: { currency: string; rate: number; localAmount: number } | null;
  history: OffRampReceipt[];
};

const USDC_DECIMALS = 7;

function formatLocal(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function MoneyGramPanel({ domain }: { domain: string }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [summary, setSummary] = useState<OffRampSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<OffRampReceipt | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/offramp/countries`)
      .then((res) => res.json())
      .then((body: Country[]) => setCountries(body))
      .catch(() => setCountries([]));
  }, []);

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/offramp/${encodeURIComponent(domain)}`);
      setSummary((await res.json()) as OffRampSummary);
      setError(null);
    } catch {
      setError("Could not reach the payout service.");
    }
  };

  useEffect(() => {
    setSummary(null);
    setLastReceipt(null);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const setCountry = async (country: string) => {
    if (!country) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/offramp/${encodeURIComponent(domain)}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed to set payout country.");
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set payout country.");
    } finally {
      setSaving(false);
    }
  };

  const cashOut = async () => {
    setCashingOut(true);
    try {
      const res = await fetch(`${BACKEND_URL}/offramp/${encodeURIComponent(domain)}/withdraw`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Cash-out failed.");
      setLastReceipt(body as OffRampReceipt);
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cash-out failed.");
    } finally {
      setCashingOut(false);
    }
  };

  const availableLabel = summary ? `${formatUnits(BigInt(summary.availableUsdc), USDC_DECIMALS)} USDC` : "…";

  return (
    <div className="flex h-full flex-col border-t border-border bg-surface p-6">
      <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-accent">
        MoneyGram cash-out
      </span>
      <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-cream-muted">
        Send the USDC this endpoint has collected to a MoneyGram payout in your local currency,
        converted at the live exchange rate.
      </p>

      {error && <p className="mt-4 text-[0.75rem] text-negative">{error}</p>}

      <div className="mt-5">
        <span className="micro block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">
          Payout country
        </span>
        <select
          value={summary?.config?.country ?? ""}
          onChange={(e) => setCountry(e.target.value)}
          disabled={saving || countries.length === 0}
          className="mt-1.5 w-full border border-border bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent disabled:opacity-50"
        >
          <option value="" disabled>
            Select a country
          </option>
          {countries.map((c) => (
            <option key={c.country} value={c.country}>
              {c.name} ({c.currency})
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="border border-border bg-bg px-4 py-3">
          <span className="micro block text-[0.625rem] uppercase text-cream-muted">Available to cash out</span>
          <p className="mt-1 text-lg text-cream">{availableLabel}</p>
        </div>
        <div className="border border-border bg-bg px-4 py-3">
          <span className="micro block text-[0.625rem] uppercase text-cream-muted">In local currency</span>
          <p className="mt-1 text-lg text-cream">
            {summary?.quote ? formatLocal(summary.quote.localAmount, summary.quote.currency) : "—"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={cashOut}
        disabled={cashingOut || !summary?.config || summary.availableUsdc === "0"}
        className="micro mt-4 w-full border border-accent/60 px-4 py-2.5 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {cashingOut ? "Sending…" : "Cash out via MoneyGram"}
      </button>

      {lastReceipt && (
        <div className="mt-4 border border-accent/40 bg-accent-soft/10 p-4">
          <span className="micro text-[0.625rem] uppercase text-accent">Cash-out sent</span>
          <p className="mt-1 text-sm text-cream">
            Reference <span className="font-medium">{lastReceipt.reference}</span> ·{" "}
            {formatLocal(lastReceipt.localAmount, lastReceipt.currency)} at rate {lastReceipt.rate.toFixed(4)}
          </p>
        </div>
      )}

      {summary && summary.history.length > 0 && (
        <div className="mt-5">
          <span className="micro block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">
            Payout history
          </span>
          <div className="mt-2 flex flex-col gap-1.5">
            {summary.history.map((r) => (
              <div
                key={r.reference}
                className="flex items-center justify-between gap-3 border border-border bg-bg px-3 py-2 text-[0.75rem]"
              >
                <span className="text-cream-muted">{r.reference}</span>
                <span className="text-cream">{formatLocal(r.localAmount, r.currency)}</span>
                <span className="text-cream-muted">{new Date(r.at * 1000).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
