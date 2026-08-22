"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = ["Endpoints", "DNS Setup", "Calls", "Browse"];

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
          <span className="text-2xl">Reroute</span>
          <sup className="ml-0.5 text-[0.6rem] text-cream-muted">(R)</sup>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => {
            if (item === "Browse") {
              return (
                <Link
                  key={item}
                  href="/browse"
                  className="micro px-3 py-2 text-[0.6875rem] uppercase text-cream-muted transition-colors hover:text-cream"
                >
                  {item}
                </Link>
              );
            }
            const enabled = item === "Endpoints" || item === "Calls";
            return (
              <button
                key={item}
                onClick={() => enabled && onSelect(item)}
                disabled={!enabled}
                title={enabled ? undefined : "Not available yet"}
                className={`micro px-3 py-2 text-[0.6875rem] uppercase transition-colors ${
                  active === item
                    ? "text-accent"
                    : enabled
                      ? "text-cream-muted hover:text-cream"
                      : "cursor-not-allowed text-cream-muted/40"
                }`}
              >
                {item}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="micro hidden items-center gap-1.5 text-[0.625rem] uppercase text-cream-muted sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {network}
          </span>
          <ThemeToggle className="text-cream-muted hover:text-cream" />
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="micro shrink-0 border border-accent/60 px-4 py-2.5 text-xs uppercase text-accent transition-colors hover:bg-accent hover:text-ink disabled:opacity-50"
          >
            {isConnecting ? "Connecting" : isConnected ? label : "Connect wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}
