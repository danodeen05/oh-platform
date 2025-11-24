import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { PrismaClient } from "@prisma/client";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(formbody);

const prisma = new PrismaClient();

// Helper to extract tenant from request
function getTenantContext(req) {
  // Option 1: From subdomain (e.g., oh.yourdomain.com)
  const host = req.headers.host || "";
  const subdomain = host.split(".")[0];

  // Option 2: From header (for API clients)
  const tenantSlug = req.headers["x-tenant-slug"] || subdomain;

  return tenantSlug;
}

// health
app.get("/health", async () => ({ ok: true }));

// reads
app.get("/tenants", async () => prisma.tenant.findMany());

// UPDATED: Tenant-scoped with stats
app.get("/locations", async (req, reply) => {
  const tenantSlug = req.headers["x-tenant-slug"] || "oh";

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  return prisma.location.findMany({
    where: { tenantId: tenant.id },
    include: { stats: true },
  });
});

// UPDATED: Tenant-scoped menu
app.get("/menu", async (req, reply) => {
  const tenantSlug = req.headers["x-tenant-slug"] || "oh";

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  return prisma.menuItem.findMany({
    where: { tenantId: tenant.id },
  });
});

// creates (simple, no auth, dev only)
app.post("/locations", async (req, reply) => {
  const { name, city, tenantId } = req.body || {};
  if (!name || !tenantId)
    return reply.code(400).send({ error: "name and tenantId required" });
  const loc = await prisma.location.create({ data: { name, city, tenantId } });
  return reply.code(201).send(loc);
});

app.post("/menu", async (req, reply) => {
  const { name, priceCents, tenantId } = req.body || {};
  if (!name || priceCents == null || !tenantId) {
    return reply
      .code(400)
      .send({ error: "name, priceCents, tenantId required" });
  }
  const priceInt = parseInt(priceCents, 10);
  if (Number.isNaN(priceInt))
    return reply.code(400).send({ error: "priceCents must be an integer" });
  const item = await prisma.menuItem.create({
    data: { name, priceCents: priceInt, tenantId },
  });
  return reply.code(201).send(item);
});

// UPDATE /locations/:id
app.patch("/locations/:id", async (req, reply) => {
  const { id } = req.params;
  const { name, city } = req.body || {};
  const data = {};
  if (typeof name !== "undefined") data.name = name;
  if (typeof city !== "undefined") data.city = city;
  if (!Object.keys(data).length)
    return reply.code(400).send({ error: "no fields to update" });
  return prisma.location.update({ where: { id }, data });
});

// DELETE /locations/:id
app.delete("/locations/:id", async (req) => {
  const { id } = req.params;
  return prisma.location.delete({ where: { id } });
});

// UPDATE /menu/:id
app.patch("/menu/:id", async (req, reply) => {
  const { id } = req.params;
  const { name, priceCents } = req.body || {};
  const data = {};
  if (typeof name !== "undefined") data.name = name;
  if (typeof priceCents !== "undefined") {
    const p = parseInt(priceCents, 10);
    if (Number.isNaN(p))
      return reply.code(400).send({ error: "priceCents must be an integer" });
    data.priceCents = p;
  }
  if (!Object.keys(data).length)
    return reply.code(400).send({ error: "no fields to update" });
  return prisma.menuItem.update({ where: { id }, data });
});

// DELETE /menu/:id
app.delete("/menu/:id", async (req) => {
  const { id } = req.params;
  return prisma.menuItem.delete({ where: { id } });
});

// NEW: Get all seats
app.get("/seats", async () =>
  prisma.seat.findMany({ include: { location: true } })
);

// NEW: Get seat by QR code
app.get("/seats/:qrCode", async (req, reply) => {
  const { qrCode } = req.params;
  const seat = await prisma.seat.findUnique({
    where: { qrCode },
    include: { location: { include: { tenant: true } } },
  });
  if (!seat) return reply.code(404).send({ error: "Seat not found" });
  return seat;
});

// NEW: Create order
app.post("/orders", async (req, reply) => {
  const { seatId, tenantId, items, locationId } = req.body || {};
  if (!tenantId || !items || !Array.isArray(items) || items.length === 0) {
    return reply.code(400).send({ error: "tenantId and items[] required" });
  }

  // fetch menu items to get prices
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });

  // calculate total
  let totalCents = 0;
  const orderItems = items.map((item) => {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId);
    if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
    const qty = item.quantity || 1;
    totalCents += menuItem.priceCents * qty;
    return {
      menuItemId: item.menuItemId,
      quantity: qty,
      priceCents: menuItem.priceCents,
    };
  });

  // generate order number
  const orderNumber = `OH-${Math.floor(1000 + Math.random() * 9000)}`;

  // create order with items
  const order = await prisma.order.create({
    data: {
      orderNumber,
      seatId: seatId || null,
      locationId: locationId || null,
      tenantId,
      totalCents,
      status: "PENDING_PAYMENT",
      items: {
        create: orderItems,
      },
    },
    include: {
      items: { include: { menuItem: true } },
      seat: true,
      location: true,
    },
  });

  return reply.code(201).send(order);
});

// NEW: Get all orders (for kitchen display)
app.get("/orders", async (req) => {
  const { status, locationId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (locationId) where.locationId = locationId;

  return prisma.order.findMany({
    where,
    include: {
      items: { include: { menuItem: true } },
      seat: true,
      location: true,
    },
    orderBy: { createdAt: "asc" },
  });
});

// NEW: Update order status
app.patch("/orders/:id", async (req, reply) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return reply.code(400).send({ error: "status required" });

  return prisma.order.update({
    where: { id },
    data: { status },
    include: {
      items: { include: { menuItem: true } },
      seat: true,
      location: true,
    },
  });
});

// Start server (MUST be at the end)
const port = Number(process.env.API_PORT || 4000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
