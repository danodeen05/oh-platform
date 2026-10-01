/**
 * Chappy Chopstix - tools (Task B2).
 *
 * Seventeen tools, each a thin handler over a shared service. Money only
 * moves through the services, never here:
 *  - orders/service.js: quoteOrder (every price), createOrder (the order and
 *    its pod claim), createPaymentIntent (server amount, metadata.orderId),
 *    previewPod (what pickBestPod would pick, rolled back; nothing claimed).
 *  - support/caps.js grantGoodwill: store credit only, inside the owner's caps.
 *  - support/routes.js createSupportCase + notifyCase (honors SUPPORT_NOTIFY).
 *  - orders/pod-calls.js createPodCall, orders/group-routes.js createGroupOrder.
 * The only row this file (and cart.js) writes itself is the conversation's
 * cart. A source scan in __tests__/tools.test.js holds that line.
 *
 * Chappy never charges. checkout returns a pay card (web) or a payment-page
 * link (SMS); the customer's own tap pays, and POST /orders/:id/confirm-payment
 * verifies the PaymentIntent with Stripe before anything is PAID.
 *
 * Identity: ctx.userId is the verified member (null for a guest). Member
 * tools refuse a guest with SIGN_IN_REQUIRED and a sign-in card before any
 * database access. Orders are always looked up with userId in the where
 * clause, so another member's order is simply NOT_FOUND.
 *
 * ctx: { prisma (basePrisma, never the demo-wrapped client), identity,
 *   userId, locationId, tenantId, channel, locale, conversationId, stripe,
 *   notify: {env, log, sendSMS, sendGraphMail}, webBaseUrl, now }
 *
 * Every schema is strict: closed objects, every property required, no
 * unions ("" and 0 mean "none"), short enums. That keeps the compiled
 * grammar small enough for all seventeen (the API caps strict tools at 20).
 */
import { quoteOrder, createOrder, createPaymentIntent, previewPod, OrderError, PodUnavailableError } from "../orders/service.js";
import { createGroupOrder } from "../orders/group-routes.js";
import { createPodCall, PodCallError } from "../orders/pod-calls.js";
import { earlyAccessVisible, profileForUser } from "../membership/engine.js";
import { publicProgram, PROGRAM } from "../membership/program.js";
import { grantGoodwill } from "../support/caps.js";
import { createSupportCase, notifyCase } from "../support/routes.js";
import { slotsFor, canAcceptOrders, weeklyHours } from "../utils/operating-hours.js";
import { loadCart, saveCart, applyCartOp, replaceItems, cartLines, CartError, CART_OPS } from "./cart.js";
import { toStrictToolDefs, validateToolInput } from "./tool-schema.js";

export { validateToolInput };

const MENU_CATEGORIES = ["ALL", "MAIN", "SLIDER", "ADDON", "SIDE", "DRINK", "DESSERT"];
const DIETARY = ["any", "vegetarian", "vegan", "gluten_free"];
const ISSUE_CATEGORIES = ["cold_food", "wrong_item", "missing_item", "pod_problem", "payment", "unwell", "other"];
/** Problems with the food itself: the ones capped goodwill can make up for. */
const GOODWILL_CATEGORIES = new Set(["cold_food", "wrong_item", "missing_item"]);
/** Problems staff can fix at the pod right now. */
const POD_CALL_CATEGORIES = new Set(["cold_food", "wrong_item", "missing_item", "pod_problem", "other"]);
const ACTIVE_POD_STATUSES = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING"];
const IN_POD_WINDOW_MS = 4 * 60 * 60 * 1000;
const SUMMARY_MAX = 1000;
/** The order status page's stages (mirrors @oh/floor-plan PHONE_STAGES; the API never imports that package). */
const PHONE_STAGES = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"];

const S = (description) => ({ type: "string", description });
const I = (description) => ({ type: "integer", description });
const E = (values, description) => ({ type: "string", enum: values, description });
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

