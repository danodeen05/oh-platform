import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerTeamRoutes } from "../team-routes.js";

function clerkStub() {
  const calls = [];
  const users = [
    { id: "u1", firstName: "Dan", lastName: "O", primaryEmailAddressId: "e1", emailAddresses: [{ id: "e1", emailAddress: "owner@x.com" }], publicMetadata: {} },
    { id: "u2", firstName: "Mia", lastName: "", primaryEmailAddressId: "e2", emailAddresses: [{ id: "e2", emailAddress: "mia@x.com" }], publicMetadata: { adminRole: "manager" } },
    { id: "u3", firstName: "Guest", lastName: "", primaryEmailAddressId: "e3", emailAddresses: [{ id: "e3", emailAddress: "g@x.com" }], publicMetadata: {} },
  ];
  return {
    calls,
    users: {
      getUserList: async (args) => { calls.push(["getUserList", args]); const e = args?.emailAddress?.[0]; return { data: e ? users.filter((u) => u.emailAddresses[0].emailAddress === e) : users }; },
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

async function build() {
  const clerk = clerkStub();
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
