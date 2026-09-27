const pulse = "bg-oh-stone/10 motion-safe:animate-[oh-pulse_1.4s_ease-in-out_infinite]";

export function Skeleton({ className = "" }: { className?: string }) {
  const round = /\brounded/.test(className) ? "" : "rounded-lg";
  return <div aria-hidden="true" className={`${round} ${pulse} ${className}`} />;
}

/** Placeholder for a Card of ListRows while data loads. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" className="overflow-hidden rounded-card border border-oh-stone/15 bg-oh-cream shadow-card">
      <span className="sr-only">Loading</span>
      <div className="divide-y divide-oh-stone/10">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className={`h-3.5 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
