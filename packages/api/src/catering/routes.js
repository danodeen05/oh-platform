/**
 * Catering Routes
 *
 * Registers all catering-related API endpoints.
 * Admin routes live under /admin/catering (auto-guarded by the onRequest hook in index.js).
 * Public routes live under /catering.
 * Cron routes live under /cron/catering-* (guarded by x-cron-secret header).
 *
 * Singletons (prisma, stripe, anthropic) are re-instantiated here following
 * the same pattern as packages/api/src/triggers/scheduler.js and
 * packages/api/src/autonomous/routes.js.
 */

import { PrismaClient } from "@oh/db";
import Stripe from "stripe";
import { sendSMS } from "../notifications.js";
import QRCode from "qrcode";
import {
  enrichFromWebsite,
  generateShoppingList,
  summarizeSurvey,
  summarizeBookingDetail,
} from "./ai.js";

const prisma = new PrismaClient();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Owner alert phone — read from env, fallback to Dano's number
const OWNER_ALERT_PHONE = process.env.OWNER_ALERT_PHONE || "+18017393205";

// Cron secret guard
function requireCronSecret(req, reply) {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    reply.code(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Runtime site-config flag for dine-in ordering.
//
// We cannot add a DB table (schema is frozen) and we need this to survive
// Railway restarts reliably.  The approach:
//   - Seed from DISABLE_DINE_IN_ORDERS env var at boot
//   - Allow runtime override via PATCH /admin/site-config/order-now
//   - Resets to env-derived value on restart (documented below)
//
// If you need persistence across restarts, set DISABLE_DINE_IN_ORDERS in
// Railway env vars instead of relying on the in-memory runtime override.
// ---------------------------------------------------------------------------
let dineInOrdersEnabled =
  process.env.DISABLE_DINE_IN_ORDERS !== "true";

export function isDineInOrdersEnabled() {
  return dineInOrdersEnabled;
}

// ---------------------------------------------------------------------------
// Slot → local time
// ---------------------------------------------------------------------------
const SLOT_TIMES = { LUNCH: "12:00", DINNER: "18:00" };
const SLOT_HOURS = { LUNCH: 12, DINNER: 18 };

// ---------------------------------------------------------------------------
// Zodiac helper — duplicated from index.js so routes.js is self-contained
// ---------------------------------------------------------------------------
const CNY_DATES = {
  1948: "1948-02-10", 1949: "1949-01-29", 1950: "1950-02-17", 1951: "1951-02-06",
  1952: "1952-01-27", 1953: "1953-02-14", 1954: "1954-02-03", 1955: "1955-01-24",
  1956: "1956-02-12", 1957: "1957-01-31", 1958: "1958-02-18", 1959: "1959-02-08",
  1960: "1960-01-28", 1961: "1961-02-15", 1962: "1962-02-05", 1963: "1963-01-25",
  1964: "1964-02-13", 1965: "1965-02-02", 1966: "1966-01-21", 1967: "1967-02-09",
  1968: "1968-01-30", 1969: "1969-02-17", 1970: "1970-02-06", 1971: "1971-01-27",
  1972: "1972-02-15", 1973: "1973-02-03", 1974: "1974-01-23", 1975: "1975-02-11",
  1976: "1976-01-31", 1977: "1977-02-18", 1978: "1978-02-07", 1979: "1979-01-28",
  1980: "1980-02-16", 1981: "1981-02-05", 1982: "1982-01-25", 1983: "1983-02-13",
  1984: "1984-02-02", 1985: "1985-02-20", 1986: "1986-02-09", 1987: "1987-01-29",
  1988: "1988-02-17", 1989: "1989-02-06", 1990: "1990-01-27", 1991: "1991-02-15",
  1992: "1992-02-04", 1993: "1993-01-23", 1994: "1994-02-10", 1995: "1995-01-31",
  1996: "1996-02-19", 1997: "1997-02-07", 1998: "1998-01-28", 1999: "1999-02-16",
  2000: "2000-02-05", 2001: "2001-01-24", 2002: "2002-02-12", 2003: "2003-02-01",
  2004: "2004-01-22", 2005: "2005-02-09", 2006: "2006-01-29", 2007: "2007-02-18",
  2008: "2008-02-07", 2009: "2009-01-26", 2010: "2010-02-14", 2011: "2011-02-03",
  2012: "2012-01-23", 2013: "2013-02-10", 2014: "2014-01-31", 2015: "2015-02-19",
  2016: "2016-02-08", 2017: "2017-01-28", 2018: "2018-02-16", 2019: "2019-02-05",
  2020: "2020-01-25", 2021: "2021-02-12", 2022: "2022-02-01", 2023: "2023-01-22",
  2024: "2024-02-10", 2025: "2025-01-29", 2026: "2026-02-17",
};
const ZODIAC_ANIMALS = [
  "Rat","Ox","Tiger","Rabbit","Dragon","Snake",
  "Horse","Goat","Monkey","Rooster","Dog","Pig",
];
function getChineseZodiac(birthdate) {
  if (!birthdate) return null;
  const date = new Date(birthdate);
  if (isNaN(date.getTime())) return null;
  let year = date.getFullYear();
  const cnyDate = CNY_DATES[year];
  if (cnyDate && date < new Date(cnyDate)) year -= 1;
  const idx = (year - 1900) % 12;
  return ZODIAC_ANIMALS[idx >= 0 ? idx : idx + 12];
}

// ---------------------------------------------------------------------------
// Slug / code generators
// ---------------------------------------------------------------------------
function makeSlug(company, dateStr) {
  const base = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // dateStr: "2026-06-05" → "jun5"
  const d = new Date(dateStr);
  const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const month = monthNames[d.getUTCMonth()];
  const day = d.getUTCDate();
  return `${base}-${month}${day}`;
}

function makeEventCode() {
  return `CAT-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .substr(2, 4)
    .toUpperCase()}`;
}

function makeBookingToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

// ---------------------------------------------------------------------------
// Format cents → "$X.YY"
// ---------------------------------------------------------------------------
function fmtDollars(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Build catering menu item list for public event payload
// ---------------------------------------------------------------------------
async function getCateringMenuItems(tenantId) {
  const items = await prisma.menuItem.findMany({
    where: {
      tenantId,
      isAvailable: true,
      name: {
        in: [
          "Classic Beef Noodle Soup",
          "Classic Beef Noodle Soup (no beef)",
          "Wide Noodles",
          "Wide Noodles (Gluten Free)",
          "Thin/Flat Noodles",
          "Baby Bok Choy",
          "Sprouts",
        ],
      },
    },
    select: { id: true, name: true, categoryType: true, category: true },
  });

  // Group by category
  const soups = items.filter((i) =>
    ["Classic Beef Noodle Soup", "Classic Beef Noodle Soup (no beef)"].includes(i.name)
  );
  const noodles = items.filter((i) =>
    ["Wide Noodles", "Wide Noodles (Gluten Free)", "Thin/Flat Noodles"].includes(i.name)
  );
  const sliders = items.filter((i) => ["Baby Bok Choy", "Sprouts"].includes(i.name));

  return { soups, noodles, sliders };
}

// ===========================================================================
// REGISTER ALL CATERING ROUTES
// ===========================================================================
export async function registerCateringRoutes(app) {

  // =========================================================================
  // ADMIN: Site config — dine-in ordering toggle
  // /admin/site-config/order-now
  // Note: must be registered before /admin/catering/* to avoid conflicts
  // =========================================================================

  app.get("/admin/site-config/order-now", async (req, reply) => {
    return { enabled: dineInOrdersEnabled };
  });

  app.patch("/admin/site-config/order-now", async (req, reply) => {
    const { enabled } = req.body || {};
    if (typeof enabled !== "boolean") {
      return reply.code(400).send({ error: "enabled (boolean) required" });
    }
    dineInOrdersEnabled = enabled;
    return { enabled: dineInOrdersEnabled };
  });

  // PUBLIC read of the dine-in toggle so the web home page can show the
  // "Book Catering" CTA (instead of "Order Now") without a redeploy.
  app.get("/catering/site-config/order-now", async (req, reply) => {
    return { enabled: dineInOrdersEnabled };
  });

  // =========================================================================
  // ADMIN: Catering analytics
  // GET /admin/catering/analytics
  // =========================================================================

  app.get("/admin/catering/analytics", async (req, reply) => {
    try {
      const [eventsCreated, bookingsStarted, bookingsConfirmed, rsvpCount, attendeeOrders] =
        await Promise.all([
          prisma.cateringEvent.count(),
          prisma.cateringBooking.count(),
          prisma.cateringBooking.count({ where: { paymentStatus: "PAID" } }),
          prisma.cateringRSVP.count(),
          prisma.order.count({ where: { orderSource: "CATERING" } }),
        ]);

      const bookingConversionPct =
        bookingsStarted > 0
          ? Math.round((bookingsConfirmed / bookingsStarted) * 100)
          : 0;
      const rsvpPerEvent =
        eventsCreated > 0 ? Math.round(rsvpCount / eventsCreated) : 0;
      const orderConversionPct =
        rsvpCount > 0 ? Math.round((attendeeOrders / rsvpCount) * 100) : 0;

      return {
        eventsCreated,
        bookingsStarted,
        bookingsConfirmed,
        bookingConversionPct,
        rsvpCount,
        rsvpPerEvent,
        attendeeOrders,
        orderConversionPct,
      };
    } catch (err) {
      console.error("[catering/analytics]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // ADMIN: Events CRUD
  // GET    /admin/catering/events
  // POST   /admin/catering/events
  // GET    /admin/catering/events/:id
  // PATCH  /admin/catering/events/:id
  // =========================================================================

  app.get("/admin/catering/events", async (req, reply) => {
    try {
      const events = await prisma.cateringEvent.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          booking: true,
          _count: { select: { rsvps: true, orders: true } },
        },
      });
      return events;
    } catch (err) {
      console.error("[admin catering events list]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post("/admin/catering/events", async (req, reply) => {
    try {
      const {
        clientCompany,
        clientWebsite,
        contactName,
        contactEmail,
        contactPhone,
        eventDate,
        slot,
        pricePerBowlCents,
        minimumBowls,
        notes,
        eventName,
      } = req.body || {};

      if (!clientCompany || !eventDate || !slot) {
        return reply.code(400).send({ error: "clientCompany, eventDate, slot required" });
      }
      if (!["LUNCH", "DINNER"].includes(slot)) {
        return reply.code(400).send({ error: "slot must be LUNCH or DINNER" });
      }

      // Resolve tenant: explicit tenantId if provided, else default to the Oh! tenant
      // (single-tenant platform — the admin form doesn't need to know tenant ids).
      let tenantId = req.body?.tenantId;
      const tenant = tenantId
        ? await prisma.tenant.findUnique({ where: { id: tenantId } })
        : (await prisma.tenant.findUnique({ where: { slug: "oh" } })) ||
          (await prisma.tenant.findFirst());
      if (tenant) tenantId = tenant.id;
      if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

      // Generate slug + eventCode
      const slug = makeSlug(clientCompany, eventDate);
      const eventCode = makeEventCode();

      // Default pricing by slot
      const defaultPrice = slot === "LUNCH" ? 2499 : 2999;

      // Create the dedicated Location row for this event
      const locationId = `cat-${slug}-${Date.now().toString(36)}`;
      const location = await prisma.location.create({
        data: {
          id: locationId,
          tenantId,
          name: `${clientCompany} Event`,
          city: "Salt Lake City",
          address: "Private Catering Event",
          lat: 40.7608,
          lng: -111.891,
          taxRate: 0,
          timezone: "America/Denver",
          isClosed: false,
        },
      });

      // Create the event, linking the new location
      const event = await prisma.cateringEvent.create({
        data: {
          tenantId,
          locationId: location.id,
          slug,
          eventCode,
          clientCompany,
          clientWebsite: clientWebsite || null,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          eventDate: new Date(eventDate),
          slot,
          pricePerBowlCents: pricePerBowlCents ?? defaultPrice,
          minimumBowls: minimumBowls ?? 10,
          notes: notes || null,
          eventName: eventName || null,
          status: "PLANNING",
        },
      });

      return reply.code(201).send(event);
    } catch (err) {
      console.error("[admin catering events create]", err.message);
      if (err.code === "P2002") {
        return reply.code(409).send({ error: "Slug or eventCode already exists" });
      }
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get("/admin/catering/events/:id", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({
        where: { id: req.params.id },
        include: {
          booking: true,
          _count: { select: { rsvps: true, orders: true, charges: true } },
        },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });
      return event;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.patch("/admin/catering/events/:id", async (req, reply) => {
    try {
      const allowed = [
        "clientCompany","clientWebsite","contactName","contactEmail","contactPhone",
        "eventDate","slot","pricePerBowlCents","minimumBowls","bookedBowls",
        "status","eventName","logoUrl","brandColors","companyDescription","notes",
      ];
      const data = {};
      for (const key of allowed) {
        if (req.body?.[key] !== undefined) data[key] = req.body[key];
      }
      if (data.eventDate) data.eventDate = new Date(data.eventDate);

      const event = await prisma.cateringEvent.update({
        where: { id: req.params.id },
        data,
      });
      return event;
    } catch (err) {
      if (err.code === "P2025") return reply.code(404).send({ error: "Event not found" });
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // ADMIN: Calendar availability summary
  // GET /admin/catering/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
  // =========================================================================

  app.get("/admin/catering/calendar", async (req, reply) => {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from) : new Date();
      const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 86400000);

      const events = await prisma.cateringEvent.findMany({
        where: {
          eventDate: { gte: fromDate, lte: toDate },
          status: { not: "PLANNING" }, // exclude un-enriched drafts from calendar
        },
        include: { booking: true, _count: { select: { rsvps: true } } },
      });

      // Build a map of date+slot → event
      const map = {};
      for (const e of events) {
        const key = `${e.eventDate.toISOString().slice(0, 10)}_${e.slot}`;
        map[key] = e;
      }

      // Enumerate days
      const days = [];
      const cursor = new Date(fromDate);
      cursor.setUTCHours(0, 0, 0, 0);
      while (cursor <= toDate) {
        const dateStr = cursor.toISOString().slice(0, 10);
        for (const slot of ["LUNCH", "DINNER"]) {
          const key = `${dateStr}_${slot}`;
          const event = map[key] || null;
          days.push({
            date: dateStr,
            slot,
            status: event ? "BOOKED" : "OPEN",
            event: event
              ? {
                  id: event.id,
                  slug: event.slug,
                  clientCompany: event.clientCompany,
                  bookedBowls: event.bookedBowls,
                  rsvpCount: event._count.rsvps,
                  eventStatus: event.status,
                }
              : null,
          });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return days;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // ADMIN: AI Enrichment
  // POST  /admin/catering/events/:id/enrich
  // GET   /admin/catering/events/:id/enrichment
  // PATCH /admin/catering/events/:id/enrichment  (owner accept/override)
  // =========================================================================

  app.post("/admin/catering/events/:id/enrich", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({ where: { id: req.params.id } });
      if (!event) return reply.code(404).send({ error: "Event not found" });

      // Never downgrade an already-approved (LIVE) event by re-running enrichment.
      // The owner's approved branding is protected; they can edit fields directly instead.
      if (event.status === "LIVE") {
        return reply.code(409).send({
          error: "Event is already live — re-enrichment is disabled to protect approved branding. Edit fields directly instead.",
        });
      }

      // Mark as ENRICHING immediately (guard against concurrent state changes)
      await prisma.cateringEvent.updateMany({
        where: { id: event.id, status: { not: "LIVE" } },
        data: { status: "ENRICHING" },
      });

      // Fire async enrichment — do not await.
      // IMPORTANT: only write status back if the event is STILL ENRICHING. If the
      // owner approved it (LIVE) while enrichment was running, do not downgrade it.
      (async () => {
        try {
          const url = event.clientWebsite;
          if (!url) {
            await prisma.cateringEvent.updateMany({
              where: { id: event.id, status: "ENRICHING" },
              data: {
                status: "NEEDS_REVIEW",
                enrichmentRaw: { error: "No website URL provided" },
              },
            });
            return;
          }
          const enriched = await enrichFromWebsite(url);
          await prisma.cateringEvent.updateMany({
            where: { id: event.id, status: "ENRICHING" },
            data: {
              status: "NEEDS_REVIEW",
              enrichmentRaw: enriched,
            },
          });
        } catch (err) {
          console.error("[catering/enrich] background error:", err.message);
          await prisma.cateringEvent.updateMany({
            where: { id: event.id, status: "ENRICHING" },
            data: {
              status: "NEEDS_REVIEW",
              enrichmentRaw: { error: err.message },
            },
          }).catch(() => {});
        }
      })();

      return { status: "ENRICHING", message: "Enrichment started" };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get("/admin/catering/events/:id/enrichment", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({
        where: { id: req.params.id },
        select: {
          id: true, status: true, enrichmentRaw: true,
          eventName: true, logoUrl: true, brandColors: true, companyDescription: true,
        },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });
      return event;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.patch("/admin/catering/events/:id/enrichment", async (req, reply) => {
    try {
      const { eventName, logoUrl, brandColors, companyDescription } = req.body || {};
      const data = { status: "LIVE" };
      if (eventName !== undefined) data.eventName = eventName;
      if (logoUrl !== undefined) data.logoUrl = logoUrl;
      if (brandColors !== undefined) data.brandColors = brandColors;
      if (companyDescription !== undefined) data.companyDescription = companyDescription;

      const event = await prisma.cateringEvent.update({
        where: { id: req.params.id },
        data,
      });
      return event;
    } catch (err) {
      if (err.code === "P2025") return reply.code(404).send({ error: "Event not found" });
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // ADMIN: Orders & RSVPs dashboards
  // GET /admin/catering/events/:id/orders
  // GET /admin/catering/events/:id/rsvps
  // =========================================================================

  app.get("/admin/catering/events/:id/orders", async (req, reply) => {
    try {
      const orders = await prisma.order.findMany({
        where: { cateringEventId: req.params.id },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          guest: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return orders;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get("/admin/catering/events/:id/rsvps", async (req, reply) => {
    try {
      const rsvps = await prisma.cateringRSVP.findMany({
        where: { eventId: req.params.id },
        orderBy: { createdAt: "asc" },
      });
      return rsvps;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // ADMIN: Shopping list
  // POST /admin/catering/events/:id/shopping-list
  // GET  /admin/catering/events/:id/shopping-list
  // =========================================================================

  app.get("/admin/catering/events/:id/shopping-list", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({
        where: { id: req.params.id },
        select: { shoppingList: true, shoppingListAt: true, bookedBowls: true },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });
      return { shoppingList: event.shoppingList || [], generatedAt: event.shoppingListAt };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post("/admin/catering/events/:id/shopping-list", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({
        where: { id: req.params.id },
        include: { orders: { include: { items: { include: { menuItem: true } } } } },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });

      // Aggregate order items
      const itemCounts = {};
      for (const order of event.orders) {
        for (const item of order.items) {
          const name = item.menuItem.name;
          itemCounts[name] = (itemCounts[name] || 0) + item.quantity;
        }
      }
      const orderItems = Object.entries(itemCounts).map(([name, quantity]) => ({ name, quantity }));
      const attendeeCount = event.bookedBowls || event.orders.length || 10;

      const list = await generateShoppingList({ attendeeCount, orderItems, event });

      await prisma.cateringEvent.update({
        where: { id: event.id },
        data: { shoppingList: list, shoppingListAt: new Date() },
      });

      return { shoppingList: list, generatedAt: new Date() };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // ADMIN: Overage
  // GET  /admin/catering/events/:id/overage
  // POST /admin/catering/events/:id/overage-invoice
  // =========================================================================

  app.get("/admin/catering/events/:id/overage", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { orders: true } } },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });

      const orderedCount = event._count.orders;
      const overageBowls = Math.max(0, orderedCount - event.bookedBowls);
      const overageAmountCents = overageBowls * event.pricePerBowlCents;

      return {
        bookedBowls: event.bookedBowls,
        orderedCount,
        overageBowls,
        overageAmountCents,
        pricePerBowlCents: event.pricePerBowlCents,
      };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post("/admin/catering/events/:id/overage-invoice", async (req, reply) => {
    try {
      if (!stripe) return reply.code(500).send({ error: "Stripe not configured" });

      const event = await prisma.cateringEvent.findUnique({
        where: { id: req.params.id },
        include: {
          booking: true,
          _count: { select: { orders: true } },
        },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });

      const orderedCount = event._count.orders;
      const overageBowls = Math.max(0, orderedCount - event.bookedBowls);
      if (overageBowls === 0) {
        return reply.code(400).send({ error: "No overage — no invoice needed" });
      }

      const overageAmountCents = overageBowls * event.pricePerBowlCents;

      // Create Stripe invoice (one-off)
      // We need a customer — use contact email or a generic one
      const email = event.contactEmail || "billing@ohbeef.com";
      let customer;
      try {
        const existing = await stripe.customers.list({ email, limit: 1 });
        customer = existing.data[0] || await stripe.customers.create({ email, name: event.clientCompany });
      } catch (e) {
        customer = await stripe.customers.create({ email, name: event.clientCompany });
      }

      const invoiceItem = await stripe.invoiceItems.create({
        customer: customer.id,
        amount: overageAmountCents,
        currency: "usd",
        description: `Oh! Catering — overage (${overageBowls} extra bowls @ ${fmtDollars(event.pricePerBowlCents)}/bowl) for ${event.clientCompany} on ${event.eventDate.toISOString().slice(0,10)}`,
      });

      const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: 14,
        metadata: { cateringEventId: event.id, overageBowls: String(overageBowls) },
      });
      const finalInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      const sentInvoice = await stripe.invoices.sendInvoice(finalInvoice.id);

      // Record CateringCharge
      const charge = await prisma.cateringCharge.create({
        data: {
          eventId: event.id,
          type: "OVERAGE",
          bowlCount: overageBowls,
          amountCents: overageAmountCents,
          stripeInvoiceId: sentInvoice.id,
          invoiceUrl: sentInvoice.hosted_invoice_url || null,
          status: "SENT",
        },
      });

      return { charge, invoice: { id: sentInvoice.id, url: sentInvoice.hosted_invoice_url } };
    } catch (err) {
      console.error("[admin overage-invoice]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // ADMIN: Survey rollup
  // GET /admin/catering/events/:id/survey
  // =========================================================================

  app.get("/admin/catering/events/:id/survey", async (req, reply) => {
    try {
      const survey = await prisma.cateringSurvey.findUnique({
        where: { eventId: req.params.id },
        include: { responses: true },
      });
      if (!survey) return reply.code(404).send({ error: "No survey data yet" });

      // Refresh AI summary if needed (no summary or new responses since last summarization)
      const needsSummary =
        !survey.aiSummary ||
        survey.responses.some((r) => r.createdAt > (survey.summarizedAt || new Date(0)));

      if (needsSummary && survey.responses.length > 0) {
        const { overallScore, areaAverages, summary } = await summarizeSurvey(survey.responses);
        await prisma.cateringSurvey
          .update({
            where: { id: survey.id },
            data: { overallScore, aiSummary: summary, summarizedAt: new Date() },
          })
          .catch((e) => console.warn("[survey summarize update]", e.message));
        return {
          surveyId: survey.id,
          responseCount: survey.responses.length,
          overallScore,
          areaAverages,
          aiSummary: summary,
          responses: survey.responses,
        };
      }

      // Compute inline averages
      const { overallScore, areaAverages } = await summarizeSurvey(survey.responses);
      return {
        surveyId: survey.id,
        responseCount: survey.responses.length,
        overallScore: survey.overallScore ?? overallScore,
        areaAverages,
        aiSummary: survey.aiSummary,
        responses: survey.responses,
      };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // PUBLIC: Availability
  // GET /catering/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
  // =========================================================================

  app.get("/catering/availability", async (req, reply) => {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from) : new Date();
      const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 86400000);

      const events = await prisma.cateringEvent.findMany({
        where: {
          eventDate: { gte: fromDate, lte: toDate },
          status: { not: "PLANNING" },
        },
        select: { eventDate: true, slot: true },
      });

      const booked = new Set(
        events.map((e) => `${e.eventDate.toISOString().slice(0, 10)}_${e.slot}`)
      );

      const days = [];
      const cursor = new Date(fromDate);
      cursor.setUTCHours(0, 0, 0, 0);
      while (cursor <= toDate) {
        const dateStr = cursor.toISOString().slice(0, 10);
        for (const slot of ["LUNCH", "DINNER"]) {
          days.push({
            date: dateStr,
            slot,
            status: booked.has(`${dateStr}_${slot}`) ? "BOOKED" : "OPEN",
          });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return days;
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // PUBLIC: Event page
  // GET /catering/events/:slug
  // =========================================================================

  app.get("/catering/events/:slug", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({
        where: { slug: req.params.slug },
        select: {
          id: true,
          slug: true,
          tenantId: true,
          locationId: true,
          eventCode: true,
          eventName: true,
          clientCompany: true,
          logoUrl: true,
          brandColors: true,
          companyDescription: true,
          eventDate: true,
          slot: true,
          status: true,
        },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });
      if (!["LIVE", "COMPLETED"].includes(event.status)) {
        return reply.code(404).send({ error: "Event not available" });
      }

      const menu = await getCateringMenuItems(event.tenantId);

      return { ...event, menu };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // PUBLIC: Bookings
  // POST /catering/bookings
  // POST /catering/bookings/:id/confirm
  // =========================================================================

  app.post("/catering/bookings", async (req, reply) => {
    try {
      if (!stripe) return reply.code(500).send({ error: "Stripe not configured" });

      const {
        clientCompany,
        clientWebsite,
        contactName,
        contactEmail,
        contactPhone,
        eventDate,
        slot,
        bowls,
        promoCode: promoCodeInput,
        notes,
      } = req.body || {};

      if (!clientCompany || !eventDate || !slot || !bowls) {
        return reply.code(400).send({ error: "clientCompany, eventDate, slot, bowls required" });
      }
      if (!["LUNCH", "DINNER"].includes(slot)) {
        return reply.code(400).send({ error: "slot must be LUNCH or DINNER" });
      }
      if (typeof bowls !== "number" || bowls < 1) {
        return reply.code(400).send({ error: "bowls must be a positive number" });
      }

      // Resolve tenant: explicit tenantId if provided, else default to the Oh! tenant
      // (single-tenant platform — the public booking form doesn't send tenant ids).
      let tenantId = req.body?.tenantId;
      const tenant = tenantId
        ? await prisma.tenant.findUnique({ where: { id: tenantId } })
        : (await prisma.tenant.findUnique({ where: { slug: "oh" } })) ||
          (await prisma.tenant.findFirst());
      if (!tenant) return reply.code(404).send({ error: "Tenant not found" });
      tenantId = tenant.id;

      // Check slot isn't already taken
      const existing = await prisma.cateringEvent.findFirst({
        where: {
          eventDate: {
            gte: new Date(new Date(eventDate).setUTCHours(0, 0, 0, 0)),
            lt: new Date(new Date(eventDate).setUTCHours(23, 59, 59, 999)),
          },
          slot,
          status: { not: "PLANNING" },
        },
      });
      if (existing) {
        return reply.code(409).send({ error: "This date/slot is already booked" });
      }

      // Pricing
      const defaultPrice = slot === "LUNCH" ? 2499 : 2999;
      const pricePerBowlCents = defaultPrice;
      let subtotalCents = bowls * pricePerBowlCents;
      let discountCents = 0;
      let resolvedPromoCodeId = null;

      // Validate promo code if provided
      if (promoCodeInput) {
        try {
          const promoResult = await prisma.promoCode.findUnique({
            where: { code: promoCodeInput.toUpperCase() },
            include: { _count: { select: { usages: true } } },
          });
          if (
            promoResult &&
            promoResult.isActive &&
            (promoResult.scope === "ALL" || promoResult.scope === "CATERING") &&
            (!promoResult.expiresAt || promoResult.expiresAt > new Date()) &&
            promoResult.startsAt <= new Date() &&
            (!promoResult.totalUsageLimit ||
              promoResult._count.usages < promoResult.totalUsageLimit)
          ) {
            if (promoResult.discountType === "PERCENTAGE") {
              discountCents = Math.round((subtotalCents * promoResult.discountValue) / 100);
              if (promoResult.maxDiscountCents && discountCents > promoResult.maxDiscountCents) {
                discountCents = promoResult.maxDiscountCents;
              }
            } else if (promoResult.discountType === "FIXED_AMOUNT") {
              discountCents = Math.min(promoResult.discountValue, subtotalCents);
            }
            resolvedPromoCodeId = promoResult.id;
          }
        } catch (e) {
          console.warn("[catering booking promo]", e.message);
        }
      }

      const chargeCents = Math.max(0, subtotalCents - discountCents);
      if (chargeCents < 50) {
        return reply.code(400).send({ error: "Booking amount too low after discount" });
      }

      // Create draft event + location
      const slug = makeSlug(clientCompany, eventDate);
      const eventCode = makeEventCode();
      const locationId = `cat-${slug}-${Date.now().toString(36)}`;

      await prisma.location.create({
        data: {
          id: locationId,
          tenantId,
          name: `${clientCompany} Event`,
          city: "Salt Lake City",
          address: "Private Catering Event",
          lat: 40.7608,
          lng: -111.891,
          taxRate: 0,
          timezone: "America/Denver",
          isClosed: false,
        },
      });

      const event = await prisma.cateringEvent.create({
        data: {
          tenantId,
          locationId,
          slug,
          eventCode,
          clientCompany,
          clientWebsite: clientWebsite || null,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          eventDate: new Date(eventDate),
          slot,
          pricePerBowlCents,
          minimumBowls: 10,
          bookedBowls: bowls,
          notes: notes || null,
          status: "PLANNING",
        },
      });

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: chargeCents,
        currency: "usd",
        metadata: {
          type: "catering_booking",
          cateringEventId: event.id,
          clientCompany,
          eventDate,
          slot,
          bowls: String(bowls),
        },
        automatic_payment_methods: { enabled: true },
      });

      // Create draft booking
      const booking = await prisma.cateringBooking.create({
        data: {
          eventId: event.id,
          bowlsBooked: bowls,
          priceCents: chargeCents,
          stripePaymentIntentId: paymentIntent.id,
          promoCodeId: resolvedPromoCodeId,
          bookingToken: makeBookingToken(),
          paymentStatus: "PENDING",
        },
      });

      return reply.code(201).send({
        bookingId: booking.id,
        eventId: event.id,
        slug: event.slug,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        chargeCents,
        discountCents,
        subtotalCents,
        pricePerBowlCents,
      });
    } catch (err) {
      console.error("[catering/bookings create]", err.message);
      if (err.code === "P2002") {
        return reply.code(409).send({ error: "Slug already taken for this date — try a slightly different company name or date" });
      }
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post("/catering/bookings/:id/confirm", async (req, reply) => {
    try {
      if (!stripe) return reply.code(500).send({ error: "Stripe not configured" });

      const { paymentIntentId, promoCodeId } = req.body || {};
      if (!paymentIntentId) {
        return reply.code(400).send({ error: "paymentIntentId required" });
      }

      const booking = await prisma.cateringBooking.findUnique({
        where: { id: req.params.id },
        include: { event: true },
      });
      if (!booking) return reply.code(404).send({ error: "Booking not found" });
      if (booking.paymentStatus === "PAID") {
        return reply.send({ success: true, bookingToken: booking.bookingToken, alreadyPaid: true });
      }

      // Verify with Stripe
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") {
        return reply.code(400).send({ error: `Payment not completed (status: ${intent.status})` });
      }

      // Mark booking paid + event LIVE-eligible
      const updatedBooking = await prisma.cateringBooking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: "PAID",
          paidCents: booking.priceCents,
          promoCodeId: promoCodeId || booking.promoCodeId,
        },
      });

      await prisma.cateringEvent.update({
        where: { id: booking.event.id },
        data: { status: "PLANNING" }, // owner still needs to enrich → LIVE
      });

      // Record promo usage if applicable
      const promoId = promoCodeId || booking.promoCodeId;
      if (promoId) {
        try {
          await prisma.promoCodeUsage.create({
            data: {
              promoCodeId: promoId,
              cateringBookingId: booking.id,
              discountCents: booking.priceCents > 0
                ? (booking.bowlsBooked * booking.event.pricePerBowlCents) - booking.priceCents
                : 0,
            },
          });
          await prisma.promoCode.update({
            where: { id: promoId },
            data: { currentUsageCount: { increment: 1 } },
          });
        } catch (e) {
          console.warn("[catering booking promo usage]", e.message);
        }
      }

      // Owner alert SMS — best effort
      try {
        const event = booking.event;
        const noteSummary = event.notes
          ? await summarizeBookingDetail(event.notes)
          : "";
        const msg =
          `New catering booking!\n` +
          `Client: ${event.clientCompany}\n` +
          `Contact: ${event.contactName || "—"}\n` +
          `Date: ${event.eventDate.toISOString().slice(0, 10)} (${event.slot})\n` +
          `Bowls: ${booking.bowlsBooked}\n` +
          `Paid: ${fmtDollars(booking.priceCents)}` +
          (noteSummary ? `\nNote: ${noteSummary}` : "");
        await sendSMS({ to: OWNER_ALERT_PHONE, body: msg });
      } catch (e) {
        console.warn("[catering booking owner SMS]", e.message);
      }

      return {
        success: true,
        bookingToken: updatedBooking.bookingToken,
        eventId: booking.event.id,
        slug: booking.event.slug,
      };
    } catch (err) {
      console.error("[catering bookings confirm]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // PUBLIC: Client dashboard
  // GET /catering/dashboard/:bookingToken
  // =========================================================================

  app.get("/catering/dashboard/:bookingToken", async (req, reply) => {
    try {
      const booking = await prisma.cateringBooking.findUnique({
        where: { bookingToken: req.params.bookingToken },
        include: {
          event: {
            include: {
              rsvps: true,
              _count: { select: { orders: true } },
            },
          },
        },
      });
      if (!booking) return reply.code(404).send({ error: "Dashboard not found" });

      const shareUrl = `https://www.ohbeef.com/catering/e/${booking.event.slug}`;
      let qrCode = null;
      try {
        qrCode = await QRCode.toDataURL(shareUrl, {
          width: 200, margin: 1, errorCorrectionLevel: "H",
          color: { dark: "#222222", light: "#FFFFFF" },
        });
      } catch {}

      return {
        event: booking.event,
        booking: {
          id: booking.id,
          bowlsBooked: booking.bowlsBooked,
          priceCents: booking.priceCents,
          paymentStatus: booking.paymentStatus,
        },
        rsvps: booking.event.rsvps,
        orderCount: booking.event._count.orders,
        shareUrl,
        shareQrCode: qrCode,
      };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // PUBLIC: RSVP
  // POST /catering/events/:slug/rsvp
  // =========================================================================

  app.post("/catering/events/:slug/rsvp", async (req, reply) => {
    try {
      const { name, phone, dob } = req.body || {};
      if (!name || !phone) {
        return reply.code(400).send({ error: "name and phone required" });
      }

      const event = await prisma.cateringEvent.findUnique({
        where: { slug: req.params.slug },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });
      if (!["LIVE", "PLANNING"].includes(event.status)) {
        // Allow PLANNING so self-serve works before enrichment
        if (event.status === "COMPLETED") {
          return reply.code(400).send({ error: "Event has already ended" });
        }
      }

      const normalizedPhone = phone.replace(/\D/g, "");
      const zodiac = dob ? getChineseZodiac(dob) : null;

      // Upsert RSVP (unique on eventId + phone)
      const rsvp = await prisma.cateringRSVP.upsert({
        where: {
          eventId_phone: {
            eventId: event.id,
            phone: normalizedPhone,
          },
        },
        update: {
          name,
          dob: dob || undefined,
          zodiac,
        },
        create: {
          eventId: event.id,
          name,
          phone: normalizedPhone,
          dob: dob || null,
          zodiac,
        },
      });

      return { success: true, rememberToken: rsvp.rememberToken, zodiac };
    } catch (err) {
      console.error("[catering rsvp]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // PUBLIC: Attendee orders
  // GET  /catering/events/:slug/order/check?phone=
  // POST /catering/events/:slug/order
  // DELETE /catering/events/:slug/order/:orderId
  // =========================================================================

  app.get("/catering/events/:slug/order/check", async (req, reply) => {
    try {
      const { phone } = req.query;
      if (!phone) return reply.code(400).send({ error: "phone required" });

      const event = await prisma.cateringEvent.findUnique({
        where: { slug: req.params.slug },
        select: { id: true, eventDate: true },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });

      const normalizedPhone = phone.replace(/\D/g, "");
      const existingOrder = await prisma.order.findFirst({
        where: {
          cateringEventId: event.id,
          orderSource: "CATERING",
          status: { not: "CANCELLED" },
          guestPhone: { contains: normalizedPhone.slice(-10) },
        },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
        },
      });

      if (existingOrder) {
        return {
          exists: true,
          orderId: existingOrder.id,
          orderQrCode: existingOrder.orderQrCode,
          kitchenOrderNumber: existingOrder.kitchenOrderNumber,
          canEdit: new Date() < new Date(event.eventDate),
          items: existingOrder.items.map((i) => ({
            menuItem: { name: i.menuItem.name },
            quantity: i.quantity,
            selectedValue: i.selectedValue,
          })),
        };
      }

      return { exists: false };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.post("/catering/events/:slug/order", async (req, reply) => {
    try {
      const { items, guestName, guestPhone, dob } = req.body || {};

      if (!items || !items.length) {
        return reply.code(400).send({ error: "items required" });
      }

      const event = await prisma.cateringEvent.findUnique({
        where: { slug: req.params.slug },
        select: {
          id: true, tenantId: true, locationId: true, eventCode: true,
          eventDate: true, status: true,
        },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });
      if (!["LIVE", "PLANNING"].includes(event.status)) {
        return reply.code(403).send({ error: "Event is not accepting orders" });
      }

      // Block orders after event date
      if (new Date() > new Date(event.eventDate)) {
        return reply.code(400).send({ error: "Event has already started — orders are closed" });
      }

      const normalizedPhone = guestPhone ? guestPhone.replace(/\D/g, "") : null;

      // One order per phone per event
      if (normalizedPhone) {
        const existingOrder = await prisma.order.findFirst({
          where: {
            cateringEventId: event.id,
            orderSource: "CATERING",
            status: { not: "CANCELLED" },
            guestPhone: { contains: normalizedPhone.slice(-10) },
          },
        });
        if (existingOrder) {
          return reply.code(400).send({
            error: "One order per guest per event",
            existingOrderId: existingOrder.id,
            existingOrderQrCode: existingOrder.orderQrCode,
          });
        }
      }

      // Validate menu items
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: items.map((i) => i.menuItemId) } },
      });

      const orderItems = items.map((item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId);
        if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity || 1,
          priceCents: 0, // free for attendees
          selectedValue: item.selectedValue || null,
        };
      });

      // Generate order number/QR
      const prefix = "CAT";
      const orderNumber = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;
      const orderQrCode = `${prefix}-${event.id.slice(-8)}-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;

      // Daily kitchen order number
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let count = 0;
      try {
        count = await prisma.order.count({
          where: {
            locationId: event.locationId,
            createdAt: { gte: today, lt: tomorrow },
          },
        });
      } catch {}
      const kitchenOrderNumber = String(count + 1).padStart(4, "0");

      // Create guest record
      const guest = await prisma.guest.create({
        data: {
          name: guestName || "Catering Guest",
          phone: normalizedPhone || null,
          sessionToken: `cat-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const zodiac = dob ? getChineseZodiac(dob) : null;

      const order = await prisma.order.create({
        data: {
          orderNumber,
          orderQrCode,
          kitchenOrderNumber,
          tenantId: event.tenantId,
          locationId: event.locationId,
          guestId: guest.id,
          guestName: guestName || null,
          guestPhone: normalizedPhone || null,
          guestZodiac: zodiac || null,
          totalCents: 0,
          status: "QUEUED",
          paymentStatus: "PAID",
          orderSource: "CATERING",
          cateringEventId: event.id,
          queuedAt: new Date(),
          items: { create: orderItems },
        },
        include: {
          items: { include: { menuItem: true } },
          guest: true,
        },
      });

      console.log(`[catering] Created order #${kitchenOrderNumber} for ${guestName} at event ${req.params.slug}`);

      return reply.code(201).send({
        orderId: order.id,
        orderQrCode: order.orderQrCode,
        kitchenOrderNumber: order.kitchenOrderNumber,
        items: order.items.map((i) => ({
          name: i.menuItem.name,
          quantity: i.quantity,
          selectedValue: i.selectedValue,
        })),
      });
    } catch (err) {
      console.error("[catering order create]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // Delete/cancel an attendee order (before event date)
  app.delete("/catering/events/:slug/order/:orderId", async (req, reply) => {
    try {
      const event = await prisma.cateringEvent.findUnique({
        where: { slug: req.params.slug },
        select: { id: true, eventDate: true },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });

      if (new Date() >= new Date(event.eventDate)) {
        return reply.code(400).send({ error: "Cannot cancel orders after event has started" });
      }

      const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
      if (!order) return reply.code(404).send({ error: "Order not found" });
      if (order.cateringEventId !== event.id) {
        return reply.code(403).send({ error: "Order does not belong to this event" });
      }

      await prisma.order.update({
        where: { id: req.params.orderId },
        data: { status: "CANCELLED" },
      });

      return { success: true };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // PUBLIC: Survey
  // POST /catering/events/:slug/survey
  // =========================================================================

  app.post("/catering/events/:slug/survey", async (req, reply) => {
    try {
      const { qrCode, overallScore, areaScores, comment } = req.body || {};

      if (!overallScore || typeof overallScore !== "number") {
        return reply.code(400).send({ error: "overallScore (number 1-5) required" });
      }

      const event = await prisma.cateringEvent.findUnique({
        where: { slug: req.params.slug },
        select: { id: true, status: true },
      });
      if (!event) return reply.code(404).send({ error: "Event not found" });

      // Upsert the survey row (one per event)
      let survey = await prisma.cateringSurvey.findUnique({ where: { eventId: event.id } });
      if (!survey) {
        survey = await prisma.cateringSurvey.create({ data: { eventId: event.id } });
      }

      // Look up guest info from QR code if provided
      let guestName = null;
      let guestPhone = null;
      if (qrCode) {
        const order = await prisma.order.findFirst({
          where: { orderQrCode: qrCode, cateringEventId: event.id },
          select: { guestName: true, guestPhone: true },
        });
        if (order) {
          guestName = order.guestName;
          guestPhone = order.guestPhone;
        }
      }

      const response = await prisma.cateringSurveyResponse.create({
        data: {
          surveyId: survey.id,
          guestName,
          guestPhone,
          orderQrCode: qrCode || null,
          overallScore: Math.min(5, Math.max(1, Math.round(overallScore))),
          areaScores: areaScores || {},
          comment: comment || null,
        },
      });

      return reply.code(201).send({ success: true, responseId: response.id });
    } catch (err) {
      console.error("[catering survey]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // CRON: Day-of order/confirm reminder SMS
  // POST /cron/catering-sms-dayof
  // =========================================================================

  app.post("/cron/catering-sms-dayof", async (req, reply) => {
    if (!requireCronSecret(req, reply)) return;

    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

      const events = await prisma.cateringEvent.findMany({
        where: {
          eventDate: { gte: todayStart, lt: todayEnd },
          status: "LIVE",
        },
        include: {
          rsvps: true,
        },
      });

      const results = [];
      for (const event of events) {
        const orderUrl = `https://www.ohbeef.com/catering/e/${event.slug}`;
        for (const rsvp of event.rsvps) {
          if (!rsvp.phone) continue;
          try {
            const r = await sendSMS({
              to: rsvp.phone,
              body:
                `Hi ${rsvp.name.split(" ")[0]}! Today's the day — ${event.eventName || event.clientCompany} x Oh! Beef Noodle Soup.\n\n` +
                `Make sure your order is in:\n${orderUrl}\n\nSee you soon!`,
            });
            results.push({ name: rsvp.name, phone: rsvp.phone, ...r });
          } catch (e) {
            results.push({ name: rsvp.name, phone: rsvp.phone, success: false, error: e.message });
          }
        }
      }

      return {
        eventsProcessed: events.length,
        sent: results.filter((r) => r.success).length,
        total: results.length,
        results,
      };
    } catch (err) {
      console.error("[cron catering-sms-dayof]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // CRON: Post-event survey SMS
  // POST /cron/catering-sms-survey
  // =========================================================================

  app.post("/cron/catering-sms-survey", async (req, reply) => {
    if (!requireCronSecret(req, reply)) return;

    try {
      const now = new Date();
      // Events that ended 1-3 hours ago
      const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() - 1 * 60 * 60 * 1000);

      // Dinner ends ~20:00, Lunch ends ~14:00 — use eventDate + slot hours as proxy
      const events = await prisma.cateringEvent.findMany({
        where: {
          status: "LIVE",
          eventDate: { gte: windowStart, lte: windowEnd },
        },
      });

      const results = [];
      for (const event of events) {
        const surveyUrl = `https://www.ohbeef.com/catering/e/${event.slug}/survey`;

        // Get all attendees who placed an order
        const orders = await prisma.order.findMany({
          where: { cateringEventId: event.id, status: { not: "CANCELLED" } },
          select: { guestName: true, guestPhone: true },
        });

        // Also include RSVPs who may not have ordered
        const rsvps = await prisma.cateringRSVP.findMany({ where: { eventId: event.id } });
        const phones = new Set();
        const targets = [];

        for (const o of orders) {
          if (o.guestPhone && !phones.has(o.guestPhone)) {
            phones.add(o.guestPhone);
            targets.push({ name: o.guestName, phone: o.guestPhone });
          }
        }
        for (const r of rsvps) {
          if (r.phone && !phones.has(r.phone)) {
            phones.add(r.phone);
            targets.push({ name: r.name, phone: r.phone });
          }
        }

        for (const t of targets) {
          try {
            const res = await sendSMS({
              to: t.phone,
              body:
                `Hi${t.name ? " " + t.name.split(" ")[0] : ""}! Thanks for joining ${event.eventName || event.clientCompany} x Oh! Beef Noodle Soup.\n\n` +
                `We'd love your feedback (takes 1 min):\n${surveyUrl}`,
            });
            results.push({ name: t.name, phone: t.phone, ...res });
          } catch (e) {
            results.push({ name: t.name, phone: t.phone, success: false, error: e.message });
          }
        }

        // Mark event COMPLETED
        await prisma.cateringEvent.update({
          where: { id: event.id },
          data: { status: "COMPLETED" },
        }).catch(() => {});
      }

      return {
        eventsProcessed: events.length,
        sent: results.filter((r) => r.success).length,
        total: results.length,
      };
    } catch (err) {
      console.error("[cron catering-sms-survey]", err.message);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =========================================================================
  // CRON: Weekly digest to owner
  // POST /cron/catering-weekly-digest
  //
  // Also registered as a BullMQ repeatable job (cron: "0 13 * * 0" Denver)
  // if Redis is available — see registerCateringScheduler() below.
  // The HTTP endpoint is the reliable fallback.
  // =========================================================================

  app.post("/cron/catering-weekly-digest", async (req, reply) => {
    if (!requireCronSecret(req, reply)) return;
    await sendWeeklyDigest();
    return { success: true };
  });

  console.log("[catering] Routes registered");
}

// ---------------------------------------------------------------------------
// Weekly digest helper — extracted so BullMQ can call it too
// ---------------------------------------------------------------------------
async function sendWeeklyDigest() {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await prisma.cateringEvent.findMany({
      where: {
        eventDate: { gte: now, lte: in7Days },
        status: { in: ["PLANNING", "ENRICHING", "NEEDS_REVIEW", "LIVE"] },
      },
      include: {
        booking: true,
        _count: { select: { rsvps: true } },
      },
      orderBy: { eventDate: "asc" },
    });

    if (events.length === 0) {
      await sendSMS({
        to: OWNER_ALERT_PHONE,
        body: "Oh! Catering weekly digest: No events scheduled in the next 7 days.",
      });
      return;
    }

    const lines = events.map((e) => {
      const dateStr = e.eventDate.toISOString().slice(0, 10);
      return `• ${e.clientCompany} — ${dateStr} ${e.slot} | ${e.bookedBowls} bowls | ${e._count.rsvps} RSVPs`;
    });

    const body =
      `Oh! Catering — next 7 days (${events.length} event${events.length !== 1 ? "s" : ""}):\n\n` +
      lines.join("\n");

    await sendSMS({ to: OWNER_ALERT_PHONE, body });
    console.log("[catering weekly digest] Sent to owner");
  } catch (err) {
    console.error("[catering weekly digest]", err.message);
  }
}

/**
 * Register BullMQ repeatable job for weekly digest.
 * Call this from the scheduler initialization (optional — HTTP cron is the fallback).
 * @param {import('bullmq').Queue} queue
 */
export async function registerCateringScheduler(queue) {
  try {
    await queue.add(
      "catering-weekly-digest",
      { type: "catering_weekly_digest" },
      {
        repeat: {
          // Sunday 1PM America/Denver (UTC-6 standard, UTC-7 MDT → use UTC equivalent 19:00 or 20:00)
          // Using pattern in Denver local time requires bullmq tz option
          pattern: "0 13 * * 0",
          tz: "America/Denver",
        },
        jobId: "catering-weekly-digest",
      }
    );
    console.log("[catering] Weekly digest BullMQ job registered");
  } catch (err) {
    console.warn("[catering] BullMQ weekly digest registration failed:", err.message);
  }
}
