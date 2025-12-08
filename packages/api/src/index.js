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

const PORT = process.env.PORT || process.env.API_PORT || 4000;

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

app.post("/tenants", async (req, reply) => {
  const { slug, brandName, logoUrl, primaryColor } = req.body || {};

  if (!slug || !brandName) {
    return reply.code(400).send({ error: "slug and brandName required" });
  }

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      brandName,
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
    },
  });

  return tenant;
});

app.patch("/tenants/:id", async (req, reply) => {
  const { id } = req.params;
  const { slug, brandName, logoUrl, primaryColor } = req.body || {};

  const data = {};
  if (slug) data.slug = slug;
  if (brandName) data.brandName = brandName;
  if (logoUrl !== undefined) data.logoUrl = logoUrl || null;
  if (primaryColor !== undefined) data.primaryColor = primaryColor || null;

  if (!Object.keys(data).length) {
    return reply.code(400).send({ error: "At least one field required" });
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data,
  });

  return tenant;
});

app.delete("/tenants/:id", async (req, reply) => {
  const { id } = req.params;
  try {
    await prisma.tenant.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    if (error.code === 'P2003') {
      return reply.code(400).send({ error: "Cannot delete tenant with associated locations or menu items" });
    }
    throw error;
  }
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
  const { name, city, address, state, zipCode, country, lat, lng, phone, email, customMessage, operatingHours, isActive, tenantId } = req.body || {};

  if (!name || !city || !tenantId) {
    return reply.code(400).send({ error: "name, city, and tenantId required" });
  }

  const location = await prisma.location.create({
    data: {
      name,
      city,
      address: address || "",
      state: state || null,
      zipCode: zipCode || null,
      country: country || "US",
      lat: lat || 0,
      lng: lng || 0,
      phone: phone || null,
      email: email || null,
      customMessage: customMessage || null,
      operatingHours: operatingHours || null,
      isActive: isActive !== undefined ? isActive : true,
      tenantId,
    },
  });

  return location;
});

app.patch("/locations/:id", async (req, reply) => {
  const { id } = req.params;
  const { name, city, address, state, zipCode, country, lat, lng, phone, email, customMessage, operatingHours, isActive } = req.body || {};

  const data = {};
  if (name !== undefined) data.name = name;
  if (city !== undefined) data.city = city;
  if (address !== undefined) data.address = address;
  if (state !== undefined) data.state = state;
  if (zipCode !== undefined) data.zipCode = zipCode;
  if (country !== undefined) data.country = country;
  if (lat !== undefined) data.lat = lat;
  if (lng !== undefined) data.lng = lng;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;
  if (customMessage !== undefined) data.customMessage = customMessage;
  if (operatingHours !== undefined) data.operatingHours = operatingHours;
  if (isActive !== undefined) data.isActive = isActive;

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
  try {
    await prisma.location.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    if (error.code === 'P2003') {
      return reply.code(400).send({ error: "Cannot delete location with associated orders or seats" });
    }
    throw error;
  }
});

// Geocode an address to get lat/lng
app.post("/locations/geocode", async (req, reply) => {
  const { address, city, state, zipCode, country } = req.body || {};

  if (!address || !city) {
    return reply.code(400).send({ error: "address and city required" });
  }

  // Build full address string
  const addressParts = [address, city, state, zipCode, country || "US"].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  try {
    // Use Nominatim (OpenStreetMap) geocoding - free, no API key required
    const encodedAddress = encodeURIComponent(fullAddress);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'User-Agent': 'Oh-Platform/1.0' // Required by Nominatim
        }
      }
    );

    if (!response.ok) {
      return reply.code(500).send({ error: "Geocoding service error" });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return reply.code(404).send({ error: "Address not found" });
    }

    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: "Failed to geocode address" });
  }
});

