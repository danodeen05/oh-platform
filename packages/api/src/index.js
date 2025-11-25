import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Register plugins
await app.register(cors, {
  origin: true,
});
await app.register(formbody);

const PORT = process.env.API_PORT || 4000;

// Helper to get tenant from request
function getTenantContext(req) {
  const subdomain = req.headers.host?.split(".")[0];
  const headerSlug = req.headers["x-tenant-slug"];
  return headerSlug || subdomain || "oh";
}

// ====================
// HEALTH CHECK
// ====================

app.get("/health", async (req, reply) => {
  return { ok: true };
});

// ====================
// TENANTS
// ====================

app.get("/tenants", async (req, reply) => {
  const tenants = await prisma.tenant.findMany();
  return tenants;
});

// ====================
// LOCATIONS
// ====================

app.get("/locations", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const locations = await prisma.location.findMany({
    where: { tenantId: tenant.id },
    include: { stats: true },
  });

  return locations;
});

app.post("/locations", async (req, reply) => {
  const { name, city, address, lat, lng, tenantId } = req.body || {};

  if (!name || !city || !tenantId) {
    return reply.code(400).send({ error: "name, city, and tenantId required" });
  }

  const location = await prisma.location.create({
    data: {
      name,
      city,
      address: address || "",
      lat: lat || 0,
      lng: lng || 0,
      tenantId,
    },
  });

  return location;
});

app.patch("/locations/:id", async (req, reply) => {
  const { id } = req.params;
  const { name, city, address, lat, lng } = req.body || {};

  const data = {};
  if (name) data.name = name;
  if (city) data.city = city;
  if (address) data.address = address;
  if (lat !== undefined) data.lat = lat;
  if (lng !== undefined) data.lng = lng;

  if (!Object.keys(data).length) {
    return reply.code(400).send({ error: "At least one field required" });
  }

  const location = await prisma.location.update({
    where: { id },
    data,
  });

  return location;
});

app.delete("/locations/:id", async (req, reply) => {
  const { id } = req.params;
  await prisma.location.delete({ where: { id } });
  return { success: true };
});

// ====================
// MENU ITEMS
// ====================

app.get("/menu", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id },
  });

  return items;
});

app.post("/menu", async (req, reply) => {
  const { name, priceCents, tenantId } = req.body || {};

  if (!name || !priceCents || !tenantId) {
    return reply
      .code(400)
      .send({ error: "name, priceCents, and tenantId required" });
  }

  const item = await prisma.menuItem.create({
    data: { name, priceCents, tenantId },
  });

  return item;
});

app.patch("/menu/:id", async (req, reply) => {
  const { id } = req.params;
  const { name, priceCents } = req.body || {};

  const data = {};
  if (name) data.name = name;
  if (priceCents !== undefined) data.priceCents = priceCents;

  if (!Object.keys(data).length) {
    return reply.code(400).send({ error: "At least one field required" });
  }

  const item = await prisma.menuItem.update({
    where: { id },
    data,
  });

  return item;
});

app.delete("/menu/:id", async (req, reply) => {
  const { id } = req.params;
  await prisma.menuItem.delete({ where: { id } });
  return { success: true };
});

// ====================
// SEATS
// ====================

app.get("/seats", async (req, reply) => {
  const seats = await prisma.seat.findMany({
    include: {
      location: {
        include: {
          tenant: true,
        },
      },
    },
  });
  return seats;
});

app.get("/seats/:qrCode", async (req, reply) => {
  const { qrCode } = req.params;
  const seat = await prisma.seat.findUnique({
    where: { qrCode },
    include: {
      location: {
        include: {
          tenant: true,
        },
      },
    },
  });

  if (!seat) return reply.code(404).send({ error: "Seat not found" });
  return seat;
});

// ====================
// ORDERS
// ====================

app.get("/orders", async (req, reply) => {
  const { status, locationId, userId } = req.query || {};

  const where = {};
  if (status) where.status = status;
  if (locationId) where.locationId = locationId;
  if (userId) where.userId = userId;

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      seat: true,
      location: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return orders;
});

app.get("/orders/:id", async (req, reply) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      seat: true,
      location: true,
    },
  });

  if (!order) return reply.code(404).send({ error: "Order not found" });
  return order;
});

app.post("/orders", async (req, reply) => {
  const { locationId, tenantId, items, seatId, estimatedArrival } =
    req.body || {};

  if (!locationId || !tenantId || !items || !items.length) {
    return reply
      .code(400)
      .send({ error: "locationId, tenantId, and items required" });
  }

  // Calculate total
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map((item) => item.menuItemId) },
    },
  });

  let totalCents = 0;
  const orderItems = items.map((item) => {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId);
    if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);

    const itemTotal = menuItem.priceCents * item.quantity;
    totalCents += itemTotal;

    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      priceCents: menuItem.priceCents,
    };
  });

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 6)
    .toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      tenantId,
      locationId,
      seatId,
      totalCents,
      estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
      items: {
        create: orderItems,
      },
    },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      seat: true,
      location: true,
    },
  });

  return order;
});

