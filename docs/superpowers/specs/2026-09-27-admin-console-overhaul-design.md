# Part A: Design Spec

## A1. Context

The admin console (`apps/admin`, https://admin-oh-beef-noodle-soup.vercel.app) has grown to 13 flat top-bar links (`components/AdminNav.tsx:12-26`). The row doesn't wrap, three links carry a blue "highlight" that makes them look like buttons, and nothing is grouped.

**Current state:**
- Every page is built with inline `style={{}}`. There is no Tailwind, no shared UI kit and no responsive CSS.
- The pages have no media queries, and tables and 400px-minimum grids overflow on phones.
- Kitchen and Cleaning render inside the nav and a padded `<main>`.
- Access is a two-email allowlist in `middleware.ts`, with no roles.

**Who uses it:** the owner, and store managers from now on. Both mostly use phones. Kitchen and Cleaning run on mounted tablets.

**Goal:** a mobile-first console that looks like an extension of the customer site's new "Night" design and makes the frequent jobs one tap away:
- today's pulse
- menu sold-out switches
- order lookup and support
- switches and promos

Every existing function is kept.

**Security finding (discovered during design):** the Fastify API guards only `/admin/*` (`packages/api/src/index.js:169`).
- In production, anyone can read `/analytics/*` (including revenue).
- Anyone can create, edit or delete menu items, promo codes, tenants and locations, change seats, and dismiss pod calls.
- Fixing this ships first, as a standalone hotfix (Part B, Phase 0).

## A2. Owner decisions (do not reopen)

| Topic | Decision |
|---|---|
| Users | Owner and managers, both on phones. Kitchen and Cleaning tablets use a limited account. |
| Look | **Night frame, paper work.** Charcoal top bar, dock, sidebar and sheet headers; paper and cream work surfaces. |
| Navigation | **Phone:** a bottom dock (Today · Orders · Menu · More) with a grouped More sheet. **1024px and up:** the same groups as a left sidebar. |
| Phone jobs | Today's pulse, menu sold-out switches, order lookup and help, switches and promos. |
| Roles | `owner`, `manager` and `station`. |
| Owner-only | Plan access and NDAs; money analytics (revenue, customers, funnel); setup and team (locations, tenants, kiosks, gift card setup, Team); card refunds. |
| Rollout | Phase 0 security hotfix ships alone and first. The overhaul then ships as **one release**. |
| Kitchen and Cleaning | Full-screen displays with no console chrome and a small exit button. Internal layouts unchanged. |

## A3. Information architecture

**Route groups.** URLs stay the same.
- `app/(console)/…`: every console page, wrapped in the shell.
- `app/(display)/kitchen` and `app/(display)/cleaning`: a bare full-screen layout.
- `app/cleaning/config` (Seats) moves to `app/(console)/cleaning/config`, so its URL is unchanged.

**Dock** (under 1024px): **Today** `/` · **Orders** `/orders` · **Menu** `/menu` · **More** (opens a sheet).

**The More sheet and the sidebar share one list of groups.** Only items the current role can open are shown.

| Group | Items (href) | Roles |
|---|---|---|
| Sell | Promos `/promos`, Gift cards `/gift-cards`, Shop products `/products`, Catering `/catering` | owner, manager |
| Stores | Kitchen display `/kitchen`, Cleaning display `/cleaning` (owner, manager, station); Seats `/cleaning/config` (owner, manager); Order Now switch (inline toggle row, owner, manager) | as listed |
| Insights | Analytics `/analytics` (the hub; subpages are gated individually) | owner, manager |
| Owner | Plan access `/plan-access`, Locations `/locations` (tenants shown as a section on this page), Kiosks `/kiosks`, Gift card setup `/gift-cards/config`, Team `/team` | owner |

**Analytics gating:**
- **Manager:** operations, menu, traffic, upselling, languages, badges, challenges.
- **Owner only:** the revenue, customers and funnel reports, and the revenue tiles on the analytics hub.

**The station role:**
- It sees only Kitchen and Cleaning.
- Signing in as station lands on `/kitchen`.
- Any other path redirects to `/kitchen`.

**Top bar (charcoal):**
- The Oh! mark and the page title (Instrument Serif).
- A **location switcher** with All, SoHo, City Creek and University Place. It is stored in `localStorage` key `oh-admin-location`, and pages that filter by location read it through `useLocation()`.
- The Clerk account button.

**Pages:**
- **Today `/`:**
  - Pulse tiles: orders today, active diners and open pod calls. Sales today is shown to the owner only.
  - The Order Now switch.
  - The "Needs attention" list: open pod calls, shop orders to ship, support cases once the Support page exists, NDAs waiting for countersignature (owner), and catering events in the next 7 days. Each row links to its place.
  - Quick actions: "Mark item sold out" (to `/menu?focus=search`), "New promo" (to `/promos?new=1`) and "Find gift card" (to `/gift-cards?focus=search`).
- **Orders `/orders`:** a segmented control with Dine-in · Shop · Support.
  - **Dine-in (new):** search by name, phone or order number, plus today's list with live status. Tap an order for `/orders/[id]`, which shows its read-only timeline: items, pod, status and payment.
  - **Shop:** the existing `/shop-orders` list, which stays at its URL; the segment links there.
  - **Support:** shown only once `apps/admin/app/(console)/support` exists (it comes from the site-overhaul branch).
- **Menu `/menu`:**
  - Items are grouped by category, and each row has a sold-out switch (`isAvailable`). Toggling it is optimistic, with a 5-second undo toast.
  - Tapping a row opens an edit sheet (all current fields).
  - A "New item" button opens a create sheet.
- **Team `/team` (new, owner only):**
  - Lists users with an `adminRole`.
  - Invites by email with a role, changes roles, and removes access.

**Installable:** `app/manifest.ts` plus icons, so "Add to Home Screen" opens `/` standalone with a charcoal theme color.

## A4. Visual system

**Tokens.** The names and values are the same as the web app (`apps/web/app/globals.css:17-35`), copied into `apps/admin/app/globals.css`:
- **Neutrals:** charcoal `#1C1B19`, ink `#2A2724`, stone `#3A3632`, ash `#8A8178`, mute `#9A9188`.
- **Light surfaces:** cream `#F2EDE4`, paper `#FAF7F1`, linen `#EDE6DA`.
- **Ember:** ember `#C1502E`, ember-light `#E07A5A`, ember-deep `#A94422`.
- **Olive:** olive `#6B7355`, olive-light `#8F9A75`.
- **Accents:** gold `#C9A227`, clay `#8C5A3C`.

**What each color means:**
- **Ember-deep** fills the one primary action per screen, with cream text.
- **Ember** is for alerts and destructive actions.
- **Gold** is for pending states and highlights.
- **Olive** is for "on", "good" and "paid".
- Status is never shown by color alone: every badge has a word, and a dot or icon.

**Type:**
- Titles and big numbers use Instrument Serif (next/font, `--font-display`).
- Body text uses Raleway (next/font, `--font-body`).
- Inputs are 16px or larger.
- Numbers use `tabular-nums`.

**Surfaces:**
- The shell (top bar, dock, sidebar, sheet headers) is charcoal with cream text.
- The page background is paper.
- Cards are cream with a `1px` border of `stone/15`, and radius 14.
- Linen is for nested panels.

**Icons:** an in-house SVG set in `components/ui/icons.tsx` on a 24px grid with 1.5px strokes. No emoji and no icon libraries.

**Tailwind v4:** unlayered utilities with no preflight, mirroring `apps/web/app/globals.css:1-14`. Kitchen and Cleaning keep their inline styles and render pixel-identical.

**Motion:**
- CSS transitions of 150–250ms.
- The Sheet is a CSS transform with pointer-drag to dismiss on phone.
- Everything honors `prefers-reduced-motion`.
- No animation library.

**Copy:** no em dashes, and the plan voice (short and calm). No `window.alert`, `confirm` or `prompt`; use Toast and ConfirmSheet.

## A5. Page patterns

Every console page uses one of these four patterns.

1. **List → detail** (shop orders, gift cards, promos, products, catering events, plan codes, locations, kiosks, team, dine-in orders):
   - **Phone:** a sticky SearchField and filter chips, then `ListRow` cards.
   - **1024px and up:** the same data in `DataTable`.
   - The detail page has a sticky `ActionBar`.
2. **Create and edit:** a `Sheet`.
   - On phone it is full height, with a sticky Save bar that sits above the keyboard.
   - At 1024px and up it is a 480px right panel.
   - It replaces the create forms at the top of Menu, Products, Locations and Tenants, and every hand-rolled modal (PromoFormModal, EventFormModal, IssueCodeModal).
3. **Dashboard** (Today, the Analytics hub and subpages, the catering overview):
   - `StatTile`s two across on phone and four across at 1024px and up.
   - `SegmentedControl` for the period.
   - Charts sit in a `Card`, and any horizontal overflow scrolls inside the card only.
4. **Tabbed detail** (catering event, plan code): a sticky, horizontally scrollable `SegmentedControl`.

**Feedback:**
- Reversible toggles are optimistic, with an undo Toast.
- Destructive and money actions use a `ConfirmSheet`.
- Loading shows a `Skeleton`, and an empty list shows an `EmptyState` with a next step.
- Errors show as an inline error card with Retry. A failed optimistic toggle reverts and shows an error Toast.

## A6. Roles and security

**Role source:** Clerk `publicMetadata.adminRole` ∈ `owner | manager | station`.
- An email on `ADMIN_EMAILS` (API) or `OWNER_EMAILS` (admin app; the default is the same two addresses) is always `owner`.

**Admin app:**
- `lib/access.ts` is the single map from route prefix to allowed roles. The nav, page guards and middleware all read it.
- Middleware denies unknown users (redirects to `/unauthorized`), redirects station users to `/kitchen`, and blocks disallowed routes.

**API:**
- `createAdminAuth` resolves `{ ok, role, email }`. `requireAdminAuth` accepts any role and sets `req.adminRole`.
- `requireRole(...roles)` is a preHandler used on owner-only routes and on manager routes that station must not reach.
- The server-to-server `x-admin-api-key` counts as `owner`.
- The dev bypass (non-production with no `ADMIN_API_KEY`) counts as `owner`.

**Phase 0 hotfix:**
- Every console-only route outside `/admin` gets `requireAdminAuth`.
- Customer, device and webhook routes stay open.
- Admin server components forward the Clerk session token.

**Owner-only API:**
- `/admin/plan/*`, `/admin/gift-card-config*`, `/admin/team*`
- `/analytics/revenue`, `/analytics/customers`, `/analytics/ga4/funnel`
- Tenant and location writes, kiosk writes, and card refunds (when Support lands)
- The `salesCents` field of `/admin/today`

**Station API:** only the endpoints Kitchen and Cleaning call (the list comes from the Phase 0 inventory).

## A7. Coordination with the site overhaul

- The overhaul is running on branch `site-overhaul` (worktree `.claude/worktrees/site-overhaul`). It adds `apps/admin/app/support` and seat labels, and its Task A8 guards `PATCH` and `DELETE` on `/locations/:id`.
- This work runs on branch `admin-overhaul` in worktree `.claude/worktrees/admin-overhaul`, from `main`.
- **Merge rule:** whichever branch merges second rebases.
  - If `site-overhaul` merges first, Task 21 restyles its Support page with the new primitives and moves it into `(console)`.
  - If this branch merges first, the Support page gets the primitives when it is built.
- The Orders → Support segment shows up only if the route exists (a `hasSupport` constant in `lib/nav.ts`, set by whichever branch lands second).
- Phase 0 overlaps Task A8 on `/locations/:id`. Both add the same guard, so the conflict is trivial; keep one.

## A8. Out of scope

- Redesigning the internal layouts of Kitchen and Cleaning.
- A shared `packages/ui` package. Tokens are copied, with a comment pointing at the web source.
- New analytics metrics.
- Partial refunds (never).
- Anything else in the customer site.

## A9. Success criteria

1. **Every page works at 390px:**
   - The page never scrolls horizontally.
   - Every tap target is at least 44px.
   - Every function from the old page still works (checked against the per-page inventory in Part B).
2. **Phone jobs are quick:**
   - Marking an item sold out takes at most 3 taps from Today.
   - Finding an order takes at most 2 taps plus typing.
3. **Access is enforced:**
   - A manager can't see or call owner-only areas (UI hidden and API 403).
   - Station reaches only Kitchen and Cleaning.
4. **Kitchen and Cleaning** screenshots match the old ones apart from the removed chrome.
5. **Phase 0:** no unguarded console-only route is left in production, and the customer order flow still works.

---
