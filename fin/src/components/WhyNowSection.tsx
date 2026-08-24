import SectionHeader from "./SectionHeader";
import Container from "./landing/Container";
import Reveal from "./landing/Reveal";

const POINTS = [
  {
    step: "01",
    title: "x402 on Stellar is crowded, and funded",
    body: "20+ projects already let an agent pay an API over x402 on Stellar. Every one of them still makes the agent send a request and read a 402 response before it learns the price.",
  },
  {
    step: "02",
    title: "Discovery already has an answer — off-chain, off-domain",
    body: "Coinbase's x402 Bazaar lists 112+ services and solves discovery-before-payment already. But it's a directory you query over HTTP, not a DNS lookup against the seller's own domain — it doesn't help if a seller never lists, or if Bazaar is down or rate-limiting you.",
  },
];

export default function WhyNowSection() {
  return (
    <section className="bg-black py-24 md:py-32">
      <Container>
        <SectionHeader
          title="Why now"
          intro="The honest version of why DNS-priced payments, and why not just another x402 wrapper."
        />

        <div className="mt-14 space-y-8 md:mt-20">
          {POINTS.map((item, i) => (
            <Reveal key={item.step} delay={i * 120}>
              <div className="flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:gap-8">
                <span className="hero-ui flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[13px] text-[#AFDDFF]">
                  {item.step}
                </span>
                <div>
                  <h3 className="hero-ui text-white" style={{ fontWeight: 500, fontSize: "1.25rem" }}>
                    {item.title}
                  </h3>
                  <p className="hero-ui mt-2 max-w-2xl text-white/45" style={{ fontSize: "0.9375rem", lineHeight: 1.65 }}>
                    {item.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}

          <Reveal delay={240}>
            <div
              className="relative overflow-hidden rounded-2xl border border-[#AFDDFF]/25 p-8 md:p-10"
              style={{ background: "radial-gradient(circle at 0% 0%, rgba(175,221,255,0.08), transparent 60%)" }}
            >
              <span className="hero-ui inline-block rounded-full bg-[#AFDDFF] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-black">
                The edge
              </span>
              <h3 className="hero-ui mt-4 text-white" style={{ fontWeight: 500, fontSize: "1.375rem", lineHeight: 1.3 }}>
                No third-party dependency
              </h3>
              <p className="hero-ui mt-3 max-w-2xl text-white/55" style={{ fontSize: "0.9375rem", lineHeight: 1.65 }}>
                <span className="text-[#AFDDFF]">_agent.&lt;domain&gt;</span> resolves the same way DNS always
                has: no directory to list with, no third party to go down. Not &ldquo;first discovery
                layer&rdquo; — just one fewer thing between an agent and a price.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
