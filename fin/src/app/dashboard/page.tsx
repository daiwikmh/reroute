"use client";

import { useEffect, useState } from "react";
import { initWalletKit, useWallet } from "@/utils/wallet";
import TopNav from "@/components/dashboard/TopNav";
import EndpointsList from "@/components/dashboard/EndpointsList";
import RegisterEndpointForm from "@/components/dashboard/RegisterEndpointForm";
import DnsSetupPanel from "@/components/dashboard/DnsSetupPanel";
import CallLog from "@/components/dashboard/CallLog";
import Analytics from "@/components/dashboard/Analytics";
import MoneyGramPanel from "@/components/dashboard/MoneyGramPanel";
import { listOwnerEndpoints } from "@/utils/registry/client";

if (typeof window !== "undefined") {
  initWalletKit();
}

export default function Dashboard() {
  const [nav, setNav] = useState("Endpoints");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registeredDomain, setRegisteredDomain] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [callsDomain, setCallsDomain] = useState("");
  const [payoutsDomain, setPayoutsDomain] = useState("");
  const [ownedDomains, setOwnedDomains] = useState<string[]>([]);

  const {
    address,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    formatAddress,
    network,
    signTransaction,
  } = useWallet();

  useEffect(() => {
    if (!address) {
      setOwnedDomains([]);
      return;
    }
    listOwnerEndpoints(address)
      .then((endpoints) => setOwnedDomains(endpoints.map((e) => e.domain)))
      .catch(() => setOwnedDomains([]));
  }, [address, refreshKey]);

  const selectDomain = (domain: string) => {
    setCallsDomain(domain);
    setNav("Calls");
  };

  return (
    <div className="tight min-h-screen w-full bg-bg text-ink">
      <TopNav
        active={nav}
        onSelect={setNav}
        network={network}
        isConnected={isConnected}
        isConnecting={isConnecting}
        label={address ? formatAddress(address) : ""}
        onConnect={isConnected ? disconnectWallet : connectWallet}
      />

      <main className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
        {nav === "Endpoints" && (
          <div className="flex flex-col gap-4">
            {isConnected && address ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h1 className="hero-display text-2xl font-normal tracking-tight text-ink md:text-3xl">Endpoints</h1>
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm((v) => !v)}
                    className="micro border border-accent/60 px-4 py-2 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-black"
                  >
                    {showRegisterForm ? "Close" : "Register new endpoint"}
                  </button>
                </div>

                <EndpointsList
                  owner={address}
                  sign={signTransaction}
                  refreshKey={refreshKey}
                  onSelectDomain={selectDomain}
                />

                {showRegisterForm && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <RegisterEndpointForm
                      address={address}
                      isConnected={isConnected}
                      isConnecting={isConnecting}
                      onConnect={connectWallet}
                      sign={signTransaction}
                      onRegistered={(domain) => {
                        setRegisteredDomain(domain);
                        setRefreshKey((k) => k + 1);
                      }}
                    />
                    {registeredDomain ? (
                      <DnsSetupPanel domain={registeredDomain} />
                    ) : (
                      <div className="flex h-full flex-col justify-center border-t border-border bg-surface p-8">
                        <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-accent">
                          DNS setup
                        </span>
                        <p className="mt-3 text-sm leading-relaxed text-cream-muted">
                          Register an endpoint and the exact DNS record to add shows up here, with live
                          verification once it&apos;s detected.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <RegisterEndpointForm
                address={address}
                isConnected={isConnected}
                isConnecting={isConnecting}
                onConnect={connectWallet}
                sign={signTransaction}
                onRegistered={(domain) => {
                  setRegisteredDomain(domain);
                  setShowRegisterForm(true);
                  setRefreshKey((k) => k + 1);
                }}
              />
            )}
          </div>
        )}

        {nav === "Analytics" && <Analytics domains={ownedDomains} />}

        {nav === "Calls" && (
          <div>
            <h1 className="hero-display text-2xl font-normal tracking-tight text-ink md:text-3xl">Calls</h1>

            <label htmlFor="callsDomain" className="micro mt-5 block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">
              Domain
            </label>

            {ownedDomains.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ownedDomains.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setCallsDomain(domain)}
                    className={`micro border px-2.5 py-1.5 text-[0.6875rem] transition-colors ${
                      callsDomain === domain
                        ? "border-accent bg-accent-soft/40 text-accent"
                        : "border-border text-cream-muted hover:border-cream-muted/60 hover:text-cream"
                    }`}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            )}

            <input
              id="callsDomain"
              value={callsDomain}
              onChange={(event) => setCallsDomain(event.target.value.trim().toLowerCase())}
              placeholder="api.yourcompany.com"
              className="mt-2 w-full max-w-md border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
            />
            <div className="mt-4">
              {callsDomain ? (
                <CallLog domain={callsDomain} />
              ) : (
                <p className="text-sm text-cream-muted">Enter a registered domain to see its calls.</p>
              )}
            </div>
          </div>
        )}

        {nav === "Payouts" && (
          <div>
            <h1 className="hero-display text-2xl font-normal tracking-tight text-ink md:text-3xl">Payouts</h1>

            <label htmlFor="payoutsDomain" className="micro mt-5 block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">
              Domain
            </label>

            {ownedDomains.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ownedDomains.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setPayoutsDomain(domain)}
                    className={`micro border px-2.5 py-1.5 text-[0.6875rem] transition-colors ${
                      payoutsDomain === domain
                        ? "border-accent bg-accent-soft/40 text-accent"
                        : "border-border text-cream-muted hover:border-cream-muted/60 hover:text-cream"
                    }`}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            )}

            <input
              id="payoutsDomain"
              value={payoutsDomain}
              onChange={(event) => setPayoutsDomain(event.target.value.trim().toLowerCase())}
              placeholder="api.yourcompany.com"
              className="mt-2 w-full max-w-md border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
            />
            <div className="mt-4 max-w-xl">
              {payoutsDomain ? (
                <MoneyGramPanel domain={payoutsDomain} />
              ) : (
                <p className="text-sm text-cream-muted">Enter a registered domain to cash out what it's collected.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
