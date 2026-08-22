export default function SectionHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <>
      <h2
        className="hero-display text-white leading-[0.9] tracking-tight select-none"
        style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
      >
        {title}
      </h2>

      <p
        className="hero-ui mt-6 md:mt-8 max-w-2xl text-white/50"
        style={{ fontSize: "clamp(1rem, 1.6vw, 1.25rem)", lineHeight: 1.6 }}
      >
        {intro}
      </p>
    </>
  );
}
