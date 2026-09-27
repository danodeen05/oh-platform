import { roleFor } from "../auth/admin.js";

const INVITABLE = ["manager", "station"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const primaryEmail = (u) => (u.emailAddresses || []).find((e) => e.id === u.primaryEmailAddressId)?.emailAddress?.toLowerCase() ?? null;

export async function registerTeamRoutes(app, { clerk, adminEmails, forgetRole, adminUrl }) {
  app.get("/admin/team", async () => {
    const [{ data: users }, { data: invites }] = await Promise.all([
      clerk.users.getUserList({ limit: 200 }),
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
