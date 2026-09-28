/**
 * Task B2: Chappy's service-backed tools. Every handler runs against the
 * in-memory prisma and a Stripe double; no model is called.
 *
 * Money only moves through the services (orders/service.js, support/caps.js,
 * support/routes.js). Chappy never charges: checkout returns a pay card and
 * the customer's own tap pays through POST /orders/:id/confirm-payment.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOOL_DEFS, HANDLERS, MEMBER_TOOLS, executeTool } from "../tools.js";
import { countOptionalParams, STRICT_TOOL_LIMIT } from "../tool-schema.js";
import { loadCart } from "../cart.js";
import { seed, fakeStripe, NOW, DAY_MS, HOUR_MS, CLASSIC_BOWL } from "../../orders/__tests__/fixtures.js";

const CONV = { id: "conv1", identifier: "u1", channel: "web", messages: [], isActive: true, updatedAt: NOW };

function world(extra = {}) {
  const db = seed({ chappyConversations: [{ ...CONV }], ...extra });
  const stripe = fakeStripe();
  const confirms = [];
  stripe.paymentIntents.confirm = async (...args) => {
    confirms.push(args);
    throw new Error("Chappy must never confirm a PaymentIntent");
  };
  const logs = [];
  const notify = { env: { SUPPORT_NOTIFY: "log", ADMIN_PHONE_NUMBER: "+18015550000", OWNER_EMAIL: "owner@x.com" }, log: (l) => logs.push(l) };
  return { db, stripe, confirms, logs, notify };
}

function memberCtx(w, over = {}) {
  return {
    prisma: w.db,
    identity: { kind: "member", userId: "u1" },
    userId: "u1",
    guestId: null,
    locationId: "L1",
    tenantId: "t1",
    channel: "web",
    locale: "en",
    conversationId: "conv1",
    stripe: w.stripe,
    notify: w.notify,
    webBaseUrl: "http://localhost:3100",
    now: NOW,
    ...over,
  };
}

const guestCtx = (w, over = {}) => memberCtx(w, { identity: { kind: "guest", guestKey: "g1" }, userId: null, ...over });

const paidOrder = (over = {}) => ({
  id: "o_paid",
  userId: "u1",
  locationId: "L1",
  tenantId: "t1",
  orderNumber: "ORD-1",
  status: "COMPLETED",
  paymentStatus: "PAID",
  totalCents: 1924,
  amountDueCents: 1924,
  subtotalCents: 1749,
  createdAt: new Date(NOW.getTime() - 20 * HOUR_MS),
  completedTime: new Date(NOW.getTime() - 19 * HOUR_MS),
  ...over,
});

const addToCart = (w, ctx, menuItemId, quantity = 1, option = "") => executeTool("cart", { op: "add", menuItemId, quantity, option }, ctx);

function walkSchemas(schema, visit, path = "") {
  if (!schema || typeof schema !== "object") return;
  visit(schema, path);
  for (const [k, v] of Object.entries(schema.properties || {})) walkSchemas(v, visit, `${path}.${k}`);
  if (schema.items) walkSchemas(schema.items, visit, `${path}[]`);
}

describe("tool set", () => {
  test("every name in TOOL_DEFS has a handler, and every handler has a definition", () => {
    const names = TOOL_DEFS.map((t) => t.name);
    for (const n of names) assert.equal(typeof HANDLERS[n], "function", `${n} has no handler`);
    assert.deepEqual(Object.keys(HANDLERS).sort(), [...names].sort());
    assert.deepEqual(
      [...names].sort(),
      [
        "apply_savings",
        "cart",
        "checkout",
        "escalate_to_human",
        "get_locations",
        "get_membership_program",
        "get_menu_item",
        "get_my_orders",
        "get_my_profile",
        "get_order_status",
        "get_usual_order",
        "reorder",
        "report_issue",
        "request_refund",
        "search_menu",
        "set_arrival_and_pod",
        "start_group_order",
      ].sort(),
    );
  });

  test("the legacy money tools are gone", () => {
    const names = new Set(TOOL_DEFS.map((t) => t.name));
    for (const old of ["create_and_pay_order", "create_apple_pay_order", "create_payment_link", "apply_credits", "create_order"]) {
      assert.ok(!names.has(old), `${old} still defined`);
    }
  });

  test("strict schemas: money-adjacent tools strict, within the API cap, closed, all required, short enums", () => {
    const strict = TOOL_DEFS.filter((t) => t.strict === true);
    assert.ok(strict.length <= STRICT_TOOL_LIMIT);
    for (const n of ["cart", "set_arrival_and_pod", "apply_savings", "checkout", "report_issue", "request_refund"]) {
      assert.equal(TOOL_DEFS.find((t) => t.name === n).strict, true, `${n} must be strict`);
    }
    for (const t of strict) {
      assert.equal(countOptionalParams(t.input_schema), 0, `${t.name}: every property required (grammar size)`);
      walkSchemas(t.input_schema, (s, p) => {
        if (s.type === "object") assert.equal(s.additionalProperties, false, `${t.name}${p}`);
        assert.ok(!Array.isArray(s.type), `${t.name}${p}: no union types in a strict schema`);
        assert.ok(!s.anyOf && !s.oneOf, `${t.name}${p}: no anyOf in a strict schema`);
        if (s.enum) assert.ok(s.enum.length <= 8, `${t.name}${p}: short enums`);
      });
      // No nesting deeper than one array of objects.
      assert.ok(JSON.stringify(t.input_schema).split('"properties"').length - 1 <= 2, `${t.name}: shallow schema`);
    }
  });

  test("no tool schema has an amountCents (or any amount) field; a refund never names an amount", () => {
    for (const t of TOOL_DEFS) {
      walkSchemas(t.input_schema, (s, p) => {
        for (const key of Object.keys(s.properties || {})) {
          if (t.name === "apply_savings" && key === "useCreditsCents") continue; // capped by quoteOrder, spent only at markPaid
          assert.ok(!/amount|cents|refund/i.test(key), `${t.name}${p}.${key}`);
        }
      });
    }
  });
});

describe("identity gating", () => {
  test("a guest calling cart gets SIGN_IN_REQUIRED and a sign-in card, and nothing is stored", async () => {
    const w = world();
    const r = await addToCart(w, guestCtx(w), "classic");
    assert.equal(r.error, "SIGN_IN_REQUIRED");
    assert.deepEqual(r.card, { type: "sign-in" });
    assert.equal((await w.db.chappyConversation.findUnique({ where: { id: "conv1" } })).cart ?? null, null);
  });

  test("every member tool refuses a guest before touching the database", async () => {
    const w = world();
    const trap = new Proxy({}, { get: (_, p) => { throw new Error(`database touched: ${String(p)}`); } });
    for (const name of MEMBER_TOOLS) {
      const def = TOOL_DEFS.find((t) => t.name === name);
      const input = Object.fromEntries(Object.entries(def.input_schema.properties).map(([k, s]) => [k, s.type === "integer" ? 0 : s.type === "boolean" ? true : s.enum ? s.enum[0] : ""]));
      const r = await executeTool(name, input, guestCtx(w, { prisma: trap }));
      assert.equal(r.error, "SIGN_IN_REQUIRED", name);
    }
  });

  test("get_order_status for another member's order is NOT_FOUND, same as a missing one", async () => {
    const w = world({ orders: [paidOrder({ id: "o_theirs", userId: "u2" })] });
    const theirs = await executeTool("get_order_status", { orderId: "o_theirs" }, memberCtx(w));
    const missing = await executeTool("get_order_status", { orderId: "o_nope" }, memberCtx(w));
    assert.deepEqual(theirs, { error: "NOT_FOUND" });
    assert.deepEqual(missing, { error: "NOT_FOUND" });
    const demo = await executeTool("get_order_status", { orderId: "demo-1" }, memberCtx(w));
    assert.deepEqual(demo, { error: "NOT_FOUND" }, "synthetic demo orders are not real to Chappy");
  });

  test("get_order_status and get_my_orders show the caller's own orders", async () => {
    const w = world({ orders: [paidOrder(), paidOrder({ id: "o_theirs", userId: "u2", orderNumber: "ORD-2" })] });
    const mine = await executeTool("get_order_status", { orderId: "o_paid" }, memberCtx(w));
    assert.equal(mine.orderNumber, "ORD-1");
    const list = await executeTool("get_my_orders", {}, memberCtx(w));
    assert.deepEqual(list.orders.map((o) => o.orderNumber), ["ORD-1"]);
  });
});

describe("menu (public, early access)", () => {
  const early = { id: "early", tenantId: "t1", name: "Early Bowl", basePriceCents: 1899, additionalPriceCents: 0, includedQuantity: 0, category: "main01", categoryType: "MAIN", isAvailable: true, releaseAt: new Date(NOW.getTime() + 3 * DAY_MS) };

  test("search_menu hides an early-access item from guests and lower tiers, shows it to eligible tiers", async () => {
    const w = world();
    await w.db.menuItem.create({ data: early });
    await w.db.user.update({ where: { id: "u2" }, data: { membershipTier: "NOODLE_MASTER" } });
    const names = async (ctx) => (await executeTool("search_menu", { query: "", category: "MAIN", dietary: "any" }, ctx)).items.map((i) => i.id);
    assert.ok(!(await names(guestCtx(w))).includes("early"), "guest");
    assert.ok(!(await names(memberCtx(w))).includes("early"), "CHOPSTICK sees it 1 day early only");
    assert.ok((await names(memberCtx(w, { userId: "u2", identity: { kind: "member", userId: "u2" } }))).includes("early"), "NOODLE_MASTER 4 days early");
    assert.ok(!(await names(guestCtx(w))).includes("soldout"));
    assert.ok(!(await names(guestCtx(w))).includes("foreign"), "other tenant");
  });

  test("get_menu_item refuses an item the caller's tier can't see yet", async () => {
    const w = world();
    await w.db.menuItem.create({ data: early });
    assert.deepEqual(await executeTool("get_menu_item", { itemId: "early" }, guestCtx(w)), { error: "NOT_FOUND" });
    assert.equal((await executeTool("get_menu_item", { itemId: "classic" }, guestCtx(w))).name, "Classic Beef Noodle Soup");
  });

  test("get_membership_program is public and never shows the goodwill caps", async () => {
    const w = world();
    const r = await executeTool("get_membership_program", {}, guestCtx(w));
    assert.ok(Array.isArray(r.tiers));
    assert.ok(!JSON.stringify(r).includes("goodwill"));
  });

  test("get_locations lists arrival slots and free pod counts", async () => {
    const w = world();
    const r = await executeTool("get_locations", {}, guestCtx(w));
    assert.equal(r.locations.length, 1);
    assert.equal(r.locations[0].freePods, 5, "retired pods are not counted");
    assert.ok(r.locations[0].slots.length > 0);
  });
});

describe("cart (server-held in ChappyConversation.cart)", () => {
  test("cart persists across calls and every view carries the server quote", async () => {
    const w = world();
    const ctx = memberCtx(w);
    await addToCart(w, ctx, "classic");
    await addToCart(w, ctx, "wide");
    await addToCart(w, ctx, "egg");
    // Quantity is servings within the one bowl; the order service prices it (egg: 199 + 199).
    const r = await executeTool("cart", { op: "set_quantity", menuItemId: "egg", quantity: 2, option: "" }, ctx);
    assert.equal(r.cart.items.find((i) => i.menuItemId === "egg").quantity, 2);
    assert.equal(r.quote.subtotalCents, 1599 + 2 * 199);
    const stored = await loadCart(w.db, "conv1");
    assert.deepEqual(stored.items.map((i) => [i.menuItemId, i.quantity]), [["classic", 1], ["wide", 1], ["egg", 2]]);
    const view = await executeTool("cart", { op: "view", menuItemId: "", quantity: 0, option: "" }, ctx);
    assert.equal(view.quote.totalCents, 1997 + Math.round(1997 * 0.1));
    await executeTool("cart", { op: "set_quantity", menuItemId: "egg", quantity: 0, option: "" }, ctx);
    await executeTool("cart", { op: "remove", menuItemId: "wide", quantity: 0, option: "" }, ctx);
    assert.deepEqual((await loadCart(w.db, "conv1")).items.map((i) => i.menuItemId), ["classic"], "set_quantity 0 and remove both drop the line");
    await executeTool("cart", { op: "clear", menuItemId: "", quantity: 0, option: "" }, ctx);
    assert.deepEqual((await loadCart(w.db, "conv1")).items, []);
  });

  test("an unknown or not-yet-released item is refused by the order service, not stored", async () => {
    const w = world();
    const r = await addToCart(w, memberCtx(w), "preview");
    assert.equal(r.error, "ITEM_NOT_RELEASED");
    assert.deepEqual((await loadCart(w.db, "conv1")).items, []);
  });

  test("reorder replaces the cart with a past order's lines (own orders only)", async () => {
    const w = world({
      orders: [paidOrder(), paidOrder({ id: "o_theirs", userId: "u2" })],
      orderItems: [
        { orderId: "o_paid", menuItemId: "classic", quantity: 1, priceCents: 1599 },
        { orderId: "o_paid", menuItemId: "egg", quantity: 1, priceCents: 199 },
        { orderId: "o_theirs", menuItemId: "wagyu", quantity: 1, priceCents: 2399 },
      ],
    });
    const ctx = memberCtx(w);
    assert.deepEqual(await executeTool("reorder", { orderId: "o_theirs" }, ctx), { error: "NOT_FOUND" });
    const r = await executeTool("reorder", { orderId: "o_paid" }, ctx);
    assert.deepEqual(r.cart.items.map((i) => i.menuItemId).sort(), ["classic", "egg"]);
    assert.equal(r.quote.subtotalCents, 1599 + 199);
    const usual = await executeTool("get_usual_order", {}, ctx);
    assert.deepEqual(usual.items.map((i) => i.menuItemId).sort(), ["classic", "egg"]);
  });

  test("set_arrival_and_pod is a dry run: it suggests a pod without claiming it", async () => {
    const w = world();
    const r = await executeTool("set_arrival_and_pod", { locationId: "", arrival: "ASAP", pod: "best", partySize: 1 }, memberCtx(w));
    assert.equal(r.pod.label, "A-01");
    const seats = await w.db.seat.findMany({ where: { locationId: "L1" } });
    assert.ok(seats.every((s) => s.status === "AVAILABLE"), "no seat claimed");
    const cart = await loadCart(w.db, "conv1");
    assert.deepEqual(cart.pod, { best: true });
    const taken = await w.db.seat.update({ where: { id: "s-b07" }, data: { status: "OCCUPIED" } });
    assert.ok(taken);
    const bad = await executeTool("set_arrival_and_pod", { locationId: "", arrival: "ASAP", pod: "B-07", partySize: 1 }, memberCtx(w));
    assert.equal(bad.error, "POD_UNAVAILABLE");
    const late = await executeTool("set_arrival_and_pod", { locationId: "", arrival: "03:00", pod: "best", partySize: 1 }, memberCtx(w));
    assert.equal(late.error, "ARRIVAL_INVALID");
  });

  test("set_arrival_and_pod refuses a closed location", async () => {
    const w = world({ locations: [{ id: "L2", tenantId: "t1", name: "Old Site", taxRate: 0.1, timezone: "America/Denver", isClosed: true }] });
    const r = await executeTool("set_arrival_and_pod", { locationId: "L2", arrival: "ASAP", pod: "none", partySize: 1 }, memberCtx(w));
    assert.equal(r.error, "LOCATION_NOT_FOUND");
  });

  test("apply_savings re-quotes through quoteOrder (credits capped by the service)", async () => {
    const w = world({ creditLots: [{ userId: "u1", source: "REFERRAL", amountCents: 2000, remainingCents: 2000, expiresAt: new Date(NOW.getTime() + 30 * DAY_MS), createdAt: NOW }] });
    const ctx = memberCtx(w);
    await addToCart(w, ctx, "classic");
    const r = await executeTool("apply_savings", { useCreditsCents: 100000, promoCode: "", rewardId: "" }, ctx);
    assert.equal(r.quote.discounts.creditsCents, 500, "the order service caps credit per order");
    assert.equal((await w.db.creditLot.findMany({ where: { userId: "u1" } }))[0].remainingCents, 2000, "nothing spent");
  });
});

describe("checkout: a pay card only, never a charge", () => {
  test("checkout needs an explicit yes", async () => {
    const w = world();
    const ctx = memberCtx(w);
    for (const l of CLASSIC_BOWL) await addToCart(w, ctx, l.menuItemId, l.quantity);
    const r = await executeTool("checkout", { confirmed: false }, ctx);
    assert.equal(r.error, "NEEDS_CONFIRMATION");
    assert.equal((await w.db.order.findMany({})).length, 0);
  });

  test("checkout creates the order and a PaymentIntent through the service and returns a pay card; nothing is confirmed or paid", async () => {
    const w = world();
    const ctx = memberCtx(w);
    for (const l of CLASSIC_BOWL) await addToCart(w, ctx, l.menuItemId, l.quantity);
    await executeTool("set_arrival_and_pod", { locationId: "", arrival: "ASAP", pod: "best", partySize: 1 }, ctx);
    const r = await executeTool("checkout", { confirmed: true }, ctx);
    const [order] = await w.db.order.findMany({});
    assert.deepEqual(r.card, { type: "pay", orderId: order.id, clientSecret: "pi_test_1_secret_abc", amountDueCents: order.amountDueCents, currency: "usd" });
    assert.equal(order.amountDueCents, 1924);
    assert.equal(order.orderSource, "CHAPPY");
    assert.equal(order.paymentStatus, "PENDING", "never markPaid");
    assert.equal(order.status, "PENDING_PAYMENT");
    assert.equal(w.stripe.created.length, 1);
    assert.equal(w.stripe.created[0].amount, 1924, "server amount");
    assert.deepEqual(w.stripe.created[0].metadata, { orderId: order.id });
    assert.equal(w.stripe.created[0].confirm, undefined, "not a confirm-on-create PaymentIntent");
    assert.equal(w.stripe.created[0].payment_method, undefined, "no saved card attached");
    assert.equal(w.confirms.length, 0, "paymentIntents.confirm never called");
    assert.equal(order.seatId, "s-a01", "the pod is claimed by createOrder at checkout");
    assert.deepEqual((await loadCart(w.db, "conv1")).items, [], "cart emptied after the order is created");
  });

  test("a zero balance returns a confirm-zero card and no PaymentIntent", async () => {
    const w = world();
    const ctx = memberCtx(w);
    await addToCart(w, ctx, "wide");
    const r = await executeTool("checkout", { confirmed: true }, ctx);
    const [order] = await w.db.order.findMany({});
    assert.deepEqual(r.card, { type: "confirm-zero", orderId: order.id });
    assert.equal(w.stripe.created.length, 0);
    assert.equal(order.paymentStatus, "PENDING");
  });

  test("SMS: checkout returns the payment-page link instead of a card, and creates no PaymentIntent", async () => {
    const w = world();
    const ctx = memberCtx(w, { channel: "sms", identity: { kind: "sms", phone: "8015550100", userId: "u1" }, locale: "es" });
    for (const l of CLASSIC_BOWL) await addToCart(w, ctx, l.menuItemId, l.quantity);
    const r = await executeTool("checkout", { confirmed: true }, ctx);
    const [order] = await w.db.order.findMany({});
    assert.equal(r.card, undefined);
    assert.equal(r.paymentLink, `http://localhost:3100/es/order/payment?orderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber)}`);
    assert.equal(w.stripe.created.length, 0);
  });

  test("start_group_order returns a share card for a group hosted by the caller", async () => {
    const w = world();
    const r = await executeTool("start_group_order", { locationId: "" }, memberCtx(w));
    const [group] = await w.db.groupOrder.findMany({});
    assert.equal(group.hostUserId, "u1");
    assert.equal(r.card.type, "group-share");
    assert.equal(r.card.code, group.code);
    assert.equal(r.card.url, `http://localhost:3100/en/group/${group.code}`);
  });
});

describe("support: store credit within caps, PodCall in the pod, never a card refund", () => {
  test("report_issue with an active pod order creates a PodCall and grants no credit", async () => {
    const w = world({ orders: [paidOrder({ id: "o_live", status: "PREPPING", seatId: "s-a02", createdAt: new Date(NOW.getTime() - 10 * 60 * 1000), completedTime: null })] });
    const r = await executeTool("report_issue", { category: "cold_food", summary: "My broth is lukewarm", orderId: "", contact: "" }, memberCtx(w));
    const calls = await w.db.podCall.findMany({});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].orderId, "o_live");
    assert.equal(calls[0].seatId, "s-a02");
    assert.equal(r.podCall, true);
    assert.equal((await w.db.creditLot.findMany({})).length, 0, "no credit");
    assert.equal(w.stripe.refundCalls.length, 0);
  });

  test("report_issue for a cold bowl within 24 hours grants at most 500 cents as a GOODWILL lot and notifies (log mode)", async () => {
    const w = world({ orders: [paidOrder()] });
    const r = await executeTool("report_issue", { category: "cold_food", summary: "My bowl was cold", orderId: "", contact: "" }, memberCtx(w));
    const lots = await w.db.creditLot.findMany({});
    assert.equal(lots.length, 1);
    assert.equal(lots[0].source, "GOODWILL");
    assert.ok(lots[0].amountCents > 0 && lots[0].amountCents <= 500);
    assert.equal(r.goodwillCents, lots[0].amountCents);
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.type, "ORDER_ISSUE");
    assert.equal(c.orderId, "o_paid");
    assert.equal(c.resolution, "GOODWILL_CREDIT");
    assert.equal(r.card.type, "support-case");
    assert.equal(r.card.caseId, c.id);
    assert.ok(w.logs.some((l) => /SUPPORT_NOTIFY=log/.test(l)), "notifyCase honors SUPPORT_NOTIFY");
    assert.equal(w.stripe.refundCalls.length, 0, "never a card refund");
  });

  test("report_issue with no order id targets the latest PAID order, not a checkout just started", async () => {
    const w = world({ orders: [paidOrder(), paidOrder({ id: "o_unpaid", status: "PENDING_PAYMENT", paymentStatus: "PENDING", createdAt: new Date(NOW.getTime() - 60 * 1000), completedTime: null })] });
    const r = await executeTool("report_issue", { category: "cold_food", summary: "Last bowl was cold", orderId: "", contact: "" }, memberCtx(w));
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.orderId, "o_paid");
    assert.ok(r.goodwillCents > 0 && r.goodwillCents <= 500);
  });

  test("report_issue past the 30-day cap grants nothing and leaves the case open for staff", async () => {
    const w = world({
      orders: [paidOrder()],
      creditLots: [{ userId: "u1", source: "GOODWILL", amountCents: 1000, remainingCents: 1000, orderId: "o_old", expiresAt: new Date(NOW.getTime() + 60 * DAY_MS), createdAt: new Date(NOW.getTime() - 5 * DAY_MS) }],
    });
    const r = await executeTool("report_issue", { category: "wrong_item", summary: "Wrong noodles", orderId: "o_paid", contact: "" }, memberCtx(w));
    assert.equal(r.goodwillCents, 0);
    assert.equal((await w.db.creditLot.findMany({})).length, 1);
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.status, "OPEN");
  });

  test("a guest's report_issue opens a case with their contact and no credit", async () => {
    const w = world();
    const noContact = await executeTool("report_issue", { category: "other", summary: "Pod door stuck", orderId: "", contact: "" }, guestCtx(w));
    assert.equal(noContact.error, "CONTACT_REQUIRED");
    const r = await executeTool("report_issue", { category: "other", summary: "Pod door stuck", orderId: "", contact: "ana@example.com" }, guestCtx(w));
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.userId, null);
    assert.deepEqual(c.contact, { email: "ana@example.com" });
    assert.equal(r.goodwillCents, 0);
    assert.equal((await w.db.creditLot.findMany({})).length, 0);
  });

  test("request_refund opens a REFUND_REQUEST case and moves no money", async () => {
    const w = world({ orders: [paidOrder()] });
    const r = await executeTool("request_refund", { orderId: "o_paid", reason: "Charged twice" }, memberCtx(w));
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.type, "REFUND_REQUEST");
    assert.equal(c.status, "OPEN");
    assert.equal(r.card.type, "support-case");
    assert.equal((await w.db.creditLot.findMany({})).length, 0);
    assert.equal(w.stripe.refundCalls.length, 0);
    assert.deepEqual(await executeTool("request_refund", { orderId: "o_nope", reason: "x" }, memberCtx(w)), { error: "NOT_FOUND" });
  });

  test("escalate_to_human opens a case and sends an urgent notification", async () => {
    const w = world();
    const r = await executeTool("escalate_to_human", { summary: "I feel unwell after eating", contact: "" }, memberCtx(w));
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.type, "GENERAL");
    assert.equal(r.card.caseId, c.id);
    assert.ok(w.logs.some((l) => /would text/.test(l)), "urgent: SMS logged");
  });
});

describe("source scan: money only moves through the services", () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const code = ["../tools.js", "../cart.js"].map((f) => strip(readFileSync(new URL(f, import.meta.url), "utf8"))).join("\n");

  // Direct writes to money tables, Stripe calls, credit math.
  const MONEY_WRITE = /\.\s*(order|orderItem|creditLot|creditEvent|user|giftCard|reward|mealGift|promoCode|promoCodeUsage|supportCase|seat)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
  const STRIPE = /\bstripe\s*\.\s*[a-zA-Z]|new\s+Stripe\b|from\s+["']stripe["']|import\(\s*["']stripe["']\s*\)/;
  const CREDIT_MATH = /\b(decrement|increment)\s*:/;
  const CHARGE = /\bmarkPaid\b|\bconfirmOrderPayment\b|paymentIntents\s*\.\s*confirm|refundFullPayment|fullRefundCase|grantCredit\b|grantCreditInTx|spendCredit/;

  test("the patterns catch known-bad code (or the scan proves nothing)", () => {
    assert.ok(MONEY_WRITE.test("await prisma.creditLot.create({})"));
    assert.ok(MONEY_WRITE.test("ctx.prisma.order.update({ where })"));
    assert.ok(STRIPE.test("await stripe.paymentIntents.create({})"));
    assert.ok(CREDIT_MATH.test("{ creditsCents: { decrement: 5 } }"));
    assert.ok(CHARGE.test("await markPaid(prisma, stripe, {})"));
    assert.ok(!STRIPE.test("createPaymentIntent(ctx.prisma, ctx.stripe, { orderId })"), "passing the client to a service is fine");
  });

  test("tools.js and cart.js write no money table, call no Stripe method, and never mark paid", () => {
    assert.ok(!MONEY_WRITE.test(code), `direct money write: ${code.match(MONEY_WRITE)?.[0]}`);
    assert.ok(!STRIPE.test(code), `direct Stripe use: ${code.match(STRIPE)?.[0]}`);
    assert.ok(!CREDIT_MATH.test(code), "credit arithmetic");
    assert.ok(!CHARGE.test(code), `charge/credit primitive: ${code.match(CHARGE)?.[0]}`);
  });

  test("the only prisma writes are the cart row (cart.js) and the pod-call helper; money goes through the services", () => {
    const writes = [...code.matchAll(/\.\s*([a-zA-Z]+)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(writes)], ["chappyConversation"]);
    const tools = readFileSync(new URL("../tools.js", import.meta.url), "utf8");
    assert.match(tools, /from "\.\.\/orders\/service\.js"/);
    assert.match(tools, /from "\.\.\/support\/caps\.js"/);
    assert.match(tools, /from "\.\.\/support\/routes\.js"/);
  });
});
