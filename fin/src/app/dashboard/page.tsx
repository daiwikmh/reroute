"use client";

import { useState } from "react";
import { initWalletKit, useWallet } from "@/utils/wallet";
import TopNav from "@/components/dashboard/TopNav";
import RegisterEndpointForm from "@/components/dashboard/RegisterEndpointForm";
import DnsSetupPanel from "@/components/dashboard/DnsSetupPanel";
import CallLog from "@/components/dashboard/CallLog";

if (typeof window !== "undefined") {
  initWalletKit();
}

export default function Dashboard() {
  const [nav, setNav] = useState("Endpoints");
  const [registeredDomain, setRegisteredDomain] = useState<string | null>(null);
  const [callsDomain, setCallsDomain] = useState("");

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
          <div className="grid gap-4 lg:grid-cols-2">
            <RegisterEndpointForm
              address={address}
              isConnected={isConnected}
              isConnecting={isConnecting}
              onConnect={connectWallet}
              sign={signTransaction}
              onRegistered={(domain) => {
                setRegisteredDomain(domain);
                setCallsDomain(domain);
              }}
            />
            {registeredDomain ? (
              <DnsSetupPanel domain={registeredDomain} />
            ) : (
              <div className="flex h-full flex-col justify-center rounded-3xl border border-border bg-surface p-8">
                <span className="micro text-[0.625rem] uppercase text-cream-muted">
                  DNS setup
                </span>
                <p className="mt-3 text-sm text-cream-muted">
                  Register an endpoint and the exact DNS record to add shows up here,
                  with live verification once it's detected.
                </p>
              </div>
            )}
          </div>
        )}

        {nav === "Calls" && (
          <div>
            <label htmlFor="callsDomain" className="micro block text-[0.5625rem] uppercase text-cream-muted/60">
              Domain
            </label>
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
