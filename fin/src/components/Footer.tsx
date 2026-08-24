"use client";

import { useState } from "react";

const CONTACT_EMAIL = "daiwikdomain@gmail.com";
const GITHUB_URL = "https://github.com/daiwikmh/reroute";
const X_URL = "https://x.com/reroutehq";

const SOCIALS = [
  { label: "GitHub", href: GITHUB_URL },
  { label: "X / Twitter", href: X_URL },
];

function IconButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      aria-label={label}
      className="group flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#AFDDFF]/40 hover:bg-white/10 hover:text-[#AFDDFF]"
    >
      {children}
    </a>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1.5 hero-ui text-[15px] leading-[18px] text-white/70 transition-colors hover:text-white">
      <span className="h-px w-0 bg-[#AFDDFF] transition-all duration-200 group-hover:w-3" />
      {label}
    </a>
  );
}

export default function Footer() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, nothing to fall back to
    }
  };

  return (
    <footer
      className="relative overflow-hidden border-t border-white/10"
      style={{ background: "linear-gradient(135deg, #030405 0%, #061019 55%, #02060a 100%)" }}
    >
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(ellipse at center, rgba(175,221,255,0.25), transparent 70%)" }}
      />

      <div className="relative px-8 pt-20 md:px-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-16">
          <div className="flex max-w-md flex-col gap-8">
            <div>
              <span className="hero-ui block text-white/50 text-[13px] leading-[15.6px]">contact us</span>
              <div className="mt-2 flex items-center gap-3">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="hero-ui text-white text-[16px] leading-[19px] underline underline-offset-4 decoration-white/30 hover:decoration-white"
                >
                  {CONTACT_EMAIL}
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="hero-ui text-white/45 text-[13px] leading-[15.6px] hover:text-white transition-colors"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <IconButton href={`mailto:${CONTACT_EMAIL}`} label="Email">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </IconButton>
              <IconButton href={GITHUB_URL} label="GitHub">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
                </svg>
              </IconButton>
              <IconButton href={X_URL} label="X">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.257 5.629L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </IconButton>
            </div>

            <p className="hero-ui text-white/35 text-[12px] leading-[18px]">
              Reroute is experimental software running on Stellar mainnet with real funds. Payments settle through
              Stellar&apos;s hosted x402 facilitator, not a facilitator Reroute operates itself.
              Pricing, availability, and supported assets may change without notice.
            </p>
          </div>

          <div>
            <span className="hero-ui inline-block rounded border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              follow us
            </span>
            <div className="mt-5 flex flex-col gap-6">
              {SOCIALS.map((social) => (
                <FooterLink key={social.label} href={social.href} label={social.label} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/10" />

        <div className="relative -mx-8 overflow-hidden md:-mx-16">
          <p
            className="hero-display select-none bg-gradient-to-b from-[#AFDDFF] to-[#AFDDFF]/5 bg-clip-text text-center leading-none tracking-tight text-transparent"
            style={{ fontSize: "clamp(64px, 16vw, 220px)" }}
          >
            REROUTE
          </p>
        </div>
      </div>

      <div className="relative px-8 py-5 md:px-16">
        <div className="flex flex-col gap-2 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <span>© Reroute 2026</span>
          <span className="hero-ui flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#AFDDFF]" />
            Priced in DNS, settled on Stellar
          </span>
        </div>
      </div>
    </footer>
  );
}
