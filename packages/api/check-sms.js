/**
 * Check SMS status and account info
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

// Check the specific message
const messageSid = "SMaf848db52aac0b21c7b1e0672e2befd6";

console.log("=== Checking Message Status ===");
try {
  const message = await client.messages(messageSid).fetch();
  console.log("Status:", message.status);
  console.log("Error Code:", message.errorCode || "none");
  console.log("Error Message:", message.errorMessage || "none");
  console.log("To:", message.to);
  console.log("From:", message.from);
  console.log("Date Sent:", message.dateSent);
} catch (e) {
  console.error("Failed to fetch message:", e.message);
}

console.log("\n=== Checking Phone Number Capabilities ===");
try {
  const incomingNumbers = await client.incomingPhoneNumbers.list();
  for (const num of incomingNumbers) {
    console.log("Number:", num.phoneNumber);
    console.log("  SMS Capable:", num.capabilities.sms);
    console.log("  Voice Capable:", num.capabilities.voice);
    console.log("  Friendly Name:", num.friendlyName);
  }
} catch (e) {
  console.error("Failed to list numbers:", e.message);
}

console.log("\n=== Recent Messages ===");
try {
  const messages = await client.messages.list({ limit: 5 });
  for (const msg of messages) {
    console.log(`${msg.sid}: ${msg.status} (${msg.errorCode || 'ok'}) - to: ${msg.to}`);
  }
} catch (e) {
  console.error("Failed to list messages:", e.message);
}
