/**
 * Task D11: server-side pieces shared by the group lobby and the group
 * payment page: the group read (in the reader's locale) and the translated
 * "no such group" page.
 */
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/site/icons/Icon";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { API_URL } from "@/lib/api";
import type { Group } from "@/lib/site/group";
import { localizedHref } from "@/lib/site/nav";
import { serverApiHeaders } from "@/lib/server/api-headers";

const GUEST_SESSION_COOKIE = "oh_guest_session";

/**
 * Task D11b: the reader's own identity for a server-side group read. The API
 * gives each member's order number and QR code only to that member (a
 * verified Clerk session, or a guest's server-issued session token), so the
 * server read forwards the reader's Clerk session token, else their guest
 * session cookie, exactly as the lobby's client poll sends them.
 */
async function viewerHeaders(): Promise<Record<string, string>> {
  try {
    const { userId, getToken } = await auth();
    if (userId) {
      const token = await getToken();
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch {
    /* no Clerk context: read as a guest or anonymously */
  }
  try {
    const guest = (await cookies()).get(GUEST_SESSION_COOKIE)?.value;
    if (guest) return { "x-guest-session": decodeURIComponent(guest) };
  } catch {
    /* no cookies outside a request */
  }
  return {};
}

/** GET /group-orders/:code?locale= (the location and menu items come back localized), as the reader. Null when missing or expired. */
export async function getGroupOrder(code: string, locale: string): Promise<Group | null> {
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) return null;
  try {
    const res = await fetch(`${API_URL}/group-orders/${encodeURIComponent(code)}?locale=${encodeURIComponent(locale)}`, {
      cache: "no-store",
      headers: serverApiHeaders({ "x-tenant-slug": "oh", ...(await viewerHeaders()) }), // G3b: server-side call skips the per-IP limit
    });
    if (!res.ok) return null;
    return (await res.json()) as Group;
  } catch (error) {
    console.error("Error fetching group:", error);
    return null;
  }
}

export async function GroupMissing({ code, locale, noCode = false }: { code?: string; locale: string; noCode?: boolean }) {
  const t = await getTranslations("groupLobby.missing");
  return (
    <div data-group-missing className="mx-auto flex min-h-[70svh] max-w-2xl flex-col justify-center px-5 py-20 md:px-8">
      {code ? (
        <Eyebrow locale={locale} className="text-oh-ember-light">
          <span data-literal>{code}</span>
        </Eyebrow>
      ) : null}
      <Display locale={locale} className="m-0 mt-3 text-oh-cream">
        {t("title")}
      </Display>
      <Body locale={locale} className="m-0 mt-4 text-lg text-oh-cream/80">
        {noCode ? t("noCode") : t("body", { code: code ?? "" })}
      </Body>
      <Link
        href={localizedHref(locale, "/order")}
        className="mt-8 inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-full bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream no-underline transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
      >
        {t("cta")}
        <Icon name="arrow" size={18} />
      </Link>
    </div>
  );
}
