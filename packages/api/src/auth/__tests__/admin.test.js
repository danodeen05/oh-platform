import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createAdminAuth, parseAdminEmails, DEFAULT_ADMIN_EMAILS } from "../admin.js";

function replyStub() {
  const r = { statusCode: 200, body: null };
  r.code = (c) => { r.statusCode = c; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
}
const req = (headers = {}) => ({ headers });
const prodEnv = { NODE_ENV: "production", CLERK_SECRET_KEY: "sk_test_x", ADMIN_API_KEY: "key-123" };

function build(overrides = {}, env = prodEnv) {
  const calls = { verify: 0, getUser: 0 };
  const auth = createAdminAuth({
    env,
    verifyToken: async (token, secretKey) => {
      calls.verify += 1;
      if (token === "good" && secretKey === "sk_test_x") return { sub: "user_admin" };
      if (token === "dev-good" && secretKey === "sk_dev_y") return { sub: "user_admin" };
      if (token === "stranger" && secretKey === "sk_test_x") return { sub: "user_other" };
      if (token === "nosub" && secretKey === "sk_test_x") return {};
      throw new Error("bad signature");
    },
    getUser: async (id) => {
      calls.getUser += 1;
      if (id === "user_admin") return { primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "DanoDeen@gmail.com" }, { id: "e2", emailAddress: "other@x.com" }] };
      return { primaryEmailAddressId: "e9", emailAddresses: [{ id: "e9", emailAddress: "someone@else.com" }] };
    },
    ...overrides,
  });
  return { auth, calls };
}

describe("parseAdminEmails", () => {
  test("defaults, trims and lowercases", () => {
    assert.deepEqual(parseAdminEmails(undefined), DEFAULT_ADMIN_EMAILS);
    assert.deepEqual(parseAdminEmails(" A@B.com ,c@d.com,, "), ["a@b.com", "c@d.com"]);
  });
});

describe("requireAdminAuth in production", () => {
  test("rejects a missing header, an arbitrary bearer, a bad signature, and a non-admin user", async () => {
    const { auth } = build();
    for (const headers of [{}, { authorization: "Bearer admin-dashboard" }, { authorization: "Bearer stranger" }, { authorization: "Bearer nosub" }, { authorization: "Basic abc" }, { "x-admin-api-key": "wrong" }]) {
      const reply = replyStub();
      await auth.requireAdminAuth(req(headers), reply);
      assert.equal(reply.statusCode, 401, JSON.stringify(headers));
    }
  });
  test("accepts the API key and an allowlisted Clerk user, caching the lookup", async () => {
    const { auth, calls } = build();
    let reply = replyStub();
    await auth.requireAdminAuth(req({ "x-admin-api-key": "key-123" }), reply);
    assert.equal(reply.statusCode, 200);
    for (let i = 0; i < 3; i += 1) {
      reply = replyStub();
      await auth.requireAdminAuth(req({ authorization: "Bearer good" }), reply);
      assert.equal(reply.statusCode, 200);
    }
    assert.equal(calls.verify, 3);
    assert.equal(calls.getUser, 1, "user lookup is cached");
  });
  test("honours ADMIN_EMAILS and falls closed when the user lookup fails", async () => {
    const strict = build({}, { ...prodEnv, ADMIN_EMAILS: "ops@ohbeef.com" });
    const reply = replyStub();
    await strict.auth.requireAdminAuth(req({ authorization: "Bearer good" }), reply);
    assert.equal(reply.statusCode, 401);
    const broken = build({ getUser: async () => { throw new Error("clerk down"); } });
    const r2 = replyStub();
    await broken.auth.requireAdminAuth(req({ authorization: "Bearer good" }), r2);
    assert.equal(r2.statusCode, 401);
  });
  test("accepts a token from the development instance when CLERK_SECRET_KEY_DEV is set", async () => {
    const { auth, calls } = build({}, { ...prodEnv, CLERK_SECRET_KEY_DEV: "sk_dev_y" });
    const reply = replyStub();
    await auth.requireAdminAuth(req({ authorization: "Bearer dev-good" }), reply);
    assert.equal(reply.statusCode, 200);
    assert.equal(calls.verify, 2, "tried the production key first, then the dev key");
    const without = build({}, prodEnv);
    const r2 = replyStub();
    await without.auth.requireAdminAuth(req({ authorization: "Bearer dev-good" }), r2);
    assert.equal(r2.statusCode, 401);
  });
  test("rejects every bearer when no Clerk secret is configured", async () => {
    const { auth } = build({}, { NODE_ENV: "production", ADMIN_API_KEY: "key-123" });
    const reply = replyStub();
    await auth.requireAdminAuth(req({ authorization: "Bearer good" }), reply);
    assert.equal(reply.statusCode, 401);
  });
});

describe("requireAdminAuth in development", () => {
  test("allows everything only when no ADMIN_API_KEY is set", async () => {
    const open = build({}, { NODE_ENV: "development" });
    const r1 = replyStub();
    await open.auth.requireAdminAuth(req({}), r1);
    assert.equal(r1.statusCode, 200);
    const keyed = build({}, { NODE_ENV: "development", ADMIN_API_KEY: "k", CLERK_SECRET_KEY: "sk" });
    const r2 = replyStub();
    await keyed.auth.requireAdminAuth(req({ authorization: "Bearer admin-dashboard" }), r2);
    assert.equal(r2.statusCode, 401);
  });
});
