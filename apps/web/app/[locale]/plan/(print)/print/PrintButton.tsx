"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-oh-ember px-4 py-2 text-[0.8rem] font-semibold text-oh-cream hover:bg-oh-clay focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-charcoal"
    >
      {label}
    </button>
  );
}
