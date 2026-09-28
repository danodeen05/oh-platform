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
import { TOOL_DEFS, HANDLERS, MEMBER_TOOLS, SMS_TOOLS, executeTool } from "../tools.js";
import { countOptionalParams, STRICT_TOOL_LIMIT } from "../tool-schema.js";
import { loadCart } from "../cart.js";
import { createChappyLimits } from "../limits.js";
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
    // Task E1 fix round 1: hours, from the same source ordering enforces (defaults when unset).
    const l = r.locations[0];
    assert.equal(l.timezone, "America/Denver");
    assert.equal(l.hoursSource, "default");
    assert.equal(l.openNow, true, "noon on a Thursday");
    assert.deepEqual(l.today, { day: "thu", open: "11:00", close: "21:00" });
    assert.equal(l.week.length, 7);
    assert.match(TOOL_DEFS.find((t) => t.name === "get_locations").description, /hours/);
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
    assert.deepEqual(r.visit, { location: "City Creek Mall", arrival: "ASAP", pod: "assigned at check-in", partySize: 1 });
    assert.equal((await w.db.order.findMany({})).length, 0);
  });

  test("the confirmation shows where and when: location, arrival slot and pod", async () => {
    const w = world();
    const ctx = memberCtx(w);
    await addToCart(w, ctx, "classic");
    await executeTool("set_arrival_and_pod", { locationId: "", arrival: "13:30", pod: "best", partySize: 1 }, ctx);
    const best = await executeTool("checkout", { confirmed: false }, ctx);
    assert.equal(best.visit.location, "City Creek Mall");
    assert.equal(best.visit.arrival.local, "13:30");
    assert.equal(best.visit.pod, "best available");
    await executeTool("set_arrival_and_pod", { locationId: "", arrival: "13:30", pod: "B-07", partySize: 1 }, ctx);
    assert.equal((await executeTool("checkout", { confirmed: false }, ctx)).visit.pod, "B-07");
  });

  test("if the PaymentIntent fails unexpectedly after the order exists, the customer still gets the payment link", async () => {
    const w = world();
    w.stripe.paymentIntents.create = async () => {
      throw new Error("stripe network error");
    };
    const ctx = memberCtx(w);
    for (const l of CLASSIC_BOWL) await addToCart(w, ctx, l.menuItemId, l.quantity);
    const r = await executeTool("checkout", { confirmed: true }, ctx);
    const [order] = await w.db.order.findMany({});
    assert.equal(r.error, "PAYMENT_SETUP_FAILED");
    assert.equal(r.card, undefined);
    assert.equal(r.orderId, order.id);
    assert.equal(r.paymentLink, `http://localhost:3100/en/order/payment?orderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber)}`);
    assert.equal(order.paymentStatus, "PENDING");
  });

  test("checkout creates the order and a PaymentIntent through the service and returns a pay card; nothing is confirmed or paid", async () => {
    const w = world();
    const ctx = memberCtx(w);
    for (const l of CLASSIC_BOWL) await addToCart(w, ctx, l.menuItemId, l.quantity);
    await executeTool("set_arrival_and_pod", { locationId: "", arrival: "ASAP", pod: "best", partySize: 1 }, ctx);
    const r = await executeTool("checkout", { confirmed: true }, ctx);
    const [order] = await w.db.order.findMany({});
    assert.deepEqual(r.card, { type: "pay", orderId: order.id, clientSecret: "pi_test_1_secret_abc", amountDueCents: order.amountDueCents, currency: "usd", kitchenNumber: order.kitchenOrderNumber, pod: "A-01" });
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
    assert.deepEqual(r.card, { type: "confirm-zero", orderId: order.id, kitchenNumber: order.kitchenOrderNumber, pod: null });
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
  const liveOrder = (over = {}) =>
    paidOrder({ id: "o_live", status: "PREPPING", seatId: "s-a02", createdAt: new Date(NOW.getTime() - 10 * 60 * 1000), completedTime: null, ...over });

  for (const [how, arrived] of [
    ["the pod was confirmed", { podConfirmedAt: new Date(NOW.getTime() - 5 * 60 * 1000) }],
    ["they checked in at the kiosk", { arrivedAt: new Date(NOW.getTime() - 5 * 60 * 1000) }],
  ]) {
    test(`report_issue while seated (${how}) creates a PodCall and grants no credit`, async () => {
      const w = world({ orders: [liveOrder(arrived)] });
      const r = await executeTool("report_issue", { category: "cold_food", summary: "My broth is lukewarm", orderId: "", contact: "" }, memberCtx(w));
      const calls = await w.db.podCall.findMany({});
      assert.equal(calls.length, 1);
      assert.equal(calls[0].orderId, "o_live");
      assert.equal(calls[0].seatId, "s-a02");
      assert.equal(r.podCall, true);
      assert.equal((await w.db.creditLot.findMany({})).length, 0, "no credit");
      assert.equal((await w.db.supportCase.findMany({})).length, 0);
      assert.equal(w.stripe.refundCalls.length, 0);
    });
  }

  test("a paid order with a pod they have not arrived at is not 'in the pod': a case opens (goodwill path), no PodCall", async () => {
    const w = world({ orders: [liveOrder()] });
    const r = await executeTool("report_issue", { category: "cold_food", summary: "Worried it will be cold", orderId: "", contact: "" }, memberCtx(w));
    assert.equal((await w.db.podCall.findMany({})).length, 0);
    assert.equal(r.podCall, undefined);
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.orderId, "o_live");
    assert.equal(r.card.type, "support-case");
  });

  test("a COMPLETED or CANCELLED order is never 'in the pod', even with an arrival time", async () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      const w = world({ orders: [liveOrder({ status, podConfirmedAt: new Date(NOW.getTime() - 5 * 60 * 1000) })] });
      await executeTool("report_issue", { category: "cold_food", summary: "Bowl was cold", orderId: "", contact: "" }, memberCtx(w));
      assert.equal((await w.db.podCall.findMany({})).length, 0, status);
      assert.equal((await w.db.supportCase.findMany({})).length, 1, status);
    }
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

describe("case-spam cap (Task B3, carried from the B2 review)", () => {
  const withLimiter = (w, over = {}) => {
    const limiter = createChappyLimits({ env: {} });
    return memberCtx(w, { checkCaseLimit: limiter.checkCaseLimit, recordCase: limiter.recordCase, ...over });
  };

  test("the 4th escalate_to_human from one identity in a day is CASE_LIMIT, not a new case", async () => {
    const w = world();
    const ctx = withLimiter(w);
    for (let i = 0; i < 3; i++) {
      const r = await executeTool("escalate_to_human", { summary: `issue ${i}`, contact: "" }, ctx);
      assert.ok(r.caseId, `open ${i + 1} should succeed`);
    }
    const blocked = await executeTool("escalate_to_human", { summary: "one more", contact: "" }, ctx);
    assert.deepEqual(Object.keys(blocked).sort(), ["error", "message"]);
    assert.equal(blocked.error, "CASE_LIMIT");
    assert.equal((await w.db.supportCase.findMany({})).length, 3, "the blocked call opened no new case");
  });

  test("report_issue and request_refund are capped the same way", async () => {
    const w = world({ orders: [paidOrder()] });
    const ctx = withLimiter(w);
    for (let i = 0; i < 3; i++) assert.ok((await executeTool("request_refund", { orderId: "o_paid", reason: `r${i}` }, ctx)).caseId);
    assert.equal((await executeTool("request_refund", { orderId: "o_paid", reason: "over" }, ctx)).error, "CASE_LIMIT");

    const w2 = world({ orders: [paidOrder()] });
    const ctx2 = withLimiter(w2);
    for (let i = 0; i < 3; i++) assert.ok((await executeTool("report_issue", { category: "other", summary: `r${i}`, orderId: "", contact: "" }, ctx2)).caseId);
    assert.equal((await executeTool("report_issue", { category: "other", summary: "over", orderId: "", contact: "" }, ctx2)).error, "CASE_LIMIT");
  });

  test("the cap is SHARED across the three tools (controller ruling, fix round 1): 2 report_issue + 1 request_refund hits it, so escalate_to_human is next blocked", async () => {
    const w = world({ orders: [paidOrder()] });
    const ctx = withLimiter(w);
    assert.ok((await executeTool("report_issue", { category: "other", summary: "r1", orderId: "", contact: "" }, ctx)).caseId);
    assert.ok((await executeTool("report_issue", { category: "other", summary: "r2", orderId: "", contact: "" }, ctx)).caseId);
    assert.ok((await executeTool("request_refund", { orderId: "o_paid", reason: "r3" }, ctx)).caseId);
    // 3 cases opened across two different tools: escalate_to_human (a fourth, from a third tool) is blocked too.
    const blocked = await executeTool("escalate_to_human", { summary: "one more", contact: "" }, ctx);
    assert.equal(blocked.error, "CASE_LIMIT");
    assert.equal((await w.db.supportCase.findMany({})).length, 3, "the blocked call opened no new case");
    // report_issue and request_refund are blocked too: this is one shared budget, not three separate ones.
    assert.equal((await executeTool("report_issue", { category: "other", summary: "over", orderId: "", contact: "" }, ctx)).error, "CASE_LIMIT");
    assert.equal((await executeTool("request_refund", { orderId: "o_paid", reason: "over" }, ctx)).error, "CASE_LIMIT");
  });

  test("the cap is per identity: a guest's cases never count against a member's", async () => {
    const w = world();
    const limiter = createChappyLimits({ env: {} });
    const memberSide = memberCtx(w, { checkCaseLimit: limiter.checkCaseLimit, recordCase: limiter.recordCase });
    const guestSide = guestCtx(w, { checkCaseLimit: limiter.checkCaseLimit, recordCase: limiter.recordCase });
    for (let i = 0; i < 3; i++) await executeTool("escalate_to_human", { summary: `g${i}`, contact: "ana@example.com" }, guestSide);
    assert.equal((await executeTool("escalate_to_human", { summary: "over", contact: "ana@example.com" }, guestSide)).error, "CASE_LIMIT");
    assert.ok((await executeTool("escalate_to_human", { summary: "member's own", contact: "" }, memberSide)).caseId);
  });

  test("a caller with no limiter wired (e.g. an older fixture) sees no cap", async () => {
    const w = world();
    const ctx = memberCtx(w); // no checkCaseLimit/recordCase
    for (let i = 0; i < 5; i++) {
      const r = await executeTool("escalate_to_human", { summary: `x${i}`, contact: "" }, ctx);
      assert.ok(r.caseId);
    }
  });
});

describe("SMS channel (controller ruling, fix round 1)", () => {
  const smsCtx = (w, over = {}) => memberCtx(w, { channel: "sms", identity: { kind: "sms", phone: "18015550100", userId: "u1" }, ...over });

  test("an SMS goodwill attempt grants nothing: the case opens and staff are notified", async () => {
    const w = world({ orders: [paidOrder()] });
    const r = await executeTool("report_issue", { category: "cold_food", summary: "My bowl was cold", orderId: "", contact: "" }, smsCtx(w));
    assert.equal(r.goodwillCents, 0);
    assert.equal((await w.db.creditLot.findMany({})).length, 0, "no automatic credit on SMS");
    const [c] = await w.db.supportCase.findMany({});
    assert.equal(c.type, "ORDER_ISSUE");
    assert.equal(c.status, "OPEN", "staff decide");
    assert.ok(w.logs.some((l) => /would email/.test(l)), "staff notified");
  });

  test("on SMS a seated member's report still opens a case (no PodCall, no credit)", async () => {
    const w = world({ orders: [paidOrder({ id: "o_live", status: "PREPPING", seatId: "s-a02", podConfirmedAt: NOW, createdAt: NOW, completedTime: null })] });
    await executeTool("report_issue", { category: "cold_food", summary: "Lukewarm", orderId: "", contact: "" }, smsCtx(w));
    assert.equal((await w.db.podCall.findMany({})).length, 0);
    assert.equal((await w.db.supportCase.findMany({})).length, 1);
    assert.equal((await w.db.creditLot.findMany({})).length, 0);
  });

  test("tools outside the SMS set are refused by channel, before any database access", async () => {
    const w = world();
    const trap = new Proxy({}, { get: (_, p) => { throw new Error(`database touched: ${String(p)}`); } });
    const allowed = new Set(SMS_TOOLS);
    for (const def of TOOL_DEFS.filter((t) => !allowed.has(t.name))) {
      const input = Object.fromEntries(Object.entries(def.input_schema.properties).map(([k, s]) => [k, s.type === "integer" ? 0 : s.type === "boolean" ? true : s.enum ? s.enum[0] : ""]));
      const r = await executeTool(def.name, input, smsCtx(w, { prisma: trap }));
      assert.equal(r.error, "NOT_AVAILABLE_ON_SMS", def.name);
    }
    assert.deepEqual(TOOL_DEFS.map((t) => t.name).filter((n) => !allowed.has(n)).sort(), ["apply_savings", "get_my_profile", "reorder", "start_group_order"]);
  });
});

describe("source scan: money only moves through the services", () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const FILES = { tools: "../tools.js", cart: "../cart.js" };
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, readFileSync(new URL(f, import.meta.url), "utf8")]));
  const code = Object.values(src).map(strip).join("\n");

  // `.x`, `?.x`, `["x"]` and `?.["x"]` all reach a member.
  const member = (names) => `(?:(?:\\?\\.|\\.)\\s*(?:${names})\\b|(?:\\?\\.)?\\s*\\[\\s*["'\`](?:${names})["'\`]\\s*\\])`;
  const OPS = "create|createMany|update|updateMany|upsert|delete|deleteMany";
  const MONEY_TABLES = "order|orderItem|creditLot|creditEvent|user|giftCard|reward|mealGift|promoCode|promoCodeUsage|supportCase|seat|podCall|groupOrder";
  const writeTo = (tables) => new RegExp(`${member(tables)}\\s*${member(OPS)}\\s*(?:\\?\\.)?\\s*\\(`);
  const MONEY_WRITE = writeTo(MONEY_TABLES);
  const ANY_WRITE = new RegExp(`(?:(?:\\?\\.|\\.)\\s*([a-zA-Z]+)|\\[\\s*["'\`]([a-zA-Z]+)["'\`]\\s*\\])\\s*${member(OPS)}\\s*(?:\\?\\.)?\\s*\\(`, "g");
  const RAW = /\$(?:executeRaw|executeRawUnsafe|queryRaw|queryRawUnsafe|transaction)\b|\[\s*["'`]\$(?:executeRaw|executeRawUnsafe|queryRaw|queryRawUnsafe|transaction)/;
  const STRIPE = new RegExp(`\\bstripe\\b\\s*${member("[a-zA-Z_$]+")}|new\\s+Stripe\\b|from\\s+["']stripe["']|import\\(\\s*["']stripe["']\\s*\\)|require\\(\\s*["']stripe["']\\s*\\)`);
  // Pulling the client, a delegate or Stripe out into a local name hides later calls from the patterns above.
  const ALIAS = [
    /(?:const|let|var)\s*\{[^}]*\}\s*=\s*[\w$.?\s]*\b(?:prisma|stripe)\b/, // const { creditLot } = ctx.prisma / = prisma / = ctx.stripe
    /(?:const|let|var)\s*\{[^}]*\b(?:prisma|stripe)\b[^}]*\}\s*=/, // const { prisma, stripe } = ctx
    /=\s*(?:ctx|context)\s*(?:\?\.|\.)\s*(?:prisma|stripe)\b/, // x = ctx.prisma; x = ctx.prisma.creditLot; x = ctx?.stripe
    /(?:const|let|var)\s+[\w$]+\s*=\s*(?:prisma|stripe|tx)\b\s*(?:[;,\n]|(?:\?\.|\.)\s*\w+\s*[;,\n])/, // const db = prisma; const lots = prisma.creditLot;
    /\[\s*["'`](?:prisma|stripe)["'`]\s*\]/, // ctx["prisma"]
  ];
  const CREDIT_MATH = /\b(decrement|increment)\s*:/;
  const CHARGE = /\bmarkPaid\b|\bconfirmOrderPayment\b|paymentIntents|refundFullPayment|fullRefundCase|refundUnappliedPayment|\bgrantCredit\b|grantCreditInTx|spendCredit|redeemReward/;

  test("the patterns catch known-bad code (or the scan proves nothing)", () => {
    for (const bad of [
      "await prisma.creditLot.create({})",
      "ctx.prisma.order.update({ where })",
      "ctx.prisma?.creditLot?.create({})",
      "ctx.prisma.creditLot?.create?.({})",
      'ctx.prisma["creditLot"]["create"]({})',
      'ctx.prisma?.["giftCard"].update({})',
    ]) assert.ok(MONEY_WRITE.test(bad), bad);
    for (const bad of ["await prisma.$transaction(async (tx) => {})", "prisma.$executeRaw`x`", "prisma.$executeRawUnsafe('x')", "prisma.$queryRaw`x`", "prisma.$queryRawUnsafe('x')", 'prisma["$transaction"](fn)']) {
      assert.ok(RAW.test(bad), bad);
    }
    for (const bad of ["await stripe.paymentIntents.create({})", "ctx.stripe?.refunds.create({})", 'ctx.stripe["paymentIntents"]', "new Stripe(key)", 'import Stripe from "stripe"']) {
      assert.ok(STRIPE.test(bad), bad);
    }
    for (const bad of [
      "const { creditLot } = ctx.prisma;",
      "const { paymentIntents } = ctx.stripe;",
      "const { prisma, stripe } = ctx;",
      "const lots = ctx.prisma.creditLot;",
      "const db = ctx.prisma;",
      "const s = ctx.stripe;",
      "const s = ctx?.stripe;",
      'const db = ctx["prisma"];',
      "const lots = prisma.creditLot;",
      "const db = prisma;",
    ]) assert.ok(ALIAS.some((re) => re.test(bad)), bad);
    assert.ok(CREDIT_MATH.test("{ creditsCents: { decrement: 5 } }"));
    assert.ok(CHARGE.test("await markPaid(prisma, stripe, {})"));
    assert.deepEqual([..."x.supportCase?.[\"create\"]({}); y.chappyConversation.update({})".matchAll(ANY_WRITE)].map((m) => m[1] || m[2]), ["supportCase", "chappyConversation"]);
    // Things the tools legitimately do must pass.
    for (const ok of ["createPaymentIntent(ctx.prisma, ctx.stripe, { orderId })", "await ctx.prisma.order.findFirst({ where })", "const rows = await ctx.prisma.menuItem.findMany({})", "stripe: toolDeps.stripe"]) {
      assert.ok(!MONEY_WRITE.test(ok) && !RAW.test(ok) && !STRIPE.test(ok) && !ALIAS.some((re) => re.test(ok)), ok);
    }
  });

  test("tools.js and cart.js: no money writes, no raw SQL or transactions, no Stripe, no aliasing, never mark paid", () => {
    assert.ok(!MONEY_WRITE.test(code), `direct money write: ${code.match(MONEY_WRITE)?.[0]}`);
    assert.ok(!RAW.test(code), `raw SQL / transaction: ${code.match(RAW)?.[0]}`);
    assert.ok(!STRIPE.test(code), `direct Stripe use: ${code.match(STRIPE)?.[0]}`);
    for (const re of ALIAS) assert.ok(!re.test(code), `aliased client/delegate/Stripe: ${code.match(re)?.[0]}`);
    assert.ok(!CREDIT_MATH.test(code), "credit arithmetic");
    assert.ok(!CHARGE.test(code), `charge/credit primitive: ${code.match(CHARGE)?.[0]}`);
  });

  test("the only prisma write either file makes is the cart row", () => {
    const writes = [...code.matchAll(ANY_WRITE)].map((m) => m[1] || m[2]);
    assert.deepEqual([...new Set(writes)], ["chappyConversation"]);
  });

  // Import allowlist: a new money-writing helper can't slip in through an import.
  const ALLOWED_IMPORTS = {
    tools: {
      "../orders/service.js": ["quoteOrder", "createOrder", "createPaymentIntent", "previewPod", "OrderError", "PodUnavailableError"],
      "../orders/group-routes.js": ["createGroupOrder"],
      "../orders/pod-calls.js": ["createPodCall", "PodCallError"],
      "../membership/engine.js": ["earlyAccessVisible", "profileForUser"],
      "../membership/program.js": ["publicProgram", "PROGRAM"],
      "../support/caps.js": ["grantGoodwill"],
      "../support/routes.js": ["createSupportCase", "notifyCase"],
      "../utils/operating-hours.js": ["slotsFor", "canAcceptOrders", "weeklyHours"],
      "./cart.js": ["loadCart", "saveCart", "applyCartOp", "replaceItems", "cartLines", "CartError", "CART_OPS"],
      "./tool-schema.js": ["toStrictToolDefs", "validateToolInput"],
    },
    cart: {
      "../orders/pricing.js": ["MAX_LINE_QUANTITY"],
      "../orders/service.js": ["MAX_ORDER_LINES"],
    },
  };

  function importsOf(text) {
    const out = {};
    const body = strip(text);
    for (const m of body.matchAll(/\bimport\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
      const names = m[1].trim();
      const named = names.match(/^\{([\s\S]*)\}$/);
      assert.ok(named, `only named imports allowed, got: import ${names} from "${m[2]}"`);
      out[m[2]] = [...(out[m[2]] || []), ...named[1].split(",").map((n) => n.trim()).filter(Boolean)];
    }
    for (const m of body.matchAll(/\bexport\s+(?:\{[^}]*\}|\*)\s+from\s+["']([^"']+)["']/g)) out[m[1]] = [...(out[m[1]] || []), "(re-export)"];
    return out;
  }

  test("import allowlist: tools.js and cart.js import only the named services and pure helpers", () => {
    for (const [file, allowed] of Object.entries(ALLOWED_IMPORTS)) {
      const text = src[file];
      assert.ok(!/\bimport\s*\(/.test(strip(text)), `${file}: no dynamic import`);
      assert.ok(!/\brequire\s*\(/.test(strip(text)), `${file}: no require`);
      assert.ok(!/\bimport\s+["']/.test(strip(text)), `${file}: no side-effect import`);
      const found = importsOf(text);
      for (const [mod, names] of Object.entries(found)) {
        assert.ok(Object.hasOwn(allowed, mod), `${file}: import from ${mod} is not on the allowlist`);
        for (const n of names) assert.ok(allowed[mod].includes(n), `${file}: ${n} from ${mod} is not on the allowlist`);
      }
    }
  });

  test("the import check itself rejects a new helper, a default import and a namespace import", () => {
    assert.throws(() => importsOf('import Stripe from "stripe";'));
    assert.throws(() => importsOf('import * as svc from "../orders/service.js";'));
    const found = importsOf('import { markPaid } from "../orders/service.js";\nimport { grantCredit } from "../membership/credits.js";');
    assert.ok(!ALLOWED_IMPORTS.tools["../orders/service.js"].includes("markPaid"));
    assert.ok(!Object.hasOwn(ALLOWED_IMPORTS.tools, "../membership/credits.js"));
    assert.deepEqual(Object.keys(found), ["../orders/service.js", "../membership/credits.js"]);
  });
});

describe("web cards (Task E2): display-only outputs, no new inputs", () => {
  test("cart, reorder and apply_savings return a cart card with the server's quote and the localized display value", async () => {
    const w = world();
    await w.db.menuItem.update({ where: { id: "bokchoy" }, data: { nameZhTW: "青江菜", sliderConfig: { labels: ["Light", "Regular", "Extra"], labelsI18n: { "zh-TW": ["少", "正常", "多"] } } } });
    const ctx = memberCtx(w, { locale: "zh-TW" });
    for (const l of CLASSIC_BOWL) await addToCart(w, ctx, l.menuItemId, l.quantity);
    const r = await addToCart(w, ctx, "bokchoy", 1, "Extra");
    assert.equal(r.card.type, "cart");
    assert.equal(r.card.totalCents, r.quote.totalCents);
    assert.equal(r.card.amountDueCents, r.quote.amountDueCents);
    assert.equal(r.card.subtotalCents, r.quote.subtotalCents);
    const bok = r.card.lines.find((l) => l.menuItemId === "bokchoy" && l.value);
    assert.deepEqual({ name: bok.name, value: bok.value, imageKey: bok.imageKey }, { name: "青江菜", value: "多", imageKey: "Baby Bok Choy" });
    assert.equal(r.card.location, "City Creek Mall");
    assert.equal(r.card.arrival, null, "ASAP");
    // Cleared: no card (nothing to show).
    const cleared = await executeTool("cart", { op: "clear", menuItemId: "", quantity: 0, option: "" }, ctx);
    assert.equal(cleared.card, undefined);
  });

  test("set_arrival_and_pod and an unconfirmed checkout carry the cart card with the pod", async () => {
    const w = world();
    const ctx = memberCtx(w);
    for (const l of CLASSIC_BOWL) await addToCart(w, ctx, l.menuItemId, l.quantity);
    const set = await executeTool("set_arrival_and_pod", { locationId: "", arrival: "ASAP", pod: "best", partySize: 1 }, ctx);
    assert.equal(set.card.type, "cart");
    assert.equal(set.card.pod, set.pod.label);
    const unconfirmed = await executeTool("checkout", { confirmed: false }, ctx);
    assert.equal(unconfirmed.error, "NEEDS_CONFIRMATION");
    assert.equal(unconfirmed.card.type, "cart");
    assert.equal(unconfirmed.card.totalCents, unconfirmed.quote.totalCents);
    assert.equal((await w.db.order.findMany({})).length, 0, "no order from a card");
  });

  test("get_order_status returns an order-status card with the stage, kitchen number, pod and status link", async () => {
    const w = world({ orders: [paidOrder({ status: "PREPPING", kitchenOrderNumber: "0012", orderQrCode: "ORDER-Q1", seatId: "s-a01" })] });
    const r = await executeTool("get_order_status", { orderId: "o_paid" }, memberCtx(w, { locale: "es" }));
    assert.deepEqual(r.card, {
      type: "order-status",
      orderId: "o_paid",
      kitchenNumber: "0012",
      status: "PREPPING",
      paid: true,
      stage: "PREPPING",
      pod: "A-01",
      totalCents: 1924,
      statusPath: "/es/order/status?orderQrCode=ORDER-Q1",
    });
    const w2 = world({ orders: [paidOrder({ status: "PENDING_PAYMENT", paymentStatus: "PENDING", orderQrCode: "ORDER-Q2" })] });
    const unpaid = await executeTool("get_order_status", { orderId: "o_paid" }, memberCtx(w2));
    assert.equal(unpaid.card.stage, "UNPAID");
    assert.equal(unpaid.card.statusPath, null, "no status link before it is paid");
  });

  test("get_menu_item returns a menu-item card (localized name, price, image key, dietary flags)", async () => {
    const w = world();
    await w.db.menuItem.update({ where: { id: "classic" }, data: { nameEs: "Sopa clásica", spiceLevel: 2 } });
    const r = await executeTool("get_menu_item", { itemId: "classic" }, guestCtx(w, { locale: "es" }));
    assert.equal(r.card.type, "menu-item");
    assert.equal(r.card.name, "Sopa clásica");
    assert.equal(r.card.priceCents, 1599);
    assert.equal(r.card.imageKey, "Classic Beef Noodle Soup");
    assert.deepEqual(r.card.dietary, []);
    assert.equal(r.card.spiceLevel, 2);
  });

  test("get_my_profile returns a reward card with the credit balance", async () => {
    const w = world();
    const r = await executeTool("get_my_profile", {}, memberCtx(w));
    assert.equal(r.error, undefined);
    assert.equal(r.card.type, "reward");
    assert.equal(r.card.creditCents, r.creditCents);
    assert.equal(r.card.tier, r.tier);
  });

  test("support cards say what kind of case they are; goodwill is store credit on the card, never a refund", async () => {
    const w = world({ orders: [paidOrder()] });
    const r = await executeTool("report_issue", { category: "cold_food", summary: "My bowl was cold", orderId: "", contact: "" }, memberCtx(w));
    assert.equal(r.card.kind, "issue");
    assert.ok(r.card.goodwillCents > 0 && r.card.goodwillCents <= 500);
    assert.equal(w.stripe.refundCalls.length, 0);
    const refund = await executeTool("request_refund", { orderId: "", reason: "Wrong bowl" }, memberCtx(w));
    assert.equal(refund.card.kind, "refund");
    assert.equal(refund.card.goodwillCents, undefined, "a refund request names no amount");
  });

  test("the tool input schemas are unchanged by the cards (strict size budget)", () => {
    for (const def of TOOL_DEFS) assert.ok(!JSON.stringify(def.input_schema).includes('"card"'), `${def.name} takes no card input`);
  });
});
