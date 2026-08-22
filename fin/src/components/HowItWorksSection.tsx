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
    body: "A single CNAME publishes your price, currency, asset, and pay-to address in DNS — an agent reads all of it in one lookup, before it ever sends you a request.",
  },
  {
    step: "03",
    title: "Get paid per call",
    body: "An agent already knows the price from DNS, pays on-chain in whatever it holds, and your dashboard shows revenue in your own currency.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-black px-[3vw] py-24 md:px-[6vw] md:py-32">
      <SectionHeader
        title="How it works"
        intro="Three steps between an idea and an AI agent paying you for it."
      />

      <div className="mt-14 grid gap-8 md:mt-20 md:grid-cols-3 md:gap-10">
        {STEPS.map((item) => (
          <div key={item.step} className="border-t border-white/10 pt-6">
            <span className="hero-display block text-[#AFDDFF]/60" style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>
              {item.step}
            </span>
            <h3 className="hero-ui mt-3 text-white" style={{ fontWeight: 500, fontSize: "1.25rem" }}>
              {item.title}
            </h3>
            <p className="hero-ui mt-2 text-white/50" style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
