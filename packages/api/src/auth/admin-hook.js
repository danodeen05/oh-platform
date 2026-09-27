import { adminPathRoles, registerConsoleGuard, requestPath } from "./console-guard.js";

/**
 * All admin auth wiring in one place: /admin/* needs a role allowed by
 * adminPathRoles, and console-only routes elsewhere get their listed roles.
 * Call before any route is declared.
 *
 * Decides on requestPath(req) (the routed path), never raw req.url: a raw
 * URL like /%61dmin/... or /admin/pl%61n/codes routes to /admin/... but
 * doesn't textually start with "/admin", which would leave it open or let
 * it dodge the owner-only prefix check.
 */
export function registerAdminAuthHooks(app, { requireAdminAuth, requireRole }) {
  app.addHook("onRequest", async (req, reply) => {
    const path = requestPath(req);
    if (!path.startsWith("/admin")) return;
    await requireAdminAuth(req, reply);
    if (reply.sent) return reply;
    await requireRole(...adminPathRoles(path))(req, reply);
    if (reply.sent) return reply;
  });
  registerConsoleGuard(app, { requireAdminAuth, requireRole });
}
