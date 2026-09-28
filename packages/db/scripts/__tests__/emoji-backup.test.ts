/** Task G3 fix round 1: the emoji backup never overwrites; the restore only fills still-empty emoji, and a dry run writes nothing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeMemoryPrisma } from "../../../api/src/__tests__/helpers/prisma-memory.js";
import { restoreEmoji, takeEmojiBackup } from "../emoji-backup.ts";
import { noWrites } from "./helpers/no-writes.ts";

function world() {
  return makeMemoryPrisma({
    badges: [
      { id: "b1", slug: "first-order", iconEmoji: "X1" },
      { id: "b2", slug: "vip", iconEmoji: null },
    ],
    challenges: [{ id: "c1", slug: "early-bird", iconEmoji: "X2" }],
  });
}

const quiet = () => {};

test("backup captures non-empty emoji by slug and refuses to overwrite", async () => {
  const prisma = world();
  const file = join(mkdtempSync(join(tmpdir(), "emoji-")), "backup.json");
  const b = await takeEmojiBackup(noWrites(prisma), file);
  assert.deepEqual(b.badges, [{ slug: "first-order", iconEmoji: "X1" }]);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")).challenges, [{ slug: "early-bird", iconEmoji: "X2" }]);
  await assert.rejects(takeEmojiBackup(prisma, file), /already exists/);
});

test("restore: dry run writes nothing; real run fills only still-empty emoji; a re-run changes nothing", async () => {
  const prisma = world();
  const file = join(mkdtempSync(join(tmpdir(), "emoji-")), "backup.json");
  const backup = await takeEmojiBackup(prisma, file);
  // The clear (what backfill-i18n --clear-emoji does), then an admin edits one row.
  await prisma.badge.update({ where: { id: "b1" }, data: { iconEmoji: null } });
  await prisma.challenge.update({ where: { id: "c1" }, data: { iconEmoji: "EDITED" } });

  const log: string[] = [];
  assert.deepEqual(await restoreEmoji(noWrites(prisma, log), backup, { dryRun: true, log: quiet }), { badges: 1, challenges: 0, skippedEdited: 1 });
  assert.deepEqual(log, []);

  await restoreEmoji(prisma, backup, { dryRun: false, log: quiet });
  assert.equal((await prisma.badge.findUnique({ where: { id: "b1" } })).iconEmoji, "X1");
  assert.equal((await prisma.challenge.findUnique({ where: { id: "c1" } })).iconEmoji, "EDITED", "an edited row is left alone");
  assert.deepEqual(await restoreEmoji(noWrites(prisma), backup, { dryRun: true, log: quiet }), { badges: 0, challenges: 0, skippedEdited: 2 });
});
