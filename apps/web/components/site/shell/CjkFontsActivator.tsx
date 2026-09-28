"use client";

/**
 * Applies the non-blocking CJK font stylesheet (see CjkFonts.tsx) after
 * hydration or a client navigation. On a full page load the inline script has
 * usually done it already; setting it again is harmless.
 */
import { useEffect } from "react";

export function CjkFontsActivator({ id, href }: { id: string; href: string }) {
  useEffect(() => {
    const link = document.getElementById(id);
    if (link instanceof HTMLLinkElement) link.media = "all";
  }, [id, href]);
  return null;
}
