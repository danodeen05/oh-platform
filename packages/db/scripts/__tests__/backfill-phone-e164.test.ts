/** Task G3: backfill-phone-e164's core is dry-run safe and idempotent. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { backfillTable } from "../backfill-phone-e164.ts";

function table(rows: { id: string; phone: string | null }[]) {
  const writes: string[] = [];
  return {
    rows,
    writes,
    findMany: async () => rows.map((r) => ({ ...r })),
    update: async (id: string, phone: string) => {
      writes.push(id);
      rows.find((r) => r.id === id)!.phone = phone;
    },
    findConflict: async (phone: string, excludingId: string) => rows.find((r) => r.phone === phone && r.id !== excludingId) ?? null,
  };
}

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = orig;
  }
};

const fixture = () => [
  { id: "a", phone: "(801) 555-1234" },
  { id: "b", phone: "+18015559876" },
  { id: "c", phone: "12" },
  { id: "d", phone: null },
  { id: "e", phone: "801-555-9876" }, // collides with b once normalized
];

test("dry run counts the changes and calls update zero times", async () => {
  const t = table(fixture());
  const counts = await quiet(() => backfillTable({} as any, "User", t.findMany, t.update, true, t.findConflict));
  assert.deepEqual(t.writes, []);
  assert.deepEqual(counts, { total: 4, alreadyOk: 1, updated: 1, unparseable: 1, conflicts: 1 });
  assert.equal(t.rows[0].phone, "(801) 555-1234");
});

test("a real run normalizes, and a second real run changes nothing", async () => {
  const t = table(fixture());
  const first = await quiet(() => backfillTable({} as any, "User", t.findMany, t.update, false, t.findConflict));
  assert.equal(first.updated, 1);
  assert.equal(t.rows[0].phone, "+18015551234");
  assert.equal(t.rows[4].phone, "801-555-9876", "a conflicting row is left for manual review");
  t.writes.length = 0;
  const second = await quiet(() => backfillTable({} as any, "User", t.findMany, t.update, false, t.findConflict));
  assert.equal(second.updated, 0);
  assert.deepEqual(t.writes, []);
});
