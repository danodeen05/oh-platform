import { adminPathRoles, registerConsoleGuard } from "./console-guard.js";

/**
 * All admin auth wiring in one place: /admin/* needs a role allowed by
 * adminPathRoles, and console-only routes elsewhere get their listed roles.
 * Call before any route is declared.
 */
export function registerAdminAuthHooks(app, { requireAdminAuth, requireRole }) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin")) return;
    await requireAdminAuth(req, reply);
    if (reply.sent) return reply;
    await requireRole(...adminPathRoles(req.url))(req, reply);
    if (reply.sent) return reply;
  });
  registerConsoleGuard(app, { requireAdminAuth, requireRole });
}
