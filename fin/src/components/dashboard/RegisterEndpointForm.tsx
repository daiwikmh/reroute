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
      <div className="flex h-full flex-col justify-center rounded-3xl border border-border bg-surface p-8">
        <h2 className="text-2xl leading-snug text-cream">
          Connect your wallet to register a paid endpoint
        </h2>
        <p className="mt-3 text-sm text-cream-muted">
          Any HTTP endpoint you own can start charging AI agents per call — no API
          keys, no Stripe, no subscriptions.
        </p>
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="micro mt-6 self-start border border-accent/60 px-5 py-3 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-ink disabled:opacity-50"
        >
          {isConnecting ? "Connecting" : "Connect wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-border bg-surface p-6">
      <span className="micro text-[0.625rem] uppercase text-cream-muted">
        Register an endpoint
      </span>

      <label htmlFor="domain" className="micro mt-5 block text-[0.5625rem] uppercase text-cream-muted/60">
        Domain
      </label>
      <input
        id="domain"
        value={domain}
        onChange={(event) => setDomain(event.target.value)}
        placeholder="api.yourcompany.com"
        className="mt-2 w-full border border-border bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-accent/60"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="price" className="micro block text-[0.5625rem] uppercase text-cream-muted/60">
            Price per call
          </label>
          <input
            id="price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder="0.05"
            className="mt-2 w-full border border-border bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-accent/60"
          />
        </div>
        <div>
          <span className="micro block text-[0.5625rem] uppercase text-cream-muted/60">
            Currency
          </span>
          <div className="mt-2 flex flex-wrap gap-1">
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
                className={`micro border px-2.5 py-1 text-[0.625rem] uppercase ${
                  currency.code === c.code
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-border text-cream-muted hover:text-cream"
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!currency.reflectorTracked && (
        <p className="mt-3 text-[0.6875rem] text-cream-muted">
          {currency.name} has no live price feed, so this endpoint can only be paid in{" "}
          {currency.code} — accepting other currencies needs a manual rate, set after
          registering.
        </p>
      )}

      {currency.reflectorTracked && acceptable.length > 0 && (
        <div className="mt-4">
          <span className="micro block text-[0.5625rem] uppercase text-cream-muted/60">
            Also accept (converted automatically at call time)
          </span>
          <div className="mt-2 flex flex-wrap gap-1">
            {acceptable.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleAccepted(c.code)}
                className={`micro border px-2.5 py-1 text-[0.625rem] uppercase ${
                  accepted.has(c.code)
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-border text-cream-muted hover:text-cream"
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="facilitator" className="micro block text-[0.5625rem] uppercase text-cream-muted/60">
          Facilitator URL
        </label>
        <input
          id="facilitator"
          value={facilitatorUrl}
          onChange={(event) => setFacilitatorUrl(event.target.value)}
          className="mt-2 w-full border border-border bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-accent/60"
        />
      </div>

      <button
        onClick={submit}
        disabled={pending || !domain.trim() || !price.trim()}
        className="micro mt-5 border border-accent/60 px-4 py-2.5 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Registering…" : "Register endpoint"}
      </button>

      {price && !Number.isNaN(Number(price)) && (
        <p className="mt-3 text-[0.6875rem] text-cream-muted">
          Agents will pay {price} {currency.code}
          {" "}({formatUnits(toSafeUnits(price, currency.decimals), currency.decimals)}{" "}
          base units) per call.
        </p>
      )}

      {problem && (
        <p
          className={`mt-3 text-[0.6875rem] ${
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
