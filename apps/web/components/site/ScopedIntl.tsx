/**
 * A next-intl client provider that serializes only part of the catalog
 * (Task G2a, see lib/site/client-messages.ts). Route-group layouts render it
 * rather than the shared [locale] layout, because a layout above a group is
 * not re-rendered on a client navigation between groups: a (site) page and
 * a legacy page each need their own set, and only their own layouts are
 * rendered fresh when the visitor moves between them.
 */
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { IntlClientProvider } from "@/components/site/IntlClientProvider";
import {
  SERVER_ONLY_NAMESPACES,
  SITE_CLIENT_NAMESPACES,
  omitNamespaces,
  pickNamespaces,
} from "@/lib/site/client-messages";

export async function ScopedIntl({ scope, children }: { scope: "site" | "legacy"; children: ReactNode }) {
  const all = (await getMessages()) as Record<string, unknown>;
  const messages =
    scope === "site" ? pickNamespaces(all, SITE_CLIENT_NAMESPACES) : omitNamespaces(all, SERVER_ONLY_NAMESPACES);
  return (
    <NextIntlClientProvider messages={messages as never}>
      <IntlClientProvider>{children}</IntlClientProvider>
    </NextIntlClientProvider>
  );
}