export const CHAPPY_TOOLS = [
  // ---- public ----
  {
    name: "search_menu",
    description: "Search the menu. Returns item ids, names, prices and dietary flags for what this customer can order now. Use the ids with get_menu_item and cart.",
    input_schema: obj({
      query: S('Words to match in the item name or description, or "" for everything.'),
      category: E(MENU_CATEGORIES, "ALL, or one category. A bowl is one MAIN soup; SLIDER items are free per-bowl choices (noodle firmness is the Noodle Texture slider)."),
      dietary: E(DIETARY, "any, or a dietary filter."),
    }),
  },
  {
    name: "get_menu_item",
    description: "Full details for one menu item: description, allergens, spice level, and the options a SLIDER item takes.",
    input_schema: obj({ itemId: S("The menu item id from search_menu.") }),
  },
  {
    name: "get_locations",
    description:
      "Locations with their opening hours (open now, today's open and close, the whole week; 24-hour local times in their timezone, close is when the doors close, a closed day says closed), whether online ordering is open, free pods right now, and today's arrival slots. Use it for any question about hours, closing time or whether a location is open.",
    input_schema: obj({}),
  },
  {
    name: "get_membership_program",
    description: "The membership program: tiers, cashback, how to move up, referrals, early access, credit expiry.",
    input_schema: obj({}),
  },
  // ---- signed-in members ----
  {
    name: "get_my_profile",
    description: "The member's tier, progress to the next tier, spendable store credit, credit expiring soon, and active rewards (with ids for apply_savings).",
    input_schema: obj({}),
  },
  {
    name: "get_my_orders",
    description: "The member's five most recent orders, plus `unpaid`: their orders still waiting to be paid (any age, newest first), each with its paymentLink.",
    input_schema: obj({}),
  },
  {
    name: "get_order_status",
    description: "Status of one of the member's own orders: kitchen status, payment, pod, arrival, items. An unpaid order includes its paymentLink (the page where they pay it).",
    input_schema: obj({ orderId: S('The order id, or "" for their most recent order.') }),
  },
  {
    name: "get_usual_order",
    description: "The member's most frequently ordered bowl, from their paid orders.",
    input_schema: obj({}),
  },
  {
    name: "reorder",
    description: 'Replace the cart with a past order\'s items. Returns the new cart and its price. orderId "" means their usual order: no need to call get_usual_order first.',
    input_schema: obj({ orderId: S('One of the member\'s order ids, or "" for their usual order.') }),
  },
  {
    name: "cart",
    description:
      "Change or view the member's cart. One order is one person's bowl (one MAIN soup, options, add-ons, sides, drinks); quantity is servings of that item in it. Every result includes the server's price for the cart; quote prices only from here.",
    input_schema: obj({
      op: E([...CART_OPS], "add, remove, set_quantity (0 removes), clear, or view."),
      menuItemId: S('The menu item id, or "" for clear and view.'),
      quantity: I("Servings to add, or the new servings for set_quantity. 0 for remove, clear and view."),
      option: S('The chosen option for a SLIDER item (from get_menu_item), or "".'),
    }),
  },
  {
    name: "set_arrival_and_pod",
    description:
      'Choose the location, arrival time and pod for the cart. Checks the time against today\'s slots and checks the pod is free right now; the pod is only held once the order is placed. locationId "" keeps the cart\'s location, arrival "ASAP" and pod "best" need no get_locations call first.',
    input_schema: obj({
      locationId: S('A location id from get_locations, or "" for the current one.'),
      arrival: S('"ASAP", or a time today as HH:MM (24 hour, location time), or an exact slot from get_locations.'),
      pod: S('"best" (nearest free pod to the entry), a pod label like "B-07", or "none" to be seated at check-in.'),
      partySize: I("1 to 8. Two or more get a duo pod when one is free."),
    }),
  },
  {
    name: "apply_savings",
    description: "Choose store credit, a promo code or a reward for the cart and return the new price. Nothing is spent until the customer pays.",
    input_schema: obj({
      useCreditsCents: I("Store credit to use, in cents. 0 for none. The order service caps it per order."),
      promoCode: S('A promo code, or "".'),
      rewardId: S('A reward id from get_my_profile, or "".'),
    }),
  },
  {
    name: "checkout",
    description:
      "Place the order from the cart and hand the customer a pay card. Only after you showed the items and total and the customer said yes to paying. This never charges anything: the customer pays with their own tap on the card (on SMS, a payment link).",
    input_schema: obj({ confirmed: { type: "boolean", description: "true only if the customer explicitly agreed to this cart and total in this conversation." } }),
  },
  {
    name: "start_group_order",
    description: "Start a group order the member hosts at a location, and return a link to share with the group.",
    input_schema: obj({ locationId: S('A location id, or "" for the cart\'s or current location.') }),
  },
  // ---- support ----
  {
    name: "report_issue",
    description:
      "Report a problem. If the customer is in their pod now, staff are called to the pod. Otherwise a support case is opened and, for a problem with a recent meal, store credit may be added automatically within fixed limits. Never promise an amount before the result says so.",
    input_schema: obj({
      category: E(ISSUE_CATEGORIES, "What kind of problem."),
      summary: S("What happened, in the customer's words, briefly."),
      orderId: S('The order it is about, or "" for their most recent order.'),
      contact: S('For a guest: an email or phone number to reach them. "" for members.'),
    }),
  },
  {
    name: "request_refund",
    description: "Ask staff to review a card refund for a whole order. Opens a case; staff decide. Moves no money and never names an amount.",
    input_schema: obj({
      orderId: S('The member\'s order id, or "" for their most recent paid order.'),
      reason: S("Why, briefly."),
    }),
  },
  {
    name: "escalate_to_human",
    description: "Hand the conversation to a person now: safety, health, an upset customer, or anything you cannot fix. Opens an urgent case and alerts staff.",
    input_schema: obj({
      summary: S("What the customer needs, briefly."),
      contact: S('For a guest: an email or phone number. "" for members.'),
    }),
  },
];

/** Tools that need a verified member (ctx.userId). */
export const MEMBER_TOOLS = Object.freeze([
  "get_my_profile",
  "get_my_orders",
  "get_order_status",
  "get_usual_order",
  "reorder",
  "cart",
  "set_arrival_and_pod",
  "apply_savings",
  "checkout",
  "start_group_order",
  "request_refund",
]);
const MEMBER_SET = new Set(MEMBER_TOOLS);

/**
 * SMS (controller ruling, fix round 1): read tools, ordering that ends in a
 * payment link, refund requests, escalation, and report_issue WITHOUT
 * automatic goodwill (staff decide). Enforced here by ctx.channel, not only
 * in the prompt.
 */
export const SMS_TOOLS = Object.freeze([
  "search_menu",
  "get_menu_item",
  "get_locations",
  "get_membership_program",
  "get_my_orders",
  "get_order_status",
  "get_usual_order",
  "cart",
  "set_arrival_and_pod",
  "checkout",
  "report_issue",
  "request_refund",
  "escalate_to_human",
]);
const SMS_SET = new Set(SMS_TOOLS);

// ---------------------------------------------------------------------------
// Helpers

const nowOf = (ctx) => (ctx.now instanceof Date ? ctx.now : new Date());
const clean = (v) => (typeof v === "string" ? v.trim() : "");
const dollars = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

function signInRequired() {
  return { error: "SIGN_IN_REQUIRED", message: "This needs a signed-in account.", card: { type: "sign-in" } };
}

