export default function SectionHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <>
      <h2
        className="heading-font text-ink leading-[0.85] tracking-tight select-none"
        style={{ fontSize: "clamp(3rem, 10vw, 8rem)" }}
      >
        {title}
      </h2>

      <p
        className="poppins mt-6 md:mt-8 max-w-2xl text-ink-muted"
        style={{ fontWeight: 500, fontSize: "clamp(1rem, 1.6vw, 1.25rem)", lineHeight: 1.6 }}
      >
        {intro}
      </p>
    </>
  );
}
