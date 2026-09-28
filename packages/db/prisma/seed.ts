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

  // iconKey matches SEALS (apps/web/components/site/seal/seals.ts, Task C2);
  // i18n gives real zh-TW/zh-CN/es copy (see packages/db/prisma/seed-data/
  // badges.ts for the production catalog and its localization notes -- this
  // dev fixture uses its own slightly different English text, so it keeps
  // its own i18n rather than importing that module).
  await prisma.badge.createMany({
    data: [
      // Milestone badges
      {
        slug: "first-order",
        name: "First Bowl",
        description: "Completed your first order",
        iconEmoji: null,
        iconKey: "first-order",
        category: "MILESTONE",
        i18n: {
          en: { name: "First Bowl", description: "Completed your first order" },
          "zh-TW": { name: "第一碗", description: "完成了你的第一筆訂單" },
          "zh-CN": { name: "第一碗", description: "完成了你的第一笔订单" },
          es: { name: "Primer Tazón", description: "Completaste tu primer pedido" },
        },
      },
      {
        slug: "10-orders",
        name: "Noodle Enthusiast",
        description: "Completed 10 orders",
        iconEmoji: null,
        iconKey: "10-orders",
        category: "MILESTONE",
        i18n: {
          en: { name: "Noodle Enthusiast", description: "Completed 10 orders" },
          "zh-TW": { name: "麵食愛好者", description: "完成了 10 次點餐" },
          "zh-CN": { name: "面食爱好者", description: "完成了 10 次点餐" },
          es: { name: "Entusiasta de los Fideos", description: "Completaste 10 pedidos" },
        },
      },
      {
        slug: "50-orders",
        name: "Beef Devotee",
        description: "Completed 50 orders",
        iconEmoji: null,
        iconKey: "50-orders",
        category: "MILESTONE",
        i18n: {
          en: { name: "Beef Devotee", description: "Completed 50 orders" },
          "zh-TW": { name: "牛肉粉絲", description: "完成了 50 次點餐" },
          "zh-CN": { name: "牛肉粉丝", description: "完成了 50 次点餐" },
          es: { name: "Devoto de la Res", description: "Completaste 50 pedidos" },
        },
      },
      {
        slug: "100-orders",
        name: "Century Club",
        description: "Completed 100 orders",
        iconEmoji: null,
        iconKey: "100-orders",
        category: "MILESTONE",
        i18n: {
          en: { name: "Century Club", description: "Completed 100 orders" },
          "zh-TW": { name: "百碗俱樂部", description: "完成了 100 次點餐" },
          "zh-CN": { name: "百碗俱乐部", description: "完成了 100 次点餐" },
          es: { name: "Club del Centenar", description: "Completaste 100 pedidos" },
        },
      },

      // Referral badges
      {
        slug: "first-referral",
        name: "Share the Love",
        description: "Referred your first friend",
        iconEmoji: null,
        iconKey: "first-referral",
        category: "REFERRAL",
        i18n: {
          en: { name: "Share the Love", description: "Referred your first friend" },
          "zh-TW": { name: "分享好味道", description: "邀請了第一位朋友" },
          "zh-CN": { name: "分享好味道", description: "邀请了第一位朋友" },
          es: { name: "Comparte el Cariño", description: "Invitaste a tu primer amigo" },
        },
      },
      {
        slug: "10-referrals",
        name: "Influencer",
        description: "Referred 10 friends",
        iconEmoji: null,
        iconKey: "10-referrals",
        category: "REFERRAL",
        i18n: {
          en: { name: "Influencer", description: "Referred 10 friends" },
          "zh-TW": { name: "人氣推手", description: "邀請了 10 位朋友" },
          "zh-CN": { name: "带货达人", description: "邀请了 10 位朋友" },
          es: { name: "Influencer", description: "Invitaste a 10 amigos" },
        },
      },
      {
        slug: "50-referrals",
        name: "Ambassador",
        description: "Referred 50 friends",
        iconEmoji: null,
        iconKey: "50-referrals",
        category: "REFERRAL",
        i18n: {
          en: { name: "Ambassador", description: "Referred 50 friends" },
          "zh-TW": { name: "品牌大使", description: "邀請了 50 位朋友" },
          "zh-CN": { name: "品牌大使", description: "邀请了 50 位朋友" },
          es: { name: "Embajador", description: "Invitaste a 50 amigos" },
        },
      },

      // Streak badges
      {
        slug: "3-day-streak",
        name: "Hot Streak",
        description: "Ordered 3 days in a row",
        iconEmoji: null,
        iconKey: "3-day-streak",
        category: "STREAK",
        i18n: {
          en: { name: "Hot Streak", description: "Ordered 3 days in a row" },
          "zh-TW": { name: "手氣正旺", description: "連續 3 天點餐" },
          "zh-CN": { name: "手气火热", description: "连续 3 天点餐" },
          es: { name: "Racha Ganadora", description: "Pediste 3 días seguidos" },
        },
      },
      {
        slug: "7-day-streak",
        name: "Weekly Warrior",
        description: "Ordered 7 days in a row",
        iconEmoji: null,
        iconKey: "7-day-streak",
        category: "STREAK",
        i18n: {
          en: { name: "Weekly Warrior", description: "Ordered 7 days in a row" },
          "zh-TW": { name: "一週戰士", description: "連續 7 天點餐" },
          "zh-CN": { name: "一周战士", description: "连续 7 天点餐" },
          es: { name: "Guerrero Semanal", description: "Pediste 7 días seguidos" },
        },
      },
      {
        slug: "30-day-streak",
        name: "Legend",
        description: "Ordered 30 days in a row",
        iconEmoji: null,
        iconKey: "30-day-streak",
        category: "STREAK",
        i18n: {
          en: { name: "Legend", description: "Ordered 30 days in a row" },
          "zh-TW": { name: "傳奇人物", description: "連續 30 天點餐" },
          "zh-CN": { name: "传奇人物", description: "连续 30 天点餐" },
          es: { name: "Leyenda", description: "Pediste 30 días seguidos" },
        },
      },

      // Challenge badges
      {
        slug: "tried-all-items",
        name: "Menu Master",
        description: "Tried every item on the menu",
        iconEmoji: null,
        iconKey: "tried-all-items",
        category: "CHALLENGE",
        i18n: {
          en: { name: "Menu Master", description: "Tried every item on the menu" },
          "zh-TW": { name: "菜單達人", description: "吃遍了菜單上的每一樣" },
          "zh-CN": { name: "菜单大师", description: "吃遍了菜单上的每一样" },
          es: { name: "Maestro del Menú", description: "Probaste todo el menú" },
        },
      },
      {
        slug: "spicy-challenge",
        name: "Heat Seeker",
        description: "Ordered spicy 10 times",
        iconEmoji: null,
        iconKey: "spicy-challenge",
        category: "CHALLENGE",
        i18n: {
          en: { name: "Heat Seeker", description: "Ordered spicy 10 times" },
          "zh-TW": { name: "無辣不歡", description: "點了 10 次辣味餐點" },
          "zh-CN": { name: "嗜辣达人", description: "点了 10 次辣味餐点" },
          es: { name: "Buscador de Picante", description: "Pediste picante 10 veces" },
        },
      },

      // Special badges
      {
        slug: "grand-opening",
        name: "OG Member",
        description: "Member since grand opening",
        iconEmoji: null,
        iconKey: "grand-opening",
        category: "SPECIAL",
        i18n: {
          en: { name: "OG Member", description: "Member since grand opening" },
          "zh-TW": { name: "元老會員", description: "開幕當時就加入的會員" },
          "zh-CN": { name: "创始会员", description: "开业当时就加入的会员" },
          es: { name: "Miembro Fundador", description: "Miembro desde la gran apertura" },
        },
      },
      {
        slug: "vip",
        name: "VIP",
        description: "Reached Beef Boss tier",
        iconEmoji: null,
        iconKey: "vip",
        category: "SPECIAL",
        i18n: {
          en: { name: "VIP", description: "Reached Beef Boss tier" },
          "zh-TW": { name: "貴賓", description: "達到牛霸主等級" },
          "zh-CN": { name: "尊享会员", description: "达到牛霸主等级" },
          es: { name: "VIP", description: "Alcanzaste el nivel Beef Boss" },
        },
      },
    ],
  });

  console.log("Created 14 badges");

  console.log("Creating challenges...");

  // Challenge.iconEmoji is still schema-required (frozen migration from
  // Task A2); this writes "" instead of an emoji. iconKey/i18n follow the
  // same conventions as the badges above.
  await prisma.challenge.createMany({
    data: [
      {
        slug: "try-all-bases",
        name: "Noodle Explorer",
        description: "Order all 4 base noodle dishes",
        rewardCents: 500,
        iconEmoji: "",
        iconKey: "try-all-bases",
        i18n: {
          en: { name: "Noodle Explorer", description: "Order all 4 base noodle dishes" },
          "zh-TW": { name: "麵條探險家", description: "點過所有 4 種基底麵食" },
          "zh-CN": { name: "面条探险家", description: "点过所有 4 种基底面食" },
          es: { name: "Explorador de Fideos", description: "Ordena los 4 platillos base de fideos" },
        },
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
        slug: "bring-5-friends",
        name: "Party Host",
        description: "Refer 5 friends this month",
        rewardCents: 1000,
        iconEmoji: "",
        iconKey: "bring-5-friends",
        i18n: {
          en: { name: "Party Host", description: "Refer 5 friends this month" },
          "zh-TW": { name: "揪團高手", description: "這個月邀請 5 位朋友" },
          "zh-CN": { name: "拼单达人", description: "本月邀请 5 位朋友" },
          es: { name: "Anfitrión de la Fiesta", description: "Invita a 5 amigos este mes" },
        },
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
        iconEmoji: "",
        iconKey: "early-bird",
        i18n: {
          en: { name: "Early Bird", description: "Order before 11am five times" },
          "zh-TW": { name: "早起的鳥兒", description: "上午 11 點前完成點餐 5 次" },
          "zh-CN": { name: "早起的鸟儿", description: "上午 11 点前完成点餐 5 次" },
          es: { name: "Madrugador", description: "Ordena antes de las 11 a.m. cinco veces" },
        },
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
