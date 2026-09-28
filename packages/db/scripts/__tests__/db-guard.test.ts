/** Task G3: the shared target guard every cutover script calls before touching a row. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDatabaseUrl, requireSafeTarget, targetBanner } from "../lib/db-guard.ts";

const LOCAL = "postgresql://oh:pw@127.0.0.1:5432/oh_overhaul?schema=public";
const REMOTE = "postgresql://postgres:s3cret@some.proxy.rlwy.net:12345/railway";

test("describes host and database, never credentials", () => {
  const d = describeDatabaseUrl(REMOTE)!;
  assert.deepEqual(d, { host: "some.proxy.rlwy.net", database: "railway", local: false });
  assert.equal(describeDatabaseUrl(LOCAL)!.local, true);
  assert.equal(describeDatabaseUrl("postgresql://u:p@localhost/x")!.local, true);
  assert.equal(describeDatabaseUrl("mysql://x@127.0.0.1/y"), null);
  assert.equal(describeDatabaseUrl(undefined), null);
  assert.ok(!targetBanner("s", d, true).includes("s3cret"));
});

test("a remote URL is refused unless ALLOW_NON_LOCAL=1 or the script's legacy flag is set", () => {
  assert.throws(() => requireSafeTarget("s", { DATABASE_URL: REMOTE }), /not local/);
  assert.throws(() => requireSafeTarget("s", { DATABASE_URL: REMOTE, ALLOW_NON_LOCAL: "true" }), /not local/);
  assert.equal(requireSafeTarget("s", { DATABASE_URL: REMOTE, ALLOW_NON_LOCAL: "1" }).local, false);
  assert.equal(requireSafeTarget("s", { DATABASE_URL: REMOTE, ALLOW_NON_LOCAL_SCRUB: "1" }, ["ALLOW_NON_LOCAL_SCRUB"]).local, false);
  assert.throws(() => requireSafeTarget("s", { DATABASE_URL: REMOTE, ALLOW_NON_LOCAL_SCRUB: "1" }), /not local/);
});

test("a missing or non-postgres URL is refused; a local one passes", () => {
  assert.throws(() => requireSafeTarget("s", {}), /missing/);
  assert.equal(requireSafeTarget("s", { DATABASE_URL: LOCAL }).database, "oh_overhaul");
});
