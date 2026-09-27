/**
 * App email through Microsoft Graph (Entra app "Oh! Mailer", client
 * credentials, Mail.Send application permission).
 *
 *   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET  app credentials
 *   MS_SENDER_EMAIL                               default From mailbox
 *
 * Like sendSMS in notifications.js, sendGraphMail never throws: it returns
 * { success: true } or { success: false, reason | error }.
 */

const TOKEN_SKEW_MS = 60 * 1000;
let cachedToken = null; // { value, expiresAt }

export function isGraphMailConfigured(env = process.env) {
  return Boolean(env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET);
}

/** Reset the token cache (tests). */
export function resetGraphTokenCache() {
  cachedToken = null;
}

async function getToken({ env, fetchImpl, now }) {
  if (cachedToken && cachedToken.expiresAt - TOKEN_SKEW_MS > now()) return cachedToken.value;
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`token ${res.status}: ${json.error || "no access_token"}`);
  }
  cachedToken = { value: json.access_token, expiresAt: now() + (Number(json.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

/**
 * @param {{
 *   from?: string,
 *   to: string | string[],
 *   subject: string,
 *   html: string,
 *   replyTo?: string,
 *   inlineImages?: { contentId: string, name: string, contentType: string, contentBytes: string }[],
 *   attachments?: { name: string, contentType: string, contentBytes: string }[],
 * }} message  contentBytes is base64. Graph's single sendMail call takes about 3 MB of attachments.
 * @param {{ env?: Record<string, string|undefined>, fetchImpl?: typeof fetch, now?: () => number }} [deps]
 */
export async function sendGraphMail(message, deps = {}) {
  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;
  const now = deps.now || Date.now;
  if (!isGraphMailConfigured(env)) {
    console.log("[email] Graph mail not configured, skipping");
    return { success: false, reason: "not_configured" };
  }
  const from = message.from || env.MS_SENDER_EMAIL;
  const to = (Array.isArray(message.to) ? message.to : [message.to]).filter(Boolean);
  if (!from || to.length === 0) return { success: false, reason: "missing_address" };

  try {
    const token = await getToken({ env, fetchImpl, now });
    const payload = {
      message: {
        subject: message.subject,
        body: { contentType: "HTML", content: message.html },
        toRecipients: to.map((address) => ({ emailAddress: { address } })),
        ...(message.replyTo ? { replyTo: [{ emailAddress: { address: message.replyTo } }] } : {}),
        attachments: [
          ...(message.inlineImages || []).map((img) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: img.name,
            contentType: img.contentType,
            contentBytes: img.contentBytes,
            contentId: img.contentId,
            isInline: true,
          })),
          ...(message.attachments || []).map((file) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: file.name,
            contentType: file.contentType,
            contentBytes: file.contentBytes,
            isInline: false,
          })),
        ],
      },
      saveToSentItems: true,
    };
    const res = await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) cachedToken = null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `sendMail ${res.status}: ${text.slice(0, 300)}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
