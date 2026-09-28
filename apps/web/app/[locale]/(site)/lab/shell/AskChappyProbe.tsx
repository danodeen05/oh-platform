"use client";

/**
 * Task E1, dev-only lab: an "Ask Chappy" link with a prefill, the way a page
 * opens Chappy about something specific (`useChappy().openChappy(text)`).
 * Exercised by tests/e2e/site/chappy.spec.ts. Placeholder copy, not
 * customer copy (the lab route 404s in production).
 */
import { useChappy } from "@/components/site/chappy/ChappyLauncher";

export function AskChappyProbe() {
  const { openChappy } = useChappy();
  return (
    <button
      type="button"
      data-testid="ask-chappy-probe"
      onClick={() => openChappy("Is the broth spicy?")}
      className="mt-6 min-h-11 cursor-pointer rounded-full border border-solid border-oh-stone bg-transparent px-4 font-[inherit] text-sm text-oh-cream"
    >
      Ask Chappy (prefill probe)
    </button>
  );
}
