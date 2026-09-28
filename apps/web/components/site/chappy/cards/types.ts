/**
 * Chappy's native cards (Task E2): the payloads the API's tools emit
 * (packages/api/src/chappy/tools.js, `card` on a tool result, streamed as
 * `card` SSE events), as a discriminated union on `type`.
 *
 * Every payload comes off the network, so `parseCard` checks the fields a
 * card needs before it renders; anything it can't read falls back to E1's
 * translated box. Money is always cents, straight from the server's quote:
 * the cards format it and never compute a price.
 */
import type { ChappyCard } from "../stream";

export type PayCardData = {
  type: "pay";
  orderId: string;
  clientSecret: string;
  /** null when a Stripe redirect return rebuilt the card (PayCard reads it from Stripe). */
  amountDueCents: number | null;
  currency?: string;
  kitchenNumber?: string | null;
  pod?: string | null;
};

export type ConfirmZeroCardData = { type: "confirm-zero"; orderId: string; kitchenNumber?: string | null; pod?: string | null };

export type SignInCardData = { type: "sign-in" };

export type CartLine = { menuItemId: string; name: string | null; imageKey: string | null; quantity: number; value: string | null; priceCents: number };

export type CartCardData = {
  type: "cart";
  lines: CartLine[];
  subtotalCents: number;
  savingsCents: number;
  taxCents: number;
  totalCents: number;
  creditCents: number;
  amountDueCents: number;
  location: string | null;
  /** HH:MM at the location, or null for as soon as they can. */
  arrival: string | null;
  pod: string | null;
  podBest: boolean;
  partySize: number;
};

export type MenuItemCardData = {
  type: "menu-item";
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageKey: string | null;
  categoryType: string | null;
  dietary: string[];
  spiceLevel: number;
};

export type OrderStatusCardData = {
  type: "order-status";
  orderId: string;
  kitchenNumber: string | null;
  status: string;
  paid: boolean;
  /** One of PHONE_STAGES, "UNPAID", or null (paid but past the stages, e.g. cancelled). */
  stage: string | null;
  pod: string | null;
  totalCents: number | null;
  statusPath: string | null;
};

export type RewardCardData = {
  type: "reward";
  tier: string;
  cashbackPct: number;
  creditCents: number;
  expiringCents: number;
  next: string | null;
  orders: { have: number; need: number } | null;
  referrals: { have: number; need: number } | null;
  rewards: number;
};

export type PodCallCardData = { type: "pod-call"; pod: string | null; again?: boolean };

export type SupportCaseCardData = {
  type: "support-case";
  caseId: string;
  kind: "issue" | "refund" | "escalation";
  /** Goodwill STORE CREDIT granted with the case (cents); never a card refund. */
  goodwillCents: number;
  urgent?: boolean;
};

export type GroupShareCardData = { type: "group-share"; code: string; url: string | null };

export type NativeCard =
  | PayCardData
  | ConfirmZeroCardData
  | SignInCardData
  | CartCardData
  | MenuItemCardData
  | OrderStatusCardData
  | RewardCardData
  | PodCallCardData
  | SupportCaseCardData
  | GroupShareCardData;

const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const optStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const cents = (v: unknown): number => (num(v) ? Math.round(v) : 0);
const pair = (v: unknown): { have: number; need: number } | null => {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  return o && num(o.have) && num(o.need) ? { have: o.have, need: o.need } : null;
};

