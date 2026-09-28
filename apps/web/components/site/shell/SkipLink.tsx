import { getTranslations } from "next-intl/server";

/** Keyboard users skip the top bar. Visible only while focused. */
export async function SkipLink() {
  const t = await getTranslations("site.shell");
  return (
    <a
      href="#site-main"
      className="sr-only z-50 rounded-full no-underline bg-oh-cream px-4 py-3 text-sm font-semibold text-oh-charcoal focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
    >
      {t("skipToContent")}
    </a>
  );
}
