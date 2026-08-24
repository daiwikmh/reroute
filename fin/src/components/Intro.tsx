"use client";

import Image from "next/image";
import Link from "next/link";
import { useWallet } from "@/utils/wallet/hooks";

const NAV_LINKS = [
  { number: "01", label: "HOW_IT_WORKS", href: "/#how-it-works" },
  { number: "02", label: "BROWSE", href: "/browse" },
  { number: "03", label: "DASHBOARD", href: "/dashboard" },
];

const VERTICAL_LINES = ["12.6%", "37.5%", "61.9%", "86.2%"];
const HORIZONTAL_LINES = ["32.7%", "71.4%"];

const NODES = [
  {
    key: "dns",
    title: "[ DNS_PRICED ]",
    body: "Price, currency, asset, and pay-to address all resolve from one TXT lookup — before any request is sent.",
    square: { top: "22%", left: "62%" },
    label: { top: "9%", left: "30%" },
    labelAnim: "hero-anim-slide-left",
    labelDelay: 1100,
    squareDelay: 1500,
    maxWidth: "195px",
    lines: [
      { x1: "40%", y1: "12%", x2: "58%", y2: "12%", delay: 1200 },
      { x1: "58%", y1: "12%", x2: "62%", y2: "22%", delay: 1400 },
    ],
  },
  {
    key: "x402",
    title: "[ X402_SETTLEMENT ]",
    body: "Payment clears on-chain in whatever asset the agent already holds.",
    square: { top: "52%", left: "38%" },
    label: { top: "70%", left: "6%" },
    labelAnim: "hero-anim-slide-left",
    labelDelay: 1400,
    squareDelay: 1800,
    maxWidth: "160px",
    lines: [
      { x1: "24%", y1: "73%", x2: "34%", y2: "73%", delay: 1500 },
      { x1: "34%", y1: "73%", x2: "38%", y2: "52%", delay: 1700 },
    ],
  },
  {
    key: "guard",
    title: "[ RATE_GUARD ]",
    body: "Per-payer limits and allow/deny lists stop abuse before it reaches your origin.",
    square: { top: "60%", left: "58%" },
    label: { top: "44%", left: "80%" },
    labelAnim: "hero-anim-slide-right",
    labelDelay: 1700,
    squareDelay: 2100,
    maxWidth: "180px",
    lines: [
      { x1: "78%", y1: "50%", x2: "66%", y2: "50%", delay: 1800 },
      { x1: "66%", y1: "50%", x2: "58%", y2: "60%", delay: 2000 },
    ],
  },
];

function GridLines() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {VERTICAL_LINES.map((left, i) => (
        <div
          key={left}
          className="absolute top-0 h-full w-px bg-white/[0.05] hero-anim-grid-v"
          style={{ left, animationDelay: `${600 + i * 100}ms` }}
        />
      ))}
      {HORIZONTAL_LINES.map((top, i) => (
        <div
          key={top}
          className="absolute left-0 w-full h-px bg-white/[0.05] hero-anim-grid-h"
          style={{ top, animationDelay: `${800 + i * 150}ms` }}
        />
      ))}
      {HORIZONTAL_LINES.map((top, hi) =>
        VERTICAL_LINES.map((left, vi) => (
          <div
            key={`${top}-${left}`}
            className="absolute hero-anim-scale-in"
            style={{ top, left, animationDelay: `${1000 + (hi * 4 + vi) * 80}ms` }}
          >
            <span className="absolute w-[10px] h-px bg-white/70 -translate-x-1/2 -translate-y-1/2" />
            <span className="absolute w-px h-[10px] bg-white/70 -translate-x-1/2 -translate-y-1/2" />
          </div>
        )),
      )}
    </div>
  );
}

function CentralNodes() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 hidden md:block">
      {NODES.map((node) =>
        node.lines.map((line, i) => (
          <svg
            key={`${node.key}-line-${i}`}
            className="absolute inset-0 w-full h-full hero-anim-fade-in"
            style={{ animationDelay: `${line.delay}ms` }}
          >
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#AFDDFF"
              strokeOpacity={0.5}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className="hero-pulse-line"
            />
          </svg>
        )),
      )}

      {NODES.map((node) => (
        <div
          key={`${node.key}-label`}
          className={`absolute hero-ui ${node.labelAnim}`}
          style={{ top: node.label.top, left: node.label.left, animationDelay: `${node.labelDelay}ms` }}
        >
          <span className="text-white text-[13px] leading-[15.6px] whitespace-nowrap">{node.title}</span>
          <p className="text-white/50 text-[11px] leading-[14px] mt-[4px]" style={{ maxWidth: node.maxWidth }}>
            {node.body}
          </p>
        </div>
      ))}

      {NODES.map((node) => (
        <div
          key={`${node.key}-square`}
          className="absolute w-[80px] h-[80px] lg:w-[100px] lg:h-[100px] border border-white/80 hero-anim-scale-in"
          style={{ top: node.square.top, left: node.square.left, animationDelay: `${node.squareDelay}ms` }}
        />
      ))}
    </div>
  );
}

