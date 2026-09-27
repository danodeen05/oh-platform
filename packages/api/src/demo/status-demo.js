/**
 * Order-status demo for the business plan (and anyone showing the product).
 *
 * `/order/status?orderQrCode=DEMO-PLAN` renders the real guest status page
 * for a synthetic order that never exists in the database, so it can't
 * reach a kitchen display, hold a pod, or count as revenue:
 *
 *   - withStatusDemo(prisma) makes order.findUnique/findFirst answer DEMO-
 *     codes (and demo- ids) with a prisma-shaped order built from the
 *     tenant's real menu rows. Every existing route, including the AI
 *     fortune, roast, kitchen feed and backstory, reads it unchanged.
 *   - registerStatusDemoGuard(app) answers every write for a demo order
 *     (call staff, refills, add-ons, dessert, done eating, link to account)
 *     with a simulated success before the real handler runs.
 *
 * The stage plays on a two-minute loop, or is pinned by the code itself:
 * "DEMO-PLAN.PREPPING". The plan's floor plan uses that to keep its phone
 * in step with the animated journey.
 */

export const DEMO_PREFIX = "DEMO-";
export const DEMO_ID_PREFIX = "demo-";
export const DEMO_STAGES = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"];
export const DEMO_POD = "32";
export const DEMO_GUEST = "Alex";

// Auto-play loop (seconds into the loop at which each stage starts).
const LOOP_SECONDS = 120;
const LOOP = [
  ["PAID", 0],
  ["QUEUED", 10],
  ["PREPPING", 22],
  ["READY", 58],
  ["SERVING", 70],
];
// Minutes after payment at which each stage began, for believable timestamps.
const STAGE_MINUTE = { PAID: 0, QUEUED: 1, PREPPING: 2, READY: 6, SERVING: 7, COMPLETED: 30 };
const MENU_TTL_MS = 10 * 60 * 1000;

// The demo guest's order: a Classic bowl built their way, plus a side, a drink and dessert.
const ORDER_LINES = [
  { name: "Classic Beef Noodle Soup" },
  { name: "Soup Richness", selectedValue: "Rich" },
  { name: "Noodle Texture", selectedValue: "Firm" },
  { name: "Spice Level", selectedValue: "Medium" },
  { name: "Wide Noodles" },
  { name: "Soft-Boild Egg" },
  { name: "Spicy Cucumbers" },
  { name: "Pepsi" },
  { name: "Mandarin Orange Sherbet" },
];

export const isDemoCode = (code) => typeof code === "string" && code.startsWith(DEMO_PREFIX);
export const isDemoOrderId = (id) => typeof id === "string" && id.startsWith(DEMO_ID_PREFIX);

/** "DEMO-PLAN.PREPPING" -> { base: "DEMO-PLAN", stage: "PREPPING" }; null for real codes. */
export function parseDemoCode(code) {
  if (!isDemoCode(code)) return null;
  const [base, stage] = code.split(".");
  return { base, stage: DEMO_STAGES.includes(stage) ? stage : null };
}

export function demoStageAt(ms) {
  const s = Math.floor(ms / 1000) % LOOP_SECONDS;
  let current = LOOP[0][0];
  for (const [stage, start] of LOOP) if (s >= start) current = stage;
  return current;
}

const idFor = (base) => `${DEMO_ID_PREFIX}${base.slice(DEMO_PREFIX.length).toLowerCase() || "order"}`;
const stageIndex = (stage) => DEMO_STAGES.indexOf(stage);

/** A prisma-shaped order (the include shape the status and AI routes use). */
export function buildDemoOrder({ code, stage, menu, location, now = new Date() }) {
  const parsed = parseDemoCode(code) || { base: "DEMO-PLAN", stage: null };
  const st = stage || parsed.stage || demoStageAt(now.getTime());
  const idx = stageIndex(st);
  const t0 = now.getTime() - (STAGE_MINUTE[st] * 60 + 30) * 1000;
  const at = (s) => (stageIndex(s) <= idx ? new Date(t0 + STAGE_MINUTE[s] * 60 * 1000) : null);
  const byName = new Map(menu.map((m) => [m.name, m]));
  const id = idFor(parsed.base);
  const items = ORDER_LINES.filter((l) => byName.has(l.name)).map((l, i) => {
    const menuItem = byName.get(l.name);
    return {
      id: `${id}-item-${i + 1}`,
      orderId: id,
      menuItemId: menuItem.id,
      menuItem,
      quantity: 1,
      selectedValue: l.selectedValue ?? null,
      priceCents: menuItem.basePriceCents || 0,
    };
  });
  const seat = { id: `${id}-seat`, number: DEMO_POD, locationId: location?.id ?? null, status: "OCCUPIED" };
  return {
    id,
    orderNumber: "ORD-DEMO-0032",
    kitchenOrderNumber: "A32",
    orderQrCode: `${parsed.base}.${st}`,
    status: st,
    paymentStatus: "PAID",
    totalCents: items.reduce((sum, it) => sum + it.priceCents * it.quantity, 0),
    tenantId: menu[0]?.tenantId ?? location?.tenantId ?? null,
    locationId: location?.id ?? null,
    location,
    seatId: seat.id,
    seat,
    items,
    user: null,
    userId: null,
    guest: null,
    guestId: null,
    guestName: DEMO_GUEST,
    waitQueueEntry: null,
    queuePosition: null,
    estimatedWaitMinutes: null,
    estimatedArrival: null,
    isDualPod: false,
    orderType: "DINE_IN",
    createdAt: new Date(t0),
    paidAt: new Date(t0),
    podAssignedAt: new Date(t0),
    queuedAt: at("QUEUED"),
    arrivedAt: at("QUEUED"),
    podConfirmedAt: at("QUEUED"),
    prepStartTime: at("PREPPING"),
    readyTime: at("READY"),
    deliveredAt: at("SERVING"),
    completedTime: at("COMPLETED"),
  };
}

