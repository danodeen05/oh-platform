import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { PrismaClient } from "@oh/db";
import Anthropic from "@anthropic-ai/sdk";
import {
  sendOrderConfirmation,
  sendPodReadyNotification,
  sendOrderReadyNotification,
  sendQueueUpdateNotification,
  getNotificationStatus,
} from "./notifications.js";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { readFileSync } from "fs";
import crypto from "crypto";
import {
  generateAppleWalletPass,
  generateDemoPassData,
  generateGoogleWalletLink,
  isAppleWalletConfigured,
  isGoogleWalletConfigured,
} from "./wallet/wallet-pass.js";
import {
  getLocationStatus,
  validateArrivalTime,
  DEFAULT_HOURS,
} from "./utils/operating-hours.js";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var automatically)
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Initialize GA4 Analytics client
let ga4Client = null;
const GA4_PROPERTY_ID = process.env.GA_PROPERTY_ID || "516268103";
const GA4_CREDENTIALS_PATH = process.env.GA_SERVICE_ACCOUNT_PATH;

if (GA4_CREDENTIALS_PATH) {
  try {
    const credentials = JSON.parse(readFileSync(GA4_CREDENTIALS_PATH, "utf8"));
    ga4Client = new BetaAnalyticsDataClient({ credentials });
    console.log("✓ GA4 Analytics client initialized");
  } catch (err) {
    console.warn("GA4 Analytics client not initialized:", err.message);
  }
} else if (process.env.GA_SERVICE_ACCOUNT_JSON) {
  try {
    const credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON);
    ga4Client = new BetaAnalyticsDataClient({ credentials });
    console.log("✓ GA4 Analytics client initialized from env");
  } catch (err) {
    console.warn("GA4 Analytics client not initialized:", err.message);
  }
}

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

// Helper to get locale from request
function getLocale(req) {
  // Check query param first, then header, then default to English
  const queryLocale = req.query?.locale;
  const headerLocale = req.headers["accept-language"]?.split(",")[0]?.split("-")[0];
  const fullHeaderLocale = req.headers["accept-language"]?.split(",")[0];

  // Map common locale formats to our supported locales
  const localeMap = {
    "zh-TW": "zh-TW",
    "zh-tw": "zh-TW",
    "zh-Hant": "zh-TW",
    "zh-CN": "zh-CN",
    "zh-cn": "zh-CN",
    "zh-Hans": "zh-CN",
    "zh": "zh-CN", // Default Chinese to Simplified
    "es": "es",
    "en": "en",
  };

  // Priority: query param > full header locale > base header locale > default
  return localeMap[queryLocale] || localeMap[fullHeaderLocale] || localeMap[headerLocale] || "en";
}

// Helper to get language instruction for AI prompts based on locale
function getLanguageInstruction(locale) {
  const instructions = {
    "zh-TW": "\n\nIMPORTANT: Respond ONLY in Traditional Chinese (繁體中文). Do not use English.",
    "zh-CN": "\n\nIMPORTANT: Respond ONLY in Simplified Chinese (简体中文). Do not use English.",
    "es": "\n\nIMPORTANT: Respond ONLY in Spanish (Español). Do not use English.",
    "en": "", // No instruction needed for English
  };
  return instructions[locale] || "";
}

// Helper to localize menu item based on locale
function localizeMenuItem(item, locale) {
  if (!item) return item;

  const localizedItem = { ...item };

  // Always preserve the original English name for image lookups
  localizedItem.nameEn = item.name;

  switch (locale) {
    case "zh-TW":
      localizedItem.name = item.nameZhTW || item.name;
      localizedItem.description = item.descriptionZhTW || item.description;
      break;
    case "zh-CN":
      localizedItem.name = item.nameZhCN || item.name;
      localizedItem.description = item.descriptionZhCN || item.description;
      break;
    case "es":
      localizedItem.name = item.nameEs || item.name;
      localizedItem.description = item.descriptionEs || item.description;
      break;
    // English is default, use original name
  }

  return localizedItem;
}

// Slider value translations for order display
const sliderValueTranslations = {
  en: {
    "Light": "Light",
    "Medium": "Medium",
    "Rich": "Rich",
    "Extra Rich": "Extra Rich",
    "Firm": "Firm",
    "Soft": "Soft",
    "None": "None",
    "Mild": "Mild",
    "Spicy": "Spicy",
    "Extra Spicy": "Extra Spicy",
    "Normal": "Normal",
    "Extra": "Extra"
  },
  "zh-TW": {
    "Light": "清淡",
    "Medium": "中等",
    "Rich": "濃郁",
    "Extra Rich": "特濃",
    "Firm": "偏硬",
    "Soft": "偏軟",
    "None": "無",
    "Mild": "微辣",
    "Spicy": "中辣",
    "Extra Spicy": "特辣",
    "Normal": "正常",
    "Extra": "加量"
  },
  "zh-CN": {
    "Light": "清淡",
    "Medium": "中等",
    "Rich": "浓郁",
    "Extra Rich": "特浓",
    "Firm": "偏硬",
    "Soft": "偏软",
    "None": "无",
    "Mild": "微辣",
    "Spicy": "中辣",
    "Extra Spicy": "特辣",
    "Normal": "正常",
    "Extra": "加量"
  },
  es: {
    "Light": "Ligero",
    "Medium": "Medio",
    "Rich": "Intenso",
    "Extra Rich": "Extra Intenso",
    "Firm": "Firme",
    "Soft": "Suave",
    "None": "Sin",
    "Mild": "Suave",
    "Spicy": "Picante",
    "Extra Spicy": "Extra Picante",
    "Normal": "Normal",
    "Extra": "Extra"
  }
};

// Helper to localize slider selected values
function localizeSelectedValue(value, locale) {
  if (!value) return value;
  const translations = sliderValueTranslations[locale] || sliderValueTranslations.en;
  return translations[value] || value;
}

// Localized section/step titles
const localizedLabels = {
  en: {
    buildFoundation: "Build the Foundation",
    chooseYourSoup: "Choose Your Soup",
    chooseYourNoodles: "Choose Your Noodles",
    customizeYourBowl: "Customize Your Bowl",
    addOnsSides: "Add-Ons & Sides",
    premiumAddons: "Premium Add-ons",
    sideDishes: "Side Dishes",
    drinksDessert: "Drinks & Dessert",
    beverages: "Beverages",
    dessert: "Dessert",
    included: "Included",
  },
  "zh-TW": {
    buildFoundation: "建立基底",
    chooseYourSoup: "選擇湯品",
    chooseYourNoodles: "選擇麵條",
    customizeYourBowl: "客製您的麵碗",
    addOnsSides: "加購與配菜",
    premiumAddons: "精選加購",
    sideDishes: "配菜",
    drinksDessert: "飲品與甜點",
    beverages: "飲品",
    dessert: "甜點",
    included: "已包含",
  },
  "zh-CN": {
    buildFoundation: "建立基底",
    chooseYourSoup: "选择汤品",
    chooseYourNoodles: "选择面条",
    customizeYourBowl: "定制您的面碗",
    addOnsSides: "加购与配菜",
    premiumAddons: "精选加购",
    sideDishes: "配菜",
    drinksDessert: "饮品与甜点",
    beverages: "饮品",
    dessert: "甜点",
    included: "已包含",
  },
  es: {
    buildFoundation: "Construye la Base",
    chooseYourSoup: "Elige Tu Sopa",
    chooseYourNoodles: "Elige Tus Fideos",
    customizeYourBowl: "Personaliza Tu Tazón",
    addOnsSides: "Extras y Acompañamientos",
    premiumAddons: "Extras Premium",
    sideDishes: "Acompañamientos",
    drinksDessert: "Bebidas y Postre",
    beverages: "Bebidas",
    dessert: "Postre",
    included: "Incluido",
  },
};

// Get localized labels for a locale
function getLabels(locale) {
  return localizedLabels[locale] || localizedLabels.en;
}

// ====================
// QUEUE PROCESSING & NOTIFICATIONS
// ====================

// Process queue and assign next customer to available pod
async function processQueue(locationId) {
  console.log(`Processing queue for location ${locationId}`);

  // Get available pods
  const availablePods = await prisma.seat.findMany({
    where: {
      locationId,
      status: "AVAILABLE",
    },
    orderBy: {
      number: "asc",
    },
  });

  if (availablePods.length === 0) {
    console.log("No available pods");
    return { assigned: 0 };
  }

  // Get queue sorted by priority (highest first)
  const queueEntries = await prisma.waitQueue.findMany({
    where: {
      locationId,
      status: "WAITING",
    },
    orderBy: {
      priority: "desc",
    },
    take: availablePods.length, // Only get as many as we can assign
    include: {
      order: {
        include: {
          user: true,
        },
      },
    },
  });

  if (queueEntries.length === 0) {
    console.log("Queue is empty");
    return { assigned: 0 };
  }

  const assigned = [];

  // Assign pods to top N people in queue
  for (let i = 0; i < Math.min(availablePods.length, queueEntries.length); i++) {
    const queueEntry = queueEntries[i];
    const pod = availablePods[i];

    try {
      // Assign pod and update statuses
      const [updatedOrder, updatedSeat, updatedQueue] = await prisma.$transaction([
        prisma.order.update({
          where: { id: queueEntry.orderId },
          data: {
            seatId: pod.id,
            podAssignedAt: new Date(),
            podSelectionMethod: "AUTO",
            queuePosition: null, // Remove from queue position
          },
          include: {
            seat: true,
            user: true,
          },
        }),
        prisma.seat.update({
          where: { id: pod.id },
          data: { status: "RESERVED" },
        }),
        prisma.waitQueue.update({
          where: { id: queueEntry.id },
          data: {
            status: "ASSIGNED",
            assignedAt: new Date(),
          },
        }),
      ]);

      // Send notification to customer
      await notifyPodReady(updatedOrder);

      assigned.push({
        orderId: updatedOrder.id,
        podNumber: pod.number,
      });

      console.log(`Assigned order ${updatedOrder.kitchenOrderNumber || updatedOrder.orderNumber.slice(-6)} to Pod ${pod.number}`);
    } catch (error) {
      console.error(`Error assigning pod to queue entry ${queueEntry.id}:`, error);
    }
  }

  return { assigned: assigned.length, assignments: assigned };
}

// Send notification when pod is ready
async function notifyPodReady(order) {
  // Determine notification method based on what was sent
  let notificationMethod = "SYSTEM";
  const results = await sendPodReadyNotification(order, order.user, order.seat?.number);

  if (results.email?.success && results.sms?.success) {
    notificationMethod = "EMAIL_SMS";
  } else if (results.email?.success) {
    notificationMethod = "EMAIL";
  } else if (results.sms?.success) {
    notificationMethod = "SMS";
  }

  // Update order with notification timestamp
  await prisma.order.update({
    where: { id: order.id },
    data: {
      notifiedAt: new Date(),
      notificationMethod,
    },
  });

  console.log(`[NOTIFICATION] Order ${order.kitchenOrderNumber || order.orderNumber.slice(-6)}: Pod ${order.seat?.number} is ready!`);

  return { sent: true, method: notificationMethod, results };
}

// ====================
// HEALTH CHECK
// ====================

app.get("/health", async (req, reply) => {
  return { ok: true };
});

// Notification status endpoint
app.get("/notifications/status", async (req, reply) => {
  return getNotificationStatus();
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
    include: {
      stats: true,
      seats: true, // Include all pods
    },
  });

  // Calculate real-time pod availability and wait times for each location
  const locationsWithRealTimeStats = await Promise.all(
    locations.map(async (location) => {
      const totalSeats = location.seats.length;
      const availableSeats = location.seats.filter(s => s.status === 'AVAILABLE').length;

      // Calculate average wait time based on current queue
      let queuedOrders = 0;
      try {
        queuedOrders = await prisma.waitQueue.count({
          where: {
            locationId: location.id,
            assignedAt: null, // Not yet assigned to a pod
          }
        });
      } catch (error) {
        // If WaitQueue doesn't exist yet (old Prisma client), default to 0
        console.error('WaitQueue query failed:', error.message);
      }

      // Estimate: 15 minutes per order in queue, max 60 minutes
      const avgWaitMinutes = Math.min(queuedOrders * 15, 60);

      // Get operating hours availability
      const availability = getLocationStatus(location);

      return {
        ...location,
        stats: {
          availableSeats,
          totalSeats,
          avgWaitMinutes,
        },
        availability: {
          isOpen: availability.isOpen,
          canOrder: availability.canOrder,
          statusMessage: availability.statusMessage,
          closesAt: availability.closesAt,
        },
      };
    })
  );

  return locationsWithRealTimeStats;
});

// Get location availability for online ordering
app.get("/locations/:id/availability", async (req, reply) => {
  const { id } = req.params;

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      operatingHours: true,
      timezone: true,
      isClosed: true,
    },
  });

  if (!location) {
    return reply.code(404).send({ error: "Location not found" });
  }

  const status = getLocationStatus(location);

  return {
    locationId: location.id,
    locationName: location.name,
    ...status,
  };
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
  const locale = getLocale(req);

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

  // Localize all items
  return items.map(item => localizeMenuItem(item, locale));
});

// GET /menu/steps - Returns structured menu for multi-step order builder
app.get("/menu/steps", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const locale = getLocale(req);
  const labels = getLabels(locale);

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

  // Localize all items
  const localizedItems = items.map(item => localizeMenuItem(item, locale));

  // Group items by category for easier frontend rendering
  const main01 = localizedItems.filter(i => i.category === 'main01');
  const main02 = localizedItems.filter(i => i.category === 'main02');
  const sliders = localizedItems.filter(i => i.categoryType === 'SLIDER');
  const addons = localizedItems.filter(i => i.categoryType === 'ADDON');
  const sides = localizedItems.filter(i => i.categoryType === 'SIDE');
  const drinks = localizedItems.filter(i => i.categoryType === 'DRINK');
  const desserts = localizedItems.filter(i => i.categoryType === 'DESSERT');

  return {
    locale, // Include locale in response for frontend reference
    steps: [
      {
        id: 'bowl',
        title: labels.buildFoundation,
        sections: [
          {
            id: 'soup',
            name: labels.chooseYourSoup,
            selectionMode: 'SINGLE',
            required: true,
            items: main01
          },
          {
            id: 'noodles',
            name: labels.chooseYourNoodles,
            selectionMode: 'SINGLE',
            required: true,
            items: main02
          }
        ]
      },
      {
        id: 'customize',
        title: labels.customizeYourBowl,
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
        title: labels.addOnsSides,
        sections: [
          {
            id: 'addons',
            name: labels.premiumAddons,
            selectionMode: 'MULTIPLE',
            required: false,
            maxQuantity: 3,
            items: addons
          },
          {
            id: 'sides',
            name: labels.sideDishes,
            selectionMode: 'MULTIPLE',
            required: false,
            maxQuantity: 3,
            items: sides
          }
        ]
      },
      {
        id: 'drinks-desserts',
        title: labels.drinksDessert,
        sections: [
          {
            id: 'drinks',
            name: labels.beverages,
            selectionMode: 'MULTIPLE',
            required: false,
            maxQuantity: 1,
            items: drinks
          },
          {
            id: 'desserts',
            name: labels.dessert,
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

// POST /seats - Create a new pod/seat
app.post("/seats", async (req, reply) => {
  const { locationId, number } = req.body || {};

  if (!locationId || !number) {
    return reply.code(400).send({ error: "locationId and number required" });
  }

  // Generate unique QR code for pod
  const qrCode = `POD-${locationId}-${number}-${Date.now()}`;

  try {
    const seat = await prisma.seat.create({
      data: {
        locationId,
        number,
        qrCode,
      },
      include: {
        location: true,
      },
    });

    return seat;
  } catch (error) {
    if (error.code === "P2002") {
      return reply.code(400).send({ error: "Pod number already exists for this location" });
    }
    throw error;
  }
});

// PATCH /seats/:id - Update pod status or details
app.patch("/seats/:id", async (req, reply) => {
  const { id } = req.params;
  const { status, number } = req.body || {};

  const data = {};
  if (status) data.status = status;
  if (number) data.number = number;

  if (!Object.keys(data).length) {
    return reply.code(400).send({ error: "status or number required" });
  }

  const seat = await prisma.seat.update({
    where: { id },
    data,
    include: {
      location: true,
    },
  });

  return seat;
});

// DELETE /seats/:id - Delete a pod
app.delete("/seats/:id", async (req, reply) => {
  const { id } = req.params;

  // Check if seat has any orders
  const orderCount = await prisma.order.count({
    where: { seatId: id },
  });

  if (orderCount > 0) {
    return reply.code(400).send({
      error: "Cannot delete pod with existing orders"
    });
  }

  await prisma.seat.delete({
    where: { id },
  });

  return { success: true };
});

// GET /locations/:id/seats - Get all pods for a location
app.get("/locations/:id/seats", async (req, reply) => {
  const { id } = req.params;

  const seats = await prisma.seat.findMany({
    where: { locationId: id },
    include: {
      orders: {
        where: {
          status: {
            in: ["QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"],
          },
          podCleanedAt: null,
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              membershipTier: true,
            },
          },
          guest: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      number: "asc",
    },
  });

  return seats;
});

// POST /orders/check-in - Customer arrives and scans order QR at kiosk
app.post("/orders/check-in", async (req, reply) => {
  const { orderQrCode } = req.body || {};

  if (!orderQrCode) {
    return reply.code(400).send({ error: "orderQrCode required" });
  }

  // Find order by QR code
  const order = await prisma.order.findUnique({
    where: { orderQrCode },
    include: {
      user: true,
      location: true,
      seat: true,
    },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (order.paymentStatus !== "PAID") {
    return reply.code(400).send({ error: "Order must be paid before check-in" });
  }

  if (order.arrivedAt) {
    return reply.code(400).send({ error: "Order already checked in" });
  }

  const now = new Date();

  // Calculate arrival deviation (minutes early/late vs estimated)
  let arrivalDeviation = null;
  if (order.estimatedArrival) {
    arrivalDeviation = Math.round((now - order.estimatedArrival) / 60000);
  }

  // CASE 1: Customer pre-selected a seat during online ordering
  if (order.seatId && order.podSelectionMethod === "CUSTOMER_SELECTED") {
    // Check if their pre-selected pod is still available or reserved (for them)
    const preSelectedPod = await prisma.seat.findUnique({
      where: { id: order.seatId },
    });

    // Pod is valid if it's AVAILABLE or RESERVED (reserved for this customer on payment)
    if (preSelectedPod && (preSelectedPod.status === "AVAILABLE" || preSelectedPod.status === "RESERVED")) {
      // Honor the customer's selection
      const [updatedOrder, updatedSeat] = await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            arrivedAt: now,
            arrivalDeviation,
            podAssignedAt: now,
            status: "QUEUED",
            queuedAt: now, // Track when order entered kitchen queue
            paidAt: order.paidAt || now,
          },
          include: {
            seat: true,
            location: true,
            items: {
              include: {
                menuItem: true,
              },
            },
          },
        }),
        prisma.seat.update({
          where: { id: order.seatId },
          data: { status: "RESERVED" },
        }),
      ]);

      return {
        status: "ASSIGNED",
        message: `Go to your selected Pod ${preSelectedPod.number}`,
        order: updatedOrder,
        podNumber: preSelectedPod.number,
        preSelected: true,
      };
    }
    // If pre-selected pod is OCCUPIED or CLEANING, fall through to normal assignment
  }

  // CASE 2: Check for available pods at this location
  const availablePods = await prisma.seat.findMany({
    where: {
      locationId: order.locationId,
      status: "AVAILABLE",
    },
    orderBy: {
      number: "asc",
    },
  });

  if (availablePods.length > 0) {
    // Pod available! Auto-assign immediately
    const pod = availablePods[0];

    const [updatedOrder, updatedSeat] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          arrivedAt: now,
          arrivalDeviation,
          seatId: pod.id,
          podAssignedAt: now,
          podSelectionMethod: "AUTO",
          status: "QUEUED",
          queuedAt: now, // Track when order entered kitchen queue
          paidAt: order.paidAt || now, // Set paidAt if not already set
        },
        include: {
          seat: true,
          location: true,
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      }),
      prisma.seat.update({
        where: { id: pod.id },
        data: { status: "RESERVED" },
      }),
    ]);

    return {
      status: "ASSIGNED",
      message: `Go to Pod ${pod.number}`,
      order: updatedOrder,
      podNumber: pod.number,
    };
  }

  // No pods available - add to queue
  // Calculate priority score
  const waitMinutes = 0; // Just arrived
  let tierBoost = 0;
  if (order.user) {
    if (order.user.membershipTier === "BEEF_BOSS") tierBoost = 50;
    else if (order.user.membershipTier === "NOODLE_MASTER") tierBoost = 25;
    else if (order.user.membershipTier === "CHOPSTICK") tierBoost = 10;
  }

  const arrivalBonus = Math.abs(arrivalDeviation || 0) <= 5 ? 20 : 0;
  const lateBonus = (arrivalDeviation || 0) > 15 ? 30 : 0;
  const orderValueBonus = order.totalCents > 5000 ? 5 : 0;

  const priority = waitMinutes + tierBoost + arrivalBonus + lateBonus + orderValueBonus;

  // Get current queue count for position
  const queueCount = await prisma.waitQueue.count({
    where: {
      locationId: order.locationId,
      status: "WAITING",
    },
  });

  const queuePosition = queueCount + 1;

  // Estimate wait time (rough: 15 min per person ahead)
  const estimatedWaitMinutes = queuePosition * 15;

  // Create queue entry and update order
  const [queueEntry, updatedOrder] = await prisma.$transaction([
    prisma.waitQueue.create({
      data: {
        orderId: order.id,
        locationId: order.locationId,
        arrivedAt: now,
        estimatedArrival: order.estimatedArrival,
        priority,
        status: "WAITING",
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: {
        arrivedAt: now,
        arrivalDeviation,
        queuedAt: now,
        queuePosition,
        estimatedWaitMinutes,
        status: "QUEUED",
        paidAt: order.paidAt || now,
      },
      include: {
        location: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    }),
  ]);

  // Update user arrival metrics
  if (order.user && arrivalDeviation !== null) {
    const isOnTime = Math.abs(arrivalDeviation) <= 5;
    const newOnTimeCount = order.user.onTimeArrivals + (isOnTime ? 1 : 0);
    const newTotalOrders = order.user.lifetimeOrderCount + 1;

    await prisma.user.update({
      where: { id: order.user.id },
      data: {
        onTimeArrivals: newOnTimeCount,
        arrivalAccuracy: newOnTimeCount / newTotalOrders,
        avgArrivalDeviation:
          ((order.user.avgArrivalDeviation || 0) * order.user.lifetimeOrderCount + arrivalDeviation) /
          newTotalOrders,
      },
    });
  }

  return {
    status: "QUEUED",
    message: `All pods occupied. You're #${queuePosition} in queue.`,
    order: updatedOrder,
    queuePosition,
    estimatedWaitMinutes,
  };
});

// GET /orders/lookup - Look up order by order number or QR code (for kiosk check-in)
app.get("/orders/lookup", async (req, reply) => {
  const { code } = req.query || {};

  if (!code) {
    return reply.code(400).send({ error: "code required (order number or QR code)" });
  }

  // Try to find by order number first, then by QR code
  let order = await prisma.order.findUnique({
    where: { orderNumber: code.toUpperCase() },
    include: {
      seat: true,
      location: true,
      items: {
        include: {
          menuItem: true,
        },
      },
      user: true,
    },
  });

  // If not found by order number, try QR code
  if (!order) {
    order = await prisma.order.findUnique({
      where: { orderQrCode: code },
      include: {
        seat: true,
        location: true,
        items: {
          include: {
            menuItem: true,
          },
        },
        user: true,
      },
    });
  }

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  // Check if order is eligible for kiosk check-in
  // Must be PAID status and not yet arrived
  if (order.paymentStatus !== "PAID") {
    return reply.code(400).send({
      error: "Order not yet paid",
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
    });
  }

  if (order.arrivedAt) {
    return reply.code(400).send({
      error: "Order already checked in",
      arrivedAt: order.arrivedAt,
      seatNumber: order.seat?.number,
    });
  }

  return reply.send(order);
});

// GET /orders/status - Get real-time order status by QR code
app.get("/orders/status", async (req, reply) => {
  const { orderQrCode } = req.query || {};
  const locale = getLocale(req);

  if (!orderQrCode) {
    return reply.code(400).send({ error: "orderQrCode required" });
  }

  const order = await prisma.order.findUnique({
    where: { orderQrCode },
    include: {
      seat: true,
      location: true,
      items: {
        include: {
          menuItem: true,
        },
      },
      user: true,
      waitQueueEntry: true,
    },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  // Build response with status info
  const response = {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      kitchenOrderNumber: order.kitchenOrderNumber,
      orderQrCode: order.orderQrCode,
      status: order.status,
      totalCents: order.totalCents,
      estimatedArrival: order.estimatedArrival,

      // Timestamps
      paidAt: order.paidAt,
      arrivedAt: order.arrivedAt,
      queuedAt: order.queuedAt,
      prepStartTime: order.prepStartTime,
      readyTime: order.readyTime,
      deliveredAt: order.deliveredAt,
      completedTime: order.completedTime,

      // Pod info
      podNumber: order.seat?.number,
      podAssignedAt: order.podAssignedAt,
      podConfirmedAt: order.podConfirmedAt,

      // Queue info
      queuePosition: order.queuePosition,
      estimatedWaitMinutes: order.estimatedWaitMinutes,

      // Location
      location: {
        id: order.location.id,
        name: order.location.name,
        city: order.location.city,
      },

      // Items - localized based on user's language preference
      items: order.items.map((item) => {
        const localizedMenuItem = localizeMenuItem(item.menuItem, locale);
        return {
          id: item.id,
          name: localizedMenuItem.name,
          quantity: item.quantity,
          selectedValue: item.selectedValue,
          priceCents: item.priceCents,
          categoryType: item.menuItem.categoryType,
        };
      }),
    },
  };

  return response;
});

// POST /orders/confirm-pod - Confirm customer arrived at assigned pod
app.post("/orders/confirm-pod", async (req, reply) => {
  const { orderQrCode } = req.body || {};

  if (!orderQrCode) {
    return reply.code(400).send({ error: "orderQrCode required" });
  }

  const order = await prisma.order.findUnique({
    where: { orderQrCode },
    include: { seat: true, location: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "No pod assigned to this order. Please check in at the kiosk first." });
  }

  if (order.podConfirmedAt) {
    return reply.code(400).send({ error: "Pod arrival already confirmed" });
  }

  const now = new Date();

  // Mark pod as confirmed and occupied
  // Also handle case where customer bypassed kiosk check-in (no arrivedAt yet)
  const [updatedOrder, updatedSeat] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        podConfirmedAt: now,
        arrivedAt: order.arrivedAt || now, // Set arrivedAt if bypassed kiosk
        queuedAt: order.queuedAt || now, // Set queuedAt if not already set
        status: order.status === "PAID" ? "QUEUED" : order.status, // Move to QUEUED if still PAID
      },
      include: { seat: true, location: true, items: { include: { menuItem: true } } },
    }),
    prisma.seat.update({
      where: { id: order.seatId },
      data: { status: "OCCUPIED" },
    }),
  ]);

  console.log(`Order ${order.kitchenOrderNumber}: Customer confirmed arrival at Pod ${order.seat.number}`);

  return {
    success: true,
    message: `Welcome to Pod ${order.seat.number}! Your order is being prepared.`,
    order: updatedOrder,
  };
});

