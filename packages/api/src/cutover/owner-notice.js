/**
 * Task G3: the one text the owner gets when release 2 is live and verified.
 * Sent LAST in the runbook, once, by the controller:
 *   railway run --service "@oh/api" node scripts/notify-owner-release.mjs --send
 * Without --send it is a dry run (prints the masked destination and text).
 * It honors SUPPORT_NOTIFY like every other notification path (R3): off
 * sends nothing, log only logs, live (the default when unset) sends.
 */
import { notifyMode } from "../notifications.js";

export const OWNER_RELEASE_TEXT = "Oh! site release is live in prod and ready for your review.";

function last4(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-4) || "----";
}

/**
 * @param {{ env?: object, send: (msg: {to: string, body: string}) => Promise<any>, dryRun: boolean }} args
 * @returns {Promise<{ action: "dry-run" | "off" | "logged" | "sent" | "failed", to: string, detail?: string }>}
 */
export async function sendOwnerReleaseNotice({ env = process.env, send, dryRun }) {
  const to = env.ADMIN_PHONE_NUMBER;
  if (!to) throw new Error("ADMIN_PHONE_NUMBER is not set.");
  const masked = `...${last4(to)}`;
  if (dryRun) return { action: "dry-run", to: masked };
  const mode = notifyMode(env);
  if (mode === "off") return { action: "off", to: masked };
  if (mode === "log") {
    console.log(`[owner-notice] SUPPORT_NOTIFY=log: would text ${masked}: ${OWNER_RELEASE_TEXT}`);
    return { action: "logged", to: masked };
  }
  const res = await send({ to, body: OWNER_RELEASE_TEXT });
  return res?.success ? { action: "sent", to: masked, detail: res.sid } : { action: "failed", to: masked, detail: res?.reason || res?.error || "unknown" };
}