export default function Intro() {
  const { address, isConnecting, isConnected, network, connectWallet, formatAddress } = useWallet();

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      <GridLines />
      <CentralNodes />

      <nav className="absolute top-0 left-0 w-full z-20 flex items-center justify-between px-[3vw] md:px-[6vw] py-5 md:py-6">
        <div className="flex items-center gap-8 md:gap-10">
          <Link href="/" className="flex items-center gap-2.5 select-none">
            <Image src="/mark.png" alt="" width={28} height={28} className="h-[1.15em] w-[1.15em]" priority />
            <span
              className="hero-display text-white"
              style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.6rem)" }}
            >
              REROUTE
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-10">
            {NAV_LINKS.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                className="hero-ui flex items-center gap-[3px] hero-anim-fade-up"
                style={{ animationDelay: `${350 + i * 100}ms` }}
              >
                <span className="text-[#AFDDFF]/80 text-[13px] leading-[15.6px]">{item.number}.</span>
                <span className="text-white text-[13px] leading-[15.6px] hover:text-[#AFDDFF] transition-colors">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 hero-anim-slide-right" style={{ animationDelay: "600ms" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5}>
            <rect x="2" y="6" width="20" height="13" rx="1.5" />
            <path d="M2 10h20" />
            <circle cx="16.5" cy="14" r="1.2" fill="white" stroke="none" />
          </svg>

          {isConnected ? (
            <>
              <span className="hero-ui text-white text-[13px] leading-[15.6px]">{formatAddress(address ?? "")}</span>
              <span className="hero-ui text-[#AFDDFF] text-[13px] leading-[15.6px]">[ CONNECTED ]</span>
            </>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className="hero-ui text-white/70 text-[13px] leading-[15.6px] hover:text-[#AFDDFF] transition-colors disabled:opacity-50"
            >
              {isConnecting ? "CONNECTING…" : "[ CONNECT_WALLET ]"}
            </button>
          )}

          <span className="hero-ui text-white text-[13px] leading-[15.6px] ml-[20px]">STATUS:</span>
          <span className="hero-ui bg-[#AFDDFF] text-black rounded-[3px] px-[5px] py-[2px] text-[13px] leading-[15.6px]">
            {network}
          </span>
        </div>
      </nav>

      <h1
        className="hero-display text-white font-normal leading-[1.05em] absolute z-10 hero-anim-fade-up"
        style={{
          fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
          top: "clamp(6.5rem, 20vh, 10.5rem)",
          left: "3vw",
          maxWidth: "clamp(280px, 48vw, 700px)",
          animationDelay: "400ms",
        }}
      >
        The price lives in DNS.
        <br />
        Not behind a 402.
      </h1>

      <div className="absolute z-10 bottom-[5vh] md:bottom-[3vw] left-[3vw] right-[3vw] md:right-[6vw] md:left-[6vw] flex flex-col md:flex-row items-start md:items-end justify-between gap-5">
        <Link
          href="/dashboard"
          className="bg-[#AFDDFF] hover:bg-[#c8e8ff] px-[16px] md:px-[20px] py-[10px] md:py-[12px] flex items-center gap-[10px] transition-colors hero-anim-fade-up"
          style={{ animationDelay: "900ms" }}
        >
          <span className="text-black text-[16px] leading-none">→</span>
          <span className="hero-ui text-black text-[12px] md:text-[13px] leading-[15.6px] uppercase tracking-wide">
            Register an endpoint
          </span>
        </Link>

        <div
          className="relative max-w-[280px] hidden sm:block hero-anim-slide-right"
          style={{ animationDelay: "1100ms" }}
        >
          <span className="hero-ui inline-block text-black text-[13px] leading-[15.6px] bg-[#AFDDFF] px-[6px] py-[2px] mb-[10px]">
            PRICED IN DNS — NOT IN A 402
          </span>

          <div className="relative p-[20px]">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 280 168"
              preserveAspectRatio="none"
            >
              <polygon
                points="0.5,0.5 279.5,0.5 279.5,167.5 30,167.5 0.5,137.5"
                fill="none"
                stroke="#AFDDFF"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <p className="relative hero-ui text-white text-[13px] leading-[18px] mb-[18px]">
              Price, currency, asset, and pay-to address resolve from one DNS lookup — before
              your agent ever sends a request. What reaches your server has already paid.
            </p>

            <Link
              href="/#how-it-works"
              className="relative hero-ui text-[#AFDDFF] text-[13px] leading-[15.6px] hover:underline"
            >
              VIEW_HOW_IT_WORKS
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
