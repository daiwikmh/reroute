"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "@/utils/registry/client";
import { BACKEND_URL, CURRENCIES } from "@/utils/registry/config";

type CallRecord = {
  domain: string;
  payer: string;
  asset: string;
  amount: string;
  txHash?: string;
  at: number;
};

const POLL_MS = 6000;

function currencyFor(asset: string) {
  return CURRENCIES.find((c) => c.address === asset);
}

function short(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function CallLog({ domain }: { domain: string }) {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/calls/${encodeURIComponent(domain)}`);
        const body = (await res.json()) as CallRecord[];
        if (!cancelled) {
          setCalls(body);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not reach the call log.");
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [domain]);

  const total = calls?.reduce((sum, call) => {
    const currency = currencyFor(call.asset);
    return currency ? sum + Number(formatUnits(BigInt(call.amount), currency.decimals).replace(/,/g, "")) : sum;
  }, 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-cream-muted">
          Verified access log
        </span>
        {calls && calls.length > 0 && (
          <span className="micro rounded-full bg-accent-soft/40 px-2.5 py-1 text-[0.625rem] uppercase text-accent">
            {calls.length} verified request{calls.length === 1 ? "" : "s"}
            {total !== undefined && total > 0 && ` · ${total.toFixed(2)} collected`}
          </span>
        )}
      </div>

      {error && <p className="mt-4 text-[0.75rem] text-negative">{error}</p>}

      {!error && calls === null && (
        <p className="mt-4 text-[0.75rem] text-cream-muted">Loading…</p>
      )}

      {!error && calls && calls.length === 0 && (
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-cream-muted">
          No verified requests yet. Every agent that clears payment — even a $0
          verify-only endpoint — signs a real transaction and shows up here, whether
          or not you're charging for access.
        </p>
      )}

      {calls && calls.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[28rem] border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg">
                {["Payer", "Amount", "When", "Tx"].map((h) => (
                  <th
                    key={h}
                    className="micro px-3 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-wide text-cream-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const currency = currencyFor(call.asset);
                return (
                  <tr key={`${call.txHash}-${call.at}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 text-sm text-cream">{short(call.payer)}</td>
                    <td className="px-3 py-2.5 text-sm text-cream">
                      {currency ? formatUnits(BigInt(call.amount), currency.decimals) : call.amount}{" "}
                      {currency?.code ?? ""}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-cream-muted">
                      {new Date(call.at * 1000).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-cream-muted">
                      {call.txHash ? (
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${call.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          {short(call.txHash)}
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