// PATCH /orders/:id - Update order status
app.patch("/orders/:id", async (req, reply) => {
  const { id } = req.params;
  const { status, paymentStatus, userId, totalCents } = req.body || {};

  const data = {};
  if (status) data.status = status;
  if (paymentStatus) {
    data.paymentStatus = paymentStatus;
    // When order is paid, automatically queue it for kitchen
    if (paymentStatus === "PAID" && !status) {
      data.status = "QUEUED";
    }
  }
  if (userId) data.userId = userId;
  if (totalCents !== undefined) data.totalCents = totalCents;

  if (!Object.keys(data).length) {
    return reply
      .code(400)
      .send({ error: "status, paymentStatus, userId, or totalCents required" });
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: {
      items: { include: { menuItem: true } },
      seat: true,
      location: true,
      user: true,
    },
  });

  // If order just got paid, update user progress
  if (paymentStatus === "PAID" && order.user) {
    const user = order.user;

    // Update lifetime stats
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lifetimeOrderCount: { increment: 1 },
        lifetimeSpentCents: { increment: order.totalCents },
        tierProgressOrders: { increment: 1 },
      },
    });

    // Check for tier upgrade
    await checkTierUpgrade(user.id);

    // Award badges
    await checkAndAwardBadges(user.id);

    // If user was referred, grant credits to referrer
    if (user.referredById) {
      const paidOrderCount = await prisma.order.count({
        where: {
          userId: user.id,
          paymentStatus: "PAID",
        },
      });

      if (paidOrderCount === 1) {
        // This is their first order - grant referrer credits
        const referrer = await prisma.user.findUnique({
          where: { id: user.referredById },
        });

        if (referrer) {
          // Get referrer's tier benefits
          const tierBenefits = getTierBenefits(referrer.membershipTier);
          const referralBonus = tierBenefits.referralBonus;

          await prisma.creditEvent.create({
            data: {
              userId: user.referredById,
              type: "REFERRAL_ORDER",
              amountCents: referralBonus,
              orderId: order.id,
              description: "Friend completed first order",
            },
          });

          await prisma.user.update({
            where: { id: user.referredById },
            data: {
              creditsCents: { increment: referralBonus },
              tierProgressReferrals: { increment: 1 },
            },
          });

          // Check if referrer should be upgraded
          await checkTierUpgrade(user.referredById);
        }
      }
    }
  }

  return order;
});

// ====================
// REFERRAL SYSTEM
// ====================

// Create or get user (simplified - no auth yet)
app.post("/users", async (req, reply) => {
  const { email, phone, name, referredByCode } = req.body || {};

  if (!email && !phone) {
    return reply.code(400).send({ error: "email or phone required" });
  }

  // Check if user exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [email ? { email } : {}, phone ? { phone } : {}].filter(
        (obj) => Object.keys(obj).length > 0
      ),
    },
  });

  if (existing) return existing;

  // Find referrer if code provided
  let referredById = null;
  if (referredByCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referredByCode },
    });
    if (referrer) {
      referredById = referrer.id;
    }
  }

  // Create new user with $5 welcome bonus if referred
  const user = await prisma.user.create({
    data: {
      email,
      phone,
      name,
      referredById,
      creditsCents: referredById ? 500 : 0, // $5 welcome bonus if referred
    },
  });

  // If referred, create a credit event for the new user
  if (referredById) {
    await prisma.creditEvent.create({
      data: {
        userId: user.id,
        type: "REFERRAL_SIGNUP",
        amountCents: 500,
        description: "Welcome bonus - referred by a friend!",
      },
    });
  }

  return user;
});

// Get user by referral code
app.get("/users/referral/:code", async (req, reply) => {
  const { code } = req.params;
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
  });
  if (!user) return reply.code(404).send({ error: "Invalid referral code" });
  return { name: user.name, email: user.email };
});

// Get user's credits and history
app.get("/users/:id/credits", async (req, reply) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      creditEvents: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!user) return reply.code(404).send({ error: "User not found" });

  return {
    balance: user.creditsCents,
    referralCode: user.referralCode,
    events: user.creditEvents,
  };
});

