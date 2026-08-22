import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const LINKS = [{ href: "/#how-it-works", label: "How it works" }];

export default function SiteNav() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-[3vw] md:px-[6vw] py-5 md:py-6">
      <Link
        href="/"
        className="heading-font text-ink select-none"
        style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}
      >
        Reroute
      </Link>

      <div className="flex items-center gap-5 md:gap-8">
        <div className="hidden sm:flex items-center gap-5 md:gap-8">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="poppins text-ink-muted hover:text-ink transition-colors"
              style={{ fontWeight: 500, fontSize: "0.9375rem" }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <ThemeToggle className="text-ink-muted hover:text-ink" />

        <Link
          href="/dashboard"
          className="poppins rounded-full bg-ink px-5 py-2 text-accent transition-opacity hover:opacity-90"
          style={{ fontWeight: 600, fontSize: "0.9375rem" }}
        >
          Launch app
        </Link>
      </div>
    </nav>
  );
}