// POST /pods/confirm-arrival - Customer scans pod QR code to confirm arrival
// This is the endpoint called when a customer scans the QR code on their pod table
app.post("/pods/confirm-arrival", async (req, reply) => {
  const { podQrCode, userId } = req.body || {};

  if (!podQrCode) {
    return reply.code(400).send({ error: "podQrCode required" });
  }

  // Find the pod by QR code
  const pod = await prisma.seat.findFirst({
    where: { qrCode: podQrCode },
    include: { location: true },
  });

  if (!pod) {
    return reply.code(404).send({ error: "Pod not found. Please check the QR code." });
  }

  // Find the order assigned to this pod that hasn't been confirmed yet
  // Priority: 1) Orders for this specific user, 2) Any order assigned to this pod
  let order;

  if (userId) {
    // First try to find an order for this user at this pod
    order = await prisma.order.findFirst({
      where: {
        seatId: pod.id,
        userId: userId,
        paymentStatus: "PAID",
        podConfirmedAt: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { seat: true, location: true, items: { include: { menuItem: true } } },
    });
  }

  if (!order) {
    // Fall back to any order assigned to this pod
    order = await prisma.order.findFirst({
      where: {
        seatId: pod.id,
        paymentStatus: "PAID",
        podConfirmedAt: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { seat: true, location: true, items: { include: { menuItem: true } } },
    });
  }

  if (!order) {
    return reply.code(404).send({
      error: "No pending order found for this pod",
      podNumber: pod.number,
      locationName: pod.location.name,
      hint: "Make sure you've selected this pod during checkout or been assigned to it at the kiosk.",
    });
  }

  // Verify pod matches order (security check)
  if (order.seat.qrCode !== podQrCode) {
    return reply.code(400).send({ error: "Pod QR code doesn't match your assigned pod" });
  }

  if (order.podConfirmedAt) {
    return reply.code(400).send({ error: "You've already confirmed arrival at this pod" });
  }

  const now = new Date();

  // Confirm arrival and mark seat as occupied
  // Also set order to QUEUED status so kitchen can start preparing
  const [updatedOrder, updatedSeat] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        podConfirmedAt: now,
        arrivedAt: order.arrivedAt || now, // Set arrivedAt if not already set
        queuedAt: order.queuedAt || now, // Set queuedAt if not already set
        status: order.status === "PAID" ? "QUEUED" : order.status, // Move to QUEUED if still PAID
        paidAt: order.paidAt || now, // Ensure paidAt is set
      },
      include: { seat: true, location: true, items: { include: { menuItem: true } } },
    }),
    prisma.seat.update({
      where: { id: pod.id },
      data: { status: "OCCUPIED" },
    }),
  ]);

  console.log(`Order ${order.kitchenOrderNumber}: Customer confirmed arrival at Pod ${pod.number} via QR scan (bypassed kiosk)`);

  return {
    success: true,
    message: `Welcome to Pod ${pod.number}! Your order is being prepared.`,
    order: {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      kitchenOrderNumber: updatedOrder.kitchenOrderNumber,
      orderQrCode: updatedOrder.orderQrCode,
      podNumber: pod.number,
      locationName: pod.location.name,
      status: updatedOrder.status,
    },
  };
});

// GET /pods/info - Get pod info by QR code (for displaying pod details before confirming)
app.get("/pods/info", async (req, reply) => {
  const { qrCode } = req.query || {};

  if (!qrCode) {
    return reply.code(400).send({ error: "qrCode required" });
  }

  const pod = await prisma.seat.findFirst({
    where: { qrCode },
    include: { location: true },
  });

  if (!pod) {
    return reply.code(404).send({ error: "Pod not found" });
  }

  // Check if there's an active order at this pod
  const activeOrder = await prisma.order.findFirst({
    where: {
      seatId: pod.id,
      paymentStatus: "PAID",
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      id: true,
      orderNumber: true,
      kitchenOrderNumber: true,
      orderQrCode: true,
      podConfirmedAt: true,
      userId: true,
    },
  });

  return {
    pod: {
      id: pod.id,
      number: pod.number,
      qrCode: pod.qrCode,
      status: pod.status,
    },
    location: {
      id: pod.location.id,
      name: pod.location.name,
      city: pod.location.city,
    },
    hasActiveOrder: !!activeOrder,
    activeOrder: activeOrder
      ? {
          id: activeOrder.id,
          orderNumber: activeOrder.orderNumber,
          kitchenOrderNumber: activeOrder.kitchenOrderNumber,
          orderQrCode: activeOrder.orderQrCode,
          alreadyConfirmed: !!activeOrder.podConfirmedAt,
          userId: activeOrder.userId,
        }
      : null,
  };
});

// POST /orders/:id/assign-pod - Assign available pod to order
app.post("/orders/:id/assign-pod", async (req, reply) => {
  const { id } = req.params;
  const { seatId } = req.body || {};

  const order = await prisma.order.findUnique({
    where: { id },
    include: { location: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (order.seatId) {
    return reply.code(400).send({ error: "Order already has a pod assigned" });
  }

  let seat;

  if (seatId) {
    // Specific pod requested
    seat = await prisma.seat.findUnique({
      where: { id: seatId },
    });

    if (!seat) {
      return reply.code(404).send({ error: "Pod not found" });
    }

    if (seat.status !== "AVAILABLE") {
      return reply.code(400).send({ error: "Pod is not available" });
    }
  } else {
    // Auto-assign: Find first available pod at this location
    seat = await prisma.seat.findFirst({
      where: {
        locationId: order.locationId,
        status: "AVAILABLE",
      },
      orderBy: {
        number: "asc",
      },
    });

    if (!seat) {
      return reply.code(400).send({ error: "No available pods at this location" });
    }
  }

  // Assign pod and mark as RESERVED
  const [updatedOrder, updatedSeat] = await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: {
        seatId: seat.id,
        podAssignedAt: new Date(),
      },
      include: {
        seat: true,
        location: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    }),
    prisma.seat.update({
      where: { id: seat.id },
      data: {
        status: "RESERVED",
      },
    }),
  ]);

  return updatedOrder;
});

// POST /orders/:id/confirm-pod - Customer confirms pod by scanning QR
app.post("/orders/:id/confirm-pod", async (req, reply) => {
  const { id } = req.params;
  const { qrCode } = req.body || {};

  if (!qrCode) {
    return reply.code(400).send({ error: "qrCode required" });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { seat: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "Order does not have a pod assigned" });
  }

  if (order.seat.qrCode !== qrCode) {
    return reply.code(400).send({ error: "QR code does not match assigned pod" });
  }

  if (order.podConfirmedAt) {
    return reply.code(400).send({ error: "Pod already confirmed" });
  }

  // Confirm pod and mark seat as OCCUPIED
  const [updatedOrder, updatedSeat] = await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: {
        podConfirmedAt: new Date(),
      },
      include: {
        seat: true,
        location: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    }),
    prisma.seat.update({
      where: { id: order.seatId },
      data: {
        status: "OCCUPIED",
      },
    }),
  ]);

  return updatedOrder;
});

// POST /orders/:id/release-pod - Release pod when order is completed
app.post("/orders/:id/release-pod", async (req, reply) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { seat: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "Order does not have a pod assigned" });
  }

  // Release pod and mark as CLEANING
  const updatedSeat = await prisma.seat.update({
    where: { id: order.seatId },
    data: {
      status: "CLEANING",
    },
  });

  return { success: true, seat: updatedSeat };
});

// PATCH /seats/:id/clean - Mark pod as clean and available
app.patch("/seats/:id/clean", async (req, reply) => {
  const { id } = req.params;
  const cleanedAt = new Date();

  const seat = await prisma.seat.update({
    where: { id },
    data: {
      status: "AVAILABLE",
    },
  });

  // Update the most recent COMPLETED order for this seat with podCleanedAt
  // This tracks when cleaning was finished for average cleaning time calculation
  await prisma.order.updateMany({
    where: {
      seatId: id,
      status: "COMPLETED",
      podCleanedAt: null,
    },
    data: {
      podCleanedAt: cleanedAt,
    },
  });

  // Automatically process queue when pod becomes available
  console.log(`Pod ${seat.number} cleaned, processing queue for location ${seat.locationId}`);
  await processQueue(seat.locationId);

  return seat;
});

// POST /seats/:id/force-clean - Force pod to CLEANING and complete any active orders
// Used as emergency recovery when order/pod state gets out of sync
app.post("/seats/:id/force-clean", async (req, reply) => {
  const { id } = req.params;

  // Find the pod
  const seat = await prisma.seat.findUnique({
    where: { id },
    include: { location: true },
  });

  if (!seat) {
    return reply.code(404).send({ error: "Pod not found" });
  }

  // Find and complete any active orders on this pod
  const activeOrders = await prisma.order.findMany({
    where: {
      seatId: id,
      status: { in: ["QUEUED", "PREPPING", "READY", "SERVING"] },
    },
  });

  const completedOrderIds = [];
  for (const order of activeOrders) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        completedTime: new Date(),
      },
    });
    completedOrderIds.push(order.id);
    console.log(`Force-completed order ${order.kitchenOrderNumber || order.orderNumber} on pod ${seat.number}`);
  }

  // Set pod to CLEANING
  const updatedSeat = await prisma.seat.update({
    where: { id },
    data: { status: "CLEANING" },
  });

  console.log(`Force-cleaned pod ${seat.number} at ${seat.location.name}, completed ${activeOrders.length} orders`);

  return {
    success: true,
    seat: updatedSeat,
    completedOrders: completedOrderIds.length,
  };
});

// ====================
// DUAL POD CONFIGURATION
// ====================

// POST /seats/link-dual - Link two seats as a dual pod
app.post("/seats/link-dual", async (req, reply) => {
  const { seatId1, seatId2 } = req.body;

  if (!seatId1 || !seatId2) {
    return reply.code(400).send({ error: "Both seatId1 and seatId2 are required" });
  }

  if (seatId1 === seatId2) {
    return reply.code(400).send({ error: "Cannot link a seat to itself" });
  }

  // Fetch both seats
  const [seat1, seat2] = await Promise.all([
    prisma.seat.findUnique({ where: { id: seatId1 } }),
    prisma.seat.findUnique({ where: { id: seatId2 } }),
  ]);

  if (!seat1 || !seat2) {
    return reply.code(404).send({ error: "One or both seats not found" });
  }

  // Check they're at the same location
  if (seat1.locationId !== seat2.locationId) {
    return reply.code(400).send({ error: "Seats must be at the same location" });
  }

  // Check neither is already linked
  if (seat1.dualPartnerId || seat2.dualPartnerId) {
    return reply.code(400).send({ error: "One or both seats are already linked to a partner" });
  }

  // Check neither is currently occupied
  if (seat1.status === "OCCUPIED" || seat2.status === "OCCUPIED") {
    return reply.code(400).send({ error: "Cannot link occupied seats" });
  }

  // Link them bidirectionally using a transaction
  const [updatedSeat1, updatedSeat2] = await prisma.$transaction([
    prisma.seat.update({
      where: { id: seatId1 },
      data: {
        podType: "DUAL",
        dualPartnerId: seatId2,
      },
    }),
    prisma.seat.update({
      where: { id: seatId2 },
      data: {
        podType: "DUAL",
        dualPartnerId: seatId1,
      },
    }),
  ]);

  return { success: true, seat1: updatedSeat1, seat2: updatedSeat2 };
});

// POST /seats/unlink-dual - Unlink a dual pod
app.post("/seats/unlink-dual", async (req, reply) => {
  const { seatId } = req.body;

  if (!seatId) {
    return reply.code(400).send({ error: "seatId is required" });
  }

  const seat = await prisma.seat.findUnique({ where: { id: seatId } });

  if (!seat) {
    return reply.code(404).send({ error: "Seat not found" });
  }

  if (!seat.dualPartnerId) {
    return reply.code(400).send({ error: "Seat is not part of a dual pod" });
  }

  const partnerId = seat.dualPartnerId;

  // Check neither is currently occupied
  const partner = await prisma.seat.findUnique({ where: { id: partnerId } });
  if (seat.status === "OCCUPIED" || (partner && partner.status === "OCCUPIED")) {
    return reply.code(400).send({ error: "Cannot unlink occupied seats" });
  }

  // Unlink both seats using a transaction
  const [updatedSeat1, updatedSeat2] = await prisma.$transaction([
    prisma.seat.update({
      where: { id: seatId },
      data: {
        podType: "SINGLE",
        dualPartnerId: null,
      },
    }),
    prisma.seat.update({
      where: { id: partnerId },
      data: {
        podType: "SINGLE",
        dualPartnerId: null,
      },
    }),
  ]);

  return { success: true, seat1: updatedSeat1, seat2: updatedSeat2 };
});

// ====================
// POD CALLS (Customer requesting staff assistance)
// ====================

// POST /orders/:id/call-staff - Customer calls for staff assistance
app.post("/orders/:id/call-staff", async (req, reply) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  const order = await prisma.order.findUnique({
    where: { id },
    include: { seat: true, location: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "Order does not have a pod assigned" });
  }

  // Check if there's already a pending call for this order
  const existingCall = await prisma.podCall.findFirst({
    where: {
      orderId: id,
      status: "PENDING",
    },
  });

  if (existingCall) {
    return reply.code(400).send({
      error: "You already have a pending call. Staff will be with you shortly.",
      call: existingCall
    });
  }

  // Create the pod call
  const podCall = await prisma.podCall.create({
    data: {
      orderId: id,
      seatId: order.seatId,
      locationId: order.locationId,
      reason: reason || "GENERAL",
    },
    include: {
      seat: true,
      order: {
        select: {
          orderNumber: true,
          kitchenOrderNumber: true,
        },
      },
    },
  });

  console.log(`[POD CALL] Pod ${order.seat.number} requesting staff - Reason: ${reason || "GENERAL"}`);

  return {
    success: true,
    message: "Staff has been notified. Someone will be with you shortly.",
    call: podCall,
  };
});

// GET /pod-calls - Get all pending pod calls for a location
app.get("/pod-calls", async (req, reply) => {
  const { locationId, status } = req.query || {};

  const where = {};
  if (locationId) where.locationId = locationId;
  if (status) {
    where.status = status;
  } else {
    // Default to pending and acknowledged (active calls)
    where.status = { in: ["PENDING", "ACKNOWLEDGED"] };
  }

  const calls = await prisma.podCall.findMany({
    where,
    include: {
      seat: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          kitchenOrderNumber: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return calls;
});

// PATCH /pod-calls/:id/acknowledge - Staff acknowledges a pod call
app.patch("/pod-calls/:id/acknowledge", async (req, reply) => {
  const { id } = req.params;

  const call = await prisma.podCall.update({
    where: { id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
    },
    include: {
      seat: true,
    },
  });

  console.log(`[POD CALL] Pod ${call.seat.number} call acknowledged`);

  return call;
});

// PATCH /pod-calls/:id/resolve - Staff resolves/completes a pod call
app.patch("/pod-calls/:id/resolve", async (req, reply) => {
  const { id } = req.params;

  const call = await prisma.podCall.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
    include: {
      seat: true,
    },
  });

  console.log(`[POD CALL] Pod ${call.seat.number} call resolved`);

  return call;
});

// DELETE /pod-calls/:id - Customer cancels their own call
app.delete("/pod-calls/:id", async (req, reply) => {
  const { id } = req.params;

  const call = await prisma.podCall.update({
    where: { id },
    data: {
      status: "CANCELLED",
    },
  });

  return { success: true, message: "Call cancelled" };
});

// ====================
// ADD-ON ORDERS (Customer ordering additional items during meal)
// ====================

// GET /orders/:id/available-addons - Get available add-on items for an order
app.get("/orders/:id/available-addons", async (req, reply) => {
  const { id } = req.params;
  const locale = getLocale(req);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { menuItem: true },
      },
    },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  // Get all menu items organized by category type
  const menuItems = await prisma.menuItem.findMany({
    where: {
      tenantId: order.tenantId,
      isAvailable: true,
    },
    orderBy: [
      { categoryType: "asc" },
      { displayOrder: "asc" },
    ],
  });

  // Get drink IDs from original order (covered by refill section)
  const orderedDrinkIds = new Set(
    order.items
      .filter(item => item.menuItem.categoryType === "DRINK")
      .map(item => item.menuItem.id)
  );

  // Organize by add-on type for the UI with localization
  const addons = {
    // Paid add-ons: ADDON, SIDE, DRINK, DESSERT categories
    // Exclude drinks that are already in the order (covered by refills)
    paidAddons: menuItems
      .filter(item =>
        ["ADDON", "SIDE", "DRINK", "DESSERT"].includes(item.categoryType) &&
        item.basePriceCents > 0 &&
        !orderedDrinkIds.has(item.id)
      )
      .map(item => localizeMenuItem(item, locale)),

    // Drinks for refills (only drinks that were in the original order)
    refillableDrinks: order.items
      .filter(item => item.menuItem.categoryType === "DRINK")
      .map(item => localizeMenuItem(item.menuItem, locale)),

    // Extra vegetables: SLIDER items (free extras)
    // Filter out Soup Richness and Noodle Texture (not addable during meal)
    // Rename Spice Level to "Chili Oil (Spicy)" for clarity
    extraVegetables: menuItems
      .filter(item =>
        (item.categoryType === "SLIDER" || item.selectionMode === "SLIDER") &&
        !item.name.includes("Soup Richness") &&
        !item.name.includes("Noodle Texture")
      )
      .map(item => {
        const localized = localizeMenuItem(item, locale);
        // Rename Spice Level for add-on context (use localized name if available)
        if (item.name === "Spice Level") {
          // Use localized "Chili Oil (Spicy)" equivalent
          const chiliOilNames = {
            "zh-TW": "辣油（辣）",
            "zh-CN": "辣油（辣）",
            "es": "Aceite de Chile (Picante)",
            "en": "Chili Oil (Spicy)",
          };
          localized.name = chiliOilNames[locale] || "Chili Oil (Spicy)";
        }
        return localized;
      }),
  };

  return addons;
});

// POST /orders/:id/refill - Request a free drink refill
app.post("/orders/:id/refill", async (req, reply) => {
  const { id } = req.params;
  const { drinkMenuItemId, notes } = req.body || {};

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      seat: true,
      items: {
        include: { menuItem: true },
      },
    },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "Order does not have a pod assigned" });
  }

  // Verify the drink was in the original order (optional, can be relaxed)
  let drinkItem = null;
  if (drinkMenuItemId) {
    drinkItem = await prisma.menuItem.findUnique({ where: { id: drinkMenuItemId } });
    if (!drinkItem) {
      return reply.code(404).send({ error: "Drink not found" });
    }
  }

  // Generate order number for the refill
  const refillOrderNumber = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Create a child order for the refill
  // Add-on orders start as PREPPING since customer is already at pod
  const refillOrder = await prisma.order.create({
    data: {
      orderNumber: refillOrderNumber,
      tenantId: order.tenantId,
      locationId: order.locationId,
      seatId: order.seatId,
      parentOrderId: order.id,
      addOnType: "REFILL",
      status: "PREPPING", // Skip QUEUED - customer is already at pod
      podConfirmedAt: new Date(), // Customer already confirmed at pod
      paymentStatus: "PAID", // Free
      totalCents: 0,
      customizations: notes ? { notes } : null,
      items: drinkItem ? {
        create: [{
          menuItemId: drinkItem.id,
          quantity: 1,
          priceCents: 0,
          selectedValue: "Refill",
        }],
      } : undefined,
    },
    include: {
      seat: true,
      items: {
        include: { menuItem: true },
      },
    },
  });

  console.log(`[REFILL] Pod ${order.seat.number} requested drink refill`);

  return {
    success: true,
    message: "Drink refill requested. It will be brought to your pod shortly.",
    order: refillOrder,
  };
});

// POST /orders/:id/extra-vegetables - Request free extra vegetables
app.post("/orders/:id/extra-vegetables", async (req, reply) => {
  const { id } = req.params;
  const { items, notes } = req.body || {}; // items: [{menuItemId, selectedValue}]

  const order = await prisma.order.findUnique({
    where: { id },
    include: { seat: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "Order does not have a pod assigned" });
  }

  if (!items || items.length === 0) {
    return reply.code(400).send({ error: "At least one vegetable item required" });
  }

  // Generate order number for the extra veggies
  const extraOrderNumber = `VEG-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Create order items for the veggies
  const orderItems = items.map(item => ({
    menuItemId: item.menuItemId,
    quantity: 1,
    priceCents: 0,
    selectedValue: item.selectedValue || "Extra",
  }));

  // Create a child order for the extra vegetables
  // Add-on orders start as PREPPING since customer is already at pod
  const extraVegOrder = await prisma.order.create({
    data: {
      orderNumber: extraOrderNumber,
      tenantId: order.tenantId,
      locationId: order.locationId,
      seatId: order.seatId,
      parentOrderId: order.id,
      addOnType: "EXTRA_VEG",
      status: "PREPPING", // Skip QUEUED - customer is already at pod
      podConfirmedAt: new Date(), // Customer already confirmed at pod
      paymentStatus: "PAID", // Free
      totalCents: 0,
      customizations: notes ? { notes } : null,
      items: {
        create: orderItems,
      },
    },
    include: {
      seat: true,
      items: {
        include: { menuItem: true },
      },
    },
  });

  console.log(`[EXTRA VEG] Pod ${order.seat.number} requested extra vegetables`);

  return {
    success: true,
    message: "Extra vegetables requested. They will be brought to your pod shortly.",
    order: extraVegOrder,
  };
});

// POST /orders/:id/dessert-ready - Customer is ready for their dessert
app.post("/orders/:id/dessert-ready", async (req, reply) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      seat: true,
      items: {
        include: { menuItem: true },
      },
    },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "Order does not have a pod assigned" });
  }

  // Check if the order has a dessert item
  const dessertItem = order.items.find(
    item => item.menuItem.categoryType === "DESSERT"
  );

  if (!dessertItem) {
    return reply.code(400).send({ error: "No dessert in this order" });
  }

  // Create a child order for the dessert delivery (similar to refill flow)
  const dessertOrderNumber = `DES-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const dessertOrder = await prisma.order.create({
    data: {
      orderNumber: dessertOrderNumber,
      tenantId: order.tenantId,
      locationId: order.locationId,
      seatId: order.seatId,
      parentOrderId: order.id,
      addOnType: "DESSERT_READY",
      status: "PREPPING", // Skip QUEUED - customer is already at pod
      podConfirmedAt: new Date(), // Customer already confirmed at pod
      paymentStatus: "PAID", // Complimentary
      totalCents: 0,
      items: {
        create: [{
          menuItemId: dessertItem.menuItem.id,
          quantity: dessertItem.quantity,
          priceCents: 0,
          selectedValue: "Ready for Dessert",
        }],
      },
    },
    include: {
      seat: true,
      items: {
        include: { menuItem: true },
      },
    },
  });

  console.log(`[DESSERT] Pod ${order.seat.number} is ready for dessert`);

  return {
    success: true,
    message: "The kitchen has been notified. Your dessert will be delivered shortly!",
    order: dessertOrder,
  };
});

// POST /orders/:id/addons - Create a paid add-on order
app.post("/orders/:id/addons", async (req, reply) => {
  const { id } = req.params;
  const { items, notes } = req.body || {}; // items: [{menuItemId, quantity}]

  const order = await prisma.order.findUnique({
    where: { id },
    include: { seat: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (!order.seatId) {
    return reply.code(400).send({ error: "Order does not have a pod assigned" });
  }

  if (!items || items.length === 0) {
    return reply.code(400).send({ error: "At least one item required" });
  }

  // Calculate total for the add-on items
  const menuItemIds = items.map(item => item.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });

  let totalCents = 0;
  const orderItems = items.map(item => {
    const menuItem = menuItems.find(m => m.id === item.menuItemId);
    if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);

    const itemPrice = menuItem.basePriceCents * (item.quantity || 1);
    totalCents += itemPrice;

    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity || 1,
      priceCents: itemPrice,
      selectedValue: item.selectedValue || null,
    };
  });

  // Generate order number for the add-on
  const addonOrderNumber = `ADD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // Create the add-on order (initially PENDING_PAYMENT)
  const addonOrder = await prisma.order.create({
    data: {
      orderNumber: addonOrderNumber,
      tenantId: order.tenantId,
      locationId: order.locationId,
      seatId: order.seatId,
      parentOrderId: order.id,
      addOnType: "PAID_ADDON",
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      totalCents,
      customizations: notes ? { notes } : null,
      items: {
        create: orderItems,
      },
    },
    include: {
      seat: true,
      items: {
        include: { menuItem: true },
      },
    },
  });

  console.log(`[ADD-ON] Pod ${order.seat.number} created paid add-on order for $${(totalCents / 100).toFixed(2)}`);

  return {
    success: true,
    order: addonOrder,
    totalCents,
    // Client should now redirect to Stripe payment
  };
});

// ====================
// ORDERS
// ====================

app.get("/orders", async (req, reply) => {
  const { status, locationId, userId } = req.query || {};

  const where = {};
  if (status) {
    // Support comma-separated status values for filtering multiple statuses
    const statuses = status.split(",").map(s => s.trim());
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
  }
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
  const locale = getLocale(req);

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

  // Localize menu items based on locale
  const localizedOrder = {
    ...order,
    items: order.items.map(item => ({
      ...item,
      menuItem: localizeMenuItem(item.menuItem, locale),
      // Also localize the selectedValue for slider items
      selectedValue: localizeSelectedValue(item.selectedValue, locale),
    })),
  };

  return localizedOrder;
});

app.post("/orders", async (req, reply) => {
  const { locationId, tenantId, items, seatId, estimatedArrival, podSelectionMethod, userId, guestId, guestName, isKioskOrder, dualPartnerSeatId, isDualPod } =
    req.body || {};

  if (!locationId || !tenantId || !items || !items.length) {
    return reply
      .code(400)
      .send({ error: "locationId, tenantId, and items required" });
  }

  // Validate arrival time is within operating hours (skip for kiosk orders - customer is present)
  if (!isKioskOrder && estimatedArrival) {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { operatingHours: true, timezone: true, isClosed: true },
    });

    if (location) {
      // Convert estimatedArrival (ISO timestamp) to minutes from now
      const arrivalDate = new Date(estimatedArrival);
      const now = new Date();
      const minutesFromNow = Math.round((arrivalDate.getTime() - now.getTime()) / (1000 * 60));
      const validation = validateArrivalTime(location, minutesFromNow);

      if (!validation.valid) {
        return reply.code(400).send({
          error: "Invalid arrival time",
          message: validation.reason,
        });
      }
    }
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

  // Generate unique order number (long format)
  const orderNumber = `ORD-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 6)
    .toUpperCase()}`;

  // Generate order QR code for customer scanning (at kiosk and pod)
  const orderQrCode = `ORDER-${locationId.slice(-8)}-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 6)
    .toUpperCase()}`;

  // Generate daily kitchen order number (0001-9999 per location per day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Count today's PAID orders for this location to get next number
  let todaysOrderCount = 0;
  try {
    todaysOrderCount = await prisma.order.count({
      where: {
        locationId,
        paymentStatus: "PAID",
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  } catch (error) {
    console.error('Failed to count orders for kitchen number:', error.message);
    // Fallback: use timestamp-based number
    todaysOrderCount = 0;
  }

  // Format as 4-digit string (e.g., "0001", "0042", "0234")
  const kitchenOrderNumber = String(todaysOrderCount + 1).padStart(4, "0");

  // Create guest record if guestName provided (kiosk orders)
  let resolvedGuestId = guestId;
  if (!resolvedGuestId && guestName) {
    const guest = await prisma.guest.create({
      data: {
        name: guestName,
        sessionToken: `kiosk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    resolvedGuestId = guest.id;
  }

  const order = await prisma.order.create({
    data: {
      orderNumber,
      orderQrCode,
      kitchenOrderNumber,
      tenantId,
      locationId,
      seatId,
      podSelectionMethod: seatId ? (podSelectionMethod || "CUSTOMER_SELECTED") : null,
      podAssignedAt: seatId ? new Date() : null,
      // Dual pod data
      dualPartnerSeatId: dualPartnerSeatId || null,
      isDualPod: isDualPod || false,
      totalCents,
      estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
      userId: userId || null,
      guestId: resolvedGuestId || null,
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
      guest: true,
      user: true,
    },
  });

  return order;
});