// Apply credits to an order
app.post("/orders/:id/apply-credits", async (req, reply) => {
  const { id } = req.params;
  const { userId, creditsCents } = req.body || {};

  if (!userId || !creditsCents) {
    return reply.code(400).send({ error: "userId and creditsCents required" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return reply.code(404).send({ error: "User not found" });

  const maxCredits = Math.min(user.creditsCents, creditsCents);
  if (maxCredits <= 0) {
    return reply.code(400).send({ error: "Insufficient credits" });
  }

  // Apply credits
  const order = await prisma.order.update({
    where: { id },
    data: {
      totalCents: { decrement: maxCredits },
      userId,
    },
  });

  // Deduct from user balance
  await prisma.user.update({
    where: { id: userId },
    data: { creditsCents: { decrement: maxCredits } },
  });

  // Record the event
  await prisma.creditEvent.create({
    data: {
      userId,
      orderId: id,
      type: "CREDIT_APPLIED",
      amountCents: -maxCredits,
      description: `Applied to order ${order.orderNumber}`,
    },
  });

  return { appliedCredits: maxCredits, newTotal: order.totalCents };
});

// ====================
// MEMBERSHIP & GAMIFICATION
// ====================

// Get user profile with tier info
app.get("/users/:id/profile", async (req, reply) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      badges: {
        include: {
          badge: true,
        },
        orderBy: {
          earnedAt: "desc",
        },
      },
      challenges: {
        include: {
          challenge: true,
        },
        where: {
          completedAt: null, // Only active challenges
        },
      },
      referrals: {
        select: {
          id: true,
          email: true,
          createdAt: true,
          lifetimeOrderCount: true,
        },
      },
    },
  });

  if (!user) return reply.code(404).send({ error: "User not found" });

  // Calculate tier benefits
  const tierBenefits = getTierBenefits(user.membershipTier);

  // Calculate progress to next tier
  const nextTier = getNextTier(user.membershipTier);
  const tierProgress = calculateTierProgress(user, nextTier);

  return {
    ...user,
    tierBenefits,
    nextTier,
    tierProgress,
  };
});

// Get all available badges
app.get("/badges", async (req, reply) => {
  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return badges;
});

// Get all active challenges
app.get("/challenges", async (req, reply) => {
  const challenges = await prisma.challenge.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return challenges;
});

// Get user's challenge progress
app.get("/users/:id/challenges", async (req, reply) => {
  const { id } = req.params;

  const userChallenges = await prisma.userChallenge.findMany({
    where: { userId: id },
    include: {
      challenge: true,
    },
  });

  return userChallenges;
});

// ====================
// KITCHEN DISPLAY SYSTEM
// ====================

// Get orders for kitchen display (filter by location and status)
app.get("/kitchen/orders", async (req, reply) => {
  const { locationId, status } = req.query || {};
  const tenantSlug = getTenantContext(req);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const where = {
    tenantId: tenant.id,
    paymentStatus: "PAID", // Only show paid orders
  };

  if (locationId) {
    where.locationId = locationId;
  }

  if (status) {
    if (status === "active") {
      // Active orders = QUEUED, PREPPING, or READY
      where.status = { in: ["QUEUED", "PREPPING", "READY"] };
    } else {
      where.status = status;
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      seat: true,
      location: true,
    },
    orderBy: {
      createdAt: "asc", // Oldest orders first
    },
  });

  return orders;
});

// Update order status with timestamps
app.patch("/kitchen/orders/:id/status", async (req, reply) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!status) {
    return reply.code(400).send({ error: "status required" });
  }

  const data = { status };

  // Set timestamps based on status
  if (status === "PREPPING") {
    data.prepStartTime = new Date();
  }
  if (status === "READY") {
    data.readyTime = new Date();
  }
  if (status === "COMPLETED") {
    data.completedTime = new Date();
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      seat: true,
      location: true,
    },
  });

  return order;
});

// Get kitchen stats (orders by status)
app.get("/kitchen/stats", async (req, reply) => {
  const { locationId } = req.query || {};
  const tenantSlug = getTenantContext(req);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const where = {
    tenantId: tenant.id,
    paymentStatus: "PAID",
  };

  if (locationId) {
    where.locationId = locationId;
  }

  const [queued, prepping, ready] = await Promise.all([
    prisma.order.count({ where: { ...where, status: "QUEUED" } }),
    prisma.order.count({ where: { ...where, status: "PREPPING" } }),
    prisma.order.count({ where: { ...where, status: "READY" } }),
  ]);

  return {
    queued,
    prepping,
    ready,
    total: queued + prepping + ready,
  };
});

// ====================
// HELPER FUNCTIONS
// ====================

function getTierBenefits(tier) {
  const benefits = {
    CHOPSTICK: {
      referralBonus: 500,
      cashbackPercent: 1,
      birthdayBonus: 1000,
      perks: ["Base referral rewards", "1% cashback"],
    },
    NOODLE_MASTER: {
      referralBonus: 700,
      cashbackPercent: 2,
      birthdayBonus: 2000,
      perks: [
        "Higher referral rewards",
        "2% cashback",
        "Early menu access",
        "Priority seating",
      ],
    },
    BEEF_BOSS: {
      referralBonus: 1000,
      cashbackPercent: 3,
      birthdayBonus: 5000,
      perks: [
        "Maximum referral rewards",
        "3% cashback",
        "Free delivery",
        "Exclusive items",
        "VIP events",
        "Noodle Concierge",
      ],
    },
  };
  return benefits[tier];
}

