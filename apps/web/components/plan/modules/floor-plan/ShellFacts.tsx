interface Props {
  title: string;
  note: string;
  facts: readonly { label: string; value: string }[];
}

/** What a landlord or broker asks first, read from the geometry. Nothing here is guessed. */
export function ShellFacts({ title, note, facts }: Props) {
  return (
    <section aria-labelledby="floor-plan-facts" className="mt-10 md:mt-14">
      <h2 id="floor-plan-facts" className="m-0 mb-3 text-[0.72rem] uppercase tracking-[0.14em] text-oh-mute">
        {title}
      </h2>
      <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-oh-stone bg-oh-stone md:grid-cols-4 lg:grid-cols-7">
        {facts.map((f) => (
          <div key={f.label} className="bg-oh-ink px-4 py-3">
            <dt className="text-[0.66rem] uppercase tracking-[0.12em] text-oh-mute">{f.label}</dt>
            <dd className="m-0 mt-1 text-[0.88rem] leading-snug text-oh-cream tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 mt-2 text-[0.72rem] text-oh-mute">{note}</p>
    </section>
  );
}
