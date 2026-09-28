import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { createCustomerAuth, registerCustomerIdentity } from "../auth/customer.js";
import { makeMemoryPrisma } from "./helpers/prisma-memory.js";
import { SUPPORTED_LOCALES, normalizeLocale, resolveLocale, applyUserLocaleUpdate } from "../locale.js";

test("SUPPORTED_LOCALES is exactly the 4 shipped locales", () => {
  assert.deepEqual([...SUPPORTED_LOCALES].sort(), ["en", "es", "zh-CN", "zh-TW"]);
});

test("normalizeLocale accepts any casing of a supported locale and defaults everything else to en", () => {
  assert.equal(normalizeLocale("zh-tw"), "zh-TW");
  assert.equal(normalizeLocale("ZH-TW"), "zh-TW");
  assert.equal(normalizeLocale("zh-cn"), "zh-CN");
  assert.equal(normalizeLocale("ES"), "es");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), "en");
  assert.equal(normalizeLocale(undefined), "en");
  assert.equal(normalizeLocale(""), "en");
  assert.equal(normalizeLocale(null), "en");
});

test("resolveLocale prefers user.locale, then order.locale, then guest.locale, then en", () => {
  assert.equal(resolveLocale({ locale: "zh-TW" }, { locale: "es" }, { locale: "en" }), "zh-TW");
  assert.equal(resolveLocale(null, { locale: "es" }, { locale: "en" }), "es");
  assert.equal(resolveLocale(null, null, { locale: "zh-CN" }), "zh-CN");
  assert.equal(resolveLocale(null, null, null), "en");
  assert.equal(resolveLocale({ locale: "zh-tw" }, null, null), "zh-TW"); // normalized
});

describe("applyUserLocaleUpdate (PATCH /users/:id body -> { status, body })", () => {
  test("rejects an unsupported locale without writing", async () => {
    const prisma = makeMemoryPrisma({ users: [{ id: "u1", locale: "en" }] });
    const result = await applyUserLocaleUpdate(prisma, { id: "u1", locale: "fr" });
    assert.equal(result.status, 400);
    assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).locale, "en");
  });

  test("rejects a missing locale", async () => {
    const prisma = makeMemoryPrisma({ users: [{ id: "u1", locale: "en" }] });
    const result = await applyUserLocaleUpdate(prisma, { id: "u1", locale: undefined });
    assert.equal(result.status, 400);
  });

  test("accepts each of the 4 supported locales", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const prisma = makeMemoryPrisma({ users: [{ id: "u1", locale: "en" }] });
      const result = await applyUserLocaleUpdate(prisma, { id: "u1", locale });
      assert.equal(result.status, 200);
      assert.equal(result.body.locale, locale);
    }
  });
});

describe("PATCH /users/:id over HTTP, wired the same way index.js wires it", () => {
  const ENV = { CLERK_SECRET_KEY: "sk_test_x" };
  const CLERK_USERS = {
    user_me: { primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "me@x.com", verification: { status: "verified" } }] },
    user_other: { primaryEmailAddressId: "e2", emailAddresses: [{ id: "e2", emailAddress: "other@x.com", verification: { status: "verified" } }] },
  };

  async function buildApp() {
    const dbPrisma = makeMemoryPrisma({
      users: [
        { id: "db_me", email: "me@x.com", locale: "en" },
        { id: "db_other", email: "other@x.com", locale: "en" },
      ],
    });
    const auth = createCustomerAuth({
      env: ENV,
      verifyToken: async (token) => {
        if (token.startsWith("clerk:")) return { sub: token.slice(6) };
        throw new Error("bad signature");
      },
      getUser: async (id) => {
        if (!CLERK_USERS[id]) throw new Error("no such user");
        return CLERK_USERS[id];
      },
      prisma: {
        user: {
          findFirst: async ({ where }) => {
            const email = (where.email?.equals ?? "").toLowerCase();
            const row = await dbPrisma.user.findFirst({ where: { email } });
            return row ? { id: row.id } : null;
          },
        },
      },
    });

    const app = Fastify();
    registerCustomerIdentity(app, auth);
    // Exactly what index.js's PATCH /users/:id handler does (see locale.js).
    app.patch("/users/:id", async (req, reply) => {
      const result = await applyUserLocaleUpdate(dbPrisma, { id: req.params.id, locale: req.body?.locale });
      return reply.code(result.status).send(result.body);
    });
    await app.ready();
    return { app, dbPrisma };
  }

  test("a signed-in user can set their own locale", async () => {
    const { app, dbPrisma } = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/users/db_me",
      headers: { authorization: "Bearer clerk:user_me" },
      payload: { locale: "zh-TW" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal((await dbPrisma.user.findUnique({ where: { id: "db_me" } })).locale, "zh-TW");
  });

  test("a signed-in user cannot set another user's locale", async () => {
    const { app, dbPrisma } = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/users/db_other",
      headers: { authorization: "Bearer clerk:user_me" },
      payload: { locale: "es" },
    });
    assert.equal(res.statusCode, 403);
    assert.equal((await dbPrisma.user.findUnique({ where: { id: "db_other" } })).locale, "en");
  });

  test("an anonymous caller is rejected", async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/users/db_me", payload: { locale: "es" } });
    assert.equal(res.statusCode, 401);
  });

  test("an unsupported locale ('fr') returns 400 and writes nothing", async () => {
    const { app, dbPrisma } = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/users/db_me",
      headers: { authorization: "Bearer clerk:user_me" },
      payload: { locale: "fr" },
    });
    assert.equal(res.statusCode, 400);
    assert.equal((await dbPrisma.user.findUnique({ where: { id: "db_me" } })).locale, "en");
  });
});
