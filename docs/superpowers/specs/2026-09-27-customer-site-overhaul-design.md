# Oh! Beef Noodle Soup: Customer Website Overhaul (Design Spec)

Date: 2026-09-27. Status: approved by the owner 2026-09-27.
On plan-mode exit this spec is copied to `docs/superpowers/specs/2026-09-27-customer-site-overhaul-design.md` and committed.

## 1. Context

The business plan (`/plan`) is 99% done and now defines the concept precisely: 75 private pods in a comb
service layout, kiosk ordering, a hatch-delivered bowl in about seven minutes, no host, no server,
no check, no tip, a three-tier member program, and a 1% pledge to One Red Step. The customer
site at www.ohbeef.com predates most of that. It is built from about 4,000 inline style objects on a
light gray and olive palette. About 272 lines of UI use emoji, and badge icons are emoji stored in the
database. Translations leak English in all three non-English locales. The membership rules disagree
across the API, Chappy and the page copy, and the site promises perks that do not exist. Chappy
trusts client-sent user IDs, so it can charge someone else's saved card. Its order path bypasses
pricing and safety checks, and it has no support tools. The seat map is a 12-pod U-shape per
location and has nothing to do with the plan's layout.

**Goal:** one release that rebuilds the customer site so it is as rich as the business plan and
the new photography. It must be mobile-first and fully translated, with a standout membership
experience, a Chappy that really serves customers, and real comb-layout seating at both locations.

## 2. Owner rules (hard constraints)

0. **Mobile-first.** Nearly all users are on phones. The phone is priority 1 and desktop is priority 2.
1. **No standard emoji,** and no common AI icons, graphics or design tropes.
2. **Deeply rich and interactive,** at the level of Apple.com and award-winning sites.
3. **Translations intact everywhere.** No English appears when zh-TW, zh-CN or es is selected.
4. **Member benefits get the most love.** What you get, and how to reach the top rank.
5. **Chappy** answers questions, places orders from chat, and is the go-to for any issue.
6. **Floor plans match the business plan.** City Creek has 75 pods. University Place has 70 pods and is mirrored left to right.
7. **Reuse the `/fromDano/plan` imagery,** intelligently.
8. **No em dashes in user-facing copy** (owner feedback from earlier sessions).

## 3. Decisions log (owner answers, 2026-09-27)

| Topic | Decision |
|---|---|
| Structure | One spec, one release. Built in dependency order on a branch; dev only until the owner says ship. |
| Membership | The business plan's program is canonical, and its missing mechanics get built. |
| Thresholds | Noodle Master: 10 orders + 2 referrals. Beef Boss: 25 orders + 5 referrals after that. Progress resets on upgrade (existing behavior). |
| Early access | Staggered by tier. Beef Boss 8 days before the public, Noodle Master 4 days before, all members 1 day before. Offsets live in config. |
| Seating | Real bookable comb seats in the database, replacing the 12-pod U-shape. |
| Look | Night: the plan palette plus the new photography, with linen-light panels for food. |
| Menu | Keep the live database menu and prices. The redesign presents whatever the database says. |
| Founder page | None. The portrait stays in the plan only. |
| Bowl photos | Classic uses the brisket slices. Wagyu uses the rib chunks. The A5 photo is retired. |
| Motion approach | Native-first: CSS sticky, scroll-driven animations, framer-motion. No GSAP and no smooth-scroll hijacking. |
| Chappy authority | Goodwill **store credit only** on its own, capped at $5 per order, $10 per 30 days and $45 lifetime per customer (all configurable). Chappy never refunds money to a card. |
| Staff refunds | Admin can approve larger store credit, or a **full-order card refund. Never partial card refunds.** |
| Goodwill expiry | 90 days, the same as every other credit lot. |
| Escalation | In-pod PodCall, admin Support queue, SMS to the owner, and email to the owner. All four. |
| Guest ordering | Sign-in required to order. Guests can chat. |

## 4. Design system and shell

**Tokens** (Tailwind v4 `@theme`, extended from `/plan` to the whole site, plus CSS variables):