// PATCH /orders/:id - Update order status
app.patch("/orders/:id", async (req, reply) => {
  const { id } = req.params;
  const {
    status,
    paymentStatus,
    userId,
    guestId,
    totalCents,
    estimatedArrival,
    seatId,
    podSelectionMethod,
    podAssignedAt,
    podConfirmedAt,
    podReservationExpiry,
    orderSource,
  } = req.body || {};

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
  if (guestId) data.guestId = guestId;
  if (totalCents !== undefined) data.totalCents = totalCents;
  if (estimatedArrival) data.estimatedArrival = new Date(estimatedArrival);
  if (seatId) data.seatId = seatId;
  if (podSelectionMethod) data.podSelectionMethod = podSelectionMethod;
  if (podAssignedAt) data.podAssignedAt = new Date(podAssignedAt);
  if (podConfirmedAt) data.podConfirmedAt = new Date(podConfirmedAt);
  if (podReservationExpiry) data.podReservationExpiry = new Date(podReservationExpiry);
  if (orderSource) data.orderSource = orderSource;

  if (!Object.keys(data).length) {
    return reply
      .code(400)
      .send({ error: "status, paymentStatus, userId, guestId, totalCents, estimatedArrival, or seatId required" });
  }

  // If setting payment to PAID, also set paidAt timestamp and reservation expiry
  if (paymentStatus === "PAID") {
    data.paidAt = new Date();
    data.queuedAt = new Date(); // Track when it entered the kitchen queue
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

  // If order just got paid and has a pre-selected seat, reserve it
  if (paymentStatus === "PAID" && order.seatId) {
    // Set 15-minute reservation expiry (advertised as 10 min, grace period of 5 min)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);

    // Build list of seats to reserve - primary seat, plus partner if dual pod
    const seatsToReserve = [order.seatId];
    if (order.isDualPod && order.dualPartnerSeatId) {
      seatsToReserve.push(order.dualPartnerSeatId);
    }

    // Reserve the seat(s) and set expiry on the order
    await Promise.all([
      // Reserve all seats (primary + partner for dual pods)
      prisma.seat.updateMany({
        where: { id: { in: seatsToReserve } },
        data: { status: "RESERVED" },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { podReservationExpiry: expiryTime },
      }),
    ]);

    if (order.isDualPod && order.dualPartnerSeatId) {
      console.log(`Dual Pod ${order.seat?.number} (both seats) reserved for order ${order.kitchenOrderNumber}, expires at ${expiryTime.toISOString()}`);
    } else {
      console.log(`Pod ${order.seat?.number} reserved for order ${order.kitchenOrderNumber}, expires at ${expiryTime.toISOString()}`);
    }

    // Send order confirmation notification
    if (order.user) {
      sendOrderConfirmation(order, order.user).catch(err => {
        console.error("Failed to send order confirmation:", err);
      });
    }
  }

  // Send order confirmation if paid (for orders without pre-selected seat)
  if (paymentStatus === "PAID" && !order.seatId && order.user) {
    sendOrderConfirmation(order, order.user).catch(err => {
      console.error("Failed to send order confirmation:", err);
    });
  }

  // If podConfirmedAt was just set, mark seat as OCCUPIED
  if (podConfirmedAt && order.seatId) {
    const seatsToOccupy = [order.seatId];
    if (order.isDualPod && order.dualPartnerSeatId) {
      seatsToOccupy.push(order.dualPartnerSeatId);
    }

    await prisma.seat.updateMany({
      where: { id: { in: seatsToOccupy } },
      data: { status: "OCCUPIED" },
    });

    if (order.isDualPod && order.dualPartnerSeatId) {
      console.log(`Dual Pod ${order.seat?.number} (both seats) now OCCUPIED - customer confirmed arrival for order ${order.kitchenOrderNumber}`);
    } else {
      console.log(`Pod ${order.seat?.number} now OCCUPIED - customer confirmed arrival for order ${order.kitchenOrderNumber}`);
    }
  }

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

    // Update challenge progress
    await updateChallengeProgress(user.id, {
      totalCents: order.totalCents,
      items: order.items,
    });

    // Note: Referral credit is awarded when order reaches COMPLETED status (not at payment)
    // See /kitchen/orders/:id/status endpoint

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

    // Update name if it changed in Clerk
    if (name && name !== existing.name) {
      const updatedUser = await prisma.user.update({
        where: { id: existing.id },
        data: { name },
      });
      return updatedUser;
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

// ====================
// GUEST CHECKOUT
// ====================

// Helper to generate secure session token
function generateSessionToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// POST /guests - Create a guest session
app.post("/guests", async (req, reply) => {
  const { name, phone, email } = req.body || {};

  // Name is required at checkout, but we can create a session first
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const guest = await prisma.guest.create({
    data: {
      name: name || "Guest", // Placeholder until checkout
      phone: phone || null,
      email: email || null,
      sessionToken,
      expiresAt,
    },
  });

  return guest;
});

// GET /guests/session/:token - Get guest by session token
app.get("/guests/session/:token", async (req, reply) => {
  const { token } = req.params;

  const guest = await prisma.guest.findUnique({
    where: { sessionToken: token },
  });

  if (!guest) {
    return reply.code(404).send({ error: "Guest session not found" });
  }

  // Check if session is expired
  if (new Date() > guest.expiresAt) {
    return reply.code(401).send({ error: "Guest session expired" });
  }

  return guest;
});

// PATCH /guests/:id - Update guest details (name, phone, email at checkout)
app.patch("/guests/:id", async (req, reply) => {
  const { id } = req.params;
  const { name, phone, email } = req.body || {};

  const data = {};
  if (name) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;

  if (!Object.keys(data).length) {
    return reply.code(400).send({ error: "No fields to update" });
  }

  const guest = await prisma.guest.update({
    where: { id },
    data,
  });

  return guest;
});

// POST /guests/session/refresh - Refresh an existing session
app.post("/guests/session/refresh", async (req, reply) => {
  const { sessionToken } = req.body || {};

  if (!sessionToken) {
    return reply.code(400).send({ error: "sessionToken required" });
  }

  const guest = await prisma.guest.findUnique({
    where: { sessionToken },
  });

  if (!guest) {
    return reply.code(404).send({ error: "Guest session not found" });
  }

  // Extend session by another 24 hours
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const updatedGuest = await prisma.guest.update({
    where: { id: guest.id },
    data: { expiresAt: newExpiresAt },
  });

  return updatedGuest;
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

  // Calculate lifetime earnings (sum of positive credit events)
  const lifetimeEarningsResult = await prisma.creditEvent.aggregate({
    where: {
      userId: id,
      amountCents: { gt: 0 },
    },
    _sum: { amountCents: true },
  });
  const lifetimeEarningsCents = lifetimeEarningsResult._sum.amountCents || 0;

  // Calculate user's rank by lifetime earnings
  // Get all users' lifetime earnings and rank them
  const allUsersEarnings = await prisma.creditEvent.groupBy({
    by: ["userId"],
    where: { amountCents: { gt: 0 } },
    _sum: { amountCents: true },
    orderBy: { _sum: { amountCents: "desc" } },
  });

  // Find the user's rank (1-indexed)
  const userRank = allUsersEarnings.findIndex((u) => u.userId === id) + 1;
  const totalUsersWithEarnings = allUsersEarnings.length;

  return {
    balance: user.creditsCents,
    referralCode: user.referralCode,
    events: user.creditEvents,
    lifetimeEarningsCents,
    rank: userRank > 0 ? userRank : totalUsersWithEarnings + 1,
    totalUsers: totalUsersWithEarnings || 1,
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

// ====================
// CHALLENGE ADMIN ENDPOINTS
// ====================

// Create a new challenge
app.post("/challenges", async (req, reply) => {
  const { slug, name, description, rewardCents, iconEmoji, requirements, startsAt, endsAt } = req.body;

  if (!slug || !name || !description || !requirements) {
    return reply.code(400).send({ error: "slug, name, description, and requirements are required" });
  }

  const challenge = await prisma.challenge.create({
    data: {
      slug,
      name,
      description,
      rewardCents: rewardCents || 0,
      iconEmoji: iconEmoji || "🎯",
      requirements,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      isActive: true,
    },
  });

  console.log(`🎯 Challenge created: ${name}`);
  return challenge;
});

// Update a challenge
app.patch("/challenges/:id", async (req, reply) => {
  const { id } = req.params;
  const { name, description, rewardCents, iconEmoji, requirements, startsAt, endsAt, isActive } = req.body;

  const challenge = await prisma.challenge.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(rewardCents !== undefined && { rewardCents }),
      ...(iconEmoji !== undefined && { iconEmoji }),
      ...(requirements !== undefined && { requirements }),
      ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
      ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  console.log(`🎯 Challenge updated: ${challenge.name}`);
  return challenge;
});

// Delete a challenge (soft delete by deactivating)
app.delete("/challenges/:id", async (req, reply) => {
  const { id } = req.params;

  const challenge = await prisma.challenge.update({
    where: { id },
    data: { isActive: false },
  });

  console.log(`🎯 Challenge deactivated: ${challenge.name}`);
  return { success: true, message: "Challenge deactivated" };
});

// Get a single challenge by ID or slug
app.get("/challenges/:idOrSlug", async (req, reply) => {
  const { idOrSlug } = req.params;

  const challenge = await prisma.challenge.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      userChallenges: {
        select: {
          id: true,
          progress: true,
          completedAt: true,
          rewardClaimed: true,
        },
      },
    },
  });

  if (!challenge) {
    return reply.code(404).send({ error: "Challenge not found" });
  }

  return challenge;
});

// Enroll a user in a challenge
app.post("/users/:userId/challenges/:challengeId/enroll", async (req, reply) => {
  const { userId, challengeId } = req.params;

  // Check if challenge exists and is active
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge || !challenge.isActive) {
    return reply.code(404).send({ error: "Challenge not found or inactive" });
  }

  // Check if already enrolled
  const existing = await prisma.userChallenge.findUnique({
    where: { userId_challengeId: { userId, challengeId } },
  });

  if (existing) {
    return reply.code(400).send({ error: "Already enrolled in this challenge" });
  }

  // Initialize progress based on requirements type
  const initialProgress = { current: 0 };

  const userChallenge = await prisma.userChallenge.create({
    data: {
      userId,
      challengeId,
      progress: initialProgress,
    },
    include: { challenge: true },
  });

  console.log(`🎯 User ${userId} enrolled in challenge: ${challenge.name}`);
  return userChallenge;
});

// Claim challenge reward
app.post("/users/:userId/challenges/:challengeId/claim", async (req, reply) => {
  const { userId, challengeId } = req.params;

  const userChallenge = await prisma.userChallenge.findUnique({
    where: { userId_challengeId: { userId, challengeId } },
    include: { challenge: true },
  });

  if (!userChallenge) {
    return reply.code(404).send({ error: "Challenge enrollment not found" });
  }

  if (!userChallenge.completedAt) {
    return reply.code(400).send({ error: "Challenge not completed yet" });
  }

  if (userChallenge.rewardClaimed) {
    return reply.code(400).send({ error: "Reward already claimed" });
  }

  // Award the reward
  await prisma.$transaction([
    // Update user credits
    prisma.user.update({
      where: { id: userId },
      data: { creditsCents: { increment: userChallenge.challenge.rewardCents } },
    }),
    // Create credit event
    prisma.creditEvent.create({
      data: {
        userId,
        type: "CHALLENGE_REWARD",
        amountCents: userChallenge.challenge.rewardCents,
        description: `Challenge completed: ${userChallenge.challenge.name}`,
      },
    }),
    // Mark reward as claimed
    prisma.userChallenge.update({
      where: { id: userChallenge.id },
      data: { rewardClaimed: true },
    }),
  ]);

  console.log(`🎉 User ${userId} claimed reward for challenge: ${userChallenge.challenge.name}`);
  return { success: true, rewardCents: userChallenge.challenge.rewardCents };
});

// Get user's badge progress
app.get("/users/:id/badge-progress", async (req, reply) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      badges: {
        include: { badge: true },
      },
    },
  });

  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  // Get referral count (referrals who have placed at least 1 order)
  const referralCount = await prisma.user.count({
    where: { referredById: id, lifetimeOrderCount: { gt: 0 } },
  });

  // Get spicy order count for Heat Seeker badge
  const spicyOrderCount = await prisma.orderItem.count({
    where: {
      order: { userId: id, paymentStatus: "PAID" },
      menuItem: { name: { contains: "Spice", mode: "insensitive" } },
      selectedValue: { in: ["Spicy", "Extra Spicy", "Hot", "Extra Hot"] },
    },
  });

  // Get unique menu items for Menu Master badge
  const uniqueItemsOrdered = await prisma.orderItem.findMany({
    where: {
      order: { userId: id, paymentStatus: "PAID" },
      menuItem: {
        is: {
          categoryType: { in: ["MAIN", "ADDON", "SIDE", "DRINK", "DESSERT"] },
          isAvailable: true,
        },
      },
    },
    distinct: ["menuItemId"],
    select: { menuItemId: true },
  });

  const totalMenuItems = await prisma.menuItem.count({
    where: {
      isAvailable: true,
      categoryType: { in: ["MAIN", "ADDON", "SIDE", "DRINK", "DESSERT"] },
    },
  });

  // Get orders for time-based badges
  const allOrders = await prisma.order.findMany({
    where: { userId: id, paymentStatus: "PAID" },
    select: { createdAt: true, seatId: true },
    orderBy: { createdAt: "asc" },
  });

  // Calculate lunch orders (11am-2pm)
  const lunchOrderCount = allOrders.filter((o) => {
    const hour = new Date(o.createdAt).getHours();
    return hour >= 11 && hour < 14;
  }).length;

  // Calculate night orders (after 8pm)
  const nightOrderCount = allOrders.filter((o) => {
    const hour = new Date(o.createdAt).getHours();
    return hour >= 20;
  }).length;

  // Calculate unique pods visited
  const uniquePods = new Set(allOrders.filter((o) => o.seatId).map((o) => o.seatId));
  const uniquePodCount = uniquePods.size;

  // Check if user has quick return (ordered within 24 hours)
  let hasQuickReturn = false;
  for (let i = 1; i < allOrders.length; i++) {
    const diff = new Date(allOrders[i].createdAt).getTime() - new Date(allOrders[i - 1].createdAt).getTime();
    if (diff <= 24 * 60 * 60 * 1000) {
      hasQuickReturn = true;
      break;
    }
  }

  // Build progress for each badge type
  const earnedSlugs = user.badges.map((ub) => ub.badge.slug);

  const progress = {
    // Order milestone badges
    "first-order": {
      current: user.lifetimeOrderCount,
      required: 1,
      percent: Math.min(100, (user.lifetimeOrderCount / 1) * 100),
      earned: earnedSlugs.includes("first-order"),
    },
    "10-orders": {
      current: user.lifetimeOrderCount,
      required: 10,
      percent: Math.min(100, (user.lifetimeOrderCount / 10) * 100),
      earned: earnedSlugs.includes("10-orders"),
    },
    "50-orders": {
      current: user.lifetimeOrderCount,
      required: 50,
      percent: Math.min(100, (user.lifetimeOrderCount / 50) * 100),
      earned: earnedSlugs.includes("50-orders"),
    },
    "100-orders": {
      current: user.lifetimeOrderCount,
      required: 100,
      percent: Math.min(100, (user.lifetimeOrderCount / 100) * 100),
      earned: earnedSlugs.includes("100-orders"),
    },
    // Referral badges
    "first-referral": {
      current: referralCount,
      required: 1,
      percent: Math.min(100, (referralCount / 1) * 100),
      earned: earnedSlugs.includes("first-referral"),
    },
    "10-referrals": {
      current: referralCount,
      required: 10,
      percent: Math.min(100, (referralCount / 10) * 100),
      earned: earnedSlugs.includes("10-referrals"),
    },
    "50-referrals": {
      current: referralCount,
      required: 50,
      percent: Math.min(100, (referralCount / 50) * 100),
      earned: earnedSlugs.includes("50-referrals"),
    },
    // Streak badges
    "3-day-streak": {
      current: user.longestStreak,
      required: 3,
      percent: Math.min(100, (user.longestStreak / 3) * 100),
      earned: earnedSlugs.includes("3-day-streak"),
    },
    "7-day-streak": {
      current: user.longestStreak,
      required: 7,
      percent: Math.min(100, (user.longestStreak / 7) * 100),
      earned: earnedSlugs.includes("7-day-streak"),
    },
    "30-day-streak": {
      current: user.longestStreak,
      required: 30,
      percent: Math.min(100, (user.longestStreak / 30) * 100),
      earned: earnedSlugs.includes("30-day-streak"),
    },
    // VIP badge (Beef Boss tier)
    vip: {
      current: user.membershipTier === "BEEF_BOSS" ? 1 : 0,
      required: 1,
      percent: user.membershipTier === "BEEF_BOSS" ? 100 : 0,
      earned: earnedSlugs.includes("vip"),
      description: "Reach Beef Boss tier",
    },
    // OG Member badge
    "grand-opening": {
      current: user.createdAt <= new Date("2025-03-01") ? 1 : 0,
      required: 1,
      percent: user.createdAt <= new Date("2025-03-01") ? 100 : 0,
      earned: earnedSlugs.includes("grand-opening"),
      description: "Signed up before launch",
    },
    // Heat Seeker badge (spicy orders)
    "spicy-challenge": {
      current: spicyOrderCount,
      required: 10,
      percent: Math.min(100, (spicyOrderCount / 10) * 100),
      earned: earnedSlugs.includes("spicy-challenge"),
      description: "Order spicy 10 times",
    },
    // Menu Master badge (tried all items)
    "tried-all-items": {
      current: uniqueItemsOrdered.length,
      required: totalMenuItems,
      percent: totalMenuItems > 0 ? Math.min(100, (uniqueItemsOrdered.length / totalMenuItems) * 100) : 0,
      earned: earnedSlugs.includes("tried-all-items"),
      description: "Try every menu item",
    },
    // New badges
    "lunch-regular": {
      current: lunchOrderCount,
      required: 10,
      percent: Math.min(100, (lunchOrderCount / 10) * 100),
      earned: earnedSlugs.includes("lunch-regular"),
      description: "Order during lunch (11am-2pm) 10 times",
    },
    "night-owl": {
      current: nightOrderCount,
      required: 5,
      percent: Math.min(100, (nightOrderCount / 5) * 100),
      earned: earnedSlugs.includes("night-owl"),
      description: "Order after 8pm 5 times",
    },
    "big-spender": {
      current: Math.floor(user.lifetimeSpentCents / 100),
      required: 500,
      percent: Math.min(100, (user.lifetimeSpentCents / 50000) * 100),
      earned: earnedSlugs.includes("big-spender"),
      description: "Spend $500 lifetime",
    },
    "generous-soul": {
      current: referralCount,
      required: 3,
      percent: Math.min(100, (referralCount / 3) * 100),
      earned: earnedSlugs.includes("generous-soul"),
      description: "Refer 3 friends who order",
    },
    "pod-explorer": {
      current: uniquePodCount,
      required: 5,
      percent: Math.min(100, (uniquePodCount / 5) * 100),
      earned: earnedSlugs.includes("pod-explorer"),
      description: "Dine in 5 different pods",
    },
    "quick-return": {
      current: hasQuickReturn ? 1 : 0,
      required: 1,
      percent: hasQuickReturn ? 100 : 0,
      earned: earnedSlugs.includes("quick-return"),
      description: "Order again within 24 hours",
    },
    "birthday-bowl": {
      current: 0, // Would need birthday data from Clerk
      required: 1,
      percent: 0,
      earned: earnedSlugs.includes("birthday-bowl"),
      description: "Order on your birthday",
    },
  };

  return {
    userId: id,
    lifetimeOrderCount: user.lifetimeOrderCount,
    referralCount,
    longestStreak: user.longestStreak,
    currentStreak: user.currentStreak,
    membershipTier: user.membershipTier,
    spicyOrderCount,
    uniqueItemsOrdered: uniqueItemsOrdered.length,
    totalMenuItems,
    earnedBadges: user.badges.map((ub) => ({
      slug: ub.badge.slug,
      name: ub.badge.name,
      awardedAt: ub.awardedAt,
    })),
    progress,
  };
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
// WALLET PASS ENDPOINTS
// ====================

// Check wallet configuration status
app.get("/wallet/status", async (req, reply) => {
  return {
    apple: {
      configured: isAppleWalletConfigured(),
      message: isAppleWalletConfigured()
        ? "Apple Wallet is configured"
        : "Apple Wallet requires certificates. Demo mode available.",
    },
    google: {
      configured: isGoogleWalletConfigured(),
      message: isGoogleWalletConfigured()
        ? "Google Wallet is configured"
        : "Google Wallet requires service account. Demo mode available.",
    },
  };
});

// Generate Apple Wallet pass for a user
app.get("/users/:id/wallet/apple", async (req, reply) => {
  const { id } = req.params;
  const { demo } = req.query;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      membershipTier: true,
      creditsCents: true,
      lifetimeOrderCount: true,
      currentStreak: true,
      referralCode: true,
      createdAt: true,
    },
  });

  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  // If demo mode or certificates not configured, return demo data
  if (demo === "true" || !isAppleWalletConfigured()) {
    return generateDemoPassData(user);
  }

  try {
    const passBuffer = await generateAppleWalletPass(user);

    reply
      .header("Content-Type", "application/vnd.apple.pkpass")
      .header("Content-Disposition", `attachment; filename="oh-membership-${user.id}.pkpass"`)
      .send(passBuffer);
  } catch (error) {
    console.error("Error generating Apple Wallet pass:", error);
    return reply.code(500).send({
      error: "Failed to generate pass",
      message: error.message,
      hint: "Check that Apple Wallet certificates are properly configured",
    });
  }
});

// Generate Google Wallet pass link for a user
app.get("/users/:id/wallet/google", async (req, reply) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      membershipTier: true,
      creditsCents: true,
      lifetimeOrderCount: true,
      currentStreak: true,
      referralCode: true,
      createdAt: true,
    },
  });

  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  try {
    const walletData = await generateGoogleWalletLink(user);
    return walletData;
  } catch (error) {
    console.error("Error generating Google Wallet link:", error);
    return reply.code(500).send({
      error: "Failed to generate Google Wallet link",
      message: error.message,
    });
  }
});

// Get combined wallet pass data (for displaying in UI)
app.get("/users/:id/wallet", async (req, reply) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      membershipTier: true,
      creditsCents: true,
      lifetimeOrderCount: true,
      currentStreak: true,
      referralCode: true,
      createdAt: true,
    },
  });

  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      tier: user.membershipTier,
      credits: user.creditsCents,
      orders: user.lifetimeOrderCount,
      streak: user.currentStreak,
      referralCode: user.referralCode,
      memberSince: user.createdAt,
    },
    walletLinks: {
      apple: `/users/${id}/wallet/apple`,
      google: `/users/${id}/wallet/google`,
    },
    configured: {
      apple: isAppleWalletConfigured(),
      google: isGoogleWalletConfigured(),
    },
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

  // Only get parent orders (no child/add-on orders)
  // Child orders have a parentOrderId set
  const orders = await prisma.order.findMany({
    where: {
      userId: id,
      paymentStatus: "PAID", // Only show paid orders
      parentOrderId: null, // Exclude child/add-on orders
    },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      location: true,
      seat: true,
      // Include child orders (add-ons, refills, extra veg) with their items
      childOrders: {
        where: {
          paymentStatus: "PAID",
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
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
      // Active orders = QUEUED, PREPPING, READY, or SERVING
      where.status = { in: ["QUEUED", "PREPPING", "READY", "SERVING"] };
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
      user: {
        select: {
          id: true,
          name: true,
          membershipTier: true,
        },
      },
      guest: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc", // Oldest orders first
    },
  });

  return orders;
});

// Get pickup orders (orders without a seat) in SERVING status
app.get("/kitchen/pickup-orders", async (req, reply) => {
  const { locationId } = req.query || {};
  const tenantSlug = getTenantContext(req);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const where = {
    tenantId: tenant.id,
    paymentStatus: "PAID",
    status: "SERVING",
    seatId: null, // Only pickup orders (no seat assigned)
  };

  if (locationId) {
    where.locationId = locationId;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
      location: true,
      user: {
        select: {
          id: true,
          name: true,
          membershipTier: true,
        },
      },
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
  if (status === "SERVING") {
    data.deliveredAt = new Date();
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
      user: true,
    },
  });

  // Ensure pod status is synchronized with order status
  // Pod should be OCCUPIED for active orders (QUEUED through SERVING)
  if (order.seatId && ["QUEUED", "PREPPING", "READY", "SERVING"].includes(status)) {
    const currentSeat = order.seat;
    if (currentSeat && currentSeat.status !== "OCCUPIED") {
      console.log(`⚠️ Pod ${currentSeat.number} status was ${currentSeat.status}, correcting to OCCUPIED for order ${order.kitchenOrderNumber}`);
      await prisma.seat.update({
        where: { id: order.seatId },
        data: { status: "OCCUPIED" },
      });
    }
  }

  // When order is completed, release the pod and process queue
  if (status === "COMPLETED" && order.seatId) {
    console.log(`Order ${order.kitchenOrderNumber} completed, releasing pod ${order.seat?.number}`);

    // Mark pod as needs cleaning
    await prisma.seat.update({
      where: { id: order.seatId },
      data: { status: "CLEANING" },
    });

    // Note: Staff will mark pod as AVAILABLE via /seats/:id/clean
    // which will automatically trigger queue processing
  }

  // Award referral credit when order is COMPLETED (not just PAID)
  // This ensures the customer actually received and completed their meal
  if (status === "COMPLETED" && order.user?.referredById) {
    const user = order.user;

    // Check if this is their first COMPLETED order
    const completedOrderCount = await prisma.order.count({
      where: {
        userId: user.id,
        status: "COMPLETED",
      },
    });

    if (completedOrderCount === 1) {
      // This is their first completed order - check $20 minimum requirement
      const MINIMUM_ORDER_FOR_REFERRAL = 2000; // $20.00 in cents

      if (order.totalCents >= MINIMUM_ORDER_FOR_REFERRAL) {
        // Order meets minimum - credit referrer
        const referrer = await prisma.user.findUnique({
          where: { id: user.referredById },
        });

        if (referrer) {
          // Get referrer's tier benefits
          const tierBenefits = getTierBenefits(referrer.membershipTier);
          const referralBonus = tierBenefits.referralBonus;

          // Add credits to referrer's balance
          await prisma.user.update({
            where: { id: user.referredById },
            data: {
              creditsCents: { increment: referralBonus },
              tierProgressReferrals: { increment: 1 },
            },
          });

          // Create credit event for tracking
          await prisma.creditEvent.create({
            data: {
              userId: user.referredById,
              type: "REFERRAL_ORDER",
              amountCents: referralBonus,
              orderId: order.id,
              description: `Referral bonus - friend completed their first order`,
            },
          });

          // Check if referrer should be upgraded
          await checkTierUpgrade(user.referredById);

          console.log(`✅ Referral credit of $${referralBonus / 100} awarded to ${referrer.email} (order COMPLETED)`);
        }
      } else {
        console.log(`❌ Referral credit not awarded - order total $${order.totalCents / 100} below $20 minimum`);
      }
    }
  }

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
    podConfirmedAt: { not: null }, // Only count orders where customer has confirmed pod arrival
  };

  if (locationId) {
    where.locationId = locationId;
  }

  const [queued, prepping, ready, serving] = await Promise.all([
    prisma.order.count({ where: { ...where, status: "QUEUED" } }),
    prisma.order.count({ where: { ...where, status: "PREPPING" } }),
    prisma.order.count({ where: { ...where, status: "READY" } }),
    prisma.order.count({ where: { ...where, status: "SERVING" } }),
  ]);

  return {
    queued,
    prepping,
    ready,
    serving,
    total: queued + prepping + ready + serving,
  };
});

