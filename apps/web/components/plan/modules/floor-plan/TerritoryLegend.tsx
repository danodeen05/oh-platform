interface Props {
  labels: { staff: string; guest: string; hatch: string };
  /** Longer lines for the aside version. */
  detail?: { staff: string; guest: string; touch: string };
  className?: string;
}

/** Three chips: the two territories and the one surface they share. */
export function TerritoryLegend({ labels, detail, className }: Props) {
  const chip = "inline-flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.12em] text-oh-cream";
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={chip}>
          <span aria-hidden="true" className="inline-block h-3 w-5 rounded-sm border border-oh-ember/60 bg-[repeating-linear-gradient(45deg,rgba(193,80,46,0.55)_0_2px,rgba(193,80,46,0.25)_2px_5px)]" />
          {labels.staff}
        </span>
        <span className={chip}>
          <span aria-hidden="true" className="inline-block h-3 w-5 rounded-sm border border-oh-gold/60 bg-oh-gold/30" />
          {labels.guest}
        </span>
        <span className={chip}>
          <span aria-hidden="true" className="inline-block h-3 w-[3px] rounded-sm bg-oh-ember-light" />
          {labels.hatch}
        </span>
      </div>
      {detail ? (
        <ul className="m-0 mt-3 list-none space-y-1.5 p-0 text-[0.82rem] leading-snug text-oh-mute">
          <li>{detail.staff}</li>
          <li>{detail.guest}</li>
          <li className="text-oh-cream">{detail.touch}</li>
        </ul>
      ) : null}
    </div>
  );
}
