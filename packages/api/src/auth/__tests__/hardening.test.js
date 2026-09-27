// Task A10b: routes that used to act on a client-supplied user id.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { createCustomerAuth } from "../customer.js";
import { createAdminAuth } from "../admin.js";
import { createKioskAuth, KIOSK_KEY_PREFIX } from "../kiosk.js";
import {
  publicReferral,
  shopCreditSpender,
  groupOrderMember,
  ADMIN_ONLY_ROUTES,
  registerAdminOnlyRoutes,
} from "../hardening.js";

const ENV = { CLERK_SECRET_KEY: "sk_test_x", CHAPPY_GUEST_SECRET: "guest-secret-for-tests", ADMIN_API_KEY: "key-123" };
const CLERK_USERS = {
  user_me: { primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "me@x.com", verification: { status: "verified" } }] },
  user_admin: { primaryEmailAddressId: "e9", emailAddresses: [{ id: "e9", emailAddress: "boss@x.com", verification: { status: "verified" } }] },
};
const DB_USERS = { "me@x.com": "db_me", "boss@x.com": "db_boss" };

const verifyToken = async (token) => {
  if (token.startsWith("clerk:")) return { sub: token.slice(6) };
  throw new Error("bad signature");
};
const getUser = async (id) => {
  if (!CLERK_USERS[id]) throw new Error("no such user");
  return CLERK_USERS[id];
};

function customerAuth(env = ENV) {
  return createCustomerAuth({
    env,
    verifyToken,
    getUser,
    prisma: { user: { findFirst: async ({ where }) => (DB_USERS[where.email.equals.toLowerCase()] ? { id: DB_USERS[where.email.equals.toLowerCase()] } : null) } },
  });
}

function adminAuth(env = { ...ENV, ADMIN_EMAILS: "boss@x.com" }) {
  return createAdminAuth({ env, verifyToken, getUser });
}

const DEVICES = {
  kiosk_good: { id: "dev1", isActive: true, locationId: "loc_cc", location: { id: "loc_cc" } },
  kiosk_off: { id: "dev2", isActive: false, locationId: "loc_cc", location: { id: "loc_cc" } },
};
function kioskAuth(admin = adminAuth()) {
  return createKioskAuth({ findDeviceByKey: async (key) => DEVICES[key] || null, requireAdminAuth: admin.requireAdminAuth });
}

const bearer = (t) => ({ authorization: `Bearer ${t}` });

describe("GET /users/referral/:code (publicReferral)", () => {
  test("only public-safe fields: first name, code, validity; never email, id or phone", () => {
    const out = publicReferral({ id: "db_me", name: "Dano Deen", email: "me@x.com", phone: "+18015550100", referralCode: "DANO1" });
    assert.deepEqual(out, { valid: true, code: "DANO1", firstName: "Dano" });
    assert.equal("email" in out, false);
    assert.equal("id" in out, false);
    assert.equal("phone" in out, false);
  });
  test("a user without a name yields a null first name; no user is invalid", () => {
    assert.deepEqual(publicReferral({ id: "x", name: null, email: "a@b.c", referralCode: "C1" }), { valid: true, code: "C1", firstName: null });
    assert.equal(publicReferral(null), null);
  });
});

describe("POST /shop/orders/:id/apply-credits (shopCreditSpender)", () => {
  test("credits come from the verified caller, who must own the shop order", () => {
    const me = { kind: "user", userId: "db_me", email: "me@x.com" };
    assert.deepEqual(shopCreditSpender(me, { id: "so1", userId: "db_me" }), { userId: "db_me" });
    assert.equal(shopCreditSpender(me, { id: "so1", userId: "db_other" }).status, 403);
    assert.equal(shopCreditSpender(me, { id: "so1", userId: null }).status, 403);
    assert.equal(shopCreditSpender({ kind: "anonymous" }, { id: "so1", userId: "db_me" }).status, 401);
    assert.equal(shopCreditSpender({ kind: "guest", guestKey: "g" }, { id: "so1", userId: "db_me" }).status, 401);
    assert.equal(shopCreditSpender(me, null).status, 404);
  });

  test("inject: another user's id in the body is ignored; only the verified owner spends", async () => {
    const auth = customerAuth();
    const orders = { so_mine: { id: "so_mine", userId: "db_me" }, so_theirs: { id: "so_theirs", userId: "db_other" } };
    const app = Fastify();
    // Mirrors index.js: identity first, then ownership; the body userId is never read.
    app.post("/shop/orders/:id/apply-credits", async (req, reply) => {
      const who = await auth.requireUser(req, reply);
      if (!who) return reply;
      const verdict = shopCreditSpender(who, orders[req.params.id] || null);
      if (verdict.status) return reply.code(verdict.status).send({ error: verdict.error });
      return { spender: verdict.userId };
    });
    const anon = await app.inject({ method: "POST", url: "/shop/orders/so_theirs/apply-credits", payload: { userId: "db_other", amountCents: 500 } });
    assert.equal(anon.statusCode, 401);
    const forged = await app.inject({ method: "POST", url: "/shop/orders/so_theirs/apply-credits", headers: bearer("clerk:user_me"), payload: { userId: "db_other", amountCents: 500 } });
    assert.equal(forged.statusCode, 403);
    const mine = await app.inject({ method: "POST", url: "/shop/orders/so_mine/apply-credits", headers: bearer("clerk:user_me"), payload: { userId: "db_other", amountCents: 500 } });
    assert.equal(mine.statusCode, 200);
    assert.deepEqual(mine.json(), { spender: "db_me" });
  });
});

