import type { ReactNode } from "react";

type Props = { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean };

/** Cream work surface. Unpadded cards are for edge-to-edge ListRows. */
export function Card({ title, action, children, className = "", padded = true }: Props) {
  return (
    <section className={`overflow-hidden rounded-card border border-oh-stone/15 bg-oh-cream shadow-card ${className}`}>
      {(title || action) && (
        <div className={`flex min-h-13 items-center gap-3 pl-4 pr-2 ${padded ? "pt-2" : "border-b border-oh-stone/10 py-1"}`}>
          {title && <h2 className="min-w-0 flex-1 truncate font-display text-[1.375rem] leading-tight text-oh-charcoal">{title}</h2>}
          {action && <div className="ml-auto flex shrink-0 items-center gap-1">{action}</div>}
        </div>
      )}
      <div className={padded ? "p-4" : "divide-y divide-oh-stone/10"}>{children}</div>
    </section>
  );
}
