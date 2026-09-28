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

/** RFC 2047 encoded-word for a header value that is not plain ASCII. */
function headerText(value) {
  const s = String(value ?? "").replace(/[\r\n]+/g, " ");
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

/** Base64 wrapped at 76 columns, as MIME wants it. */
function b64Lines(data) {
  const b64 = Buffer.isBuffer(data) ? data.toString("base64") : String(data);
  return b64.replace(/.{1,76}/g, "$&\r\n");
}

const mailbox = (address, name) => (name ? `"${String(name).replace(/["\\\r\n]/g, "")}" <${address}>` : `<${address}>`);

/**
 * A MIME message with a real text/plain alternative:
 *   multipart/related [ multipart/alternative [ text/plain, text/html ], inline images... ]
 * Graph's sendMail takes it base64-encoded with Content-Type: text/plain.
 * Only used when a message has `text` and no file attachments.
 */
export function buildMime(message, from) {
  const to = (Array.isArray(message.to) ? message.to : [message.to]).filter(Boolean);
  const rnd = () => Math.random().toString(36).slice(2, 12);
  const rel = `rel_${rnd()}`;
  const alt = `alt_${rnd()}`;
  const lines = [
    `From: ${mailbox(from, message.fromName)}`,
    `To: ${to.map((a) => mailbox(a)).join(", ")}`,
    ...(message.replyTo ? [`Reply-To: ${mailbox(message.replyTo)}`] : []),
    `Subject: ${headerText(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${rel}"; type="multipart/alternative"`,
    "",
    `--${rel}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64Lines(Buffer.from(message.text, "utf8")),
    `--${alt}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64Lines(Buffer.from(message.html, "utf8")),
    `--${alt}--`,
    "",
  ];
  for (const img of message.inlineImages || []) {
    lines.push(
      `--${rel}`,
      `Content-Type: ${img.contentType}; name="${img.name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${img.contentId}>`,
      `Content-Disposition: inline; filename="${img.name}"`,
      "",
      b64Lines(img.contentBytes),
    );
  }
  lines.push(`--${rel}--`, "");
  return lines.join("\r\n");
}

/**
 * @param {{
 *   from?: string,
 *   fromName?: string,
 *   to: string | string[],
 *   subject: string,
 *   html: string,
 *   text?: string,
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
    const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;
    // With a text part (and no files), send MIME so mail clients get a real
    // text/plain alternative. If Graph refuses the MIME, fall back to the
    // HTML-only JSON send below rather than not sending at all.
    if (message.text && !(message.attachments || []).length) {
      const mime = buildMime({ ...message, to }, from);
      const res = await fetchImpl(sendUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
        body: Buffer.from(mime, "utf8").toString("base64"),
      });
      if (res.ok) return { success: true };
      if (res.status === 401) {
        cachedToken = null;
        const text = await res.text().catch(() => "");
        return { success: false, error: `sendMail 401: ${text.slice(0, 300)}` };
      }
      console.warn(`[email] MIME sendMail returned ${res.status}; retrying as HTML only`);
    }
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
    const res = await fetchImpl(sendUrl, {
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