| Token | Hex |
|---|---|
| charcoal | `#1C1B19` |
| ink | `#2A2724` |
| stone | `#3A3632` |
| ash | `#8A8178` |
| cream | `#F2EDE4` |
| paper | `#FAF7F1` |
| linen (new, food panels) | about `#EDE6DA` |
| ember | `#C1502E` |
| ember-deep | existing value |
| olive | `#6B7355` |
| gold | `#C9A227` |
| clay | `#8C5A3C` |

- **Type:**
  - Display: Instrument Serif (`lib/plan/fonts.ts`, promoted to a site font module).
  - Body: Raleway.
  - Chinese: Noto Serif TC/SC for display and Noto Sans TC/SC for body. The TC or SC variant always follows the locale.
  - Fluid `clamp()` sizes, never below 16px on phones.
- **Global CSS:** the site's global element rules in `app/globals.css` (button, input, h1-h6, and `textarea:focus`) are retired so utilities behave. Tailwind stays unlayered with no preflight, exactly as `/plan` uses it today.
- **Icons:** an in-house SVG set in `components/site/icons/`: 24px grid, 1.5px stroke, brush-tapered terminals. No icon libraries.
- **Chop-seal badges:** `components/site/seal/Seal.tsx` renders a cinnabar seal (印章) from `{glyph, border, tone}`. `Badge.iconEmoji` is replaced by `Badge.iconKey`. The tier marks (`public/tiers/*.png`) stay, redrawn as SVG in cream and gold for the dark theme.
- **Shell (mobile):**
  - A slim top bar with the logo mark, locale switch and account.
  - A bottom dock with **Order** (ember), **Menu**, **Rewards** and **Chappy**, using safe-area insets.
  - Secondary links (Locations, Experience, Store, Gift cards, Contact) open in a `Sheet`.
  - Minimum 44px targets, and `svh` units throughout.
  - Desktop: the same items in a top nav, with no dock.
- **Motion kit** (`components/site/motion/`):
  - `Reveal`: CSS `animation-timeline: view()` with an IntersectionObserver fallback.
  - `PinnedStory`: sticky stage plus a `--progress` variable.
  - `FrameSequence`: canvas scrub.
  - `Sheet`: framer-motion drag-to-dismiss.
  - `SnapRail`: CSS scroll-snap.
  - `CountUp`.
  - `ParallaxLayer`.
  - React 19.2 `<ViewTransition>` route transitions (Next 16.1).
  - Every primitive honors `prefers-reduced-motion`.
- **Performance budget:**
  - LCP under 2.5 s on throttled 4G (mid-range phone profile).
  - Under 170 KB of gzipped JS per route.
  - `next/image` serving AVIF/WebP at 390/780/1200 widths.
  - three.js loaded only on explicit "See it in 3D".
- **Code shape:** new customer UI is built from `components/site/*` primitives with Tailwind classes. The inline-style pages are replaced, not patched. Data, Stripe and Clerk logic are kept and moved into hooks or server components where that helps.

## 5. Pages and content