/** Real menu rows and a location for tenant "oh", cached for ten minutes. */
export function createDemoSource(basePrisma, { now = () => new Date(), tenantSlug = "oh" } = {}) {
  let cache = null;
  const load = async () => {
    if (cache && cache.expires > Date.now()) return cache.value;
    const tenant = await basePrisma.tenant.findUnique({ where: { slug: tenantSlug } });
    const [menu, location] = await Promise.all([
      basePrisma.menuItem.findMany({ where: { tenantId: tenant?.id, name: { in: ORDER_LINES.map((l) => l.name) } } }),
      basePrisma.location.findFirst({ where: { tenantId: tenant?.id, name: "City Creek Mall" } }),
    ]);
    const value = { menu, location: location || { id: "demo-location", name: "City Creek Mall", city: "Salt Lake City", tenantId: tenant?.id } };
    cache = { value, expires: Date.now() + MENU_TTL_MS };
    return value;
  };
  return {
    now,
    load,
    /** Price lookup for simulated add-ons. */
    menuItems: (ids) => basePrisma.menuItem.findMany({ where: { id: { in: ids } } }),
  };
}

/**
 * The demo order for a findUnique/findFirst on Order, or undefined when the
 * lookup is not a demo one (the caller then runs the real query).
 */
export async function resolveDemoLookup(args, source) {
  const where = args?.where || {};
  let code = null;
  if (isDemoCode(where.orderQrCode)) code = where.orderQrCode;
  else if (isDemoOrderId(where.id)) code = `${DEMO_PREFIX}${where.id.slice(DEMO_ID_PREFIX.length).toUpperCase()}`;
  else return undefined;
  const { menu, location } = await source.load();
  return buildDemoOrder({ code, menu, location, now: source.now() });
}

/** Wrap a PrismaClient so DEMO- orders resolve without touching the database. */
export function withStatusDemo(prisma, options = {}) {
  const source = options.source || createDemoSource(prisma, options);
  const extended = prisma.$extends({
    query: {
      order: {
        async findUnique({ args, query }) {
          const demo = await resolveDemoLookup(args, source);
          return demo === undefined ? query(args) : demo;
        },
        async findFirst({ args, query }) {
          const demo = await resolveDemoLookup(args, source);
          return demo === undefined ? query(args) : demo;
        },
      },
    },
  });
  return { prisma: extended, source };
}

// Writes the status page can make; for a demo order each is answered here.
const ID_WRITES = [
  ["POST", /^\/orders\/(demo-[\w-]+)\/(call-staff|refill|extra-vegetables|dessert-ready)$/],
  ["POST", /^\/orders\/(demo-[\w-]+)\/addons$/],
  ["PATCH", /^\/orders\/(demo-[\w-]+)$/],
  ["PATCH", /^\/kitchen\/orders\/(demo-[\w-]+)\/status$/],
];

export function registerStatusDemoGuard(app, { source }) {
  app.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (req.method === "POST" && path === "/orders/link-to-account") {
      if (isDemoCode(req.body?.orderQrCode)) return reply.send({ success: true, demo: true, pointsAwarded: 23 });
      return;
    }
    for (const [method, re] of ID_WRITES) {
      if (req.method !== method) continue;
      const m = re.exec(path);
      if (!m) continue;
      if (m[2] === undefined && path.endsWith("/addons")) {
        const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 20) : [];
        const rows = items.length ? await source.menuItems(items.map((i) => String(i.menuItemId))) : [];
        const price = new Map(rows.map((r) => [r.id, r.basePriceCents || 0]));
        const totalCents = items.reduce((s, i) => s + (price.get(String(i.menuItemId)) || 0) * Math.max(1, Math.min(3, Number(i.quantity) || 1)), 0);
        return reply.send({ success: true, demo: true, totalCents, order: { id: `demo-addon-${Date.now()}`, totalCents, status: "PENDING_PAYMENT" } });
      }
      return reply.send({ success: true, demo: true, order: { id: m[1] } });
    }
  });
}
