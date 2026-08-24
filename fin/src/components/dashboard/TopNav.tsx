"use client";

import Image from "next/image";
import Link from "next/link";

const NAV = [
  { number: "01", label: "Endpoints" },
  { number: "02", label: "DNS Setup" },
  { number: "03", label: "Calls" },
  { number: "04", label: "Analytics" },
  { number: "05", label: "Payouts" },
  { number: "06", label: "Browse" },
];

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
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[100rem] items-center gap-8 px-6 py-5 md:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 leading-none text-cream">
          <Image src="/mark.png" alt="" width={22} height={22} className="h-[1.1em] w-[1.1em]" />
          <span className="hero-display" style={{ fontSize: "1.35rem" }}>
            REROUTE
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-7 md:flex">
          {NAV.map((item) => {
            if (item.label === "Browse") {
              return (
                <Link
                  key={item.label}
                  href="/browse"
                  className="hero-ui flex items-center gap-[3px] text-[13px] transition-colors"
                >
                  <span className="text-accent/70">{item.number}.</span>
                  <span className="text-cream-muted hover:text-cream">{item.label.toUpperCase()}</span>
                </Link>
              );
            }
            const enabled =
              item.label === "Endpoints" ||
              item.label === "Calls" ||
              item.label === "Analytics" ||
              item.label === "Payouts";
            return (
              <button
                key={item.label}
                onClick={() => enabled && onSelect(item.label)}
                disabled={!enabled}
                title={enabled ? undefined : "Not available yet"}
                className="hero-ui flex items-center gap-[3px] text-[13px] transition-colors disabled:cursor-not-allowed"
              >
                <span className={active === item.label ? "text-accent" : "text-accent/70"}>{item.number}.</span>
                <span
                  className={
                    active === item.label
                      ? "text-cream"
                      : enabled
                        ? "text-cream-muted hover:text-cream"
                        : "text-cream-muted/40"
                  }
                >
                  {item.label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="micro hidden items-center gap-2 text-[12px] text-cream-muted sm:flex">
            STATUS:
            <span className="bg-accent px-[6px] py-[2px] text-black">{network.toUpperCase()}</span>
          </span>
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="micro shrink-0 bg-accent px-4 py-2.5 text-xs font-semibold uppercase text-black transition-colors hover:bg-white disabled:opacity-50"
          >
            {isConnecting ? "Connecting" : isConnected ? label : "Connect wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}