// Validate and autocomplete address
app.post("/locations/validate-address", async (req, reply) => {
  const { address, city, state, zipCode, country } = req.body || {};

  if (!address || !city) {
    return reply.code(400).send({ error: "address and city required" });
  }

  // Build full address string
  const addressParts = [address, city, state, zipCode, country || "US"].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  try {
    // Use Nominatim for address validation and autocomplete
    const encodedAddress = encodeURIComponent(fullAddress);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&addressdetails=1&limit=5`,
      {
        headers: {
          'User-Agent': 'Oh-Platform/1.0'
        }
      }
    );

    if (!response.ok) {
      return reply.code(500).send({ error: "Address validation service error" });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return {
        valid: false,
        message: "Address not found. Please verify the address.",
        suggestions: []
      };
    }

    // Parse address components from the first result
    const result = data[0];
    const addr = result.address || {};

    return {
      valid: true,
      message: "Address validated successfully",
      normalized: {
        address: addr.road || addr.street || address,
        city: addr.city || addr.town || addr.village || city,
        state: addr.state || state,
        zipCode: addr.postcode || zipCode,
        country: addr.country_code?.toUpperCase() || country || "US",
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      },
      displayName: result.display_name,
      suggestions: data.slice(0, 5).map(item => ({
        displayName: item.display_name,
        address: item.address?.road || item.address?.street || '',
        city: item.address?.city || item.address?.town || item.address?.village || '',
        state: item.address?.state || '',
        zipCode: item.address?.postcode || '',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }))
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: "Failed to validate address" });
  }
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
    where: { tenantId: tenant.id, isAvailable: true },
    orderBy: [
      { categoryType: 'asc' },
      { displayOrder: 'asc' },
      { name: 'asc' }
    ]
  });

  return items;
});

// GET /menu/steps - Returns structured menu for multi-step order builder
app.get("/menu/steps", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id, isAvailable: true },
    orderBy: [
      { categoryType: 'asc' },
      { displayOrder: 'asc' },
      { name: 'asc' }
    ]
  });

  // Group items by category for easier frontend rendering
  const main01 = items.filter(i => i.category === 'main01');
  const main02 = items.filter(i => i.category === 'main02');
  const sliders = items.filter(i => i.categoryType === 'SLIDER');
  const addons = items.filter(i => i.categoryType === 'ADDON');
  const sides = items.filter(i => i.categoryType === 'SIDE');
  const drinks = items.filter(i => i.categoryType === 'DRINK');
  const desserts = items.filter(i => i.categoryType === 'DESSERT');

  return {
    steps: [
      {
        id: 'bowl',
        title: 'Build the Foundation',
        sections: [
          {
            id: 'soup',
            name: 'Choose Your Soup',
            selectionMode: 'SINGLE',
            required: true,
            items: main01
          },
          {
            id: 'noodles',
            name: 'Choose Your Noodles',
            selectionMode: 'SINGLE',
            required: true,
            items: main02
          }
        ]
      },
      {
        id: 'customize',
        title: 'Customize Your Bowl',
        sections: sliders.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          selectionMode: 'SLIDER',
          required: false,
          sliderConfig: item.sliderConfig,
          item
        }))
      },
      {
        id: 'extras',
        title: 'Add-Ons & Sides',
        sections: [
          {
            id: 'addons',
            name: 'Premium Add-ons',
            selectionMode: 'MULTIPLE',
            required: false,
            maxQuantity: 3,
            items: addons
          },
          {
            id: 'sides',
            name: 'Side Dishes',
            selectionMode: 'MULTIPLE',
            required: false,
            maxQuantity: 3,
            items: sides
          }
        ]
      },
      {
        id: 'drinks-desserts',
        title: 'Drinks & Dessert',
        sections: [
          {
            id: 'drinks',
            name: 'Beverages',
            selectionMode: 'MULTIPLE',
            required: false,
            maxQuantity: 1,
            items: drinks
          },
          {
            id: 'desserts',
            name: 'Dessert',
            selectionMode: 'MULTIPLE',
            required: false,
            maxQuantity: 1,
            items: desserts
          }
        ]
      }
    ]
  };
});

app.post("/menu", async (req, reply) => {
  const {
    name,
    category,
    categoryType,
    selectionMode,
    displayOrder,
    description,
    basePriceCents,
    additionalPriceCents,
    includedQuantity,
    sliderConfig,
    tenantId
  } = req.body || {};

  if (!name || basePriceCents === undefined || !tenantId) {
    return reply
      .code(400)
      .send({ error: "name, basePriceCents, and tenantId required" });
  }

  const item = await prisma.menuItem.create({
    data: {
      name,
      category: category || null,
      categoryType: categoryType || null,
      selectionMode: selectionMode || 'MULTIPLE',
      displayOrder: displayOrder || 0,
      description: description || null,
      basePriceCents,
      additionalPriceCents: additionalPriceCents || 0,
      includedQuantity: includedQuantity || 0,
      sliderConfig: sliderConfig || null,
      tenantId
    },
  });

  return item;
});

app.patch("/menu/:id", async (req, reply) => {
  const { id } = req.params;
  const {
    name,
    category,
    description,
    basePriceCents,
    additionalPriceCents,
    includedQuantity,
    priceCents // legacy support
  } = req.body || {};

  const data = {};
  if (name !== undefined) data.name = name;
  if (category !== undefined) data.category = category;
  if (description !== undefined) data.description = description;
  if (additionalPriceCents !== undefined) data.additionalPriceCents = additionalPriceCents;
  if (includedQuantity !== undefined) data.includedQuantity = includedQuantity;

  // Support both priceCents (legacy) and basePriceCents (new schema)
  if (basePriceCents !== undefined) data.basePriceCents = basePriceCents;
  else if (priceCents !== undefined) data.basePriceCents = priceCents;

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
  try {
    await prisma.menuItem.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    if (error.code === 'P2003') {
      return reply.code(400).send({ error: "Cannot delete menu item with associated order items" });
    }
    throw error;
  }
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

  // Helper function to calculate item price with flexible pricing
  function calculateItemPrice(menuItem, quantity) {
    // If quantity is within included amount, price is 0
    if (quantity <= menuItem.includedQuantity) {
      return 0;
    }

    // If there's an included quantity, only charge for extras
    if (menuItem.includedQuantity > 0) {
      const extraQuantity = quantity - menuItem.includedQuantity;
      return menuItem.basePriceCents + menuItem.additionalPriceCents * (extraQuantity - 1);
    }

    // Standard pricing: base + additional for each extra
    return menuItem.basePriceCents + menuItem.additionalPriceCents * (quantity - 1);
  }

  let totalCents = 0;
  const orderItems = items.map((item) => {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId);
    if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);

    const itemTotal = calculateItemPrice(menuItem, item.quantity);
    totalCents += itemTotal;

    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      priceCents: itemTotal,
      // Store the display label for slider items (e.g., "Light", "Medium")
      selectedValue: item.selectedValue || null,
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
  const { status, paymentStatus, userId, totalCents, estimatedArrival } = req.body || {};

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
  if (estimatedArrival) data.estimatedArrival = new Date(estimatedArrival);

  if (!Object.keys(data).length) {
    return reply
      .code(400)
      .send({ error: "status, paymentStatus, userId, totalCents, or estimatedArrival required" });
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

    // Calculate streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newStreak = 1;
    let newLongestStreak = user.longestStreak;

    if (user.lastOrderDate) {
      const lastOrder = new Date(user.lastOrderDate);
      lastOrder.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (today.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) {
        // Same day - keep current streak
        newStreak = user.currentStreak;
      } else if (daysDiff === 1) {
        // Consecutive day - increment streak
        newStreak = user.currentStreak + 1;
      } else {
        // Gap > 1 day - reset streak
        newStreak = 1;
      }
    }

    // Update longest streak if current is higher
    if (newStreak > newLongestStreak) {
      newLongestStreak = newStreak;
    }

    // Update lifetime stats and streak
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lifetimeOrderCount: { increment: 1 },
        lifetimeSpentCents: { increment: order.totalCents },
        tierProgressOrders: { increment: 1 },
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastOrderDate: new Date(),
      },
    });

    // Check for tier upgrade
    await checkTierUpgrade(user.id);

    // Award badges
    await checkAndAwardBadges(user.id);

    // If user was referred, queue credits for referrer (scheduled disbursement)
    if (user.referredById) {
      const paidOrderCount = await prisma.order.count({
        where: {
          userId: user.id,
          paymentStatus: "PAID",
        },
      });

      if (paidOrderCount === 1) {
        // This is their first order - check $20 minimum requirement
        const MINIMUM_ORDER_FOR_REFERRAL = 2000; // $20.00 in cents

        if (order.totalCents >= MINIMUM_ORDER_FOR_REFERRAL) {
          // Order meets minimum - queue credits for referrer
          const referrer = await prisma.user.findUnique({
            where: { id: user.referredById },
          });

          if (referrer) {
            // Get referrer's tier benefits
            const tierBenefits = getTierBenefits(referrer.membershipTier);
            const referralBonus = tierBenefits.referralBonus;

            // Calculate next disbursement date (1st or 16th of month)
            const scheduledFor = getNextDisbursementDate();

            // Create pending credit instead of immediate credit
            await prisma.pendingCredit.create({
              data: {
                userId: user.referredById,
                type: "REFERRAL_ORDER",
                amountCents: referralBonus,
                sourceUserId: user.id,
                sourceOrderId: order.id,
                description: `Referral bonus - friend's first order (scheduled for ${scheduledFor.toLocaleDateString()})`,
                scheduledFor,
              },
            });

            // Create a credit event to track this (but don't add to balance yet)
            await prisma.creditEvent.create({
              data: {
                userId: user.referredById,
                type: "REFERRAL_ORDER_PENDING",
                amountCents: referralBonus,
                orderId: order.id,
                description: `Referral bonus pending - scheduled for ${scheduledFor.toLocaleDateString()}`,
              },
            });

            // Still increment referral progress for tier tracking
            await prisma.user.update({
              where: { id: user.referredById },
              data: {
                tierProgressReferrals: { increment: 1 },
              },
            });

            // Check if referrer should be upgraded
            await checkTierUpgrade(user.referredById);

            console.log(`📅 Referral credit of $${referralBonus / 100} queued for ${referrer.email}, scheduled for ${scheduledFor.toLocaleDateString()}`);
          }
        } else {
          console.log(`❌ Referral credit not awarded - order total $${order.totalCents / 100} below $20 minimum`);
        }
      }
    }

    // Award cashback credits based on user's tier
    const tierBenefits = getTierBenefits(user.membershipTier);
    const cashbackAmount = Math.floor((order.totalCents * tierBenefits.cashbackPercent) / 100);

    if (cashbackAmount > 0) {
      await prisma.creditEvent.create({
        data: {
          userId: user.id,
          type: "CASHBACK",
          amountCents: cashbackAmount,
          orderId: order.id,
          description: `${tierBenefits.cashbackPercent}% cashback on order`,
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          creditsCents: { increment: cashbackAmount },
        },
      });
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

  console.log("POST /users - Received:", { email, phone, name, referredByCode });

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

  if (existing) {
    console.log("⚠️ User already exists:", existing.id);
    console.log("  - existing.email:", existing.email);
    console.log("  - existing.creditsCents:", existing.creditsCents);
    console.log("  - existing.referredById:", existing.referredById);
    console.log("  - NEW referredByCode param:", referredByCode);

    // If existing user has NO referrer but a referral code is provided, apply it
    if (!existing.referredById && referredByCode) {
      console.log("🎯 Existing user has no referrer, applying new referral code!");

      // Find referrer
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referredByCode },
      });

      if (referrer) {
        console.log("✅ Found referrer:", referrer.id, referrer.email);

        // Update existing user with referrer and add $5 welcome bonus
        const updatedUser = await prisma.user.update({
          where: { id: existing.id },
          data: {
            referredById: referrer.id,
            creditsCents: (existing.creditsCents || 0) + 500,
          },
        });

        // Create credit event
        await prisma.creditEvent.create({
          data: {
            userId: existing.id,
            type: "REFERRAL_SIGNUP",
            amountCents: 500,
            description: "Welcome bonus - referred by a friend!",
          },
        });

        console.log("✅ Updated existing user with referral. New credits:", updatedUser.creditsCents);
        return { ...updatedUser, referralJustApplied: true };
      } else {
        console.log("❌ Referrer not found for code:", referredByCode);
      }
    } else {
      console.log("ℹ️ Existing user already has referrer or no new referral code provided");
    }

    return existing;
  }

  // Find referrer if code provided
  let referredById = null;
  if (referredByCode) {
    console.log("Looking up referrer with code:", referredByCode);
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referredByCode },
    });
    if (referrer) {
      console.log("Found referrer:", referrer.id, referrer.email);
      referredById = referrer.id;
    } else {
      console.log("No referrer found with that code");
    }
  } else {
    console.log("No referral code provided");
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
    return { ...user, referralJustApplied: true };
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

  // Limit credits to $5 (500 cents) per order
  const MAX_CREDITS_PER_ORDER = 500;
  const maxCredits = Math.min(user.creditsCents, creditsCents, MAX_CREDITS_PER_ORDER);
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

// Get user's pending credits
app.get("/users/:id/pending-credits", async (req, reply) => {
  const { id } = req.params;

  const pendingCredits = await prisma.pendingCredit.findMany({
    where: {
      userId: id,
      disbursedAt: null, // Only show undisbursed credits
    },
    orderBy: { scheduledFor: "asc" },
  });

  // Calculate total pending
  const totalPendingCents = pendingCredits.reduce((sum, pc) => sum + pc.amountCents, 0);

  // Get next disbursement date
  const nextDisbursement = pendingCredits.length > 0 ? pendingCredits[0].scheduledFor : null;

  return {
    pendingCredits,
    totalPendingCents,
    nextDisbursement,
  };
});

// ====================
// CRON ENDPOINTS
// ====================

// Disburse pending credits - should be called by cron on 1st and 16th of each month
// POST /cron/disburse-credits
// Headers: x-cron-secret: <secret> (for basic auth)
app.post("/cron/disburse-credits", async (req, reply) => {
  // Basic security check - in production, use proper auth
  const cronSecret = req.headers["x-cron-secret"];
  const expectedSecret = process.env.CRON_SECRET || "dev-cron-secret";

  if (cronSecret !== expectedSecret) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const now = new Date();

  // Find all pending credits scheduled for today or earlier
  const pendingCredits = await prisma.pendingCredit.findMany({
    where: {
      disbursedAt: null,
      scheduledFor: { lte: now },
    },
    include: {
      user: true,
    },
  });

  console.log(`💰 Disbursing ${pendingCredits.length} pending credits...`);

  const results = {
    processed: 0,
    totalAmountCents: 0,
    errors: [],
  };

  for (const pending of pendingCredits) {
    try {
      // Add credits to user's balance
      await prisma.user.update({
        where: { id: pending.userId },
        data: {
          creditsCents: { increment: pending.amountCents },
        },
      });

      // Create credit event
      await prisma.creditEvent.create({
        data: {
          userId: pending.userId,
          type: "REFERRAL_ORDER",
          amountCents: pending.amountCents,
          description: "Referral bonus disbursed",
        },
      });

      // Mark pending credit as disbursed
      await prisma.pendingCredit.update({
        where: { id: pending.id },
        data: { disbursedAt: now },
      });

      results.processed++;
      results.totalAmountCents += pending.amountCents;

      console.log(`✅ Disbursed $${pending.amountCents / 100} to ${pending.user.email}`);
    } catch (error) {
      console.error(`❌ Failed to disburse credit ${pending.id}:`, error);
      results.errors.push({ id: pending.id, error: error.message });
    }
  }

  console.log(`💰 Disbursement complete: ${results.processed} credits totaling $${results.totalAmountCents / 100}`);

  return results;
});

// Get user's order history
app.get("/users/:id/orders", async (req, reply) => {
  const { id } = req.params;

  const orders = await prisma.order.findMany({
    where: {
      userId: id,
      paymentStatus: "PAID", // Only show paid orders
    },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      location: true,
      seat: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return orders;
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

// Calculate the next disbursement date (1st or 16th of month)
function getNextDisbursementDate() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (currentDay < 16) {
    // Next disbursement is the 16th of this month
    return new Date(currentYear, currentMonth, 16, 0, 0, 0);
  } else {
    // Next disbursement is the 1st of next month
    return new Date(currentYear, currentMonth + 1, 1, 0, 0, 0);
  }
}

function getTierBenefits(tier) {
  const benefits = {
    CHOPSTICK: {
      referralBonus: 500,
      cashbackPercent: 1,
      birthdayBonus: 1000,
      perks: ["Base referral rewards", "1% cashback"],
    },
    NOODLE_MASTER: {
      referralBonus: 500,
      cashbackPercent: 2,
      birthdayBonus: 2000,
      perks: [
        "Referral rewards",
        "2% cashback",
        "Early menu access",
        "Priority seating",
      ],
    },
    BEEF_BOSS: {
      referralBonus: 500,
      cashbackPercent: 3,
      birthdayBonus: 5000,
      perks: [
        "Referral rewards",
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