// GET /kitchen/average-processing-time - Get average time from QUEUED to SERVING for today
app.get("/kitchen/average-processing-time", async (req, reply) => {
  const { locationId } = req.query || {};
  const tenantSlug = getTenantContext(req);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  // Get start of today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const where = {
    tenantId: tenant.id,
    status: { in: ["SERVING", "COMPLETED"] }, // Orders that reached SERVING or are fully completed
    queuedAt: { not: null },
    deliveredAt: { not: null },
    createdAt: { gte: startOfToday }, // Orders from today
  };

  if (locationId) {
    where.locationId = locationId;
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      queuedAt: true,
      deliveredAt: true,
    },
  });

  if (orders.length === 0) {
    return { averageSeconds: 0, averageMinutes: 0, count: 0 };
  }

  // Calculate average processing time
  const totalSeconds = orders.reduce((sum, order) => {
    const queuedTime = new Date(order.queuedAt).getTime();
    const deliveredTime = new Date(order.deliveredAt).getTime();
    const diffSeconds = (deliveredTime - queuedTime) / 1000;
    return sum + diffSeconds;
  }, 0);

  const averageSeconds = Math.floor(totalSeconds / orders.length);
  const averageMinutes = averageSeconds / 60;

  return {
    averageSeconds,
    averageMinutes: parseFloat(averageMinutes.toFixed(2)),
    count: orders.length,
  };
});

// GET /cleaning/average-time - Get average cleaning time for today
app.get("/cleaning/average-time", async (req, reply) => {
  const { locationId } = req.query || {};
  const tenantSlug = getTenantContext(req);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  // Get start of today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const where = {
    tenantId: tenant.id,
    status: "COMPLETED",
    completedTime: { not: null },
    podCleanedAt: { not: null }, // Only count orders where cleaning has been completed
    createdAt: { gte: startOfToday }, // Orders from today
  };

  if (locationId) {
    where.locationId = locationId;
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      completedTime: true,
      podCleanedAt: true,
    },
  });

  if (orders.length === 0) {
    return { averageSeconds: 0, averageMinutes: 0, count: 0 };
  }

  // Calculate average cleaning time (from COMPLETED to pod cleaned)
  const totalSeconds = orders.reduce((sum, order) => {
    const completedTime = new Date(order.completedTime).getTime();
    const cleanedTime = new Date(order.podCleanedAt).getTime();
    const diffSeconds = (cleanedTime - completedTime) / 1000;
    return sum + diffSeconds;
  }, 0);

  const averageSeconds = Math.floor(totalSeconds / orders.length);
  const averageMinutes = averageSeconds / 60;

  return {
    averageSeconds,
    averageMinutes: parseFloat(averageMinutes.toFixed(2)),
    count: orders.length,
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
      perks: [
        "referralBonus",
        "cashback1",
        "earlyAccess",
      ],
    },
    NOODLE_MASTER: {
      referralBonus: 500,
      cashbackPercent: 2,
      perks: [
        "referralBonus",
        "cashback2",
        "prioritySeating",
        "memberEvents",
        "freeBowlUpgrade",
      ],
    },
    BEEF_BOSS: {
      referralBonus: 500,
      cashbackPercent: 3,
      perks: [
        "referralBonus",
        "cashback3",
        "merchandiseDrops",
        "premiumAddons",
        "vipGift",
      ],
    },
  };
  return benefits[tier];
}

