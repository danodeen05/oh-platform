/**
 * Test SMS with toll-free number
 */

import twilio from "twilio";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env from project root
const envPath = resolve(import.meta.dirname, "../../.env");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

console.log("Testing Twilio SMS with TOLL-FREE number...");
console.log("From: +18663594863");
console.log("To: +18017393205");

try {
  const message = await client.messages.create({
    body: "Oh! SMS test from TOLL-FREE number (866). Your Twilio integration is working! 🍜",
    from: "+18663594863",
    to: "+18017393205",
  });

  console.log("\n✓ SMS sent successfully!");
  console.log("Message SID:", message.sid);
  console.log("Status:", message.status);
} catch (error) {
  console.error("\n✗ SMS failed:", error.message);
  if (error.code) {
    console.error("Error code:", error.code);
  }
  process.exit(1);
}