function getNextTier(currentTier) {
  const tiers = {
    CHOPSTICK: { next: "NOODLE_MASTER", ordersNeeded: 10, referralsNeeded: 5 },
    NOODLE_MASTER: { next: "BEEF_BOSS", ordersNeeded: 50, referralsNeeded: 20 },
    BEEF_BOSS: null, // Max tier
  };
  return tiers[currentTier];
}

function calculateTierProgress(user, nextTier) {
  if (!nextTier) return { atMaxTier: true };

  const orderProgress = Math.min(
    100,
    (user.tierProgressOrders / nextTier.ordersNeeded) * 100
  );
  const referralProgress = Math.min(
    100,
    (user.tierProgressReferrals / nextTier.referralsNeeded) * 100
  );

  return {
    orders: {
      current: user.tierProgressOrders,
      needed: nextTier.ordersNeeded,
      percent: Math.round(orderProgress),
    },
    referrals: {
      current: user.tierProgressReferrals,
      needed: nextTier.referralsNeeded,
      percent: Math.round(referralProgress),
    },
  };
}

// Helper function to check and upgrade tier
async function checkTierUpgrade(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return;

  let newTier = user.membershipTier;

  // Check for upgrades
  if (user.membershipTier === "CHOPSTICK") {
    if (user.tierProgressOrders >= 10 || user.tierProgressReferrals >= 5) {
      newTier = "NOODLE_MASTER";
    }
  } else if (user.membershipTier === "NOODLE_MASTER") {
    if (user.tierProgressOrders >= 50 || user.tierProgressReferrals >= 20) {
      newTier = "BEEF_BOSS";
    }
  }

  // Upgrade if tier changed
  if (newTier !== user.membershipTier) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        membershipTier: newTier,
        tierProgressOrders: 0, // Reset progress for next tier
        tierProgressReferrals: 0,
      },
    });

    // Award VIP badge if reached Beef Boss
    if (newTier === "BEEF_BOSS") {
      const vipBadge = await prisma.badge.findUnique({
        where: { slug: "vip" },
      });
      if (vipBadge) {
        await prisma.userBadge
          .create({
            data: {
              userId: userId,
              badgeId: vipBadge.id,
            },
          })
          .catch(() => {}); // Ignore if already exists
      }
    }

    console.log(`🎉 User ${userId} upgraded to ${newTier}!`);
  }
}

// Check and award badges after order completion
async function checkAndAwardBadges(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      badges: { select: { badgeId: true } },
      orders: { where: { paymentStatus: "PAID" } },
    },
  });

  if (!user) return;

  const earnedBadgeIds = user.badges.map((b) => b.badgeId);
  const badges = await prisma.badge.findMany({ where: { isActive: true } });

  for (const badge of badges) {
    // Skip if already earned
    if (earnedBadgeIds.includes(badge.id)) continue;

    let shouldAward = false;

    // Check milestone badges
    if (badge.slug === "first-order" && user.lifetimeOrderCount >= 1)
      shouldAward = true;
    if (badge.slug === "10-orders" && user.lifetimeOrderCount >= 10)
      shouldAward = true;
    if (badge.slug === "50-orders" && user.lifetimeOrderCount >= 50)
      shouldAward = true;
    if (badge.slug === "100-orders" && user.lifetimeOrderCount >= 100)
      shouldAward = true;

    // Check referral badges
    const referralCount = await prisma.user.count({
      where: { referredById: userId, lifetimeOrderCount: { gt: 0 } },
    });
    if (badge.slug === "first-referral" && referralCount >= 1)
      shouldAward = true;
    if (badge.slug === "10-referrals" && referralCount >= 10)
      shouldAward = true;
    if (badge.slug === "50-referrals" && referralCount >= 50)
      shouldAward = true;

    // Check streak badges
    if (badge.slug === "3-day-streak" && user.longestStreak >= 3)
      shouldAward = true;
    if (badge.slug === "7-day-streak" && user.longestStreak >= 7)
      shouldAward = true;
    if (badge.slug === "30-day-streak" && user.longestStreak >= 30)
      shouldAward = true;

    // Award the badge
    if (shouldAward) {
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId: badge.id,
        },
      });

      console.log(`🏆 Badge awarded: ${badge.name} to user ${userId}`);
    }
  }
}

// ====================
// START SERVER
// ====================

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 API server running on http://localhost:${PORT}`);
});
