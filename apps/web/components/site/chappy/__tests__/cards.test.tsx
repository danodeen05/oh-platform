/**
 * Task E2: Chappy's native cards. Every card type renders as a labeled
 * section, in every locale, with no English left in the zh-TW, zh-CN or es
 * render (brand words and codes aside). Also the payload guards, the
 * latest-only rule and the Stripe return path helpers.
 */
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import zhCN from "@/messages/zh-CN.json";
import zhTW from "@/messages/zh-TW.json";
import { stripAllowlisted } from "@/lib/site/i18n-allowlist";

// Stripe's React bindings render placeholders here (the real Elements are iframes).
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-stripe="provider">{children}</div>,
  PaymentElement: () => <div data-stripe="payment" />,
  ExpressCheckoutElement: () => <div data-stripe="express" />,
  useStripe: () => null,
  useElements: () => null,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ChappyCardProvider, parseCard, renderCard, visibleCards, chappyReturnUrl, readChappyReturn, resolvePayReturn } from "../cards";
import type { ChappyCard } from "../stream";

const MESSAGES = { en, es, "zh-TW": zhTW, "zh-CN": zhCN } as const;
type Locale = keyof typeof MESSAGES;

export const SAMPLE_CARDS: ChappyCard[] = [
  { type: "pay", orderId: "o1", clientSecret: "pi_3Q_secret_abc", amountDueCents: 656, currency: "usd", kitchenNumber: "0012", pod: "B-07" },
  { type: "confirm-zero", orderId: "o1", kitchenNumber: "0012", pod: null },
  { type: "sign-in" },
  {
    type: "cart",
    lines: [
      { menuItemId: "classic", name: "牛肉麵", imageKey: "Classic Beef Noodle Soup", quantity: 1, value: null, priceCents: 1599 },
      { menuItemId: "bokchoy", name: "青江菜", imageKey: "Baby Bok Choy", quantity: 2, value: "多", priceCents: 250 },
    ],
    subtotalCents: 1849,
    savingsCents: 200,
    taxCents: 150,
    totalCents: 1799,
    creditCents: 500,
    amountDueCents: 1299,
    location: "城溪購物中心",
    arrival: "18:30",
    pod: "B-07",
    podBest: false,
    partySize: 2,
  },
  { type: "menu-item", id: "classic", name: "牛肉麵", description: "慢燉牛骨湯", priceCents: 1599, imageKey: "Classic Beef Noodle Soup", categoryType: "MAIN", dietary: ["gluten_free"], spiceLevel: 2 },
  { type: "order-status", orderId: "o1", kitchenNumber: "0012", status: "PREPPING", paid: true, stage: "PREPPING", pod: "B-07", totalCents: 1799, statusPath: "/zh-TW/order/status?orderQrCode=Q" },
  { type: "reward", tier: "CHOPSTICK", cashbackPct: 1, creditCents: 500, expiringCents: 200, next: "NOODLE_MASTER", orders: { have: 3, need: 10 }, referrals: { have: 1, need: 2 }, rewards: 1 },
  { type: "pod-call", pod: "B-07" },
  { type: "support-case", caseId: "case_0004821", kind: "issue", goodwillCents: 500 },
  { type: "group-share", code: "7KQ2", url: "https://www.ohbeef.com/zh-TW/group/7KQ2" },
];

function render(card: ChappyCard, locale: Locale) {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="America/Denver">
      <ChappyCardProvider value={{ locale, cjk: locale.startsWith("zh"), onSignIn: () => {}, send: () => {}, onPaid: () => {}, api: fetch, busy: false }}>
        {renderCard(card)}
      </ChappyCardProvider>
    </NextIntlClientProvider>,
  );
}

/** Visible text and a11y text (aria-label, alt, title) of an HTML string. */
function readable(html: string): string {
  const attrs = [...html.matchAll(/(?:aria-label|alt|title)="([^"]*)"/g)].map((m) => m[1]);
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  return `${text} ${attrs.join(" ")}`;
}

