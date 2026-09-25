interface Props {
  order: number;
  title: string;
  subtitle: string;
}

/** Editorial section opener: small numeral, display serif title, one-line dek. */
export function SectionHeader({ order, title, subtitle }: Props) {
  return (
    <header className="mb-10 max-w-3xl md:mb-14">
      <p className="m-0 mb-3 font-display text-[0.95rem] tabular-nums tracking-[0.2em] text-oh-ember-light">{String(order).padStart(2, "0")}</p>
      <h1 className="m-0 font-display text-[clamp(2.4rem,6vw,4.2rem)] font-normal leading-[1.02] tracking-[-0.01em] text-oh-cream">{title}</h1>
      <p className="m-0 mt-5 text-[1.05rem] leading-relaxed text-oh-mute md:text-[1.15rem]">{subtitle}</p>
    </header>
  );
}
