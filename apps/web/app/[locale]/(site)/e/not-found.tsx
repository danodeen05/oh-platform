/**
 * Private events: an unknown slug, or an event that isn't live yet. Lives at
 * the /e level (not in [slug]/) because notFound() thrown by a layout is
 * caught by the boundary above that layout.
 */
import { getLocale, getTranslations } from "next-intl/server";
import { Body, Display } from "@/components/site/Text";

export default async function EventNotFound() {
  const [t, locale] = await Promise.all([getTranslations("events.notFound"), getLocale()]);
  return (
    <div data-event-not-found className="flex min-h-[60svh] flex-col justify-center gap-4 bg-oh-charcoal px-4 pb-[calc(var(--dock-h,0px)+2rem)] pt-10 md:mx-auto md:max-w-2xl">
      <img src="/brand/oh-mark-light-204.webp" alt="" width={56} height={56} decoding="async" className="h-14 w-14 object-contain" />
      <Display locale={locale} className="m-0 text-oh-cream [text-wrap:balance]">
        {t("title")}
      </Display>
      <Body locale={locale} className="m-0 text-oh-cream/85">
        {t("lede")}
      </Body>
    </div>
  );
}
