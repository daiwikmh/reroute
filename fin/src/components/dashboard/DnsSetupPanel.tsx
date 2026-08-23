"use client";

import { useEffect, useState } from "react";
import { domainSlug } from "@/utils/registry/client";
import { AGENTS_ZONE, BACKEND_URL } from "@/utils/registry/config";

type Props = {
  domain: string;
};

type Status = "pending" | "verified" | "error" | "checking";

type DnsStatusResponse = {
  state: "pending" | "verified" | "error";
  detail?: string;
};

const POLL_MS = 8000;

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context, permission denied) —
      // the value is still selectable text, so this degrades gracefully.
    }
  };

  return (
    <div>
      <span className="micro block text-[0.6875rem] font-medium uppercase tracking-wide text-cream-muted">{label}</span>
      <div className="mt-1.5 flex items-stretch gap-1.5">
        <code className="flex-1 truncate rounded-lg border border-border bg-bg px-3 py-2 text-[0.8125rem] text-cream">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="micro shrink-0 rounded-lg border border-border px-3 text-[0.6875rem] uppercase text-cream-muted transition-colors hover:border-cream-muted/60 hover:text-cream"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const STATUS_COPY: Record<Status, { label: string; dot: string; text: string }> = {
  pending: { label: "Waiting for your DNS record", dot: "bg-cream-muted/40", text: "text-cream-muted" },
  checking: { label: "Checking…", dot: "bg-accent/60 animate-pulse", text: "text-cream-muted" },
  verified: { label: "Live", dot: "bg-positive", text: "text-positive" },
  error: { label: "Couldn't check right now", dot: "bg-negative", text: "text-negative" },
};

export default function DnsSetupPanel({ domain }: Props) {
  const [slug, setSlug] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    domainSlug(domain).then(setSlug);
  }, [domain]);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/dns-status/${encodeURIComponent(domain)}`);
        const body = (await res.json()) as DnsStatusResponse;
        if (cancelled) return;
        setStatus(body.state);
        setDetail(body.detail ?? null);
      } catch {
        if (!cancelled) setStatus("error");
      }
      if (!cancelled) setElapsed(Math.round((Date.now() - start) / 1000));
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [domain]);

  const recordName = `_agent.${domain}`;
  const target = slug ? `${slug}.${AGENTS_ZONE}` : "…";
  const copy = STATUS_COPY[status];

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="micro text-[0.6875rem] font-semibold uppercase tracking-wide text-cream-muted">
          Point your domain here
        </span>
        <span className={`micro flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[0.625rem] uppercase ${copy.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${copy.dot}`} aria-hidden />
          {copy.label}
        </span>
      </div>

      <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-cream-muted">
        Add one CNAME record at your DNS provider for <span className="font-medium text-cream">{domain}</span>.
        Agents (and our proxy) look this up before every call — nothing else to install.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <CopyField label="Type" value="CNAME" />
        <CopyField label="Name" value={recordName} />
      </div>
      <div className="mt-3">
        <CopyField label="Value" value={target} />
      </div>

      {status === "verified" && (
        <p className="mt-4 text-[0.75rem] text-positive">
          Verified — agents can find and pay this endpoint now.
        </p>
      )}
      {status === "pending" && elapsed > 20 && (
        <p className="mt-4 text-[0.75rem] text-cream-muted">
          Still not seeing it after a couple of minutes? DNS can take a few minutes to
          propagate — double-check it's a CNAME (not a TXT) at exactly{" "}
          <span className="text-cream">{recordName}</span>, with no other record at that
          same name.
        </p>
      )}
      {status === "error" && (
        <p className="mt-4 text-[0.75rem] text-negative">
          Couldn't reach the verification service. It'll keep retrying automatically.
        </p>
      )}
      {detail && status !== "verified" && (
        <p className="mt-2 text-[0.75rem] text-cream-muted/70">{detail}</p>
      )}
    </div>
  );
}
