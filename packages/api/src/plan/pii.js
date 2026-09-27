/**
 * Field-level encryption for plan NDA personal data (AES-256-GCM).
 *
 *   PLAN_PII_KEY  32 random bytes, base64 (openssl rand -base64 32). API only.
 *
 * Text is sealed as "v1:<base64 iv|tag|ciphertext>"; bytes (the PDF) as a raw
 * Buffer of the same layout. open() throws on tampering or a wrong key.
 */

import crypto from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** The key from env, or null when it is missing or not 32 bytes. */
export function piiKeyFromEnv(env = process.env) {
  const raw = env.PLAN_PII_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

/** @param {Buffer} key 32 bytes */
export function createPii(key) {
  const sealBytes = (buf) => {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(buf), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]);
  };
  const openBytes = (blob) => {
    const b = Buffer.from(blob);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, b.subarray(0, IV_BYTES));
    decipher.setAuthTag(b.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(b.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
  };
  return {
    seal(text) {
      if (text === null || text === undefined) return null;
      return `${VERSION}:${sealBytes(Buffer.from(String(text), "utf8")).toString("base64")}`;
    },
    open(value) {
      if (value === null || value === undefined) return null;
      const i = value.indexOf(":");
      if (value.slice(0, i) !== VERSION) throw new Error("unknown pii format");
      return openBytes(Buffer.from(value.slice(i + 1), "base64")).toString("utf8");
    },
    sealBytes,
    openBytes,
    hmac: (text) => crypto.createHmac("sha256", key).update(String(text)).digest("hex"),
  };
}
