"use client";

/**
 * Task D2: the Ask Chappy button at the close of the page. Opens Chappy
 * (useChappy, from the site shell) with a translated question already
 * typed; it only starts a conversation. Copy arrives as props (resolved on
 * the server), so this island adds nothing to the client message scope.
 */
import { useChappy } from "@/components/site/chappy/ChappyLauncher";

export function AskChappyButton({ label, prompt }: { label: string; prompt: string }) {
  const chappy = useChappy();
  return (
    <button
      type="button"
      data-experience-chappy
      aria-haspopup="dialog"
      onClick={() => chappy.openChappy(prompt)}
      className="inline-flex min-h-12 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
    >
      {label}
    </button>
  );
}
