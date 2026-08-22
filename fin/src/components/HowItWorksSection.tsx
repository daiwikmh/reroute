import SectionHeader from "./SectionHeader";

const STEPS = [
  {
    step: "01",
    title: "Register your endpoint",
    body: "Point us at any HTTP endpoint you own, set a price in whatever currency makes sense to you, and pick which assets you'll accept.",
  },
  {
    step: "02",
    title: "Add one DNS record",
    body: "A single CNAME lets agents discover your price and accepted currencies automatically — no API keys, no docs to read.",
  },
  {
    step: "03",
    title: "Get paid per call",
    body: "An agent hits your endpoint, pays on-chain in whatever it holds, and your dashboard shows revenue in your own currency.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-bg px-[3vw] py-24 md:px-[6vw] md:py-32">
      <SectionHeader
        title="How it works"
        intro="Three steps between an idea and an AI agent paying you for it."
      />

      <div className="mt-14 grid gap-8 md:mt-20 md:grid-cols-3 md:gap-10">
        {STEPS.map((item) => (
          <div key={item.step}>
            <span
              className="heading-font block text-ink/30"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
            >
              {item.step}
            </span>
            <h3 className="poppins mt-3 text-ink" style={{ fontWeight: 600, fontSize: "1.25rem" }}>
              {item.title}
            </h3>
            <p className="poppins mt-2 text-ink-muted" style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
