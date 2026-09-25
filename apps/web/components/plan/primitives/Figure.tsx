interface Props {
  children: React.ReactNode;
  caption: string;
  /** Optional source or definition line under the caption. */
  source?: string;
}

/** Chart or image with an always-present caption. */
export function Figure({ children, caption, source }: Props) {
  return (
    <figure className="my-8 m-0">
      <div className="rounded-lg border border-oh-stone bg-oh-ink p-4 md:p-6">{children}</div>
      <figcaption className="mt-3 text-[0.82rem] leading-snug text-oh-mute">
        {caption}
        {source ? <span className="block text-oh-ash">{source}</span> : null}
      </figcaption>
    </figure>
  );
}
