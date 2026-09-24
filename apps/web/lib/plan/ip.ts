/**
 * Viewer IP hashing. The raw IP is used only to derive a salted SHA-256 and is
 * never stored or forwarded (spec 4.2, 7.7). Runs in Node route handlers only.
 */

import { createHash } from "node:crypto";

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string): string {
  const salt = process.env.PLAN_IP_HASH_SALT;
  if (!salt) throw new Error("PLAN_IP_HASH_SALT is not set");
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
