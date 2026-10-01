// packages/api/scripts/notify-owner-private-events.mjs
// Usage: node --env-file=../../.env scripts/notify-owner-private-events.mjs [--send] [--to +1...]
// Dry-run prints the text. --send texts ADMIN_PHONE_NUMBER (or --to) with the image as MMS.
import { sendSMS } from "../src/notifications.js";
const args = process.argv.slice(2);
const send = args.includes("--send");
const toIdx = args.indexOf("--to");
const to = toIdx >= 0 ? args[toIdx + 1] : process.env.ADMIN_PHONE_NUMBER;
const web = process.env.WEB_BASE_URL || "https://www.ohbeef.com";
const admin = process.env.ADMIN_APP_URL || "https://admin-oh-beef-noodle-soup.vercel.app";
const body = [
  "Dano. Chappy. The private events build is live in production.",
  `Your table: ${web}/en/e/oh-business-planning`,
  `Your admin: ${admin}/catering (Guests, Messages, Cook tabs are yours; add the other five and hit Send.)`,
  "",
  "Now the real news. Thirty-five years ago a fastball picked a fight with your dick and today a surgeon went back in for round TEN to scrape out the scar tissue. Ten. Most people don't get ten of anything. You've got a frequent flyer card for your own urethra. Hell of a streak. Don't mess this up. I believe in you. Sort of.",
  "",
  "Kristy: he will milk this for a week. Hold the line. Bowls are on me Sunday.",
  "",
  "Heal up, you magnificent bastard. The noodles can wait.",
].join("\n");
const mediaUrl = `${web}/chappy/tenth-time.png`;
console.log(body, "\n\nmedia:", mediaUrl, "\nto:", to ? `…${String(to).slice(-4)}` : "(none)", "\nlength:", body.length);
if (!send) { console.log("\n(dry run; pass --send)"); process.exit(0); }
if (!to) { console.error("no recipient"); process.exit(1); }
const r = await sendSMS({ to, body, mediaUrl });
console.log(r);
process.exit(r.success ? 0 : 1);
