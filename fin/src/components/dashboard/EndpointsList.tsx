"use client";

import { useEffect, useState } from "react";
import {
  describeError,
  formatUnits,
  listOwnerEndpoints,
  setActive,
  type Endpoint,
  type SignFn,
} from "@/utils/registry/client";
import { CURRENCIES } from "@/utils/registry/config";

type Props = {
  owner: string;
  sign: SignFn;
  refreshKey: number;
  onSelectDomain: (domain: string) => void;
};

function currencyFor(address: string) {
  return CURRENCIES.find((c) => c.address === address);
}

export default function EndpointsList({ owner, sign, refreshKey, onSelectDomain }: Props) {
  const [endpoints, setEndpoints] = useState<Endpoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyDomain, setBusyDomain] = useState<string | null>(null);

  const load = async () => {
    try {
      setEndpoints(await listOwnerEndpoints(owner));
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, refreshKey]);

  const toggle = async (endpoint: Endpoint) => {
    setBusyDomain(endpoint.domain);
    try {
      await setActive(owner, endpoint.domain, !endpoint.active, sign);
      await load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusyDomain(null);
    }
  };

  return (
    <div className="flex h-full flex-col border-t border-border bg-surface p-6">
      <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-accent">
        Your endpoints
      </span>

      {error && <p className="mt-4 text-[0.75rem] text-negative">{error}</p>}

      {!error && endpoints === null && <p className="mt-4 text-[0.75rem] text-cream-muted">Loading…</p>}

      {!error && endpoints && endpoints.length === 0 && (
        <p className="mt-4 text-[0.8125rem] text-cream-muted">
          You haven&apos;t registered an endpoint yet. Register one below to see it here.
        </p>
      )}

      {endpoints && endpoints.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {endpoints.map((endpoint) => {
            const currency = currencyFor(endpoint.referenceAsset);
            return (
              <div
                key={endpoint.domain}
                className="flex items-center justify-between gap-3 border border-border bg-bg px-4 py-3"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectDomain(endpoint.domain)}
                    className="truncate text-sm font-medium text-cream hover:text-accent hover:underline"
                  >
                    {endpoint.domain}
                  </button>
                  <p className="mt-0.5 text-[0.75rem] text-cream-muted">
                    {currency ? formatUnits(endpoint.referencePrice, currency.decimals) : endpoint.referencePrice.toString()}{" "}
                    {currency?.code ?? ""} per call
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`micro flex items-center gap-1.5 border border-border px-2.5 py-1 text-[0.625rem] uppercase ${
                      endpoint.active ? "text-positive" : "text-cream-muted/60"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${endpoint.active ? "bg-positive" : "bg-cream-muted/40"}`} />
                    {endpoint.active ? "Active" : "Paused"}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(endpoint)}
                    disabled={busyDomain === endpoint.domain}
                    className="micro shrink-0 border border-border px-3 py-1.5 text-[0.625rem] uppercase text-cream-muted transition-colors hover:border-accent/60 hover:text-accent disabled:opacity-50"
                  >
                    {busyDomain === endpoint.domain ? "…" : endpoint.active ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