describe("POST /gift-cards/:id/redeem", () => {
  test("inject: the redeemer is the verified caller; a body userId is ignored and anonymous is 401", async () => {
    const auth = customerAuth();
    const app = Fastify();
    app.post("/gift-cards/:id/redeem", async (req, reply) => {
      const who = await auth.requireUser(req, reply);
      if (!who) return reply;
      return { redeemer: who.userId };
    });
    const anon = await app.inject({ method: "POST", url: "/gift-cards/gc1/redeem", payload: { userId: "db_other" } });
    assert.equal(anon.statusCode, 401);
    const forged = await app.inject({ method: "POST", url: "/gift-cards/gc1/redeem", headers: bearer("clerk:user_me"), payload: { userId: "db_other" } });
    assert.deepEqual(forged.json(), { redeemer: "db_me" });
  });
});

describe("POST /group-orders/:code/orders (groupOrderMember)", () => {
  test("the member id is the verified caller; guests and anonymous callers get null", () => {
    const me = { kind: "user", userId: "db_me", email: "me@x.com" };
    assert.deepEqual(groupOrderMember(me, { userId: "db_other" }), { userId: "db_me", guestId: null });
    assert.deepEqual(groupOrderMember({ kind: "anonymous" }, { guestId: "guest_1" }), { userId: null, guestId: "guest_1" });
    assert.deepEqual(groupOrderMember({ kind: "guest", guestKey: "k" }, { userId: "db_other", guestId: "guest_1" }), { userId: null, guestId: "guest_1" });
  });
  test("a claimed userId without a verified session is 401; nothing at all is 400", () => {
    assert.equal(groupOrderMember({ kind: "anonymous" }, { userId: "db_other" }).status, 401);
    assert.equal(groupOrderMember({ kind: "anonymous" }, {}).status, 400);
    assert.equal(groupOrderMember({ kind: "user", userId: null, email: "new@x.com" }, {}).status, 403);
  });
  test("a signed-in member keeps a guest id the client sends alongside (guest checkout row)", () => {
    const me = { kind: "user", userId: "db_me", email: "me@x.com" };
    assert.deepEqual(groupOrderMember(me, { guestId: "guest_1" }), { userId: "db_me", guestId: "guest_1" });
  });
});

describe("wallet diagnostics and kiosk device admin are admin only", () => {
  test("the list covers the wallet debug routes and the kiosk device admin routes", () => {
    for (const url of ["/wallet/debug", "/wallet/test-push/:userId", "/wallet/refresh-all", "/kiosk-devices", "/kiosk-devices/:id", "/kiosk-devices/:id/rotate-key"]) {
      assert.ok(ADMIN_ONLY_ROUTES.includes(url), url);
    }
  });

  async function appWith(admin) {
    const app = Fastify();
    registerAdminOnlyRoutes(app, admin.requireAdminAuth);
    app.get("/wallet/debug", async () => ({ registrations: [{ email: "me@x.com" }] }));
    app.post("/wallet/test-push/:userId", async (req) => ({ pushed: req.params.userId }));
    app.post("/kiosk-devices", async () => ({ apiKey: "kiosk_new" }));
    app.get("/wallet/status", async () => ({ public: true }));
    await app.ready();
    return app;
  }

  test("inject: anonymous and non-admin callers get 401; admin key and admin Clerk session pass", async () => {
    const app = await appWith(adminAuth());
    assert.equal((await app.inject({ method: "GET", url: "/wallet/debug" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/wallet/test-push/db_me" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/kiosk-devices", payload: {} })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/wallet/debug", headers: bearer("clerk:user_me") })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/wallet/debug", headers: bearer("clerk:user_admin") })).statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/wallet/debug", headers: { "x-admin-api-key": "key-123" } })).statusCode, 200);
    // Untouched: public wallet routes (and Apple's /wallet/v1 web service) stay open.
    assert.equal((await app.inject({ method: "GET", url: "/wallet/status" })).statusCode, 200);
  });

  test("inject: in production the diagnostics stay closed even without an API key", async () => {
    const app = await appWith(adminAuth({ NODE_ENV: "production", CLERK_SECRET_KEY: "sk_test_x", ADMIN_EMAILS: "boss@x.com" }));
    assert.equal((await app.inject({ method: "GET", url: "/wallet/debug" })).statusCode, 401);
  });
});

