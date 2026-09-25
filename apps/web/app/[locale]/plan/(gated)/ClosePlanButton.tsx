"use client";

export function ClosePlanButton({ label, locale }: { label: string; locale: string }) {
  async function close(): Promise<void> {
    await fetch("/api/plan/auth", { method: "DELETE" });
    // Full navigation: the cookie is gone and nothing client-side should survive it.
    window.location.assign(`/${locale}/plan/gate`);
  }
  return (
    <button
      type="button"
      onClick={() => void close()}
      className="rounded-md border border-oh-stone bg-transparent px-3 py-1 text-[0.75rem] text-oh-cream hover:border-oh-mute focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember"
    >
      {label}
    </button>
  );
}