class ToolError extends Error {
  constructor(code, message = code, extra = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}

async function tenantIdOf(ctx) {
  if (ctx.tenantId) return ctx.tenantId;
  const tenant = await ctx.prisma.tenant.findUnique({ where: { slug: "oh" } });
  return tenant?.id || null;
}

async function callerTier(ctx) {
  if (!ctx.userId) return null;
  const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
  return user?.membershipTier || null;
}

const LOCALE_SUFFIX = { "zh-TW": "ZhTW", "zh-CN": "ZhCN", es: "Es" };
function localized(item, field, locale) {
  const suffix = LOCALE_SUFFIX[locale];
  return (suffix && item[`${field}${suffix}`]) || item[field] || null;
}

function sliderOptions(item) {
  const labels = item?.sliderConfig && Array.isArray(item.sliderConfig.labels) ? item.sliderConfig.labels : null;
  return labels ? labels.filter((l) => typeof l === "string") : null;
}

function menuSummary(item, locale) {
  return {
    id: item.id,
    name: localized(item, "name", locale),
    price: dollars(item.basePriceCents),
    categoryType: item.categoryType || null,
    dietary: [item.isVegetarian && "vegetarian", item.isVegan && "vegan", item.isGlutenFree && "gluten_free"].filter(Boolean),
    spiceLevel: item.spiceLevel ?? 0,
  };
}

/**
 * The member's own order, or null. Never another member's. With no id, their
 * most recent one (most recent PAID one when `paidOnly`: a complaint or a
 * refund is about a meal they paid for, not a checkout they just started).
 */
async function ownOrder(ctx, orderId, { paidOnly = false } = {}) {
  const id = clean(orderId);
  if (id) return ctx.prisma.order.findFirst({ where: { id, userId: ctx.userId } });
  return ctx.prisma.order.findFirst({ where: { userId: ctx.userId, ...(paidOnly ? { paymentStatus: "PAID" } : {}) }, orderBy: { createdAt: "desc" } });
}

async function namesFor(prisma, ids) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await prisma.menuItem.findMany({ where: { id: { in: unique } } });
  return new Map(rows.map((m) => [m.id, m]));
}

async function orderLines(ctx, orderId) {
  const items = await ctx.prisma.orderItem.findMany({ where: { orderId } });
  const menu = await namesFor(ctx.prisma, items.map((i) => i.menuItemId));
  return items.map((i) => ({
    menuItemId: i.menuItemId,
    name: menu.has(i.menuItemId) ? localized(menu.get(i.menuItemId), "name", ctx.locale) : null,
    quantity: i.quantity,
    selectedValue: i.selectedValue || null,
  }));
}

/**
 * A SLIDER line's value as the customer reads it (Task E2): the stored
 * `selectedValue` is the canonical English label; the display text is the
 * same index in `sliderConfig.labelsI18n[locale]` when that array lines up
 * (the F1a displayLabels rule), else the label itself.
 */
function displayValue(item, value, locale) {
  if (!value) return null;
  const cfg = item?.sliderConfig;
  const labels = Array.isArray(cfg?.labels) ? cfg.labels : null;
  const i = labels ? labels.indexOf(value) : -1;
  const loc = locale && locale !== "en" && cfg?.labelsI18n ? cfg.labelsI18n[locale] : null;
  if (i >= 0 && Array.isArray(loc) && loc.length === labels.length && typeof loc[i] === "string" && loc[i]) return loc[i];
  return value;
}

/** A location's name in the caller's locale (Location.i18n, the F1a rule: English is the row's own column). */
function locationName(location, locale) {
  if (!location) return null;
  const copy = locale && locale !== "en" && location.i18n && typeof location.i18n === "object" ? location.i18n[locale] : null;
  return (copy && typeof copy.name === "string" && copy.name) || location.name || null;
}

/**
 * The web cart card (Task E2): display only, built from the server quote.
 * `imageKey` is the item's English name, the key lib/menu-images.ts maps.
 * Money is cents; the widget formats it. Nothing here is input to anything.
 */
async function cartCard(ctx, cart, quote) {
  const menu = await namesFor(ctx.prisma, quote.lines.map((l) => l.menuItemId));
  const locationId = cartLocation(ctx, cart);
  const location = locationId ? await ctx.prisma.location.findUnique({ where: { id: locationId } }) : null;
  const tz = location?.timezone || PROGRAM.timezone;
  const arrival = cart.arrival ? new Date(cart.arrival) : null;
  const d = quote.discounts || {};
  return {
    type: "cart",
    currency: "usd",
    lines: quote.lines.map((l) => {
      const m = menu.get(l.menuItemId) || null;
      return {
        menuItemId: l.menuItemId,
        name: m ? localized(m, "name", ctx.locale) : null,
        imageKey: m ? m.name : null,
        quantity: l.quantity,
        value: displayValue(m, l.selectedValue, ctx.locale),
        priceCents: l.priceCents,
      };
    }),
    subtotalCents: quote.subtotalCents,
    savingsCents: (d.promoCents || 0) + (d.rewardCents || 0),
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    creditCents: (d.creditsCents || 0) + (d.giftCardCents || 0) + (d.mealGiftCents || 0),
    amountDueCents: quote.amountDueCents,
    location: locationName(location, ctx.locale),
    arrival: arrival && !Number.isNaN(arrival.getTime()) ? localHm(arrival, tz) : null,
    pod: cart.pod ? cart.pod.label || null : null,
    podBest: Boolean(cart.pod && cart.pod.best),
    partySize: cart.partySize || 1,
  };
}

