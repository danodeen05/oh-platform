/**
 * Kiosk device auth for staff-only order lists (Task A10b).
 *
 * Reuses the existing KioskDevice credential: an admin registers a device
 * (POST /kiosk-devices, now admin only) and gets `kiosk_<64 hex>`; the kiosk
 * web app stores it in localStorage ("oh_kiosk_api_key") and sends it as
 * `Authorization: Bearer <key>`, the same header /kiosk/auth and
 * /kiosk/heartbeat already verify. An inactive or unknown device is refused.
 *
 * requireKioskOrAdmin lets through an active device or an admin
 * (requireAdminAuth: admin Clerk session or x-admin-api-key). A kiosk only
 * ever sees its own location: see scopedLocationId.
 */

export const KIOSK_KEY_PREFIX = "kiosk_";

function bearerOf(req) {
  const h = req?.headers?.authorization;
  if (typeof h !== "string" || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

export function createKioskAuth({ findDeviceByKey, requireAdminAuth }) {
  /** The active KioskDevice behind the request's Bearer key, or null. */
  async function deviceFor(req) {
    const token = bearerOf(req);
    if (!token || !token.startsWith(KIOSK_KEY_PREFIX)) return null;
    const device = await findDeviceByKey(token);
    return device && device.isActive ? device : null;
  }

  /** { kind: "kiosk", device } | { kind: "admin" }, or null after sending 401. */
  async function requireKioskOrAdmin(req, reply) {
    const token = bearerOf(req);
    if (token && token.startsWith(KIOSK_KEY_PREFIX)) {
      const device = await deviceFor(req);
      if (device) return { kind: "kiosk", device };
      // Never fall through to admin auth (which is open in keyless dev) with a bad device key.
      reply.code(401).send({ error: "Kiosk device not authorized" });
      return null;
    }
    await requireAdminAuth(req, reply);
    if (reply.sent) return null;
    return { kind: "admin" };
  }

  /** The location a caller may list: a kiosk is pinned to its own; admins choose. */
  function scopedLocationId(staff, requested) {
    if (staff?.kind === "kiosk") return staff.device.locationId;
    return typeof requested === "string" && requested ? requested : null;
  }

  return { deviceFor, requireKioskOrAdmin, scopedLocationId };
}