describe("native cards", () => {
  it("every sample is a native card (none falls back)", () => {
    for (const c of SAMPLE_CARDS) expect(parseCard(c), c.type).not.toBeNull();
  });

  for (const locale of Object.keys(MESSAGES) as Locale[]) {
    it(`${locale}: each card type renders as a labeled section`, () => {
      for (const card of SAMPLE_CARDS) {
        const html = render(card, locale);
        const m = html.match(/<section[^>]*data-chappy-card="([^"]+)"[^>]*aria-label="([^"]+)"/) || html.match(/<section[^>]*aria-label="([^"]+)"[^>]*data-chappy-card="([^"]+)"/);
        expect(m, `${card.type} has a labeled section`).toBeTruthy();
        expect(html).toContain(`data-chappy-card="${card.type}"`);
        expect(html).not.toMatch(/chappyWeb\.cards/); // no raw key paths
      }
    });
  }

  for (const locale of ["zh-TW", "zh-CN"] as Locale[]) {
    it(`${locale}: no English words in any card`, () => {
      for (const card of SAMPLE_CARDS) {
        // Brand words and codes aside (the allowlist), and the sample's group URL.
        const text = stripAllowlisted(readable(render(card, locale))).replace(/https?:\S+/g, " ");
        expect(text.match(/[A-Za-z]{3,}/g) || [], `${locale} ${card.type}`).toEqual([]);
      }
    });
  }

  it("es: no English card copy in any card (Spanish is Latin script, so compare with the English strings)", () => {
    const leaves = (o: unknown, out: [string, string][] = [], k = ""): [string, string][] => {
      if (typeof o === "string") out.push([k, o]);
      else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) leaves(v, out, k ? `${k}.${kk}` : kk);
      return out;
    };
    const esLeaves = new Map(leaves(es.chappyWeb.cards));
    // English card copy that es translates differently, as literal fragments (placeholders split out).
    const english = leaves(en.chappyWeb.cards)
      .filter(([k, v]) => esLeaves.get(k) !== v)
      .flatMap(([, v]) => v.split(/\{[^}]*\}|\{[^{}]*\{[^}]*\}[^}]*\}/))
      .map((f) => f.trim())
      .filter((f) => /[A-Za-z]{3,}/.test(f) && f.length >= 4);
    for (const card of SAMPLE_CARDS) {
      const text = readable(render(card, "es")).replace(/\s+/g, " ");
      for (const frag of english) expect(text.includes(frag), `es ${card.type} shows English "${frag}"`).toBe(false);
    }
  });

  it("money is the server's cents, formatted with a bare $", () => {
    const html = render(SAMPLE_CARDS[0], "zh-TW");
    expect(html).toContain("$6.56");
    expect(html).not.toContain("US$");
    const cart = render(SAMPLE_CARDS[3], "en");
    for (const s of ["$15.99", "$2.50", "$18.49", "$17.99", "$12.99"]) expect(cart).toContain(s);
  });

  it("support case: goodwill is worded as store credit, never a refund", () => {
    const html = render(SAMPLE_CARDS[8], "en");
    expect(html).toContain("$5.00 store credit added");
    expect(html.toLowerCase()).not.toContain("refund");
    const refund = render({ type: "support-case", caseId: "c2", kind: "refund", goodwillCents: 0 }, "en");
    expect(refund).toContain("Refund review requested");
    expect(refund).not.toMatch(/\$\d/);
  });

  it("pay card: the Payment Element mounts, and nothing is paid on render", () => {
    const html = render(SAMPLE_CARDS[0], "en");
    expect(html).toContain('data-stripe="payment"');
    expect(html).toContain('data-stripe="express"');
    expect(html).toContain("Pay $6.56");
    expect(html).toContain("Pod B\u201107"); // a non-breaking hyphen keeps the label on one line
  });
});

describe("payload guards", () => {
  it("rejects what a card can't show safely; unknown types fall back", () => {
    expect(parseCard({ type: "pay", orderId: "o1", clientSecret: "not-a-secret", amountDueCents: 1 })).toBeNull();
    expect(parseCard({ type: "pay", orderId: "", clientSecret: "pi_1_secret_a" })).toBeNull();
    expect(parseCard({ type: "cart", lines: [], totalCents: 0 })).toBeNull();
    expect(parseCard({ type: "mystery" })).toBeNull();
    expect(parseCard({ type: "group-share", code: "X", url: "javascript:alert(1)" })).toMatchObject({ url: null });
    expect(parseCard({ type: "order-status", orderId: "o", status: "PAID", statusPath: "//evil.example/x" })).toMatchObject({ statusPath: null });
    const html = render({ type: "mystery" }, "zh-TW");
    expect(html).toContain('data-chappy-card="mystery"');
    expect(html).toContain(zhTW.chappyWeb.cards.unknown.title);
  });

  it("only the latest cart, order status and reward card in a turn shows", () => {
    const cards = [
      { type: "cart", n: 1 },
      { type: "support-case", n: 2 },
      { type: "cart", n: 3 },
      { type: "pay", n: 4 },
      { type: "order-status", n: 5 },
    ];
    expect(visibleCards(cards).map((c) => c.n)).toEqual([2, 3, 4, 5]);
  });
});

