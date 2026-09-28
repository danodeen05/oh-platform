/**
 * Task D11: the group lobby, /group/[code], on the site shell. The group is
 * read on the server in the reader's locale (GET /group-orders/:code
 * ?locale=, which localizes the location and the menu items); the lobby
 * itself (components/site/group/GroupLobby) is a client island that polls,
 * joins, runs the host controls and the CombMap pod pick.
 */
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { GroupLobby } from "@/components/site/group/GroupLobby";
import { GroupMissing, getGroupOrder } from "@/components/site/group/server";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations("groupLobby.meta");
  return { title: t("title", { code: code.toUpperCase() }), description: t("description"), robots: { index: false } };
}

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const locale = await getLocale();
  const group = await getGroupOrder(code, locale);
  if (!group) return <GroupMissing code={code} locale={locale} />;
  return <GroupLobby initialGroup={group} />;
}
