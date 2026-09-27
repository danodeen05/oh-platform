import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerTeamRoutes } from "../team-routes.js";

function clerkStub({ extraCustomers = 0 } = {}) {
  const calls = [];
  // Filler customers (no adminRole) simulate the rest of the Clerk user pool,
  // which includes ordinary customers, not just staff. Placed between u1 and
  // u2 so a paging bug leaves u2 (and u3) off the listing.
  const filler = Array.from({ length: extraCustomers }, (_, i) => ({
    id: `cust${i}`, firstName: "Cust", lastName: String(i), primaryEmailAddressId: "e",
    emailAddresses: [{ id: "e", emailAddress: `cust${i}@x.com` }], publicMetadata: {},
  }));
  const users = [
    { id: "u1", firstName: "Dan", lastName: "O", primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "owner@x.com" }], publicMetadata: {} },
    ...filler,
    { id: "u2", firstName: "Mia", lastName: "", primaryEmailAddressId: "e2", emailAddresses: [{ id: "e2", emailAddress: "mia@x.com" }], publicMetadata: { adminRole: "manager" } },
    { id: "u3", firstName: "Guest", lastName: "", primaryEmailAddressId: "e3", emailAddresses: [{ id: "e3", emailAddress: "g@x.com" }], publicMetadata: {} },
  ];
  return {
    calls,
    users: {
      getUserList: async (args) => {
        calls.push(["getUserList", args]);
        const e = args?.emailAddress?.[0];
        if (e) return { data: users.filter((u) => u.emailAddresses[0].emailAddress === e) };
        const limit = args?.limit ?? users.length;
        const offset = args?.offset ?? 0;
        return { data: users.slice(offset, offset + limit) };
      },
      updateUserMetadata: async (id, body) => { calls.push(["updateUserMetadata", id, body]); return {}; },
      getUser: async (id) => users.find((u) => u.id === id),
    },
    invitations: {
      getInvitationList: async () => ({ data: [{ id: "i1", emailAddress: "new@x.com", publicMetadata: { adminRole: "station" }, createdAt: 1 }] }),
      createInvitation: async (body) => { calls.push(["createInvitation", body]); return { id: "i2" }; },
      revokeInvitation: async (id) => { calls.push(["revokeInvitation", id]); return {}; },
    },
  };
}

async function build({ clerk } = {}) {
  clerk = clerk || clerkStub();
  const forgotten = [];
  const app = Fastify({ logger: false });
  await registerTeamRoutes(app, { clerk, adminEmails: ["owner@x.com"], forgetRole: (id) => forgotten.push(id), adminUrl: "https://admin.test" });
  await app.ready();
  return { app, clerk, forgotten };
}

test("lists only admin members plus pending invites; allowlisted owner is locked", async () => {
  const { app } = await build();
  const body = (await app.inject({ url: "/admin/team" })).json();
  assert.deepEqual(body.members.map((m) => [m.email, m.role, m.locked]), [["owner@x.com", "owner", true], ["mia@x.com", "manager", false]]);
  assert.deepEqual(body.invites.map((i) => [i.email, i.role]), [["new@x.com", "station"]]);
});

test("invite: existing user is updated, new email gets an invitation", async () => {
  const { app, clerk } = await build();
  const a = await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "g@x.com", role: "station" } });
  assert.equal(a.json().kind, "updated");
  const b = await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "NEW2@x.com", role: "manager" } });
  assert.equal(b.json().kind, "invited");
  const inv = clerk.calls.find((c) => c[0] === "createInvitation")[1];
  assert.deepEqual(inv, { emailAddress: "new2@x.com", publicMetadata: { adminRole: "manager" }, redirectUrl: "https://admin.test/sign-up", ignoreExisting: true });
});

test("invite rejects owner role and bad emails", async () => {
  const { app } = await build();
  assert.equal((await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "x@x.com", role: "owner" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/admin/team/invite", payload: { email: "nope", role: "manager" } })).statusCode, 400);
});

test("patch: locked owner is 409; others update and forget the cached role", async () => {
  const { app, forgotten } = await build();
  assert.equal((await app.inject({ method: "PATCH", url: "/admin/team/u1", payload: { role: "manager" } })).statusCode, 409);
  const res = await app.inject({ method: "PATCH", url: "/admin/team/u2", payload: { role: null } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(forgotten, ["u2"]);
});

test("team listing pages past Clerk's per-request limit so staff beyond page 1 aren't dropped", async () => {
  // 253 total users (> the old single-call limit of 200) with u2/u3 pushed past it,
  // so a non-paginating implementation would silently drop them from the listing.
  const clerk = clerkStub({ extraCustomers: 250 });
  const { app } = await build({ clerk });
  const body = (await app.inject({ url: "/admin/team" })).json();
  assert.deepEqual(body.members.map((m) => [m.userId, m.role]), [["u1", "owner"], ["u2", "manager"]]);
  const getUserListCalls = clerk.calls.filter((c) => c[0] === "getUserList" && !c[1]?.emailAddress);
  assert.ok(getUserListCalls.length >= 2, "expected more than one page to be fetched");
});
