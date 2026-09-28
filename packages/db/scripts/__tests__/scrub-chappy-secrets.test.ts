/** Task E2 fix round 1: the Chappy secrets scrub is correct and idempotent. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planRow, scrub } from "../scrub-chappy-secrets.ts";

const CUTOVER = new Date("2026-10-01T00:00:00Z");
const OLD = new Date("2026-09-20T00:00:00Z");
const NEW = new Date("2026-10-02T00:00:00Z");

const legacyMessages = [
  { role: "user", content: "apple pay please" },
  { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "create_apple_pay_order", input: {} }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ orderId: "o1", clientSecret: "pi_3L_secret_zz" }) }] },
  { role: "assistant", content: [{ type: "text", text: "Tap Apple Pay." }] },
];

function fakePrisma(rows: any[]) {
  return {
    chappyConversation: {
      findMany: async ({ cursor, take }: any) => {
        const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
        const start = cursor ? sorted.findIndex((r) => r.id === cursor.id) + 1 : 0;
        return sorted.slice(start, start + take).map((r) => structuredClone(r));
      },
      update: async ({ where, data }: any) => {
        Object.assign(rows.find((r) => r.id === where.id), data);
      },
    },
  } as any;
}

test("planRow scrubs secrets from messages and cart and retires pre-cutover conversations", () => {
  const plan = planRow({ id: "c1", messages: legacyMessages, cart: { note: "pi_9_secret_q" }, isActive: true, updatedAt: OLD }, CUTOVER);
  assert.equal(plan.messages, true);
  assert.equal(plan.cart, true);
  assert.equal(plan.deactivate, true);
  assert.ok(!JSON.stringify(plan.data).includes("_secret_"));
  assert.equal(plan.data?.isActive, false);
  const clean = planRow({ id: "c2", messages: [{ role: "user", content: "hi" }], cart: null, isActive: true, updatedAt: NEW }, CUTOVER);
  assert.equal(clean.data, null);
});

test("scrub: dry run writes nothing; a real run fixes everything; a second run finds nothing", async () => {
  const rows = [
    { id: "a", messages: structuredClone(legacyMessages), cart: null, isActive: true, updatedAt: OLD },
    { id: "b", messages: [{ role: "user", content: "hi" }], cart: null, isActive: true, updatedAt: NEW },
    { id: "c", messages: [], cart: null, isActive: false, updatedAt: OLD },
  ];
  const prisma = fakePrisma(rows);
  const dry = await scrub(prisma, { cutover: CUTOVER, dryRun: true });
  assert.deepEqual(dry, { scanned: 3, messagesScrubbed: 1, cartsScrubbed: 0, deactivated: 1 });
  assert.ok(JSON.stringify(rows).includes("_secret_"), "dry run changed nothing");

  const real = await scrub(prisma, { cutover: CUTOVER, dryRun: false });
  assert.deepEqual(real, dry);
  assert.ok(!JSON.stringify(rows).includes("_secret_"));
  assert.equal(rows[0].isActive, false);
  assert.equal(rows[1].isActive, true, "a post-cutover conversation stays active");
  assert.equal(rows[0].updatedAt.getTime(), OLD.getTime(), "the scrub is not activity");

  const again = await scrub(prisma, { cutover: CUTOVER, dryRun: false });
  assert.deepEqual(again, { scanned: 3, messagesScrubbed: 0, cartsScrubbed: 0, deactivated: 0 });
});
