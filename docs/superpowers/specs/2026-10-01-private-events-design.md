# Private Events: catering on the new design system (Design Spec)

Date: 2026-10-01. Status: owner delegated all decisions for this effort (away for surgery); approved by proxy and executed autonomously.

## 1. Context

Catering was removed from the customer site on 2026-09-24 and kept only in the admin console. The owner now
wants the catering side brought up to the site's new design system (night palette, Instrument Serif and
Raleway, in-house icons, the order-flow step sheets, the status page), including the attendee ordering flow,
and wants a first real event run through it: **Oh! Business Planning**, Sunday 2026-10-04 at 6:00 PM MT,
at the owner's home (379 W 3175 N, Lehi, UT 84043), six people (owner, Kristy, four guests), bowls on the house.

The deleted attendee pages (`apps/web/app/[locale]/catering/e/[eventSlug]/*`, commit `e417d32`) are the
functional reference. The API routes still exist in `packages/api/src/catering/routes.js` behind
`CATERING_PUBLIC_ENABLED`. Admin pages exist on the new admin UI kit.

**Goal:** a host (the owner) creates a private event in admin, records the guests (name, phone, birthday,
notes), sends each guest a personal text in Chappy's voice, each guest pre-orders a bowl on a phone in the new
design, and on the day each guest checks in and follows their bowl on a status page that knows who they are.
The host advances the bowls from a phone-friendly Cook tab in admin.

## 2. Owner rules (hard constraints)

1. Mobile-first. Phone is priority one.
2. The site's design system exactly: tokens in `apps/web/app/globals.css` `@theme`, `components/site/*`
   primitives, `Icon` set, `StepSheet`, `BowlBuilder`, `Sheet`, `Reveal`. No emoji, no icon libraries.
3. No em dashes in user-facing copy. Welcoming voice (no "nobody greets you").
4. Fully translated (en, zh-TW, zh-CN, es); the literal-JSX, parity and no-emoji guards must pass.
5. No approvals needed; text the owner only if truly blocked. Deliver to production.
6. Use Sonnet/Opus subagents; the orchestrator stays lean.

## 3. Decisions

| Topic | Decision |
|---|---|
| Public booking flow (calendar, payment, client dashboard) | Stays removed from the web app. Those API routes stay behind `CATERING_PUBLIC_ENABLED`. |
| Attendee routes | Always reachable on the API (keyed by slug; the event must be LIVE). The gate's allowlist becomes prefix-based for `/catering/events/`, `/catering/orders/`, `/catering/menu`. |
| Web URL | `/{locale}/e/{slug}` (short, fits one SMS segment). Sub-routes `rsvp`, `order`, `done`, `status`. The old `/catering/*` redirect is unchanged. |
| Identity | A guest arrives with `?rsvp={rememberToken}` (personal link from admin) or anonymously. The RSVP step upserts by phone. A 30-day cookie remembers `{name, phone, slug}` (reference: deleted `lib/catering/remember.ts`). |
| Birthday | Collected on the RSVP step as month/day/year ("for your fortune"), stored in `CateringRSVP.dob` (MM/DD/YYYY) and zodiac. Shown on the status page as a personal line. Optional. |
| Menu for the bowl | New `GET /catering/events/:slug/menu-steps?locale=` returns the `/menu/steps` shape filtered to the catering allowlist: `bowl` (soup, noodles) and `customize` (sliders). No extras or drinks. The site's `BowlBuilder` and `order-draft` are reused. |
| Price | Attendee orders are already `totalCents: 0`. The UI shows "On the house" and never a money total. `pricePerBowlCents` 0 marks the event complimentary; Overage is hidden for such events. |
| Status page | New `EventStatusView` reusing `StatusTimeline`, `KitchenFeed`, `FortuneLine`, `RoastLine`, `BackstoryLine`, the linen bowl panel and `useOrderStatus`. No pod card, queue, add-ons or "I'm done". Held state (order status PAID) shows a countdown and, on the event day in America/Denver, the "I'm here" button (`POST /catering/orders/:qrCode/arrive`). |
| Host kitchen | Admin event detail gets a **Cook** tab: each order as a card with Start, Ready, Served actions, calling the existing kitchen status endpoint. Works on a phone. No dine-in flag flip needed. |
| Texts | Deterministic templates in Chappy's voice (`packages/api/src/catering/messages.js`), no LLM, per guest, with the personal link. Kinds: `invite`, `reminder` (day-of), `status` (after they ordered). Admin **Messages** tab shows the composed text per guest with Copy and Send (one or all). The owner's existing "Send invites" button routes through the same module. |
| Owner notice | After the production deploy, a one-off script texts the owner in Chappy's voice with an MMS image (`sendSMS` gains `mediaUrl`). The image is hosted on the web app under `public/chappy/`. |
| Schema | Additive only: `CateringEvent.hostName String?`, `CateringEvent.welcomeNote String?`, `CateringRSVP.notes String?`. Applied to prod with idempotent SQL before deploy. |
| Day-of cron | Window computed on the America/Denver day instead of UTC (an evening MT event is the next UTC day). Not scheduled; the Messages tab covers this event. |
| Survey | Out of scope. The survey cron stays as is; no survey page is rebuilt. |

