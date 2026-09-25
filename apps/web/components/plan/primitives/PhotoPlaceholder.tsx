interface Props {
  /** What photo belongs here, e.g. "Pod interior, guest seated, panel open". */
  needs: string;
  label: string;
  className?: string;
}

/**
 * Spec 3.4: no stock, no AI imagery. Until a real photograph exists, a
 * typographic card names the shot. Add each one to docs/PHOTO_NEEDS.md.
 */
export function PhotoPlaceholder({ needs, label, className }: Props) {
  return (
    <div className={["flex aspect-[3/2] items-center justify-center rounded-lg border border-dashed border-oh-stone bg-oh-ink/50 p-6 text-center", className ?? ""].join(" ")}>
      <div>
        <p className="m-0 mb-1 text-[0.7rem] uppercase tracking-[0.14em] text-oh-mute">{label}</p>
        <p className="m-0 font-display text-[1.1rem] leading-snug text-oh-cream">{needs}</p>
      </div>
    </div>
  );
}
