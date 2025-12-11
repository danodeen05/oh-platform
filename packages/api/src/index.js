import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Initialize Anthropic client (uses ANTHROPIC_API_KEY env var automatically)
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

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

// Send notification when pod is ready (placeholder for now)
async function notifyPodReady(order) {
  const notificationMethod = "SYSTEM"; // Will be PUSH/SMS/EMAIL when implemented

  // Update order with notification timestamp
  await prisma.order.update({
    where: { id: order.id },
    data: {
      notifiedAt: new Date(),
      notificationMethod,
    },
  });

  // TODO: Implement actual notifications
  // - Push notification via web push API / Firebase
  // - SMS via Twilio
  // - Email via SendGrid

  console.log(`[NOTIFICATION] Order ${order.kitchenOrderNumber || order.orderNumber.slice(-6)}: Pod ${order.seat.number} is ready!`);

  return { sent: true, method: notificationMethod };
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

      return {
        ...location,
        stats: {
          availableSeats,
          totalSeats,
          avgWaitMinutes,
        }
      };
    })
  );

  return locationsWithRealTimeStats;
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
            in: ["QUEUED", "PREPPING", "READY", "SERVING"],
          },
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

// GET /orders/status - Get real-time order status by QR code
app.get("/orders/status", async (req, reply) => {
  const { orderQrCode } = req.query || {};

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

      // Items
      items: order.items.map((item) => ({
        id: item.id,
        name: item.menuItem.name,
        quantity: item.quantity,
        selectedValue: item.selectedValue,
        priceCents: item.priceCents,
      })),
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
  const { locationId, tenantId, items, seatId, estimatedArrival, podSelectionMethod } =
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

    // Reserve the seat and set expiry on the order
    await Promise.all([
      prisma.seat.update({
        where: { id: order.seatId },
        data: { status: "RESERVED" },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { podReservationExpiry: expiryTime },
      }),
    ]);

    console.log(`Pod ${order.seat?.number} reserved for order ${order.kitchenOrderNumber}, expires at ${expiryTime.toISOString()}`);
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
    // Show orders that have confirmed pod arrival OR are arriving (reserved but not confirmed)
    OR: [
      { podConfirmedAt: { not: null } }, // Customer confirmed at pod
      {
        seatId: { not: null }, // Has reserved seat
        podConfirmedAt: null,  // Not confirmed yet
        arrivedAt: null,       // Not checked in yet (arriving)
      },
    ],
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
    },
  });

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
        "$5 referral bonus per friend",
        "1% cashback on orders",
        "Early access to new menu items",
      ],
    },
    NOODLE_MASTER: {
      referralBonus: 500,
      cashbackPercent: 2,
      perks: [
        "$5 referral bonus per friend",
        "2% cashback on orders",
        "Priority seating",
        "Exclusive member events",
        "Free bowl on tier upgrade",
      ],
    },
    BEEF_BOSS: {
      referralBonus: 500,
      cashbackPercent: 3,
      perks: [
        "$5 referral bonus per friend",
        "3% cashback on orders",
        "Exclusive merchandise drops",
        "Complimentary premium add-ons",
        "Annual VIP Gift & Recognition",
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

// ====================
// FORTUNE COOKIE
// ====================

// Get "This Day in History" facts
function getThisDayInHistory() {
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();

  // A collection of interesting historical facts for each day
  // This is a small sample - in production you might use an external API
  const historicalFacts = [
    { date: "January 1", year: 1863, event: "The Emancipation Proclamation was issued by President Lincoln" },
    { date: "January 1", year: 2002, event: "The Euro became the official currency of 12 European countries" },
    { date: "February 14", year: 1929, event: "The St. Valentine's Day Massacre occurred in Chicago" },
    { date: "March 14", year: 1879, event: "Albert Einstein was born" },
    { date: "April 15", year: 1912, event: "The Titanic sank after hitting an iceberg" },
    { date: "May 5", year: 1961, event: "Alan Shepard became the first American in space" },
    { date: "June 28", year: 1914, event: "Archduke Franz Ferdinand was assassinated, triggering WWI" },
    { date: "July 4", year: 1776, event: "The Declaration of Independence was adopted" },
    { date: "July 20", year: 1969, event: "Neil Armstrong became the first human to walk on the Moon" },
    { date: "August 6", year: 1991, event: "The World Wide Web became publicly available" },
    { date: "September 11", year: 2001, event: "The September 11 attacks occurred in the United States" },
    { date: "October 31", year: 1517, event: "Martin Luther posted his 95 Theses" },
    { date: "November 9", year: 1989, event: "The Berlin Wall fell" },
    { date: "December 10", year: 1901, event: "The first Nobel Prizes were awarded" },
    { date: "December 17", year: 1903, event: "The Wright Brothers achieved the first powered flight" },
  ];

  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const todayStr = `${monthNames[month]} ${day}`;

  // Find facts for today (or return null if none found)
  const todayFacts = historicalFacts.filter(f => f.date === todayStr);
  if (todayFacts.length > 0) {
    return todayFacts[Math.floor(Math.random() * todayFacts.length)];
  }

  // If no fact for today, return a random one
  return historicalFacts[Math.floor(Math.random() * historicalFacts.length)];
}

// Generate lucky numbers based on order details
function generateLuckyNumbers(orderId, userName, orderDate) {
  // Create a seed from order details for pseudo-random but consistent numbers
  const seed = orderId + (userName || "guest") + orderDate;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  const numbers = [];
  const used = new Set();

  for (let i = 0; i < 6; i++) {
    let num = Math.abs((hash * (i + 1) * 31) % 49) + 1;
    while (used.has(num)) {
      num = (num % 49) + 1;
    }
    used.add(num);
    numbers.push(num);
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

// Generate AI-powered Chinese word based on current events/trends
async function generateChineseWord(anthropic) {
  if (!anthropic) return null;

  try {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const prompt = `You are a Chinese language teacher creating a "Word of the Day" for an American audience at a beef noodle soup restaurant.

Today's date: ${today}

Pick ONE interesting Chinese word or short phrase that could be:
- Related to current events, trending topics, or pop culture (movies, music, sports, tech)
- A useful food-related term
- A fun slang expression popular with young people
- A culturally significant term
- Something seasonally relevant

Requirements:
- Use TRADITIONAL Chinese characters (Taiwan style, not simplified)
- Include proper pinyin with tone marks (ā, á, ǎ, à, ē, é, ě, è, ī, í, ǐ, ì, ō, ó, ǒ, ò, ū, ú, ǔ, ù, ǖ, ǘ, ǚ, ǜ)
- Keep it to 1-4 characters
- Make it fun and memorable
- Include a brief, engaging explanation of why it's relevant today

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"traditional":"字","pinyin":"zì","english":"Character/Word","category":"culture","funFact":"Brief engaging fact about why this word is interesting or relevant today"}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0]?.text?.trim();

    // Parse the JSON response
    const parsed = JSON.parse(responseText);

    // Validate required fields
    if (parsed.traditional && parsed.pinyin && parsed.english) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("AI Chinese word generation failed:", error);
    return null;
  }
}

// Fallback fortunes if AI is not available (funnier versions)
const fallbackFortunes = [
  "Your slurping technique has been rated 'professional' by the pod walls.",
  "The noodles have spoken: you are the chosen one. No refunds.",
  "Breaking news: local pod declares you their favorite human today.",
  "Scientists confirm: ordering beef noodle soup was the best decision you made this week.",
  "Your future is as bright as the broth you just conquered.",
  "The universe wanted you to have this meal. Don't question the universe.",
  "Rumor has it, the kitchen staff high-fived after making your order.",
  "Pro tip: telling friends about Oh! increases your luck by 47%. It's science.",
  "You've unlocked the secret level of dining. Achievement: Beef Boss Royalty.",
  "Plot twist: you were the main character all along. Now with beef noodle soup.",
  "The pod will remember this moment fondly. It told us.",
  "Your chopstick skills are now legendary. At least in this zip code.",
];

// Generate fortune cookie for an order
app.get("/orders/fortune", async (req, reply) => {
  const { orderQrCode, orderId } = req.query || {};

  if (!orderQrCode && !orderId) {
    return reply.status(400).send({ error: "Order QR code or ID required" });
  }

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

    // Generate lucky numbers
    const luckyNumbers = generateLuckyNumbers(order.id, firstName, order.createdAt.toISOString());

    // Get historical fact
    const historyFact = getThisDayInHistory();

    // Try to generate AI fortune if API key is available
    let fortune = null;
    let source = "ai";

    if (anthropic) {
      try {
        const tierJokes = {
          "CHOPSTICK": "They're a Chopstick tier member (beginner level - still learning to hold chopsticks without launching noodles across the room)",
          "NOODLE_MASTER": "They're a Noodle Master tier member (intermediate - can slurp without splashing, truly impressive)",
          "BEEF_BOSS": "They're a legendary BEEF BOSS tier VIP (the beef noodle soup illuminati, they've probably eaten more bowls than some small countries)",
        };

        const prompt = `You are a HILARIOUS fortune cookie writer for Oh!, a trendy beef noodle soup restaurant with private dining pods. Your job is to make customers laugh out loud and feel special.

CUSTOMER CONTEXT (use ALL of this creatively):
${firstName ? `- Customer's name: ${firstName} (USE THEIR NAME in a funny way!)` : "- Guest customer (roast them gently for not signing up)"}
- They ordered: ${mainItem} ${itemNames.length > 1 ? `and ${itemNames.length - 1} other item(s)` : ""}
- ${tierJokes[tier] || "They're dining at Oh!"}
- They're in a private pod (like a VIP booth for beef noodle soup enthusiasts)
- Pod number: ${order.seat?.number || "unknown"}

STYLE REQUIREMENTS:
1. BE ACTUALLY FUNNY - think stand-up comedian, not Hallmark card
2. Must be personalized - reference their name, their order, their tier level
3. Can be slightly absurd, punny, or self-aware
4. Keep it SHORT (1-2 sentences, under 150 chars)
5. Make it memorable - they should want to screenshot and share it

EXAMPLES OF THE HUMOR LEVEL WE WANT:
- "${firstName || "Dear stranger"}, your beef noodle soup consumption has been noted by the noodle gods. They approve."
- "Pod ${order.seat?.number || "X"} has never seen such elite slurping. The walls are impressed."
- "As a ${tier === "BEEF_BOSS" ? "Beef Boss" : "future Beef Boss"}, you're legally required to tell 3 friends about us."

Now write ONE fortune that will make ${firstName || "this customer"} laugh. Be bold. Be weird. Be memorable.

Return ONLY the fortune text. No quotes, no explanation.`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 100,
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
      // Personalize fallback if we have a name
      if (firstName) {
        fortune = fortune.replace("Your", `${firstName}, your`);
      }
    }

    // Generate Learn Chinese word
    let chineseWord = null;
    let chineseWordSource = "ai";

    // Try AI-generated word first
    if (anthropic) {
      chineseWord = await generateChineseWord(anthropic);
    }

    // Fall back to curated list if AI fails
    if (!chineseWord) {
      chineseWord = fallbackChineseWords[Math.floor(Math.random() * fallbackChineseWords.length)];
      chineseWordSource = "fallback";
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
    return reply.status(500).send({ error: "Failed to generate fortune" });
  }
});

// Fallback roasts for when AI is unavailable
const fallbackRoasts = [
  "We analyzed your order and determined you have... opinions. Strong ones.",
  "Your order tells a story. We're not sure what story, but it's definitely a story.",
  "The kitchen looked at your order and said 'interesting choice.' That's a compliment. Probably.",
  "Your customizations suggest you've either been here before or you're a culinary rebel. Either way, respect.",
  "This order screams 'I know what I want' — or possibly 'I just hit random buttons.' We may never know.",
  "Based on your order, our AI concluded: you're definitely a human who eats food.",
  "Your choices today are being entered into our database of 'unique individuals.'",
  "Somewhere, a chef is looking at this order and nodding appreciatively. Or laughing. One of those.",
];

// Generate sarcastic order roast/analysis
app.get("/orders/roast", async (req, reply) => {
  const { orderQrCode, orderId } = req.query || {};

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

    // Build detailed order analysis
    const orderDetails = [];
    const roastableChoices = [];

    for (const item of order.items) {
      const itemName = item.menuItem?.name || item.name;
      const selectedValue = item.selectedValue;

      // Track the choice for roasting
      if (itemName && selectedValue !== null && selectedValue !== undefined) {
        orderDetails.push({ name: itemName, value: selectedValue });

        // Identify particularly roastable choices
        if (itemName.toLowerCase().includes("spice")) {
          if (selectedValue === "Extra Spicy" || selectedValue === "4") {
            roastableChoices.push(`EXTREME spice level (${selectedValue}) - they think they're tough`);
          } else if (selectedValue === "None" || selectedValue === "0") {
            roastableChoices.push(`NO spice - they're playing it extremely safe`);
          }
        }

        if (itemName.toLowerCase().includes("cilantro")) {
          if (selectedValue === "None" || selectedValue === "0") {
            roastableChoices.push(`NO cilantro - probably has that gene that makes it taste like soap, or just afraid of flavor`);
          } else if (selectedValue === "Extra" || selectedValue === "3") {
            roastableChoices.push(`EXTRA cilantro - a true herbivore`);
          }
        }

        if (itemName.toLowerCase().includes("pickled")) {
          if (selectedValue === "None" || selectedValue === "0") {
            roastableChoices.push(`NO pickled greens - refusing to try something new, how adventurous`);
          } else if (selectedValue === "Extra" || selectedValue === "3") {
            roastableChoices.push(`EXTRA pickled greens - a person of refined, tangy taste`);
          }
        }

        if (itemName.toLowerCase().includes("soup richness") || itemName.toLowerCase().includes("richness")) {
          if (selectedValue === "Extra Rich" || selectedValue === "3") {
            roastableChoices.push(`EXTRA RICH soup - they came here for a broth experience, not a light snack`);
          } else if (selectedValue === "Light" || selectedValue === "0") {
            roastableChoices.push(`LIGHT soup - are they on a diet or something?`);
          }
        }

        if (itemName.toLowerCase().includes("noodle texture") || itemName.toLowerCase().includes("texture")) {
          if (selectedValue === "Firm" || selectedValue === "0") {
            roastableChoices.push(`FIRM noodles - al dente perfectionist alert`);
          } else if (selectedValue === "Soft" || selectedValue === "2") {
            roastableChoices.push(`SOFT noodles - they like their noodles pre-chewed, apparently`);
          }
        }

        if (itemName.toLowerCase().includes("sprouts")) {
          if (selectedValue === "None" || selectedValue === "0") {
            roastableChoices.push(`NO sprouts - sprout-phobic, interesting`);
          }
        }

        if (itemName.toLowerCase().includes("bok choy")) {
          if (selectedValue === "Extra" || selectedValue === "3") {
            roastableChoices.push(`EXTRA baby bok choy - going heavy on the greens, health-conscious or just really likes tiny cabbages`);
          } else if (selectedValue === "None" || selectedValue === "0") {
            roastableChoices.push(`NO bok choy - turning down free vegetables, bold move`);
          }
        }
      }
    }

    // Get main items ordered
    const mainItems = order.items
      .filter(i => i.menuItem?.categoryType === "MAIN")
      .map(i => i.menuItem?.name || i.name);

    // Try to generate AI roast if API key is available
    let roast = null;
    let source = "ai";

    if (anthropic && roastableChoices.length > 0) {
      try {
        const prompt = `You are a HILARIOUSLY SARCASTIC food critic analyzing a customer's beef noodle soup order at Oh!, a trendy restaurant with private dining pods. Your job is to lovingly roast their choices in a way that makes them laugh.

CUSTOMER INFO:
${firstName ? `- Name: ${firstName}` : "- Guest (didn't even sign up, the mystery person)"}
- Main dish: ${mainItems.join(", ") || "Beef Noodle Soup"}
- Pod: ${order.seat?.number || "unknown"}

THEIR NOTABLE CUSTOMIZATIONS (this is the GOLD - use these!):
${roastableChoices.map(c => `- ${c}`).join("\n")}

ALL ORDER DETAILS:
${orderDetails.map(d => `- ${d.name}: ${d.value}`).join("\n")}

YOUR TASK:
Write a SHORT (2-3 sentences, max 200 chars) sarcastic but affectionate roast of their order choices.

STYLE:
- Think snarky best friend, not mean critic
- Heavy on sarcasm and playful jabs
- Reference their SPECIFIC choices (spice levels, skipped toppings, etc.)
- If they skipped something, playfully question their life choices
- If they maxed something out, praise their commitment sarcastically
- Be BOLD and FUNNY
- End with something that shows you're on their team

EXAMPLES:
- "No cilantro AND no pickled greens? ${firstName || "Friend"}, are we afraid of flavor? Don't worry, the beef will carry this. Barely."
- "Extra Spicy? Look at you, thinking you're invincible. The bathroom will remember this. But respect."
- "Light soup and firm noodles — someone's training for something. Or just very particular. We don't judge. Much."

Write the roast. Be savage but lovable. No quotes around it.`;

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }],
        });

        roast = message.content[0]?.text?.trim();
      } catch (aiError) {
        console.error("AI roast generation failed:", aiError);
        source = "fallback";
      }
    } else if (!anthropic) {
      source = "fallback";
    } else {
      // No roastable choices, give a generic compliment-roast
      source = "fallback";
    }

    // Use fallback if AI didn't work or no roastable choices
    if (!roast) {
      roast = fallbackRoasts[Math.floor(Math.random() * fallbackRoasts.length)];
      if (firstName) {
        roast = `${firstName}, ` + roast.charAt(0).toLowerCase() + roast.slice(1);
      }
    }

    return reply.send({
      roast,
      highlights: roastableChoices.slice(0, 3), // Top 3 most roastable choices
      source,
      orderDetails: orderDetails.slice(0, 10), // Limit for response size
      customerName: firstName,
    });
  } catch (error) {
    console.error("Error generating roast:", error);
    return reply.status(500).send({ error: "Failed to generate roast" });
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

  // Run initial cleanup on startup
  releaseExpiredReservations();
});
