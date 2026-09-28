/**
 * Secret hygiene for Chappy's conversation history (Task E2 fix round 1).
 *
 * A tool result may carry things meant for the customer's screen only: a
 * card payload (the pay card's Stripe client secret) or, in rows written by
 * the retired agent, a raw `clientSecret` / `client_secret` (main's
 * create_apple_pay_order). None of it may reach the model or be saved again.
 *
 *  - scrubSecrets(value): a deep copy with every `clientSecret` /
 *    `client_secret` key removed, every `card` payload reduced to `{type}`,
 *    and any Stripe client-secret-shaped string ("pi_..._secret_...")
 *    replaced with "[redacted]".
 *  - scrubToolResultContent(content): the same for a tool_result block's
 *    content (a JSON string, plain text, or text blocks). Content with
 *    nothing to scrub comes back unchanged (byte-identical, so the cached
 *    history prefix stays stable).
 *  - hasSecrets(value): whether anything above is present (for counts).
 *
 * Pure, no imports: packages/db/scripts/scrub-chappy-secrets.ts uses it too.
 */
const SECRET_KEYS = new Set(["clientSecret", "client_secret"]);
const SECRET_STRING = /\b(?:pi|seti|pm|src)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+\b/g;
const SECRET_STRING_TEST = /\b(?:pi|seti|pm|src)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+\b/;
export const REDACTED = "[redacted]";

export function scrubSecrets(value) {
  if (typeof value === "string") return SECRET_STRING_TEST.test(value) ? value.replace(SECRET_STRING, REDACTED) : value;
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.has(k)) continue;
      out[k] = k === "card" && v && typeof v === "object" && !Array.isArray(v) ? { type: typeof v.type === "string" ? v.type : "unknown" } : scrubSecrets(v);
    }
    return out;
  }
  return value;
}

/** A card payload beyond its type, a secret key, or a secret-shaped string anywhere in `value`. */
export function hasSecrets(value) {
  if (typeof value === "string") return SECRET_STRING_TEST.test(value);
  if (Array.isArray(value)) return value.some(hasSecrets);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.has(k)) return true;
      if (k === "card" && v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).some((ck) => ck !== "type")) return true;
      if (hasSecrets(v)) return true;
    }
  }
  return false;
}

function scrubJsonOrText(text) {
  if (typeof text !== "string") return text;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return scrubSecrets(text);
    return hasSecrets(parsed) ? JSON.stringify(scrubSecrets(parsed)) : text;
  } catch {
    return scrubSecrets(text);
  }
}

export function scrubToolResultContent(content) {
  if (typeof content === "string") return scrubJsonOrText(content);
  if (Array.isArray(content)) return content.map((b) => (b && b.type === "text" && typeof b.text === "string" ? { ...b, text: scrubJsonOrText(b.text) } : b));
  return content;
}

/** One stored message block, scrubbed: tool results by the rules above, text and tool input for secret-shaped strings. */
export function scrubBlock(block) {
  if (!block || typeof block !== "object") return block;
  if (block.type === "tool_result") {
    const content = scrubToolResultContent(block.content);
    return content === block.content ? block : { ...block, content };
  }
  if (block.type === "text" && typeof block.text === "string" && SECRET_STRING_TEST.test(block.text)) return { ...block, text: scrubSecrets(block.text) };
  if (block.type === "tool_use" && hasSecrets(block.input)) return { ...block, input: scrubSecrets(block.input) };
  return block;
}

/** A whole stored messages array (the DB scrub script): returns { messages, changed }. */
export function scrubMessages(messages) {
  if (!Array.isArray(messages)) return { messages, changed: false };
  let changed = false;
  const out = messages.map((m) => {
    if (!m || typeof m !== "object") return m;
    if (typeof m.content === "string") {
      const c = SECRET_STRING_TEST.test(m.content) ? scrubSecrets(m.content) : m.content;
      if (c !== m.content) changed = true;
      return c === m.content ? m : { ...m, content: c };
    }
    if (!Array.isArray(m.content)) return m;
    const blocks = m.content.map(scrubBlock);
    if (blocks.some((b, i) => b !== m.content[i])) {
      changed = true;
      return { ...m, content: blocks };
    }
    return m;
  });
  return { messages: out, changed };
}
