/**
 * Twilio webhook signature check for POST /chappy/sms (controller ruling, Task B1).
 *
 * Without it anyone could POST From=<a member's phone> and act as that member
 * through Chappy. Twilio signs each webhook with the ACCOUNT auth token
 * (TWILIO_AUTH_TOKEN; the API-key credentials used for sending cannot verify
 * webhooks): HMAC-SHA1 over the full public URL plus the sorted POST params,
 * base64, in X-Twilio-Signature. twilio.validateRequest implements that.
 *
 *  - The URL is the one Twilio called: API_PUBLIC_URL + path when set (Railway
 *    sits behind a proxy), else x-forwarded-proto / x-forwarded-host / host.
 *  - No token, no signature or a wrong one: not ok (the route answers 403
 *    before any agent or database work), in development too.
 *  - CHAPPY_SMS_SKIP_SIGNATURE=1 skips the check for local testing only; it
 *    is ignored when NODE_ENV=production.
 */
import twilio from "twilio";

const first = (v) => String(Array.isArray(v) ? v[0] : v || "").split(",")[0].trim();

export function publicRequestUrl(req, env = process.env) {
  const base = typeof env.API_PUBLIC_URL === "string" ? env.API_PUBLIC_URL.trim() : "";
  if (base) return `${base.replace(/\/+$/, "")}${req.url}`;
  const proto = first(req.headers["x-forwarded-proto"]) || req.protocol || "https";
  const host = first(req.headers["x-forwarded-host"]) || first(req.headers.host);
  return `${proto}://${host}${req.url}`;
}

/** Returns { ok, reason?, skipped? }. Never throws. */
export function checkTwilioSignature(req, env = process.env) {
  if (env.NODE_ENV !== "production" && env.CHAPPY_SMS_SKIP_SIGNATURE === "1") return { ok: true, skipped: true };
  const token = env.TWILIO_AUTH_TOKEN;
  if (typeof token !== "string" || !token) return { ok: false, reason: "TWILIO_AUTH_TOKEN is not set" };
  const signature = req.headers["x-twilio-signature"];
  if (typeof signature !== "string" || !signature) return { ok: false, reason: "missing X-Twilio-Signature" };
  try {
    const params = req.body && typeof req.body === "object" ? { ...req.body } : {};
    return twilio.validateRequest(token, signature, publicRequestUrl(req, env), params) ? { ok: true } : { ok: false, reason: "invalid signature" };
  } catch (err) {
    return { ok: false, reason: `signature check failed: ${err?.message}` };
  }
}
