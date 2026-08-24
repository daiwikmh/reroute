import SectionHeader from "./SectionHeader";
import Container from "./landing/Container";
import Reveal from "./landing/Reveal";

const AUDIENCES = [
  {
    index: "01",
    tag: "SELLERS",
    title: "MCP server operators, and data & scraping APIs",
    body: "The MCP SDK has 120M+ monthly downloads, and under 5% of servers make any money today. Firecrawl already charges $0.01/scrape via x402 on Base. Both groups share the same pain: agent traffic doesn't fit subscription tiers, and an agent can't fill out a signup form mid-task to get an API key.",
  },
  {
    index: "02",
    tag: "BUYERS",
    title: "Agent orchestration frameworks and AI gateways",
    body: "Model routing by cost is already proven at scale — OpenRouter, NVIDIA NeMo Switchyard, 60–80% cost cuts commonly cited. The same pattern for tool and data APIs is earlier, but real: it pays off for whoever is comparison-shopping candidate providers before committing to a request, not a single agent calling one API it already knows.",
  },
];

export default function WhoItsForSection() {
  return (
    <section className="bg-black py-24 md:py-32">
      <Container>
        <SectionHeader title="Who this is for" intro="Two sides of the same DNS record." />

        <div className="mt-14 grid gap-6 md:mt-20 md:grid-cols-2 md:gap-8">
          {AUDIENCES.map((item, i) => (
            <Reveal key={item.tag} delay={i * 120}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition-colors duration-300 hover:border-white/20 md:p-10">
                <span className="hero-display pointer-events-none absolute -right-2 -top-4 text-[#AFDDFF]/10 select-none" style={{ fontSize: "5rem" }}>
                  {item.index}
                </span>

                <span className="hero-ui relative inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-[#AFDDFF]">
                  {item.tag}
                </span>

                <h3 className="hero-ui relative mt-5 text-white" style={{ fontWeight: 500, fontSize: "1.375rem", lineHeight: 1.3 }}>
                  {item.title}
                </h3>

                <p className="hero-ui relative mt-3 text-white/45" style={{ fontSize: "0.9375rem", lineHeight: 1.65 }}>
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
