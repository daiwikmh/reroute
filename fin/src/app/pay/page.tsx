"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/utils/wallet/hooks";
import { formatUnits } from "@/utils/registry/client";
import { CURRENCIES, BACKEND_URL } from "@/utils/registry/config";
import { payAndCall, readQuote, type PayOutcome, type Quote } from "@/utils/x402/payClient";

function currencyFor(address: string) {
  return CURRENCIES.find((c) => c.address === address);
}

function short(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function PayDomain() {
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain") ?? "";
  const url = `${BACKEND_URL}/pay/${encodeURIComponent(domain)}`;

  const { address, isConnected, isConnecting, connectWallet, signAuthEntry, formatAddress } = useWallet();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<PayOutcome | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!domain) return;
    let cancelled = false;
    readQuote(url).then((q) => {
      if (!cancelled) setQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [url, domain]);

  const currency = quote && quote.ok ? currencyFor(quote.asset) : undefined;

  const pay = async () => {
    if (!address) return;
    setPaying(true);
    setPayError(null);
    setResult(null);
    try {
      const outcome = await payAndCall(url, address, signAuthEntry);
      setResult(outcome);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : String(err));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="tight min-h-screen w-full bg-bg text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[100rem] items-center gap-6 px-6 py-4 md:px-10">
          <Link href="/" className="shrink-0 leading-none text-cream">
            <span className="text-2xl">Reroute</span>
          </Link>
          <Link
            href="/browse"
            className="micro ml-auto border border-accent/60 px-4 py-2 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-ink"
          >
            Browse
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[36rem] px-6 py-10 md:px-10">
        <h1 className="text-2xl text-cream md:text-3xl">{domain || "No domain specified"}</h1>
        <p className="mt-2 text-sm text-cream-muted">
          Pay for one call to this endpoint. Your wallet signs a real Stellar payment — this
          settles on chain, it isn&apos;t a simulation.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {!domain && (
            <p className="text-sm text-negative">
              No domain given — open this page from Browse or as /pay?domain=example.com.
            </p>
          )}

          {domain && quote === null && <p className="text-sm text-cream-muted">Reading price…</p>}

          {quote && !quote.ok && <p className="text-sm text-negative">{quote.message}</p>}

          {quote && quote.ok && (
            <>
              <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-cream-muted">
                Price per call
              </span>
              <p className="mt-1 text-2xl text-cream">
                {currency ? formatUnits(BigInt(quote.amount), currency.decimals) : quote.amount}{" "}
                {currency?.code ?? short(quote.asset)}
              </p>
              <p className="mt-3 text-[0.75rem] text-cream-muted">Pays out to {short(quote.payTo)}</p>
            </>
          )}

          <div className="mt-6 border-t border-border pt-6">
            {!isConnected ? (
              <button
                type="button"
                onClick={connectWallet}
                disabled={isConnecting}
                className="micro w-full rounded-xl bg-accent px-4 py-3 text-xs uppercase text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            ) : (
              <>
                <p className="text-[0.75rem] text-cream-muted">
                  Paying as <span className="text-cream">{formatAddress(address ?? "")}</span>
                </p>
                <button
                  type="button"
                  onClick={pay}
                  disabled={paying || !quote?.ok}
                  className="micro mt-3 w-full rounded-xl bg-accent px-4 py-3 text-xs uppercase text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {paying ? "Paying…" : "Pay and call"}
                </button>
              </>
            )}
          </div>

          {payError && <p className="mt-4 text-sm text-negative">{payError}</p>}

          {result && (
            <div className="mt-4 rounded-xl border border-border bg-bg p-4">
              <p
                className={`micro text-[0.6875rem] uppercase ${
                  result.paymentStatus === "settled" ? "text-positive" : "text-negative"
                }`}
              >
                {result.paymentStatus} · HTTP {result.status}
              </p>
              {result.transaction && (
                <p className="mt-2 break-all text-[0.75rem] text-cream-muted">
                  tx {result.transaction}
                </p>
              )}
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[0.75rem] text-cream-muted">
                {typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Pay() {
  return (
    <Suspense fallback={null}>
      <PayDomain />
    </Suspense>
  );
}
