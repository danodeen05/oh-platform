import { startOfDenverDay } from "./time.js";

const ACTIVE = ["QUEUED", "PREPPING", "READY", "SERVING"];
const COUNTED = { notIn: ["PENDING_PAYMENT", "CANCELLED"] };

const last4 = (phone) => (typeof phone === "string" && phone.replace(/\D/g, "").length >= 4
  ? phone.replace(/\D/g, "").slice(-4) : null);

function summary(o) {
  return {
    id: o.id, orderNumber: o.orderNumber, kitchenOrderNumber: o.kitchenOrderNumber ?? null,
    status: o.status, paymentStatus: o.paymentStatus, totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(), orderSource: o.orderSource,
    locationName: o.location?.name ?? null, seatNumber: o.seat?.number ?? null,
    customerName: o.user?.name || o.guestName || "Guest",
    phoneLast4: last4(o.user?.phone || o.guestPhone),
  };
}

export async function registerAdminConsoleRoutes(app, { prisma, resolveTenant, now = () => new Date() }) {
  async function tenantOr404(req, reply) {
    const tenant = await resolveTenant(req);
    if (!tenant) reply.code(404).send({ error: "Tenant not found" });
    return tenant;
  }

  app.get("/admin/today", async (req, reply) => {
    const tenant = await tenantOr404(req, reply);
    if (!tenant) return reply;
    const at = now();
    const dayStart = startOfDenverDay(at);
    const locationId = typeof req.query.locationId === "string" && req.query.locationId !== "all" ? req.query.locationId : undefined;
    const base = { tenantId: tenant.id, ...(locationId ? { locationId } : {}) };
    const in7 = new Date(at.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [ordersToday, activeDiners, openPodCalls, shopToShip, cateringNext7] = await Promise.all([
      prisma.order.count({ where: { ...base, createdAt: { gte: dayStart }, status: COUNTED } }),
      prisma.order.count({ where: { ...base, status: { in: ACTIVE } } }),
      prisma.podCall.count({ where: { ...(locationId ? { locationId } : {}), status: { in: ["PENDING", "ACKNOWLEDGED"] } } }),
      prisma.shopOrder.count({ where: { paymentStatus: "PAID", fulfillmentStatus: { in: ["PENDING", "PROCESSING"] } } }),
      prisma.cateringEvent.count({ where: { eventDate: { gte: dayStart, lt: in7 }, status: { not: "COMPLETED" } } }),
    ]);
    const body = { date: dayStart.toISOString(), ordersToday, activeDiners, openPodCalls, shopToShip, cateringNext7 };

    if (req.adminRole === "owner") {
      const [sales, unansweredQuestions, countersigner] = await Promise.all([
        prisma.order.aggregate({ _sum: { totalCents: true }, where: { ...base, createdAt: { gte: dayStart }, paymentStatus: "PAID" } }),
        prisma.planQuestion.count({ where: { answeredAt: null } }),
        prisma.planNdaCountersigner.findUnique({ where: { id: "default" } }),
      ]);
      body.salesCents = sales._sum.totalCents || 0;
      body.unansweredQuestions = unansweredQuestions;
      body.countersignerMissing = !countersigner;
    }
    return body;
  });

  app.get("/admin/orders", async (req, reply) => {
    const tenant = await tenantOr404(req, reply);
    if (!tenant) return reply;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const locationId = typeof req.query.locationId === "string" && req.query.locationId !== "all" ? req.query.locationId : undefined;
    const digits = q.replace(/\D/g, "");
    const where = { tenantId: tenant.id, ...(locationId ? { locationId } : {}) };
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { kitchenOrderNumber: q },
        { guestName: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        ...(digits.length >= 4 ? [{ guestPhone: { contains: digits } }, { user: { phone: { contains: digits } } }] : []),
      ];
    } else {
      where.createdAt = { gte: startOfDenverDay(now()) };
    }
    const rows = await prisma.order.findMany({
      where, take, orderBy: { createdAt: "desc" },
      include: { location: { select: { name: true } }, seat: { select: { number: true } }, user: { select: { name: true, phone: true } } },
    });
    return { orders: rows.map(summary) };
  });

  app.get("/admin/orders/:id", async (req, reply) => {
    const tenant = await tenantOr404(req, reply);
    if (!tenant) return reply;
    const o = await prisma.order.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: {
        location: { select: { name: true } }, seat: { select: { number: true } },
        user: { select: { name: true, email: true, phone: true } },
        items: { include: { menuItem: { select: { name: true } } } },
        podCalls: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!o) return reply.code(404).send({ error: "Order not found" });
    return {
      order: {
        ...summary(o),
        customerEmail: o.user?.email ?? null,
        customerPhone: o.user?.phone || o.guestPhone || null,
        items: o.items.map((i) => ({ name: i.menuItem?.name ?? "Item", quantity: i.quantity, priceCents: i.priceCents, selectedValue: i.selectedValue ?? null })),
        taxCents: o.taxCents, promoDiscountCents: o.promoDiscountCents,
        paymentMethodBrand: o.paymentMethodBrand ?? null, paymentMethodLast4: o.paymentMethodLast4 ?? null,
        timeline: ["createdAt", "paidAt", "arrivedAt", "queuedAt", "prepStartTime", "readyTime", "deliveredAt", "completedTime"]
          .filter((k) => o[k]).map((k) => ({ step: k, at: new Date(o[k]).toISOString() })),
        podCalls: o.podCalls.map((c) => ({ id: c.id, reason: c.reason, status: c.status, createdAt: c.createdAt.toISOString() })),
      },
    };
  });
}