/** The card as a typed native card, or null when it isn't one we can show (E1's fallback renders it). */
export function parseCard(card: ChappyCard): NativeCard | null {
  const c = card as Record<string, unknown>;
  switch (card.type) {
    case "pay":
      if (!str(c.orderId) || !str(c.clientSecret) || !/^pi_[A-Za-z0-9_]+_secret_[A-Za-z0-9]+$/.test(c.clientSecret)) return null;
      return {
        type: "pay",
        orderId: c.orderId,
        clientSecret: c.clientSecret,
        amountDueCents: num(c.amountDueCents) ? Math.round(c.amountDueCents) : null,
        currency: optStr(c.currency) ?? "usd",
        kitchenNumber: optStr(c.kitchenNumber),
        pod: optStr(c.pod),
      };
    case "confirm-zero":
      return str(c.orderId) ? { type: "confirm-zero", orderId: c.orderId, kitchenNumber: optStr(c.kitchenNumber), pod: optStr(c.pod) } : null;
    case "sign-in":
      return { type: "sign-in" };
    case "cart": {
      if (!Array.isArray(c.lines) || !num(c.totalCents)) return null;
      const lines = c.lines
        .filter((l): l is Record<string, unknown> => !!l && typeof l === "object" && str((l as Record<string, unknown>).menuItemId))
        .map((l) => ({
          menuItemId: l.menuItemId as string,
          name: optStr(l.name),
          imageKey: optStr(l.imageKey),
          quantity: num(l.quantity) ? l.quantity : 1,
          value: optStr(l.value),
          priceCents: cents(l.priceCents),
        }));
      if (!lines.length) return null;
      return {
        type: "cart",
        lines,
        subtotalCents: cents(c.subtotalCents),
        savingsCents: cents(c.savingsCents),
        taxCents: cents(c.taxCents),
        totalCents: cents(c.totalCents),
        creditCents: cents(c.creditCents),
        amountDueCents: num(c.amountDueCents) ? Math.round(c.amountDueCents) : cents(c.totalCents),
        location: optStr(c.location),
        arrival: optStr(c.arrival),
        pod: optStr(c.pod),
        podBest: c.podBest === true,
        partySize: num(c.partySize) && c.partySize > 0 ? c.partySize : 1,
      };
    }
    case "menu-item":
      if (!str(c.id) || !str(c.name) || !num(c.priceCents)) return null;
      return {
        type: "menu-item",
        id: c.id,
        name: c.name,
        description: optStr(c.description),
        priceCents: Math.round(c.priceCents),
        imageKey: optStr(c.imageKey),
        categoryType: optStr(c.categoryType),
        dietary: Array.isArray(c.dietary) ? c.dietary.filter((d): d is string => typeof d === "string") : [],
        spiceLevel: num(c.spiceLevel) ? Math.max(0, Math.round(c.spiceLevel)) : 0,
      };
    case "order-status":
      if (!str(c.orderId) || !str(c.status)) return null;
      return {
        type: "order-status",
        orderId: c.orderId,
        kitchenNumber: optStr(c.kitchenNumber),
        status: c.status,
        paid: c.paid === true,
        stage: optStr(c.stage),
        pod: optStr(c.pod),
        totalCents: num(c.totalCents) ? Math.round(c.totalCents) : null,
        // Only a same-site path: the card never links off the site.
        statusPath: str(c.statusPath) && c.statusPath.startsWith("/") && !c.statusPath.startsWith("//") ? c.statusPath : null,
      };
    case "reward":
      if (!str(c.tier)) return null;
      return {
        type: "reward",
        tier: c.tier,
        cashbackPct: num(c.cashbackPct) ? c.cashbackPct : 0,
        creditCents: cents(c.creditCents),
        expiringCents: cents(c.expiringCents),
        next: optStr(c.next),
        orders: pair(c.orders),
        referrals: pair(c.referrals),
        rewards: num(c.rewards) ? c.rewards : 0,
      };
    case "pod-call":
      return { type: "pod-call", pod: optStr(c.pod), again: c.again === true };
    case "support-case":
      if (!str(c.caseId)) return null;
      return {
        type: "support-case",
        caseId: c.caseId,
        kind: c.kind === "refund" || c.kind === "escalation" ? c.kind : "issue",
        goodwillCents: cents(c.goodwillCents),
        urgent: c.urgent === true,
      };
    case "group-share": {
      if (!str(c.code)) return null;
      let url: string | null = null;
      if (str(c.url)) {
        try {
          const u = new URL(c.url);
          url = u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
        } catch {
          url = null;
        }
      }
      return { type: "group-share", code: c.code, url };
    }
    default:
      return null;
  }
}

/**
 * Cards that restate the latest state (the cart after every change, the
 * order's status): within one of Chappy's turns only the last one shows.
 */
const LATEST_ONLY = new Set(["cart", "order-status", "reward"]);

export function visibleCards<T extends { type: string }>(cards: T[]): T[] {
  return cards.filter((card, i) => !LATEST_ONLY.has(card.type) || !cards.slice(i + 1).some((later) => later.type === card.type));
}
