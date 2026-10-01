# Private Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the catering attendee flow back onto the customer site in the new design system, give the admin host tools (guests with birthdays, Chappy-voice texts, a Cook tab), and run the owner's "Oh! Business Planning" dinner (Sun 2026-10-04 18:00 MT) through it in production.

**Architecture:** The API keeps `packages/api/src/catering/routes.js` and adds a pure `messages.js` module plus a handful of routes; attendee routes pass the `CATERING_PUBLIC_ENABLED` gate by prefix. The web app gets a `(site)/e/[slug]` route group built from `components/site/*` primitives (StepSheet, BowlBuilder, Sheet, Icon, SitePicture) and the status sub-components. Admin gets Guests, Messages and Cook tabs on the existing UI kit.

**Tech Stack:** Fastify + Prisma (API, `node --test`), Next 16 + next-intl + Tailwind v4 (web, vitest + Playwright via node), Next 16 admin, Twilio, sharp/Playwright for the meme image.

**Spec:** `docs/superpowers/specs/2026-10-01-private-events-design.md`

## Global Constraints

- Mobile-first; every new page is designed at 390px first, checked at 1440.
- Design tokens only from `apps/web/app/globals.css` `@theme` (`oh-charcoal #1C1B19`, `oh-ink #2A2724`, `oh-stone #3A3632`, `oh-ash`, `oh-mute`, `oh-cream #F2EDE4`, `oh-paper`, `oh-linen #EDE6DA`, `oh-ember #C1502E`, `oh-ember-light`, `oh-ember-deep #A94422`, `oh-gold #C9A227`, `oh-olive`, `oh-clay`). Fonts via `Display`/`Title`/`Body`/`Eyebrow` from `components/site/Text.tsx`.
- No emoji anywhere (code, messages, seeds). No icon libraries; use `components/site/icons/Icon.tsx` (admin uses its own `components/ui/icons.tsx`).
- No em dashes in any user-facing copy or SMS template. Welcoming voice.
- All web copy in `apps/web/messages/{en,zh-TW,zh-CN,es}.json` under the `events` namespace; the guards in `apps/web/lib/site/__tests__/` (no-literal-jsx, locale-parity, no-emoji, client-messages) must pass.
- Attendee orders are free; never render a money total on the attendee pages.
- Dev API auth is open (no `ADMIN_API_KEY`, no `NODE_ENV`); dev SMS is LIVE (`SUPPORT_NOTIFY` unset). Never call a send endpoint against dev with a real guest phone. Use `ADMIN_PHONE_NUMBER` from `.env` only when a test must send.
- Dev servers run from this checkout (API `node --watch` on 4000, web 3000, admin 3001; nginx exposes `https://dev{api,webapp,admin}.ohbeef.com`). Do not start extra dev servers. Memory is tight: one browser at a time.
- Commits stage explicit paths. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Time to the owner is always America/Denver.

## Review Focus

1. A guest opens the invite link after the event started (eventDate passed): the order step must say orders are closed and still link to their status page if they ordered; it must not 500. (Task 5 test.)
2. A guest types a phone with formatting (`(801) 555-0100`) or a leading `+1`: RSVP upsert and the one-order-per-phone check must match the same person. (Task 2 test for normalization.)
3. The "I'm here" button must appear only on the event day in America/Denver, including the evening when the UTC date has already rolled over. (Task 6 test of `isEventDay`.)
4. An admin adds a guest whose phone already exists on the event: must return 409, not a Prisma unique error 500. (Task 3 test.)
5. `GET /catering/events/:slug` for a PLANNING or deleted event must 404 on the web (not render an empty page). (Task 4 layout test.)

---

### Task 1: Schema additions and prod SQL

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (CateringEvent ~L1757-1825, CateringRSVP ~L1887-1904)
- Create: `packages/db/sql/2026-10-01-private-events.sql`

**Interfaces:**
- Produces: `CateringEvent.hostName String?`, `CateringEvent.welcomeNote String?`, `CateringRSVP.notes String?`.

- [ ] **Step 1: Add the fields**

In `CateringEvent`, after `companyDescription String?`:
```prisma
  hostName        String?   // e.g. "Dano and Kristy"; shown on the invite and in texts
  welcomeNote     String?   // host's short note on the invite page
```
In `CateringRSVP`, after `zodiac String?`:
```prisma
  notes       String?   // dietary or anything the host should know
```

- [ ] **Step 2: Push to the local dev DB and regenerate the client**

Run: `cd /home/claude-user/projects/oh-platform && pnpm --filter @oh/db prisma db push && pnpm --filter @oh/db prisma generate`
Expected: "Your database is now in sync", client generated. The API's `--watch` restarts on its own.

- [ ] **Step 3: Write the idempotent prod SQL**

```sql
-- Private events (2026-10-01). Additive, idempotent. Prod is db-push managed (no _prisma_migrations).
ALTER TABLE "CateringEvent" ADD COLUMN IF NOT EXISTS "hostName" TEXT;
ALTER TABLE "CateringEvent" ADD COLUMN IF NOT EXISTS "welcomeNote" TEXT;
ALTER TABLE "CateringRSVP"  ADD COLUMN IF NOT EXISTS "notes" TEXT;
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/sql/2026-10-01-private-events.sql
git commit -m "feat(db): hostName, welcomeNote on CateringEvent; notes on CateringRSVP

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: API attendee routes (gate, event fields, RSVP token, menu steps, MMS)

**Files:**
- Modify: `packages/api/src/catering/routes.js` (gate L645-662; GET event L1583; RSVP L1961; order L2063; dayof cron L2447)
- Modify: `packages/api/src/notifications.js:92-110` (`sendSMS`)
- Modify: `packages/api/src/auth/public-routes.js` (~L180-198, add the new public paths)
- Create: `packages/api/src/catering/attendee.js` (pure helpers)
- Test: `packages/api/src/catering/__tests__/attendee.test.js`

**Interfaces:**
- Produces (pure, in `attendee.js`):
  - `isAttendeePath(path: string): boolean` true for `/catering/events/`, `/catering/orders/`, `/catering/menu` prefixes and the two existing allowlisted paths.
  - `normalizeGuestPhone(input: string): string` digits only, drops a leading `1` when 11 digits.
  - `denverDateKey(date: Date): string` returns `YYYY-MM-DD` in America/Denver.
  - `isEventDay(eventDate: Date, now = new Date()): boolean` same Denver date key.
  - `filterMenuSteps(steps, allowedNames: string[]): MenuStep[]` keeps steps `bowl` and `customize` only; within `bowl`, keeps items whose `nameEn || name` is in `allowedNames`; keeps every slider.
  - `CATERING_SOUP_NOODLE_NAMES` the 6 soup/noodle names from `getCateringMenuItems`.
- Produces (routes): `GET /catering/events/:slug` gains `hostName, welcomeNote, eventAddress, isComplimentary, startsAt, timezone`; `GET /catering/events/:slug/rsvp/:token`; `POST /catering/events/:slug/rsvp` accepts `notes`, `rsvpToken`; `GET /catering/events/:slug/menu-steps?locale=`; `POST /catering/events/:slug/order` response gains `statusPath: "/en/e/{slug}/status?qrCode=..."`.
- Produces: `sendSMS({ to, body, mediaUrl? })`.

- [ ] **Step 1: Write the failing tests**

```js
// packages/api/src/catering/__tests__/attendee.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAttendeePath, normalizeGuestPhone, denverDateKey, isEventDay, filterMenuSteps, CATERING_SOUP_NOODLE_NAMES } from "../attendee.js";

test("attendee paths pass the gate; booking paths do not", () => {
  for (const p of ["/catering/events/x", "/catering/events/x/rsvp", "/catering/events/x/menu-steps", "/catering/orders/CAT-1/arrive", "/catering/menu", "/catering/site-config/order-now", "/catering/kitchen-locations"]) assert.equal(isAttendeePath(p), true, p);
  for (const p of ["/catering/bookings", "/catering/bookings/1/confirm", "/catering/availability", "/catering/dashboard/tok"]) assert.equal(isAttendeePath(p), false, p);
});

test("phones normalize to 10 digits", () => {
  assert.equal(normalizeGuestPhone("(801) 555-0100"), "8015550100");
  assert.equal(normalizeGuestPhone("+1 801 555 0100"), "8015550100");
  assert.equal(normalizeGuestPhone("8015550100"), "8015550100");
});

test("event day follows the Denver calendar, not UTC", () => {
  const eventDate = new Date("2026-10-05T00:00:00.000Z"); // 2026-10-04 18:00 MDT
  assert.equal(denverDateKey(eventDate), "2026-10-04");
  assert.equal(isEventDay(eventDate, new Date("2026-10-04T15:00:00.000Z")), true);  // 9am MDT same day
  assert.equal(isEventDay(eventDate, new Date("2026-10-05T03:00:00.000Z")), true);  // 9pm MDT same day
  assert.equal(isEventDay(eventDate, new Date("2026-10-05T07:00:00.000Z")), false); // 1am MDT next day
});

