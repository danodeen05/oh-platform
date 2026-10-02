# Oh! Mobile App: Design Spec (market case, technology decision, phased build)

Approved by the owner 2026-10-02 (Mountain Time) via the plan review. This spec is the validated design;
Phase 0 has its own implementation plan in `docs/superpowers/plans/`. Phase 1 gets a plan after the owner
makes the gate decision described in Part D. Research sources are summarized inline; the three research
memos (market, technology, features) were produced 2026-10-02 and their key citations are retained here.

## Context

The owner asked for a McKinsey-grade, no-flattery assessment of whether Oh! should build a native
mobile app (iOS first, then Android, possibly another platform), which technology to use, and, if
the numbers hold, what the app should contain (ordering, Chappy, membership status and ranking,
push, geofenced wallet moments, a small skill game). The app would also be the mobile face of the
"Oh! OS" platform the owner intends to sell to other operators. Investors ("interested parties") are
the audience for the business case.

Hard constraints the owner set: data over opinion, no catering to the owner's priors (including
"iOS first"), best-in-industry UX and performance, no budget cap, absolute security.

## Facts established from the repo and production (2026-10-02)

These are verified, not assumed.

1. **Oh! is pre-opening.** Production DB: 1 user, 6 orders (3 abandoned web, 2 event, 1 completed
   test), 0 Apple Wallet pass registrations, 1 SMS opt-in. There is no Oh! customer, device, or
   retention data. Every "number" must therefore come from external evidence plus the plan model.
2. **The plan model is the only internal quantitative base.** `packages/plan-model` (MODEL_VERSION
   2026.09.27): 75 pods, 313 operating days, base 330 covers/day (break-even 313), $23.18 check,
   $3.26M unit revenue, 13.5% unit EBITDA against a 15% public target; marketing 3% of revenue,
   tech platform 1.8%, member program 1.4% + $30K swag; corporate units Lehi T0, SLC +16mo,
   South Jordan +19, Provo +22, St. George +25; Oh! OS license modeled at $1,800/location/month at
   80% GM; platform build $600K in round 1; Oh! OS engineers 1 to 4 over the plan.
3. **An Expo/React Native app already exists** at `apps/mobile` (Expo SDK 54, RN 0.81, expo-router,
   `@clerk/clerk-expo`, react-query, SecureStore). One commit. Read-only member shell: tabs
   index/order/activity/profile plus credits, challenges, badges. No ordering, no Stripe, no push,
   no location, no wallet, no tests, no EAS config, legacy palette, hand-duplicated types. ~5.3k lines.
4. **Backend is ready for a native client with few changes.** Fastify API (`packages/api`, plain JS,
   12k-line `src/index.js` plus modules), Prisma/Postgres (`packages/db`), Clerk JWT auth mapped
   by email (`src/auth/customer.js`), Stripe PaymentIntents with automatic payment methods
   (`src/orders/purchase-intents.js`), server-held Chappy cart with full ordering tools
   (`src/chappy/tools.js`), SSE chat (`POST /chappy/chat`), `OrderSource.MOBILE` enum exists
   but unused. No OpenAPI, no generated client, no shared types package.
5. **Wallet is real Apple Wallet.** `src/wallet/wallet-pass.js` builds `.pkpass` loyalty cards with
   lock-screen `locations` (radius default 100 m) carrying availablePods and avgWaitMinutes;
   `wallet-web-service.js` + `apns-service.js` push pass updates on order complete, tier progress,
   credit balance. Google Wallet link is a stub. `wallet-cron.js` runs streak/challenge/credit
   reminders (server-time hours, not location TZ).
6. **No general push channel, no member push-token model, no notification preferences beyond
   `smsOptIn`, no analytics on mobile, no Sentry anywhere, no CI (`.github/workflows` absent).**
7. **Live data exists for geofence moments:** `GET /locations` computes availablePods, avgWaitMinutes
   (queued orders x 5 min, capped 60) and open/closed state; `/locations/:id/seats` is public.
8. **Order status is polling only** (10 s on web, `useOrderStatus.ts`); no per-order ETA; KDS polls.
9. **Membership today:** tiers CHOPSTICK / NOODLE_MASTER / BEEF_BOSS (1/2/3% cashback as store
   credit, not points), 10 orders + 2 referrals then 25 + 5, free bowl per upgrade, 90-day credit
   expiry, referral $5/$5, 24 badges as chop-seal glyphs, challenges with JSON requirements, streaks.
   No leaderboard anywhere; mobile credits screen has a rank string with emoji (violates brand rule).
