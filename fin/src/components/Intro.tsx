import Link from "next/link";

export default function Intro() {
  return (
    <section className="flex min-h-[80vh] flex-col justify-center px-[3vw] pt-24 md:px-[6vw]">
      <h1
        className="heading-font text-ink leading-[0.85] tracking-tight select-none"
        style={{ fontSize: "clamp(3rem, 11vw, 9rem)" }}
      >
        Charge agents
        <br />
        per call
      </h1>

      <p
        className="poppins mt-8 max-w-xl text-ink-muted"
        style={{ fontWeight: 500, fontSize: "clamp(1.0625rem, 1.8vw, 1.375rem)", lineHeight: 1.6 }}
      >
        Register any HTTP endpoint, price it in your own currency, and let AI agents
        find and pay for it automatically — no API keys, no Stripe, no subscriptions.
      </p>

      <Link
        href="/dashboard"
        className="poppins mt-10 w-fit rounded-full bg-ink px-7 py-3.5 text-accent transition-opacity hover:opacity-90"
        style={{ fontWeight: 600, fontSize: "1rem" }}
      >
        Register an endpoint
      </Link>
    </section>
  );
}
