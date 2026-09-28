/**
 * Task G3 fix round 1: make sure the live Stripe webhook for the web app
 * exists, and hand its signing secret straight to the env writer (never to
 * the terminal). Stripe only reveals a secret when an endpoint is created,
 * so an existing endpoint whose secret nobody has is replaced with
 * `recreate: true` (the old endpoint is deleted after the new one exists).
 */

export const WEBHOOK_URL = "https://www.ohbeef.com/api/webhooks/stripe";
export const WEBHOOK_EVENTS = ["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"];

async function stripeCall(fetchImpl, key, method, path, form) {
  const res = await fetchImpl(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    ...(form ? { body: form.toString() } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${method} ${path} ${res.status}: ${body?.error?.message || "error"}`);
  return body;
}

/**
 * `saveSecret(secret)` stores the new signing secret (the Vercel env write).
 * It runs after the new endpoint exists and BEFORE any old endpoint is
 * deleted; if it throws, the new endpoint is deleted again and the old one is
 * left as it was, so a failure never leaves the site with no usable secret.
 * @returns {Promise<{ action: "exists" | "created" | "recreated" | "would-create" | "would-recreate", endpointId?: string }>}
 */
export async function ensureStripeWebhook({ stripeKey, dryRun, recreate = false, url = WEBHOOK_URL, saveSecret, fetchImpl = fetch }) {
  if (!dryRun && typeof saveSecret !== "function") throw new Error("saveSecret is required");
  if (!/^(sk|rk)_live_/.test(stripeKey || "")) throw new Error("STRIPE_SECRET_KEY must be a live key (sk_live_ or rk_live_)");
  const list = await stripeCall(fetchImpl, stripeKey, "GET", "/webhook_endpoints?limit=100");
  const existing = (list.data || []).filter((e) => e.url === url);
  if (existing.length && !recreate) return { action: "exists", endpointId: existing[0].id };
  if (dryRun) return { action: existing.length ? "would-recreate" : "would-create" };
  const form = new URLSearchParams({ url, description: "Oh! web app (release 2)" });
  for (const ev of WEBHOOK_EVENTS) form.append("enabled_events[]", ev);
  const created = await stripeCall(fetchImpl, stripeKey, "POST", "/webhook_endpoints", form);
  try {
    if (!/^whsec_/.test(created.secret || "")) throw new Error("Stripe created the endpoint but returned no whsec_ secret");
    await saveSecret(created.secret);
  } catch (err) {
    await stripeCall(fetchImpl, stripeKey, "DELETE", `/webhook_endpoints/${encodeURIComponent(created.id)}`);
    throw err;
  }
  for (const old of existing) await stripeCall(fetchImpl, stripeKey, "DELETE", `/webhook_endpoints/${encodeURIComponent(old.id)}`);
  return { action: existing.length ? "recreated" : "created", endpointId: created.id };
}