test("menu steps keep bowl soups/noodles on the allowlist and every slider; no extras or drinks", () => {
  const steps = [
    { id: "bowl", title: "Bowl", sections: [
      { id: "soup", selectionMode: "SINGLE", items: [{ id: "s1", name: "Classic Beef Noodle Soup" }, { id: "s2", name: "American Wagyu Beef Noodle Soup" }] },
      { id: "noodles", selectionMode: "SINGLE", items: [{ id: "n1", name: "Wide Noodles" }, { id: "n2", name: "Egg Noodles" }] },
    ] },
    { id: "customize", title: "Customize", sections: [{ id: "sl1", selectionMode: "SLIDER", item: { id: "sl1", name: "Spice Level" } }] },
    { id: "extras", title: "Extras", sections: [] },
    { id: "drinks-desserts", title: "Drinks", sections: [] },
  ];
  const out = filterMenuSteps(steps, CATERING_SOUP_NOODLE_NAMES);
  assert.deepEqual(out.map((s) => s.id), ["bowl", "customize"]);
  assert.deepEqual(out[0].sections[0].items.map((i) => i.id), ["s1"]);
  assert.deepEqual(out[0].sections[1].items.map((i) => i.id), ["n1"]);
  assert.equal(out[1].sections.length, 1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/api && node --test src/catering/__tests__/attendee.test.js`
Expected: FAIL, cannot find module `../attendee.js`.

- [ ] **Step 3: Implement `attendee.js`**

```js
// packages/api/src/catering/attendee.js
// Pure helpers for the attendee (private event) flow. No Prisma here.
export const CATERING_SOUP_NOODLE_NAMES = [
  "Classic Beef Noodle Soup", "Classic Beef Noodle Soup (no beef)",
  "Wide Noodles", "Wide Noodles (Gluten Free)", "Thin/Flat Noodles", "No Noodles",
];
const OPEN_PATHS = new Set(["/catering/site-config/order-now", "/catering/kitchen-locations"]);
const ATTENDEE_PREFIXES = ["/catering/events/", "/catering/orders/", "/catering/menu"];

export function isAttendeePath(path) {
  if (OPEN_PATHS.has(path)) return true;
  return ATTENDEE_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export function normalizeGuestPhone(input) {
  const d = String(input || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

const denverFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" });
export function denverDateKey(date) { return denverFmt.format(date); } // en-CA gives YYYY-MM-DD
export function isEventDay(eventDate, now = new Date()) { return denverDateKey(new Date(eventDate)) === denverDateKey(now); }

export function filterMenuSteps(steps, allowedNames) {
  const allowed = new Set(allowedNames);
  return (steps || []).filter((s) => s.id === "bowl" || s.id === "customize").map((s) => {
    if (s.id !== "bowl") return s;
    return { ...s, sections: s.sections.map((sec) => ({ ...sec, items: (sec.items || []).filter((i) => allowed.has(i.nameEn || i.name)) })) };
  });
}
```

- [ ] **Step 4: Wire the routes**

In `routes.js`:
1. Import `{ isAttendeePath, normalizeGuestPhone, isEventDay, filterMenuSteps, CATERING_SOUP_NOODLE_NAMES }` from `./attendee.js`. Replace the gate condition at ~L658 with `if (path.startsWith("/catering/") && !isAttendeePath(path))`. Keep `CATERING_PUBLIC_ALLOWLIST` only if something else reads it; otherwise delete it.
2. `GET /catering/events/:slug` (~L1583): add to the select `hostName, welcomeNote, eventAddress, pricePerBowlCents`; add to the response `hostName, welcomeNote, eventAddress, isComplimentary: event.pricePerBowlCents === 0, startsAt: event.eventDate.toISOString(), timezone: "America/Denver"`.
3. New route, after the RSVP POST:
```js
app.get("/catering/events/:slug/rsvp/:token", async (req, reply) => {
  const rsvp = await prisma.cateringRSVP.findFirst({
    where: { rememberToken: req.params.token, event: { slug: req.params.slug } },
    select: { name: true, phone: true, dob: true, notes: true, zodiac: true },
  });
  if (!rsvp) return reply.code(404).send({ error: "Guest not found" });
  return rsvp;
});
```
4. `POST /catering/events/:slug/rsvp`: destructure `{ name, phone, dob, notes, rsvpToken }`; use `normalizeGuestPhone(phone)`. If `rsvpToken` is given and matches an RSVP on this event, `update` that row by id (`name, phone: normalizedPhone, dob, zodiac, notes`) instead of upserting by phone; on a unique conflict (P2002) return 409 `{ error: "That phone is already on the guest list" }`. Return `{ success, rememberToken, zodiac }` as today.
5. New route:
```js
app.get("/catering/events/:slug/menu-steps", async (req, reply) => {
  const event = await prisma.cateringEvent.findUnique({ where: { slug: req.params.slug }, select: { status: true } });
  if (!event || !["LIVE", "PLANNING"].includes(event.status)) return reply.code(404).send({ error: "Event not found" });
  const locale = req.query.locale || "en";
  const res = await app.inject({ method: "GET", url: `/menu/steps?locale=${encodeURIComponent(locale)}`, headers: { "x-tenant-slug": "oh" } });
  if (res.statusCode !== 200) return reply.code(502).send({ error: "Menu unavailable" });
  const body = res.json();
  const steps = Array.isArray(body) ? body : body.steps;
  return { steps: filterMenuSteps(steps, CATERING_SOUP_NOODLE_NAMES) };
});
```
   Check what `/menu/steps` returns (array or `{steps}`) by curling `http://localhost:4000/menu/steps?locale=en -H 'x-tenant-slug: oh'` and match it.
6. `POST /catering/events/:slug/order`: use `normalizeGuestPhone`; add `statusPath: \`/en/e/${req.params.slug}/status?qrCode=${order.orderQrCode}\`` to the success response. Change the closed message to "Orders closed. The event has started." (no em dash).
7. `POST /catering/orders/:qrCode/arrive` (~L2262): load the order's event `eventDate`; if `!isEventDay(eventDate)` return 400 `{ error: "Check in opens on the event day" }`. (Dev testing sets the dev event's date to today.)
8. Day-of cron (~L2447): replace the UTC window with Denver: compute `const key = denverDateKey(now)` and filter events in JS by `denverDateKey(e.eventDate) === key` after querying a 2-day window. Also change its link to `${WEB_BASE_URL}/en/e/${event.slug}`.
9. Every other attendee link in routes.js (`/catering/e/` occurrences at ~L968-1030, 2447-2600) becomes `/en/e/{slug}` (`status?qrCode=`, `rsvp?rsvp=`). Grep: `grep -n "catering/e/" packages/api/src/catering/routes.js`.
10. `public-routes.js`: add `/catering/events/:slug/rsvp/:token` and `/catering/events/:slug/menu-steps` to the `catering-public` list in the same style as the neighbors (the route-classification test will tell you the exact format).

In `notifications.js` `sendSMS`:
```js
export async function sendSMS({ to, body, mediaUrl }) {
  ...
  const params = { body, from: TWILIO_PHONE_NUMBER, to: normalized };
  if (mediaUrl) params.mediaUrl = Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl];
  const message = await twilioClient.messages.create(params);
```

- [ ] **Step 5: Run tests and curl**

Run: `cd packages/api && node --test "src/**/__tests__/*.test.js"` (expect all PASS, including `auth/__tests__/route-classification.test.js`).
Run: `curl -s 'http://localhost:4000/catering/menu' -H 'x-tenant-slug: oh' | head -c 200` (expect 200 JSON, not 404, with `CATERING_PUBLIC_ENABLED` unset).
Run: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/catering/availability?from=2026-10-01&to=2026-10-02` (expect 404).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/catering/attendee.js packages/api/src/catering/__tests__/attendee.test.js packages/api/src/catering/routes.js packages/api/src/notifications.js packages/api/src/auth/public-routes.js
git commit -m "feat(api): attendee routes open by prefix; event fields, rsvp token, menu-steps, Denver event day, MMS

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: API host tools (messages module, guest CRUD, send)

**Files:**
- Create: `packages/api/src/catering/messages.js`
- Test: `packages/api/src/catering/__tests__/messages.test.js`
- Modify: `packages/api/src/catering/routes.js` (admin create L758, PATCH whitelist L886, rsvps GET L1307, send-invites L968)

**Interfaces:**
- Produces (pure):
  - `MESSAGE_KINDS = ["invite", "reminder", "status"]`
  - `composeGuestMessage({ kind, event, rsvp, webBaseUrl, order }) => string` where `event = {slug, eventName, clientCompany, hostName, eventDate, eventAddress}`, `rsvp = {name, rememberToken}`, `order = {orderQrCode} | null`.
  - `inviteUrl(webBaseUrl, slug, token)`, `statusUrl(webBaseUrl, slug, qrCode)`.
  - `formatEventWhen(eventDate) => "Sunday, October 4 at 6:00 PM"` in America/Denver.
- Produces (routes):
  - `GET /admin/catering/events/:id/rsvps` → `[{id, name, phone, dob, zodiac, notes, createdAt, inviteUrl, ordered, orderQrCode}]`
  - `POST /admin/catering/events/:id/rsvps {name, phone, dob?, notes?}` → 201 row; 409 on duplicate phone; 400 on missing name/phone or bad dob (not `MM/DD/YYYY`).
  - `PATCH /admin/catering/events/:id/rsvps/:rsvpId {name?, phone?, dob?, notes?}` → row; `DELETE` → `{ok:true}`.
  - `GET /admin/catering/events/:id/messages` → `{ kinds: MESSAGE_KINDS, guests: [{rsvpId, name, phone, ordered, messages: {invite, reminder, status|null}}] }`
  - `POST /admin/catering/events/:id/messages/send {kind, rsvpIds?: string[]}` → `{sent, failed, total, results: [{rsvpId, ok, error?}]}`. `status` kind skips guests without an order.
  - `POST /admin/catering/events/:id/send-invites` → same as send with kind auto (status if ordered else invite).
  - Create and PATCH accept `hostName`, `welcomeNote`.

- [ ] **Step 1: Write the failing tests**

```js
// packages/api/src/catering/__tests__/messages.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeGuestMessage, formatEventWhen, inviteUrl, statusUrl, MESSAGE_KINDS } from "../messages.js";

const event = { slug: "oh-business-planning", eventName: "Oh! Business Planning", clientCompany: "Oh! Business Planning", hostName: "Dano and Kristy", eventDate: new Date("2026-10-05T00:00:00.000Z"), eventAddress: "379 W 3175 N, Lehi, UT 84043" };
const rsvp = { name: "Kristy", rememberToken: "tok123" };
const web = "https://www.ohbeef.com";

test("when is in Denver time", () => {
  assert.equal(formatEventWhen(event.eventDate), "Sunday, October 4 at 6:00 PM");
});

test("urls", () => {
  assert.equal(inviteUrl(web, "oh-business-planning", "tok123"), "https://www.ohbeef.com/en/e/oh-business-planning?rsvp=tok123");
  assert.equal(statusUrl(web, "oh-business-planning", "CAT-1"), "https://www.ohbeef.com/en/e/oh-business-planning/status?qrCode=CAT-1");
});

test("invite names the guest, the host, the time and the link; no emoji or em dashes; under 320 chars", () => {
  const body = composeGuestMessage({ kind: "invite", event, rsvp, webBaseUrl: web, order: null });
  assert.match(body, /Kristy/); assert.match(body, /Dano and Kristy/); assert.match(body, /Sunday, October 4 at 6:00 PM/);
  assert.match(body, /\/en\/e\/oh-business-planning\?rsvp=tok123/);
  assert.doesNotMatch(body, /[—\u{1F300}-\u{1FAFF}]/u);
  assert.ok(body.length <= 320, String(body.length));
});

test("reminder links the order page when there is no order and the status page when there is", () => {
  assert.match(composeGuestMessage({ kind: "reminder", event, rsvp, webBaseUrl: web, order: null }), /\?rsvp=tok123/);
  assert.match(composeGuestMessage({ kind: "reminder", event, rsvp, webBaseUrl: web, order: { orderQrCode: "CAT-9" } }), /status\?qrCode=CAT-9/);
});

test("status needs an order", () => {
  assert.equal(composeGuestMessage({ kind: "status", event, rsvp, webBaseUrl: web, order: null }), null);
  assert.match(composeGuestMessage({ kind: "status", event, rsvp, webBaseUrl: web, order: { orderQrCode: "CAT-9" } }), /CAT-9/);
});

test("kinds", () => assert.deepEqual(MESSAGE_KINDS, ["invite", "reminder", "status"]));
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/api && node --test src/catering/__tests__/messages.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement `messages.js`**

```js
// packages/api/src/catering/messages.js
// Guest texts in Chappy's voice. Deterministic templates (no model), one SMS segment-ish (<= 320 chars).
// Rules: no emoji, no em dashes, welcoming. Links go to the web app's /en/e/{slug} routes.
export const MESSAGE_KINDS = ["invite", "reminder", "status"];

const whenFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
export function formatEventWhen(eventDate) {
  // "Sunday, October 4 at 6:00 PM"
  const parts = Object.fromEntries(whenFmt.formatToParts(new Date(eventDate)).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.month} ${parts.day} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}
export const inviteUrl = (web, slug, token) => `${web}/en/e/${slug}?rsvp=${encodeURIComponent(token)}`;
export const statusUrl = (web, slug, qr) => `${web}/en/e/${slug}/status?qrCode=${encodeURIComponent(qr)}`;

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

export function composeGuestMessage({ kind, event, rsvp, webBaseUrl, order }) {
  const name = firstName(rsvp.name);
  const title = event.eventName || event.clientCompany;
  const host = event.hostName || "your host";
  const when = formatEventWhen(event.eventDate);
  const invite = inviteUrl(webBaseUrl, event.slug, rsvp.rememberToken);
  const status = order?.orderQrCode ? statusUrl(webBaseUrl, event.slug, order.orderQrCode) : null;
  switch (kind) {
    case "invite":
      return `${name}, Chappy here from Oh! Beef Noodle Soup. ${host} saved you a bowl at ${title}, ${when}. Pick your bowl now so it is ready when you are: ${invite}`;
    case "reminder":
      return status
        ? `${name}, today is the day. ${title}, ${when}. When you arrive, tap I'm here and your bowl starts: ${status}`
        : `${name}, today is the day. ${title}, ${when}. You have not picked a bowl yet. Thirty seconds, I timed it: ${invite}`;
    case "status":
      return status ? `${name}, your bowl is reserved for ${title}. Follow it here and tap I'm here when you arrive: ${status}` : null;
    default:
      throw new Error(`unknown message kind ${kind}`);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/api && node --test src/catering/__tests__/messages.test.js` → PASS. Adjust wording to keep length ≤ 320 if needed (the test tells you).

- [ ] **Step 5: Routes**

In `routes.js`, import `{ composeGuestMessage, MESSAGE_KINDS, inviteUrl }` from `./messages.js` and `normalizeGuestPhone` from `./attendee.js`.

a. Admin create (L758): destructure `hostName, welcomeNote` and pass them into `prisma.cateringEvent.create` data. PATCH whitelist (L886): add `"hostName", "welcomeNote"`.

b. Replace `GET /admin/catering/events/:id/rsvps` body:
```js
const [rsvps, orders] = await Promise.all([
  prisma.cateringRSVP.findMany({ where: { eventId: req.params.id }, orderBy: { createdAt: "asc" } }),
  prisma.order.findMany({ where: { cateringEventId: req.params.id, orderSource: "CATERING", status: { not: "CANCELLED" } }, select: { guestPhone: true, orderQrCode: true } }),
]);
const event = await prisma.cateringEvent.findUnique({ where: { id: req.params.id }, select: { slug: true } });
const byPhone = new Map(orders.map((o) => [normalizeGuestPhone(o.guestPhone || ""), o.orderQrCode]));
return rsvps.map((r) => ({ ...r, inviteUrl: inviteUrl(WEB_BASE_URL, event.slug, r.rememberToken), ordered: byPhone.has(r.phone), orderQrCode: byPhone.get(r.phone) || null }));
```

c. Guest CRUD (validate `dob` with `/^\d{2}\/\d{2}\/\d{4}$/` when present; compute `zodiac` with the existing `getChineseZodiac(dob)`):
```js
app.post("/admin/catering/events/:id/rsvps", async (req, reply) => {
  const { name, phone, dob, notes } = req.body || {};
  if (!name?.trim() || !phone) return reply.code(400).send({ error: "name and phone required" });
  if (dob && !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) return reply.code(400).send({ error: "dob must be MM/DD/YYYY" });
  const normalized = normalizeGuestPhone(phone);
  if (normalized.length !== 10) return reply.code(400).send({ error: "phone must have 10 digits" });
  try {
    const rsvp = await prisma.cateringRSVP.create({ data: { eventId: req.params.id, name: name.trim(), phone: normalized, dob: dob || null, zodiac: dob ? getChineseZodiac(dob) : null, notes: notes || null } });
    return reply.code(201).send(rsvp);
  } catch (err) {
    if (err.code === "P2002") return reply.code(409).send({ error: "That phone is already on the guest list" });
    if (err.code === "P2003") return reply.code(404).send({ error: "Event not found" });
    throw err;
  }
});
app.patch("/admin/catering/events/:id/rsvps/:rsvpId", ...) // same validation; only provided fields; recompute zodiac when dob changes; 404 when the row is not on this event
app.delete("/admin/catering/events/:id/rsvps/:rsvpId", ...) // deleteMany({ where: { id, eventId } }); 404 when count 0; return { ok: true }
```

d. Messages:
```js
async function loadGuestsForMessages(eventId) {
  const event = await prisma.cateringEvent.findUnique({ where: { id: eventId }, include: { rsvps: { orderBy: { createdAt: "asc" } } } });
  if (!event) return null;
  const orders = await prisma.order.findMany({ where: { cateringEventId: eventId, orderSource: "CATERING", status: { not: "CANCELLED" } }, select: { guestPhone: true, orderQrCode: true } });
  const byPhone = new Map(orders.map((o) => [normalizeGuestPhone(o.guestPhone || ""), o]));
  return { event, guests: event.rsvps.map((r) => ({ rsvp: r, order: byPhone.get(r.phone) || null })) };
}
app.get("/admin/catering/events/:id/messages", async (req, reply) => {
  const data = await loadGuestsForMessages(req.params.id);
  if (!data) return reply.code(404).send({ error: "Event not found" });
  return { kinds: MESSAGE_KINDS, guests: data.guests.map(({ rsvp, order }) => ({ rsvpId: rsvp.id, name: rsvp.name, phone: rsvp.phone, ordered: !!order,
    messages: Object.fromEntries(MESSAGE_KINDS.map((k) => [k, composeGuestMessage({ kind: k, event: data.event, rsvp, webBaseUrl: WEB_BASE_URL, order })])) })) };
});
async function sendGuestMessages(eventId, { kind, rsvpIds, auto = false }) {
  const data = await loadGuestsForMessages(eventId);
  if (!data) return null;
  const targets = data.guests.filter((g) => !rsvpIds || rsvpIds.includes(g.rsvp.id));
  const results = [];
  for (const { rsvp, order } of targets) {
    const k = auto ? (order ? "status" : "invite") : kind;
    const body = composeGuestMessage({ kind: k, event: data.event, rsvp, webBaseUrl: WEB_BASE_URL, order });
    if (!body) { results.push({ rsvpId: rsvp.id, ok: false, error: "No order yet" }); continue; }
    const r = await sendSMS({ to: rsvp.phone, body });
    results.push({ rsvpId: rsvp.id, ok: !!r.success, error: r.success ? undefined : (r.reason || r.error || "send failed") });
  }
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, total: results.length, results };
}
app.post("/admin/catering/events/:id/messages/send", async (req, reply) => {
  const { kind, rsvpIds } = req.body || {};
  if (!MESSAGE_KINDS.includes(kind)) return reply.code(400).send({ error: `kind must be one of ${MESSAGE_KINDS.join(", ")}` });
  const out = await sendGuestMessages(req.params.id, { kind, rsvpIds: Array.isArray(rsvpIds) ? rsvpIds : null });
  if (!out) return reply.code(404).send({ error: "Event not found" });
  return out;
});
```
Replace the body of the existing `POST /admin/catering/events/:id/send-invites` with `const out = await sendGuestMessages(req.params.id, { auto: true }); if (!out) return 404; return out;`.

- [ ] **Step 6: Verify against dev (no sends)**

Run the API test suite (PASS). Then:
```bash
EV=$(curl -s -X POST http://localhost:4000/admin/catering/events -H 'content-type: application/json' -H 'x-tenant-slug: oh' -d '{"clientCompany":"Plan Test","eventName":"Plan Test","eventDate":"2026-10-05T00:00:00.000Z","slot":"DINNER","hostName":"Dano and Kristy","welcomeNote":"Bring an appetite.","pricePerBowlCents":0,"minimumBowls":6,"eventAddress":"379 W 3175 N, Lehi, UT 84043"}')
echo "$EV" | head -c 400; ID=$(echo "$EV" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')
curl -s -X POST http://localhost:4000/admin/catering/events/$ID/rsvps -H 'content-type: application/json' -d '{"name":"Test Guest","phone":"(801) 555-0100","dob":"03/14/1990"}'   # 201
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/admin/catering/events/$ID/rsvps -H 'content-type: application/json' -d '{"name":"Dup","phone":"8015550100"}'   # 409
curl -s http://localhost:4000/admin/catering/events/$ID/messages | head -c 600
```
Keep this dev event (slug printed in the create response) for Tasks 4-9; record its id and slug in `docs/superpowers/plans/.dev-event.txt` (git-ignored? no: do not commit it, just leave it untracked).

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/catering/messages.js packages/api/src/catering/__tests__/messages.test.js packages/api/src/catering/routes.js
git commit -m "feat(api): host tools for private events: guest CRUD with birthdays, Chappy-voice texts, send per guest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Web foundation and the invite page (`/e/[slug]`)

**Files:**
- Modify: `apps/web/lib/site/client-messages.ts:31-51` (add `"e": ["events", "orderFlow", "afterOrder"]`)
- Modify: `apps/web/messages/en.json`, `zh-TW.json`, `zh-CN.json`, `es.json` (new `events` namespace)
- Create: `apps/web/lib/site/events.ts` (types + fetchers)
- Create: `apps/web/components/site/events/remember.ts`
- Create: `apps/web/components/site/events/CoBrand.tsx`, `Countdown.tsx`, `EventMeta.tsx`, `events.css`
- Create: `apps/web/app/[locale]/(site)/e/[slug]/layout.tsx`, `page.tsx`, `EventInvite.tsx`
- Test: existing guards `apps/web/lib/site/__tests__/*.test.ts` (vitest)

**Interfaces:**
- Produces (`lib/site/events.ts`):
```ts
export interface PublicEvent { slug: string; eventName: string | null; clientCompany: string; hostName: string | null; welcomeNote: string | null; eventAddress: string | null; logoUrl: string | null; brandColors: string[]; startsAt: string; timezone: string; status: "LIVE" | "COMPLETED" | "PLANNING"; isComplimentary: boolean }
export interface GuestRsvp { name: string; phone: string; dob: string | null; notes: string | null; zodiac: string | null }
export function fetchEvent(slug: string): Promise<PublicEvent | null>           // server-side, GET /catering/events/:slug, null on 404
export function fetchRsvpByToken(slug: string, token: string): Promise<GuestRsvp | null>
export function eventTitle(e: PublicEvent): string                                // eventName || clientCompany
export function eventPath(locale: string, slug: string, sub?: "rsvp" | "order" | "done" | "status"): string
```
- Produces (`remember.ts`): `readRemembered(slug): {name, phone, token?, orderQrCode?} | null`, `writeRemembered(slug, data)`, `clearRemembered(slug)` via `localStorage` key `oh-event:{slug}`, try/catch everywhere.
- Produces components: `CoBrand({ event, size?: "lg"|"sm" })` (Oh! mark `/brand/oh-mark-light-204.webp` 56px, optional client logo on a `bg-oh-paper` chip, then `Display` title), `Countdown({ startsAt, timezone })` (days/hours/minutes, tabular, updates each minute, text from `events.countdown.*`), `EventMeta({ event })` (rows with `Icon clock` and `Icon pin`, date formatted with `Intl.DateTimeFormat(locale, {timeZone, weekday, month, day, hour, minute})`, address links to `https://maps.apple.com/?q=` encoded address).

- [ ] **Step 1: Add messages (en first), then the three translations**

`apps/web/messages/en.json` gets a top-level `events` object:
```json
"events": {
  "eyebrow": "A private table",
  "hostedBy": "Hosted by {host}",
  "onTheHouse": "Bowls are on the house.",
  "reserve": "Reserve my bowl",
  "reserved": "Your bowl is reserved",
  "seeStatus": "Follow my bowl",
  "greeting": "{name}, your seat is saved.",
  "countdown": { "label": "Until the first bowl", "days": "days", "hours": "hours", "minutes": "minutes", "started": "It has started." },
  "meta": { "when": "When", "where": "Where", "directions": "Directions" },
  "guest": { "title": "Who is coming?", "lede": "So we can get your bowl right, and your fortune.", "name": "Your name", "phone": "Mobile number", "phoneHelp": "For your reminder on the day.", "birthday": "Birthday", "birthdayHelp": "Optional. It picks your fortune.", "month": "Month", "day": "Day", "year": "Year", "notes": "Anything we should know?", "notesHelp": "Allergies, no beef, extra spicy. Up to you.", "continue": "Build my bowl", "errorName": "Please add your name.", "errorPhone": "Please add a 10 digit mobile number.", "errorBirthday": "That birthday does not look right.", "saving": "Saving" },
  "bowl": { "title": "Build your bowl", "lede": "Pick a broth and noodles. Everything else is dialed to taste.", "cta": "Reserve this bowl", "closed": "Orders are closed. The table has started.", "alreadyOrdered": "You already have a bowl reserved.", "loading": "Loading the menu" },
  "done": { "eyebrow": "Reserved", "title": "{name}, your bowl is in.", "lede": "We will text you on the day. When you arrive, tap I'm here and the kitchen starts your bowl.", "yourBowl": "Your bowl", "change": "Change my bowl", "changeConfirm": "Start over with a new bowl?", "status": "Follow my bowl", "backToInvite": "Back to the invitation" },
  "status": { "held": "Reserved for the table", "heldLede": "Your bowl waits for you. On the day, tap below when you arrive.", "arrive": "I'm here", "arriving": "Checking you in", "notYet": "Check in opens on the day of the event.", "checkedIn": "You are checked in. The kitchen has your bowl.", "personal": "{name}, year of the {zodiac}.", "personalNoZodiac": "Good to have you, {name}.", "yourBowl": "Your bowl", "notFound": "We could not find that bowl.", "survey": "How was it?" },
  "zodiac": { "Rat": "Rat", "Ox": "Ox", "Tiger": "Tiger", "Rabbit": "Rabbit", "Dragon": "Dragon", "Snake": "Snake", "Horse": "Horse", "Goat": "Goat", "Monkey": "Monkey", "Rooster": "Rooster", "Dog": "Dog", "Pig": "Pig" },
  "notFound": { "title": "This table is not set.", "lede": "The link may be old, or the event is not live yet." },
  "images": { "hero": "A bowl of beef noodle soup from above" }
}
```
Translate the whole object into zh-TW, zh-CN and es in the other three files (natural phrasing, same keys; brand name "Oh! Beef Noodle Soup" stays; no em dashes). Check `getChineseZodiac` in the API for the exact 12 English zodiac names and match them as keys.

- [ ] **Step 2: Register the route namespace and run the guards**

In `client-messages.ts` `ROUTE_NAMESPACES` add `"e": ["events", "orderFlow", "afterOrder", "orderStatus"],`.
Run: `cd apps/web && pnpm vitest run lib/site/__tests__/locale-parity.test.ts lib/site/__tests__/no-emoji.test.ts` → PASS.

- [ ] **Step 3: `lib/site/events.ts`, `remember.ts`**

Look at `apps/web/lib/site/api.ts` for `SITE_API_URL` and the tenant header pattern; server fetchers use `fetch(\`${SITE_API_URL}/catering/events/${slug}\`, { headers: { "x-tenant-slug": "oh" }, cache: "no-store" })` and return `null` on non-200.

- [ ] **Step 4: Layout with 404**

```tsx
// apps/web/app/[locale]/(site)/e/[slug]/layout.tsx
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RouteIntl } from "@/components/site/ScopedIntl";
import { fetchEvent } from "@/lib/site/events";
import { EventProvider } from "@/components/site/events/EventProvider";

export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event || !["LIVE", "COMPLETED"].includes(event.status)) notFound();
  return <RouteIntl route="e"><EventProvider event={event}>{children}</EventProvider></RouteIntl>;
}
```
`EventProvider.tsx` is a tiny client context (`useEvent(): PublicEvent`). Add `not-found.tsx` in the same folder rendering `events.notFound.*` with `Display`/`Body` on the charcoal shell. Check `(site)/layout.tsx` and the `order` segment for how `params` are typed in this repo (Next 16 async params).

- [ ] **Step 5: Invite page**

`page.tsx` is a server component: reads `searchParams.rsvp`, fetches the guest by token (null-safe) and renders `<EventInvite guest={guest} token={token} />`. `EventInvite.tsx` (client):
- Wrapper `<div className="flex flex-col gap-8 px-4 pb-[calc(var(--dock-h)+2rem)] pt-6 md:mx-auto md:max-w-2xl">`.
- `<Reveal>` sections: `Eyebrow` `events.eyebrow` (ember-light), `CoBrand`, `Body` `hostedBy`, hero figure `rounded-[28px] bg-oh-linen overflow-hidden aspect-[4/3]` with `<SitePicture image="bowl-slices-top" sizes="(min-width: 768px) 640px, 100vw" alt={t("images.hero")} priority />`, `EventMeta`, `welcomeNote` in a `bg-oh-ink ring-1 ring-oh-stone rounded-3xl p-5` panel with `Title` serif, `Countdown`, `Body` `onTheHouse` when `isComplimentary`.
- CTA: if `readRemembered(slug)?.orderQrCode` exists, show `reserved` + a `SECONDARY` link to status; else a `PRIMARY`-class `Link` to `eventPath(locale, slug, "rsvp") + (token ? \`?rsvp=${token}\` : "")` with label `reserve` and `Icon arrow`. With a token guest, show `greeting` with the first name above the CTA.
- Classes from `components/site/store/ui.tsx` (`PRIMARY`, `SECONDARY`, `PANEL`).

- [ ] **Step 6: Verify**

Run: `cd apps/web && pnpm vitest run lib/site/__tests__` → all PASS (literal JSX, parity, client-messages).
Run: `pnpm --filter @oh/web exec tsc --noEmit` (or the repo's typecheck script) → clean.
Open `http://localhost:3000/en/e/<dev-slug>` with curl: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/en/e/<dev-slug>` → 200; a bogus slug → 404.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/site/client-messages.ts apps/web/messages apps/web/lib/site/events.ts apps/web/components/site/events "apps/web/app/[locale]/(site)/e"
git commit -m "feat(site): private event invitation page on the site design system

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Guest step, bowl step, done page

**Files:**
- Create: `apps/web/app/[locale]/(site)/e/[slug]/rsvp/page.tsx` + `GuestStep.tsx`
- Create: `apps/web/app/[locale]/(site)/e/[slug]/order/page.tsx` + `EventBowlStep.tsx`
- Create: `apps/web/app/[locale]/(site)/e/[slug]/done/page.tsx` + `EventDone.tsx`
- Create: `apps/web/lib/site/event-draft.ts`
- Test: `apps/web/lib/site/__tests__/event-draft.test.ts`

**Interfaces:**
- Consumes: `PublicEvent`, `useEvent()`, `remember.ts`, `BowlBuilder({steps, draft, update})`, `OrderDraft`, `emptyDraft()`, `buildLines(draft, steps)`, `isBowlComplete`-style helper (find the exact name of the "every required section has a choice" function at `order-draft.ts:~290` and reuse it), `StepSheet` (`step` must be an `OrderStepKey`; use `"bowl"`), `CTA_CLASS`.
- Produces (`event-draft.ts`): `readEventDraft(slug): OrderDraft`, `writeEventDraft(slug, d)`, `clearEventDraft(slug)` in sessionStorage `oh-event-draft:{slug}`; `defaultEventDraft(steps): OrderDraft` selecting the first soup, first noodles and each slider's `sliderConfig.default ?? 0` (mirror `order-draft.ts` defaults logic at ~L210).
- Produces API usage: `POST /catering/events/:slug/rsvp {name, phone, dob?, notes?, rsvpToken?}` → `{rememberToken, zodiac}`; `GET /catering/events/:slug/menu-steps?locale=` → `{steps}`; `POST /catering/events/:slug/order {items, guestName, guestPhone, dob}` → `{orderQrCode, statusPath, ...}` or 400 `{existingOrderQrCode}`; `GET /catering/events/:slug/order/check?phone=` → existing order; `DELETE /catering/events/:slug/order/:orderId`.

- [ ] **Step 1: Failing test for the draft defaults**

```ts
// apps/web/lib/site/__tests__/event-draft.test.ts
import { describe, expect, it } from "vitest";
import { defaultEventDraft } from "../event-draft";
const steps = [
  { id: "bowl", title: "", sections: [
    { id: "soup", name: "", selectionMode: "SINGLE", required: true, items: [{ id: "s1", name: "Classic", basePriceCents: 0 }] },
    { id: "noodles", name: "", selectionMode: "SINGLE", required: true, items: [{ id: "n1", name: "Wide", basePriceCents: 0 }, { id: "n2", name: "Thin", basePriceCents: 0 }] } ] },
  { id: "customize", title: "", sections: [{ id: "sp", name: "", selectionMode: "SLIDER", item: { id: "sp", name: "Spice", basePriceCents: 0 }, sliderConfig: { labels: ["None", "Mild", "Medium"], default: 1 } }] },
] as any;
describe("defaultEventDraft", () => {
  it("picks the first soup and noodles and each slider default", () => {
    const d = defaultEventDraft(steps);
    expect(d.singles).toEqual({ soup: "s1", noodles: "n1" });
    expect(d.sliders).toEqual({ sp: 1 });
    expect(d.locationId).toBeNull();
  });
});
```
Run: `cd apps/web && pnpm vitest run lib/site/__tests__/event-draft.test.ts` → FAIL.

- [ ] **Step 2: Implement `event-draft.ts`** (build on `emptyDraft()`), run the test → PASS.

- [ ] **Step 3: GuestStep**

`rsvp/page.tsx` (server) passes `token` from `searchParams.rsvp` and the prefilled `GuestRsvp | null`. `GuestStep.tsx`:
- `<StepSheet step="bowl" title={t("guest.title")} lede={t("guest.lede")} backHref={eventPath(locale, slug)} cta={{ label: t("guest.continue"), form: "guest-form", type: "submit", busy }} alert={error}>`.
- Form id `guest-form` with fields using `FIELD`/`LABEL` from `components/site/store/ui.tsx`: name (`autoComplete="name"`), phone (`type="tel"`, `inputMode="tel"`, `autoComplete="tel"`), birthday as three inputs month/day/year (`inputMode="numeric"`, 2/2/4 max length, `aria-label`s from messages), notes textarea. Prefill from `guest` prop, else `readRemembered(slug)`.
- Validation: name non-empty; phone digits (strip non-digits, drop leading 1) length 10; birthday all-or-nothing, month 1-12, day 1-31, year 1900..current.
- Submit: `POST /catering/events/${slug}/rsvp` with `dob` as `MM/DD/YYYY`; on 200 `writeRemembered(slug, {name, phone, token: rememberToken})` and `router.push(eventPath(locale, slug, "order"))`; on 409 show the server error text; on network failure show `orderFlow`'s generic error key if one exists (grep `messages/en.json` for `"errors"` under `orderFlow`), else `events.guest.errorPhone`.
- Use `useSiteApi()` from `lib/site/api.ts` if it exposes a plain fetch helper for public routes; otherwise `fetch(\`${SITE_API_URL}...\`, { headers: { "content-type": "application/json", "x-tenant-slug": "oh" } })`.

- [ ] **Step 4: EventBowlStep**

`order/page.tsx` renders `<EventBowlStep />` (client). Behavior:
- Guard: `const who = readRemembered(slug)`; if none → `router.replace(eventPath(locale, slug, "rsvp"))`.
- If `new Date(event.startsAt) <= new Date()` → render `StepSheet` with `alert={t("bowl.closed")}` and no CTA; if `who.orderQrCode` show a `SECONDARY` link to status.
- On mount: `GET /catering/events/${slug}/order/check?phone=${who.phone}`; if it returns an existing (non-cancelled) order, set `writeRemembered(slug, {...who, orderQrCode})` and `router.replace(done)`.
- Load `GET /catering/events/${slug}/menu-steps?locale=${locale}`; while loading show `Spinner` from `StepSheet` with `t("bowl.loading")`.
- Draft: `readEventDraft(slug) ?? defaultEventDraft(steps)`; `update` writes through `writeEventDraft`.
- `<StepSheet step="bowl" title={t("bowl.title")} lede={t("bowl.lede")} backHref={eventPath(locale, slug, "rsvp")} wide summary={<span className="text-oh-cream/85">{t("onTheHouse")}</span>} cta={{ label: t("bowl.cta"), onClick: submit, disabled: !complete, busy }} alert={error}>` wrapping `<BowlBuilder steps={steps} draft={draft} update={update} />`.
- Note: `BowlBuilder` shows list prices per item (soup caption and extras). Items here have `basePriceCents` from the menu; since bowls are free, pass steps through a mapper that sets `basePriceCents: 0` and `additionalPriceCents: 0` on every item before rendering so "$0.00" never appears… check `formatCents(0)` output; if BowlBuilder renders "$0.00" captions, add an optional `hidePrices?: boolean` prop to `BowlBuilder` that omits the price spans (small, additive change in `BowlBuilder.tsx`; keep default behavior identical).
- `submit`: `POST /catering/events/${slug}/order` with `{ items: buildLines(draft, steps), guestName: who.name, guestPhone: who.phone, dob: rsvp dob if known }`; on 200 `writeRemembered(slug, {...who, orderQrCode})`, `clearEventDraft(slug)`, `router.push(done)`; on 400 with `existingOrderQrCode` do the same with that code; else show the error.

- [ ] **Step 5: EventDone**

`done/page.tsx` → `<EventDone />` (client). Reads `who = readRemembered(slug)`; without `orderQrCode` → replace to invite. Polls nothing; fetches `GET /orders/status?orderQrCode=` once (same call `useOrderStatus` makes; import `TENANT` from `components/site/order/useOrderStatus.ts` for the header) to list items. Renders: `Eyebrow done.eyebrow`, `Display done.title {name}` (first name), `Body done.lede`, a linen panel `bg-oh-linen text-oh-charcoal rounded-[28px] p-5` titled `done.yourBowl` listing `items` as "name" with `selectedLabel ?? selectedValue` muted, `EventMeta`, then CTAs: `PRIMARY` link to status (`done.status`), `SECONDARY` button `done.change` which confirms (`window.confirm(t("done.changeConfirm"))` is acceptable here) then `DELETE /catering/events/${slug}/order/${orderId}`, clears `orderQrCode` from remembered, and pushes to order. Hide "change" when `startsAt` has passed.

- [ ] **Step 6: Verify**

Run guards + typecheck: `cd apps/web && pnpm vitest run lib/site/__tests__ && pnpm exec tsc --noEmit`.
Manual curl sanity: `curl -s "http://localhost:4000/catering/events/<dev-slug>/menu-steps?locale=en" | head -c 300`.
Quick browser pass (one Chromium, iPhone 15 viewport) with a scratchpad node script (see Task 9 for the script skeleton): rsvp → order → done renders without console errors. Save `rsvp-390.png`, `order-390.png`, `done-390.png` to the scratchpad and look at them.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/[locale]/(site)/e" apps/web/lib/site/event-draft.ts apps/web/lib/site/__tests__/event-draft.test.ts apps/web/components/site/order/BowlBuilder.tsx apps/web/messages
git commit -m "feat(site): private event guest, bowl and reserved steps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Event status page

**Files:**
- Create: `apps/web/app/[locale]/(site)/e/[slug]/status/page.tsx`, `EventStatusView.tsx`
- Consumes: `useOrderStatus({ code, demoStageParam: null, followParent: false, locale })` → `{ order: StatusOrder | null, ... }` (read `useOrderStatus.ts:76-208` for the exact return fields, e.g. `loading`, `error`, `refresh`), `StatusTimeline({ status, times, timeZone })` (read `StatusTimeline.tsx` for `OrderTimes` construction; copy how `StatusView.tsx` builds `times`), `KitchenFeed({feed, loading})` plus how StatusView fetches the feed (`/orders/commentary` or `/orders/feed`; copy the hook/useEffect it uses, keeping `FEED_STAGES`), `FortuneLine({orderQrCode})`, `RoastLine({orderQrCode})`, `BackstoryLine({orderId})`, `Display/Eyebrow/Title/Body`, `Icon`, `CoBrand`, `Countdown`, `EventMeta`, `CTA_CLASS`.
- API: `POST /catering/orders/:qrCode/arrive` → 200 or 400 `{error}` when not the event day; `GET /catering/events/:slug/rsvp/:token` for name/zodiac (token from `readRemembered(slug).token`).

- [ ] **Step 1: Page**

`status/page.tsx` (client or server wrapper) reads `searchParams.qrCode`, renders `<EventStatusView code={qrCode} />`. Falls back to `readRemembered(slug).orderQrCode` on the client when no `qrCode` param.

- [ ] **Step 2: EventStatusView**

Layout (`flex flex-col gap-8 px-4 pt-6 pb-[calc(var(--dock-h)+2rem)] md:mx-auto md:max-w-2xl`), `data-event-status`:
1. `<CoBrand event size="sm" />`.
2. Personal line: `Body` with `status.personal {name, zodiac: t(\`zodiac.${zodiac}\`)}` when the rsvp has a zodiac, else `status.personalNoZodiac`. Name from `order.guestName ?? who.name`.
3. **Held state** (`order.status === "PAID"`): `Eyebrow status.held`, `Display` with the event title, `Body status.heldLede`, `<Countdown />`, `<EventMeta />`, then the arrive button: `<button className={CTA_CLASS} data-testid="arrive" disabled={!eventDay || busy}>` labelled `status.arrive`. `eventDay` computed client-side with `new Intl.DateTimeFormat("en-CA", {timeZone: event.timezone, year, month, day})` comparing `startsAt` and now. When not the day, a `Body` under the button says `status.notYet`. On click POST arrive; on 200 call the status hook's refresh (or set a local `arrived` flag and let the next poll update); on 400 show the server error in a `role="alert"`.
4. **Live state** (QUEUED and beyond): stage `Eyebrow` and `Display` reusing `afterOrder` stage copy keys exactly as `StatusView.tsx` does (copy its `STAGE_ICON` map and the `t(\`stage.${status}.title\`)` style, verify key names in `messages/en.json` under `afterOrder`), `KitchenFeed`, `StatusTimeline` with `timeZone={event.timezone}`, `FortuneLine`, `RoastLine`, `BackstoryLine`, the linen bowl panel (`status.yourBowl`, items as in Task 5).
5. Loading: `Spinner`. Not found: `Body status.notFound` and a link back to the invite.
6. Polling: `useOrderStatus` already polls every 10 s; make sure it keeps polling in PAID (check its stop conditions; if it stops on PAID, add an option `{ keepPolling: true }` default false, additive).

- [ ] **Step 3: Verify on dev**

Set the dev event's date to today 11:59 PM MT so check-in opens: `curl -s -X PATCH http://localhost:4000/admin/catering/events/$ID -H 'content-type: application/json' -d '{"eventDate":"<today>T23:59:00-06:00"}'`. Create an order through the UI (Task 5 flow), open `/en/e/<slug>/status?qrCode=<code>`, tap I'm here → the page moves to QUEUED. Advance with `curl -X PATCH http://localhost:4000/kitchen/orders/<orderId>/status -H 'content-type: application/json' -d '{"status":"PREPPING"}'` and watch the page. Screenshots `status-held-390.png`, `status-prepping-390.png`.
Run guards + typecheck.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/[locale]/(site)/e" apps/web/components/site/order/useOrderStatus.ts apps/web/messages
git commit -m "feat(site): private event status page with day-of check-in

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Admin event sheet and Guests tab

**Files:**
- Modify: `apps/admin/lib/catering.ts` (types: `CateringEvent` gains `hostName?`, `welcomeNote?`; `Rsvp` gains `notes?`, `inviteUrl`, `ordered`, `orderQrCode`; `EventForm`/`EventBody` gain `hostName`, `welcomeNote`, `startTime`, `complimentary`)
- Modify: `apps/admin/app/(console)/catering/_components/EventSheet.tsx`
- Modify: `apps/admin/app/(console)/catering/[id]/tabs/OverviewTab.tsx` (attendee link → `/en/e/{slug}`)
- Create: `apps/admin/app/(console)/catering/[id]/tabs/GuestsTab.tsx`
- Modify: `apps/admin/app/(console)/catering/[id]/page.tsx` (add tab)
- Test: `apps/admin/lib/__tests__/catering.test.ts` (extend)

**Interfaces:**
- Produces (`lib/catering.ts`): `combineDateTime(dateISO: string, time: string /* "18:00" */, tz = "America/Denver"): string` returns the UTC ISO for that wall-clock time in Denver (use `Intl` offset math or a tested helper; no new deps). `splitDateTime(iso): { date: "YYYY-MM-DD", time: "HH:mm" }` in Denver. `formatBirthday("03/14/1990") → "Mar 14, 1990"`.

- [ ] **Step 1: Failing tests**

```ts
it("combineDateTime builds the Denver wall clock", () => {
  expect(combineDateTime("2026-10-04", "18:00")).toBe("2026-10-05T00:00:00.000Z"); // MDT
  expect(combineDateTime("2026-12-20", "18:00")).toBe("2026-12-21T01:00:00.000Z"); // MST
});
it("splitDateTime inverts it", () => expect(splitDateTime("2026-10-05T00:00:00.000Z")).toEqual({ date: "2026-10-04", time: "18:00" }));
it("formatBirthday", () => expect(formatBirthday("03/14/1990")).toBe("Mar 14, 1990"));
```
Run: `cd apps/admin && pnpm vitest run lib/__tests__/catering.test.ts` → FAIL. Implement; PASS.

- [ ] **Step 2: EventSheet**

Add fields in this order after the existing date field: Start time (`<TextInput type="time">` or a `Select` of 30-minute options; default `18:00` for DINNER, `12:00` for LUNCH), Host name (`TextInput`), Welcome note (`TextArea`, 240 chars), `Toggle` "Complimentary (no charge for bowls)" which sets `pricePerBowlCents` 0 and disables the price input. On submit, `eventDate = combineDateTime(date, time)`. On edit, prefill with `splitDateTime(event.eventDate)`.

- [ ] **Step 3: GuestsTab**

- `useResource` → `GET /admin/catering/events/:id/rsvps`.
- `DataList` columns: Name, Phone (formatted `(801) 555-0100`), Birthday (`formatBirthday`), Zodiac, Notes, Status (`Badge` "Ordered" good / "Not yet"), actions: Copy link (`navigator.clipboard.writeText(inviteUrl)` + toast), Edit, Delete (`useConfirm`).
- `renderCard` for phones: name bold, phone, birthday line, badge, action buttons row.
- "Add guest" `Button variant="primary" icon="plus"` opens a `Sheet` with `TextInput` name, phone, `TextInput type="date"` birthday (convert to `MM/DD/YYYY` on save; prefill from `dob`), `TextArea` notes. Save → POST or PATCH; 409 → toast the server message.
- Empty state: `EmptyState` "No guests yet. Add the people you are cooking for."

- [ ] **Step 4: Wire the tab and the Overview link**

`page.tsx`: `TabId` gains `"guests"`; TABS order: Overview, Guests, Messages (Task 8), Cook (Task 8), Orders, Shopping, Overage (only when `event.pricePerBowlCents > 0`), Survey. Render `<GuestsTab eventId={event.id} />`.
`OverviewTab.tsx`: the attendee URL becomes `${webOrigin}/en/e/${event.slug}`; show Host and Welcome note rows when set.

- [ ] **Step 5: Verify**

`cd apps/admin && pnpm vitest run && pnpm exec tsc --noEmit`. Open `http://localhost:3001/catering/<dev id>` in the one Chromium (390 and 1440), add a guest with a birthday, edit, copy link. Screenshots `admin-guests-390.png`, `admin-guests-1440.png`.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/lib/catering.ts apps/admin/lib/__tests__/catering.test.ts "apps/admin/app/(console)/catering"
git commit -m "feat(admin): event start time, host and welcome note; Guests tab with birthdays and personal links

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Admin Messages and Cook tabs

**Files:**
- Create: `apps/admin/app/(console)/catering/[id]/tabs/MessagesTab.tsx`, `CookTab.tsx`
- Modify: `apps/admin/app/(console)/catering/[id]/page.tsx` (tabs; remove the header "Send invites" button)
- Modify: `apps/admin/lib/catering.ts` (types `GuestMessages`, `SendResult`, `CookOrder`)

**Interfaces:**
- Consumes: `GET /admin/catering/events/:id/messages`, `POST .../messages/send {kind, rsvpIds?}`, `GET /admin/catering/events/:id/orders` (read the response shape at `routes.js:~1291`: it must include `id, orderQrCode, status, guestName, items[{name, quantity, selectedValue}]`; extend the select if an item field is missing), `PATCH /kitchen/orders/:id/status {status}` (admin bearer is added by `ApiAuthInit`; check `packages/api/src/orders/kitchen-status.js:69-117` for the allowed transitions; if PAID→PREPPING is rejected, the Start action first calls `POST /catering/orders/:qrCode/arrive`, then PATCH PREPPING. Note arrive is day-gated; on the Cook tab allow a host override by passing `{ force: true }` in the body to the arrive route and accept it only when the request passed admin auth: implement `force` in `routes.js` arrive handler using `checkAdminAuth(req)` the way other admin-aware public routes do, or simply add an admin route `POST /admin/catering/orders/:qrCode/arrive` that skips the day check. Pick the admin route.)

- [ ] **Step 1: API: `POST /admin/catering/orders/:qrCode/arrive`** in `routes.js` next to the public arrive: same PAID→QUEUED flip without the day check. Add a test line to `attendee.test.js`? It is a route, so verify with curl instead. Commit with the tab.

- [ ] **Step 2: MessagesTab**

- `SegmentedControl` for kind: Invite / Day-of reminder / Status link (`MESSAGE_KINDS` order), with a one-line `Body`-style helper under it: "Invite: the personal link to pick a bowl." etc.
- One `Card` per guest: name + phone header, the composed text in a `whitespace-pre-wrap text-sm` block, actions: Copy (clipboard + toast "Copied"), Send (`useConfirm` "Text {name} now?" → POST send with `rsvpIds: [id]`), disabled with a "No order yet" badge when `messages[kind]` is null.
- Header action: "Send to everyone" (`useConfirm` with the count) → POST send with no `rsvpIds`; toast `Sent {sent} of {total}. {failed} failed.` and list failures by name under the button.
- Empty: `EmptyState` pointing to the Guests tab.

- [ ] **Step 3: CookTab**

- Poll `GET /admin/catering/events/:id/orders` every 10 s (reuse `useResource` with an interval or a `setInterval` calling `reload`).
- Group by status in columns on 1440 and a single list on phones: Waiting (PAID), Checked in (QUEUED), Cooking (PREPPING), Ready (READY), Served (SERVING), Done (COMPLETED).
- Card: guest name (bold), the bowl as lines ("Classic Beef Noodle Soup", "Wide Noodles", then sliders as "Spice Level: Medium"), special-diet highlight if any item name contains "no beef" or "Gluten Free".
- Actions by status: PAID → "Check in" (admin arrive) ; QUEUED → "Start cooking" (PREPPING); PREPPING → "Ready" (READY); READY → "Served" (SERVING); SERVING → "Done" (COMPLETED). One primary `Button` per card; `useToast` on failure.
- Stat tiles at the top: total bowls, waiting, cooking, ready.

- [ ] **Step 4: Wire tabs**, remove the header "Send invites" button (its function lives in Messages now). Keep "Edit event".

- [ ] **Step 5: Verify**

`pnpm vitest run && pnpm exec tsc --noEmit` in `apps/admin`. Browser: Messages tab shows texts for the dev guest; do NOT press Send unless the guest phone is `ADMIN_PHONE_NUMBER`. Cook tab: advance the dev order through all stages and confirm the web status page (Task 6) follows. Screenshots `admin-messages-390.png`, `admin-cook-1440.png`.

- [ ] **Step 6: Commit**

```bash
git add "apps/admin/app/(console)/catering" apps/admin/lib/catering.ts packages/api/src/catering/routes.js
git commit -m "feat(admin): Messages tab (Chappy-voice texts per guest) and Cook tab (host kitchen)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: End-to-end test and screenshot review

**Files:**
- Create: `tests/e2e/site/events.spec.ts` (node test runner + playwright, same style as `tests/e2e/site/after-order.spec.ts`: `iphone15()` device, `hideDevBadge`, `E2E_BASE_URL`, `E2E_API_URL`, `E2E_SHOT_DIR`)

- [ ] **Step 1: Write the spec**

Flow (one browser, iPhone 15):
1. Setup via API: create an event (`POST /admin/catering/events`, `eventDate` = today 23:59 Denver, `pricePerBowlCents` 0, `status` LIVE via PATCH), add a guest via `POST .../rsvps` with phone `8015550199`, read `inviteUrl` from `GET .../rsvps`.
2. Visit the invite URL (with `?rsvp=`): assert the greeting contains the guest's first name, the CTA "Reserve my bowl" exists, no horizontal scroll (`scrollWidth <= innerWidth`). Shot `events-invite-390`.
3. Tap CTA → rsvp: fields prefilled; fill birthday 03/14/1990; submit. Shot `events-guest-390`.
4. Order: wait for the soup radios; the CTA "Reserve this bowl" enabled; assert no "$" appears in the page text; tap CTA. Shot `events-bowl-390`.
5. Done: headline contains the first name; shot `events-done-390`; tap "Follow my bowl".
6. Status held: "I'm here" button enabled (event day); tap; wait for the QUEUED stage copy. Shot `events-status-held-390` before tap and `events-status-queued-390` after.
7. API: `PATCH /kitchen/orders/:id/status {status:"PREPPING"}` then `READY`; assert the page updates within 15 s each. Shot `events-status-ready-390`.
8. zh-TW pass: open the invite in `/zh-TW/e/...` and assert no English words from a small list (`Reserve`, `Hosted`, `Until`) appear.
9. Admin at 390 and 1440 (`http://localhost:3001/catering/<id>`): click Guests, Messages, Cook; shots for each; assert the Messages tab shows the guest's name and the Cook tab shows the order.
10. Teardown: `DELETE /admin/catering/events/:id`.

- [ ] **Step 2: Run**

`cd /home/claude-user/projects/oh-platform && E2E_BASE_URL=http://localhost:3000 E2E_API_URL=http://localhost:4000 E2E_ADMIN_URL=http://localhost:3001 E2E_SHOT_DIR=/tmp/claude-1001/-home-claude-user-projects-oh-platform/2086a625-c442-48ae-8bb4-f27d36786f36/scratchpad/shots node --env-file=.env --test tests/e2e/site/events.spec.ts`
Expected: PASS. Open every PNG with the Read tool and fix anything that looks off (overlaps, clipped text, light-gray gaps, prices, emoji). Re-run until clean.

- [ ] **Step 3: Full guard suites**

`cd apps/web && pnpm vitest run` ; `cd ../admin && pnpm vitest run` ; `cd ../../packages/api && node --test "src/**/__tests__/*.test.js"`. All PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/site/events.spec.ts
git commit -m "test(e2e): private event flow on iPhone 15 plus admin host tabs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Owner notice (meme image and script)

**Files:**
- Create: `apps/web/public/chappy/tenth-time.png` (1080x1350)
- Create: `packages/api/scripts/notify-owner-private-events.mjs`
- Create (scratch, not committed): meme HTML in the scratchpad

- [ ] **Step 1: Render the image**

Write `meme.html` in the scratchpad: 1080x1350, `background:#1C1B19`, Google Fonts Instrument Serif + Raleway via `<link>`, a phone-shaped card (`#2A2724`, 44px radius, 1px `#3A3632` border) that parodies the order status page: eyebrow "ORDER #10" in `#E07A5A` uppercase tracking 0.2em; headline (Instrument Serif, 84px, `#F2EDE4`) "Dano's Unit"; status row "PREPPING" with a gold (`#C9A227`) progress bar at ~90%; timeline lines (Raleway 30px, `#9A9188`): "Placed: 1991, fastball, square in the unit" / "Queued: surgeries 1 through 9" / "Prepping: scar tissue, removed" / "Est. wait: 35 years, almost there"; a Chappy quote block at the bottom (Raleway 34px, cream): "Tenth time's the charm, you magnificent bastard." with the Oh! mark (`/brand/oh-mark-light-204.webp` copied to the scratchpad) 72px at the bottom right. No emoji.
Render with Playwright (node script using `createRequire("/home/claude-user/projects/oh-platform/package.json")("playwright")`, `chromium.launch({args:["--no-sandbox"]})`, viewport 1080x1350, `deviceScaleFactor: 1`, `page.goto("file://…/meme.html", {waitUntil:"networkidle"})`, `page.screenshot({path: "apps/web/public/chappy/tenth-time.png"})`). Look at the PNG with Read and iterate until it looks sharp. Keep under 600 KB (MMS limit 5 MB, but keep it light).

- [ ] **Step 2: Script**

```js
// packages/api/scripts/notify-owner-private-events.mjs
// Usage: node --env-file=../../.env scripts/notify-owner-private-events.mjs [--send] [--to +1...]
// Dry-run prints the text. --send texts ADMIN_PHONE_NUMBER (or --to) with the image as MMS.
import { sendSMS } from "../src/notifications.js";
const args = process.argv.slice(2);
const send = args.includes("--send");
const toIdx = args.indexOf("--to");
const to = toIdx >= 0 ? args[toIdx + 1] : process.env.ADMIN_PHONE_NUMBER;
const web = process.env.WEB_BASE_URL || "https://www.ohbeef.com";
const admin = process.env.ADMIN_APP_URL || "https://admin-oh-beef-noodle-soup.vercel.app";
const body = [
  "Dano. Chappy. The private events build is live in production.",
  `Your table: ${web}/en/e/oh-business-planning`,
  `Your admin: ${admin}/catering (Guests, Messages, Cook tabs are yours; add the other five and hit Send.)`,
  "",
  "Now the real news. Thirty-five years ago a fastball picked a fight with your dick and today a surgeon went back in for round TEN to scrape out the scar tissue. Ten. Most people don't get ten of anything. You've got a frequent flyer card for your own urethra. Hell of a streak. Don't mess this up. I believe in you. Sort of.",
  "",
  "Kristy: he will milk this for a week. Hold the line. Bowls are on me Sunday.",
  "",
  "Heal up, you magnificent bastard. The noodles can wait.",
].join("\n");
const mediaUrl = `${web}/chappy/tenth-time.png`;
console.log(body, "\n\nmedia:", mediaUrl, "\nto:", to ? `…${String(to).slice(-4)}` : "(none)");
if (!send) { console.log("\n(dry run; pass --send)"); process.exit(0); }
if (!to) { console.error("no recipient"); process.exit(1); }
const r = await sendSMS({ to, body, mediaUrl });
console.log(r);
process.exit(r.success ? 0 : 1);
```
Run the dry run: `cd packages/api && node --env-file=../../.env scripts/notify-owner-private-events.mjs` (prints, sends nothing). Check the length prints under 1,600 characters.

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/chappy/tenth-time.png packages/api/scripts/notify-owner-private-events.mjs
git commit -m "chore: owner notice for the private events release (Chappy text plus MMS)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Release to production and create the event

**Files:** none new. Uses `.env.prod-bak` (prod `DATABASE_URL`, `ADMIN_API_KEY`, `ADMIN_PHONE_NUMBER`), `packages/db/sql/2026-10-01-private-events.sql`.

- [ ] **Step 1: Local prod builds** (both must pass before pushing; see memory `prod-deploy-gotchas`)

`cd /home/claude-user/projects/oh-platform && pnpm --filter @oh/web build && pnpm --filter @oh/admin build` (run one at a time; memory is tight). Also `pnpm --filter @oh/web lint` and `pnpm --filter @oh/admin lint` if the scripts exist. Fix anything red and commit.

- [ ] **Step 2: Prod SQL** (additive, idempotent)

`set -a; source .env.prod-bak; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/sql/2026-10-01-private-events.sql` → three `ALTER TABLE`. Verify: `psql "$DATABASE_URL" -c '\d "CateringEvent"' | grep -E 'hostName|welcomeNote'`.

- [ ] **Step 3: Merge and push**

```bash
git checkout main && git merge --ff-only private-events || git merge --no-ff private-events -m "merge: private events (catering on the new design system)"
git push origin main
```
Watch Railway: `mcp railway list-deployments` or `railway logs --service "@oh/api"`; and Vercel: `curl -s "https://api.vercel.com/v6/deployments?projectId=prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0&teamId=team_lcuKROVnRGMXAYN6Q3x44DKh&limit=1" -H "Authorization: Bearer $VERCEL_TOKEN"` and the admin project. Wait for READY on all three. If the Railway build fails with `spawn prisma EACCES`, redeploy (known flake).

- [ ] **Step 4: Create the event in prod**

```bash
API=https://api.ohbeef.com; KEY=$ADMIN_API_KEY   # from .env.prod-bak
EV=$(curl -s -X POST $API/admin/catering/events -H "x-admin-api-key: $KEY" -H 'content-type: application/json' -H 'x-tenant-slug: oh' -d '{
 "clientCompany":"Oh! Business Planning","eventName":"Oh! Business Planning",
 "eventDate":"2026-10-05T00:00:00.000Z","slot":"DINNER",
 "eventAddress":"379 W 3175 N, Lehi, UT 84043","hostName":"Dano and Kristy",
 "welcomeNote":"Six of us, one table, and the bowls we have been talking about. Pick yours now so it is ready when you walk in.",
 "pricePerBowlCents":0,"minimumBowls":6,"expectedGuests":6,"eventType":"Private dinner",
 "contactName":"Dano","contactPhone":"'"$ADMIN_PHONE_NUMBER"'"}')
ID=$(echo "$EV" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id'); echo $ID
curl -s -X PATCH $API/admin/catering/events/$ID -H "x-admin-api-key: $KEY" -H 'content-type: application/json' -d '{"slug":"oh-business-planning","status":"LIVE"}'
```
If `slug` is not in the PATCH whitelist, add it to the whitelist in Task 3 (then it is already deployed) or update it with psql: `UPDATE "CateringEvent" SET slug='oh-business-planning' WHERE id='<ID>';`. Then add the owner as a guest: `POST $API/admin/catering/events/$ID/rsvps {"name":"Dano","phone":"$ADMIN_PHONE_NUMBER"}`.

- [ ] **Step 5: Prod smoke**

- `curl -s https://api.ohbeef.com/catering/events/oh-business-planning | head -c 400` → 200 with `hostName`.
- `curl -s -o /dev/null -w '%{http_code}\n' https://www.ohbeef.com/en/e/oh-business-planning` → 200; `/zh-TW/e/oh-business-planning` → 200.
- `curl -s -o /dev/null -w '%{http_code}\n' "https://api.ohbeef.com/catering/availability?from=2026-10-01&to=2026-10-02"` → 404 (booking still gated).
- `curl -s -o /dev/null -w '%{http_code}\n' https://www.ohbeef.com/chappy/tenth-time.png` → 200.
- One Chromium pass against prod at 390: invite page renders with the hero and the countdown; take `prod-invite-390.png` and look at it. Do not create an order on prod with a fake phone; the owner's own flow is the real test.

- [ ] **Step 6: Owner notice**

`cd packages/api && set -a; source ../../.env.prod-bak; set +a; WEB_BASE_URL=https://www.ohbeef.com node --env-file=../../.env scripts/notify-owner-private-events.mjs --send` → `{ success: true, sid: ... }`. (`ADMIN_PHONE_NUMBER` comes from the env; confirm the last 4 digits printed match the owner's.)

- [ ] **Step 7: Memory and docs**

Update `CLAUDE.md` Catering section: attendee routes are public again at `/{locale}/e/{slug}`; booking stays gated. Save a memory `private-events-2026-10.md` (what shipped, prod event id and slug, the Sunday 10/4 plan, the Cook tab, the owner still has to add 5 guests) and index it in `MEMORY.md`. Commit `CLAUDE.md`.

---

### Task 12: Default outline on slider choices (shared BowlBuilder) with a subtle legend

Owner request (2026-10-01): "When an order starts, there are different levels of options that we have set defaults to
(e.g. firm, medium, or soft noodles, defaulted to Medium). Before, on the old site, we outlined these defaults so if the
user changes their selection they can still see what the default WAS. Put this back, with a nice legend. Subtle; it must
not become the focus of the ordering flow." Applies to the dine-in bowl step and, through the shared component, the event
bowl step. Run this task before Task 9 so the e2e screenshots include it.

**Files:**
- Modify: `apps/web/components/site/order/BowlBuilder.tsx:129-160` (the SLIDER branch, `role="radiogroup"` segmented control)
- Modify: `apps/web/components/site/order/order.css` (one `.oh-default-mark` rule if a pseudo-element is cleaner than utilities)
- Modify: `apps/web/messages/{en,zh-TW,zh-CN,es}.json` `orderFlow.bowl` (`defaultLegend`, `defaultAria`)
- Test: `apps/web/lib/site/__tests__/bowl-defaults.test.tsx` (vitest + @testing-library if present in `apps/web/package.json`; otherwise a render test with `react-dom/server` `renderToStaticMarkup`)

**Interfaces:**
- Consumes: `section.sliderConfig.default` (index), `draft.sliders[item.id]`.
- Produces: in each slider segmented control, the default segment carries `data-default="true"` and, when it is not the current choice, a subtle outline: `ring-1 ring-inset ring-oh-cream/25` (cream at 25% on the ink track), plus `aria-description` text from `orderFlow.bowl.defaultAria` ("Our usual"). The selected segment keeps today's filled style; if the selected segment is also the default, no extra ring (the fill already says it).
- A legend appears once, under the Customize step title (`step.id === "customize"`), right-aligned, muted (`text-xs text-oh-mute`): a 14x14 rounded-sm swatch with the same ring followed by `orderFlow.bowl.defaultLegend` ("Outlined is our usual"). Rendered only when at least one slider in the step has a numeric `sliderConfig.default`.

- [ ] **Step 1: Messages**

en: `"defaultLegend": "Outlined is our usual"`, `"defaultAria": "Our usual"`. Add natural translations to zh-TW, zh-CN, es. Run `pnpm vitest run lib/site/__tests__/locale-parity.test.ts`.

- [ ] **Step 2: Failing render test**

```tsx
// apps/web/lib/site/__tests__/bowl-defaults.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "../../../messages/en.json";
import { BowlBuilder } from "@/components/site/order/BowlBuilder";
import { emptyDraft } from "@/lib/site/order-draft";

const steps = [
  { id: "bowl", title: "Bowl", sections: [] },
  { id: "customize", title: "Customize", sections: [
    { id: "nt", name: "Noodle Texture", selectionMode: "SLIDER", item: { id: "nt", name: "Noodle Texture", basePriceCents: 0 }, sliderConfig: { labels: ["Firm", "Medium", "Soft"], default: 1 } },
  ] },
] as any;

function render(sliders: Record<string, number>) {
  const draft = { ...emptyDraft(), sliders };
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en as any}><BowlBuilder steps={steps} draft={draft} update={() => {}} /></NextIntlClientProvider>,
  );
}

describe("slider defaults", () => {
  it("marks the default segment and shows the legend once", () => {
    const html = render({ nt: 2 });
    expect(html.match(/data-default="true"/g)?.length).toBe(1);
    expect(html).toContain("Outlined is our usual");
    expect(html).toContain("Our usual");
  });
  it("does not outline the default when it is the current choice", () => {
    const html = render({ nt: 1 });
    expect(html).toMatch(/data-default="true"[^>]*data-selected="true"/);
    expect(html).not.toMatch(/data-default="true"[^>]*ring-oh-cream\/25/);
  });
});
```
Run: `cd apps/web && pnpm vitest run lib/site/__tests__/bowl-defaults.test.tsx` → FAIL (no data-default). If `BowlBuilder` pulls `next/image` or CSS imports that break in vitest, check `apps/web/vitest.config.ts` for existing aliases/mocks used by other component tests and follow them; `order.css` import may need `css: false` or an existing style mock.

- [ ] **Step 3: Implement**

In the SLIDER branch: `const def = section.sliderConfig?.default; const isDefault = (i: number) => typeof def === "number" && i === def;` On each segment button add `data-default={isDefault(i) ? "true" : undefined}`, `data-selected={i === current ? "true" : undefined}`, and `aria-description={isDefault(i) ? t("defaultAria") : undefined}`; extend `className` with `isDefault(i) && i !== current ? "ring-1 ring-inset ring-oh-cream/25" : ""`. Keep every existing class. In the `customize` step header (the `Title` branch at ~L72), render the legend element after the title inside a `flex items-end justify-between gap-4` wrapper, only when `step.sections.some((s) => typeof s.sliderConfig?.default === "number")`.

- [ ] **Step 4: Run** the test (PASS), the guards (`pnpm vitest run lib/site/__tests__`), typecheck. Look at the dine-in bowl step at 390 (`/en/order/location/<id>?step=bowl`, pick any location id from `GET /locations`) in the one Chromium: change Noodle Texture to Soft and confirm Medium shows a faint outline, and the legend reads quietly under the Customize title. Screenshot `bowl-defaults-390.png`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/site/order/BowlBuilder.tsx apps/web/components/site/order/order.css apps/web/messages apps/web/lib/site/__tests__/bowl-defaults.test.tsx
git commit -m "feat(site): outline each slider's usual choice in the bowl step, with a quiet legend

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

## Execution order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 12 → 9 → 10 → 11. Tasks 4-6 (web) and 7-8 (admin) can run as two parallel lanes after Task 3; nothing else in parallel (memory).
