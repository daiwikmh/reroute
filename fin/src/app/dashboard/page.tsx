"use client";

import { useEffect, useState } from "react";
import { initWalletKit, useWallet } from "@/utils/wallet";
import TopNav from "@/components/dashboard/TopNav";
import EndpointsList from "@/components/dashboard/EndpointsList";
import RegisterEndpointForm from "@/components/dashboard/RegisterEndpointForm";
import DnsSetupPanel from "@/components/dashboard/DnsSetupPanel";
import CallLog from "@/components/dashboard/CallLog";
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
                  <span className="micro text-[0.625rem] uppercase text-cream-muted">Endpoints</span>
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm((v) => !v)}
                    className="micro border border-accent/60 px-4 py-2 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-ink"
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
                      <div className="flex h-full flex-col justify-center rounded-3xl border border-border bg-surface p-8">
                        <span className="micro text-[0.625rem] uppercase text-cream-muted">DNS setup</span>
                        <p className="mt-3 text-sm text-cream-muted">
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

        {nav === "Calls" && (
          <div>
            <label htmlFor="callsDomain" className="micro block text-[0.5625rem] uppercase text-cream-muted/60">
              Domain
            </label>

            {ownedDomains.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ownedDomains.map((domain) => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setCallsDomain(domain)}
                    className={`micro border px-2.5 py-1 text-[0.625rem] ${
                      callsDomain === domain
                        ? "border-accent/60 bg-accent/10 text-accent"
                        : "border-border text-cream-muted hover:text-cream"
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
              className="mt-2 w-full max-w-md border border-border bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-accent/60"
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
      </main>
    </div>
  );
}
