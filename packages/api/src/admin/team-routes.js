import { roleFor } from "../auth/admin.js";

const INVITABLE = ["manager", "station"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const primaryEmail = (u) => (u.emailAddresses || []).find((e) => e.id === u.primaryEmailAddressId)?.emailAddress?.toLowerCase() ?? null;

const USER_PAGE_SIZE = 100;
const USER_PAGE_MAX = 50; // safety stop: 5,000 users, far beyond any realistic staff+customer pool

/**
 * The Clerk user pool includes every customer, not just staff, so it can
 * easily exceed a single getUserList page. Page through with offset until a
 * page comes back short (or the safety stop trips) so no admin/manager/
 * station user past the first page is silently dropped from the listing.
 */
async function fetchAllUsers(clerk) {
  const all = [];
  for (let page = 0; page < USER_PAGE_MAX; page += 1) {
    const offset = page * USER_PAGE_SIZE;
    const { data } = await clerk.users.getUserList({ limit: USER_PAGE_SIZE, offset });
    all.push(...data);
    if (data.length < USER_PAGE_SIZE) break;
  }
  return all;
}

export async function registerTeamRoutes(app, { clerk, adminEmails, forgetRole, adminUrl }) {
  app.get("/admin/team", async () => {
    const [users, { data: invites }] = await Promise.all([
      fetchAllUsers(clerk),
      clerk.invitations.getInvitationList({ status: "pending" }),
    ]);
    const members = users
      .map((u) => {
        const email = primaryEmail(u);
        const role = roleFor({ email, metadata: u.publicMetadata, adminEmails });
        return role && { userId: u.id, email, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null, role, locked: adminEmails.includes(email) };
      })
      .filter(Boolean);
    return {
      members,
      invites: invites
        .filter((i) => INVITABLE.includes(i.publicMetadata?.adminRole))
        .map((i) => ({ id: i.id, email: i.emailAddress, role: i.publicMetadata.adminRole, createdAt: new Date(i.createdAt).toISOString() })),
    };
  });

  app.post("/admin/team/invite", async (req, reply) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = req.body?.role;
    if (!EMAIL_RE.test(email) || !INVITABLE.includes(role)) return reply.code(400).send({ error: "Enter an email and choose manager or station." });
    if (adminEmails.includes(email)) return reply.code(409).send({ error: "That person is already an owner." });
    const { data: existing } = await clerk.users.getUserList({ emailAddress: [email] });
    if (existing.length > 0) {
      await clerk.users.updateUserMetadata(existing[0].id, { publicMetadata: { adminRole: role } });
      forgetRole(existing[0].id);
      return { kind: "updated" };
    }
    await clerk.invitations.createInvitation({ emailAddress: email, publicMetadata: { adminRole: role }, redirectUrl: `${adminUrl}/sign-up`, ignoreExisting: true });
    return { kind: "invited" };
  });

  app.patch("/admin/team/:userId", async (req, reply) => {
    const role = req.body?.role ?? null;
    if (role !== null && !INVITABLE.includes(role)) return reply.code(400).send({ error: "Role must be manager, station or none." });
    const user = await clerk.users.getUser(req.params.userId);
    if (adminEmails.includes(primaryEmail(user))) return reply.code(409).send({ error: "Owners on the allowlist can't be changed here." });
    await clerk.users.updateUserMetadata(req.params.userId, { publicMetadata: { adminRole: role } });
    forgetRole(req.params.userId);
    return { ok: true };
  });

  app.delete("/admin/team/invites/:id", async (req) => {
    await clerk.invitations.revokeInvitation(req.params.id);
    return { ok: true };
  });
}