10. **Web UI portability:** 134 of 167 `components/site` files import next/* or next-intl; JSX and
    styling are 0-10% reusable; `apps/web/lib/site/*` logic (order draft/flow/status, pod arrival,
    program math, SSE parser `chappy/stream.ts`, i18n messages) is 60-70% reusable once fetch is
    abstracted. Lever: extract `@oh/core` shared package.
11. **Brand rules that bind the app:** palette charcoal #1C1B19 / cream #F2EDE4 / ember #C1502E /
    olive #6B7355 / gold #C9A227 / clay #8C5A3C; Instrument Serif + Raleway + Noto CJK; no emoji,
    no em dashes, welcoming voice (never "no staff"), four locales (en, zh-TW, zh-CN, es),
    prefers-reduced-motion honored, authentic photography only, no tipping.
12. **Chappy:** `claude-opus-5` default, frozen cached system prompt, persona Chappy Chopstix
    (dry, deadpan, caring; issue mode drops the act), never charges without explicit yes, store-credit
    goodwill caps $5/order, $10/30d, $45 lifetime.

## Part A: Market and financial case (research complete 2026-10-02)

### Verdict, stated plainly
**On restaurant economics alone, at one to three units, the numbers do not check out for a
best-in-class native app as the next major investment.** They turn positive at roughly three or
more trading units, or when Oh! OS has paying licensees, because the app is a fixed cost spread
over a base. The value driver the data actually supports (loyalty identity bound to every order)
is already 80% built on the mobile web and Apple Wallet pass. The owner's game-with-purchases idea
cannot ship as described (Apple IAP rules plus Utah gambling law). iOS-first as a scope decision
is not supported; iOS-first as a release-sequencing decision is fine.

### What the primary sources show (dates and publishers in the agent output)
1. **Digital ordering has plateaued at the best fast-casual brands, 30-40% of sales, and drifted
   down in 2024.** Chipotle 35.1% (FY2024 10-K, down from 37.4%); Sweetgreen owned digital 30%
   (FY2024, down from 36%), 38% in Q4 FY2025 only after redefining in-store scan-to-earn as digital;
   Cava 37.9% (FY2025). Wingstop 73% is a takeout format, not comparable to dine-in pods.
   ~75% of US restaurant traffic is off-premises (NRA 2025); Oh! is a dine-in concept, so
   app-ordering benchmarks built on takeout overstate Oh!'s gain.
2. **Loyalty identification and app ordering are different behaviors.** Dutch Bros: 72% of
   transactions tied to rewards, but order-ahead only ~14% of transactions (Q4 2025 call).
3. **Causal frequency lift is modest.** Club Wingstop pilot ~+7% frequency (2026). The 40-year
   meta-analysis (Belli et al., JAMS 2022, 429 effect sizes) confirms programs work but flags
   self-selection: heavy users join, so raw member-vs-nonmember gaps ("3x spend") are mostly
   who joins, not what the program does. Cava's circulating "25% higher spend" has no primary
   source; do not use it.
4. **Apps do not convert better than web.** Paytronix 2025: first-party app order completion
   40.4% vs web 41.1%; loyalty-guest online AOV ($34.79) not higher than non-loyalty ($35.97).
   Apps complete orders faster (iOS median 232 s), which is a UX benefit, not a conversion one.
5. **Retention is brutal.** Food & drink apps: ~23% day-1, ~8% day-30 (Adjust 2025, approximate);
   46% of Android installs uninstalled within 30 days (AppsFlyer 2024). Push opt-in medians:
   iOS ~49%, Android ~53-60% (Airship 2025). Opted-in users make 13% more purchases
   (correlational). No independent controlled study of geofenced-push lift for restaurants exists;
   Radar's +57% is vendor with undisclosed baselines.
6. **Small-brand reality.** Toast Q1 2026: only 7% of a restaurant's guests are multi-visit but
   drive up to 50% of volume; loyalty enrollment associates with return rates rising 7% to ~30%
   (vendor). Thanx average client runs ~20% of revenue through loyalty with no app required
   (card-linked). The only direct consumer data on downloading an independent restaurant's app is
   OpenTable 2015: 6% "very likely", 56% unlikely. No dataset shows what share of small-brand apps
   reach meaningful adoption.
7. **iOS vs Android.** US web traffic iOS 53.6-61% (StatCounter 2025-26, noisy); new-phone sales
   Apple 69% in Q4 2025 launch quarter, 54% in Q2 2025 (Counterpoint); teens 88% iPhone (Piper
   Sandler 2025); Utah 64.5% iOS but 2018 data (stale). iOS-only forfeits ~35-45% of US phones,
   skewed to lower-income, Black, Hispanic and older adults (Pew 2026 on smartphone dependence).
   App Store's 70% share of app-store spend is irrelevant: food is paid outside store billing.
   **Oh!'s own GA4 can give the real split within weeks of opening; it is not captured today.**
8. **Gamification evidence is real but small.** Chipotle Summer of Extras 2025: 6.4M activations,
   ~$12M incremental on ~$11.3B revenue (~0.1%). Status tiers motivate more than points
   (Dreze & Nunes, JCR 2009). Starbucks Odyssey NFT program closed in 15 months over friction.
   Leaderboards produce anxiety and negative comparison, especially among women (Strava studies);
   Strava's fix is small segment boards.
9. **Costs (third-party estimates, mostly undisclosed pricing).** White-label app platforms
   $149-349/location/month (Thanx, Incentivio, Lunchbox), but they assume their POS; Oh! runs its
   own Stripe platform. Agency comps: React Native ~$80-160K build, native dual ~$156K vs RN
   ~$87K for the same features; upkeep 15-25%/yr. Best-in-class scope (Live Activities, AI, game)
   lands above those comps. Oh!'s real cost is owner attention plus tokens plus ~$5-15K Utah
   counsel plus EAS/Sentry/PostHog subscriptions, inside the plan's $600K platform build line.

### Applying it to Oh!'s plan model (inputs are explicit so they can be replaced with real data)
Correction: the plan's base case is 450 covers/day (330 conservative, 600 aggressive; 313 is
break-even). 450 x 313 days = 140,850 covers/yr x $23.18 = $3.26M, which reconciles.

| Input | Low | Mid | High |
|---|---|---|---|
| Unique guests/yr (140,850 covers / visits per guest F=4) | 35,200 | 35,200 | 35,200 |
| App install rate among guests | 5% | 15% | 30% |
| Monthly-active share of installers (regulars self-select; above the 8% generic D30) | 25% | 40% | 50% |
| **MAU per unit** | **~440** | **~2,100** | **~5,300** |

Fully loaded app cost (agency-comp basis): ~$60-100K/yr (3-year amortization + run). At ~65%
incremental contribution margin that needs $90-155K/yr of truly incremental revenue, i.e.
2.8-4.8% of one unit's revenue, i.e. the mid MAU cohort each spending $43-74/yr MORE than they
otherwise would (2-3 extra visits per active user per year, caused by the app, over and above the
web + wallet loyalty they would already have). No published evidence supports an increment of
that size attributable to the native app itself. At 5 corporate units the same fixed cost needs
~0.6-1% per unit, which push, one-tap reorder and Live Activities can plausibly deliver.
**Break-even trigger: roughly 3+ trading units, or Oh! OS licensees paying for the app.**

### Oh! OS leg
Oh! OS is modeled at $1,800/location/month at 80% GM, with franchise units from year 4. Every
competing restaurant platform at $149-349/location/month includes a branded app, so a member app
is table stakes for the platform offer and the $1,800 price presumes far more than an app
(flag for the plan). The app is therefore a legitimate platform product asset, but its revenue is
years out and there are zero external customers today. Building it now is an investment in the
investor story and the platform roadmap, not in near-term restaurant returns. That is a valid
choice; it must be labeled as such to investors.

### Decision rule (written before results arrived, to avoid motivated reasoning) and outcome
- Proceed with a native app build only if the evidence-based incremental contribution at the
  flagship exceeds the fully loaded 3-year cost at the conservative end, OR the app is justified
  as an Oh! OS product asset with a clear path to modeled license revenue. Otherwise recommend
  wallet-pass + web first and a dated trigger to revisit.
  **Outcome: leg 1 fails at one unit; leg 2 is real but years out. The rule therefore says:
  do the no-regret platform groundwork now, gate the app build on a trigger, and let the owner
  override the gate knowingly if the investor/platform story demands the app sooner.**
- iOS-first is accepted only if OS share AND target segments both point that way; otherwise ship
  both from a shared codebase. **Outcome: share points to iOS (53-69%), segments are mixed
  (Silicon Slopes iOS-heavy; Provo students and Hispanic guests less so), and Expo makes Android
  ~10-15% incremental cost. Ship both; sequence iOS to TestFlight first.**

## Part D: Execution plan

### Owner decision required at the gate (not before)
After Phase 0, choose one:
- **Option 1 (what the data says):** hold Phase 1 until the flagship has traded 90 days and GA4
  shows the real OS split, repeat-guest share and member enrollment. Revisit with those inputs.
- **Option 2 (platform-flagship override):** start Phase 1 now, booked against the Oh! OS
  platform build line, labeled to investors as a platform product investment with unproven
  restaurant ROI at one unit. Legitimate if "interested parties" need a demonstrable mobile product.
The plan below is identical either way; only the start date of Phase 1 differs.

### Phase 0: No-regret groundwork (pre-opening, ~3-4 weeks AI-assisted, benefits web and
### Oh! OS regardless of the app decision)
1. **Delete `apps/mobile`** (owner confirmed 2026-10-02 it is disposable). Record the bundle id
   `com.ohbeef.app` and scheme `ohbeef` in the spec.
2. **Capture the data that decides the question.** Add device category / OS to the admin
   analytics page via the existing GA4 Data API client (`packages/api/src/index.js` ~149,
   `apps/admin/app/(console)/analytics/page.tsx`); add `clientPlatform` to `Order` and set
   `orderSource` correctly for every channel (fix `/analytics/order-sources` which omits EVENT,
   CATERING, CHAPPY). Add repeat-guest and member-enrollment widgets.
3. **Finish Google Wallet.** Replace the stub `generateGoogleWalletLink` in
   `packages/api/src/wallet/wallet-pass.js` with a signed Generic/Loyalty JWT save link;
   mirror the Apple lock-screen locations. Both wallets then deliver the owner's proximity
   moment (pods open, credit balance, CTA) with zero app permission.
4. **Extract `@oh/core`** (new `packages/core`): API types, zod schemas, fetch client with
   tenant header and auth injection, `apps/web/lib/site/{order-draft,order-flow,order-status,
   pod-arrival,program,phone,i18n-errors}.ts`, the SSE parser `components/site/chappy/stream.ts`,
   and the i18n message catalogs. Web consumes it first (proves the boundary).
5. **API contract.** Generate OpenAPI from the zod schemas (fastify-zod or zod-openapi) and
   publish a typed client from it. This is also an Oh! OS licensing asset.
6. **Notification platform in the API.** `MemberDevice` model (pushToken, platform, locale,
   lastSeen, attestation state) and `NotificationPreference` (channels: orders, rewards, offers,
   chappy; quiet hours; marketing cap); direct APNs sender generalized from
   `wallet/apns-service.js` plus an FCM sender; a `notifications/dispatch.js` that routes to
   push, SMS (existing Twilio), wallet-pass update and email with 10% marketing holdout and
   per-user frequency cap. Fix `wallet-cron.js` to use location timezone, not server time.
7. **Per-order ETA.** Kitchen-side estimate (queue depth x prep time per station, calibrated from
   `kitchenOrderNumber` timings) exposed on `GET /orders/status`; the web status page uses it
   immediately; Live Activities and scheduled pickup depend on it later.
8. **Engineering hygiene the app will need:** GitHub Actions running the existing node:test,
   vitest and Playwright suites; Sentry on API/web; pnpm supply-chain settings (min release age,
   lifecycle scripts blocked); dependency scanning.
9. **Legal scoping memo** for Utah counsel: skill game rules, leagues/age brackets, Utah
   minor-protection acts, App Store Accountability Act (developer duties start 2027-05-06),
   purchased store credit vs gift-card rules.
10. **Write the design spec** `docs/superpowers/specs/2026-10-02-mobile-app-design.md` from this
    plan (brainstorming path step 6), then the implementation plan via writing-plans.

### Phase 1: Expo app MVP, iOS and Android from one codebase (~8-10 weeks AI-assisted)
Fresh `apps/mobile` on Expo SDK 57+, New Architecture, Hermes V1, Expo Router, Expo UI where it
fits; design tokens ported from the site palette (night look) with Instrument Serif / Raleway /
Noto CJK; four locales from `@oh/core`.
- Auth: Clerk Expo with Sign in with Apple, Google, passkeys; in-app account deletion.
- Home: live pill (pods open, wait, closes at) from `GET /locations`; one-tap "usual" from
  `get_usual_order` logic; credit balance; tier progress framed as items with endowed start.
- Order: native BowlBuilder (Reanimated sliders with haptic detents, VoiceOver adjustable);
  pod/arrival step; savings step; Stripe PaymentSheet with Apple Pay / Google Pay first against
  the existing `/orders/:id/payment-intent`; `orderSource = MOBILE`.
- Status: Live Activity + Dynamic Island via `expo-widgets`; Android progress notification;
  polling fallback; "I'm here" via tap, QR, or while-using geofence.
- Member: passport (tier, credits with expiry, streak), seal-glyph badges, challenges, referral
  share sheet, Apple/Google Wallet add-pass (owned Expo Module), order history, saved cards.
- Chappy: SSE chat via `expo/fetch`, proposes-then-confirm ordering into the native builder,
  visible/editable memory, consent sheet naming Anthropic (Apple 5.1.2(i)), "Report this reply"
  (Google Play), "Talk to the team" exit; money rules unchanged.
- Push: provisional authorization at install, full prompt after first order; Android channels;
  preferences screen; the top-10 list from Part C with holdouts.
- Security: SecureStore token cache, App Integrity attestation on value endpoints, public-key
  pinning for api.ohbeef.com with backup key and kill switch, EAS Update code signing (fixes
  only), Privacy Manifest.
- Quality: Sentry RN, PostHog, Maestro e2e for sign-in / order / status / wallet, performance
  budgets (cold start < 2 s p75 mid-range Android, 60/120 fps, < 500 ms screen loads, 99.9%
  crash-free), Dynamic Type and reduced motion audited on every screen.
- Release: EAS Build, TestFlight and Play internal track together; iOS submitted first; both
  listings go public in the same week. Review-readiness checklist (4.2, 4.8, 5.1.1, demo account,
  location purpose strings).

### Phase 2: Engagement layer (after 60-90 days of live app data)
Scheduled pickup capped by kitchen capacity (uses the ETA); opt-in weekly leagues and percentile
rank by zip/state/age bracket with the k-anonymity rules in Part C; selectable birthday reward;
monthly member drops; time-boxed quests; shareable stat cards; status match at launch; home-screen
widgets and App Intents for the usual; Chappy proactive moments (usual time, weather).

### Phase 3: Signature surfaces (gated on Phase 2 metrics and counsel sign-off)
Free skill game (Skia + Reanimated + Rive, SDK 57+, one rewarded play/day, preset menu-item
prizes); App Clip in SwiftUI for walk-in QR ordering; NFC VAS tap-to-identify at the counter
(Apple certificate); group order; gift a bowl.

### Measurement plan (every phase reports these, with pre-registered targets)
| KPI | Benchmark | Target to pass the next gate |
|---|---|---|
| App share of member orders | n/a | > 30% by day 90 |
| MAU / unique guests (per unit) | mid scenario ~6% | > 6% |
| Day-30 retention | ~8% food & drink | > 25% (regulars self-select) |
| Push opt-in | iOS 49%, Android 53% | > 55% |
| Frequency lift, app users vs matched holdout | Wingstop +7% program-wide | > +5% attributable |
| Crash-free sessions / cold start | 99.9% / < 2 s | met every release |
Kill or pause criteria: after 6 months live, app share of member orders < 15% AND no measurable
frequency lift in the holdout AND no Oh! OS licensee asking for it.

### Verification (how each phase is proven done)
- Phase 0: CI green on all suites; admin analytics shows device/OS split from GA4 on dev data;
  Google Wallet save link opens and installs on a real Android device; OpenAPI document generated
  and typed client compiles in web; `@oh/core` used by web with vitest passing; `curl`-driven test
  of `notifications/dispatch.js` honoring caps and holdout (node:test); ETA shown on the web status
  page in dev; wallet-cron fires at 10:00 America/Denver in a TZ test.
- Phase 1: Maestro flows pass on iOS simulator and Android emulator; a real test order paid with
  Apple Pay in Stripe test mode on a physical iPhone; Live Activity appears on lock screen;
  attestation rejected when missing on reward redemption (API test); pinning verified with a MITM
  proxy failing; Xcode Instruments / Android Profiler traces meet budgets; TestFlight build
  installed by the owner; App Store review passed.
- Phases 2-3: holdout dashboards in admin show lift with confidence intervals; counsel letter on
  file for the game and leagues before either ships.

### Model and token discipline (owner is token-constrained)
Research and planning happen once (this document). Implementation runs subagent-driven: Sonnet
for scaffolding, screens, tests and screenshots; Opus for payments, security, Live Activity module
and code review; the orchestrator stays lean and verifies with the commands above before any
"done" claim.

## Part B: Technology decision (research complete 2026-10-02)

### The fact that reframes the debate
On 2026-09-10 Shopify, React Native's best-known advocate, announced it is moving all mobile apps
back to native Swift and Kotlin (shopify.engineering/back-to-native). Its stated reason is that AI
coding agents now make writing each feature twice cheap enough; its RN apps were fast (sub-500 ms
screen loads, 99.9%+ crash-free). The Shop app went native in 12 weeks. Consequences: React Native
Skia sponsorship ends 2026, FlashList critical-fixes-only, Restyle archived. So "native is too
expensive for a small team" is no longer safe to assume. But Shopify has a large native org to
review what agents write; Oh! has a TypeScript/Next/Prisma/Clerk team with no native reviewers.

### Evidence per option (sources checked by the agent, dates given)
- **Expo/React Native.** Expo SDK 54 (2025-09) precompiled XCFrameworks (RN build 120 s to ~10 s);
  RN 0.84 (2026-02) Hermes V1 default, legacy arch removed; Expo SDK 56 (2026-05) stable Expo UI
  (SwiftUI/Compose primitives), stable `expo-widgets` for iOS widgets AND Live Activities, min iOS
  16.4, known Hermes v1 + Reanimated memory regression fixed in SDK 57. Production evidence:
  Discord cut TTI 400 ms on RN 0.79; Coinbase 200+ screens; Bluesky one Expo codebase for iOS,
  Android and web. Clerk Expo SDK v3 (native AuthView beta 2026-03); Stripe PaymentSheet official.
  `@expo/app-integrity` (App Attest + Play Integrity) alpha since SDK 54. Wallet "add pass" is
  community-only: plan to own a ~200-line Expo Module. Geofencing via `expo-location`
  (20 regions iOS, 100 Android): fine for 3-5 locations, no need for Radar/Bluedot.
- **Flutter.** Impeller default; Flutter team has said it is NOT building iOS 26 Liquid Glass in
  Cupertino (flutter#170310). Draws its own UI, no language overlap with the stack. Weak fit.
- **Fully native (SwiftUI + Compose).** Best platform surfaces day one (Live Activities, App Clips,
  Wallet, Liquid Glass, Android Live Updates). DoorDash consumer app is SwiftUI; Starbucks ships
  Live Activities since 2024-01 (its stack unverified). Two codebases, two review skill sets.
- **KMP/Compose Multiplatform.** McDonald's global app runs KMP. Good for Kotlin teams; gives a
  TypeScript team neither React reuse nor SwiftUI polish.
- **Restaurant-app stacks (Chipotle, Sweetgreen, Cava, Dutch Bros): no primary sources found.**
  Treat vendor "who uses X" lists as folklore.

### Code reuse from the Next.js site (honest estimate)
Ports: types, zod schemas, API client, TanStack Query hooks, pricing/tier math, i18n strings,
the SSE chat protocol (via `expo/fetch`, streaming since SDK 52). Does not port: DOM components,
the CSS design system, Next routing/server components. Expected share of mobile code from shared
packages: 25-35%. UI reuse 0-10%. Do NOT rewrite the website onto React Native Web; it is already
phone-first and good. Expo DOM components (`'use dom'`) only for low-traffic content screens
(legal, FAQ), never menu/cart/checkout.

### Scoring (1-5)
| Criterion | Expo/RN | Native | Flutter | KMP |
|---|---|---|---|---|
| Runtime performance | 4 | 5 | 4 | 4 |
| Platform surfaces (Live Activities, App Clip, Wallet, Liquid Glass) | 4 | 5 | 3 | 4 |
| Security posture | 3 (npm surface, App Integrity alpha) | 5 | 4 | 4 |
| Fit with TS/Clerk/Stripe stack | 5 | 2 | 1 | 1 |
| Small AI-assisted team speed | 5 | 3 | 3 | 2 |
| Ecosystem risk | 3 (Shopify exit) | 5 | 4 | 4 |
| Hiring/maintenance | 4 | 3 | 3 | 3 |

### Decision
**Expo (SDK 57+, New Architecture, Hermes V1, Expo Router) with native code where native is the
better tool:** App Clip in SwiftUI (phase 2), Live Activity + widgets via `expo-widgets` (fall back
to a raw Swift extension if it falls short), an owned Expo Module for Apple/Google Wallet add-pass,
Android Live Updates via an owned Kotlin Expo Module. Share `packages/core` with the web app.
Pin stable SDK releases; treat anything under SWM Labs, beta or alpha as code Oh! will own.

**Why not Shopify's path:** Oh!'s advantage is one TypeScript team across web, API and mobile. The
native quality ceiling is only reachable if someone can review the agents' Swift and Kotlin. Expo
keeps native code in small, reviewable pieces.

**Fallback, with explicit triggers:** go fully native (SwiftUI first, Compose second, API contract
via zod -> OpenAPI as the shared truth) if after two releases (a) the app is mostly platform
surfaces, (b) RN dependency/security churn costs more than ~20% of team time, or (c) a senior iOS
engineer is hired.

**The existing `apps/mobile` shell (April 2026, expo-router 5 on SDK 54, light theme, legacy
palette, no EAS, no tests) is restarted on a fresh template.** Keep only bundle id `com.ohbeef.app`,
scheme `ohbeef`, and the Clerk wiring pattern.

### Security baseline (OWASP MASVS 2.1)
1. Storage: Clerk token cache on `expo-secure-store` (Keychain/Keystore); nothing sensitive in
   AsyncStorage/MMKV unencrypted.
2. Auth: Clerk 60 s session tokens verified server-side (existing `auth/customer.js`); passkeys
   offered; Sign in with Apple required if Google sign-in is offered (guideline 4.8); in-app account
   deletion (5.1.1(v)).
3. Payments: Stripe PaymentSheet, card data never touches the API; server re-prices every order
   (existing pattern via `POST /orders/quote`).
4. API abuse: `@expo/app-integrity` attestation required on reward redemption, game-score
   submission, promo redemption, account creation. Server-authoritative scoring, velocity checks.
   This matters more than jailbreak detection (use attestation signal server-side; never hard-block).
5. Network: public-key pinning for `api.ohbeef.com` only (two keys incl. backup, remote kill
   switch, rotation runbook); Stripe and Clerk SDKs handle their own.
6. Code exposure: Hermes bytecode is not obfuscation; no secrets in the bundle.
7. OTA: EAS Update with code signing, channels, staged rollout, rollback; fixes and copy only,
   never features (guideline 2.5.2).
8. Supply chain (RN's biggest structural disadvantage): pnpm frozen lockfile, minimum release
   age, lifecycle scripts blocked, Socket (or equivalent) in CI, scoped EAS/npm tokens. Context:
   chalk/debug compromise 2025-09-08 and the Shai-Hulud worm (CISA alert 2025-09-23).
9. Privacy: Privacy Manifest, minimal permissions, data export and deletion. ATT not needed while
   first-party only (no ad SDKs).

### Platform rules that shape the product
- Food is a physical good: must NOT use IAP; Stripe/Apple Pay/Google Pay are correct.
- Any paid in-game currency, lives or levels MUST use IAP (15% under Small Business Program;
  current terms to be confirmed). Therefore the game sells nothing; it earns through play and
  visits, and earnings convert to store credit.
- Random prizes trigger guideline 5.3 (self-sponsored, official rules in-app, Apple not involved)
  plus state sweepstakes law; loot boxes require published odds. Skill-based design avoids this.
- Rejection risks: 4.2 "repackaged website" (native surfaces are the defense), 5.1.1 account
  deletion, 4.8 login, missing demo credentials, unclear location purpose.

### Ops and performance bars
Sentry RN with Hermes source maps and release health; PostHog for analytics and flags; TestFlight
and Play internal tracks; Maestro for e2e. Budgets: cold start < 2 s p75 on mid-range Android,
60 fps everywhere and 120 fps on ProMotion for the game and gestures, screen load < 500 ms,
99.9% crash-free sessions.

### Push and location architecture
Send APNs and FCM directly from the Node API (APNs is already in place for wallet passes and is
needed for Live Activity tokens); `expo-notifications` on the client. Add a campaign tool only if
marketing needs one. Location: design everything for "While Using" (Foursquare data: ~22% choose
Always vs ~65% While Using; iOS 13 cut Always usage ~70%); tap-to-arrive "I'm here" fallback;
ask for Always only after the user has seen the benefit. The Apple Wallet pass already delivers
lock-screen proximity relevance without any app permission.

### Game tech
React Native Skia + Reanimated (GPU 2D in TypeScript; note Skia sponsorship ends 2026 and moves to
the Candillon fork) plus Rive for character animation (Duolingo uses Rive). Build the game only
on SDK 57+ because of the Hermes v1 + Reanimated memory regression. Unity/Godot embeds rejected.

## Part C: Feature set, push plan, ranking design, game (research complete 2026-10-02)

### What the leaders prove (cited in the agent output; vendor claims labeled)
- Loyalty captures most transactions when identity and ordering are the same act: Dutch Bros
  rewards 72% of transactions (15M+ members); Chipotle ~90% of digital orders identified vs ~20%
  at the counter (now testing earn-on-pay). Digital share: Chipotle 36.7% of 2025 sales, Domino's
  85%+ of US sales, Wingstop 73%.
- Tiers are the 2025-26 standard: Starbucks Green/Gold/Reserve (2026-03, with backlash over
  devaluing earned value), Chick-fil-A Member/Silver/Red/Signature (4.9 stars, ~4.2M ratings),
  Cava Sea/Sand/Sun with industry-first status matching (8M members, 50K/week). Sweetgreen
  dropped its tiered subscription as "too complicated". Lesson: simple, never devalue earned value.
- Gamification is now mainstream: Chipotle "Rewards on Repeat" (2026-04) has monthly streaks,
  local/state/national leaderboards, side quests, badges. McDonald's Monopoly app-gated, 500M plays.
  Chipotle "Race to the Rewards" 2.1M plays, 71K new members in two days.
- Starbucks scheduled pickup (2026-05): 5-minute windows capped by real store capacity. Accurate
  "ready in X" beats fast.
- Stripe holdback test: offering Apple Pay lifted conversion +22.3%; showing it early (Express
  Checkout) roughly doubled the lift.
- Goal-gradient effect (Kivetz, Urminsky, Zheng 2006): endowed progress and "X to next" framing
  speed completion.
- Leaderboards: Duolingo leagues (~30-person weekly cohorts) raised lessons ~25% (secondary
  source); RCTs show low performers get demotivated or stressed while high performers gain.
  Relative-to-peers boards beat absolute boards. Design implication: never show the bottom.
- Push: Airship 2025 median opt-in iOS 48.9%, Android 53.3%; Braze QSR +16% repeat purchase vs
  no-push control (vendor); fatigue data says 6+ per week drives uninstalls.
- AI assistants: Wendy's FreshAI 86% unassisted; Ask DoorDash +50% grocery basket, 5x faster
  checkout; Taco Bell drive-thru AI failed publicly (18,000 water cups) over missing sanity
  checks and no human exit. Starbucks keeps checkout in its own app even for its ChatGPT beta.
- Accessibility: ~20-40% of iPhone users run non-default text size; App Store now labels
  Larger Text support.

### Ranked feature set (evidence strength, then effort)
Tier 1, launch (strongest evidence): identity bound to every order; Apple Pay / Google Pay sheet
shown first; one-tap "usual" reorder (plus home-screen widget and App Intent); tier status with
item-based progress and endowed start ("2 bowls to Noodle Master"); Live Activity order tracking
(Android progress notification); arrival check-in ("I'm here" via geofence-while-using, tap, or
NFC/QR pod tag); personalized push with 10% holdout; streaks; credit-expiry reminders; Wallet
pass with pass-update pushes (exists); Dynamic Type, VoiceOver, reduced motion, haptics.
Tier 2, release 2: scheduled pickup capped by live kitchen capacity (needs per-order ETA);
opt-in percentile leagues; selectable birthday reward; Chappy "order for me"; monthly drops;
time-boxed quests; shareable stat cards; status match at launch (manual review).
Tier 3, later: skill mini-game; tap-to-identify at counter (Apple VAS NFC certificate);
group order; gift a bowl; App Clip for walk-ins.

### Chappy in the app (design rules)
Chappy proposes, the guest confirms with one tap; Chappy fills the BowlBuilder and the guest
approves; payment always in the native Apple Pay / Google Pay sheet (Chappy never charges, matches
the existing rule). Visible, editable memory ("Chappy remembers: Medium texture, extra greens")
with a forget button. Money limits unchanged ($5/order, $10/30d, $45 lifetime store credit).
Quantity sanity checks; one upsell per conversation; always a "Talk to the team" exit. Proactive
only in context (usual at usual time, weather), never unprompted bubbles. Text first, voice
optional. Platform compliance: Apple 5.1.2(i) (2025-11-13) requires explicit consent before
personal data goes to a third-party AI, so a one-time consent sheet naming Anthropic; honest
age-rating questionnaire (AI assistant question); Google Play GenAI policy requires in-app
"Report this reply".

### Ranking by zip, state, age bracket (the owner asked for this; here is the safe design)
1. Off by default; two separate opt-ins (appear on boards; appear under own name). Default
   display is alias or first name + initial.
2. Rank on visits, streaks, textures/dishes tried. Never on dollars spent.
3. Percentiles, not positions, outside the top 10 ("Top 15% in 84101"). Below the 50th
   percentile the member sees only their own trend and the nearest milestone.
4. k-anonymity: a board displays only with 50+ opted-in members; computed stats need 20+;
   otherwise roll up zip -> metro -> state. Never cross-tabulate zip x age unless both cells meet k.
5. Age brackets 18-24, 25-34, 35-49, 50+; minors never ranked; age only if the member adds it.
6. Weekly leagues of ~30 similarly active members (Duolingo pattern), monthly reset, gentle
   demotion.
7. Coarsen timing: updates delayed 24 h; never show last-seen or pod.
8. One-tap hide; self-serve deletion of ranking history. Utah Consumer Privacy Act and the
   2025-26 Utah minor-protection acts make the age and location handling above mandatory, not
   optional.

### Top 10 push notifications (each marketing push runs with a 10% holdout)
| # | Trigger | Intent | Metric |
|---|---|---|---|
| 1 | Order status (Live Activity, not repeated pushes) | "Your bowl is in the pot. Pod 3 in 2 min." | on-time pickup, fewer status contacts |
| 2 | Near a location with an open order or at usual mealtime | pods open now, credit balance, one-tap "I'm here" / order (owner's wallet idea) | check-ins, push-to-order |
| 3 | Credit posted after a visit | "+$0.46 credit. 2 bowls to Noodle Master" | days to next visit |
| 4 | Credit expiring 7 d and 1 d | "$8 credit expires Fri" | redemption |
| 5 | Within 15% of next tier or streak at risk | "One visit keeps your streak" | tier conversion |
| 6 | Learned usual time + usual store | "Your usual at City Creek, ready 12:10?" one tap | conversion |
| 7 | Cold or rainy SLC weather | comfort-bowl note in Chappy's voice | uplift vs holdout |
| 8 | Birthday window | choose-your-own birthday reward | redemption |
| 9 | Lapsed 21 / 45 days | personal win-back, not blanket discount | reactivation vs holdout |
| 10 | Friend redeems referral or gifted bowl | "Maya used your bowl." | referral K-factor |
Rules: iOS provisional (quiet) authorization at install, full prompt after the first order;
Android channels (Orders, Rewards, Offers, Chappy); cap 2 marketing pushes/week; quiet hours
9 PM to 8 AM Mountain Time; transactional uncapped.

### Mini-game: what the law and the stores allow
Apple 3.1.1 forbids IAP for food and requires IAP for any paid in-game item; 5.3 governs
random prizes (self-sponsored, rules in-app, Apple not involved). Utah Code 76-10-1101 bans
risking value on chance; promotions survive only if no purchase is required for entry or
advantage. **Therefore the owner's "in-app purchases that yield point credit" cannot ship as
stated.** Paid items would be IAP (15-30% to Apple) converting into food credit, which Apple
treats as circumventing physical-goods rules, and a purchase-linked chance element would be a
Utah lottery. The compliant version: free, skill-based, one rewarded play per day, prizes as
preset menu items or tier progress (never cash or unbounded credit), no purchase buys plays or
advantage, Utah counsel reviews the rules. Three concepts (all 45-90 s, Skia + Reanimated + Rive):
"Pull the Noodle" (rhythm dough stretch), "Broth Master" (match a regular's slider profile from
Chappy's clues; doubles as menu education), "Rush Hour at the Pods" (route parties into pods
before bowls cool; top percentile earns a monthly Chef's Table invite by skill cutoff).

### Gaps the research could not close
No published lift for gifting, pay-it-forward or group ordering; "ready in X" accuracy data
absent; Duolingo figures secondary; wallet-pass redemption stats are vendor claims.

