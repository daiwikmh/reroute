"use client";

import Link from "next/link";

const NAV = ["Endpoints", "DNS Setup", "Calls", "Analytics", "Browse"];

type Props = {
  active: string;
  onSelect: (item: string) => void;
  network: string;
  isConnected: boolean;
  isConnecting: boolean;
  label: string;
  onConnect: () => void;
};

export default function TopNav({
  active,
  onSelect,
  network,
  isConnected,
  isConnecting,
  label,
  onConnect,
}: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[100rem] items-center gap-6 px-6 py-4 md:px-10">
        <Link href="/" className="shrink-0 leading-none text-cream">
          <span className="text-2xl font-semibold tracking-tight">Reroute</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => {
            if (item === "Browse") {
              return (
                <Link
                  key={item}
                  href="/browse"
                  className="micro rounded-md px-3 py-2 text-[0.6875rem] uppercase text-cream-muted transition-colors hover:bg-black/[0.03] hover:text-cream"
                >
                  {item}
                </Link>
              );
            }
            const enabled = item === "Endpoints" || item === "Calls" || item === "Analytics";
            return (
              <button
                key={item}
                onClick={() => enabled && onSelect(item)}
                disabled={!enabled}
                title={enabled ? undefined : "Not available yet"}
                className={`micro rounded-md px-3 py-2 text-[0.6875rem] uppercase transition-colors ${
                  active === item
                    ? "bg-accent-soft/40 text-accent"
                    : enabled
                      ? "text-cream-muted hover:bg-black/[0.03] hover:text-cream"
                      : "cursor-not-allowed text-cream-muted/40"
                }`}
              >
                {item}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="micro hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[0.625rem] uppercase text-cream-muted sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" />
            {network}
          </span>
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="micro shrink-0 rounded-md bg-accent px-4 py-2.5 text-xs uppercase text-white shadow-sm transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isConnecting ? "Connecting" : isConnected ? label : "Connect wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}
