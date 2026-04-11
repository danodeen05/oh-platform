/**
 * Check SMS delivery status
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

// Check status of both messages
const domesticSid = "SMa9a7c3f7a5a83a6da75c588f3a81f055";
const tollFreeSid = "SM177aa4cb5a19aae6a1443cfd8bbfc06d";

console.log("=== DOMESTIC NUMBER (+19283642333) ===");
const msg1 = await client.messages(domesticSid).fetch();
console.log("Status:", msg1.status);
console.log("Error Code:", msg1.errorCode || "None");
console.log("Error Message:", msg1.errorMessage || "None");

console.log("\n=== TOLL-FREE NUMBER (+18663594863) ===");
const msg2 = await client.messages(tollFreeSid).fetch();
console.log("Status:", msg2.status);
console.log("Error Code:", msg2.errorCode || "None");
console.log("Error Message:", msg2.errorMessage || "None");
