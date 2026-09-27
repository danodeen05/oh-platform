import Link from "next/link";
import type { SectionKey } from "@/lib/plan/sections";
import { AskChappyButton } from "@/components/plan/chappy/AskChappyButton";

export interface FooterNeighbor {
  key: SectionKey;
  href: string;
  order: number;
  title: string;
  subtitle: string;
  minutes: number;
}

interface Props {
  sectionKey: SectionKey;
  position: { index: number; total: number };
  previous: FooterNeighbor | null;
  next: FooterNeighbor | null;
  labels: { previous: string; next: string; readingTime: (minutes: number) => string; sectionOf: string; ask: string };
}

/**
 * The end of every section: where you are, where to go next, and a way to
 * ask Chappy about it. Server-rendered; only the Ask Chappy button is a
 * client island (it opens the panel mounted in the plan layout).
 */
export function SectionFooter({ sectionKey, position, previous, next, labels }: Props) {
  const card = (n: FooterNeighbor, kind: "previous" | "next") => (
    <Link
      href={n.href}
      className={["group flex flex-col gap-1 rounded-lg border border-oh-stone bg-oh-ink/50 px-4 py-3 text-left transition-colors hover:border-oh-mute hover:bg-oh-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember", kind === "next" ? "sm:text-right sm:items-end" : ""].join(" ")}
    >
      <span className="text-[0.66rem] uppercase tracking-[0.14em] text-oh-mute">{kind === "previous" ? labels.previous : labels.next}</span>
      <span className="font-display text-[1.15rem] leading-tight text-oh-cream">
        <span className="mr-2 text-[0.85rem] tabular-nums text-oh-ember-light">{String(n.order).padStart(2, "0")}</span>
        {n.title}
      </span>
      <span className="text-[0.8rem] leading-snug text-oh-mute">{n.subtitle}</span>
      <span className="text-[0.7rem] text-oh-mute/80">{labels.readingTime(n.minutes)}</span>
    </Link>
  );
  return (
    <footer className="mt-14 border-t border-oh-stone pt-6 md:mt-20" data-plan-shell="">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">{labels.sectionOf}</p>
        <AskChappyButton sectionKey={sectionKey} label={labels.ask} />
      </div>
      <nav aria-label={labels.sectionOf} className="grid gap-3 sm:grid-cols-2">
        <div>{previous ? card(previous, "previous") : null}</div>
        <div>{next ? card(next, "next") : null}</div>
      </nav>
    </footer>
  );
}
