/**
 * Task G3: cutover-migrate.sh against the LOCAL oh_overhaul database, inside
 * a throwaway schema (search_path via PGOPTIONS) holding stub tables shaped
 * like prod before release 2. The real tables in `public` are never touched,
 * and the schema is dropped afterwards. Skipped when DATABASE_URL is not
 * local or psql is missing.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describeDatabaseUrl } from "../lib/db-guard.ts";

const SCRIPT = fileURLToPath(new URL("../cutover-migrate.sh", import.meta.url));
const ROOT_ENV = fileURLToPath(new URL("../../../../.env", import.meta.url));

function localUrl(): string | null {
  let url = process.env.DATABASE_URL;
  if (!url) {
    try {
      const line = readFileSync(ROOT_ENV, "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="));
      url = line?.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");
    } catch {
      return null;
    }
  }
  const d = describeDatabaseUrl(url);
  return d?.local ? url! : null;
}

const URL_ = localUrl();
const HAS_PSQL = spawnSync("psql", ["--version"]).status === 0;
const SKIP = !URL_ || !HAS_PSQL ? "needs a local DATABASE_URL and psql" : false;
const SCHEMA = `g3_migrate_test_${process.pid}`;
const PSQL_URL = URL_?.split("?")[0] ?? "";

function sql(statement: string) {
  return execFileSync("psql", [PSQL_URL, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", statement], { encoding: "utf8" }).trim();
}

function run(args: string[], env: Record<string, string> = {}) {
  const res = spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: URL_!, PGOPTIONS: `-c search_path=${SCHEMA}`, ...env },
  });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

function columns(): string[] {
  return sql(`SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema = '${SCHEMA}' ORDER BY 1`).split("\n").filter(Boolean);
}

before(() => {
  if (SKIP) return;
  sql(`CREATE SCHEMA ${SCHEMA}`);
  for (const t of ["CreditLot", "Seat", "SupportCase", "ChappyConversation"]) sql(`CREATE TABLE ${SCHEMA}."${t}" (id text PRIMARY KEY)`);
});

after(() => {
  if (SKIP) return;
  sql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
});

test("refuses a remote DATABASE_URL without ALLOW_NON_LOCAL=1 (before connecting)", { skip: SKIP }, () => {
  const r = run(["--dry-run"], { DATABASE_URL: "postgresql://u:p@db.example.invalid:5432/railway" });
  assert.equal(r.code, 2);
  assert.match(r.out, /not local/);
  assert.ok(!r.out.includes("u:p"), "credentials are never printed");
});

test("dry run proves each pending migration applies, and leaves nothing behind", { skip: SKIP }, () => {
  const r = run(["--dry-run"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /20260929000000_comb_seats: applies cleanly/);
  assert.match(r.out, /20260930000000_support_resolution: applies cleanly/);
  assert.match(r.out, /20261001000000_chappy_cart: applies cleanly/);
  assert.deepEqual(columns(), ["ChappyConversation.id", "CreditLot.id", "Seat.id", "SupportCase.id"]);
});

test("real run applies all three; a re-run skips them all", { skip: SKIP }, () => {
  const r = run([]);
  assert.equal(r.code, 0, r.out);
  assert.equal((r.out.match(/APPLIED/g) ?? []).length, 3);
  assert.deepEqual(columns(), [
    "ChappyConversation.cart",
    "ChappyConversation.id",
    "CreditLot.id",
    "Seat.bestRank",
    "Seat.id",
    "SupportCase.id",
    "SupportCase.resolutionDetail",
    "SupportCase.resolutionNote",
  ]);
  const again = run([]);
  assert.equal(again.code, 0, again.out);
  assert.equal((again.out.match(/already applied, skip/g) ?? []).length, 3);
  assert.match(again.out, /nothing to apply/);
  assert.equal(run(["--dry-run"]).code, 0);
});

test("a partially applied migration stops the run", { skip: SKIP }, () => {
  sql(`ALTER TABLE ${SCHEMA}."SupportCase" DROP COLUMN "resolutionNote"`);
  const r = run(["--dry-run"]);
  assert.equal(r.code, 4);
  assert.match(r.out, /PARTIAL \(1 of 2 columns\)/);
});

test("a missing release-1 baseline stops the run", { skip: SKIP }, () => {
  sql(`DROP TABLE ${SCHEMA}."CreditLot"`);
  const r = run(["--dry-run"]);
  assert.equal(r.code, 3);
  assert.match(r.out, /baseline/);
});
