/**
 * Quick SMS test script
 * Run with: node test-sms.js
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

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;
const toPhone = process.env.ADMIN_PHONE_NUMBER;

console.log("Testing Twilio SMS...");
console.log("Account SID:", accountSid?.slice(0, 10) + "...");
console.log("From:", fromPhone);
console.log("To:", toPhone);

if (!accountSid || !authToken || !fromPhone || !toPhone) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const client = twilio(accountSid, authToken);

try {
  const message = await client.messages.create({
    body: "Oh! SMS test successful. Your Twilio integration is working! 🍜",
    from: fromPhone,
    to: toPhone,
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
