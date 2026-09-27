import { denverDateTime } from "@/lib/format";
import { STEP_LABELS } from "@/lib/orders";

/** The steps an order has passed, oldest first, as a vertical rail. */
export function OrderTimeline({ steps }: { steps: { step: string; at: string }[] }) {
  if (steps.length === 0) return <p className="text-[15px] text-oh-stone/70">No steps recorded yet.</p>;
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.step} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden="true" className="absolute left-[5px] top-4 bottom-0 w-px bg-oh-stone/20" />}
            <span aria-hidden="true" className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 ${last ? "border-oh-olive bg-oh-olive" : "border-oh-stone/40 bg-oh-cream"}`} />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <span className={`text-[15px] ${last ? "font-semibold text-oh-charcoal" : "text-oh-stone"}`}>{STEP_LABELS[s.step] ?? s.step}</span>
              <time dateTime={s.at} className="text-sm tabular-nums text-oh-stone/70">{denverDateTime(s.at)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