/** A quote the model can read: named lines and the server's totals. */
async function quoteView(ctx, quote) {
  const menu = await namesFor(ctx.prisma, quote.lines.map((l) => l.menuItemId));
  return {
    lines: quote.lines.map((l) => ({
      menuItemId: l.menuItemId,
      name: menu.has(l.menuItemId) ? localized(menu.get(l.menuItemId), "name", ctx.locale) : null,
      quantity: l.quantity,
      selectedValue: l.selectedValue || null,
      priceCents: l.priceCents,
    })),
    subtotalCents: quote.subtotalCents,
    discounts: quote.discounts,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    amountDueCents: quote.amountDueCents,
    total: dollars(quote.totalCents),
    amountDue: dollars(quote.amountDueCents),
    warnings: quote.warnings,
  };
}

const cartLocation = (ctx, cart) => cart.locationId || ctx.locationId || null;

/** The order's own payment page (not a secret; the page checks who pays). */
function paymentLinkFor(ctx, order) {
  return `${ctx.webBaseUrl || "https://www.ohbeef.com"}/${ctx.locale || "en"}/order/payment?orderId=${encodeURIComponent(order.id)}&orderNumber=${encodeURIComponent(order.orderNumber)}`;
}

/** Still waiting to be paid: not paid, not cancelled, and a server-quoted amount (a legacy order can't be paid). */
const payable = (o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED" && o.amountDueCents !== null && o.amountDueCents !== undefined;

function quoteCart(ctx, cart) {
  return quoteOrder(ctx.prisma, {
    locationId: cartLocation(ctx, cart),
    items: cartLines(cart),
    userId: ctx.userId,
    promoCode: cart.savings.promoCode || undefined,
    useCreditsCents: cart.savings.useCreditsCents || undefined,
    rewardId: cart.savings.rewardId || undefined,
    now: nowOf(ctx),
  });
}

/** Prices the cart first and stores it only if the order service accepts it. */
async function commitCart(ctx, next) {
  const quote = next.items.length ? await quoteCart(ctx, next) : null;
  const saved = await saveCart(ctx.prisma, ctx.conversationId, next);
  if (!quote) return { cart: saved, quote: null };
  return { cart: saved, quote: await quoteView(ctx, quote), card: await cartCard(ctx, saved, quote) };
}

function localDate(now, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function localHm(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function slotView(slot, timeZone) {
  return { at: slot.toISOString(), local: localHm(slot, timeZone) };
}

async function findLocation(ctx, locationId) {
  const id = clean(locationId) || ctx.locationId;
  if (!id) return null;
  const location = await ctx.prisma.location.findUnique({ where: { id }, include: { cateringEvent: true } });
  const tenantId = await tenantIdOf(ctx);
  // Only an open restaurant location (not closed, not a catering event's pseudo-location).
  if (!location || location.isClosed || location.cateringEvent || (tenantId && location.tenantId !== tenantId)) return null;
  return location;
}

/** Where and when the cart's visit is: what the customer confirms along with the total. */
async function visitView(ctx, cart) {
  const locationId = cartLocation(ctx, cart);
  const location = locationId ? await ctx.prisma.location.findUnique({ where: { id: locationId } }) : null;
  const tz = location?.timezone || PROGRAM.timezone;
  const arrival = cart.arrival ? new Date(cart.arrival) : null;
  return {
    location: location ? location.name : null,
    arrival: arrival && !Number.isNaN(arrival.getTime()) ? slotView(arrival, tz) : "ASAP",
    pod: cart.pod ? cart.pod.label || "best available" : "assigned at check-in",
    partySize: cart.partySize,
  };
}

function parseContact(raw) {
  const v = clean(raw);
  if (!v) return null;
  return v.includes("@") ? { email: v } : { phone: v };
}

/** Who the support case is for, and how to reach a guest. */
function caseWho(ctx, contactInput) {
  if (ctx.userId) return { who: { kind: "user", userId: ctx.userId }, contact: parseContact(contactInput) };
  const contact = parseContact(contactInput) || (ctx.identity?.kind === "sms" && ctx.identity.phone ? { phone: ctx.identity.phone } : null);
  if (!contact) throw new ToolError("CONTACT_REQUIRED", "Ask for an email or phone number so the team can reach them.");
  return { who: { kind: "anonymous" }, contact };
}

/**
 * Case-spam cap (Task B3, carried from the B2 review; fix round 1 made the
 * cap SHARED rather than per tool, per the controller ruling): report_issue,
 * request_refund and escalate_to_human together may open at most 3
 * SupportCases per identity per day, IN TOTAL. `tool` is the calling tool's
 * name (passed through for logging/limits.js's signature; it's no longer
 * part of the cap key). ctx.checkCaseLimit/recordCase are optional (a caller
 * without them, e.g. an older test fixture, sees no cap).
 */
async function openCase(ctx, { type, tool, summary, orderId = null, contactInput = "" }) {
  const text = clean(summary).slice(0, SUMMARY_MAX);
  if (!text) throw new ToolError("SUMMARY_REQUIRED", "Describe the problem briefly.");
  if (ctx.checkCaseLimit) {
    const allowed = ctx.checkCaseLimit({ identity: ctx.identity, tool, now: nowOf(ctx) });
    if (!allowed.ok) {
      throw new ToolError("CASE_LIMIT", "Staff already have your earlier case today and will follow up. No need to send another.");
    }
  }
  const { who, contact } = caseWho(ctx, contactInput);
  const created = await createSupportCase(ctx.prisma, {
    who,
    body: { type, summary: `[Chappy] ${text}`, orderId: orderId || null, locale: ctx.locale || null, ...(contact ? { contact } : {}) },
  });
  ctx.recordCase?.({ identity: ctx.identity, tool, now: nowOf(ctx) });
  return created;
}

async function notify(ctx, supportCase, opts) {
  try {
    return await notifyCase(ctx.notify || {}, supportCase, opts);
  } catch (err) {
    console.error("[Chappy] notifyCase failed:", err?.message);
    return null;
  }
}

function caseCard(c, extra = {}) {
  return { type: "support-case", caseId: c.id, ...extra };
}

// ---------------------------------------------------------------------------
// Handlers

export const HANDLERS = {
  async search_menu(input, ctx) {
    const tenantId = await tenantIdOf(ctx);
    const tier = await callerTier(ctx);
    const now = nowOf(ctx);
    const q = clean(input.query).toLowerCase();
    const rows = await ctx.prisma.menuItem.findMany({ where: { tenantId, isAvailable: true }, orderBy: { displayOrder: "asc" } });
    const items = rows
      .filter((m) => earlyAccessVisible(m, tier, now))
      .filter((m) => input.category === "ALL" || m.categoryType === input.category)
      .filter((m) => input.dietary === "any" || (input.dietary === "vegetarian" && m.isVegetarian) || (input.dietary === "vegan" && m.isVegan) || (input.dietary === "gluten_free" && m.isGlutenFree))
      .filter((m) => !q || [m.name, m.nameZhTW, m.nameZhCN, m.nameEs, m.description].some((s) => typeof s === "string" && s.toLowerCase().includes(q)))
      .slice(0, 40)
      .map((m) => menuSummary(m, ctx.locale));
    return { items };
  },

  async get_menu_item(input, ctx) {
    const tenantId = await tenantIdOf(ctx);
    const item = clean(input.itemId) ? await ctx.prisma.menuItem.findUnique({ where: { id: clean(input.itemId) } }) : null;
    if (!item || !item.isAvailable || item.tenantId !== tenantId || !earlyAccessVisible(item, await callerTier(ctx), nowOf(ctx))) return { error: "NOT_FOUND" };
    const summary = menuSummary(item, ctx.locale);
    const description = localized(item, "description", ctx.locale);
    return {
      ...summary,
      priceCents: item.basePriceCents,
      extraServingPriceCents: item.additionalPriceCents || 0,
      includedQuantity: item.includedQuantity || 0,
      description,
      allergens: item.allergens || null,
      options: sliderOptions(item),
      card: {
        type: "menu-item",
        id: item.id,
        name: summary.name,
        description: description ? String(description).slice(0, 280) : null,
        priceCents: item.basePriceCents || 0,
        imageKey: item.name,
        categoryType: summary.categoryType,
        dietary: summary.dietary,
        spiceLevel: summary.spiceLevel,
      },
    };
  },

  async get_locations(_input, ctx) {
    const tenantId = await tenantIdOf(ctx);
    const now = nowOf(ctx);
    const rows = await ctx.prisma.location.findMany({ where: { tenantId, isClosed: false }, include: { cateringEvent: true } });
    const locations = [];
    // Per-event catering pseudo-locations are never restaurant locations.
    for (const l of rows.filter((r) => !r.cateringEvent)) {
      const tz = l.timezone || PROGRAM.timezone;
      const freePods = await ctx.prisma.seat.count({ where: { locationId: l.id, status: "AVAILABLE", retiredAt: null } });
      locations.push({
        id: l.id,
        name: l.name,
        city: l.city || null,
        ...weeklyHours({ ...l, timezone: tz }, now),
        orderingOpen: canAcceptOrders(l, now),
        freePods,
        slots: slotsFor(l, localDate(now, tz), now).slice(0, 12).map((s) => slotView(s, tz)),
      });
    }
    return { locations };
  },

  async get_membership_program() {
    return publicProgram();
  },

  async get_my_profile(_input, ctx) {
    const p = await profileForUser(ctx.prisma, ctx.userId, nowOf(ctx));
    if (!p) return { error: "NOT_FOUND" };
    return {
      tier: p.tier,
      cashbackPct: p.cashbackPct,
      progress: p.progress,
      creditCents: p.credits,
      credit: dollars(p.credits),
      expiringSoon: p.expiring,
      rewards: p.rewards.map((r) => ({ id: r.id, type: r.type, usableUntil: r.windowEndsAt })),
      badges: p.badges.length,
      card: {
        type: "reward",
        tier: p.tier,
        cashbackPct: p.cashbackPct,
        creditCents: p.credits || 0,
        expiringCents: (p.expiring || []).reduce((sum, lot) => sum + (lot.remainingCents || 0), 0),
        next: p.progress?.next || null,
        orders: p.progress?.orders ? { have: p.progress.orders.have, need: p.progress.orders.need } : null,
        referrals: p.progress?.referrals ? { have: p.progress.referrals.have, need: p.progress.referrals.need } : null,
        rewards: p.rewards.length,
      },
    };
  },

  async get_my_orders(_input, ctx) {
    const rows = await ctx.prisma.order.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 5 });
    // An unpaid order can sit behind newer paid ones: list those separately so "pay my pending order" is one step.
    const pending = (await ctx.prisma.order.findMany({ where: { userId: ctx.userId, paymentStatus: { not: "PAID" } }, orderBy: { createdAt: "desc" }, take: 10 }))
      .filter(payable)
      .slice(0, 3);
    return {
      unpaid: pending.map((o) => ({ id: o.id, orderNumber: o.orderNumber, total: dollars(o.totalCents), createdAt: o.createdAt, paymentLink: paymentLinkFor(ctx, o) })),
      orders: rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: dollars(o.totalCents),
        createdAt: o.createdAt,
        ...(payable(o) ? { paymentLink: paymentLinkFor(ctx, o) } : {}),
      })),
    };
  },

  async get_order_status(input, ctx) {
    const order = await ownOrder(ctx, input.orderId);
    if (!order) return { error: "NOT_FOUND" };
    const seat = order.seatId ? await ctx.prisma.seat.findUnique({ where: { id: order.seatId } }) : null;
    const pod = seat ? seat.label || seat.number : null;
    const paid = order.paymentStatus === "PAID";
    return {
      card: {
        type: "order-status",
        orderId: order.id,
        kitchenNumber: order.kitchenOrderNumber || null,
        status: order.status,
        paid,
        stage: paid && PHONE_STAGES.includes(order.status) ? order.status : paid ? null : "UNPAID",
        pod,
        totalCents: order.totalCents,
        statusPath: paid && order.orderQrCode ? `/${ctx.locale || "en"}/order/status?orderQrCode=${encodeURIComponent(order.orderQrCode)}` : null,
      },
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: dollars(order.totalCents),
      amountDue: order.amountDueCents === null || order.amountDueCents === undefined ? null : dollars(order.amountDueCents),
      pod,
      estimatedArrival: order.estimatedArrival || null,
      ...(payable(order) ? { paymentLink: paymentLinkFor(ctx, order) } : {}),
      items: await orderLines(ctx, order.id),
    };
  },

  async get_usual_order(_input, ctx) {
    const paid = await ctx.prisma.order.findMany({ where: { userId: ctx.userId, paymentStatus: "PAID" }, orderBy: { createdAt: "desc" }, take: 20 });
    if (!paid.length) return { items: [], message: "No paid orders yet." };
    const counts = new Map();
    for (const o of paid) {
      const lines = await ctx.prisma.orderItem.findMany({ where: { orderId: o.id } });
      const key = lines.map((l) => `${l.menuItemId}:${l.quantity}:${l.selectedValue || ""}`).sort().join("|");
      if (!key) continue;
      const cur = counts.get(key) || { n: 0, orderId: o.id };
      cur.n += 1;
      counts.set(key, cur);
    }
    let best = null;
    for (const v of counts.values()) if (!best || v.n > best.n) best = v;
    if (!best) return { items: [], message: "No paid orders yet." };
    return { orderId: best.orderId, timesOrdered: best.n, items: await orderLines(ctx, best.orderId) };
  },

  async reorder(input, ctx) {
    let orderId = clean(input.orderId);
    if (!orderId) {
      const usual = await HANDLERS.get_usual_order({}, ctx);
      if (!usual.orderId) return { error: "NO_USUAL_ORDER" };
      orderId = usual.orderId;
    }
    const order = await ownOrder(ctx, orderId);
    if (!order) return { error: "NOT_FOUND" };
    const lines = await ctx.prisma.orderItem.findMany({ where: { orderId: order.id } });
    const cart = await loadCart(ctx.prisma, ctx.conversationId);
    const next = replaceItems({ ...cart, locationId: cart.locationId || order.locationId }, lines.filter((l) => l.quantity > 0).map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, selectedValue: l.selectedValue || null })));
    return commitCart(ctx, next);
  },

  async cart(input, ctx) {
    const cart = await loadCart(ctx.prisma, ctx.conversationId);
    const next = applyCartOp({ ...cart, locationId: cartLocation(ctx, cart) }, input);
    return commitCart(ctx, next);
  },

  async set_arrival_and_pod(input, ctx) {
    const cart = await loadCart(ctx.prisma, ctx.conversationId);
    const location = await findLocation(ctx, clean(input.locationId) || cart.locationId);
    if (!location) return { error: "LOCATION_NOT_FOUND" };
    const now = nowOf(ctx);
    const tz = location.timezone || PROGRAM.timezone;

    // Arrival: ASAP, or one of today's slots (America/Denver by default).
    const want = clean(input.arrival);
    let arrival = null;
    if (want && want.toUpperCase() !== "ASAP") {
      const slots = slotsFor(location, localDate(now, tz), now);
      const hm = /^\d{1,2}:\d{2}$/.test(want) ? want.padStart(5, "0") : null;
      const at = hm ? null : new Date(want);
      const match = slots.find((s) => (hm ? localHm(s, tz) === hm : at && !Number.isNaN(at.getTime()) && s.getTime() === at.getTime()));
      if (!match) {
        return { error: "ARRIVAL_INVALID", message: "That time is not an open arrival slot today.", slots: slots.slice(0, 12).map((s) => slotView(s, tz)) };
      }
      arrival = match;
    }

    const partySize = Number.isInteger(input.partySize) && input.partySize >= 1 ? Math.min(8, input.partySize) : 1;
    const podInput = clean(input.pod);
    let pod = null;
    let preview = null;
    if (podInput && podInput.toLowerCase() !== "none") {
      pod = podInput.toLowerCase() === "best" ? { best: true } : { label: podInput.toUpperCase() };
      try {
        // The order service's own pick, rolled back: nothing is claimed until checkout.
        preview = await previewPod(ctx.prisma, { locationId: location.id, arrival, partySize, requestedLabel: pod.label || null });
      } catch (err) {
        if (!(err instanceof PodUnavailableError)) throw err;
        if (pod.label) return { error: "POD_UNAVAILABLE", message: `Pod ${pod.label} is not free right now.`, label: pod.label };
        preview = null; // best with nothing free: seated at check-in
      }
    }

    const saved = await saveCart(ctx.prisma, ctx.conversationId, { ...cart, locationId: location.id, arrival: arrival ? arrival.toISOString() : null, pod, partySize });
    // The cart card with the visit on it (the previewed pod label, when there is one).
    let card = null;
    if (saved.items.length) {
      try {
        const quote = await quoteCart(ctx, saved);
        card = await cartCard(ctx, { ...saved, pod: preview ? { label: preview.seat.label || preview.seat.number } : saved.pod }, quote);
      } catch (err) {
        if (!(err instanceof OrderError)) throw err; // a refused quote: checkout says why
      }
    }
    return {
      ...(card ? { card } : {}),
      location: { id: location.id, name: location.name },
      arrival: arrival ? slotView(arrival, tz) : "ASAP",
      partySize: saved.partySize,
      pod: preview ? { label: preview.seat.label || preview.seat.number, duo: Boolean(preview.partner) } : null,
      note: preview
        ? "The pod is free now and is held once the order is placed."
        : pod
          ? "No pod is free right now; one is assigned at check-in."
          : "A pod is assigned at check-in.",
    };
  },

  async apply_savings(input, ctx) {
    const cart = await loadCart(ctx.prisma, ctx.conversationId);
    if (!cart.items.length) return { error: "CART_EMPTY" };
    const next = {
      ...cart,
      locationId: cartLocation(ctx, cart),
      savings: {
        useCreditsCents: Number.isInteger(input.useCreditsCents) && input.useCreditsCents > 0 ? input.useCreditsCents : 0,
        promoCode: clean(input.promoCode) || null,
        rewardId: clean(input.rewardId) || null,
      },
    };
    const result = await commitCart(ctx, next);
    return { savings: result.cart.savings, quote: result.quote };
  },

  async checkout(input, ctx) {
    const cart = await loadCart(ctx.prisma, ctx.conversationId);
    if (!cart.items.length) return { error: "CART_EMPTY" };
    const quote = await quoteCart(ctx, cart);
    if (input.confirmed !== true) {
      return {
        error: "NEEDS_CONFIRMATION",
        message: "Show the items, total, location, arrival and pod, and get a clear yes first.",
        quote: await quoteView(ctx, quote),
        visit: await visitView(ctx, cart),
        card: await cartCard(ctx, cart, quote),
      };
    }
    const locationId = cartLocation(ctx, cart);
    const order = await createOrder(ctx.prisma, {
      quote,
      locationId,
      tenantId: await tenantIdOf(ctx),
      userId: ctx.userId,
      estimatedArrival: cart.arrival,
      seatRequest: cart.pod,
      partySize: cart.partySize,
      source: "CHAPPY",
      now: nowOf(ctx),
    });
    // The order exists now; the cart starts fresh (a retry can't place it twice).
    await saveCart(ctx.prisma, ctx.conversationId, { ...cart, items: [], pod: null, arrival: null, savings: {}, lastOrderId: order.id });

    const seat = order.seatId ? await ctx.prisma.seat.findUnique({ where: { id: order.seatId } }) : null;
    const summary = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountDueCents: order.amountDueCents,
      amountDue: dollars(order.amountDueCents),
      pod: seat ? seat.label || seat.number : null,
      charged: false,
    };
    // What the pay card shows beside the amount (Task E2): the kitchen number and the held pod.
    const payInfo = { kitchenNumber: order.kitchenOrderNumber || null, pod: summary.pod };
    const paymentLink = paymentLinkFor(ctx, order);

    if (ctx.channel === "sms") {
      return { ...summary, paymentLink, message: "Send this payment link. The order is paid only when they pay on that page." };
    }
    let pi;
    try {
      // Card, Apple Pay and Google Pay only: the chat pay card never sends the customer off the page.
      pi = await createPaymentIntent(ctx.prisma, ctx.stripe, { orderId: order.id, userId: ctx.userId, noRedirects: true, now: nowOf(ctx) });
    } catch (err) {
      // The order exists either way: give the customer the payment page so they can still pay.
      if (err instanceof OrderError) return { ...summary, error: err.code, message: err.message, paymentLink };
      console.error(`[Chappy] createPaymentIntent failed for order ${order.id}:`, err?.message);
      return { ...summary, error: "PAYMENT_SETUP_FAILED", message: "The pay card could not be prepared. Send the payment link instead.", paymentLink };
    }
    if (!pi.clientSecret) {
      return { ...summary, paymentLink, card: { type: "confirm-zero", orderId: order.id, ...payInfo }, message: "Nothing to pay. They tap Place order to confirm." };
    }
    return {
      ...summary,
      // Not a secret: the order's own payment page, for when the card is no longer on screen (a reload).
      paymentLink,
      card: { type: "pay", orderId: order.id, clientSecret: pi.clientSecret, amountDueCents: pi.amountDueCents, currency: "usd", ...payInfo },
      message: "The pay card is showing. Nothing is charged until they tap Pay.",
    };
  },

  async start_group_order(input, ctx) {
    const cart = await loadCart(ctx.prisma, ctx.conversationId);
    const locationId = clean(input.locationId) || cartLocation(ctx, cart);
    const location = await findLocation(ctx, locationId);
    if (!location) return { error: "LOCATION_NOT_FOUND" };
    const result = await createGroupOrder(ctx.prisma, { hostUserId: ctx.userId, locationId: location.id, estimatedArrival: cart.arrival, now: nowOf(ctx) });
    if (result.error) return { error: "GROUP_CREATE_FAILED", message: result.error };
    const url = `${ctx.webBaseUrl || "https://www.ohbeef.com"}/${ctx.locale || "en"}/group/${result.group.code}`;
    return { code: result.group.code, url, location: location.name, card: { type: "group-share", code: result.group.code, url } };
  },

  async report_issue(input, ctx) {
    const now = nowOf(ctx);
    if (!clean(input.summary)) return { error: "SUMMARY_REQUIRED" };

    const sms = ctx.channel === "sms";
    if (ctx.userId && !sms && POD_CALL_CATEGORIES.has(input.category)) {
      // Sitting in the pod right now (arrival confirmed, order still open): staff come to the pod. No credit.
      const live = await ctx.prisma.order.findFirst({
        where: {
          userId: ctx.userId,
          paymentStatus: "PAID",
          seatId: { not: null },
          status: { in: ACTIVE_POD_STATUSES },
          OR: [{ podConfirmedAt: { not: null } }, { arrivedAt: { not: null } }],
          createdAt: { gte: new Date(now.getTime() - IN_POD_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (live && (!clean(input.orderId) || clean(input.orderId) === live.id)) {
        const seat = await ctx.prisma.seat.findUnique({ where: { id: live.seatId } });
        const pod = seat ? seat.label || seat.number : null;
        try {
          await createPodCall(ctx.prisma, { orderId: live.id, reason: "ASSISTANCE" });
        } catch (err) {
          if (!(err instanceof PodCallError) || err.code !== "ALREADY_PENDING") throw err;
          return { podCall: true, alreadyPending: true, pod, goodwillCents: 0, card: { type: "pod-call", pod, again: true }, message: "Staff were already called to the pod." };
        }
        return { podCall: true, pod, goodwillCents: 0, card: { type: "pod-call", pod }, message: "Staff are on their way to the pod." };
      }
    }

    let order = null;
    if (ctx.userId) {
      order = await ownOrder(ctx, input.orderId, { paidOnly: true });
      if (clean(input.orderId) && !order) return { error: "NOT_FOUND" };
    }
    const type = input.category === "pod_problem" ? "POD_ISSUE" : order ? "ORDER_ISSUE" : "GENERAL";
    const summary = `${input.category}: ${clean(input.summary)}`;
    const opened = await openCase(ctx, { type, tool: "report_issue", summary, orderId: order?.id || null, contactInput: input.contact });

    let goodwill = { grantedCents: 0, reason: null };
    // Never automatic on SMS: staff decide from the case (controller ruling).
    if (ctx.userId && order && !sms && GOODWILL_CATEGORIES.has(input.category)) {
      // Store credit only; the caps (per order, 30 days, lifetime, order age) decide.
      goodwill = await grantGoodwill(ctx.prisma, {
        userId: ctx.userId,
        orderId: order.id,
        requestedCents: Math.min(500, PROGRAM.goodwill.perOrderCents),
        caseId: opened.id,
        now,
      });
    }
    const supportCase = (await ctx.prisma.supportCase.findUnique({ where: { id: opened.id } })) || opened;
    await notify(ctx, supportCase, { urgent: input.category === "unwell" });
    const granted = goodwill.grantedCents || 0;
    return {
      caseId: supportCase.id,
      goodwillCents: granted,
      goodwill: granted ? dollars(granted) : null,
      goodwillNote: granted ? "Added as store credit, usable on a next order." : goodwill.reason ? `No credit added (${goodwill.reason}). The team will review the case.` : "The team will review the case.",
      card: caseCard(supportCase, { kind: "issue", goodwillCents: granted }),
    };
  },

  async request_refund(input, ctx) {
    const order = await ownOrder(ctx, input.orderId, { paidOnly: true });
    if (!order) return { error: "NOT_FOUND" };
    const c = await openCase(ctx, { type: "REFUND_REQUEST", tool: "request_refund", summary: clean(input.reason) || "Refund requested", orderId: order.id });
    await notify(ctx, c, {});
    return { caseId: c.id, orderNumber: order.orderNumber, message: "Staff will review it. No refund or amount is promised.", card: caseCard(c, { kind: "refund" }) };
  },

  async escalate_to_human(input, ctx) {
    const c = await openCase(ctx, { type: "GENERAL", tool: "escalate_to_human", summary: `Escalated: ${clean(input.summary)}`, contactInput: input.contact });
    await notify(ctx, c, { urgent: true });
    return { caseId: c.id, message: "A person has been alerted and will follow up.", card: caseCard(c, { kind: "escalation", urgent: true }) };
  },
};

// ---------------------------------------------------------------------------
// The interface the agent loop uses

/** All seventeen strict; sorted by name so the tools prefix is byte-identical for every caller. */
export const TOOL_DEFS = toStrictToolDefs(CHAPPY_TOOLS, null);
const DEFS_BY_NAME = new Map(TOOL_DEFS.map((d) => [d.name, d]));

function errorResult(err) {
  if (err instanceof OrderError) return { error: err.code, message: err.message, ...err.extra };
  if (err instanceof CartError || err instanceof ToolError) return { error: err.code, message: err.message, ...(err.extra || {}) };
  if (err instanceof PodCallError) return { error: err.code, message: err.message };
  // createSupportCase's InputError: { code, status, message }.
  if (err && typeof err.code === "string" && Number.isInteger(err.status) && err.status < 500) return { error: err.code, message: err.message };
  return null;
}

/**
 * Runs one tool call. Validates the input against the tool's schema, refuses
 * a guest on a member tool before any database access, and turns expected
 * service refusals into { error } results the model can explain. Anything
 * unexpected throws (the loop sends it back as an is_error tool_result).
 */
export async function executeTool(name, input, ctx) {
  const handler = Object.hasOwn(HANDLERS, name) ? HANDLERS[name] : null;
  const def = DEFS_BY_NAME.get(name);
  if (!handler || !def) return { error: "UNKNOWN_TOOL" };
  const check = validateToolInput(def.input_schema, input);
  if (!check.ok) return { error: "INVALID_INPUT", errors: check.errors };
  if (ctx?.channel === "sms" && !SMS_SET.has(name)) {
    return { error: "NOT_AVAILABLE_ON_SMS", message: "That can be done on ohbeef.com, not by text." };
  }
  if (MEMBER_SET.has(name) && !ctx?.userId) return signInRequired();
  try {
    return await handler(input, ctx);
  } catch (err) {
    const result = errorResult(err);
    if (result) return result;
    throw err;
  }
}

export default { CHAPPY_TOOLS, TOOL_DEFS, HANDLERS, executeTool };