Copy uses the plan voice: quiet, precise, confident, short declarative sentences, no em dashes.
Reusable lines come from the `plan.*` messages (for example "You walk in and nobody greets you.
That is the design.").

- **Home (`/`),** an eight-chapter mobile scroll story:
  1. **Arrive.** Storefront `Image 4`, and the 峨 mark revealed by a brush mask. "The only restaurant built around you." Order CTA plus live open status and pods free.
  2. **Walk in.** Pinned; the hall (`Image 1.jpeg`, then `Image.jpeg`), with rows lighting in sequence.
  3. **The pod.** Pinned crossfade of `Image 6`, `Image 5` and `Image 2`, with an animated hatch panel.
  4. **The bowl.** Linen panel; top-down `Image 9.jpeg` rotating on scroll, ingredient callouts, ending on the `Image 12` macro.
  5. **No check, no tip.** Typographic chapter.
  6. **Rewards teaser.** Tier marks rising, linking to `/rewards`.
  7. **One Red Step.** Giving pledge with a red thread line.
  8. **Two locations.** Live cards, linking to the location pages.
- **Experience (`/experience`, new):** the plan's six steps (arrive, order, walk, settle, taste, leave) as swipeable full-screen steps. A journey animation runs on the real comb map: the guest dot goes kiosk to pod, and the bowl goes along the staff corridor. It doubles as the how-it-works FAQ.
- **Menu (`/menu`):** the live database menu on linen panels, with a detail `Sheet` per item and an order CTA from any item. The dietary and spice indicators use custom icons, never emoji.
- **Order flow (`/order/*`):** one-handed step sheets (location, bowl builder, arrival, pod, pay). The APIs are unchanged apart from the shared order service (section 8) and reward redemption. Stripe Payment Element and Express Checkout get the page's locale. The "save this card" option is wired up with `setup_future_usage`. The Stripe `returnUrl` gets its missing locale prefix.
- **Status, confirmation, check-in and pod (`/order/status`, etc.):** restyled. The status icons become custom SVG. Roast and fortune text move into messages.
- **Locations (`/locations`, `/locations/city-creek`, `/locations/university-place`):** hero photo, live comb map (section 7), hours, parking, directions, landmarks, and a lazy 3D view. The "Coming Soon" list comes from messages.
- **Rewards (`/rewards`)** and **member passport (`/member`):** see section 6. `/loyalty` redirects to `/rewards` with a 308.
- **Store and gift cards:**
  - The store hero is `Image 7 (1)`. The bowl product uses `Image 3 (1)`; the chopsticks use `Image 6 (1)`.
  - `Image 7.jpeg` is the gift-card visual and replaces the missing `/store/placeholder.png`.
  - Gift-card purchase and balance pages are fully translated.
- **Contact, privacy, accessibility, SMS consent:** restyled and translated. The contact form posts to the new `POST /support/cases` endpoint (section 8), so messages reach the same Support queue.
- **Removed:**
  - The public `/tenants` debug page.
  - Dead legacy files: `menu-builder.tsx`, and the `.backup` and `.broken` files.
  - `SeatingMap.tsx`.
  - `agent-v2.js`.
  - The `.DS_Store` and `._*` junk in `public/`.

**Imagery pipeline:**
- `fromDano/plan` sources are converted with `sharp` into `apps/web/public/site/`, named by content (`storefront-dusk`, `hall-rows`, `pod-hatch-a/b/c`, `bowl-slices-top`, `bowl-slices-side`, `bowl-chunks-top`, `bowl-chunks-side`, `beef-macro`, `store-interior`, `bowl-empty`, `bowl-flatlay`, `chopsticks`, `sign-pool`).
- `Image 1.jpg` / `Image 1 2.jpg` (sign over the reflecting pool) is the Locations hero.
- Menu images map `Classic Bowl` to the slices and the Wagyu bowl to the chunks, via `lib/menu-images.ts`.
- **Never published:**
  - `IMG_5749.jpeg` (vendor proof with contact details)
  - `Dano_Signature.heic`
  - `KitchenScreen.png`
  - The blueprint JPGs
  - `Dano.JPG`
- `Chappy.png` stays as Chappy's avatar.
- Gitignore trap: `*.png` is ignored outside `apps/web/public/**`, so the outputs are webp or avif anyway.

## 6. Membership

**Rules engine.** `packages/api/src/membership/program.js` is the only source of tier rules:

| Rule | Chopstick | Noodle Master | Beef Boss |
|---|---|---|---|
| Cashback | 1% | 2% | 3% |
| To reach | (entry) | 10 orders + 2 referrals | 25 more orders + 5 more referrals |
| Upgrade reward | n/a | free bowl | free bowl |
| Quarterly perk | none | none | one premium add-on |
| Early access (before public) | 1 day | 4 days | 8 days |
| Queue priority | none | +25 (kept) | +50 (kept) |

- **Referrals:** $5 to the referrer and $5 to the new member, at most 10 paid per rolling 30 days. Credits expire after 90 days.
- **Endpoint:** `GET /membership/program` returns the rules as data, with localization keys but no copy. The site, Chappy, wallet passes and the simulator all consume it.
- **Replaced:** `getTierBenefits` / `getNextTier` / `checkTierUpgrade` in `packages/api/src/index.js:6796-6900`, Chappy's hard-coded 10 and 50 (`chappy/tools.js:2106-2150`, `formatters/web.js:184`), and `loyalty/page.tsx:100-138`.

**New mechanics:**
- **`CreditLot`:**
  - Fields: `userId`, `source` (cashback, referral, welcome, goodwill, admin), `amountCents`, `remainingCents`, `expiresAt`, `createdAt`.
  - Spending takes the soonest-expiring credit first.
  - `User.creditsCents` stays as the cached balance, updated in the same transaction.
  - A nightly job expires lots and writes an `EXPIRED` `CreditEvent`.
  - Members are warned 7 days ahead, in-app and in their language.
- **Referrals:**
  - Instant: $5 to the referrer when the friend's first order completes, and a $5 welcome lot applied to the friend's first order.
  - The 10-per-30-days cap is enforced.
  - The 1st/16th `PendingCredit` batch (`/cron/disburse-credits`, `index.js:5973`) is retired; existing pending rows pay out at cutover.
- **`Reward`:**
  - Types `FREE_BOWL` and `PREMIUM_ADDON`, with `windowEndsAt`, `redeemedOrderId` and `issuedFor`.
  - A free bowl is issued on each upgrade, and the quarterly add-on for Beef Boss by a quarterly job.
  - Redeemable in the order builder and through Chappy, priced at $0 through the shared order service.
- **Early access:**
  - `MenuItem.releaseAt` is the public date. Beef Boss sees the item from `releaseAt - 8d`, Noodle Master from `releaseAt - 4d`, and Chopstick members from `releaseAt - 1d` (offsets in `program.js`).
  - Menu endpoints filter by the caller's tier.
  - A null `releaseAt` means the item is released to everyone.
- **Translation:** `Badge` and `Challenge` gain `i18n Json` (`{locale: {name, description}}`) and `iconKey`. The seed is rewritten with all 4 locales and no emoji.

**`/rewards` page:**
1. The climb: a vertical path of tier marks, filled with gold as you scroll.
2. Tier cards in a `SnapRail`: tap to flip for perks. Beef Boss gets a gold-foil sheen driven by scroll.
3. **Path to Beef Boss simulator:** sliders for bowls a month and friends you bring. It draws a timeline of tier dates, free bowls and cashback earned, from the live program rules.
4. How credits work: a lot timeline showing earn, spend and expire.
5. Referrals, with `navigator.share`.
6. Seal gallery: tap for how to earn.
7. Challenges, FAQ, and Ask Chappy.

**`/member` passport:**
- The tier mark, and two progress arcs (orders and referrals).
- Next-reward preview.
- A rewards wallet with countdowns.
- Credits with an expiring-soon alert.
- The seal collection, with a stamp-press animation on new seals.
- Streak, plus Apple and Google Wallet (existing).
- Orders and credits subpages restyled and translated.

**Moments:**
- **Welcome sheet** on first sign-in (4 screens: tier, climb, welcome credit, Wallet).
- **Tier-up** full-screen seal stamp with the free-bowl reveal, plus `navigator.vibrate` where supported.
- These are triggered from `GET /users/:id/profile` flags (`welcomeSeenAt`, `lastTierCelebrated`).

## 7. Floor plans and seating

- **Shared geometry:**
  - `apps/web/components/plan/modules/floor-plan/layout.ts` moves into `packages/floor-plan` (pure TypeScript, no React) as `buildLayout({ pods, mirror })`. It returns rects, rows, pods, areas, journeys and markers.
  - The plan imports it with `{ pods: 75, mirror: false }`.
  - A snapshot test proves the plan's output is identical to today's.
  - `lib/plan/__tests__/floor-plan-layout.test.ts` is extended to cover the mirrored and 70-pod variants (paths never intersect, areas sum to 3,500).
- **Mirror:**
  - Data-level: `x' = 70 - x - w`; west and east swap for rows, hatches, `facing` and journeys. Labels are never flipped.
  - Consumers that branch on west/east move to the returned `side` fields: `FloorPlanSvg.tsx:348,381,392,465-476`, `three/Pods.tsx:25,33`, `three/Walls.tsx:41`, `useIsoCamera.ts:29`.
- **70 pods:**
  - The front pod (nearest the cross-aisle) is removed from 5 of the 6 rows, giving 12/11/12/11/12/12.
  - All 5 duo pairs are kept. The duo definitions move from fixed rows to "one per finger side" rules so they survive the mirror.
- **Database:**
  - `Location` gains `layoutKey`, `layoutMirror` and `podCount`.
  - `Seat` gains `finger`, `rowSide`, `position`, `label` (for example `B-07`) and `retiredAt`.
  - The legacy `side/row/col` fields become nullable.
  - `LocationStats.totalSeats` follows `podCount`.
  - `packages/db/scripts/seed-comb-seats.ts` is idempotent and creates 75 seats for City Creek and 70 mirrored seats for University Place, with QR codes. Old seats get `retiredAt` and are never deleted, because orders reference them.
  - Seat endpoints (`GET /locations/:id/seats`, `index.js:1517`, and `/availability`, `:665`) exclude retired seats and return the layout key.
- **`CombMap` component** (`components/site/floor-plan/CombMap.tsx`):
  - SVG from the geometry, rotated to fit portrait phones.
  - Modes: `pick`, `live` and `journey`.
  - **Default:** a one-tap "Best pod for you": the nearest free pod to the entry at your arrival time, and a duo when your party is 2 (server-side in the shared order service).
  - **"Choose my own":** tap a row to zoom smoothly to 44px+ pods, then tap a pod. Pinch-zoom works throughout.
  - Status uses color and pattern: available, reserved, occupied, cleaning.
  - Used by the order builder (`enhanced-menu-builder.tsx:1212`), the group lobby (`group-lobby.tsx:1382`), the kiosk, the location pages and the Chappy pod card. The admin seat views get the new labels.
  - The optional 3D view reuses `plan/modules/floor-plan/three/*` with the location's layout.

## 8. Chappy Chopstix

**Foundation:**
- **Identity:**
  - The web widget sends the Clerk session token. The API verifies it with the pattern in `packages/api/src/auth/admin.js` and derives `userId` on the server.
  - Guests get a signed guest token (HMAC, httpOnly) for continuity, plus read-only tools.
  - `/chappy/history` and `/chappy/reset` require the same identity.
  - `GET /users/by-email/:email` is restricted to the verified user themselves (it's used by `ChappyChatWrapper.tsx:41`).
- **Transport:** `POST /chappy/chat` streaming SSE over fetch, replacing GET with the message in the query string. The `Access-Control-Allow-Origin: *` on the stream (`index.js:14622`) is removed.
- **Limits:** a per-identity rate limit, a 1,500-character message cap, and a daily token budget per identity.
- **Shared order service** (`packages/api/src/orders/service.js`):
  - `quoteOrder`, `createOrder`, `markPaid`, `pickBestPod` and `redeemReward`.
  - Extracted from `POST /orders` (`index.js:3529`) and `PATCH /orders/:id` (`:4269`).
  - Enforces the dine-in flag, operating hours (`utils/operating-hours.js`), included-quantity pricing, tax, seat reservation, notifications, streak and tier, credit lots and rewards.
  - The web routes and Chappy both call it.
  - **Payment integrity (found during planning).** Today the browser marks orders PAID (`PATCH /orders/:id`, called from `payment-form.tsx`, `confirmation/page.tsx`, `group-payment-form.tsx`, `status/page.tsx` and the kiosk), and `/create-payment-intent` trusts a client `amountCents`. New rules:
    - The PaymentIntent amount always comes from `quoteOrder`, with `metadata.orderId` set.
    - `markPaid` runs only after the server retrieves the PaymentIntent and checks `status === "succeeded"`, the amount and `metadata.orderId`. The one other path is a zero balance the server has verified (credits, gift card or reward).
    - `markPaid` is idempotent (webhook plus return page).
    - Clients call `POST /orders/:id/confirm-payment {paymentIntentId}` instead of PATCHing `paymentStatus`. `PATCH /orders/:id` no longer accepts `paymentStatus`, `totalCents` or promo fields.
    - The kiosk, webhook and group flows move to the new call.
- **Model:**
  - `claude-opus-5` with `thinking: {type: "adaptive"}` and `output_config.effort: "medium"`.
  - Server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); check `stop_reason` before reading content.
  - Streaming, with `eager_input_streaming` plus validation on client tools and `strict: true` schemas.
  - At most 6 tool rounds per turn.
  - Prompt caching: a deterministic tool list and a frozen system prompt (persona, rules, FAQ from `/experience` content, program rules) with a cache breakpoint. Per-user context goes after it.
  - Keep the existing 30-minute conversation window, but fix history trimming so it never starts on an assistant turn.
  - Adapt the plan-Chappy prompt and caching structure (`lib/plan/chappy/prompt.ts`).

**Tools** (every one has a handler; strict schemas):

| Access | Tools |
|---|---|
| Public | `search_menu`, `get_menu_item`, `get_locations`, `get_membership_program` |
| Member | `get_my_profile`, `get_my_orders`, `get_order_status` (own orders only), `get_usual_order`, `reorder` |
| Ordering | `cart` (add / remove / modify / clear, server-held per conversation, priced by `quoteOrder`), `set_arrival_and_pod` (real slots, best pod or a label, duo), `apply_savings` (credits, promo, reward), `checkout`, `start_group_order` |
| Support | `report_issue`, `request_refund`, `escalate_to_human` |

**Money safety:**
- `checkout` returns a pay card, and payment only happens when the human taps it. The card offers Apple Pay, Google Pay, card, or a saved card.
- `create_and_pay_order` (which charged cards directly) is deleted.
- The confirm-payment credit-deduction bug (`index.js:14823-14831`) is fixed by moving to `markPaid`.

**Support flow (`report_issue`):**
- **Guest is in a pod now:** a `PodCall` (`POST /orders/:id/call-staff`, `index.js:2820`).
- **Order issue:** a `SupportCase` (new model: `userId`, `orderId`, `type`, `status`, `transcript`, `resolution`, `amountCents`).
- **Goodwill credit:**
  - Store credit only: a `CreditLot` with `source: goodwill` and a 90-day expiry, spendable only on future orders. It never touches the card.
  - Automatic for a verified issue on the customer's own order within 24 hours.
  - Capped at $5 per order, $10 per 30 days and $45 lifetime, all in `program.js` config. Beyond a cap, the case goes to staff.
- **`request_refund`:** creates a pending case. Staff resolve it in the admin **Support** tab (new `apps/admin/app/support`) with one of three actions:
  1. Approve store credit of any amount, which bypasses the caps and is logged with the staff member's name.
  2. Refund the **entire** order to the card: a full Stripe refund of the PaymentIntent. Credits and gift cards used on that order are restored as credit.
  3. Decline, with a reason.
  - No API endpoint, admin control or Chappy tool accepts a partial card refund amount. A test enforces this.
- **Urgent or high-value cases:** SMS to `ADMIN_PHONE_NUMBER` (`notifications.js:60`).
- **Every case:** email via `email/graph.js` `sendGraphMail`.

**Voice:**
- Existing persona (`chappy/prompts.js`) for normal chat. "Issue mode" is calm, brief and fast.
- No emoji. Reply in the page locale, which is sent with each message.

**Widget:**
- Rewritten as `components/site/chappy/`, replacing the 1,959-line `ChappyChat.tsx`.
- Phone: a full-screen `Sheet` from the dock, keyboard-aware via `visualViewport`, with 16px input text.
- Desktop: a side panel.
- Native cards: menu item, cart, pod picker (`CombMap` mini), pay, order tracker, reward, sign-in, support case.
- Fully translated (new `chappyWeb.*` namespace).
- The history-refetch bug (`ChappyChat.tsx:131,203`) is fixed.

**SMS:** the same agent. Web-only cards degrade to real links (`/order/payment?...`).

## 9. Translations

- **Locales:** en, zh-TW, zh-CN and es. Fill the 94 missing keys and move every hard-coded customer string into messages. That covers the pages listed in the exploration: `pod`, `member/credits`, `gift-cards/*`, `store/*`, `group/*`, `order/group-payment`, `sms-consent`, the CNY pages (translated, not redesigned), and the Chappy widget. It also covers error and toast text, `aria-label` and `alt`.
- **Fallbacks:** configure `getMessageFallback` and `onError` in `i18n/request.ts` so a missing key logs in dev and fails the tests. The `SeatingMap` English label fallbacks are gone.
- **Database content:**
  - `Badge` and `Challenge` get `i18n`.
  - Slider labels (`seed-prod.ts:180-187`) get `labelsI18n`.
  - `Location` gets `i18n` for name, address and landmarks.
  - Menu names already exist per locale.
- **Notifications:** `User.locale` is saved from the site. Order confirmation, tier-up and credit-expiry messages are localized.
- **Who translates:** Claude drafts zh-TW, zh-CN and es. Native proofreading of the Chinese is recommended before launch, and new keys are listed in `docs/i18n-review-2026-09.md`.
- **Guards that fail the tests:**
  - Locale key parity.
  - ESLint no-literal-JSX-text on `app/[locale]/**` (excluding `plan`, `kiosk` and `agents`), `components/site/**` and `components/*.tsx`.
  - A Playwright English-leak crawl of every route in zh-TW and zh-CN, with an allowlist (brand names, Wagyu, units).
  - A no-emoji scan across web and API source, messages and seeds.

## 10. Testing and quality bar

- **vitest (web):**
  - `packages/floor-plan` (plan snapshot, mirror, 70-pod, no-overlap, journeys).
  - Simulator math.
  - Locale parity, no-emoji and literal-text guards.
- **node:test (API):**
  - Membership engine (thresholds, resets, rewards, early access).
  - Credit lots (earn, spend order, expiry, cutover conversion).
  - Referral caps.
  - Goodwill caps (per order, 30 days, lifetime).
  - Order service (pricing parity with today's `POST /orders` for identical input, flag, hours, reservations).
  - Chappy tool handlers.
  - Chappy identity: forged `userId` is rejected; one user can't read or charge another.
  - Refunds: no route accepts a partial card refund, and goodwill grants create only credit lots.
  - Run against the local dev Postgres test schema.
- **Playwright (`tests/e2e/`):**
  - iPhone 15 and Pixel 8 profiles.
  - Flows: home story, menu, web order with best pod and choose-my-own, Chappy order through the pay card (Stripe test mode), rewards simulator, member passport, welcome sheet, report issue leading to a support case, all 4 locales.
  - A smaller desktop pass at 1440.
  - Screenshots reviewed at 390 and 1440.
- **Targets:**
  - Lighthouse mobile of 85+ on every customer route.
  - LCP under 2.5 s on 4G.
  - Zero axe violations.
  - Reduced-motion pass on every page.
- **Dev notes:** browser tests use a node script with the repo's `playwright` (the Playwright MCP can't launch here) and `--no-sandbox`. The web dev server needs `NODE_OPTIONS=--max-old-space-size=4096`.

## 11. Release

- **Branch:** `site-overhaul`, in an isolated worktree. Commits stage explicit paths (another session may share the checkout). Dev only until the owner says ship.
- **Cutover checklist:**
  1. Apply the additive Prisma migrations to Railway Postgres with psql (prod has no `_prisma_migrations`).
  2. Run `seed-comb-seats` and retire the old seats.
  3. Pay out pending referral credits, and convert current credit balances into `CreditLot`s with a 90-day expiry starting at cutover.
  4. Seed the rewritten badges and challenges, mapped to their existing ids.
  5. Generate and print the new pod QR codes (admin).
  6. Set the new environment variables: guest-token secret, Chappy limits.
  7. Deploy Railway, then Vercel. Run the prod smoke test.
- **Rollback:** promote the previous Vercel deployment and redeploy the previous Railway build. The migrations are additive, and the old seats are retired rather than deleted, so a rollback only needs `retiredAt` cleared.

## 12. Out of scope

- Menu, price and item changes.
- Business plan content (it only gets the geometry refactor).
- The kiosk redesign (the kiosk only gets the new map and labels).
- Admin UI beyond the Support tab and seat labels.
- The catering customer surfaces (they stay removed).
- The `requireAdminAuth` "any Bearer" gap: verified fixed on 2026-09-25 (`packages/api/src/auth/admin.js`). The unauthenticated `PATCH/DELETE /locations/:id` routes get admin auth in Task A8, because they touch seats.

## Execution method
The owner chose **subagent-driven** (superpowers:subagent-driven-development). A fresh implementer and a fresh reviewer run per task, followed by a whole-branch review.

## Post-plan-mode todo
- Save memory: mobile-first is the top rule for the customer site (feedback).
- Copy this spec into `docs/superpowers/specs/` and commit (explicit path).

---
