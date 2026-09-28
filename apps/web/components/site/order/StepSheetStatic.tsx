/**
 * A server-rendered page in the order flow's frame, for the states that
 * need no interaction (an unknown location). The dock stays hidden
 * (`data-order-flow`).
 */
import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { Title } from "@/components/site/Text";

export async function StepSheetStatic({ title, children }: { title: string; children: ReactNode }) {
  const locale = await getLocale();
  return (
    <div data-order-flow className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 md:pt-10">
      <Title locale={locale} as="h1" className="m-0 text-oh-cream">
        {title}
      </Title>
      <div className="mt-6">{children}</div>
    </div>
  );
}
