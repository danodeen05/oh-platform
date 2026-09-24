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
      style={{ background: "transparent", color: "#F2EDE4", border: "1px solid #3A3632", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}
    >
      {label}
    </button>
  );
}
