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
  country?: string;
  agent?: string;
  offRampCountry?: string;
};

type DomainStats = {
  domain: string;
  calls: number;
  revenue: Map<string, bigint>;
};

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

function countryLabel(code: string) {
  if (code === "T1") return "Tor";
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

function agentLabel(agent: string) {
  return agent.length > 40 ? `${agent.slice(0, 40)}…` : agent;
}

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

function countBy(calls: CallRecord[], key: "country" | "agent" | "offRampCountry") {
  const counts = new Map<string, number>();
  for (const call of calls) {
    const raw = call[key];
    const label = raw ?? "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

function BreakdownList({
  title,
  rows,
  total,
  formatLabel,
}: {
  title: string;
  rows: [string, number][];
  total: number;
  formatLabel?: (label: string) => string;
}) {
  return (
    <div className="border-t border-border bg-surface p-6">
      <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-accent">{title}</span>
      <div className="mt-4 space-y-3">
        {rows.map(([label, count]) => (
          <div key={label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-cream" title={label}>
                {formatLabel ? formatLabel(label) : label}
              </span>
              <span className="text-cream-muted">{count}</span>
            </div>
            <div className="mt-1 h-1 w-full bg-bg">
              <div
                className="h-1 bg-accent"
                style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics({ domains }: { domains: string[] }) {
  const [stats, setStats] = useState<DomainStats[] | null>(null);
  const [allCalls, setAllCalls] = useState<CallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (domains.length === 0) {
      setStats([]);
      setAllCalls([]);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const results = await Promise.all(
          domains.map(async (domain): Promise<{ domain: string; calls: CallRecord[] }> => {
            const res = await fetch(`${BACKEND_URL}/calls/${encodeURIComponent(domain)}`);
            const calls = (await res.json()) as CallRecord[];
            return { domain, calls };
          }),
        );
        if (!cancelled) {
          setStats(
            results.map(({ domain, calls }) => {
              const revenue = new Map<string, bigint>();
              for (const call of calls) addRevenue(revenue, call.asset, call.amount);
              return { domain, calls: calls.length, revenue };
            }),
          );
          setAllCalls(results.flatMap((r) => r.calls));
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

  const byCountry = countBy(allCalls, "country");
  const byAgent = countBy(allCalls, "agent");
  const byOffRampCountry = countBy(
    allCalls.filter((c) => c.offRampCountry),
    "offRampCountry",
  );

  return (
    <div>
      <h1 className="hero-display text-2xl font-normal tracking-tight text-ink md:text-3xl">Analytics</h1>

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
            <div className="border-t border-border bg-surface p-6">
              <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-accent">
                Total verified calls
              </span>
              <p className="hero-display mt-1 text-2xl text-cream">{totalCalls}</p>
            </div>
            <div className="border-t border-border bg-surface p-6">
              <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-accent">
                Total collected
              </span>
              <p className="hero-display mt-1 text-2xl text-cream">{formatRevenue(totalRevenue)}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto border border-border bg-surface">
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

          {allCalls.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <BreakdownList title="Calls by country" rows={byCountry} total={allCalls.length} formatLabel={countryLabel} />
              <BreakdownList title="Calls by agent" rows={byAgent} total={allCalls.length} formatLabel={agentLabel} />
            </div>
          )}

          {byOffRampCountry.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <BreakdownList
                title="Off-ramp by country"
                rows={byOffRampCountry}
                total={byOffRampCountry.reduce((sum, [, count]) => sum + count, 0)}
                formatLabel={countryLabel}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
