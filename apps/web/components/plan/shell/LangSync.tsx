"use client";

import { useEffect } from "react";

/**
 * The root layout renders <html> without a lang attribute because it does
 * not know the locale; this keeps document.documentElement.lang in step with
 * the [locale] segment for assistive tech and audits (WCAG 3.1.1).
 */
export function LangSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
