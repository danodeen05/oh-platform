/**
 * Boot smoke test (Task B3, carried from B1: a startup crash shipped that no
 * unit test caught, because unit tests inject deps and never actually start
 * the process).
 *
 * Spawns the real server (`node src/index.js`) on a free, OS-assigned port
 * against the private oh_overhaul database (the worktree's .env, same as the
 * `dev` script) and confirms it comes up: GET /health returns 200. Every exit
 * path (pass, fail, throw) kills the child; `after` is a safety net in case a
 * failure short-circuits the test body before its own `finally`.
 *
 * Task F2 fix round 1 (review) added a few more requests after /health: they
 * exist only to prove index.js's own wiring for a couple of untestable-any-
 * other-way routes/behaviors (PATCH /users/:id is registered and auth-guarded,
 * POST /guests 400s on an invalid phone) - not to re-test logic that already
 * has real unit coverage elsewhere (locale.js, utils/phone.js).
 *
 * Schedulers that could send anything are kept off: REDIS_URL is cleared (the
 * autonomous scheduler only starts when it's set), and PLAN_VISIT_SUMMARIES /
 * SUPPORT_NOTIFY are forced off, so this test sends no messages and hits no
 * external services.
 *
 * Skip with SKIP_BOOT_TEST=1 (e.g. no local Postgres available).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const API_ROOT = path.resolve(import.meta.dirname, "..", "..");
const BOOT_TIMEOUT_MS = 30_000;
const SKIP = process.env.SKIP_BOOT_TEST === "1";

/** An OS-assigned free port on loopback: never one of the reserved dev ports (R12/Lane 1 notes). */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function pollHealth(port, deadline) {
  const url = `http://127.0.0.1:${port}/health`;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return res;
      lastErr = new Error(`GET /health returned ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`/health never returned 200 within ${BOOT_TIMEOUT_MS}ms: ${lastErr?.message}`);
}

/** Kill `child` and wait for it to actually exit (SIGTERM, then SIGKILL after a grace period). */
function killAndWait(child, graceMs = 3000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const t = setTimeout(() => child.kill("SIGKILL"), graceMs);
    child.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

// Module-level so the `after` safety net can reach whatever the test started,
// even if the test's own try/finally never got to run.
let child = null;

after(async () => {
  if (child) await killAndWait(child);
});

test("the API boots and answers GET /health (Task B1 startup-crash regression)", { skip: SKIP }, async () => {
  const port = await getFreePort();
  const stdout = [];
  const stderr = [];

  child = spawn(process.execPath, ["--env-file=../../.env", "src/index.js"], {
    cwd: API_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      REDIS_URL: "", // the autonomous scheduler only starts when this is set
      PLAN_VISIT_SUMMARIES: "off",
      SUPPORT_NOTIFY: "off",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => stdout.push(d));
  child.stderr.on("data", (d) => stderr.push(d));
  let exited = null;
  child.on("exit", (code, signal) => {
    exited = { code, signal };
  });

  try {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    const res = await Promise.race([
      pollHealth(port, deadline),
      new Promise((_, reject) => {
        child.once("exit", (code, signal) => reject(new Error(`server process exited early (code=${code}, signal=${signal})`)));
      }),
    ]);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });

    // Task F2 fix round 1 (review): index.js wires phone normalization and
    // the new PATCH /users/:id route directly (no unit test can reach them
    // without spawning the real process - see notifications/locale.js's own
    // tests for the logic itself). Prove the wiring here instead.
    const base = `http://127.0.0.1:${port}`;

    // PATCH /users/:id is registered and guarded by registerCustomerIdentity's
    // onRoute hook: an unauthenticated caller gets 401 (never a 404, which
    // would mean the route isn't registered at all).
    const patchLocale = await fetch(`${base}/users/does-not-exist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "es" }),
    });
    assert.equal(patchLocale.status, 401, `PATCH /users/:id (no auth): ${await patchLocale.text()}`);

    // POST /guests normalizes phone to E.164 and 400s on garbage (Task F2).
    const postGuests = await fetch(`${base}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Boot Test", phone: "abc" }),
    });
    assert.equal(postGuests.status, 400);
    assert.equal((await postGuests.json()).code, "INVALID_PHONE");

    // PATCH /users/:id/phone is guarded the same way as PATCH /users/:id.
    const patchPhone = await fetch(`${base}/users/does-not-exist/phone`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "abc" }),
    });
    assert.equal(patchPhone.status, 401, `PATCH /users/:id/phone (no auth): ${await patchPhone.text()}`);
  } catch (err) {
    const tail = (buf) => Buffer.concat(buf).toString("utf8").slice(-4000);
    console.error("[boot.test] server exited:", exited, "stdout tail:", tail(stdout), "stderr tail:", tail(stderr));
    throw err;
  } finally {
    await killAndWait(child);
    child = null;
  }
});