## 4. Architecture

### 4.1 API (`packages/api/src/catering/`)

- `routes.js`
  - Gate: `CATERING_ATTENDEE_PREFIXES = ["/catering/events/", "/catering/orders/", "/catering/menu"]` pass
    without the flag. `public-routes.js` keeps listing them as `catering-public`.
  - `GET /catering/events/:slug` adds `hostName`, `welcomeNote`, `eventAddress`, `isComplimentary`,
    `startsAt` (ISO of `eventDate`), `timezone: "America/Denver"`.
  - `GET /catering/events/:slug/rsvp/:token` returns `{name, phone, dob, notes}` for the token holder.
  - `POST /catering/events/:slug/rsvp` also accepts `notes` and `rsvpToken` (update by token, phone change allowed).
  - `GET /catering/events/:slug/menu-steps?locale=` as decided above, built from the same menu rows the
    dine-in `/menu/steps` uses, filtered with `getCateringMenuItems`.
  - `POST /catering/events/:slug/order` unchanged in contract; the response includes `statusUrl`.
  - Admin guests: `POST /admin/catering/events/:id/rsvps`, `PATCH .../rsvps/:rsvpId`, `DELETE .../rsvps/:rsvpId`.
    `GET .../rsvps` adds `inviteUrl`, `ordered`, `orderQrCode`, `notes`.
  - Admin messages: `GET /admin/catering/events/:id/messages` returns `{guests: [{rsvpId, name, phone, kind, body}]}`
    for every kind; `POST .../messages/send {kind, rsvpIds?}` sends via `sendSMS`, returns `{sent, failed, results}`.
    `POST .../send-invites` becomes a thin alias (kind inferred per guest: status if ordered, else invite).
  - Admin kitchen for hosts: `GET /admin/catering/events/:id/orders` already exists; the Cook tab uses the
    existing kitchen status update route (confirmed in the plan).
  - Event create/patch whitelist gains `hostName`, `welcomeNote`.
  - Links use `WEB_BASE_URL` plus `/en/e/{slug}` (locale prefix required by the router).
- `messages.js` (new): `composeGuestMessage({kind, event, rsvp, webBaseUrl})` and `MESSAGE_KINDS`. Pure, tested.
- `notifications.js`: `sendSMS({to, body, mediaUrl?})`.
- `scripts/notify-owner-catering-ready.mjs`: dry-run by default, `--send` to text `ADMIN_PHONE_NUMBER`.

### 4.2 Web (`apps/web`)

Route group `app/[locale]/(site)/e/[slug]/` with `layout.tsx` (`<RouteIntl route="events">`, fetches the
event server-side, 404 if not LIVE or COMPLETED):

| Route | Component | Content |
|---|---|---|
| `/e/[slug]` | `EventInvite` | `CoBrand` lockup (Oh! mark, then the event name in Instrument Serif), hero `SitePicture bowl-slices-top` on a linen panel, date, time and place lines with `Icon clock`/`pin`, host note, `Countdown`, CTA "Reserve my bowl". With `?rsvp=` it greets by name. If the cookie has an order: "Your bowl is reserved" with a status link. |
| `/e/[slug]/rsvp` | `GuestStep` in `StepSheet` | Name, phone, birthday (three fields), notes. Prefilled from token or cookie. Submits RSVP, stores the cookie, goes to order. |
| `/e/[slug]/order` | `EventBowlStep` | `BowlBuilder` on the event menu steps, draft kept in sessionStorage under `oh-event-draft:{slug}`. CTA "Reserve this bowl" posts the order. Marks `data-order-flow` so the dock hides. |
| `/e/[slug]/done` | `EventDone` | "Reserved" headline, the bowl summary, what happens on the day, status link, "change my bowl" (cancel and rebuild, allowed until start). |
| `/e/[slug]/status?qrCode=` | `EventStatusView` | As decided in section 3. Personal line from name and zodiac ("Year of the Dragon, Kristy. Good year for noodles."). |

