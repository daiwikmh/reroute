"use client";

import { useEffect, useMemo, useState } from "react";
import {
  explainError,
  formatUnits,
  registerEndpoint,
  toBaseUnits,
  type Explained,
  type SignFn,
} from "@/utils/registry/client";
import { BACKEND_URL, CURRENCIES, type Currency } from "@/utils/registry/config";

type PayoutCountry = { country: string; name: string; currency: string };

type Props = {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  sign: SignFn;
  onRegistered: (domain: string) => void;
};

const DEFAULT_FACILITATOR = "https://channels.openzeppelin.com/x402";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="micro block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full border border-border bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent";

export default function RegisterEndpointForm({
  address,
  isConnected,
  isConnecting,
  onConnect,
  sign,
  onRegistered,
}: Props) {
  const [domain, setDomain] = useState("");
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
  const [price, setPrice] = useState("");
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [facilitatorUrl, setFacilitatorUrl] = useState(DEFAULT_FACILITATOR);
  const [payoutCountries, setPayoutCountries] = useState<PayoutCountry[]>([]);
  const [payoutCountry, setPayoutCountry] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Explained | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/offramp/countries`)
      .then((res) => res.json())
      .then((body: PayoutCountry[]) => setPayoutCountries(body))
      .catch(() => setPayoutCountries([]));
  }, []);

  const acceptable = useMemo(
    () => CURRENCIES.filter((c) => c.reflectorTracked && c.code !== currency.code),
    [currency],
  );

  const toggleAccepted = (code: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const submit = async () => {
    if (!address) return;
    setProblem(null);

    const cleanDomain = domain.trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleanDomain)) {
      setProblem({ message: "Enter a domain like api.yourcompany.com.", severity: "notice" });
      return;
    }

    let units: bigint;
    try {
      units = toBaseUnits(price, currency.decimals);
    } catch (err) {
      setProblem({ message: err instanceof Error ? err.message : String(err), severity: "notice" });
      return;
    }

    setPending(true);
    try {
      const acceptedAddresses = CURRENCIES.filter((c) => accepted.has(c.code)).map(
        (c) => c.address,
      );
      await registerEndpoint(
        address,
        cleanDomain,
        address,
        currency.address,
        units,
        acceptedAddresses,
        facilitatorUrl.trim() || DEFAULT_FACILITATOR,
        sign,
      );
      await fetch(`${BACKEND_URL}/offramp/${encodeURIComponent(cleanDomain)}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: payoutCountry }),
      }).catch(() => {});
      onRegistered(cleanDomain);
    } catch (err) {
      setProblem(explainError(err));
    } finally {
      setPending(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex h-full flex-col justify-center border-t border-border bg-surface p-8">
        <h2 className="hero-display text-2xl font-normal leading-snug tracking-tight text-cream">
          Connect your wallet to register a paid endpoint
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-cream-muted">
          Any HTTP endpoint you own can start charging AI agents per call — no API
          keys, no Stripe, no subscriptions.
        </p>
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="micro mt-6 self-start bg-accent px-5 py-3 text-xs font-semibold uppercase text-black transition-colors hover:bg-white disabled:opacity-50"
        >
          {isConnecting ? "Connecting" : "Connect wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-t border-border bg-surface p-6">
      <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-accent">
        Register an endpoint
      </span>

      <div className="mt-5">
        <Field label="Domain" htmlFor="domain">
          <input
            id="domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="api.yourcompany.com"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Price per call" htmlFor="price">
          <input
            id="price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder="0.05"
            className={inputClass}
          />
        </Field>
        <div>
          <span className="micro block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">
            Currency
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCurrency(c);
                  setAccepted((prev) => {
                    const next = new Set(prev);
                    next.delete(c.code);
                    return next;
                  });
                }}
                title={c.name}
                className={`micro border px-2.5 py-1.5 text-[0.6875rem] uppercase transition-colors ${
                  currency.code === c.code
                    ? "border-accent bg-accent-soft/40 text-accent"
                    : "border-border text-cream-muted hover:border-cream-muted/60 hover:text-cream"
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!currency.reflectorTracked && (
        <p className="mt-3 text-[0.75rem] leading-relaxed text-cream-muted">
          {currency.name} has no live price feed, so this endpoint can only be paid in{" "}
          {currency.code} — accepting other currencies needs a manual rate, set after
          registering.
        </p>
      )}

      {currency.reflectorTracked && acceptable.length > 0 && (
        <div className="mt-4">
          <span className="micro block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">
            Also accept (converted automatically at call time)
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {acceptable.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleAccepted(c.code)}
                className={`micro border px-2.5 py-1.5 text-[0.6875rem] uppercase transition-colors ${
                  accepted.has(c.code)
                    ? "border-accent bg-accent-soft/40 text-accent"
                    : "border-border text-cream-muted hover:border-cream-muted/60 hover:text-cream"
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Field label="Payout country" htmlFor="payoutCountry">
          <select
            id="payoutCountry"
            value={payoutCountry}
            onChange={(event) => setPayoutCountry(event.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a country
            </option>
            {payoutCountries.map((c) => (
              <option key={c.country} value={c.country}>
                {c.name} ({c.currency})
              </option>
            ))}
          </select>
        </Field>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-cream-muted">
          Where you'll cash out via MoneyGram — earnings convert to this currency at the
          live exchange rate. Change it any time from Payouts.
        </p>
      </div>

      <div className="mt-4">
        <Field label="Facilitator URL" htmlFor="facilitator">
          <input
            id="facilitator"
            value={facilitatorUrl}
            onChange={(event) => setFacilitatorUrl(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {address && (
        <p className="mt-5 border border-border bg-bg px-4 py-3 text-[0.75rem] text-cream-muted">
          Payments go straight to your connected wallet,{" "}
          <span className="text-cream" title={address}>
            {`${address.slice(0, 4)}…${address.slice(-4)}`}
          </span>
          . Reroute never holds your funds.
        </p>
      )}

      <button
        onClick={submit}
        disabled={pending || !domain.trim() || !price.trim() || !payoutCountry}
        className="micro mt-5 bg-accent px-4 py-2.5 text-xs font-semibold uppercase text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Registering…" : "Register endpoint"}
      </button>

      {price && !Number.isNaN(Number(price)) && (
        <p className="mt-3 text-[0.75rem] text-cream-muted">
          Agents will pay {price} {currency.code}
          {" "}({formatUnits(toSafeUnits(price, currency.decimals), currency.decimals)}{" "}
          base units) per call.
        </p>
      )}

      {problem && (
        <p
          className={`mt-3 text-[0.75rem] ${
            problem.severity === "failure" ? "text-negative" : "text-cream-muted"
          }`}
        >
          {problem.message}
        </p>
      )}
    </div>
  );
}

function toSafeUnits(value: string, decimals: number): bigint {
  try {
    return toBaseUnits(value, decimals);
  } catch {
    return 0n;
  }
}
