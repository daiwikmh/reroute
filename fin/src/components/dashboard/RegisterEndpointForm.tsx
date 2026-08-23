"use client";

import { useMemo, useState } from "react";
import {
  explainError,
  formatUnits,
  registerEndpoint,
  toBaseUnits,
  type Explained,
  type SignFn,
} from "@/utils/registry/client";
import { CURRENCIES, type Currency } from "@/utils/registry/config";

type Props = {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  sign: SignFn;
  onRegistered: (domain: string) => void;
};

const DEFAULT_FACILITATOR = "https://channels.openzeppelin.com/x402/testnet";

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
  "w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent-soft/60";

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
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Explained | null>(null);

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
      onRegistered(cleanDomain);
    } catch (err) {
      setProblem(explainError(err));
    } finally {
      setPending(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex h-full flex-col justify-center rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h2 className="text-2xl font-semibold leading-snug tracking-tight text-cream">
          Connect your wallet to register a paid endpoint
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-cream-muted">
          Any HTTP endpoint you own can start charging AI agents per call — no API
          keys, no Stripe, no subscriptions.
        </p>
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="micro mt-6 self-start rounded-lg bg-accent px-5 py-3 text-xs uppercase text-white shadow-sm transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {isConnecting ? "Connecting" : "Connect wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-cream-muted">
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
                className={`micro rounded-md border px-2.5 py-1.5 text-[0.6875rem] uppercase transition-colors ${
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
                className={`micro rounded-md border px-2.5 py-1.5 text-[0.6875rem] uppercase transition-colors ${
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
        <Field label="Facilitator URL" htmlFor="facilitator">
          <input
            id="facilitator"
            value={facilitatorUrl}
            onChange={(event) => setFacilitatorUrl(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <button
        onClick={submit}
        disabled={pending || !domain.trim() || !price.trim()}
        className="micro mt-5 rounded-lg bg-accent px-4 py-2.5 text-xs uppercase text-white shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
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