Shared: `components/site/events/` (`CoBrand.tsx`, `Countdown.tsx`, `EventMeta.tsx`, `useEvent.ts`,
`remember.ts`), `lib/site/events.ts` (typed fetchers). Copy lives in the `events` namespace of
`messages/{en,zh-TW,zh-CN,es}.json`; `lib/site/client-messages.ts` registers route `events`.

### 4.3 Admin (`apps/admin/app/(console)/catering/`)

- `EventSheet`: adds Host name, Welcome note, Start time (combined with the date into `eventDate`), and a
  "Complimentary" toggle that sets `pricePerBowlCents` to 0.
- `[id]/page.tsx` tabs: Overview, **Guests**, **Messages**, **Cook**, Orders, Shopping, Overage (hidden when
  complimentary), Survey. "Send invites" header button moves into Messages.
- `tabs/GuestsTab.tsx`: `DataList` of guests (name, phone, birthday, zodiac, ordered), Add/Edit in a `Sheet`
  (`TextInput`s, birthday as a date input), Delete via `useConfirm`, Copy personal link.
- `tabs/MessagesTab.tsx`: `SegmentedControl` for kind, one card per guest with the composed text, Copy, Send;
  "Send to everyone" with a confirm; results as toasts.
- `tabs/CookTab.tsx`: order cards grouped by status with Start / Ready / Served buttons; polls every 10 s.
- `OverviewTab`: attendee link becomes `/en/e/{slug}`.

### 4.4 Data

Prisma additive fields (section 3). Dev: `prisma db push`. Prod: idempotent SQL via psql using the URL in
`.env.prod-bak`, run before the Railway deploy.

## 5. The event (production data)

Created through `POST /admin/catering/events` on api.ohbeef.com with `x-admin-api-key`:

| Field | Value |
|---|---|
| clientCompany / eventName | Oh! Business Planning |
| slug | `oh-business-planning` (set via PATCH if the generator differs) |
| eventDate | 2026-10-04 18:00 America/Denver (`2026-10-05T00:00:00.000Z`) |
| slot | DINNER |
| eventAddress | 379 W 3175 N, Lehi, UT 84043 |
| hostName | Dano and Kristy |
| welcomeNote | Short host note in the plan voice |
| pricePerBowlCents / minimumBowls / expectedGuests | 0 / 6 / 6 |
| contactName / contactPhone | Dano / `ADMIN_PHONE_NUMBER` |
| logoUrl | null (the lockup falls back to the Oh! mark alone) |
| status | LIVE |

Guests: the owner is added with `ADMIN_PHONE_NUMBER`. The other five are added by the owner in the Guests tab
(names and phones are not known to this session).

## 6. Owner notice (after prod deploy)

One MMS to `ADMIN_PHONE_NUMBER` from the Twilio number: Chappy's voice, swearing allowed (owner asked), a roast
about the tenth surgery on the 35-year-old fastball injury, a line for Kristy, and the links (event page,
admin event). Image: a parody of the order status page ("Order #10, Dano's Unit, Status: PREPPING, est. wait
35 years") rendered with Playwright from an HTML page using the site fonts and palette, saved as
`apps/web/public/chappy/tenth-time.png`, 1080x1350.

## 7. Testing

- API `node --test`: gate (attendee routes open with the flag off, booking routes 404), `composeGuestMessage`
  for every kind, admin RSVP CRUD validation, menu-steps shape and allowlist, `sendSMS` passes `mediaUrl`.
- Web vitest: parity, literal JSX, no-emoji, client-messages for the `events` route.
- Playwright (node script, iPhone 15 profile) against the dev stack: invite, rsvp, order, done, status (held),
  arrive (event-day simulated by setting the dev event's date to today), status progression via the admin
  kitchen endpoint. Screenshots at 390 saved to the scratchpad and reviewed. Admin: Guests, Messages and Cook
  tabs screenshot at 390 and 1440.
- Pre-push: `pnpm --filter @oh/web build` and `pnpm --filter @oh/admin build`, both lint and typecheck.

## 8. Release

1. Branch `private-events` in the main checkout (dev servers hot-reload). Commits stage explicit paths.
2. Prod SQL (additive, idempotent). 3. Merge to main, push (Railway and Vercel deploy). 4. Create the event and the
owner's guest row. 5. Smoke test on prod (event page renders, menu-steps, admin tabs). 6. Send the owner notice.

Rollback: revert the merge commit; the new columns are nullable and harmless.

## 9. Out of scope

Public booking pages, survey page, client dashboard, Chappy catering tools, kitchen display changes, menu changes.
