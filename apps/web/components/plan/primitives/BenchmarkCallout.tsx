interface Props {
  eyebrow: string;
  claim: string;
  benchmark: string;
}

/**
 * Says the aggressive number out loud and puts the honest benchmark next to
 * it (spec 5.4). Reused wherever the plan makes a claim that deserves a
 * raised eyebrow.
 */
export function BenchmarkCallout({ eyebrow, claim, benchmark }: Props) {
  return (
    <aside className="my-8 grid gap-4 rounded-lg border-l-2 border-oh-gold bg-oh-ink/70 px-6 py-5 md:grid-cols-[1fr_1fr] md:gap-8">
      <div>
        <p className="m-0 mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-oh-gold">{eyebrow}</p>
        <p className="m-0 font-display text-[1.35rem] leading-snug text-oh-cream">{claim}</p>
      </div>
      <p className="m-0 self-center text-[0.95rem] leading-relaxed text-oh-mute">{benchmark}</p>
    </aside>
  );
}
