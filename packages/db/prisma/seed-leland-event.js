/**
 * Seed the Leland catering event (Friday June 5, 2026 — LUNCH).
 *
 * Creates:
 *   1. A dedicated Location row for the event
 *   2. A CateringEvent row in PLANNING status
 *
 * The event is in PLANNING so the owner can run AI enrichment (POST /admin/catering/events/:id/enrich)
 * and approve it (PATCH /admin/catering/events/:id/enrichment) before going LIVE.
 *
 * Mirror of seed-cny-party-location.js structure.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LELAND_LOCATION_ID = "cat-leland-jun5-2026";
const LELAND_SLUG = "leland-jun5";
const LELAND_EVENT_CODE = "CAT-LELAND-JUN5-2026";

async function main() {
  console.log("Creating Leland catering event (June 5 2026 LUNCH)...\n");

  // Find the Oh! tenant
  const tenant = await prisma.tenant.findFirst({ where: { slug: "oh" } });
  if (!tenant) {
    throw new Error("Oh! tenant not found. Run production seed first.");
  }
  console.log(`Found tenant: ${tenant.brandName} (${tenant.id})`);

  // Create or update the dedicated location row
  const location = await prisma.location.upsert({
    where: { id: LELAND_LOCATION_ID },
    update: {
      name: "Leland Event",
      city: "Salt Lake City",
      address: "Private Catering Event — Leland HQ",
      lat: 40.7608,
      lng: -111.891,
      taxRate: 0,
      timezone: "America/Denver",
      isClosed: false,
    },
    create: {
      id: LELAND_LOCATION_ID,
      tenantId: tenant.id,
      name: "Leland Event",
      city: "Salt Lake City",
      address: "Private Catering Event — Leland HQ",
      lat: 40.7608,
      lng: -111.891,
      taxRate: 0,
      timezone: "America/Denver",
      isClosed: false,
    },
  });
  console.log(`Location: ${location.id}`);

  // Create or update the catering event
  const event = await prisma.cateringEvent.upsert({
    where: { slug: LELAND_SLUG },
    update: {
      clientCompany: "Leland",
      clientWebsite: "https://www.joinleland.com",
      eventDate: new Date("2026-06-05T12:00:00.000Z"), // noon UTC ≈ 6am Denver; stored as UTC
      slot: "LUNCH",
      pricePerBowlCents: 2499,
      minimumBowls: 10,
      status: "PLANNING",
    },
    create: {
      tenantId: tenant.id,
      locationId: LELAND_LOCATION_ID,
      slug: LELAND_SLUG,
      eventCode: LELAND_EVENT_CODE,
      clientCompany: "Leland",
      clientWebsite: "https://www.joinleland.com",
      eventDate: new Date("2026-06-05T19:00:00.000Z"), // 12:00 PM Mountain Time (UTC-7 MDT)
      slot: "LUNCH",
      pricePerBowlCents: 2499,
      minimumBowls: 10,
      bookedBowls: 0,
      status: "PLANNING",
    },
  });

  console.log("\n✅ Leland catering event created/updated successfully!");
  console.log(`   Event ID:   ${event.id}`);
  console.log(`   Slug:       ${event.slug}`);
  console.log(`   Event Code: ${event.eventCode}`);
  console.log(`   Location:   ${LELAND_LOCATION_ID}`);
  console.log(`   Date/Slot:  2026-06-05 LUNCH`);
  console.log(`   Status:     ${event.status} (needs enrichment + owner approval)`);
  console.log(`\nNext steps:`);
  console.log(`  1. POST /admin/catering/events/${event.id}/enrich   — trigger AI enrichment`);
  console.log(`  2. GET  /admin/catering/events/${event.id}/enrichment — review AI suggestions`);
  console.log(`  3. PATCH /admin/catering/events/${event.id}/enrichment — approve and set LIVE`);
}

main()
  .catch((e) => {
    console.error("Error seeding Leland event:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