function getNextTier(currentTier) {
  const tiers = {
    CHOPSTICK: { next: "NOODLE_MASTER", ordersNeeded: 10, referralsNeeded: 5 },
    NOODLE_MASTER: { next: "BEEF_BOSS", ordersNeeded: 25, referralsNeeded: 10 },
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

  // Check for upgrades (requires BOTH orders AND referrals)
  if (user.membershipTier === "CHOPSTICK") {
    if (user.tierProgressOrders >= 10 && user.tierProgressReferrals >= 5) {
      newTier = "NOODLE_MASTER";
    }
  } else if (user.membershipTier === "NOODLE_MASTER") {
    if (user.tierProgressOrders >= 25 && user.tierProgressReferrals >= 10) {
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

    // Check OG Member badge (users who signed up before launch)
    const LAUNCH_DATE = new Date("2025-03-01");
    if (badge.slug === "grand-opening" && user.createdAt <= LAUNCH_DATE)
      shouldAward = true;

    // Check Heat Seeker badge (ordered spicy 10+ times)
    if (badge.slug === "spicy-challenge") {
      const spicyOrderCount = await prisma.orderItem.count({
        where: {
          order: { userId, paymentStatus: "PAID" },
          menuItem: { name: { contains: "Spice", mode: "insensitive" } },
          selectedValue: { in: ["Spicy", "Extra Spicy", "Hot", "Extra Hot"] },
        },
      });
      if (spicyOrderCount >= 10) shouldAward = true;
    }

    // Check Menu Master badge (tried all menu items)
    if (badge.slug === "tried-all-items") {
      // Get unique menu items ordered by this user
      const uniqueItemsOrdered = await prisma.orderItem.findMany({
        where: {
          order: { userId, paymentStatus: "PAID" },
          menuItem: {
            categoryType: { in: ["MAIN", "ADDON", "SIDE", "DRINK", "DESSERT"] },
            isAvailable: true,
          },
        },
        distinct: ["menuItemId"],
        select: { menuItemId: true },
      });

      // Get total active menu items (excluding sliders)
      const totalMenuItems = await prisma.menuItem.count({
        where: {
          isAvailable: true,
          categoryType: { in: ["MAIN", "ADDON", "SIDE", "DRINK", "DESSERT"] },
        },
      });

      if (uniqueItemsOrdered.length >= totalMenuItems && totalMenuItems > 0) {
        shouldAward = true;
      }
    }

    // Check Lunch Regular badge (ordered during lunch hours 11am-2pm 10 times)
    if (badge.slug === "lunch-regular") {
      const lunchOrders = await prisma.order.count({
        where: {
          userId,
          paymentStatus: "PAID",
          createdAt: {
            // This is a simplified check - in production you'd use a more sophisticated time query
          },
        },
      });
      // For now, count orders and check hour in application
      const allOrders = await prisma.order.findMany({
        where: { userId, paymentStatus: "PAID" },
        select: { createdAt: true },
      });
      const lunchCount = allOrders.filter((o) => {
        const hour = new Date(o.createdAt).getHours();
        return hour >= 11 && hour < 14;
      }).length;
      if (lunchCount >= 10) shouldAward = true;
    }

    // Check Night Owl badge (ordered after 8pm 5 times)
    if (badge.slug === "night-owl") {
      const allOrders = await prisma.order.findMany({
        where: { userId, paymentStatus: "PAID" },
        select: { createdAt: true },
      });
      const nightCount = allOrders.filter((o) => {
        const hour = new Date(o.createdAt).getHours();
        return hour >= 20;
      }).length;
      if (nightCount >= 5) shouldAward = true;
    }

    // Check Big Spender badge (spent over $500 lifetime)
    if (badge.slug === "big-spender") {
      if (user.lifetimeSpentCents >= 50000) shouldAward = true; // $500 = 50000 cents
    }

    // Check Generous Soul badge (referred 3 friends who ordered)
    if (badge.slug === "generous-soul") {
      const successfulReferrals = await prisma.user.count({
        where: { referredById: userId, lifetimeOrderCount: { gt: 0 } },
      });
      if (successfulReferrals >= 3) shouldAward = true;
    }

    // Check Pod Explorer badge (dined in 5 different pods)
    if (badge.slug === "pod-explorer") {
      const uniquePods = await prisma.order.findMany({
        where: { userId, paymentStatus: "PAID", seatId: { not: null } },
        distinct: ["seatId"],
        select: { seatId: true },
      });
      if (uniquePods.length >= 5) shouldAward = true;
    }

    // Check Quick Return badge (ordered again within 24 hours)
    if (badge.slug === "quick-return") {
      const orders = await prisma.order.findMany({
        where: { userId, paymentStatus: "PAID" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      for (let i = 1; i < orders.length; i++) {
        const diff = new Date(orders[i].createdAt).getTime() - new Date(orders[i - 1].createdAt).getTime();
        if (diff <= 24 * 60 * 60 * 1000) {
          // 24 hours in milliseconds
          shouldAward = true;
          break;
        }
      }
    }

    // Check VIP badge (reached Beef Boss tier)
    if (badge.slug === "vip" && user.membershipTier === "BEEF_BOSS") {
      shouldAward = true;
    }

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

// Update challenge progress after order completion
async function updateChallengeProgress(userId, orderData) {
  // Get user's active challenge enrollments
  const userChallenges = await prisma.userChallenge.findMany({
    where: {
      userId,
      completedAt: null, // Only incomplete challenges
    },
    include: {
      challenge: true,
    },
  });

  const now = new Date();

  for (const userChallenge of userChallenges) {
    // Skip if challenge is missing or not active
    if (!userChallenge.challenge) continue;
    if (!userChallenge.challenge.isActive) continue;

    // Skip if challenge hasn't started yet
    if (userChallenge.challenge.startsAt && userChallenge.challenge.startsAt > now) continue;

    const requirements = userChallenge.challenge.requirements;
    const progress = userChallenge.progress || { current: 0 };
    let newCurrent = progress.current;
    let completed = false;

    // Handle different requirement types
    switch (requirements.type) {
      case "order_count":
        // Increment order count
        newCurrent = progress.current + 1;
        completed = newCurrent >= requirements.target;
        break;

      case "spend_amount":
        // Track spending in cents
        newCurrent = progress.current + (orderData.totalCents || 0);
        completed = newCurrent >= requirements.target;
        break;

      case "order_streak":
        // This is handled by streak logic elsewhere, just check current streak
        const user = await prisma.user.findUnique({ where: { id: userId } });
        newCurrent = user?.currentStreak || 0;
        completed = newCurrent >= requirements.target;
        break;

      case "specific_item":
        // Check if order contains specific menu item
        if (orderData.items?.some(item => item.menuItemId === requirements.menuItemId)) {
          newCurrent = progress.current + 1;
          completed = newCurrent >= (requirements.target || 1);
        }
        break;

      case "category_orders":
        // Check if order contains items from specific category
        if (orderData.items?.some(item => item.categoryType === requirements.categoryType)) {
          newCurrent = progress.current + 1;
          completed = newCurrent >= requirements.target;
        }
        break;

      default:
        // Generic order-based progress
        newCurrent = progress.current + 1;
        completed = newCurrent >= (requirements.target || 1);
    }

    // Update progress
    const updateData = {
      progress: { ...progress, current: newCurrent },
      updatedAt: new Date(),
    };

    if (completed) {
      updateData.completedAt = new Date();
    }

    await prisma.userChallenge.update({
      where: { id: userChallenge.id },
      data: updateData,
    });

    if (completed) {
      console.log(`🎯 Challenge completed: ${userChallenge.challenge.name} by user ${userId}`);
    }
  }
}

// ====================
// BACKGROUND JOBS
// ====================

// Release expired pod reservations
// Runs every minute to check for reservations that have passed their 15-minute expiry
// (advertised as 10 min to customers, with 5 min grace period)
async function releaseExpiredReservations() {
  const now = new Date();

  try {
    // Find orders with expired reservations that haven't checked in yet
    const expiredOrders = await prisma.order.findMany({
      where: {
        podReservationExpiry: { lt: now },
        arrivedAt: null, // Customer hasn't checked in
        seatId: { not: null },
        status: "QUEUED", // Still waiting
      },
      include: {
        seat: true,
        user: true,
      },
    });

    for (const order of expiredOrders) {
      if (order.seat && order.seat.status === "RESERVED") {
        const releasedPodNumber = order.seat.number;
        console.log(`⏰ Reservation expired for order ${order.kitchenOrderNumber}, releasing pod ${releasedPodNumber}`);

        // Release the seat
        await prisma.seat.update({
          where: { id: order.seatId },
          data: { status: "AVAILABLE" },
        });

        // Clear the seat assignment and mark pod as released
        await prisma.order.update({
          where: { id: order.id },
          data: {
            seatId: null,
            podSelectionMethod: null,
            podReservationExpiry: null,
            podReleasedAt: now, // Track when pod was released
            podReleasedNumber: releasedPodNumber, // Track which pod was released
          },
        });

        // TODO: Send email notification to customer about pod release
        // For now, log the notification that should be sent
        if (order.user?.email) {
          console.log(`📧 [EMAIL] Would notify ${order.user.email}: Your reserved Pod ${releasedPodNumber} has been released because you didn't arrive within 10 minutes. You'll be assigned a new pod when you check in.`);
        }

        // Process queue for this location to potentially assign the now-available pod
        await processQueue(order.locationId);
      }
    }

    if (expiredOrders.length > 0) {
      console.log(`⏰ Released ${expiredOrders.length} expired pod reservation(s)`);
    }
  } catch (error) {
    console.error("Error releasing expired reservations:", error);
  }
}

// Run reservation cleanup every minute
setInterval(releaseExpiredReservations, 60 * 1000);

// Synchronize pod statuses with order statuses (fixes inconsistencies on startup)
async function synchronizePodStatuses() {
  try {
    console.log("🔄 Checking for pod/order status inconsistencies...");

    // Find orders in active states (QUEUED through SERVING) with pods that aren't OCCUPIED
    const activeOrders = await prisma.order.findMany({
      where: {
        status: { in: ["QUEUED", "PREPPING", "READY", "SERVING"] },
        seatId: { not: null },
      },
      include: {
        seat: true,
      },
    });

    let fixedCount = 0;
    for (const order of activeOrders) {
      if (order.seat && order.seat.status !== "OCCUPIED") {
        console.log(`⚠️ Fixing: Pod ${order.seat.number} was ${order.seat.status}, correcting to OCCUPIED for order ${order.kitchenOrderNumber} (status: ${order.status})`);
        await prisma.seat.update({
          where: { id: order.seatId },
          data: { status: "OCCUPIED" },
        });
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      console.log(`✅ Fixed ${fixedCount} pod status inconsistencies`);
    } else {
      console.log("✅ No pod status inconsistencies found");
    }
  } catch (error) {
    console.error("Error synchronizing pod statuses:", error);
  }
}

// ====================
// FORTUNE COOKIE
// ====================

// Get "This Day in History" facts - AI-powered, always fresh
async function getThisDayInHistory(anthropic, language = { name: "English", instruction: "Write in English." }) {
  const today = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const todayStr = `${monthNames[today.getMonth()]} ${today.getDate()}`;

  // Always use AI if available for fresh, unique facts
  if (anthropic) {
    try {
      // Use unique seed to ensure different facts each time
      const uniqueSeed = Date.now();

      const prompt = `You are a history expert. Tell me ONE interesting historical event that happened on ${todayStr} (any year in history).

LANGUAGE: ${language.instruction}

REQUIREMENTS:
- Must be a REAL historical event that actually happened on ${todayStr}
- Pick something unexpected, surprising, or little-known - NOT the most famous event for this date
- Vary the type: could be science, art, politics, sports, culture, invention, birth, discovery, etc.
- Include the specific year
- Write the event description in ${language.name}

UNIQUE SEED: ${uniqueSeed} (use this to vary your selection - don't repeat the same event)

Return ONLY valid JSON in this exact format (no markdown):
{"year":1234,"event":"Brief description of what happened in ${language.name}"}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        temperature: 0.9,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText = message.content[0]?.text?.trim();
      const parsed = JSON.parse(responseText);

      if (parsed.year && parsed.event) {
        return { year: parsed.year, event: parsed.event };
      }
    } catch (error) {
      console.error("AI history generation failed:", error);
    }
  }

  // Simple fallback - won't be used if AI is available
  return { year: 2024, event: `Something interesting happened on ${todayStr}! Check back for AI-powered facts.` };
}

// Generate lucky numbers - TRUE random, never repeated
function generateLuckyNumbers() {
  const numbers = [];
  const used = new Set();

  while (numbers.length < 6) {
    // Generate cryptographically random number 1-49
    const randomBytes = crypto.randomBytes(1);
    const num = (randomBytes[0] % 49) + 1;

    if (!used.has(num)) {
      used.add(num);
      numbers.push(num);
    }
  }

  return numbers.sort((a, b) => a - b);
}

// Fallback Chinese words for Learn Chinese feature
const fallbackChineseWords = [
  {
    traditional: "牛肉麵",
    pinyin: "niú ròu miàn",
    english: "Beef Noodle Soup",
    category: "food",
    funFact: "Taiwan's national comfort food! There's even an annual beef noodle soup festival.",
  },
  {
    traditional: "好吃",
    pinyin: "hǎo chī",
    english: "Delicious",
    category: "food",
    funFact: "Literally means 'good eat' - use it to compliment any meal!",
  },
  {
    traditional: "謝謝",
    pinyin: "xiè xiè",
    english: "Thank you",
    category: "essential",
    funFact: "One of the most useful phrases - works everywhere in Chinese-speaking areas.",
  },
  {
    traditional: "加油",
    pinyin: "jiā yóu",
    english: "Keep going! / You can do it!",
    category: "encouragement",
    funFact: "Literally means 'add oil' - shouted at sports events and to encourage friends.",
  },
  {
    traditional: "乾杯",
    pinyin: "gān bēi",
    english: "Cheers! (Bottoms up)",
    category: "social",
    funFact: "Literally means 'dry cup' - finish your drink when you say this!",
  },
  {
    traditional: "厲害",
    pinyin: "lì hài",
    english: "Awesome / Impressive",
    category: "slang",
    funFact: "Use this when someone does something cool - very common in casual speech.",
  },
  {
    traditional: "辣",
    pinyin: "là",
    english: "Spicy",
    category: "food",
    funFact: "If you ordered extra spicy, you'll definitely need this word!",
  },
  {
    traditional: "飽了",
    pinyin: "bǎo le",
    english: "I'm full",
    category: "food",
    funFact: "The polite way to say you've had enough food - very useful at big dinners!",
  },
  {
    traditional: "朋友",
    pinyin: "péng yǒu",
    english: "Friend",
    category: "social",
    funFact: "Call someone péngyou and you've just made them feel welcome.",
  },
  {
    traditional: "緣分",
    pinyin: "yuán fèn",
    english: "Fate / Destiny (that brings people together)",
    category: "culture",
    funFact: "A beautiful concept - the destined connection between people who meet.",
  },
  {
    traditional: "福",
    pinyin: "fú",
    english: "Good fortune / Blessing",
    category: "culture",
    funFact: "Often hung upside down on doors because 'upside down' sounds like 'arrived' in Chinese!",
  },
  {
    traditional: "龍",
    pinyin: "lóng",
    english: "Dragon",
    category: "culture",
    funFact: "In Chinese culture, dragons are symbols of power, luck, and prosperity - not scary monsters!",
  },
];

// Generate AI-powered Chinese word - always unique, never repeating
async function generateChineseWord(anthropic) {
  if (!anthropic) return null;

  try {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const uniqueSeed = Date.now(); // Ensures unique word each time

    // Categories to cycle through for variety
    const categories = [
      "food and cooking (ingredients, cooking methods, flavors)",
      "emotions and feelings",
      "nature and weather",
      "internet slang and modern expressions",
      "traditional culture and customs",
      "travel and places",
      "relationships and social interactions",
      "work and business",
      "health and body",
      "time and seasons",
      "animals and creatures",
      "music, art, and entertainment",
      "technology and innovation",
      "sports and hobbies",
      "philosophy and wisdom",
    ];
    const categoryIndex = Math.floor(uniqueSeed / 1000) % categories.length;
    const focusCategory = categories[categoryIndex];

    const prompt = `You are a Chinese language teacher at a beef noodle soup restaurant. Generate ONE unique Chinese word or phrase.

TODAY: ${today}
FOCUS CATEGORY: ${focusCategory}
UNIQUE SEED: ${uniqueSeed}

REQUIREMENTS:
- Pick a word from the "${focusCategory}" category that you haven't used before
- Use TRADITIONAL Chinese characters (Taiwan style, NOT simplified)
- Include proper pinyin with tone marks (ā, á, ǎ, à, ē, é, ě, è, ī, í, ǐ, ì, ō, ó, ǒ, ò, ū, ú, ǔ, ù, ǖ, ǘ, ǚ, ǜ)
- 1-4 characters only
- Make it practical and memorable
- Fun fact should explain usage or cultural context

AVOID these common words: 你好, 謝謝, 好吃, 牛肉麵, 加油, 乾杯

Return ONLY valid JSON (no markdown):
{"traditional":"字","pinyin":"zì","english":"English meaning","category":"${focusCategory.split(' ')[0]}","funFact":"Engaging fact about this word"}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      temperature: 0.95, // High temperature for variety
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0]?.text?.trim();
    const parsed = JSON.parse(responseText);

    if (parsed.traditional && parsed.pinyin && parsed.english) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("AI Chinese word generation failed:", error);
    return null;
  }
}

// Fallback fortunes - modern, punchy, screenshot-worthy
const fallbackFortunes = [
  // Delightfully Weird
  "Somewhere, a door is opening for you. It might be a fridge. Start there.",
  "The universe is rearranging itself around your next decision. No pressure.",
  "A stranger will compliment something you almost didn't wear today.",
  "Something you planted and forgot about is about to bloom.",
  "The chaos is not random. Pay attention.",

  // Aspirational but Real
  "The room you're afraid to walk into? They're going to love you in there.",
  "Your next level will require a version of you that doesn't exist yet. Start building them.",
  "The hardest part is almost over. The best part is almost beginning.",
  "Stop asking if you're ready. Start asking if you're willing.",
  "You've survived every bad day so far. The odds are in your favor.",

  // Playfully Cryptic
  "Something lucky happened today. You just haven't noticed it yet.",
  "A small yes will lead to a big yes. Say yes.",
  "Someone is about to pleasantly surprise you. It might be yourself.",
  "The thing you're putting off? It's easier than you think.",
  "Your intuition already texted you the answer. Stop leaving it on read.",

  // Gently Provocative
  "Your backup plan is blocking your main character energy.",
  "The right people won't need the full explanation.",
  "Some chapters don't need to end gracefully. They just need to end.",
  "Rest is not a reward. It's a prerequisite.",
  "Stop romanticizing who you were. Start meeting who you're becoming.",
];

// Generate fortune cookie for an order
app.get("/orders/fortune", async (req, reply) => {
  const { orderQrCode, orderId, locale = "en" } = req.query || {};

  if (!orderQrCode && !orderId) {
    return reply.status(400).send({ error: "Order QR code or ID required" });
  }

  // Determine language for content generation
  const languageMap = {
    "en": { name: "English", instruction: "Write in English." },
    "zh-TW": { name: "Traditional Chinese", instruction: "Write in Traditional Chinese (繁體中文). Use natural, fluent Traditional Chinese." },
    "zh-CN": { name: "Simplified Chinese", instruction: "Write in Simplified Chinese (简体中文). Use natural, fluent Simplified Chinese." },
    "es": { name: "Spanish", instruction: "Write in Spanish (Español). Use natural, fluent Spanish." },
  };
  const language = languageMap[locale] || languageMap["en"];
  const isChineseLocale = locale === "zh-TW" || locale === "zh-CN";

  try {
    // Find the order
    const order = await prisma.order.findFirst({
      where: orderQrCode
        ? { orderQrCode }
        : { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            menuItem: true,
          },
        },
        seat: true,
        location: true,
      },
    });

    if (!order) {
      return reply.status(404).send({ error: "Order not found" });
    }

    // Get user's name (first name only for personalization)
    const firstName = order.user?.name?.split(" ")[0] || order.guestName?.split(" ")[0] || null;

    // Get order details for personalization
    const itemNames = order.items.map(item => item.menuItem?.name || item.name).filter(Boolean);
    const mainItem = itemNames[0] || "noodles";

    // Get user's tier if available
    const tier = order.user?.membershipTier || "CHOPSTICK";

    // Generate truly random lucky numbers (crypto-based)
    const luckyNumbers = generateLuckyNumbers();

    // Get AI-generated historical fact for today
    const historyFact = await getThisDayInHistory(anthropic, language);

    // Try to generate AI fortune if API key is available
    let fortune = null;
    let source = "ai";

    if (anthropic) {
      try {
        // Session-based creativity seed - changes every 30 seconds to ensure unique fortunes
        const creativitySeed = Math.floor(Date.now() / 30000);
        const styleOptions = [
          "DELIGHTFULLY WEIRD - Unexpected, slightly surreal, makes them smile-laugh",
          "COSMIC ABSURDIST - Philosophical but with a wink, like the universe is in on a joke",
          "MAIN CHARACTER ENERGY - Aspirational without being cheesy, you're the protagonist",
          "CRYPTIC POET - Intriguing, makes them pause and screenshot it",
          "GENTLY UNHINGED - Sounds profound until you think about it, then it's profoundly weird",
          "LATE-NIGHT WISDOM - The kind of thought you have at 2am that actually makes sense",
          "MILLENNIAL MYSTIC - Spiritual but make it relatable, tarot-meets-therapy energy",
        ];
        const currentStyle = styleOptions[creativitySeed % styleOptions.length];

        // Unique elements to incorporate
        const themes = ["time", "doors", "strangers", "decisions", "silence", "algorithms", "mirrors", "messages", "dreams", "instincts", "chaos", "beginnings"];
        const theme1 = themes[creativitySeed % themes.length];
        const theme2 = themes[(creativitySeed + 3) % themes.length];

        const prompt = `You are a VIRAL fortune cookie writer. Your fortunes are the kind people screenshot, share, and think about for days. NOT about food or restaurants. These are REAL fortunes about LIFE that feel almost eerily personal.

LANGUAGE: ${language.instruction}

CURRENT VIBE: ${currentStyle}

WEAVE IN THESE THEMES: ${theme1}, ${theme2}

${firstName ? `PERSONALIZE FOR: ${firstName} (use their name naturally if it fits, but don't force it)` : ""}

STYLE EXAMPLES (for inspiration, NEVER copy these exactly - translate the vibe, not the words):
- "Someone is thinking about you right now. They're wrong about everything, but still."
- "The algorithm knows something about you that you haven't figured out yet."
- "That thing you almost said? You should have said it. Next time."
- "A parallel universe version of you just made the choice you're scared of. They're fine."
- "Your next spontaneous decision will turn out to be the right one."
- "Someone you haven't met yet will change everything. Wear that outfit."
- "The thing you're procrastinating? It's procrastinating you back. Stalemate."
- "An ending you're dreading is actually a beginning wearing a disguise."

REQUIREMENTS:
- ONE sentence, under 100 characters ideal (or equivalent length in target language)
- Must feel PERSONALLY RELEVANT to whoever reads it
- Modern language appropriate for the target culture
- Should make them pause and think "...wait, how did they know?"
- NO generic platitudes, NO fortune cookie cliches
- Be bold, be specific, be memorable
- Temperature: HIGH creativity, surprise me
- MUST be written entirely in ${language.name}

UNIQUE SEED: ${creativitySeed}-${Date.now() % 10000}

Write ONE completely original fortune in ${language.name}. Return ONLY the fortune text. No quotes.`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 100,
          temperature: 0.95,
          messages: [{ role: "user", content: prompt }],
        });

        fortune = message.content[0]?.text?.trim();
      } catch (aiError) {
        console.error("AI fortune generation failed:", aiError);
        source = "fallback";
      }
    } else {
      source = "fallback";
    }

    // Use fallback if AI didn't work
    if (!fortune) {
      fortune = fallbackFortunes[Math.floor(Math.random() * fallbackFortunes.length)];
    }

    // Generate Learn Chinese word - skip for Chinese locales (they already know Chinese!)
    let chineseWord = null;
    let chineseWordSource = "ai";

    if (!isChineseLocale) {
      // Try AI-generated word first
      if (anthropic) {
        chineseWord = await generateChineseWord(anthropic);
      }

      // Fall back to curated list if AI fails
      if (!chineseWord) {
        chineseWord = fallbackChineseWords[Math.floor(Math.random() * fallbackChineseWords.length)];
        chineseWordSource = "fallback";
      }
    }

    return reply.send({
      fortune,
      luckyNumbers,
      thisDayInHistory: historyFact ? {
        year: historyFact.year,
        event: historyFact.event,
      } : null,
      learnChinese: chineseWord ? {
        traditional: chineseWord.traditional,
        pinyin: chineseWord.pinyin,
        english: chineseWord.english,
        category: chineseWord.category,
        funFact: chineseWord.funFact,
        source: chineseWordSource,
      } : null,
      source,
      orderNumber: order.kitchenOrderNumber || order.orderNumber?.slice(-6),
      customerName: firstName,
    });
  } catch (error) {
    console.error("Error generating fortune:", error);
    // Return a fallback fortune instead of 500 error
    const fallbackFortune = fallbackFortunes[Math.floor(Math.random() * fallbackFortunes.length)];
    const fallbackWord = fallbackChineseWords[Math.floor(Math.random() * fallbackChineseWords.length)];
    return reply.send({
      fortune: fallbackFortune,
      luckyNumbers: [Math.floor(Math.random() * 99) + 1, Math.floor(Math.random() * 99) + 1, Math.floor(Math.random() * 99) + 1],
      thisDayInHistory: null,
      learnChinese: fallbackWord ? {
        traditional: fallbackWord.traditional,
        pinyin: fallbackWord.pinyin,
        english: fallbackWord.english,
        category: fallbackWord.category,
        funFact: fallbackWord.funFact,
        source: "fallback",
      } : null,
      source: "fallback",
      isFallback: true,
    });
  }
});

// Fallback roasts for when AI is unavailable
const fallbackRoasts = {
  en: [
    "We analyzed your order and determined you have... opinions. Strong ones.",
    "Your order tells a story. We're not sure what story, but it's definitely a story.",
    "The kitchen looked at your order and said 'interesting choice.' That's a compliment. Probably.",
    "Your customizations suggest you've either been here before or you're a culinary rebel. Either way, respect.",
    "This order screams 'I know what I want' — or possibly 'I just hit random buttons.' We may never know.",
    "Based on your order, our AI concluded: you're definitely a human who eats food.",
    "Your choices today are being entered into our database of 'unique individuals.'",
    "Somewhere, a chef is looking at this order and nodding appreciatively. Or laughing. One of those.",
  ],
  "zh-TW": [
    "我們分析了你的點餐，結論是...你很有主見。非常有主見。",
    "你的點餐講述了一個故事。我們不確定是什麼故事，但絕對是個故事。",
    "廚房看了你的點餐說「有趣的選擇」。這是稱讚。大概吧。",
    "你的客製化選擇顯示你要嘛來過這裡，要嘛是個料理叛逆者。無論如何，敬佩。",
    "這份點餐在大喊「我知道我要什麼」——或者「我只是隨便亂點」。我們永遠不會知道。",
    "根據你的點餐，我們的AI得出結論：你絕對是個會吃東西的人類。",
    "你今天的選擇已被記錄到我們的「獨特個體」資料庫中。",
    "某處有位廚師正看著這份點餐讚賞地點頭。或者在笑。兩者之一。",
  ],
  "zh-CN": [
    "我们分析了你的点餐，结论是...你很有主见。非常有主见。",
    "你的点餐讲述了一个故事。我们不确定是什么故事，但绝对是个故事。",
    "厨房看了你的点餐说「有趣的选择」。这是称赞。大概吧。",
    "你的定制选择显示你要么来过这里，要么是个料理叛逆者。无论如何，敬佩。",
    "这份点餐在大喊「我知道我要什么」——或者「我只是随便乱点」。我们永远不会知道。",
    "根据你的点餐，我们的AI得出结论：你绝对是个会吃东西的人类。",
    "你今天的选择已被记录到我们的「独特个体」数据库中。",
    "某处有位厨师正看着这份点餐赞赏地点头。或者在笑。两者之一。",
  ],
  es: [
    "Analizamos tu pedido y determinamos que tienes... opiniones. Muy fuertes.",
    "Tu pedido cuenta una historia. No estamos seguros de cuál, pero definitivamente es una historia.",
    "La cocina vio tu pedido y dijo 'elección interesante'. Eso es un cumplido. Probablemente.",
    "Tus personalizaciones sugieren que has estado aquí antes o eres un rebelde culinario. De cualquier manera, respeto.",
    "Este pedido grita 'sé lo que quiero' — o posiblemente 'solo presioné botones al azar'. Nunca lo sabremos.",
    "Según tu pedido, nuestra IA concluyó: definitivamente eres un humano que come comida.",
    "Tus elecciones de hoy están siendo registradas en nuestra base de datos de 'individuos únicos'.",
    "En algún lugar, un chef está mirando este pedido y asintiendo con aprecio. O riéndose. Una de las dos.",
  ],
};

// Helper to get localized fallback roasts
function getLocalizedFallbackRoast(locale, firstName) {
  const roasts = fallbackRoasts[locale] || fallbackRoasts.en;
  let roast = roasts[Math.floor(Math.random() * roasts.length)];
  if (firstName) {
    roast = `${firstName}, ` + roast.charAt(0).toLowerCase() + roast.slice(1);
  }
  return roast;
}

// Generate sarcastic order roast/analysis - DEEPLY PERSONALIZED
app.get("/orders/roast", async (req, reply) => {
  const { orderQrCode, orderId } = req.query || {};
  const locale = getLocale(req);
  const languageInstruction = getLanguageInstruction(locale);

  if (!orderQrCode && !orderId) {
    return reply.status(400).send({ error: "Order QR code or ID required" });
  }

  try {
    // Find the order with detailed items
    const order = await prisma.order.findFirst({
      where: orderQrCode
        ? { orderQrCode }
        : { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            menuItem: true,
          },
        },
        seat: true,
        location: true,
      },
    });

    if (!order) {
      return reply.status(404).send({ error: "Order not found" });
    }

    // Get user's name
    const firstName = order.user?.name?.split(" ")[0] || order.guestName?.split(" ")[0] || null;

    // Use the comprehensive buildOrderSummary helper
    const summary = buildOrderSummary(order);

    // Build hyper-specific roastable insights from the full order
    const roastInsights = [];

    // BOWL CONFIG ROASTS
    if (summary.mainDish) {
      roastInsights.push(`BOWL: ${summary.mainDish}`);
    }

    // Note: No separate protein selection - the soup type includes the protein (e.g., "A5 Wagyu Beef Noodle Soup")

    if (summary.noodleType) {
      const noodleRoast = summary.noodleType.toLowerCase().includes("no noodle")
        ? `chose NO NOODLES - came to a noodle shop and said "hold the noodles." Iconic.`
        : summary.noodleType.toLowerCase().includes("ramen")
        ? `went with RAMEN noodles - classic choice, nothing wrong with playing it safe`
        : summary.noodleType.toLowerCase().includes("shaved")
        ? `chose SHAVED NOODLES - a person of culture who knows the good stuff`
        : summary.noodleType.toLowerCase().includes("wide")
        ? `picked WIDE NOODLES - likes something substantial to slurp, we respect that`
        : `NOODLE TYPE: ${summary.noodleType}`;
      roastInsights.push(noodleRoast);
    }

    // TEXTURE/RICHNESS/SPICE ROASTS (the sliders are goldmines)
    if (summary.noodleTexture !== null) {
      const textureVal = String(summary.noodleTexture);
      if (textureVal === "0" || textureVal.toLowerCase() === "firm") {
        roastInsights.push(`FIRM noodles - al dente perfectionist who will absolutely know if we mess this up`);
      } else if (textureVal === "2" || textureVal.toLowerCase() === "soft") {
        roastInsights.push(`SOFT noodles - prefers the pre-chewed experience, no judgment (okay, a little)`);
      } else {
        roastInsights.push(`MEDIUM texture - diplomatically avoiding noodle controversy`);
      }
    }

    if (summary.soupRichness !== null) {
      const richnessVal = String(summary.soupRichness);
      if (richnessVal === "0" || richnessVal.toLowerCase().includes("light")) {
        roastInsights.push(`LIGHT soup - treating our 12-hour broth like it's a diet drink`);
      } else if (richnessVal === "2" || richnessVal === "3" || richnessVal.toLowerCase().includes("rich") || richnessVal.toLowerCase().includes("extra")) {
        roastInsights.push(`EXTRA RICH soup - came here for a broth baptism, not a light snack`);
      } else {
        roastInsights.push(`REGULAR richness - trusting the chef's vision, respectable`);
      }
    }

    if (summary.spiceLevel !== null) {
      const spiceVal = String(summary.spiceLevel);
      if (spiceVal === "0" || spiceVal.toLowerCase() === "none") {
        roastInsights.push(`ZERO SPICE - their taste buds are in witness protection`);
      } else if (spiceVal === "1" || spiceVal.toLowerCase() === "mild") {
        roastInsights.push(`MILD spice - dipping a toe in, commitment issues with heat`);
      } else if (spiceVal === "3" || spiceVal === "4" || spiceVal.toLowerCase().includes("extra") || spiceVal.toLowerCase().includes("hot")) {
        roastInsights.push(`MAXIMUM SPICE - either has something to prove or no nerve endings left`);
      }
    }

    // SKIPPED TOPPINGS (people who say no to free stuff are fascinating)
    if (summary.skippedToppings.length > 0) {
      const skipped = summary.skippedToppings.map(t => t.replace("Amount", "").replace("Level", "").trim());
      if (skipped.length >= 3) {
        roastInsights.push(`SKIPPED ${skipped.length} TOPPINGS (${skipped.join(", ")}) - running an elimination diet or just has trust issues with vegetables`);
      } else {
        roastInsights.push(`Said NO to: ${skipped.join(", ")} - these ingredients personally offended them`);
      }
    }

    // EXTRAS (people who want MORE are committed)
    if (summary.extras.length > 0) {
      const extras = summary.extras.map(e => e.replace("Amount", "").replace("Level", "").trim());
      roastInsights.push(`Demanded EXTRA: ${extras.join(", ")} - knows exactly what they want and isn't afraid to ask`);
    }

    // ADD-ONS (the upsells reveal personality)
    if (summary.addons.length > 0) {
      const addonNames = summary.addons.map(a => `${a.name}${a.quantity > 1 ? ` x${a.quantity}` : ""}`);
      const addonTotal = summary.addons.reduce((sum, a) => sum + a.quantity, 0);
      if (addonTotal >= 3) {
        roastInsights.push(`LOADED UP with ${addonTotal} add-ons (${addonNames.join(", ")}) - treating this bowl like a project, not a meal`);
      } else {
        roastInsights.push(`ADD-ONS: ${addonNames.join(", ")} - couldn't resist the extras, we get it`);
      }
    }

    // SIDES (ordering sides at a noodle place says a lot)
    if (summary.sides.length > 0) {
      const sideNames = summary.sides.map(s => `${s.name}${s.quantity > 1 ? ` x${s.quantity}` : ""}`);
      roastInsights.push(`Also ordered SIDES: ${sideNames.join(", ")} - apparently one bowl of noodles wasn't enough carbs`);
    }

    // DRINKS (beverage choices are character)
    if (summary.drinks.length > 0) {
      const drinkNames = summary.drinks.map(d => `${d.name}${d.quantity > 1 ? ` x${d.quantity}` : ""}`);
      roastInsights.push(`DRINKS: ${drinkNames.join(", ")} - proper hydration for the noodle journey ahead`);
    }

    // DESSERTS (the sweet tooth reveal)
    if (summary.desserts.length > 0) {
      const dessertNames = summary.desserts.map(d => `${d.name}${d.quantity > 1 ? ` x${d.quantity}` : ""}`);
      roastInsights.push(`Already planning DESSERT: ${dessertNames.join(", ")} - this person knows how a meal should end`);
    }

    // Calculate total order price for potential roast
    const totalCents = order.totalCents || 0;
    if (totalCents > 5000) { // Over $50
      roastInsights.push(`TOTAL: $${(totalCents / 100).toFixed(2)} - treating themselves like royalty, as they should`);
    }

    // Try to generate AI roast
    let roast = null;
    let source = "ai";

    if (anthropic && roastInsights.length > 0) {
      try {
        // Session-based roast style - changes every 60 seconds for variety
        const roastSeed = Math.floor(Date.now() / 60000);
        const roastStyles = [
          "STAND-UP COMEDIAN - You're doing a tight 5 at a comedy club, crowd loves food jokes",
          "SASSY BEST FRIEND - Affectionately brutal, the friend who keeps it too real",
          "DRAMATIC FOOD CRITIC - Over-the-top pretentious but self-aware about it",
          "UNHINGED TWITTER - Pure chaos energy, absurdist takes that somehow land",
          "GORDON RAMSAY'S NICE COUSIN - The roast energy but with more love underneath",
          "GEN Z THERAPIST - Psychoanalyzing their order choices while being supportive",
          "CHAOTIC NARRATOR - Narrating their choices like it's a nature documentary gone wrong",
        ];
        const currentRoastStyle = roastStyles[roastSeed % roastStyles.length];

        // Find the juiciest details to emphasize
        const hasControversialChoices = roastInsights.some(i =>
          i.includes("NO NOODLES") ||
          i.includes("ZERO SPICE") ||
          i.includes("SOFT noodles") ||
          i.includes("SKIPPED")
        );
        const isExtraPerson = roastInsights.some(i =>
          i.includes("EXTRA") ||
          i.includes("MAXIMUM") ||
          i.includes("LOADED UP")
        );

        // Determine the target language name for the prompt
        const languageNames = {
          "zh-TW": "Traditional Chinese (繁體中文)",
          "zh-CN": "Simplified Chinese (简体中文)",
          "es": "Spanish (Español)",
          "en": "English"
        };
        const targetLanguage = languageNames[locale] || "English";

        const prompt = `You're a HILARIOUS comedian at the peak of your powers. A customer just ordered beef noodle soup and you need to DESTROY them (lovingly) with the funniest, most specific roast they've ever received.

=== ROAST STYLE FOR THIS ORDER ===
${currentRoastStyle}

=== THE VICTIM ===
CUSTOMER: ${firstName || "Mystery Guest (brave, ordering anonymously)"}
POD: ${order.seat?.number || "hiding somewhere"}

=== THEIR ORDER - DISSECT EVERY CHOICE ===
${roastInsights.map((insight, i) => `${i + 1}. ${insight}`).join("\n")}

=== COMEDY FUEL ===
${hasControversialChoices ? "They made CONTROVERSIAL choices. Go in on that." : ""}
${isExtraPerson ? "They're an EXTRA person. Call out the excess." : ""}
${summary.skippedToppings.length >= 3 ? "They're PICKY AS HELL. This is comedy gold." : ""}
${summary.noodleType?.toLowerCase().includes("no noodle") ? "THEY CAME TO A NOODLE SHOP AND ORDERED NO NOODLES. This writes itself." : ""}

=== OUTPUT FORMAT ===
You MUST respond with valid JSON in this exact format:
{
  "roast": "Your 2-4 sentence roast here (max 400 characters)",
  "highlights": ["bullet point 1 about their order", "bullet point 2", "bullet point 3"]
}

=== ROAST REQUIREMENTS ===
Write 2-4 sentences (max 400 characters) that:
1. ROAST at least 2-3 SPECIFIC choices from their order - be EXACT
2. Make unexpected connections ("you ordered X, which tells me you definitely also...")
3. Include at least ONE joke that would get an actual laugh out loud
4. ${firstName ? `Hit their name "${firstName}" at a punchline moment for maximum impact` : "Address them directly at a key moment"}
5. End on something that's technically a compliment but still a little bit of a roast

=== HIGHLIGHTS REQUIREMENTS ===
Write 3-4 short bullet points (each under 100 characters) that:
1. Point out specific, interesting choices from their order
2. Are witty observations, not just listing items
3. Use a playful, observational tone

=== EXAMPLES OF CHEF'S KISS OUTPUT ===
{
  "roast": "${firstName || "Babe"}, you got the A5 Wagyu bowl, went EXTRA RICH on broth, MAXIMUM SPICE, then whispered 'no cilantro please.' You want to feel alive but on YOUR terms. Your therapist calls this 'controlled chaos.'",
  "highlights": ["EXTRA RICH soup - came here for a broth baptism, not a light snack", "Demanded EXTRA: Green Onions, Pickled Greens - knows exactly what they want", "Already planning DESSERT: Mandarin Orange Sherbet - this person knows how a meal should end"]
}

=== CRITICAL RULES ===
- NEVER be generic. If you could say it about any order, DELETE IT
- Every sentence needs a SPECIFIC order detail woven in
- Absurdist hot takes are encouraged
- You're making fun of them but you clearly RESPECT them
- Make it screenshot-worthy
- RESPOND ONLY IN ${targetLanguage.toUpperCase()}${locale !== "en" ? ` - All text in both "roast" and "highlights" must be in ${targetLanguage}` : ""}

UNIQUE COMEDY SEED: ${roastSeed}-${Date.now() % 10000}

Respond with ONLY the JSON object. No other text.`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          temperature: 0.95,
          messages: [{ role: "user", content: prompt }],
        });

        const responseText = message.content[0]?.text?.trim();
        try {
          const parsed = JSON.parse(responseText);
          roast = parsed.roast;
          if (parsed.highlights && Array.isArray(parsed.highlights)) {
            // Use AI-generated highlights instead of the English ones
            roastInsights.length = 0; // Clear the array
            roastInsights.push(...parsed.highlights);
          }
        } catch (parseError) {
          // If JSON parsing fails, treat the whole response as the roast
          roast = responseText;
        }
      } catch (aiError) {
        console.error("AI roast generation failed:", aiError);
        source = "fallback";
      }
    } else if (!anthropic) {
      source = "fallback";
    }

    // Build personalized fallback if AI failed
    if (!roast) {
      source = "fallback";
      roast = getLocalizedFallbackRoast(locale, firstName);
    }

    // Build highlights from the most interesting insights
    // If AI generated translated highlights, roastInsights will already be in the target language
    const highlights = roastInsights
      .filter(i =>
        i.includes("SKIPPED") ||
        i.includes("EXTRA") ||
        i.includes("MAXIMUM") ||
        i.includes("ZERO") ||
        i.includes("NO NOODLES") ||
        i.includes("LOADED UP") ||
        i.includes("DESSERT") ||
        // Also match Chinese/Spanish keywords for translated highlights
        i.includes("跳過") || i.includes("加量") || i.includes("特辣") || i.includes("無辣") ||
        i.includes("甜點") || i.includes("無麵") ||
        i.includes("OMITIÓ") || i.includes("EXTRA") || i.includes("MÁXIMO") || i.includes("SIN PICANTE") ||
        i.includes("POSTRE") || i.includes("SIN FIDEOS")
      )
      .slice(0, 4);

    return reply.send({
      roast,
      highlights: highlights.length > 0 ? highlights : roastInsights.slice(0, 3),
      source,
      orderSummary: summary,
      customerName: firstName,
    });
  } catch (error) {
    console.error("Error generating roast:", error);
    // Return a fallback roast instead of 500 error
    const fallbackRoast = fallbackRoasts[Math.floor(Math.random() * fallbackRoasts.length)];
    return reply.send({
      roast: fallbackRoast,
      highlights: [],
      source: "fallback",
      orderSummary: null,
      isFallback: true,
    });
  }
});

// ====================
// LIVE ORDER COMMENTARY (AI Kitchen Updates)
// ====================

// Fallback commentary for each stage when AI is unavailable
const fallbackCommentary = {
  QUEUED: [
    "Your order has entered the queue. It's stretching. Hydrating. Mentally preparing for what's about to happen.",
    "The kitchen has acknowledged your existence. That's step one. Don't get cocky.",
    "Your order is in line. Like everyone else. You're not special. Yet.",
  ],
  PREPPING: [
    "The chef has begun. Noodles are being boiled with the intensity of someone who actually cares about their job.",
    "Your beef is hitting the wok. It sizzled. We all heard it. Even the beef knew this was coming.",
    "Broth is being ladled with unnecessary dramatic flair. Your meal is basically performance art at this point.",
    "The vegetables have been notified of their fate. They accepted it with dignity.",
  ],
  READY: [
    "Your bowl has passed the final inspection. It's beautiful. We almost don't want to let it go. Almost.",
    "Quality check complete. Your noodles have been deemed worthy of consumption. Congratulations.",
    "The kitchen has signed off. Your meal is ready to meet its destiny. Try not to disappoint it.",
  ],
  SERVING: [
    "It's on its way. Try to act natural. Don't make this weird.",
    "Your food is approaching. The anticipation should be killing you. If it's not, you're doing this wrong.",
    "Delivery imminent. This is it. The moment you've been waiting for. Don't blow it.",
  ],
};

// Helper to build comprehensive order summary for AI
function buildOrderSummary(order) {
  const summary = {
    mainDish: null,       // The soup/bowl choice (e.g., "Classic Beef Noodle Soup", "A5 Wagyu Beef Noodle Soup")
    noodleType: null,     // Noodle choice (e.g., "Ramen Noodles", "Wide Noodles", "No Noodles")
    noodleTexture: null,  // Slider: texture preference
    soupRichness: null,   // Slider: soup richness
    spiceLevel: null,     // Slider: spice level
    toppings: [],         // Slider toppings with levels
    skippedToppings: [],  // Toppings set to None/0
    extras: [],           // Toppings set to Extra/Max
    addons: [],           // Premium add-ons (Marinated Egg, Extra Noodles, etc.)
    sides: [],            // Side dishes
    drinks: [],           // Beverages
    desserts: [],         // Desserts
  };

  for (const item of order.items) {
    const name = item.menuItem?.name || item.name || "";
    const category = item.menuItem?.category || "";
    const categoryType = item.menuItem?.categoryType || "";
    const selectionMode = item.menuItem?.selectionMode || "";
    const value = item.selectedValue;

    // Main dish (soup/bowl type) - category "main" or "soup"
    // These are items like "Classic Beef Noodle Soup", "A5 Wagyu Beef Noodle Soup"
    if ((category === "main" || category === "soup") && !name.toLowerCase().match(/^(ramen|shaved|wide|no) noodles?$/i)) {
      summary.mainDish = name;
    }

    // Noodle type selection - items like "Ramen Noodles", "Wide Noodles", "No Noodles"
    if (category === "noodles" || name.toLowerCase().match(/^(ramen|shaved|wide|no) noodles?$/i)) {
      summary.noodleType = name;
    }

    // Slider customizations
    if (categoryType === "SLIDER" || selectionMode === "SLIDER") {
      const lowerName = name.toLowerCase();
      if (lowerName.includes("texture")) {
        summary.noodleTexture = value;
      } else if (lowerName.includes("richness")) {
        summary.soupRichness = value;
      } else if (lowerName.includes("spice")) {
        summary.spiceLevel = value;
      } else {
        // Topping sliders (bok choy, green onions, cilantro, sprouts, pickled greens)
        const cleanName = name.replace(" Level", "").replace(" Amount", "");
        if (value === "None" || value === "0" || value === 0) {
          summary.skippedToppings.push(cleanName);
        } else if (value === "Extra" || value === "3" || value >= 3) {
          summary.extras.push(cleanName);
        } else {
          summary.toppings.push({ name: cleanName, level: value });
        }
      }
    }

    // Add-ons (premium items like Marinated Egg, Extra Noodles)
    if (categoryType === "ADDON") {
      summary.addons.push({ name, quantity: item.quantity });
    }

    // Sides
    if (categoryType === "SIDE") {
      summary.sides.push({ name, quantity: item.quantity });
    }

    // Drinks
    if (categoryType === "DRINK") {
      summary.drinks.push({ name, quantity: item.quantity });
    }

    // Desserts
    if (categoryType === "DESSERT") {
      summary.desserts.push({ name, quantity: item.quantity });
    }
  }

  return summary;
}

// Generate live order commentary
app.get("/orders/commentary", async (req, reply) => {
  const { orderQrCode, orderId } = req.query || {};
  const locale = getLocale(req);
  const languageInstruction = getLanguageInstruction(locale);

  if (!orderQrCode && !orderId) {
    return reply.status(400).send({ error: "Order QR code or ID required" });
  }

  try {
    // Find the order with all details
    const order = await prisma.order.findFirst({
      where: orderQrCode
        ? { orderQrCode }
        : { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            menuItem: true,
          },
        },
        seat: true,
        location: true,
      },
    });

    if (!order) {
      return reply.status(404).send({ error: "Order not found" });
    }

    // Get customer name
    const firstName = order.user?.name?.split(" ")[0] || order.guestName?.split(" ")[0] || null;

    // Build comprehensive order summary
    const orderSummary = buildOrderSummary(order);

    // Get current status
    const status = order.status;

    // If status doesn't have commentary, return empty
    if (!["QUEUED", "PREPPING", "READY", "SERVING"].includes(status)) {
      return reply.send({
        commentary: null,
        status,
        message: "Commentary not available for this order status",
      });
    }

    // Try to generate AI commentary
    let commentary = null;
    let source = "ai";

    if (anthropic) {
      try {
        // Session-based narrator personality - changes every 45 seconds for fresh commentary
        const narratorSeed = Math.floor(Date.now() / 45000);
        const narratorStyles = [
          "UNHINGED SPORTS COMMENTATOR - narrating cooking like it's the finals, high energy",
          "NATURE DOCUMENTARY - David Attenborough observing 'the customer in their natural habitat'",
          "TELENOVELA NARRATOR - everything is dramatic, emotional, probably romantic",
          "TRUE CRIME PODCAST - ominous, building suspense about... noodles",
          "REALITY TV CONFESSIONAL - like you're talking to a producer about this customer",
          "CHAOTIC THEATER KID - dramatic, theatrical, everything is an event",
          "GRUMPY BUT LOVING GRANDMA - judging their choices but secretly proud",
        ];
        const currentNarratorStyle = narratorStyles[narratorSeed % narratorStyles.length];

        // Build the prompt with FULL order context
        const orderContext = [];

        if (orderSummary.mainDish) orderContext.push(`Main Dish: ${orderSummary.mainDish}`);
        if (orderSummary.protein) orderContext.push(`Protein: ${orderSummary.protein}`);
        if (orderSummary.noodleType) orderContext.push(`Noodle Type: ${orderSummary.noodleType}`);
        if (orderSummary.noodleTexture) orderContext.push(`Noodle Texture: ${orderSummary.noodleTexture}`);
        if (orderSummary.soupRichness) orderContext.push(`Soup Richness: ${orderSummary.soupRichness}`);
        if (orderSummary.spiceLevel) orderContext.push(`Spice Level: ${orderSummary.spiceLevel}`);

        if (orderSummary.extras.length > 0) {
          orderContext.push(`EXTRA toppings requested: ${orderSummary.extras.join(", ")}`);
        }
        if (orderSummary.skippedToppings.length > 0) {
          orderContext.push(`SKIPPED toppings (the coward's choices): ${orderSummary.skippedToppings.join(", ")}`);
        }
        if (orderSummary.addons.length > 0) {
          orderContext.push(`Add-ons: ${orderSummary.addons.map(a => `${a.quantity}x ${a.name}`).join(", ")}`);
        }
        if (orderSummary.sides.length > 0) {
          orderContext.push(`Sides: ${orderSummary.sides.map(s => `${s.quantity}x ${s.name}`).join(", ")}`);
        }
        if (orderSummary.drinks.length > 0) {
          orderContext.push(`Drinks: ${orderSummary.drinks.map(d => `${d.quantity}x ${d.name}`).join(", ")}`);
        }
        if (orderSummary.desserts.length > 0) {
          orderContext.push(`Desserts: ${orderSummary.desserts.map(d => `${d.quantity}x ${d.name}`).join(", ")}`);
        }

        const stageInstructions = {
          QUEUED: "The order just entered the queue. Be dramatic about the waiting. Create suspense.",
          PREPPING: "The kitchen is actively cooking. Narrate what's happening to their food vividly.",
          READY: "The food is done and waiting. Build the tension. This is the moment before glory.",
          SERVING: "Food is being delivered. This is the climax. Make it feel monumental.",
        };

        const prompt = `You're providing LIVE KITCHEN COMMENTARY for a restaurant. Your style right now is:

=== NARRATOR PERSONA ===
${currentNarratorStyle}

=== THE SCENE ===
CUSTOMER: ${firstName || "Anonymous Diner"}
POD: ${order.seat?.number || "location TBD"}
CURRENT STATUS: ${status}
STAGE VIBE: ${stageInstructions[status]}

=== THEIR ORDER (reference specifics!) ===
${orderContext.join("\n")}

=== YOUR MISSION ===
Write 2-3 sentences (max 280 chars) of commentary that:
1. FULLY commits to your narrator persona above
2. References at least ONE specific thing from their order
3. ${status === "QUEUED" ? "Builds anticipation/suspense about what's coming" : ""}
${status === "PREPPING" ? "Describes cooking happening dramatically with order specifics" : ""}
${status === "READY" ? "Creates tension about the masterpiece awaiting them" : ""}
${status === "SERVING" ? "Narrates the approaching food like a movie climax" : ""}
4. Is FUNNY but different from typical restaurant commentary
5. ${firstName ? `Mentions ${firstName} once for personalization` : "Addresses them directly"}

=== EXAMPLE ENERGY BY PERSONA ===
SPORTS COMMENTATOR: "AND THE NOODLES HIT THE WATER! Firm texture requested - ${firstName || "this competitor"} is NOT playing games today. The crowd watches. The broth simmers. History is being made."

NATURE DOCUMENTARY: "Here we observe the ${firstName || "urban diner"} in their natural habitat, having selected wide noodles and extra spice. A bold survival strategy. The kitchen springs into action."

TRUE CRIME: "What ${firstName || "they"} didn't know was that skipping the cilantro would trigger a chain of events in the kitchen that no one could have predicted. The broth was already simmering."

NO EMOJIS. Stay in character. Be creative. Make them laugh.

UNIQUE SEED: ${narratorSeed}-${Date.now() % 10000}

Write the commentary now. No quotes.${languageInstruction}`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          temperature: 0.95,
          messages: [{ role: "user", content: prompt }],
        });

        commentary = message.content[0]?.text?.trim();
      } catch (aiError) {
        console.error("AI commentary generation failed:", aiError);
        source = "fallback";
      }
    } else {
      source = "fallback";
    }

    // Use fallback if AI didn't work
    if (!commentary) {
      const stageFallbacks = fallbackCommentary[status] || fallbackCommentary.QUEUED;
      commentary = stageFallbacks[Math.floor(Math.random() * stageFallbacks.length)];
      if (firstName) {
        commentary = commentary.replace("Your", `${firstName}, your`);
      }
    }

    return reply.send({
      commentary,
      status,
      source,
      orderSummary: {
        mainDish: orderSummary.mainDish,
        protein: orderSummary.protein,
        hasExtras: orderSummary.extras.length > 0,
        hasSkipped: orderSummary.skippedToppings.length > 0,
        hasSides: orderSummary.sides.length > 0,
        hasDrinks: orderSummary.drinks.length > 0,
        hasDesserts: orderSummary.desserts.length > 0,
      },
      customerName: firstName,
      podNumber: order.seat?.number,
    });
  } catch (error) {
    console.error("Error generating commentary:", error);
    // Return a fallback commentary instead of 500 error
    const stageFallbacks = fallbackCommentary.QUEUED;
    const fallbackComment = stageFallbacks[Math.floor(Math.random() * stageFallbacks.length)];
    return reply.send({
      commentary: fallbackComment,
      status: "QUEUED",
      source: "fallback",
      orderSummary: null,
      isFallback: true,
    });
  }
});

// ====================
// BEHIND THE SCENES NARRATION (Ingredient Stories)
// ====================

// Fallback ingredient stories
const fallbackBackstories = [
  "Your beef was sliced exactly 43 minutes ago by someone who genuinely enjoys this. We don't ask questions.",
  "The green onions in your bowl were selected for their structural integrity and positive attitude.",
  "Your noodles began their journey as flour with big dreams. Today, those dreams come true. Or die. Depends on your chewing.",
  "The broth has been simmering since before you woke up. It's been waiting for you. That's not creepy, it's romantic.",
  "Fun fact: Your egg was soft-boiled to precisely 6.5 minutes. The extra 30 seconds is for emotional impact.",
  "The chili oil in your bowl has ancestry. It doesn't like to talk about it.",
  "Your bok choy was harvested yesterday. It had plans. Now it has purpose.",
  "The soy sauce has been fermenting longer than you've been alive. Show some respect.",
];

// Generate behind the scenes ingredient narration
app.get("/orders/:id/backstory", async (req, reply) => {
  const { id } = req.params;
  const locale = getLocale(req);
  const languageInstruction = getLanguageInstruction(locale);

  if (!id) {
    return reply.status(400).send({ error: "Order ID required" });
  }

  try {
    // Find the order with all details
    const order = await prisma.order.findFirst({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      return reply.status(404).send({ error: "Order not found" });
    }

    // Get customer name
    const firstName = order.user?.name?.split(" ")[0] || order.guestName?.split(" ")[0] || null;

    // Build order summary for context
    const orderSummary = buildOrderSummary(order);

    // Try to generate AI backstories
    let backstories = [];
    let source = "ai";

    if (anthropic) {
      try {
        const orderContext = [];
        if (orderSummary.protein) orderContext.push(`Protein: ${orderSummary.protein}`);
        if (orderSummary.noodleType) orderContext.push(`Noodles: ${orderSummary.noodleType}`);
        if (orderSummary.noodleTexture) orderContext.push(`Texture: ${orderSummary.noodleTexture}`);
        if (orderSummary.spiceLevel) orderContext.push(`Spice: ${orderSummary.spiceLevel}`);
        if (orderSummary.extras.length > 0) orderContext.push(`Extra: ${orderSummary.extras.join(", ")}`);
        if (orderSummary.skippedToppings.length > 0) orderContext.push(`Skipped: ${orderSummary.skippedToppings.join(", ")}`);

        const prompt = `You are the unhinged narrator of a beef noodle soup restaurant, providing "behind the scenes" facts about the ingredients in a customer's order. Your facts should be absurdist, slightly dark, weirdly specific, and FUNNY.

CUSTOMER ORDER:
${orderContext.join("\n")}
${orderSummary.sides.length > 0 ? `Sides: ${orderSummary.sides.map(s => s.name).join(", ")}` : ""}
${orderSummary.drinks.length > 0 ? `Drinks: ${orderSummary.drinks.map(d => d.name).join(", ")}` : ""}

YOUR STYLE:
- Absurdist but grounded - the humor comes from treating mundane things with unhinged seriousness
- Weirdly specific numbers and times (e.g., "sliced 47 minutes ago", "simmered for 6 hours and 12 minutes")
- Give ingredients personalities, ambitions, or backstories
- Occasionally dark but never gross
- If they skipped something, you can mention that ingredient is relieved/offended
- If they got extra of something, mock their excess
- NO EMOJIS EVER

EXAMPLES:
- "Your beef trained for this moment. Two years on a farm, thinking about life. Now it's in your bowl. Circle of life, but make it delicious."
- "The cilantro you rejected is currently in therapy. Just kidding. It's in someone else's bowl, thriving."
- "Your extra bok choy brings the vegetable count to 'suspiciously healthy for a noodle soup order.'"
- "The noodles were made this morning by someone who takes this very seriously. Too seriously, some would say. We don't say that to his face."

Generate exactly 4 short backstory facts (one sentence each, max 150 chars each) about the ingredients in this order. Be specific to what they ordered. Return as JSON array of strings.${languageInstruction}`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        });

        const responseText = message.content[0]?.text?.trim();
        // Try to parse JSON array from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          backstories = JSON.parse(jsonMatch[0]);
        }
      } catch (aiError) {
        console.error("AI backstory generation failed:", aiError);
        source = "fallback";
      }
    } else {
      source = "fallback";
    }

    // Use fallback if AI didn't work or returned invalid data
    if (!backstories || backstories.length === 0) {
      // Pick 3-4 random fallback stories
      const shuffled = [...fallbackBackstories].sort(() => 0.5 - Math.random());
      backstories = shuffled.slice(0, 4);
      source = "fallback";
    }

    return reply.send({
      backstories,
      source,
      customerName: firstName,
      orderHighlights: {
        protein: orderSummary.protein,
        noodleType: orderSummary.noodleType,
        spiceLevel: orderSummary.spiceLevel,
        extras: orderSummary.extras,
        skipped: orderSummary.skippedToppings,
      },
    });
  } catch (error) {
    console.error("Error generating backstory:", error);
    // Return fallback backstories instead of 500 error
    const shuffled = [...fallbackBackstories].sort(() => 0.5 - Math.random());
    return reply.send({
      backstories: shuffled.slice(0, 4),
      source: "fallback",
      orderHighlights: null,
      isFallback: true,
    });
  }
});