describe("kiosk order lists: GET /orders/by-member and unfiltered GET /orders", () => {
  test("kiosk keys use the existing generator prefix", () => {
    assert.equal(KIOSK_KEY_PREFIX, "kiosk_");
  });

  test("requireKioskOrAdmin: active device key, admin session or admin key; everything else 401", async () => {
    const kiosk = kioskAuth();
    const app = Fastify();
    app.get("/orders/by-member", async (req, reply) => {
      const staff = await kiosk.requireKioskOrAdmin(req, reply);
      if (!staff) return reply;
      return { kind: staff.kind, locationId: kiosk.scopedLocationId(staff, req.query.locationId) };
    });
    await app.ready();
    const call = (headers = {}, qs = "memberId=db_me&locationId=loc_other") => app.inject({ method: "GET", url: `/orders/by-member?${qs}`, headers });

    assert.equal((await call()).statusCode, 401);
    assert.equal((await call(bearer("clerk:user_me"))).statusCode, 401);
    assert.equal((await call(bearer("kiosk_off"))).statusCode, 401);
    assert.equal((await call(bearer("kiosk_forged"))).statusCode, 401);
    assert.equal((await call(bearer("g1.x.y"))).statusCode, 401);

    const device = await call(bearer("kiosk_good"));
    assert.equal(device.statusCode, 200);
    // A kiosk only sees its own location, whatever it asks for.
    assert.deepEqual(device.json(), { kind: "kiosk", locationId: "loc_cc" });

    const admin = await call(bearer("clerk:user_admin"));
    assert.deepEqual(admin.json(), { kind: "admin", locationId: "loc_other" });
    const service = await call({ "x-admin-api-key": "key-123" }, "memberId=db_me");
    assert.deepEqual(service.json(), { kind: "admin", locationId: null });
  });

  test("an unknown kiosk-looking key is refused even where dev admin auth is open (no ADMIN_API_KEY)", async () => {
    const devAdmin = adminAuth({ CLERK_SECRET_KEY: "sk_test_x" });
    const kiosk = kioskAuth(devAdmin);
    const app = Fastify();
    app.get("/orders", async (req, reply) => {
      const staff = await kiosk.requireKioskOrAdmin(req, reply);
      if (!staff) return reply;
      return { kind: staff.kind };
    });
    await app.ready();
    assert.equal((await app.inject({ method: "GET", url: "/orders", headers: bearer("kiosk_forged") })).statusCode, 401);
    // Dev convenience of requireAdminAuth is unchanged for everything else.
    assert.equal((await app.inject({ method: "GET", url: "/orders" })).statusCode, 200);
  });

  test("inject: anonymous unfiltered GET /orders is 401; ?userId= stays self-only", async () => {
    const auth = customerAuth();
    const kiosk = kioskAuth();
    const app = Fastify();
    // Mirrors index.js GET /orders.
    app.get("/orders", async (req, reply) => {
      const { userId, locationId } = req.query;
      if (userId) {
        if (!(await auth.requireSelf(req, reply, userId))) return reply;
        return { scope: "self", userId };
      }
      const staff = await kiosk.requireKioskOrAdmin(req, reply);
      if (!staff) return reply;
      return { scope: staff.kind, locationId: kiosk.scopedLocationId(staff, locationId) };
    });
    await app.ready();
    assert.equal((await app.inject({ method: "GET", url: "/orders" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/orders?status=PAID", headers: bearer("clerk:user_me") })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/orders?userId=db_other", headers: bearer("clerk:user_me") })).statusCode, 403);
    assert.deepEqual((await app.inject({ method: "GET", url: "/orders?userId=db_me", headers: bearer("clerk:user_me") })).json(), { scope: "self", userId: "db_me" });
    assert.deepEqual((await app.inject({ method: "GET", url: "/orders", headers: bearer("kiosk_good") })).json(), { scope: "kiosk", locationId: "loc_cc" });
  });
});
