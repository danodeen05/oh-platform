import { PrismaClient } from "@prisma/client";
import { BADGES } from "./seed-data/badges";
import { CHALLENGES } from "./seed-data/challenges";
import {
  DEV_BADGE_DESCRIPTION,
  DEV_BADGE_I18N_OVERRIDE,
  DEV_CHALLENGE_DESCRIPTION,
  DEV_CHALLENGE_I18N_OVERRIDE,
  DEV_CHALLENGE_REQUIREMENTS,
} from "./seed-data/dev-overrides";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.userChallenge.deleteMany();
  await prisma.creditEvent.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.user.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.locationStats.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.location.deleteMany();
  await prisma.tenantUser.deleteMany();
  await prisma.tenant.deleteMany();

  // ==========================================
  // TENANT 1: Oh Beef Noodle Soup
  // ==========================================

  const ohTenant = await prisma.tenant.create({
    data: {
      slug: "oh",
      brandName: "Oh! Beef Noodle Soup",
      logoUrl: "/logos/oh-logo.png",
      primaryColor: "#667eea",
      subscriptionStatus: "ACTIVE",
      subscriptionTier: "premium",
    },
  });

  console.log("Created tenant: Oh! Beef Noodle Soup");

  // Locations for Oh
  const lehiLocation = await prisma.location.create({
    data: {
      tenantId: ohTenant.id,
      name: "Lehi Flagship",
      city: "Lehi",
      address: "123 Tech Drive, Lehi, UT 84043",
      lat: 40.3916,
      lng: -111.8508,
    },
  });

  const provoLocation = await prisma.location.create({
    data: {
      tenantId: ohTenant.id,
      name: "Provo Station",
      city: "Provo",
      address: "456 Center Street, Provo, UT 84601",
      lat: 40.2338,
      lng: -111.6585,
    },
  });

  console.log("Created 2 locations for Oh");

  // Menu items for Oh - UPDATED WITH NEW SCHEMA
  const menuItems = [
    // Main dishes
    {
      name: "Classic Beef Noodles",
      basePriceCents: 1499,
      additionalPriceCents: 0,
      includedQuantity: 0,
      category: "main",
      description: "Traditional beef noodle soup"
    },
    {
      name: "Spicy Beef Noodles",
      basePriceCents: 1599,
      additionalPriceCents: 0,
      includedQuantity: 0,
      category: "main",
      description: "Spicy beef noodle soup"
    },
    {
      name: "Dry Noodles",
      basePriceCents: 1399,
      additionalPriceCents: 0,
      includedQuantity: 0,
      category: "main",
      description: "Dry-style noodles with beef"
    },

    // Upgrades
    {
      name: "American Wagyu Upgrade",
      basePriceCents: 1200,
      additionalPriceCents: 1200,
      includedQuantity: 0,
      category: "upgrade",
      description: "Premium American Wagyu beef"
    },
    {
      name: "Braised Tendon",
      basePriceCents: 399,
      additionalPriceCents: 399,
      includedQuantity: 0,
      category: "add-on",
      description: "Braised beef tendon"
    },
    {
      name: "Marinated Egg",
      basePriceCents: 199,
      additionalPriceCents: 199,
      includedQuantity: 0,
      category: "add-on",
      description: "Soft-boiled marinated egg"
    },
    {
      name: "Extra Noodles",
      basePriceCents: 299,
      additionalPriceCents: 299,
      includedQuantity: 0,
      category: "add-on",
      description: "Additional noodles"
    },
    {
      name: "Pickled Vegetables",
      basePriceCents: 149,
      additionalPriceCents: 149,
      includedQuantity: 0,
      category: "add-on",
      description: "House-pickled vegetables"
    },

    // THE SPECIAL ONE - Baby Bok Choy
    {
      name: "Baby Bok Choy",
      basePriceCents: 0,
      additionalPriceCents: 200,
      includedQuantity: 1,
      category: "vegetable",
      description: "Fresh baby bok choy (1 included, $2 for extras)"
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        tenantId: ohTenant.id,
      },
    });
  }

  console.log("Created 9 menu items for Oh (including baby bok choy!)");

  // Seats for Lehi
  const lehiSeats = [];
  for (let i = 1; i <= 12; i++) {
    const seat = await prisma.seat.create({
      data: {
        locationId: lehiLocation.id,
        number: `A${i}`,
        qrCode: `LEHI-A${i}-${Date.now()}`,
        status: "AVAILABLE",
      },
    });
    lehiSeats.push(seat);
  }

  // Seats for Provo
  const provoSeats = [];
  for (let i = 1; i <= 12; i++) {
    const seat = await prisma.seat.create({
      data: {
        locationId: provoLocation.id,
        number: `A${i}`,
        qrCode: `PROVO-A${i}-${Date.now()}`,
        status: "AVAILABLE",
      },
    });
    provoSeats.push(seat);
  }

  console.log("Created 24 seats (12 per location)");

  // Location stats
  await prisma.locationStats.create({
    data: {
      locationId: lehiLocation.id,
      totalSeats: 12,
      availableSeats: 12,
      occupiedSeats: 0,
      avgWaitMinutes: 0,
    },
  });

  await prisma.locationStats.create({
    data: {
      locationId: provoLocation.id,
      totalSeats: 12,
      availableSeats: 12,
      occupiedSeats: 0,
      avgWaitMinutes: 0,
    },
  });

  console.log("Created location stats");

  // ==========================================
  // TENANT 2: Ramen Lab
  // ==========================================

  const ramenTenant = await prisma.tenant.create({
    data: {
      slug: "ramen-lab",
      brandName: "Ramen Lab",
      logoUrl: "/logos/ramen-lab-logo.png",
      primaryColor: "#f59e0b",
      subscriptionStatus: "ACTIVE",
      subscriptionTier: "starter",
    },
  });

  console.log("Created tenant: Ramen Lab");

  const sohoLocation = await prisma.location.create({
    data: {
      tenantId: ramenTenant.id,
      name: "SoHo",
      city: "New York",
      address: "789 Broadway, New York, NY 10003",
      lat: 40.7223,
      lng: -73.996,
    },
  });

  console.log("Created 1 location for Ramen Lab");

  // Menu items for Ramen Lab
  const ramenMenuItems = [
    {
      name: "Tonkotsu Ramen",
      basePriceCents: 1799,
      additionalPriceCents: 0,
      includedQuantity: 0,
      category: "main"
    },
    {
      name: "Miso Ramen",
      basePriceCents: 1699,
      additionalPriceCents: 0,
      includedQuantity: 0,
      category: "main"
    },
    {
      name: "Spicy Miso",
      basePriceCents: 1799,
      additionalPriceCents: 0,
      includedQuantity: 0,
      category: "main"
    },
    {
      name: "Extra Chashu",
      basePriceCents: 499,
      additionalPriceCents: 499,
      includedQuantity: 0,
      category: "add-on"
    },
    {
      name: "Ajitama Egg",
      basePriceCents: 249,
      additionalPriceCents: 249,
      includedQuantity: 0,
      category: "add-on"
    },
  ];

  for (const item of ramenMenuItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        tenantId: ramenTenant.id,
      },
    });
  }

  console.log("Created 5 menu items for Ramen Lab");

  // Seats for SoHo
  for (let i = 1; i <= 12; i++) {
    await prisma.seat.create({
      data: {
        locationId: sohoLocation.id,
        number: `A${i}`,
        qrCode: `SOHO-A${i}-${Date.now()}`,
        status: "AVAILABLE",
      },
    });
  }

  console.log("Created 12 seats for SoHo");

  await prisma.locationStats.create({
    data: {
      locationId: sohoLocation.id,
      totalSeats: 12,
      availableSeats: 12,
      occupiedSeats: 0,
      avgWaitMinutes: 0,
    },
  });

  // ==========================================
  // BADGES & CHALLENGES
  // ==========================================

  console.log("Creating badges...");

  // Fix round 1 (review, Minor 1): badges now import their catalog from
  // seed-data/badges.ts instead of keeping a second, hand-written copy --
  // that duplication was exactly how the "vip" badge's dev-only zh-TW/zh-CN
  // text drifted to the wrong tier name (Important 4) without being
  // caught. Only the English `description` differs for a few dev fixtures
  // (this dev seed's story text doesn't match seed-prod.ts's), so those are
  // overridden via DEV_BADGE_DESCRIPTION; "vip" and "spicy-challenge" change
  // meaning, not just English wording, so they get their own full i18n
  // override instead (see seed-data/dev-overrides.ts).
  await prisma.badge.createMany({
    data: BADGES.map((b) => {
      const description = DEV_BADGE_DESCRIPTION[b.slug] ?? b.i18n.en.description;
      const i18n = DEV_BADGE_I18N_OVERRIDE[b.slug] ?? { ...b.i18n, en: { ...b.i18n.en, description } };
      return {
        slug: b.slug,
        name: i18n.en.name,
        description: i18n.en.description,
        iconEmoji: null,
        iconKey: b.iconKey,
        category: b.category,
        i18n: i18n as any,
      };
    }),
  });

  console.log("Created 14 badges");

  console.log("Creating challenges...");

  // Fix round 1 (review, Minor 1): same single-source approach as the
  // badges above. `requirements` stays dev-specific (this fixture's
  // referenced item slugs don't exist in seed-prod.ts's catalog), so it
  // comes from seed-data/dev-overrides.ts rather than seed-prod.ts's
  // module. Challenge.iconEmoji is still schema-required (frozen migration
  // from Task A2); this writes "" instead of an emoji.
  await prisma.challenge.createMany({
    data: CHALLENGES.map((c) => {
      const description = DEV_CHALLENGE_DESCRIPTION[c.slug] ?? c.i18n.en.description;
      const i18n = DEV_CHALLENGE_I18N_OVERRIDE[c.slug] ?? { ...c.i18n, en: { ...c.i18n.en, description } };
      return {
        slug: c.slug,
        name: i18n.en.name,
        description: i18n.en.description,
        rewardCents: c.rewardCents,
        iconEmoji: "",
        iconKey: c.iconKey,
        i18n: i18n as any,
        requirements: DEV_CHALLENGE_REQUIREMENTS[c.slug] as any,
        isActive: true,
      };
    }),
  });

  console.log("Created 4 challenges");

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