// ====================
// MENTAL HEALTH AWARENESS
// ====================

// Generate AI-powered mental health facts - always unique
app.get("/orders/mental-health-fact", async (req, reply) => {
  const locale = getLocale(req);
  const languageInstruction = getLanguageInstruction(locale);

  // Try to generate unique AI-powered mental health fact - return fallback if API key not set
  if (!anthropic) {
    return sendMentalHealthFallback(reply, locale);
  }

  try {
    const uniqueSeed = Date.now();

    // Categories to ensure variety
    const categories = [
      "workplace mental health and productivity",
      "children and adolescent mental health",
      "social connection and loneliness",
      "exercise and physical activity benefits",
      "sleep and mental health",
      "mindfulness and meditation",
      "therapy and treatment access",
      "stigma and awareness",
      "depression statistics and facts",
      "anxiety disorders",
      "stress management",
      "suicide prevention and awareness",
      "family and relationships",
      "technology and mental health",
      "self-care and resilience",
      "global mental health",
      "neuroscience and brain health",
      "creative arts and mental wellness",
    ];
    const categoryIndex = Math.floor(uniqueSeed / 1000) % categories.length;
    const focusCategory = categories[categoryIndex];

    // Get localized "Did you know?" text
    const questionTexts = {
      "zh-TW": "你知道嗎？",
      "zh-CN": "你知道吗？",
      "es": "¿Sabías que...?",
      "en": "Did you know?",
    };
    const questionText = questionTexts[locale] || "Did you know?";

    // Language-specific instruction for the fact content
    const languageNote = locale === "en" ? "" :
      locale === "zh-TW" ? "Write the fact in Traditional Chinese (繁體中文)." :
      locale === "zh-CN" ? "Write the fact in Simplified Chinese (简体中文)." :
      locale === "es" ? "Write the fact in Spanish (Español)." : "";

    const prompt = `You are a mental health educator creating an engaging "Did you know?" fact for restaurant customers.

FOCUS AREA: ${focusCategory}
UNIQUE SEED: ${uniqueSeed}
${languageNote ? `LANGUAGE: ${languageNote}` : ""}

REQUIREMENTS:
- Provide ONE specific, accurate mental health statistic or fact related to "${focusCategory}"
- Must be from a reputable source (cite it: NAMI, WHO, CDC, NIH, APA, Harvard, etc.)
- Should be surprising, thought-provoking, or hopeful
- End with something actionable or empowering when possible
- Keep the fact under 200 characters
- DO NOT repeat common stats like "1 in 5 adults" unless highly relevant to the category

Return ONLY valid JSON (no markdown). The "question" field should be "${questionText}":
{"question":"${questionText}","fact":"The specific fact here","source":"Organization Name, Year"}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 250,
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0]?.text?.trim();
    const parsed = JSON.parse(responseText);

    if (parsed.question && parsed.fact && parsed.source) {
      return reply.send({
        question: parsed.question,
        fact: parsed.fact,
        source: parsed.source,
        generatedAt: new Date().toISOString(),
      });
    }

    // Fallback if AI response is invalid
    return sendMentalHealthFallback(reply, locale);
  } catch (error) {
    console.error("Error generating mental health fact:", error);
    // Return fallback instead of 500 error
    return sendMentalHealthFallback(reply, locale);
  }
});

// Helper function for mental health fallback responses
function sendMentalHealthFallback(reply, locale) {
  const fallbacks = {
    en: {
      question: "Did you know?",
      fact: "Taking short breaks during meals to practice mindful eating can reduce stress and improve digestion.",
      source: "Harvard Health Publishing, 2023",
    },
    "zh-TW": {
      question: "你知道嗎？",
      fact: "用餐時短暫休息並練習正念飲食，可以減輕壓力並改善消化。",
      source: "哈佛健康出版，2023",
    },
    "zh-CN": {
      question: "你知道吗？",
      fact: "用餐时短暂休息并练习正念饮食，可以减轻压力并改善消化。",
      source: "哈佛健康出版，2023",
    },
    es: {
      question: "¿Sabías que...?",
      fact: "Tomar breves descansos durante las comidas para practicar la alimentación consciente puede reducir el estrés y mejorar la digestión.",
      source: "Harvard Health Publishing, 2023",
    },
  };
  const fallback = fallbacks[locale] || fallbacks.en;
  return reply.send({
    ...fallback,
    generatedAt: new Date().toISOString(),
    isFallback: true,
  });
}

// ====================
// ORDER WHISPERER (Pattern Analysis for Returning Customers)
// ====================

// Analyze user's order history patterns by email and generate witty insights
app.get("/users/by-email/:email/order-patterns", async (req, reply) => {
  const { email } = req.params;
  const { firstName } = req.query; // Optional: user's first name for personalization

  if (!email) {
    return reply.status(400).send({ error: "Email required" });
  }

  try {
    // First, find the user by email
    const user = await prisma.user.findUnique({
      where: { email: decodeURIComponent(email) },
    });

    if (!user) {
      return reply.send({
        hasPatterns: false,
        orderCount: 0,
        insights: [],
        message: "User not found",
      });
    }

    // Use provided firstName or extract from user.name
    const userName = firstName || (user.name ? user.name.split(" ")[0] : null);

    // Fetch user's completed orders (last 10 orders)
    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        status: "COMPLETED",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Only provide insights for returning customers (2+ orders)
    if (orders.length < 2) {
      return reply.send({
        hasPatterns: false,
        orderCount: orders.length,
        insights: [],
        message: "New customer - no patterns yet",
      });
    }

    // Analyze order patterns
    const patterns = {
      totalOrders: orders.length,
      bowlChoices: {},        // { "Classic Beef Noodles": 4, "Spicy Beef Noodles": 2 }
      noodleChoices: {},      // { "Ramen Noodles": 3, "Wide Noodles": 2 }
      spiceLevels: [],        // Track spice patterns
      neverTried: new Set(),  // Items available but never ordered
      alwaysSkips: {},        // Toppings always set to 0
      alwaysMaxes: {},        // Items always maxed out
      addOnCounts: {},        // Add-ons frequency
      sidesCounts: {},        // Sides frequency
      drinksCounts: {},       // Drinks frequency
      dessertsCounts: {},     // Desserts frequency
      customizations: {},     // Slider preferences
    };

    // Build pattern data from all orders
    for (const order of orders) {
      const summary = buildOrderSummary(order);

      // Track bowl choices
      if (summary.mainDish) {
        patterns.bowlChoices[summary.mainDish] = (patterns.bowlChoices[summary.mainDish] || 0) + 1;
      }

      // Track noodle choices
      if (summary.noodleType) {
        patterns.noodleChoices[summary.noodleType] = (patterns.noodleChoices[summary.noodleType] || 0) + 1;
      }

      // Track spice level
      if (summary.spiceLevel !== null) {
        patterns.spiceLevels.push(summary.spiceLevel);
      }

      // Track skipped items
      for (const skipped of summary.skippedToppings) {
        patterns.alwaysSkips[skipped] = (patterns.alwaysSkips[skipped] || 0) + 1;
      }

      // Track maxed out items
      for (const extra of summary.extras) {
        patterns.alwaysMaxes[extra] = (patterns.alwaysMaxes[extra] || 0) + 1;
      }

      // Track add-ons
      for (const addon of summary.addons) {
        patterns.addOnCounts[addon.name] = (patterns.addOnCounts[addon.name] || 0) + 1;
      }

      // Track sides
      for (const side of summary.sides) {
        patterns.sidesCounts[side.name] = (patterns.sidesCounts[side.name] || 0) + 1;
      }

      // Track drinks
      for (const drink of summary.drinks) {
        patterns.drinksCounts[drink.name] = (patterns.drinksCounts[drink.name] || 0) + 1;
      }

      // Track desserts
      for (const dessert of summary.desserts) {
        patterns.dessertsCounts[dessert.name] = (patterns.dessertsCounts[dessert.name] || 0) + 1;
      }
    }

    // Generate insights based on patterns
    const insights = [];
    const orderCount = patterns.totalOrders;

    // Insight: Same bowl every time
    const topBowl = Object.entries(patterns.bowlChoices).sort((a, b) => b[1] - a[1])[0];
    if (topBowl && topBowl[1] === orderCount && orderCount >= 3) {
      insights.push({
        type: "bowl_loyalty",
        trigger: "bowl_step",
        count: topBowl[1],
        item: topBowl[0],
        tone: "playful_tease",
      });
    } else if (topBowl && topBowl[1] >= orderCount * 0.7) {
      insights.push({
        type: "bowl_favorite",
        trigger: "bowl_step",
        count: topBowl[1],
        item: topBowl[0],
        tone: "knowing_nod",
      });
    }

    // Insight: Noodle preferences (shows on bowl_step since soup + noodles are together)
    const topNoodle = Object.entries(patterns.noodleChoices).sort((a, b) => b[1] - a[1])[0];
    if (topNoodle && topNoodle[1] === orderCount && orderCount >= 3) {
      insights.push({
        type: "noodle_loyalty",
        trigger: "bowl_step",  // Shows on step 0 with soup selection
        count: topNoodle[1],
        item: topNoodle[0],
        tone: "playful_tease",
      });
    } else if (topNoodle && topNoodle[1] >= orderCount * 0.5 && orderCount >= 3) {
      // At least half the time they order this noodle type - notable preference
      insights.push({
        type: "noodle_favorite",
        trigger: "bowl_step",
        count: topNoodle[1],
        item: topNoodle[0],
        tone: "knowing_nod",
      });
    }

    // Insight: Always skips certain toppings
    const alwaysSkipped = Object.entries(patterns.alwaysSkips).filter(([_, count]) => count === orderCount);
    if (alwaysSkipped.length > 0 && orderCount >= 2) {
      insights.push({
        type: "always_skips",
        trigger: "customize_step",
        items: alwaysSkipped.map(([name]) => name),
        count: orderCount,
        tone: "detective",
      });
    }

    // Insight: Always maxes something
    const alwaysMaxed = Object.entries(patterns.alwaysMaxes).filter(([_, count]) => count >= orderCount * 0.8);
    if (alwaysMaxed.length > 0 && orderCount >= 2) {
      insights.push({
        type: "always_maxes",
        trigger: "customize_step",
        items: alwaysMaxed.map(([name]) => name),
        tone: "respect",
      });
    }

    // Insight: Spice patterns
    if (patterns.spiceLevels.length >= 3) {
      const allZero = patterns.spiceLevels.every(s => s === "None" || s === "0" || s === 0);
      const allMax = patterns.spiceLevels.every(s => s === "Extra" || s === "3" || s >= 3);
      if (allZero) {
        insights.push({
          type: "spice_avoider",
          trigger: "customize_step",
          tone: "gentle_tease",
        });
      } else if (allMax) {
        insights.push({
          type: "spice_warrior",
          trigger: "customize_step",
          tone: "impressed",
        });
      }
    }

    // Insight: Never ordered an add-on
    if (Object.keys(patterns.addOnCounts).length === 0 && orderCount >= 3) {
      insights.push({
        type: "never_addons",
        trigger: "extras_step",
        tone: "curious",
      });
    }

    // Insight: Loyal to certain add-on
    const topAddon = Object.entries(patterns.addOnCounts).sort((a, b) => b[1] - a[1])[0];
    if (topAddon && topAddon[1] >= orderCount * 0.8 && orderCount >= 3) {
      insights.push({
        type: "addon_favorite",
        trigger: "extras_step",
        item: topAddon[0],
        count: topAddon[1],
        tone: "knowing_nod",
      });
    }

    // Insight: Never gets dessert
    if (Object.keys(patterns.dessertsCounts).length === 0 && orderCount >= 4) {
      insights.push({
        type: "never_dessert",
        trigger: "drinks_step",
        tone: "surprised",
      });
    }

    // Insight: Always gets dessert
    const totalDesserts = Object.values(patterns.dessertsCounts).reduce((a, b) => a + b, 0);
    if (totalDesserts === orderCount && orderCount >= 3) {
      insights.push({
        type: "always_dessert",
        trigger: "drinks_step",
        item: Object.keys(patterns.dessertsCounts)[0],
        tone: "approving",
      });
    }

    // Generate AI witty one-liners for the insights if available
    if (anthropic && insights.length > 0) {
      try {
        const insightDescriptions = insights.map(i => {
          switch (i.type) {
            case "bowl_loyalty":
              return `Ordered "${i.item}" ${i.count} times in a row (100% of orders)`;
            case "bowl_favorite":
              return `Ordered "${i.item}" ${i.count} out of ${orderCount} times (clear favorite)`;
            case "noodle_loyalty":
              return `Chose "${i.item}" ${i.count} times in a row - never tried other noodles`;
            case "noodle_favorite":
              return `Goes for "${i.item}" ${i.count} out of ${orderCount} times - clear noodle preference`;
            case "always_skips":
              return `Always skips ${i.items.join(", ")} - ${i.count} orders in a row`;
            case "always_maxes":
              return `Always maxes out ${i.items.join(", ")} every single order`;
            case "spice_avoider":
              return `Zero spice on every order - dedicated spice-free lifestyle`;
            case "spice_warrior":
              return `Maximum spice every time - taste buds made of steel`;
            case "never_addons":
              return `Never ordered a single add-on in ${orderCount} visits`;
            case "addon_favorite":
              return `Gets "${i.item}" every time (${i.count} orders straight)`;
            case "never_dessert":
              return `${orderCount} visits, zero desserts - mysterious self-control`;
            case "always_dessert":
              return `Always gets ${i.item || "dessert"} - proper meal-ender`;
            default:
              return "";
          }
        }).filter(d => d);

        // Generate a session seed for variety (changes every few minutes)
        const sessionSeed = Math.floor(Date.now() / 180000); // Changes every 3 minutes
        const variationStyles = ["witty observation", "gentle tease", "knowing aside", "dry humor", "friendly jab"];
        const styleIndex = sessionSeed % variationStyles.length;
        const style = variationStyles[styleIndex];

        const prompt = `You generate witty, SHORT one-liners for a noodle restaurant's order system.

A returning customer${userName ? ` named ${userName}` : ""} is placing an order. Based on their order history patterns, generate a single witty one-liner for EACH pattern below.

RULES:
- ONE sentence only, max 80 characters per response
- Playful teasing, NOT mean-spirited
- Reference the SPECIFIC item/behavior
- Sound like a knowing friend, not a robot
- NO emojis
- DO NOT start with "We"
${userName ? `- You MAY use "${userName}" naturally in some (not all) one-liners to make it personal` : "- Do not use 'You' to start sentences"}
- Style for this session: ${style}
- Be CREATIVE and UNIQUE - never use the same phrasing twice

PATTERNS DETECTED:
${insightDescriptions.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Return as JSON array of objects with format: [{"index": 0, "oneLiner": "your witty comment"}, ...]`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        });

        const responseText = message.content[0]?.text?.trim();
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const oneLiners = JSON.parse(jsonMatch[0]);
          // Attach one-liners to insights
          for (const liner of oneLiners) {
            if (insights[liner.index]) {
              insights[liner.index].oneLiner = liner.oneLiner;
            }
          }
        }
      } catch (aiError) {
        console.error("AI one-liner generation failed:", aiError);
        // Fall through to fallback one-liners
      }
    }

    // Add fallback one-liners for any insights that don't have AI-generated ones
    // Use a session seed so the same user gets different fallbacks on different visits
    const fallbackSeed = Date.now();
    for (const insight of insights) {
      if (!insight.oneLiner) {
        insight.oneLiner = generateFallbackOneLiner(insight, userName, fallbackSeed);
      }
    }

    return reply.send({
      hasPatterns: insights.length > 0,
      orderCount,
      insights,
      patterns: {
        topBowl: topBowl ? { name: topBowl[0], count: topBowl[1] } : null,
        topNoodle: topNoodle ? { name: topNoodle[0], count: topNoodle[1] } : null,
        topAddon: topAddon ? { name: topAddon[0], count: topAddon[1] } : null,
      },
    });
  } catch (error) {
    console.error("Error analyzing order patterns:", error);
    return reply.status(500).send({ error: "Failed to analyze order patterns" });
  }
});

// Fallback one-liners for each insight type
// Now accepts userName for personalization and seed for variety
function generateFallbackOneLiner(insight, userName, seed = Date.now()) {
  const name = userName || null;

  // Helper to occasionally include name (roughly 40% of the time when available)
  const maybeName = () => name && (seed % 5 < 2) ? `${name}, ` : "";
  const maybeNameEnd = () => name && (seed % 7 < 3) ? `, ${name}` : "";

  const fallbacks = {
    bowl_loyalty: [
      `${maybeName()}${insight.item}. ${insight.count} times. Starting to see a pattern here.`,
      `Let me guess... ${insight.item}?`,
      `The ${insight.item} didn't even need to ask anymore.`,
      `${insight.item} again${maybeNameEnd()}? The kitchen saw this coming.`,
      `${insight.count} for ${insight.count} on ${insight.item}. Consistency is underrated.`,
      name ? `${name}'s usual: ${insight.item}. No surprises here.` : `The usual: ${insight.item}. No surprises here.`,
    ],
    bowl_favorite: [
      `${insight.item} again? Bold, predictable, perfect.`,
      `Ah, the ${insight.item} regular. Kitchen's already prepping.`,
      `${maybeName()}back for ${insight.item}. The loyalty is noted.`,
      `${insight.item} calling your name again${maybeNameEnd()}?`,
      `${insight.count} out of ${insight.orderCount || "10"} times: ${insight.item}. A clear favorite.`,
    ],
    noodle_loyalty: [
      `${insight.item} forever. Other noodles weep quietly.`,
      `${insight.count} visits. ${insight.count} times ${insight.item}. Respect the commitment.`,
      `${maybeName()}${insight.item} devotee. The other noodles have accepted their fate.`,
      `Still ${insight.item}? The ramen is taking notes.`,
      name ? `${name} and ${insight.item}: an unbreakable bond.` : `${insight.item}: an unshakeable choice.`,
    ],
    noodle_favorite: [
      `${insight.item} ${insight.count} out of ${insight.orderCount || "10"} times. Reliable taste.`,
      `Leaning toward ${insight.item}, as usual. The other noodles are getting jealous.`,
      `${maybeName()}the ${insight.item} has missed you.`,
      `${insight.item} again? A person of refined, consistent taste.`,
      `The ${insight.item} awaits${maybeNameEnd()}.`,
      name ? `${name}'s noodle of choice: ${insight.item}. Noted.` : `Noodle of choice: ${insight.item}. Noted.`,
    ],
    always_skips: [
      `Skipping ${insight.items?.[0] || "that"} again? Personal vendetta confirmed.`,
      `${insight.items?.join(" and ") || "Certain ingredients"} remain unloved, as is tradition.`,
      `${maybeName()}still avoiding ${insight.items?.[0] || "the usual suspects"}.`,
      `The ${insight.items?.[0] || "skipped items"} didn't make the cut. Again.`,
      `${insight.count} orders, zero ${insight.items?.[0] || "of that"}. Commitment.`,
    ],
    always_maxes: [
      `Maxing the ${insight.items?.[0] || "usual"}? Some things never change.`,
      `${insight.items?.[0] || "That"} at maximum. As it should be.`,
      `${maybeName()}cranking ${insight.items?.[0] || "it"} to the max, naturally.`,
      `The ${insight.items?.[0] || "slider"} goes to eleven. Always.`,
      name ? `${name} doesn't do half measures with ${insight.items?.[0] || "this"}.` : `No half measures with ${insight.items?.[0] || "this"}.`,
    ],
    spice_avoider: [
      `Zero spice zone. The cilantro respects your boundaries.`,
      `Spice dial stays at zero. A person of peaceful tastes.`,
      `${maybeName()}keeping it mild. The peppers understand.`,
      `Spice-free lifestyle${maybeNameEnd()}. No judgment here.`,
      `The chili flakes remain untouched. As always.`,
    ],
    spice_warrior: [
      `Maximum spice. Your taste buds called - they've adapted.`,
      `Spice level: scorched earth. The dedication is impressive.`,
      `${maybeName()}bringing the heat, as expected.`,
      `Full spice${maybeNameEnd()}? The kitchen is ready.`,
      name ? `${name}'s heat tolerance: legendary.` : `Heat tolerance: legendary.`,
    ],
    never_addons: [
      `${insight.count || "Several"} visits, zero add-ons. Purist vibes.`,
      `The add-ons await. They've been very patient.`,
      `${maybeName()}sticking to the essentials.`,
      `Add-on free since day one. Minimalist icon.`,
      `The extras menu remains unexplored${maybeNameEnd()}.`,
    ],
    addon_favorite: [
      `${insight.item} again? At this point it should be named after you.`,
      `The ${insight.item} saw you walk in and started celebrating.`,
      `${maybeName()}${insight.item} is practically mandatory at this point.`,
      `${insight.item}, ${insight.count} visits running. Dedication.`,
      name ? `${name}'s go-to add-on: ${insight.item}.` : `The go-to add-on: ${insight.item}.`,
    ],
    never_dessert: [
      `Still no dessert? The mochi is starting to take it personally.`,
      `Dessert-free streak continues. Impressive restraint.`,
      `${maybeName()}skipping dessert again. The sweets remain hopeful.`,
      `The dessert menu gathers dust${maybeNameEnd()}.`,
      `${insight.count || "Several"} visits, zero desserts. Remarkable willpower.`,
    ],
    always_dessert: [
      `Dessert incoming. A meal isn't complete without it.`,
      `${insight.item || "Dessert"} is already being prepared.`,
      `${maybeName()}never skips dessert. Priorities in order.`,
      `${insight.item || "The sweet finish"} awaits${maybeNameEnd()}.`,
      name ? `${name} knows a proper meal ends with dessert.` : `A proper meal ends with dessert.`,
    ],
  };

  const options = fallbacks[insight.type] || ["Interesting choice."];
  // Use seed to pick option deterministically but differently each session
  const index = Math.abs(seed + insight.type.length) % options.length;
  return options[index];
}

// ====================
// ANALYTICS ENDPOINTS
// ====================

// Helper to parse period and get date range
function getDateRange(period = "week") {
  const now = new Date();
  const end = new Date(now);
  let start;

  switch (period) {
    case "today":
      start = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "yesterday":
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case "week":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
    case "quarter":
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      break;
    case "year":
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "all":
      start = new Date(0);
      break;
    default:
      start = new Date(now);
      start.setDate(start.getDate() - 7);
  }

  return { start, end };
}

// Analytics Overview - Key KPIs
app.get("/analytics/overview", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { period = "week", locationId } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const whereClause = {
      tenantId: tenant.id,
      createdAt: { gte: start, lte: end },
      status: { in: ["COMPLETED", "PAID", "QUEUED", "PREPPING", "READY", "SERVING"] },
    };
    if (locationId) whereClause.locationId = locationId;

    // Previous period for comparison
    const periodMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd = new Date(start);

    const prevWhereClause = {
      ...whereClause,
      createdAt: { gte: prevStart, lte: prevEnd },
    };

    // Current period stats
    const [orders, prevOrders, customers, prevCustomers] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        select: { totalCents: true, createdAt: true, userId: true },
      }),
      prisma.order.findMany({
        where: prevWhereClause,
        select: { totalCents: true },
      }),
      prisma.order.groupBy({
        by: ["userId"],
        where: { ...whereClause, userId: { not: null } },
      }),
      prisma.order.groupBy({
        by: ["userId"],
        where: { ...prevWhereClause, userId: { not: null } },
      }),
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalCents || 0), 0);
    const prevTotalRevenue = prevOrders.reduce((sum, o) => sum + (o.totalCents || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    const prevAvgOrderValue = prevOrders.length > 0 ? prevTotalRevenue / prevOrders.length : 0;

    // Calculate percentage changes
    const revenueChange = prevTotalRevenue > 0
      ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
      : 0;
    const ordersChange = prevOrders.length > 0
      ? ((orders.length - prevOrders.length) / prevOrders.length) * 100
      : 0;
    const aovChange = prevAvgOrderValue > 0
      ? ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100
      : 0;
    const customersChange = prevCustomers.length > 0
      ? ((customers.length - prevCustomers.length) / prevCustomers.length) * 100
      : 0;

    return reply.send({
      period,
      dateRange: { start, end },
      metrics: {
        totalRevenue: {
          value: totalRevenue,
          formatted: `$${(totalRevenue / 100).toFixed(2)}`,
          change: revenueChange.toFixed(1),
        },
        totalOrders: {
          value: orders.length,
          change: ordersChange.toFixed(1),
        },
        averageOrderValue: {
          value: avgOrderValue,
          formatted: `$${(avgOrderValue / 100).toFixed(2)}`,
          change: aovChange.toFixed(1),
        },
        uniqueCustomers: {
          value: customers.length,
          change: customersChange.toFixed(1),
        },
      },
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    return reply.status(500).send({ error: "Failed to fetch analytics overview" });
  }
});

// Revenue Analytics
app.get("/analytics/revenue", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { period = "week", locationId, groupBy = "day" } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const whereClause = {
      tenantId: tenant.id,
      createdAt: { gte: start, lte: end },
      status: { in: ["COMPLETED", "PAID", "QUEUED", "PREPPING", "READY", "SERVING"] },
    };
    if (locationId) whereClause.locationId = locationId;

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        totalCents: true,
        createdAt: true,
        location: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group revenue by time period
    const revenueByPeriod = {};
    const revenueByLocation = {};

    for (const order of orders) {
      let key;
      const date = new Date(order.createdAt);

      switch (groupBy) {
        case "hour":
          key = `${date.toISOString().split("T")[0]} ${date.getHours().toString().padStart(2, "0")}:00`;
          break;
        case "day":
          key = date.toISOString().split("T")[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "month":
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
          break;
        default:
          key = date.toISOString().split("T")[0];
      }

      if (!revenueByPeriod[key]) {
        revenueByPeriod[key] = { revenue: 0, orders: 0 };
      }
      revenueByPeriod[key].revenue += order.totalCents || 0;
      revenueByPeriod[key].orders += 1;

      // By location
      if (order.location) {
        const locKey = order.location.id;
        if (!revenueByLocation[locKey]) {
          revenueByLocation[locKey] = { name: order.location.name, revenue: 0, orders: 0 };
        }
        revenueByLocation[locKey].revenue += order.totalCents || 0;
        revenueByLocation[locKey].orders += 1;
      }
    }

    // Convert to arrays and format
    const timeline = Object.entries(revenueByPeriod).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      revenueFormatted: `$${(data.revenue / 100).toFixed(2)}`,
      orders: data.orders,
    }));

    const byLocation = Object.entries(revenueByLocation)
      .map(([id, data]) => ({
        locationId: id,
        name: data.name,
        revenue: data.revenue,
        revenueFormatted: `$${(data.revenue / 100).toFixed(2)}`,
        orders: data.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalCents || 0), 0);

    return reply.send({
      period,
      groupBy,
      dateRange: { start, end },
      summary: {
        totalRevenue,
        totalRevenueFormatted: `$${(totalRevenue / 100).toFixed(2)}`,
        totalOrders: orders.length,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        averageOrderValueFormatted: orders.length > 0
          ? `$${((totalRevenue / orders.length) / 100).toFixed(2)}`
          : "$0.00",
      },
      timeline,
      byLocation,
    });
  } catch (error) {
    console.error("Revenue analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch revenue analytics" });
  }
});

