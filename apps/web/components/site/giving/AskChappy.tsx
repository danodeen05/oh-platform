"use client";

/**
 * /giving: the Ask Chappy action. Opens Chappy (useChappy, from the site
 * shell) with a translated question already typed. Copy arrives as props
 * (resolved on the server), so this island adds nothing to the client
 * message scope (ROUTE_NAMESPACES.giving is empty).
 */
import { useChappy } from "@/components/site/chappy/ChappyLauncher";

export function AskChappyButton({ label, prompt, className }: { label: string; prompt: string; className: string }) {
  const chappy = useChappy();
  return (
    <button type="button" data-giving-chappy aria-haspopup="dialog" onClick={() => chappy.openChappy(prompt)} className={className}>
      {label}
    </button>
  );
}
