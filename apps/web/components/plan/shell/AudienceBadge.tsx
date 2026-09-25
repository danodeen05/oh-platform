/** Who this code was issued to. Shown in the top bar and printed in the footer. */
export function AudienceBadge({ audience, label }: { audience: string; label: string }) {
  return (
    <span className="inline-flex max-w-[14rem] items-center gap-2 truncate rounded-full border border-oh-stone px-3 py-1 text-[0.72rem] tracking-wide text-oh-mute">
      <span className="uppercase text-oh-gold">{audience}</span>
      <span aria-hidden="true" className="text-oh-stone">
        |
      </span>
      <span className="truncate text-oh-cream">{label}</span>
    </span>
  );
}