// Operations Analytics
app.get("/analytics/operations", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { period = "week", locationId } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const whereClause = {
      tenantId: tenant.id,
      createdAt: { gte: start, lte: end },
    };
    if (locationId) whereClause.locationId = locationId;

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        status: true,
        createdAt: true,
        prepStartTime: true,
        readyTime: true,
        deliveredAt: true,
        completedTime: true,
        arrivedAt: true,
        estimatedArrival: true,
        queuedAt: true,
        podAssignedAt: true,
        podConfirmedAt: true,
        arrivalDeviation: true,
      },
    });

    // Calculate operational metrics
    let totalPrepTime = 0;
    let prepTimeCount = 0;
    let totalWaitTime = 0;
    let waitTimeCount = 0;
    let totalTurnaroundTime = 0;
    let turnaroundCount = 0;
    let onTimeArrivals = 0;
    let arrivalCount = 0;

    const statusCounts = {};
    const hourlyDistribution = {};

    for (const order of orders) {
      // Status counts
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;

      // Hourly distribution
      const hour = new Date(order.createdAt).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

      // Prep time (prepStart to ready)
      if (order.prepStartTime && order.readyTime) {
        const prepTime = (new Date(order.readyTime) - new Date(order.prepStartTime)) / 1000 / 60;
        if (prepTime > 0 && prepTime < 120) {
          totalPrepTime += prepTime;
          prepTimeCount++;
        }
      }

      // Wait time (queued to prep start)
      if (order.queuedAt && order.prepStartTime) {
        const waitTime = (new Date(order.prepStartTime) - new Date(order.queuedAt)) / 1000 / 60;
        if (waitTime >= 0 && waitTime < 120) {
          totalWaitTime += waitTime;
          waitTimeCount++;
        }
      }

      // Total turnaround (order created to delivered/completed)
      const endTime = order.deliveredAt || order.completedTime;
      if (endTime) {
        const turnaround = (new Date(endTime) - new Date(order.createdAt)) / 1000 / 60;
        if (turnaround > 0 && turnaround < 180) {
          totalTurnaroundTime += turnaround;
          turnaroundCount++;
        }
      }

      // On-time arrivals
      if (order.arrivalDeviation !== null) {
        arrivalCount++;
        if (Math.abs(order.arrivalDeviation) <= 5) {
          onTimeArrivals++;
        }
      }
    }

    // Peak hours analysis
    const peakHours = Object.entries(hourlyDistribution)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    return reply.send({
      period,
      dateRange: { start, end },
      metrics: {
        averagePrepTime: {
          value: prepTimeCount > 0 ? (totalPrepTime / prepTimeCount).toFixed(1) : 0,
          unit: "minutes",
          sampleSize: prepTimeCount,
        },
        averageWaitTime: {
          value: waitTimeCount > 0 ? (totalWaitTime / waitTimeCount).toFixed(1) : 0,
          unit: "minutes",
          sampleSize: waitTimeCount,
        },
        averageTurnaroundTime: {
          value: turnaroundCount > 0 ? (totalTurnaroundTime / turnaroundCount).toFixed(1) : 0,
          unit: "minutes",
          sampleSize: turnaroundCount,
        },
        onTimeArrivalRate: {
          value: arrivalCount > 0 ? ((onTimeArrivals / arrivalCount) * 100).toFixed(1) : 0,
          unit: "percent",
          sampleSize: arrivalCount,
        },
      },
      statusBreakdown: statusCounts,
      peakHours: peakHours.slice(0, 5),
      hourlyDistribution: Object.fromEntries(
        Array.from({ length: 24 }, (_, i) => [i, hourlyDistribution[i] || 0])
      ),
    });
  } catch (error) {
    console.error("Operations analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch operations analytics" });
  }
});

// Customer Analytics
app.get("/analytics/customers", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { period = "month" } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    // Get all users with orders in this period
    const usersWithOrders = await prisma.user.findMany({
      where: {
        orders: {
          some: {
            tenantId: tenant.id,
            createdAt: { gte: start, lte: end },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        membershipTier: true,
        lifetimeOrderCount: true,
        lifetimeSpentCents: true,
        createdAt: true,
        orders: {
          where: {
            tenantId: tenant.id,
            createdAt: { gte: start, lte: end },
          },
          select: {
            id: true,
            totalCents: true,
            createdAt: true,
          },
        },
      },
    });

    // Calculate metrics
    const tierDistribution = { CHOPSTICK: 0, NOODLE_MASTER: 0, BEEF_BOSS: 0 };
    let newCustomers = 0;
    let returningCustomers = 0;
    let totalLifetimeValue = 0;

    for (const user of usersWithOrders) {
      tierDistribution[user.membershipTier || "CHOPSTICK"]++;
      totalLifetimeValue += user.lifetimeSpentCents || 0;

      // Check if customer is new (created within period)
      if (new Date(user.createdAt) >= start) {
        newCustomers++;
      } else {
        returningCustomers++;
      }
    }

    // Get repeat customers (multiple orders in period)
    const repeatCustomers = usersWithOrders.filter(u => u.orders.length > 1).length;

    // Top customers by spend in period
    const topCustomers = usersWithOrders
      .map(user => ({
        id: user.id,
        name: user.name || "Unknown",
        email: user.email || null,
        orderCount: user.orders.length,
        periodSpend: user.orders.reduce((sum, o) => sum + (o.totalCents || 0), 0),
        lifetimeSpend: user.lifetimeSpentCents || 0,
        tier: user.membershipTier,
      }))
      .sort((a, b) => b.periodSpend - a.periodSpend)
      .slice(0, 10);

    return reply.send({
      period,
      dateRange: { start, end },
      summary: {
        totalCustomers: usersWithOrders.length,
        newCustomers,
        returningCustomers,
        repeatCustomers,
        repeatRate: usersWithOrders.length > 0
          ? ((repeatCustomers / usersWithOrders.length) * 100).toFixed(1)
          : 0,
        averageLifetimeValue: usersWithOrders.length > 0
          ? `$${((totalLifetimeValue / usersWithOrders.length) / 100).toFixed(2)}`
          : "$0.00",
      },
      tierDistribution,
      topCustomers: topCustomers.map(c => ({
        ...c,
        periodSpendFormatted: `$${(c.periodSpend / 100).toFixed(2)}`,
        lifetimeSpendFormatted: `$${(c.lifetimeSpend / 100).toFixed(2)}`,
      })),
    });
  } catch (error) {
    console.error("Customer analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch customer analytics" });
  }
});

// Menu Performance Analytics
app.get("/analytics/menu", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { period = "week", locationId } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const orderWhereClause = {
      tenantId: tenant.id,
      createdAt: { gte: start, lte: end },
      status: { in: ["COMPLETED", "PAID", "QUEUED", "PREPPING", "READY", "SERVING"] },
    };
    if (locationId) orderWhereClause.locationId = locationId;

    // First get the order IDs that match our criteria
    const orders = await prisma.order.findMany({
      where: orderWhereClause,
      select: { id: true },
    });

    const orderIds = orders.map(o => o.id);

    // If no orders, return empty data
    if (orderIds.length === 0) {
      return reply.send({
        period,
        dateRange: { start, end },
        summary: {
          totalItemsSold: 0,
          totalRevenue: 0,
          totalRevenueFormatted: "$0.00",
          uniqueItems: 0,
        },
        topByQuantity: [],
        topByRevenue: [],
        byCategory: [],
      });
    }

    // Get order items with menu item details
    const orderItems = await prisma.orderItem.findMany({
      where: {
        orderId: { in: orderIds },
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            category: true,
            basePriceCents: true,
          },
        },
      },
    });

    // Aggregate by menu item
    const itemStats = {};
    const categoryStats = {};

    for (const item of orderItems) {
      if (!item.menuItem) continue;

      const itemId = item.menuItem.id;
      const category = item.menuItem.category || "Other";

      if (!itemStats[itemId]) {
        itemStats[itemId] = {
          id: itemId,
          name: item.menuItem.name,
          category,
          quantity: 0,
          revenue: 0,
        };
      }
      itemStats[itemId].quantity += item.quantity;
      itemStats[itemId].revenue += (item.priceCents || item.menuItem.basePriceCents || 0) * item.quantity;

      if (!categoryStats[category]) {
        categoryStats[category] = { quantity: 0, revenue: 0, items: 0 };
      }
      categoryStats[category].quantity += item.quantity;
      categoryStats[category].revenue += (item.priceCents || item.menuItem.basePriceCents || 0) * item.quantity;
    }

    // Sort by quantity and revenue
    const topByQuantity = Object.values(itemStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const topByRevenue = Object.values(itemStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const totalRevenue = Object.values(itemStats).reduce((sum, i) => sum + i.revenue, 0);
    const totalQuantity = Object.values(itemStats).reduce((sum, i) => sum + i.quantity, 0);

    return reply.send({
      period,
      dateRange: { start, end },
      summary: {
        totalItemsSold: totalQuantity,
        totalRevenue,
        totalRevenueFormatted: `$${(totalRevenue / 100).toFixed(2)}`,
        uniqueItems: Object.keys(itemStats).length,
      },
      topByQuantity: topByQuantity.map(i => ({
        ...i,
        revenueFormatted: `$${(i.revenue / 100).toFixed(2)}`,
      })),
      topByRevenue: topByRevenue.map(i => ({
        ...i,
        revenueFormatted: `$${(i.revenue / 100).toFixed(2)}`,
      })),
      byCategory: Object.entries(categoryStats)
        .map(([name, data]) => ({
          category: name,
          quantity: data.quantity,
          revenue: data.revenue,
          revenueFormatted: `$${(data.revenue / 100).toFixed(2)}`,
          percentOfRevenue: totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    });
  } catch (error) {
    console.error("Menu analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch menu analytics" });
  }
});

// Real-time dashboard stats (for live dashboard)
app.get("/analytics/realtime", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { locationId } = req.query;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereClause = {
      tenantId: tenant.id,
      createdAt: { gte: today },
    };
    if (locationId) whereClause.locationId = locationId;

    const [todayOrders, activeOrders, queueStats] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        select: { totalCents: true, status: true },
      }),
      prisma.order.count({
        where: {
          ...whereClause,
          status: { in: ["QUEUED", "PREPPING", "READY", "SERVING"] },
        },
      }),
      prisma.waitQueue.count({
        where: {
          ...(locationId ? { locationId } : {}),
          status: "WAITING",
        },
      }),
    ]);

    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalCents || 0), 0);
    const completedToday = todayOrders.filter(o => o.status === "COMPLETED").length;

    return reply.send({
      timestamp: new Date().toISOString(),
      today: {
        orders: todayOrders.length,
        revenue: todayRevenue,
        revenueFormatted: `$${(todayRevenue / 100).toFixed(2)}`,
        completed: completedToday,
      },
      live: {
        activeOrders,
        queueLength: queueStats,
      },
    });
  } catch (error) {
    console.error("Realtime analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch realtime analytics" });
  }
});

// GET /analytics/order-sources - Track orders by source (WEB, KIOSK, MOBILE, STAFF)
app.get("/analytics/order-sources", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { period = "week", locationId } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const whereClause = {
      tenantId: tenant.id,
      createdAt: { gte: start, lte: end },
      paymentStatus: "PAID",
    };
    if (locationId) whereClause.locationId = locationId;

    // Get all paid orders with their source
    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        orderSource: true,
        totalCents: true,
        createdAt: true,
      },
    });

    // Calculate metrics by source
    const sourceMetrics = {};
    const sources = ["WEB", "KIOSK", "MOBILE", "STAFF"];

    sources.forEach(source => {
      const sourceOrders = orders.filter(o => o.orderSource === source);
      sourceMetrics[source] = {
        orders: sourceOrders.length,
        revenue: sourceOrders.reduce((sum, o) => sum + (o.totalCents || 0), 0),
        averageOrderValue: sourceOrders.length > 0
          ? Math.round(sourceOrders.reduce((sum, o) => sum + (o.totalCents || 0), 0) / sourceOrders.length)
          : 0,
      };
      sourceMetrics[source].revenueFormatted = `$${(sourceMetrics[source].revenue / 100).toFixed(2)}`;
      sourceMetrics[source].aovFormatted = `$${(sourceMetrics[source].averageOrderValue / 100).toFixed(2)}`;
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalCents || 0), 0);

    // Calculate percentages
    sources.forEach(source => {
      sourceMetrics[source].orderPercentage = totalOrders > 0
        ? Math.round((sourceMetrics[source].orders / totalOrders) * 100)
        : 0;
      sourceMetrics[source].revenuePercentage = totalRevenue > 0
        ? Math.round((sourceMetrics[source].revenue / totalRevenue) * 100)
        : 0;
    });

    // Daily breakdown for chart
    const dailyBreakdown = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });

      dailyBreakdown.push({
        date: currentDate.toISOString().split("T")[0],
        web: dayOrders.filter(o => o.orderSource === "WEB").length,
        kiosk: dayOrders.filter(o => o.orderSource === "KIOSK").length,
        mobile: dayOrders.filter(o => o.orderSource === "MOBILE").length,
        staff: dayOrders.filter(o => o.orderSource === "STAFF").length,
        total: dayOrders.length,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return reply.send({
      period,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalOrders,
        totalRevenue,
        totalRevenueFormatted: `$${(totalRevenue / 100).toFixed(2)}`,
      },
      bySource: sourceMetrics,
      dailyBreakdown,
    });
  } catch (error) {
    console.error("Order sources analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch order sources analytics" });
  }
});

// GET /analytics/upselling - Track add-on orders, revenue, and item popularity
app.get("/analytics/upselling", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const { period = "week", locationId } = req.query;
  const { start, end } = getDateRange(period);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return reply.status(404).send({ error: "Tenant not found" });
    }

    const baseWhereClause = {
      tenantId: tenant.id,
      createdAt: { gte: start, lte: end },
    };
    if (locationId) baseWhereClause.locationId = locationId;

    // Get all add-on orders (orders with parentOrderId and addOnType)
    const addOnOrders = await prisma.order.findMany({
      where: {
        ...baseWhereClause,
        parentOrderId: { not: null },
        addOnType: { not: null },
      },
      include: {
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                category: true,
                categoryType: true,
              },
            },
          },
        },
      },
    });

    // Get total parent orders count for conversion rate
    const totalParentOrders = await prisma.order.count({
      where: {
        ...baseWhereClause,
        parentOrderId: null,
        status: { in: ["COMPLETED", "PAID", "QUEUED", "PREPPING", "READY", "SERVING"] },
      },
    });

    // Count unique parent orders that have at least one add-on
    const parentOrdersWithAddons = new Set(addOnOrders.map(o => o.parentOrderId));

    // Aggregate by add-on type
    const byType = {
      PAID_ADDON: { count: 0, revenue: 0 },
      REFILL: { count: 0, revenue: 0 },
      EXTRA_VEG: { count: 0, revenue: 0 },
      DESSERT_READY: { count: 0, revenue: 0 },
    };

    // Aggregate by menu item for popularity
    const itemStats = {};

    let totalAddOnRevenue = 0;

    for (const order of addOnOrders) {
      const type = order.addOnType || "PAID_ADDON";
      if (byType[type]) {
        byType[type].count += 1;
        byType[type].revenue += order.totalCents || 0;
      }
      totalAddOnRevenue += order.totalCents || 0;

      // Track item popularity
      for (const item of order.items) {
        if (!item.menuItem) continue;
        const itemId = item.menuItem.id;
        if (!itemStats[itemId]) {
          itemStats[itemId] = {
            id: itemId,
            name: item.menuItem.name,
            category: item.menuItem.category || "Other",
            categoryType: item.menuItem.categoryType,
            quantity: 0,
            revenue: 0,
            orderCount: 0,
          };
        }
        itemStats[itemId].quantity += item.quantity;
        itemStats[itemId].revenue += item.priceCents * item.quantity;
        itemStats[itemId].orderCount += 1;
      }
    }

    // Sort items by popularity (order count)
    const topAddOnItems = Object.values(itemStats)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10)
      .map(item => ({
        ...item,
        revenueFormatted: `$${(item.revenue / 100).toFixed(2)}`,
      }));

    // Sort items by revenue
    const topByRevenue = Object.values(itemStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(item => ({
        ...item,
        revenueFormatted: `$${(item.revenue / 100).toFixed(2)}`,
      }));

    // Calculate conversion rate
    const conversionRate = totalParentOrders > 0
      ? ((parentOrdersWithAddons.size / totalParentOrders) * 100).toFixed(1)
      : "0.0";

    // Format type breakdown
    const typeBreakdown = [
      {
        type: "PAID_ADDON",
        label: "Paid Add-Ons",
        emoji: "🛒",
        count: byType.PAID_ADDON.count,
        revenue: byType.PAID_ADDON.revenue,
        revenueFormatted: `$${(byType.PAID_ADDON.revenue / 100).toFixed(2)}`,
      },
      {
        type: "REFILL",
        label: "Drink Refills",
        emoji: "🥤",
        count: byType.REFILL.count,
        revenue: byType.REFILL.revenue,
        revenueFormatted: `$${(byType.REFILL.revenue / 100).toFixed(2)}`,
      },
      {
        type: "EXTRA_VEG",
        label: "Extra Vegetables",
        emoji: "🥬",
        count: byType.EXTRA_VEG.count,
        revenue: byType.EXTRA_VEG.revenue,
        revenueFormatted: `$${(byType.EXTRA_VEG.revenue / 100).toFixed(2)}`,
      },
      {
        type: "DESSERT_READY",
        label: "Dessert Deliveries",
        emoji: "🍨",
        count: byType.DESSERT_READY.count,
        revenue: byType.DESSERT_READY.revenue,
        revenueFormatted: `$${(byType.DESSERT_READY.revenue / 100).toFixed(2)}`,
      },
    ];

    return reply.send({
      period,
      dateRange: { start, end },
      summary: {
        totalAddOnOrders: addOnOrders.length,
        totalAddOnRevenue,
        totalAddOnRevenueFormatted: `$${(totalAddOnRevenue / 100).toFixed(2)}`,
        ordersWithAddons: parentOrdersWithAddons.size,
        totalParentOrders,
        conversionRate: `${conversionRate}%`,
        averageAddOnValue: addOnOrders.length > 0
          ? `$${((totalAddOnRevenue / addOnOrders.length) / 100).toFixed(2)}`
          : "$0.00",
      },
      byType: typeBreakdown,
      topByPopularity: topAddOnItems,
      topByRevenue,
    });
  } catch (error) {
    console.error("Upselling analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch upselling analytics" });
  }
});

