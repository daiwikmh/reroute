"use client";

import { useTheme } from "@/utils/theme";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to orange theme" : "Switch to light theme"}
      title={isLight ? "Switch to orange theme" : "Switch to light theme"}
      className={`micro flex shrink-0 items-center gap-1.5 rounded-full border border-current/25 px-3 py-1.5 text-[0.625rem] uppercase transition-colors ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isLight ? "bg-ink" : "bg-accent"}`} />
      {isLight ? "Light" : "Orange"}
    </button>
  );
}
