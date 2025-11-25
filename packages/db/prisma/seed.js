import { PrismaClient } from "@prisma/client";

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

  // Menu items for Oh
  const ohMenuItems = await prisma.menuItem.createMany({
    data: [
      { tenantId: ohTenant.id, name: "Classic Beef Noodles", priceCents: 1499 },
      { tenantId: ohTenant.id, name: "Spicy Beef Noodles", priceCents: 1599 },
      { tenantId: ohTenant.id, name: "Dry Noodles", priceCents: 1399 },
      { tenantId: ohTenant.id, name: "A5 Wagyu Upgrade", priceCents: 1200 },
      { tenantId: ohTenant.id, name: "Braised Tendon", priceCents: 399 },
      { tenantId: ohTenant.id, name: "Marinated Egg", priceCents: 199 },
      { tenantId: ohTenant.id, name: "Extra Noodles", priceCents: 299 },
      { tenantId: ohTenant.id, name: "Pickled Vegetables", priceCents: 149 },
    ],
  });

  console.log("Created 8 menu items for Oh");

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
  await prisma.menuItem.createMany({
    data: [
      { tenantId: ramenTenant.id, name: "Tonkotsu Ramen", priceCents: 1799 },
      { tenantId: ramenTenant.id, name: "Miso Ramen", priceCents: 1699 },
      { tenantId: ramenTenant.id, name: "Spicy Miso", priceCents: 1799 },
      { tenantId: ramenTenant.id, name: "Extra Chashu", priceCents: 499 },
      { tenantId: ramenTenant.id, name: "Ajitama Egg", priceCents: 249 },
    ],
  });

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

  await prisma.badge.createMany({
    data: [
      // Milestone badges
      {
        slug: "first-order",
        name: "First Bowl",
        description: "Completed your first order",
        iconEmoji: "🍜",
        category: "MILESTONE",
      },
      {
        slug: "10-orders",
        name: "Noodle Enthusiast",
        description: "Completed 10 orders",
        iconEmoji: "🥢",
        category: "MILESTONE",
      },
      {
        slug: "50-orders",
        name: "Beef Devotee",
        description: "Completed 50 orders",
        iconEmoji: "🐂",
        category: "MILESTONE",
      },
      {
        slug: "100-orders",
        name: "Century Club",
        description: "Completed 100 orders",
        iconEmoji: "💯",
        category: "MILESTONE",
      },

      // Referral badges
      {
        slug: "first-referral",
        name: "Share the Love",
        description: "Referred your first friend",
        iconEmoji: "🤝",
        category: "REFERRAL",
      },
      {
        slug: "10-referrals",
        name: "Influencer",
        description: "Referred 10 friends",
        iconEmoji: "⭐",
        category: "REFERRAL",
      },
      {
        slug: "50-referrals",
        name: "Ambassador",
        description: "Referred 50 friends",
        iconEmoji: "👑",
        category: "REFERRAL",
      },

      // Streak badges
      {
        slug: "3-day-streak",
        name: "Hot Streak",
        description: "Ordered 3 days in a row",
        iconEmoji: "🔥",
        category: "STREAK",
      },
      {
        slug: "7-day-streak",
        name: "Weekly Warrior",
        description: "Ordered 7 days in a row",
        iconEmoji: "⚡",
        category: "STREAK",
      },
      {
        slug: "30-day-streak",
        name: "Legend",
        description: "Ordered 30 days in a row",
        iconEmoji: "🏆",
        category: "STREAK",
      },

      // Challenge badges
      {
        slug: "tried-all-items",
        name: "Menu Master",
        description: "Tried every item on the menu",
        iconEmoji: "📋",
        category: "CHALLENGE",
      },
      {
        slug: "spicy-challenge",
        name: "Heat Seeker",
        description: "Ordered spicy 10 times",
        iconEmoji: "🌶️",
        category: "CHALLENGE",
      },

      // Special badges
      {
        slug: "grand-opening",
        name: "OG Member",
        description: "Member since grand opening",
        iconEmoji: "🎉",
        category: "SPECIAL",
      },
      {
        slug: "vip",
        name: "VIP",
        description: "Reached Beef Boss tier",
        iconEmoji: "💎",
        category: "SPECIAL",
      },
    ],
  });

  console.log("Created 14 badges");

  console.log("Creating challenges...");

  await prisma.challenge.createMany({
    data: [
      {
        slug: "try-all-bases",
        name: "Noodle Explorer",
        description: "Order all 4 base noodle dishes",
        rewardCents: 500,
        iconEmoji: "🗺️",
        requirements: JSON.stringify({
          type: "order_all_items",
          itemSlugs: [
            "classic-beef",
            "spicy-beef",
            "dry-noodles",
            "wagyu-upgrade",
          ],
        }),
        isActive: true,
      },
      {
        slug: "weekend-warrior",
        name: "Weekend Warrior",
        description: "Order on Saturday and Sunday",
        rewardCents: 300,
        iconEmoji: "📅",
        requirements: JSON.stringify({
          type: "order_days",
          days: ["saturday", "sunday"],
        }),
        isActive: true,
      },
      {
        slug: "bring-5-friends",
        name: "Party Host",
        description: "Refer 5 friends this month",
        rewardCents: 1000,
        iconEmoji: "🎊",
        requirements: JSON.stringify({
          type: "referrals",
          count: 5,
          timeframe: "month",
        }),
        isActive: true,
      },
      {
        slug: "early-bird",
        name: "Early Bird",
        description: "Order before 11am five times",
        rewardCents: 400,
        iconEmoji: "🌅",
        requirements: JSON.stringify({
          type: "order_time",
          before: "11:00",
          count: 5,
        }),
        isActive: true,
      },
    ],
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