// ====================
// GA4 WEBSITE ANALYTICS
// ====================

// Helper to convert period to GA4 date range
function getGA4DateRange(period) {
  const today = new Date();
  const formatDate = (d) => d.toISOString().split("T")[0];

  switch (period) {
    case "today":
      return { startDate: "today", endDate: "today" };
    case "yesterday":
      return { startDate: "yesterday", endDate: "yesterday" };
    case "week":
      return { startDate: "7daysAgo", endDate: "today" };
    case "month":
      return { startDate: "30daysAgo", endDate: "today" };
    case "quarter":
      return { startDate: "90daysAgo", endDate: "today" };
    case "year":
      return { startDate: "365daysAgo", endDate: "today" };
    default:
      return { startDate: "7daysAgo", endDate: "today" };
  }
}

// GET /analytics/ga4/traffic - Website traffic overview
app.get("/analytics/ga4/traffic", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  const { period = "week" } = req.query;
  const dateRange = getGA4DateRange(period);

  try {
    // Run report for traffic overview
    const [response] = await ga4Client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "newUsers" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    });

    // Parse timeline data
    const timeline = response.rows?.map((row) => ({
      date: row.dimensionValues[0].value,
      activeUsers: parseInt(row.metricValues[0].value) || 0,
      sessions: parseInt(row.metricValues[1].value) || 0,
      pageViews: parseInt(row.metricValues[2].value) || 0,
      bounceRate: parseFloat(row.metricValues[3].value) || 0,
      avgSessionDuration: parseFloat(row.metricValues[4].value) || 0,
      newUsers: parseInt(row.metricValues[5].value) || 0,
    })) || [];

    // Calculate totals
    const totals = timeline.reduce(
      (acc, day) => ({
        activeUsers: acc.activeUsers + day.activeUsers,
        sessions: acc.sessions + day.sessions,
        pageViews: acc.pageViews + day.pageViews,
        newUsers: acc.newUsers + day.newUsers,
      }),
      { activeUsers: 0, sessions: 0, pageViews: 0, newUsers: 0 }
    );

    // Calculate averages
    const avgBounceRate = timeline.length > 0
      ? (timeline.reduce((sum, d) => sum + d.bounceRate, 0) / timeline.length * 100).toFixed(1)
      : "0.0";
    const avgSessionDuration = timeline.length > 0
      ? Math.round(timeline.reduce((sum, d) => sum + d.avgSessionDuration, 0) / timeline.length)
      : 0;

    return reply.send({
      period,
      dateRange,
      summary: {
        activeUsers: totals.activeUsers,
        sessions: totals.sessions,
        pageViews: totals.pageViews,
        newUsers: totals.newUsers,
        bounceRate: `${avgBounceRate}%`,
        avgSessionDuration: `${Math.floor(avgSessionDuration / 60)}m ${avgSessionDuration % 60}s`,
      },
      timeline,
    });
  } catch (error) {
    console.error("GA4 traffic error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 traffic data" });
  }
});

// GET /analytics/ga4/pages - Top pages by views
app.get("/analytics/ga4/pages", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  const { period = "week", limit = 20 } = req.query;
  const dateRange = getGA4DateRange(period);

  try {
    const [response] = await ga4Client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "activeUsers" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: parseInt(limit),
    });

    const pages = response.rows?.map((row) => ({
      path: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value) || 0,
      users: parseInt(row.metricValues[1].value) || 0,
      avgDuration: Math.round(parseFloat(row.metricValues[2].value) || 0),
      bounceRate: (parseFloat(row.metricValues[3].value) * 100).toFixed(1),
    })) || [];

    return reply.send({
      period,
      dateRange,
      pages,
      total: pages.reduce((sum, p) => sum + p.views, 0),
    });
  } catch (error) {
    console.error("GA4 pages error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 page data" });
  }
});

// GET /analytics/ga4/sources - Traffic sources
app.get("/analytics/ga4/sources", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  const { period = "week" } = req.query;
  const dateRange = getGA4DateRange(period);

  try {
    const [response] = await ga4Client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "conversions" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 20,
    });

    const sources = response.rows?.map((row) => ({
      source: row.dimensionValues[0].value || "(direct)",
      medium: row.dimensionValues[1].value || "(none)",
      sessions: parseInt(row.metricValues[0].value) || 0,
      users: parseInt(row.metricValues[1].value) || 0,
      conversions: parseInt(row.metricValues[2].value) || 0,
    })) || [];

    return reply.send({
      period,
      dateRange,
      sources,
    });
  } catch (error) {
    console.error("GA4 sources error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 source data" });
  }
});

// GET /analytics/ga4/devices - Device breakdown
app.get("/analytics/ga4/devices", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  const { period = "week" } = req.query;
  const dateRange = getGA4DateRange(period);

  try {
    const [response] = await ga4Client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
      ],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    });

    const devices = response.rows?.map((row) => ({
      device: row.dimensionValues[0].value,
      users: parseInt(row.metricValues[0].value) || 0,
      sessions: parseInt(row.metricValues[1].value) || 0,
      pageViews: parseInt(row.metricValues[2].value) || 0,
    })) || [];

    const total = devices.reduce((sum, d) => sum + d.users, 0);
    const devicesWithPercentage = devices.map((d) => ({
      ...d,
      percentage: total > 0 ? ((d.users / total) * 100).toFixed(1) : "0.0",
    }));

    return reply.send({
      period,
      dateRange,
      devices: devicesWithPercentage,
      total,
    });
  } catch (error) {
    console.error("GA4 devices error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 device data" });
  }
});

// GET /analytics/ga4/geo - Geographic distribution
app.get("/analytics/ga4/geo", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  const { period = "week" } = req.query;
  const dateRange = getGA4DateRange(period);

  try {
    const [response] = await ga4Client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "city" }, { name: "country" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
      ],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 20,
    });

    const locations = response.rows?.map((row) => ({
      city: row.dimensionValues[0].value || "(not set)",
      country: row.dimensionValues[1].value || "(not set)",
      users: parseInt(row.metricValues[0].value) || 0,
      sessions: parseInt(row.metricValues[1].value) || 0,
    })) || [];

    return reply.send({
      period,
      dateRange,
      locations,
    });
  } catch (error) {
    console.error("GA4 geo error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 geo data" });
  }
});

// GET /analytics/ga4/realtime - Real-time users
app.get("/analytics/ga4/realtime", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  try {
    const [response] = await ga4Client.runRealtimeReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dimensions: [{ name: "unifiedScreenName" }],
      metrics: [{ name: "activeUsers" }],
      limit: 10,
    });

    const activePages = response.rows?.map((row) => ({
      page: row.dimensionValues[0].value,
      users: parseInt(row.metricValues[0].value) || 0,
    })) || [];

    const totalActiveUsers = activePages.reduce((sum, p) => sum + p.users, 0);

    return reply.send({
      activeUsers: totalActiveUsers,
      topPages: activePages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GA4 realtime error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 realtime data" });
  }
});

// GET /analytics/ga4/funnel - Order conversion funnel
app.get("/analytics/ga4/funnel", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  const { period = "week" } = req.query;
  const dateRange = getGA4DateRange(period);

  try {
    // Get event counts for funnel steps
    const [response] = await ga4Client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: [
              "page_view",
              "location_selected",
              "add_to_cart",
              "begin_checkout",
              "purchase",
            ],
          },
        },
      },
    });

    // Build funnel steps
    const eventMap = {};
    response.rows?.forEach((row) => {
      eventMap[row.dimensionValues[0].value] = {
        count: parseInt(row.metricValues[0].value) || 0,
        users: parseInt(row.metricValues[1].value) || 0,
      };
    });

    const funnelSteps = [
      { name: "Page View", event: "page_view", ...eventMap["page_view"] || { count: 0, users: 0 } },
      { name: "Location Selected", event: "location_selected", ...eventMap["location_selected"] || { count: 0, users: 0 } },
      { name: "Add to Cart", event: "add_to_cart", ...eventMap["add_to_cart"] || { count: 0, users: 0 } },
      { name: "Begin Checkout", event: "begin_checkout", ...eventMap["begin_checkout"] || { count: 0, users: 0 } },
      { name: "Purchase", event: "purchase", ...eventMap["purchase"] || { count: 0, users: 0 } },
    ];

    // Calculate conversion rates between steps
    for (let i = 1; i < funnelSteps.length; i++) {
      const prev = funnelSteps[i - 1].users;
      const curr = funnelSteps[i].users;
      funnelSteps[i].conversionRate = prev > 0 ? ((curr / prev) * 100).toFixed(1) : "0.0";
      funnelSteps[i].dropOff = prev > 0 ? (((prev - curr) / prev) * 100).toFixed(1) : "0.0";
    }
    funnelSteps[0].conversionRate = "100.0";
    funnelSteps[0].dropOff = "0.0";

    // Overall conversion rate
    const startUsers = funnelSteps[0].users;
    const endUsers = funnelSteps[funnelSteps.length - 1].users;
    const overallConversion = startUsers > 0 ? ((endUsers / startUsers) * 100).toFixed(2) : "0.00";

    return reply.send({
      period,
      dateRange,
      steps: funnelSteps,
      overallConversionRate: `${overallConversion}%`,
      totalVisitors: startUsers,
      totalPurchases: endUsers,
    });
  } catch (error) {
    console.error("GA4 funnel error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 funnel data" });
  }
});

// GET /analytics/ga4/hourly - Hourly activity
app.get("/analytics/ga4/hourly", async (req, reply) => {
  if (!ga4Client) {
    return reply.status(503).send({ error: "GA4 not configured" });
  }

  const { period = "week" } = req.query;
  const dateRange = getGA4DateRange(period);

  try {
    const [response] = await ga4Client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "hour" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "hour" }, desc: false }],
    });

    const hourly = response.rows?.map((row) => ({
      hour: parseInt(row.dimensionValues[0].value),
      hourLabel: `${row.dimensionValues[0].value}:00`,
      users: parseInt(row.metricValues[0].value) || 0,
      sessions: parseInt(row.metricValues[1].value) || 0,
    })) || [];

    // Find peak hour
    const peakHour = hourly.reduce((max, h) => (h.users > max.users ? h : max), { users: 0 });

    return reply.send({
      period,
      dateRange,
      hourly,
      peakHour: peakHour.hourLabel || "N/A",
      peakUsers: peakHour.users,
    });
  } catch (error) {
    console.error("GA4 hourly error:", error);
    return reply.status(500).send({ error: "Failed to fetch GA4 hourly data" });
  }
});

// ====================
// GROUP ORDERS
// ====================

// Helper to generate 6-character group code
function generateGroupCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /group-orders - Create a new group order (host initiates)
app.post("/group-orders", async (req, reply) => {
  const { locationId, tenantId, hostUserId, hostGuestId, estimatedArrival } = req.body || {};

  if (!locationId || !tenantId) {
    return reply.code(400).send({ error: "locationId and tenantId required" });
  }

  if (!hostUserId && !hostGuestId) {
    return reply.code(400).send({ error: "Either hostUserId or hostGuestId required" });
  }

  // Generate unique code (retry if collision)
  let code;
  let attempts = 0;
  while (!code && attempts < 10) {
    const candidate = generateGroupCode();
    const existing = await prisma.groupOrder.findUnique({ where: { code: candidate } });
    if (!existing) code = candidate;
    attempts++;
  }

  if (!code) {
    return reply.code(500).send({ error: "Failed to generate unique group code" });
  }

  // Set expiry to 30 minutes from now
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);

  const groupOrder = await prisma.groupOrder.create({
    data: {
      code,
      locationId,
      tenantId,
      hostUserId: hostUserId || null,
      hostGuestId: hostGuestId || null,
      estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
      expiresAt,
      status: "GATHERING",
    },
    include: {
      location: true,
      hostUser: true,
      hostGuest: true,
      orders: {
        include: {
          items: { include: { menuItem: true } },
          user: true,
          guest: true,
        },
      },
    },
  });

  return groupOrder;
});

// GET /group-orders/:code - Get group order by code (for joining)
app.get("/group-orders/:code", async (req, reply) => {
  const { code } = req.params;

  const groupOrder = await prisma.groupOrder.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      location: true,
      hostUser: true,
      hostGuest: true,
      orders: {
        include: {
          items: { include: { menuItem: true } },
          user: true,
          guest: true,
          seat: true,
        },
      },
      memberUsers: true,
      memberGuests: true,
    },
  });

  if (!groupOrder) {
    return reply.code(404).send({ error: "Group not found" });
  }

  // Check if expired
  if (new Date() > groupOrder.expiresAt && groupOrder.status === "GATHERING") {
    // Auto-cancel expired groups
    await prisma.groupOrder.update({
      where: { id: groupOrder.id },
      data: { status: "CANCELLED" },
    });
    return reply.code(410).send({ error: "Group order has expired" });
  }

  return groupOrder;
});

// POST /group-orders/:code/join - Join a group order
app.post("/group-orders/:code/join", async (req, reply) => {
  const { code } = req.params;
  const { userId, guestId } = req.body || {};

  if (!userId && !guestId) {
    return reply.code(400).send({ error: "Either userId or guestId required" });
  }

  const groupOrder = await prisma.groupOrder.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      orders: true,
      memberUsers: true,
      memberGuests: true,
    },
  });

  if (!groupOrder) {
    return reply.code(404).send({ error: "Group not found" });
  }

  // Check if can still join
  if (groupOrder.status !== "GATHERING") {
    return reply.code(400).send({ error: "Group is no longer accepting new members" });
  }

  if (new Date() > groupOrder.expiresAt) {
    return reply.code(410).send({ error: "Group order has expired" });
  }

  // Check max group size (8 people)
  const memberCount = groupOrder.orders.length + 1; // +1 for host
  if (memberCount >= 8) {
    return reply.code(400).send({ error: "Group is full (max 8 people)" });
  }

  // Add member to group
  const updateData = {};
  if (userId) {
    // Check if already a member
    const alreadyMember = groupOrder.memberUsers.some(u => u.id === userId);
    if (!alreadyMember) {
      updateData.memberUsers = { connect: { id: userId } };
    }
  } else if (guestId) {
    const alreadyMember = groupOrder.memberGuests.some(g => g.id === guestId);
    if (!alreadyMember) {
      updateData.memberGuests = { connect: { id: guestId } };
    }
  }

  const updated = await prisma.groupOrder.update({
    where: { id: groupOrder.id },
    data: updateData,
    include: {
      location: true,
      hostUser: true,
      hostGuest: true,
      orders: {
        include: {
          items: { include: { menuItem: true } },
          user: true,
          guest: true,
        },
      },
      memberUsers: true,
      memberGuests: true,
    },
  });

  return updated;
});

// PATCH /group-orders/:code - Update group order (host controls)
app.patch("/group-orders/:code", async (req, reply) => {
  const { code } = req.params;
  const { status, paymentMethod, closedAt } = req.body || {};

  const groupOrder = await prisma.groupOrder.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!groupOrder) {
    return reply.code(404).send({ error: "Group not found" });
  }

  const data = {};

  // Close group (stop accepting new members)
  if (status === "CLOSED" && groupOrder.status === "GATHERING") {
    data.status = "CLOSED";
    data.closedAt = new Date();
  }

  // Set payment method
  if (paymentMethod && ["HOST_PAYS_ALL", "PAY_YOUR_OWN"].includes(paymentMethod)) {
    data.paymentMethod = paymentMethod;
  }

  // Mark as paying
  if (status === "PAYING" && (groupOrder.status === "CLOSED" || groupOrder.status === "GATHERING")) {
    data.status = "PAYING";
    if (!groupOrder.closedAt) {
      data.closedAt = new Date();
    }
  }

  // Mark as paid
  if (status === "PAID") {
    data.status = "PAID";
    data.finalizedAt = new Date();
  }

  // Mark as partially paid
  if (status === "PARTIALLY_PAID") {
    data.status = "PARTIALLY_PAID";
  }

  // Cancel group
  if (status === "CANCELLED") {
    data.status = "CANCELLED";
  }

  const updated = await prisma.groupOrder.update({
    where: { id: groupOrder.id },
    data,
    include: {
      location: true,
      hostUser: true,
      hostGuest: true,
      orders: {
        include: {
          items: { include: { menuItem: true } },
          user: true,
          guest: true,
        },
      },
      memberUsers: true,
      memberGuests: true,
    },
  });

  return updated;
});

// POST /group-orders/:code/orders - Add an order to a group
app.post("/group-orders/:code/orders", async (req, reply) => {
  const { code } = req.params;
  const { items, userId, guestId } = req.body || {};

  if (!items || !items.length) {
    return reply.code(400).send({ error: "items required" });
  }

  if (!userId && !guestId) {
    return reply.code(400).send({ error: "Either userId or guestId required" });
  }

  const groupOrder = await prisma.groupOrder.findUnique({
    where: { code: code.toUpperCase() },
    include: { orders: true },
  });

  if (!groupOrder) {
    return reply.code(404).send({ error: "Group not found" });
  }

  if (groupOrder.status !== "GATHERING" && groupOrder.status !== "CLOSED") {
    return reply.code(400).send({ error: "Cannot add orders to this group" });
  }

  // Calculate total for this order
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((item) => item.menuItemId) } },
  });

  function calculateItemPrice(menuItem, quantity) {
    if (quantity <= menuItem.includedQuantity) return 0;
    if (menuItem.includedQuantity > 0) {
      const extraQuantity = quantity - menuItem.includedQuantity;
      return menuItem.basePriceCents + menuItem.additionalPriceCents * (extraQuantity - 1);
    }
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
      selectedValue: item.selectedValue || null,
    };
  });

  // Generate order numbers
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const orderQrCode = `ORDER-${groupOrder.locationId.slice(-8)}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  // Check if this is the host's order - ensure boolean (not null/undefined)
  const isHost = Boolean((userId && userId === groupOrder.hostUserId) || (guestId && guestId === groupOrder.hostGuestId));

  const order = await prisma.order.create({
    data: {
      orderNumber,
      orderQrCode,
      tenant: { connect: { id: groupOrder.tenantId } },
      location: { connect: { id: groupOrder.locationId } },
      totalCents,
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      ...(guestId ? { guest: { connect: { id: guestId } } } : {}),
      groupOrder: { connect: { id: groupOrder.id } },
      isGroupHost: isHost,
      estimatedArrival: groupOrder.estimatedArrival,
      items: {
        create: orderItems,
      },
    },
    include: {
      items: { include: { menuItem: true } },
      user: true,
      guest: true,
    },
  });

  return order;
});

// DELETE /group-orders/:code/orders/:orderId - Remove an order from a group
app.delete("/group-orders/:code/orders/:orderId", async (req, reply) => {
  const { code, orderId } = req.params;

  const groupOrder = await prisma.groupOrder.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!groupOrder) {
    return reply.code(404).send({ error: "Group not found" });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  if (order.groupOrderId !== groupOrder.id) {
    return reply.code(400).send({ error: "Order does not belong to this group" });
  }

  // Can only delete if not yet paid
  if (order.paymentStatus === "PAID") {
    return reply.code(400).send({ error: "Cannot delete paid orders" });
  }

  // Delete order items first, then the order
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });

  return { success: true };
});

// POST /group-orders/:code/transfer-host - Transfer host role to another member
app.post("/group-orders/:code/transfer-host", async (req, reply) => {
  const { code } = req.params;
  const { newHostUserId, newHostGuestId } = req.body || {};

  if (!newHostUserId && !newHostGuestId) {
    return reply.code(400).send({ error: "Either newHostUserId or newHostGuestId required" });
  }

  const groupOrder = await prisma.groupOrder.findUnique({
    where: { code: code.toUpperCase() },
    include: { orders: true },
  });

  if (!groupOrder) {
    return reply.code(404).send({ error: "Group not found" });
  }

  // Verify new host has an order in the group
  const newHostOrder = groupOrder.orders.find(o =>
    (newHostUserId && o.userId === newHostUserId) ||
    (newHostGuestId && o.guestId === newHostGuestId)
  );

  if (!newHostOrder) {
    return reply.code(400).send({ error: "New host must have an order in the group" });
  }

  // Update host
  const updated = await prisma.groupOrder.update({
    where: { id: groupOrder.id },
    data: {
      hostUserId: newHostUserId || null,
      hostGuestId: newHostGuestId || null,
    },
    include: {
      location: true,
      hostUser: true,
      hostGuest: true,
      orders: {
        include: {
          items: { include: { menuItem: true } },
          user: true,
          guest: true,
        },
      },
    },
  });

  // Update isGroupHost flag on orders
  await prisma.order.updateMany({
    where: { groupOrderId: groupOrder.id },
    data: { isGroupHost: false },
  });
  await prisma.order.update({
    where: { id: newHostOrder.id },
    data: { isGroupHost: true },
  });

  return updated;
});

// POST /group-orders/:code/complete - Complete group order and notify kitchen/cleaning
app.post("/group-orders/:code/complete", async (req, reply) => {
  const { code } = req.params;
  const { seatIds, seatingOption } = req.body || {};

  const groupOrder = await prisma.groupOrder.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      orders: {
        include: {
          items: { include: { menuItem: true } },
          user: true,
          guest: true,
        },
      },
      location: true,
    },
  });

  if (!groupOrder) {
    return reply.code(404).send({ error: "Group not found" });
  }

  // If group is already PAID and all orders are QUEUED, return success (idempotent)
  if (groupOrder.status === "PAID") {
    const allQueued = groupOrder.orders.every(o => o.status === "QUEUED");
    if (allQueued) {
      console.log(`[Group Order Already Complete] Code: ${groupOrder.code} - returning existing data`);
      return groupOrder;
    }
  }

  // Verify all orders are paid (check paymentStatus, not status - status changes to QUEUED when paid)
  const allPaid = groupOrder.orders.every(o => o.paymentStatus === "PAID");
  if (!allPaid) {
    return reply.code(400).send({ error: "Not all orders are paid" });
  }

  // Update group status to PAID
  const updatedGroup = await prisma.groupOrder.update({
    where: { id: groupOrder.id },
    data: { status: "PAID" },
    include: {
      orders: {
        include: {
          items: { include: { menuItem: true } },
          user: true,
          guest: true,
        },
      },
      location: true,
    },
  });

  const now = new Date();

  // If seat IDs provided, reserve them and assign to orders
  if (seatIds && seatIds.length > 0) {
    for (let i = 0; i < seatIds.length && i < groupOrder.orders.length; i++) {
      const seatId = seatIds[i];
      const order = groupOrder.orders[i];

      // Reserve the seat
      await prisma.seat.update({
        where: { id: seatId },
        data: {
          status: "RESERVED",
          reservedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min reservation
        },
      });

      // Assign seat to order and queue it for kitchen
      await prisma.order.update({
        where: { id: order.id },
        data: {
          seatId: seatId,
          podSelectionMethod: "GROUP_HOST_SELECTED",
          status: "QUEUED",
          queuedAt: now,
          paidAt: order.paidAt || now,
        },
      });
    }
  } else {
    // No seats provided - still queue orders for kitchen
    for (const order of groupOrder.orders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "QUEUED",
          queuedAt: now,
          paidAt: order.paidAt || now,
        },
      });
    }
  }

  console.log(`[Group Order Completed] Code: ${groupOrder.code}, Orders: ${groupOrder.orders.length}, Seating Option: ${seatingOption}, Kitchen notified`);

  return updatedGroup;
});

// ====================
// LANGUAGE ANALYTICS
// ====================

// POST /analytics/language - Track a language visit
app.post("/analytics/language", async (req, reply) => {
  try {
    const {
      browserLanguage,
      primaryLanguage,
      resolvedLocale,
      wasSupported,
      sessionId,
      userId,
    } = req.body;

    if (!browserLanguage || !primaryLanguage || !resolvedLocale) {
      return reply.status(400).send({ error: "Missing required fields" });
    }

    const visit = await prisma.languageVisit.create({
      data: {
        browserLanguage,
        primaryLanguage,
        resolvedLocale,
        wasSupported: wasSupported ?? false,
        sessionId,
        userId,
        userAgent: req.headers["user-agent"],
      },
    });

    return { success: true, id: visit.id };
  } catch (error) {
    console.error("Language analytics error:", error);
    return reply.status(500).send({ error: "Failed to track language visit" });
  }
});

// GET /analytics/language - Get language analytics data
app.get("/analytics/language", async (req, reply) => {
  try {
    const { days = 30, tenantSlug } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Get all language visits in the time period
    const visits = await prisma.languageVisit.findMany({
      where: {
        createdAt: { gte: since },
      },
      select: {
        primaryLanguage: true,
        resolvedLocale: true,
        wasSupported: true,
        createdAt: true,
      },
    });

    // Aggregate by primary language (including unsupported)
    const languageCounts = {};
    const unsupportedLanguages = {};
    const localeCounts = {};
    const dailyData = {};

    for (const visit of visits) {
      // Count primary languages
      languageCounts[visit.primaryLanguage] = (languageCounts[visit.primaryLanguage] || 0) + 1;

      // Count resolved locales
      localeCounts[visit.resolvedLocale] = (localeCounts[visit.resolvedLocale] || 0) + 1;

      // Track unsupported languages separately
      if (!visit.wasSupported) {
        unsupportedLanguages[visit.primaryLanguage] = (unsupportedLanguages[visit.primaryLanguage] || 0) + 1;
      }

      // Daily breakdown
      const dateKey = visit.createdAt.toISOString().split("T")[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { total: 0, supported: 0, unsupported: 0 };
      }
      dailyData[dateKey].total++;
      if (visit.wasSupported) {
        dailyData[dateKey].supported++;
      } else {
        dailyData[dateKey].unsupported++;
      }
    }

    // Sort and format results
    const sortedLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({
        language,
        count,
        percentage: ((count / visits.length) * 100).toFixed(1),
        isSupported: !unsupportedLanguages[language] || unsupportedLanguages[language] < count,
      }));

    const sortedUnsupported = Object.entries(unsupportedLanguages)
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({
        language,
        count,
        percentage: ((count / visits.length) * 100).toFixed(1),
      }));

    const sortedLocales = Object.entries(localeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([locale, count]) => ({
        locale,
        count,
        percentage: ((count / visits.length) * 100).toFixed(1),
      }));

    // Format daily data for charts
    const dailyBreakdown = Object.entries(dailyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        ...data,
      }));

    return {
      summary: {
        totalVisits: visits.length,
        uniqueLanguages: Object.keys(languageCounts).length,
        unsupportedLanguageVisits: Object.values(unsupportedLanguages).reduce((a, b) => a + b, 0),
        supportedLanguageVisits: visits.length - Object.values(unsupportedLanguages).reduce((a, b) => a + b, 0),
      },
      allLanguages: sortedLanguages,
      unsupportedLanguages: sortedUnsupported,
      resolvedLocales: sortedLocales,
      dailyBreakdown,
      period: {
        days: parseInt(days),
        from: since.toISOString(),
        to: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Language analytics error:", error);
    return reply.status(500).send({ error: "Failed to fetch language analytics" });
  }
});

// ====================
// START SERVER
// ====================

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 API server running on http://localhost:${PORT}`);

  // Run initial cleanup and synchronization on startup
  releaseExpiredReservations();
  synchronizePodStatuses();
});
