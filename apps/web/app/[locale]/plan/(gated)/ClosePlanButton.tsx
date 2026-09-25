"use client";

import { useRouter } from "next/navigation";

export function ClosePlanButton({ label, locale }: { label: string; locale: string }) {
  const router = useRouter();
  async function close(): Promise<void> {
    await fetch("/api/plan/auth", { method: "DELETE" });
    router.replace(`/${locale}/plan/gate`);
    router.refresh();
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
