interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** One line under the image. */
  caption?: string;
  /** Small uppercase tag under the caption, e.g. "Concept render". */
  note?: string;
  /** Tailwind aspect class to crop into, e.g. "aspect-[4/5]" or "aspect-[21/9]". Omit to keep the image's own ratio. */
  aspect?: string;
  className?: string;
  priority?: boolean;
}

/**
 * A photo in the plan: bordered, rounded, captioned, and honest about what it
 * is (the `note` tags concept renders so they are never mistaken for the
 * finished flagship). Hook-free so print and server components can use it.
 */
export function PlanPhoto({ src, alt, width, height, caption, note, aspect, className, priority }: Props) {
  return (
    <figure className={["m-0", className ?? ""].join(" ")}>
      <div className={["overflow-hidden rounded-lg border border-oh-stone bg-oh-ink", aspect ?? ""].join(" ")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} decoding="async" className={["block w-full", aspect ? "h-full object-cover object-center" : "h-auto"].join(" ")} />
      </div>
      {caption || note ? (
        <figcaption className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.8rem] leading-snug text-oh-mute">
          {caption ? <span>{caption}</span> : null}
          {note ? <span className="text-[0.62rem] uppercase tracking-[0.14em] text-oh-mute/80">{note}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
