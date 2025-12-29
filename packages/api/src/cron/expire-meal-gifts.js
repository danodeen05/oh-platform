#\!/usr/bin/env node

/**
 * Cron job to expire and refund unclaimed meal gifts
 * Run this daily at end of business day (e.g., 10pm)
 * 
 * Add to crontab:
 * 0 22 * * * /path/to/oh-platform/packages/api/src/cron/expire-meal-gifts.js
 */

const API_URL = process.env.API_URL || "http://localhost:4000";

async function expireMealGifts() {
  try {
    console.log(`[${new Date().toISOString()}] Running meal gift expiration job...`);
    
    const response = await fetch(`${API_URL}/meal-gifts/expire`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": "oh",
      },
      body: JSON.stringify({}),
    });

    if (\!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`✅ Expired ${result.expired} meal gift(s)`);
    
    if (result.gifts && result.gifts.length > 0) {
      console.log("Refunded gifts:");
      result.gifts.forEach((gift) => {
        console.log(`  - Gift ${gift.id}: $${(gift.amountCents / 100).toFixed(2)} refunded to user ${gift.giverId}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Failed to expire meal gifts:`, error.message);
    process.exit(1);
  }
}

expireMealGifts();
