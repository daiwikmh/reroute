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

type DomainStats = {
  domain: string;
  calls: number;
  revenue: Map<string, bigint>;
};

function currencyFor(asset: string) {
  return CURRENCIES.find((c) => c.address === asset);
}

function addRevenue(target: Map<string, bigint>, asset: string, amount: string) {
  target.set(asset, (target.get(asset) ?? 0n) + BigInt(amount));
}

function formatRevenue(revenue: Map<string, bigint>) {
  const parts = Array.from(revenue.entries()).map(([asset, amount]) => {
    const currency = currencyFor(asset);
    return `${currency ? formatUnits(amount, currency.decimals) : amount.toString()} ${currency?.code ?? ""}`.trim();
  });
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function Analytics({ domains }: { domains: string[] }) {
  const [stats, setStats] = useState<DomainStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (domains.length === 0) {
      setStats([]);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const results = await Promise.all(
          domains.map(async (domain): Promise<DomainStats> => {
            const res = await fetch(`${BACKEND_URL}/calls/${encodeURIComponent(domain)}`);
            const calls = (await res.json()) as CallRecord[];
            const revenue = new Map<string, bigint>();
            for (const call of calls) addRevenue(revenue, call.asset, call.amount);
            return { domain, calls: calls.length, revenue };
          }),
        );
        if (!cancelled) {
          setStats(results);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not reach the call log.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [domains]);

  const totalCalls = stats?.reduce((sum, s) => sum + s.calls, 0) ?? 0;
  const totalRevenue = new Map<string, bigint>();
  stats?.forEach((s) => s.revenue.forEach((amount, asset) => addRevenue(totalRevenue, asset, amount.toString())));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Analytics</h1>

      {error && <p className="mt-4 text-sm text-negative">{error}</p>}

      {!error && stats === null && <p className="mt-4 text-sm text-cream-muted">Loading…</p>}

      {!error && stats && domains.length === 0 && (
        <p className="mt-4 text-sm text-cream-muted">
          Register an endpoint to see revenue and call volume here.
        </p>
      )}

      {stats && domains.length > 0 && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-cream-muted">
                Total verified calls
              </span>
              <p className="mt-1 text-2xl text-cream">{totalCalls}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-cream-muted">
                Total collected
              </span>
              <p className="mt-1 text-2xl text-cream">{formatRevenue(totalRevenue)}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
            <table className="w-full min-w-[28rem] border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg">
                  {["Domain", "Calls", "Revenue"].map((h) => (
                    <th
                      key={h}
                      className="micro px-4 py-3 text-left text-[0.625rem] font-medium uppercase tracking-wide text-cream-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.domain} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm text-cream">{s.domain}</td>
                    <td className="px-4 py-3 text-sm text-cream-muted">{s.calls}</td>
                    <td className="px-4 py-3 text-sm text-cream-muted">{formatRevenue(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
