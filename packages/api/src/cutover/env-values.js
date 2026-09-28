/**
 * Task G3 fix round 1: every production env write validates its value first
 * and refuses (non-zero exit, nothing written) when it is empty or has the
 * wrong shape. Values are never printed: `describeValue` shows the length and
 * a known prefix only.
 */

const RULES = {
  STRIPE_WEBHOOK_SECRET: { re: /^whsec_[A-Za-z0-9]{16,}$/, hint: "whsec_ followed by the secret" },
  STRIPE_SECRET_KEY: { re: /^(sk|rk)_live_[A-Za-z0-9]{16,}$/, hint: "a LIVE key (sk_live_ or rk_live_)" },
  ADMIN_API_KEY: { re: /^[A-Za-z0-9_-]{32,}$/, hint: "32+ URL-safe characters (openssl rand -hex 32)" },
  CRON_SECRET: { re: /^[A-Za-z0-9_-]{32,}$/, hint: "32+ URL-safe characters" },
  TWILIO_AUTH_TOKEN: { re: /^[0-9a-f]{32}$/, hint: "the 32-hex-character Twilio ACCOUNT auth token" },
  API_PUBLIC_URL: { re: /^https:\/\/[a-z0-9.-]+$/, hint: "https://host with no path and no trailing slash (https://api.ohbeef.com)" },
  SUPPORT_NOTIFY: { re: /^(live|log|off)$/, hint: "live, log or off" },
  NODE_ENV: { re: /^production$/, hint: "exactly production" },
  CHAPPY_MODEL: { re: /^claude-[a-z0-9.-]+$/, hint: "a claude-* model id" },
  CHAPPY_GUEST_SECRET: { re: /^\S{32,}$/, hint: "32+ characters" },
  ADMIN_PHONE_NUMBER: { re: /^\+[1-9][0-9]{7,14}$/, hint: "E.164 (+1...)" },
  RATE_LIMIT_MAX: { re: /^[1-9][0-9]{0,6}$/, hint: "a positive integer (requests per window per IP)" },
  RATE_LIMIT_WINDOW: { re: /^([1-9][0-9]*|[1-9][0-9]*\s*(ms|s|seconds?|m|minutes?|h|hours?))$/, hint: "milliseconds or a duration like 1 minute" },
};

/** Throws with a clear reason when the value is not acceptable for this key. */
export function validateEnvValue(key, value) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(String(key || ""))) throw new Error(`bad variable name: ${key}`);
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is empty`);
  if (value !== value.trim() || /[\r\n]/.test(value)) throw new Error(`${key} has surrounding whitespace or a newline`);
  if (key === "CHAPPY_LIMITS_JSON") {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("CHAPPY_LIMITS_JSON is not valid JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CHAPPY_LIMITS_JSON must be a JSON object");
    return true;
  }
  const rule = RULES[key];
  if (rule && !rule.re.test(value)) throw new Error(`${key} has the wrong format: expected ${rule.hint}`);
  return true;
}

/** "whsec_... (38 chars)" style description; never the value. */
export function describeValue(value) {
  const prefix = /^(whsec_|sk_live_|rk_live_|sk_test_|https:\/\/)/.exec(value || "")?.[1] ?? "";
  return `${prefix ? `${prefix}...` : "[hidden]"} (${String(value || "").length} chars)`;
}

/**
 * Upserts one encrypted production variable on a Vercel project, after
 * validation. Returns { written, dryRun }. Throws (nothing written) on a bad
 * value or a Vercel error.
 */
export async function upsertVercelEnv({ key, value, projectId, teamId, token, dryRun, fetchImpl = fetch }) {
  validateEnvValue(key, value);
  if (!projectId || !teamId) throw new Error("projectId and teamId are required");
  if (!token) throw new Error("VERCEL_TOKEN is empty");
  if (dryRun) return { written: false, dryRun: true };
  const res = await fetchImpl(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?teamId=${encodeURIComponent(teamId)}&upsert=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, type: "encrypted", target: ["production"] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${body?.error?.message || "error"}`);
  return { written: true, dryRun: false };
}