describe("Stripe return path", () => {
  it("returns to the same page, in its locale, flagged for Chappy", () => {
    const url = chappyReturnUrl("o1", "es", "https://www.ohbeef.com/es/menu?x=1#top");
    expect(url).toBe("https://www.ohbeef.com/es/menu?x=1&chappyPay=o1");
    expect(chappyReturnUrl("o1", "zh-TW", "https://www.ohbeef.com/menu")).toBe("https://www.ohbeef.com/zh-TW/menu?chappyPay=o1");
  });

  it("reads Stripe's return and gives the address without it", () => {
    const found = readChappyReturn("https://www.ohbeef.com/es/menu?x=1&chappyPay=o1&payment_intent=pi_9&payment_intent_client_secret=pi_9_secret_z&redirect_status=succeeded");
    // The client secret in the link is dropped, never read.
    expect(found?.ret).toEqual({ orderId: "o1", paymentIntentId: "pi_9", status: "succeeded" });
    expect(found?.cleanUrl).toBe("/es/menu?x=1");
    expect(readChappyReturn("https://www.ohbeef.com/es/menu?payment_intent=pi_9")).toBeNull();
    expect(readChappyReturn("https://www.ohbeef.com/es/menu?chappyPay=o1&payment_intent=evil")?.ret.paymentIntentId).toBeNull();
  });

  const ok = <T,>(data: T) => ({ ok: true, status: 200, data, error: { code: null } });
  const fail = (status: number, extra: Record<string, unknown> = {}) => ({ ok: false, status, data: null as any, error: { code: "X", ...extra } });

  it("a crafted link for someone else's order: not the caller's own, so nothing is confirmed and no pay card", async () => {
    const confirm = vi.fn();
    // The API gives a non-owner the safe view (no userId), or a refusal.
    for (const getOrder of [async () => ok({ id: "o1", paymentStatus: "PENDING" }), async () => fail(404)]) {
      const outcome = await resolvePayReturn({ orderId: "o1", paymentIntentId: "pi_theirs", status: "succeeded" }, { getOrder, confirm });
      expect(outcome).toEqual({ kind: "unknown" });
    }
    expect(confirm).not.toHaveBeenCalled();
  });

  it("a failed or id-less return asks the server nothing and pays nothing", async () => {
    const getOrder = vi.fn();
    const confirm = vi.fn();
    expect(await resolvePayReturn({ orderId: "o1", paymentIntentId: "pi_1", status: "failed" }, { getOrder, confirm })).toEqual({ kind: "notPaid" });
    expect(await resolvePayReturn({ orderId: "o1", paymentIntentId: null, status: "succeeded" }, { getOrder, confirm })).toEqual({ kind: "notPaid" });
    expect(getOrder).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("the caller's own order: PAID only through the server's verified confirm", async () => {
    const mine = { id: "o1", userId: "u1", paymentStatus: "PENDING" };
    const confirm = vi.fn(async () => ok({ ...mine, paymentStatus: "PAID" }));
    expect(await resolvePayReturn({ orderId: "o1", paymentIntentId: "pi_1", status: "succeeded" }, { getOrder: async () => ok(mine), confirm })).toMatchObject({ kind: "paid" });
    expect(confirm).toHaveBeenCalledWith("o1", "pi_1");
    const refused = vi.fn(async () => fail(402));
    expect(await resolvePayReturn({ orderId: "o1", paymentIntentId: "pi_1", status: "succeeded" }, { getOrder: async () => ok(mine), confirm: refused })).toEqual({ kind: "unknown" });
    const refunded = vi.fn(async () => fail(409, { refunded: true }));
    expect(await resolvePayReturn({ orderId: "o1", paymentIntentId: "pi_1", status: "succeeded" }, { getOrder: async () => ok(mine), confirm: refunded })).toEqual({ kind: "refunded" });
  });
});
