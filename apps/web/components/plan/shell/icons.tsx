import type { SectionIcon } from "@/lib/plan/sections";

/**
 * Inline, single-stroke icons for the section nav. Hand-drawn paths keep the
 * bundle free of an icon library and let the set match the brand's quiet line.
 */
const PATHS: Record<SectionIcon, string> = {
  summary: "M6 4h9l4 4v12H6zM14 4v5h5M9 13h6M9 17h6",
  sliders: "M5 8h9M17 8h2M5 16h3M11 16h8M14 5.5v5M8 13.5v5",
  bowl: "M4 11h16c0 4.5-3 8-8 8s-8-3.5-8-8zM9 4c-1 1.5 1 2.5 0 4M13 4c-1 1.5 1 2.5 0 4",
  map: "M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14",
  grid: "M4 4h16v16H4zM4 12h16M12 4v16",
  cpu: "M8 8h8v8H8zM4 10h4M4 14h4M16 10h4M16 14h4M10 4v4M14 4v4M10 16v4M14 16v4",
  route: "M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h6a3 3 0 003-3v-1a3 3 0 00-3-3H10a3 3 0 01-3-3",
  scale: "M12 4v16M5 20h14M12 6l-6 3 3 5h6l3-5zM6 9l-3 5h6zM18 9l-3 5h6z",
  ledger: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4",
  tornado: "M4 6h16M6 10h12M8 14h8M10 18h4",
  people: "M9 11a3 3 0 100-6 3 3 0 000 6zM16 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 20a6 6 0 0112 0M14 20a4.5 4.5 0 017 0",
  coins: "M12 12a7 3 0 1014 0 7 3 0 10-14 0zM5 12v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4M5 8v4",
  flag: "M6 21V4M6 4h11l-2 4 2 4H6",
};

export function SectionGlyph({ icon, className }: { icon: SectionIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[icon]} />
    </svg>
  );
}
