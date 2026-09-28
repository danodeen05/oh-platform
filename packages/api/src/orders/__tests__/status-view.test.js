/**
 * Task D6: GET /orders/status's body (buildStatusView). The status page and
 * the business plan's phone demo both read it, so every field it had before
 * must stay; D6 only adds podLabel, location.timezone, a localized location
 * name and items[].selectedLabel.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildStatusView, sliderDisplayLabel } from "../status-view.js";
import { buildDemoOrder } from "../../demo/status-demo.js";

const SPICE = {
  id: "m-spice",
  name: "Spice Level",
  nameZhCN: "辣度",
  categoryType: "SLIDER",
  sliderConfig: { labels: ["None", "Mild", "Medium", "Hot"], labelsI18n: { "zh-CN": ["不辣", "微辣", "中辣", "特辣"], es: ["Nada"] } },
};
const BOWL = { id: "m-bowl", name: "Classic Beef Noodle Soup", nameZhCN: "经典牛肉面", categoryType: "MAIN" };

const ORDER = {
  id: "o1",
  orderNumber: "ORD-1",
  kitchenOrderNumber: "B07",
  orderQrCode: "ORDER-abc",
  status: "PREPPING",
  totalCents: 1799,
  estimatedArrival: null,
  paidAt: new Date("2026-09-28T18:00:00Z"),
  arrivedAt: null,
  queuedAt: null,
  prepStartTime: null,
  readyTime: null,
  deliveredAt: null,
  completedTime: null,
  podAssignedAt: null,
  podConfirmedAt: null,
  queuePosition: null,
  estimatedWaitMinutes: null,
  guestName: "Mei Lin Chen",
  guest: null,
  seat: { id: "s1", number: "B-07", label: "B-07" },
  location: { id: "L1", name: "City Creek Mall", city: "Salt Lake City", timezone: "America/Denver", i18n: { "zh-CN": { name: "城市溪流购物中心" } } },
  items: [
    { id: "i1", quantity: 1, selectedValue: null, priceCents: 1599, menuItem: BOWL },
    { id: "i2", quantity: 1, selectedValue: "Medium", priceCents: 0, menuItem: SPICE },
  ],
};

describe("buildStatusView", () => {
  test("keeps every field the status page and the plan demo read", () => {
    const { order } = buildStatusView(ORDER, { locale: "en" });
    for (const key of [
      "id", "orderNumber", "kitchenOrderNumber", "orderQrCode", "status", "totalCents", "estimatedArrival",
      "paidAt", "arrivedAt", "queuedAt", "prepStartTime", "readyTime", "deliveredAt", "completedTime",
      "podNumber", "podAssignedAt", "podConfirmedAt", "queuePosition", "estimatedWaitMinutes", "location", "guestName", "items",
    ]) {
      assert.ok(key in order, `missing ${key}`);
    }
    assert.equal(order.podNumber, "B-07");
    assert.deepEqual(Object.keys(order.items[0]).sort(), ["categoryType", "id", "name", "priceCents", "quantity", "selectedLabel", "selectedValue"]);
    assert.equal(order.location.city, "Salt Lake City");
  });

  test("adds the pod label, the location's zone and a localized name", () => {
    const { order } = buildStatusView(ORDER, { locale: "zh-CN" });
    assert.equal(order.podLabel, "B-07");
    assert.equal(order.location.timezone, "America/Denver");
    assert.equal(order.location.name, "城市溪流购物中心");
    assert.equal(order.items[0].name, "经典牛肉面");
  });

  test("a slider choice keeps its English value and gains the page's label", () => {
    const zh = buildStatusView(ORDER, { locale: "zh-CN" }).order.items[1];
    assert.equal(zh.selectedValue, "Medium");
    assert.equal(zh.selectedLabel, "中辣");
    assert.equal(buildStatusView(ORDER, { locale: "en" }).order.items[1].selectedLabel, "Medium");
    // A mis-sized translation falls back to the English labels (F1a rule).
    assert.equal(sliderDisplayLabel(SPICE, "Medium", "es"), "Medium");
    assert.equal(sliderDisplayLabel(SPICE, "Unknown", "zh-CN"), null);
    assert.equal(sliderDisplayLabel(BOWL, "Medium", "zh-CN"), null);
  });

  test("a full guest name only for a viewer who may see the full order", () => {
    assert.equal(buildStatusView(ORDER, { canSeeFull: false }).order.guestName, "Mei");
    assert.equal(buildStatusView(ORDER, { canSeeFull: true }).order.guestName, "Mei Lin Chen");
  });

  test("the plan's demo order still renders: pod 32 by number, no label", () => {
    const location = { id: "L1", name: "City Creek Mall", city: "Salt Lake City", tenantId: "t1" };
    const menu = [{ ...BOWL, tenantId: "t1", basePriceCents: 1599 }, { ...SPICE, name: "Spice Level", basePriceCents: 0, tenantId: "t1" }];
    const demo = buildDemoOrder({ code: "DEMO-PLAN.PREPPING", menu, location, now: new Date("2026-09-28T18:00:00Z") });
    const { order } = buildStatusView(demo, { locale: "en", canSeeFull: true });
    assert.equal(order.status, "PREPPING");
    assert.equal(order.podNumber, "32");
    assert.equal(order.podLabel, null);
    assert.equal(order.guestName, "Alex");
    assert.equal(order.orderQrCode, "DEMO-PLAN.PREPPING");
    assert.equal(order.location.timezone, "America/Denver");
  });
});
