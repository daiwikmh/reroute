"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "@/utils/registry/client";
import { CURRENCIES } from "@/utils/registry/config";

type BrowseEntry = {
  domain: string;
  price: string;
  cur: string;
  asset: string;
  payto: string;
  uri: string;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const POLL_MS = 15000;

function currencyFor(asset: string) {
  return CURRENCIES.find((c) => c.address === asset);
}

function short(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function Browse() {
  const [entries, setEntries] = useState<BrowseEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/endpoints`);
        const body = (await res.json()) as BrowseEntry[];
        if (!cancelled) {
          setEntries(body);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not reach the DNS listing service.");
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const sorted = entries
    ? [...entries].sort((a, b) => {
        const da = currencyFor(a.asset)?.decimals ?? 7;
        const db = currencyFor(b.asset)?.decimals ?? 7;
        const na = Number(a.price) / 10 ** da;
        const nb = Number(b.price) / 10 ** db;
        return na - nb;
      })
    : null;

  return (
    <div className="tight min-h-screen w-full bg-bg text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[100rem] items-center gap-6 px-6 py-4 md:px-10">
          <Link href="/" className="shrink-0 leading-none text-cream">
            <span className="text-2xl">Reroute</span>
          </Link>
          <Link
            href="/dashboard"
            className="micro ml-auto border border-accent/60 px-4 py-2 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-ink"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
        <h1 className="text-2xl text-cream md:text-3xl">Browse endpoints</h1>
        <p className="mt-2 max-w-2xl text-sm text-cream-muted">
          Every price below was read from a DNS TXT lookup — no wallet, no account, and zero
          requests sent to any of these servers. This is what an agent sees before it decides
          which one to call.
        </p>

        {error && <p className="mt-6 text-sm text-negative">{error}</p>}

        {!error && sorted === null && <p className="mt-6 text-sm text-cream-muted">Resolving DNS…</p>}

        {!error && sorted && sorted.length === 0 && (
          <p className="mt-6 text-sm text-cream-muted">
            No active, DNS-verified endpoints yet. Register one from the dashboard, add the
            CNAME, and it shows up here once verified.
          </p>
        )}

        {sorted && sorted.length > 0 && (
          <>
            <p className="micro mt-6 text-[0.625rem] uppercase text-accent">
              {sorted.length} endpoint{sorted.length === 1 ? "" : "s"} · 0 requests sent
            </p>

            <div className="mt-4 overflow-x-auto rounded-3xl border border-border bg-surface">
              <table className="w-full min-w-[36rem] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Domain", "Price", "Asset", "Pay to", ""].map((h) => (
                      <th
                        key={h}
                        className="micro px-4 py-3 text-left text-[0.5625rem] uppercase font-normal text-cream-muted/60"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((entry) => {
                    const currency = currencyFor(entry.asset);
                    return (
                      <tr key={entry.domain} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 text-sm text-cream">
                          <a
                            href={`https://${entry.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-accent hover:underline"
                          >
                            {entry.domain}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-cream">
                          {currency ? formatUnits(BigInt(entry.price), currency.decimals) : entry.price}{" "}
                          {entry.cur}
                        </td>
                        <td className="px-4 py-3 text-sm text-cream-muted">{short(entry.asset)}</td>
                        <td className="px-4 py-3 text-sm text-cream-muted">{short(entry.payto)}</td>
                        <td className="px-4 py-3 text-sm">
                          <Link
                            href={`/pay?domain=${encodeURIComponent(entry.domain)}`}
                            className="micro border border-accent/60 px-3 py-1.5 text-[0.625rem] uppercase text-accent transition-colors hover:bg-accent hover:text-ink"
                          >
                            Pay
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
