/** Final review I3: the no-beef vegan correction matches id AND name, is dry-run first and idempotent. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixNoBeefVeganFlag, NO_BEEF_ID, NO_BEEF_NAME } from "../fix-no-beef-vegan-flag.ts";

function fakePrisma(rows: any[]) {
  let writes = 0;
  return {
    get writes() {
      return writes;
    },
    menuItem: {
      findUnique: async ({ where }: any) => {
        const r = rows.find((x) => x.id === where.id);
        return r ? { ...r } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const hit = rows.filter((x) => x.id === where.id && x.name === where.name);
        for (const r of hit) Object.assign(r, data);
        writes += hit.length;
        return { count: hit.length };
      },
    },
  } as any;
}

test("dry run reports would-fix and writes nothing; the real run clears both flags; a re-run is already-correct", async () => {
  const rows = [{ id: NO_BEEF_ID, name: NO_BEEF_NAME, isVegan: true, isVegetarian: true }];
  const prisma = fakePrisma(rows);
  const dry = await fixNoBeefVeganFlag(prisma, { dryRun: true });
  assert.equal(dry.action, "would-fix");
  assert.equal(prisma.writes, 0);
  assert.equal(rows[0].isVegan, true);

  const real = await fixNoBeefVeganFlag(prisma, { dryRun: false });
  assert.equal(real.action, "fixed");
  assert.deepEqual(real.before, { isVegan: true, isVegetarian: true });
  assert.equal(rows[0].isVegan, false);
  assert.equal(rows[0].isVegetarian, false);

  const again = await fixNoBeefVeganFlag(prisma, { dryRun: false });
  assert.equal(again.action, "already-correct");
  assert.equal(prisma.writes, 1);
});

test("refuses when the id is missing", async () => {
  const prisma = fakePrisma([]);
  await assert.rejects(fixNoBeefVeganFlag(prisma, { dryRun: false }), /not found; refusing/);
  assert.equal(prisma.writes, 0);
});

test("refuses when the name differs, even on the right id", async () => {
  const rows = [{ id: NO_BEEF_ID, name: "Classic Beef Noodle Soup", isVegan: true, isVegetarian: true }];
  const prisma = fakePrisma(rows);
  await assert.rejects(fixNoBeefVeganFlag(prisma, { dryRun: false }), /refusing/);
  assert.equal(rows[0].isVegan, true);
  assert.equal(prisma.writes, 0);
});
