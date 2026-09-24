# Oh! Beef Noodle Soup — Interactive Business Plan Build Spec

**Target repo:** `oh-platform`
**Target route:** `apps/web/app/[locale]/plan/*`
**Status:** Spec for Claude Code. Read this entire file before writing code.
**Owner:** Dano Didericksen
**Last updated:** September 2026

---

## 0. Kickoff Prompt (paste this into Claude Code)

> Read `docs/OH_BUSINESS_PLAN_BUILD_SPEC.md` in full, then read `DECISIONS.md`, `PROJECT_CONTEXT.md`, and `packages/db/prisma/schema.prisma`.
>
> Build the password-protected interactive business plan described in that spec, at `apps/web/app/[locale]/plan/`. This is a live, data-driven investor and lender artifact, not a static document. Every number on screen must derive from the single typed financial engine in `packages/plan-model`, never from hardcoded JSX.
>
> Work in this order and stop for my review after each phase:
> 1. Phase 1: access control (Prisma models, middleware, gate page, admin code issuance, view analytics)
> 2. Phase 2: `packages/plan-model` financial engine with full unit tests
> 3. Phase 3: shell, navigation, scroll progress, section registry, print route
> 4. Phase 4: the eleven interactive modules, in the priority order listed in section 6
> 5. Phase 5: i18n extraction, accessibility pass, Lighthouse pass, PDF export
>
> Before Phase 1, give me a written implementation plan with file paths and any places you disagree with this spec. Do not start coding until I approve the plan.

---

## 1. What We Are Building and Why

A password-protected section of ohbeef.com that replaces the traditional PDF business plan with a live, interactive, beautiful web experience.

**The strategic thesis:** the medium is the message. When a landlord, an SBA lender, or a Series A investor opens a link and finds a working financial model they can manipulate, a 3D floor plan they can walk, and an expansion map they can scrub through time, we have already proven the core claim of the business: that we are a technology company that happens to serve extraordinary beef noodle soup.

**Three audiences, one artifact:**

| Audience | What they need | How we serve it |
|---|---|---|
| Equity investors | Upside, unit economics, scalability, team | Interactive model, expansion engine, platform SaaS story |
| SBA lenders (America First CU) | Conservative case, DSCR, collateral, personal guarantee context | Conservative scenario locked as default for lender access codes, clean printable PDF |
| Landlords and brokers | Creditworthiness, traffic, use case, buildout scope | Floor plan module, site requirements sheet, operator credibility |

The access-code system (section 4) lets us serve all three from one codebase with different default scenarios and different visible sections.

---

## 2. Critical Context: What Changed

**This spec supersedes prior decisions. Update `DECISIONS.md` accordingly as part of this work.**

| Item | Old | New |
|---|---|---|
| Pods per location | 40 | **75** |
| Location footprint | Not specified | **~3,500 sq ft** |
| Expansion pace | Franchise "someday" | **4 to 5 additional Utah locations within 12 months of flagship opening** |
| Flagship | "Lehi/SLC/Provo TBD" | **Lehi, Traverse Mountain area** |
| Capital | $750K to $1.5M seed | **Two-round structure, see section 7.6** |

Add a row to the Decision Log in `DECISIONS.md`:
`| Sep 2026 | 75 pods / 3,500 sq ft standard footprint | Partner-driven acceleration; unit economics improve materially at 75 pods with same kitchen |`

Also update `Seat` model seeding and any pod-count constants in the admin app. Grep for `40` near pod logic before you assume you found them all.

---

## 3. Design Direction

Do not build a dashboard. Build an experience. Muji minimalism with warmth, Japanese-Taiwanese fusion, moody and confident. Think an editorial long-read that happens to be computational.

### 3.1 Palette (existing brand, already in `tailwind.config.ts` if present, otherwise add)

```ts
// tailwind.config.ts — extend.colors
oh: {
  charcoal:  '#1C1B19',  // primary background, deep warm black
  ink:       '#2A2724',  // raised surfaces
  stone:     '#3A3632',  // borders, dividers
  ash:       '#8A8178',  // muted text
  cream:     '#F2EDE4',  // primary text on dark
  paper:     '#FAF7F1',  // light-mode surfaces, print
  ember:     '#C1502E',  // burnt orange, primary accent, CTAs, key figures
  olive:     '#6B7355',  // secondary accent, positive deltas
  gold:      '#C9A227',  // warm gold, tier/highlight accents
  clay:      '#8C5A3C',  // tertiary, chart series
}
```

Chart series order: `ember`, `olive`, `gold`, `clay`, `ash`.

### 3.2 Typography

- Display / section titles: a high-contrast serif with character. Recommend **Instrument Serif** or **Newsreader** via `next/font/google`. Large, tight leading, generous letter spacing on caps.
- Body: **Inter** or the existing site body face. Keep it consistent with the marketing site.
- Numerals: use `tabular-nums` on every figure that changes. Nothing cheapens a financial model like jittering digits.
- Chinese locales: ensure Noto Sans TC / SC fallbacks are declared. Use corner brackets (U+300C, U+300D) per existing i18n rules.

### 3.3 Motion

- Scroll-linked, not scroll-triggered where possible. Use `framer-motion` `useScroll` + `useTransform`.
- Respect `prefers-reduced-motion` on every animation without exception.
- Numbers count up on first view only, never on re-entry.
- No parallax on mobile. Phones get clean, fast, thumb-reachable.

### 3.4 Non-negotiables from brand standards

- Authentic brand assets only. The calligraphic Oh! logo and real food photography. **No AI-generated imagery, no generic stock.** If a photo slot has no asset yet, render a tasteful typographic placeholder card that says what photo belongs there, and add it to a `PHOTO_NEEDS.md` punch list at repo root.
- No personal financial details anywhere in this build. Dano's personal balance sheet, credit, and guarantee capacity are provided directly to lenders on request and never live in the app or repo.

---

## 4. Access Control

### 4.1 Why not Clerk

Clerk is right for customers. It is wrong here. An investor will not create an account to read a business plan, and a landlord definitely will not. We need frictionless, revocable, per-recipient links with view analytics.

Implement a separate lightweight passcode layer. Clerk stays untouched.

### 4.2 Prisma models

Add to `packages/db/prisma/schema.prisma`:

```prisma
enum PlanAudience {
  INVESTOR
  LENDER
  LANDLORD
  PARTNER
  ADVISOR
  INTERNAL
}

enum PlanScenario {
  CONSERVATIVE
  BASE
  AGGRESSIVE
}

model PlanAccessCode {
  id              String        @id @default(cuid())
  code            String        @unique              // human-readable, e.g. "OH-KESTREL-7742"
  codeHash        String                             // argon2/bcrypt hash; never compare raw
  label           String                             // "Jim R. — America First CU"
  audience        PlanAudience
  defaultScenario PlanScenario  @default(BASE)
  allowedSections String[]      @default([])         // empty = all sections
  expiresAt       DateTime?
  revokedAt       DateTime?
  maxSessions     Int?                               // null = unlimited
  createdAt       DateTime      @default(now())
  createdByUserId String?

  sessions        PlanViewSession[]
  questions       PlanQuestion[]

  @@index([code])
}

model PlanViewSession {
  id            String   @id @default(cuid())
  accessCodeId  String
  accessCode    PlanAccessCode @relation(fields: [accessCodeId], references: [id], onDelete: Cascade)
  startedAt     DateTime @default(now())
  lastSeenAt    DateTime @updatedAt
  userAgent     String?
  ipHash        String?                              // hashed, never store raw IP
  country       String?
  totalSeconds  Int      @default(0)

  sectionViews  PlanSectionView[]

  @@index([accessCodeId, startedAt])
}

model PlanSectionView {
  id          String   @id @default(cuid())
  sessionId   String
  session     PlanViewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sectionKey  String                                 // matches SECTIONS registry key
  seconds     Int      @default(0)
  enteredAt   DateTime @default(now())
  interactions Int     @default(0)                   // slider moves, toggles, expands

  @@index([sessionId, sectionKey])
}

model PlanQuestion {
  id            String   @id @default(cuid())
  accessCodeId  String
  accessCode    PlanAccessCode @relation(fields: [accessCodeId], references: [id], onDelete: Cascade)
  sectionKey    String
  body          String
  contactEmail  String?
  answeredAt    DateTime?
  answerBody    String?
  createdAt     DateTime @default(now())

  @@index([accessCodeId, createdAt])
}
```

`PlanAccessCode` and children are intentionally **not** tenant-scoped. This is corporate, not tenant data. Document that exception in a code comment so the multi-tenant lint rule does not flag it.

### 4.3 Auth flow

1. `GET /[locale]/plan/*` hits `middleware.ts`. If no valid `oh_plan` cookie, rewrite to `/[locale]/plan/gate?next=<path>`.
2. Gate page: single input, brand-forward, the Oh! mark on charcoal. Copy: "This plan is shared by invitation."
3. `POST /api/plan/auth` with `{ code }`. Look up by normalized code, verify hash, check `revokedAt` and `expiresAt` and `maxSessions`.
4. On success: create `PlanViewSession`, sign a JWT with `jose` containing `{ sid, acid, audience, scenario, sections, exp }`, set as **HttpOnly, Secure, SameSite=Lax**, 14-day expiry. Secret from `PLAN_JWT_SECRET`.
5. Middleware verifies the JWT on the edge and passes decoded claims via request headers to server components.
6. Rate limit `/api/plan/auth` at 5 attempts per 15 minutes per IP hash. Return an identical generic error for wrong-code and revoked-code. Do not leak which.

### 4.4 Env vars (document in `.env.example`)

```bash
PLAN_JWT_SECRET=            # 32+ byte random
PLAN_IP_HASH_SALT=          # for ipHash
PLAN_NOTIFY_EMAIL=dano@ohbeefnoodlesoup.com
```

### 4.5 Admin surface

`apps/admin/app/plan-access/page.tsx`:
- Table of codes: label, audience, created, last viewed, total sessions, total minutes, status
- "Issue code" modal: label, audience, default scenario, section allowlist, expiry
- Copy-link button that copies `https://ohbeef.com/plan?c=CODE` (auto-submits the gate, so a recipient gets one clean link)
- Revoke button with confirm
- Per-code drill-down: session timeline, heat table of seconds-per-section, interaction counts, submitted questions

**This is the sleeper feature.** Knowing that a lender spent eleven minutes on the sensitivity module and zero on the menu is worth more than the plan itself.

---

## 5. Financial Engine

### 5.1 Hard architectural rule

Create `packages/plan-model` as a workspace package (`@oh/plan-model`). It is pure TypeScript: no React, no Prisma, no I/O, no side effects. Deterministic functions over typed assumption objects.

**Every figure rendered anywhere in the plan, including prose, comes from this package.** If a component contains a hardcoded dollar amount, the build is wrong. Prose interpolates: `t('plan.execsum.revenue', { value: fmt(model.year3.systemRevenue) })`.

100% unit test coverage on the engine with Vitest. This is the part that must never be wrong in front of an investor.

### 5.2 Package structure

```
packages/plan-model/
├── src/
│   ├── types.ts            # Assumptions, LocationModel, PortfolioModel, Scenario
│   ├── assumptions/
│   │   ├── conservative.ts
│   │   ├── base.ts
│   │   ├── aggressive.ts
│   │   └── index.ts
│   ├── location.ts         # single-unit revenue, P&L, ramp curve, payback
│   ├── portfolio.ts        # rollup across locations + opening schedule
│   ├── platform.ts         # Oh! OS SaaS + franchise royalty P&L
│   ├── capital.ts          # capital stack, use of funds, dilution, DSCR
│   ├── sensitivity.ts      # tornado + 2-var grid + monte carlo
│   ├── format.ts           # currency, percent, compact, tabular helpers
│   └── index.ts
└── src/__tests__/
```

### 5.3 Assumption schema (implement exactly; these are the levers)

```ts
export interface LocationAssumptions {
  // Physical
  pods: number;                    // 75
  squareFeet: number;              // 3500
  // Throughput
  serviceHoursPerDay: number;      // 10
  operatingDaysPerYear: number;    // 355
  avgDwellMinutes: number;         // 24
  turnoverMinutes: number;         // 6  (clean + reset)
  utilizationRate: number;         // 0.22 / 0.30 / 0.40  <-- primary lever
  // Revenue
  avgBowlPrice: number;            // 19.50
  addOnAttachRate: number;         // 0.62
  avgAddOnSpend: number;           // 6.25
  beverageAttachRate: number;      // 0.55
  avgBeverageSpend: number;        // 4.50
  retailAttachRate: number;        // 0.04   (merch, gift cards, pantry)
  avgRetailSpend: number;          // 18.00
  // Cost of sales
  foodCostPct: number;             // 0.30
  packagingPct: number;            // 0.025
  // Labor  <-- THE THESIS
  kitchenFTE: number;              // 7
  managerFTE: number;              // 2
  avgKitchenWage: number;          // 24.00  (no tips, above-market by design)
  avgManagerSalary: number;        // 72000
  payrollBurdenPct: number;        // 0.18   (taxes, workers comp, benefits)
  // Occupancy
  rentPerSqFtAnnual: number;       // 34.00
  nnnPerSqFtAnnual: number;        // 9.00
  // Other operating
  utilitiesPct: number;            // 0.030
  paymentProcessingPct: number;    // 0.027
  marketingPct: number;            // 0.030
  techPlatformPct: number;         // 0.018
  suppliesPct: number;             // 0.022
  repairsMaintPct: number;         // 0.020
  insuranceAnnual: number;         // 48000
  gaPct: number;                   // 0.025
  contingencyPct: number;          // 0.020
  // Capital
  podUnitCost: number;             // 3200
  kitchenEquipment: number;        // 425000
  buildoutPerSqFt: number;         // 195
  tenantImprovementAllowancePerSqFt: number; // 55
  techHardware: number;            // 95000
  designArchPermits: number;       // 165000
  ffeSignage: number;              // 110000
  preOpening: number;              // 185000  (payroll, training, inventory, launch)
  // Ramp (index vs steady state, month 1..24)
  rampCurve: number[];
}
```

### 5.4 Revenue math (implement precisely)

```
cycleMinutes        = avgDwellMinutes + turnoverMinutes
turnsPerPodPerDay   = (serviceHoursPerDay * 60) / cycleMinutes
theoreticalCovers   = pods * turnsPerPodPerDay
actualCoversPerDay  = theoreticalCovers * utilizationRate

avgCheck = avgBowlPrice
         + (addOnAttachRate     * avgAddOnSpend)
         + (beverageAttachRate  * avgBeverageSpend)
         + (retailAttachRate    * avgRetailSpend)

annualRevenue = actualCoversPerDay * avgCheck * operatingDaysPerYear
```

**Sanity anchors for the three scenarios at 75 pods, 10 service hours, 30-minute cycle (theoretical 1,500 covers/day):**

| | Conservative | Base | Aggressive |
|---|---|---|---|
| Utilization | 22% | 30% | 40% |
| Covers/day | 330 | 450 | 600 |
| Avg check | $24.10 | $26.30 | $29.00 |
| Daily revenue | $7,953 | $11,835 | $17,400 |
| **Annual revenue** | **$2.82M** | **$4.20M** | **$6.18M** |
| Revenue / sq ft | $806 | $1,200 | $1,765 |

Show the revenue-per-sq-ft figure prominently and benchmark it honestly in the UI: US fast-casual median is roughly $450 to $600 per sq ft; top-decile operators clear $1,000; Chick-fil-A runs above $1,500. Our base case sits at $1,200, which is elite but demonstrably achieved by high-throughput, small-footprint, high-check operators. **Saying this out loud, with the benchmark, is more persuasive than hiding it.** Build a `<BenchmarkCallout />` component for exactly this move and reuse it wherever we make an aggressive claim.

### 5.5 Cost structure output (base case, steady state, ~$4.20M revenue)

| Line | % of revenue | Amount | Note |
|---|---|---|---|
| Food cost | 30.0% | $1,260,000 | Premium ingredients, shank-forward |
| Packaging | 2.5% | $105,000 | Dine-in heavy keeps this low |
| **Gross profit** | **67.5%** | **$2,835,000** | |
| Labor + burden | 12.8% | $537,000 | 7 kitchen + 2 mgmt, no FOH |
| Occupancy (rent + NNN) | 3.6% | $150,500 | 3,500 sf at $43 all-in |
| Utilities | 3.0% | $126,000 | |
| Payment processing | 2.7% | $113,400 | |
| Marketing | 3.0% | $126,000 | |
| Tech platform | 1.8% | $75,600 | Internal transfer to Oh! OS |
| Supplies | 2.2% | $92,400 | |
| Repairs + maintenance | 2.0% | $84,000 | 75 pods is real mechanical surface area |
| Insurance | 1.1% | $48,000 | GL, property, workers comp, cyber |
| G&A | 2.5% | $105,000 | |
| Contingency | 2.0% | $84,000 | |
| **Total opex** | **36.7%** | **$1,541,900** | |
| **EBITDA** | **30.8%** | **$1,293,100** | |

**Hold the public-facing target at 25% EBITDA.** The model produces ~31% at base. Beating your stated target in year two is a very good look. Missing it is fatal. The interactive module can show the full 30.8%, but every headline claim and the executive summary state 25%.

Include the traditional-restaurant comparison bar, because this is the whole argument:

| | Traditional full-service | Oh! |
|---|---|---|
| Food cost | 30% | 30% |
| **Labor** | **30%** | **12.8%** |
| Occupancy | 8% | 3.6% |
| Other opex | 20% | 20.3% |
| **EBITDA** | **12%** | **~31%** |

### 5.6 Capital per location

| Line | Flagship | Locations 2-5 | Note |
|---|---|---|---|
| Pods (75 × $3,200) | $240,000 | $204,000 | 15% tooling savings after first fabrication run |
| Kitchen equipment | $425,000 | $395,000 | |
| Buildout (3,500 sf × $195) | $682,500 | $612,500 | $175/sf after learning curve |
| Less TI allowance (× $55) | ($192,500) | ($192,500) | Negotiable; model as a lever |
| Tech + kiosk hardware | $95,000 | $72,000 | |
| Design, architecture, permits | $165,000 | $85,000 | Flagship carries the prototype design cost |
| FF&E + signage | $110,000 | $95,000 | |
| Pre-opening | $185,000 | $140,000 | |
| **Total net capex** | **$1,710,000** | **$1,411,000** | |

Payback at base case: flagship ~1.6 years from stabilization, ~2.3 years from opening including ramp. Model both and label them clearly. Investors read "payback" as from-opening; lenders read it as from-stabilization.

### 5.7 Ramp curve (index vs steady state, month 1 to 18)

```
[1.18, 1.22, 1.10, 0.88, 0.80, 0.78, 0.82, 0.86, 0.90, 0.94, 0.97, 1.00,
 1.01, 1.02, 1.03, 1.04, 1.05, 1.06]
```

The opening spike, the month-4 to month-6 trough, and the recovery. Every operator recognizes this shape. Including the trough instead of drawing a clean upward line is a credibility signal, and it is the single most common tell of an amateur restaurant pro-forma. Annotate the trough on the chart with a tooltip that says so.

Year 1 flagship blended revenue: ~$3.90M at base. Year 2 steady: $4.20M.

### 5.8 Portfolio rollup

Opening schedule, all months relative to `FLAGSHIP_OPEN` (T0) so the plan never goes stale:

| Location | Open | Rationale |
|---|---|---|
| **Lehi (Traverse Mountain)** | T0 | Flagship. Daytime tech-corridor density, Silicon Slopes lunch traffic, I-15 visibility, home market, founder proximity |
| **Downtown SLC (City Creek)** | T0 + 4mo | Highest-visibility urban validation. Convention, tourist, and office traffic. The location that makes national real estate conversations possible |
| **South Jordan (Daybreak / ballpark + business parks)** | T0 + 7mo | Fastest-growing household formation in the state, new entertainment anchor, weak incumbent Asian dining |
| **Provo (University Place)** | T0 + 10mo | 40K+ students, extremely high beef noodle soup affinity among international student population, proven high-velocity food court adjacency |
| **St. George** | T0 + 13mo | Tests the concept outside the Wasatch Front. Tourism-driven, Vegas-adjacent, validates transferability before national capital |

Portfolio revenue (base case):

| Year | Open locations | System revenue | Note |
|---|---|---|---|
| Y1 | 1 | ~$3.9M | Flagship only |
| Y2 | 1 → 5 | ~$9.4M | Four staggered openings, partial years |
| Y3 | 5 | ~$20.1M | First full year at five units |
| Y4 | 5 + 4 US metros | ~$32M | NYC, LA, Vegas, Seattle at higher AUV |
| Y5 | 9 corporate + international franchise | ~$52M system | Includes royalty and platform revenue |

### 5.9 Global phase (Year 4 to 6)

**Strong recommendation, and build the plan to argue it:** do not operate international locations corporately. Use master franchise and joint venture structures.

| Market | Structure | Rationale |
|---|---|---|
| New York City | Corporate | Flagship-equivalent brand statement. Highest AUV potential, ~$6.5M |
| Los Angeles | Corporate | Largest Taiwanese-American population in the US. Home-market authenticity credibility |
| Las Vegas | Corporate or JV | 24-hour daypart, tourist volume, Utah operational proximity |
| Seattle | Corporate | Tech-forward audience, strong Asian dining market, PNW brand halo |
| **Taipei** | Master franchise | The homeland test. Winning here is the single most powerful brand asset we could own. Also the highest-difficulty market |
| **Tokyo** | Master franchise / JV | Ichiran's home. Our pod concept reads as native, not novel. Operationally the most compatible market on earth |
| **London** | Master franchise | English-language ops, mature Asian casual-dining market, gateway to EU |
| **Paris** | Sub-franchise under London MFA | Regulatory and labor complexity argues against a standalone entity |
| **Singapore** | Master franchise | Highest per-capita dining spend in Asia, exceptional operator pool, regional HQ candidate |
| **Melbourne** | Master franchise | Strong Asian dining culture, counter-seasonal to Northern Hemisphere |

Franchise economics to model in `platform.ts`:
- Master franchise territory fee: $250K to $750K depending on market
- Unit franchise fee: $55K
- Royalty: 5% of gross revenue
- National marketing fund: 2%
- **Oh! OS platform license: $1,800 per location per month** (this is the SaaS line, and it is the highest-multiple revenue in the business)

### 5.10 Oh! OS as a second business unit

Give the platform its own P&L section in the plan. This is the argument that moves the valuation from a restaurant multiple (4 to 6x EBITDA) toward a hybrid multiple.

- Revenue: internal transfer from corporate locations + license fees from franchisees + eventual third-party licensing to non-competing concepts
- Gross margin: 80%+
- Y5 platform revenue at 40 system locations: ~$865K ARR, growing with every unit opened by someone else's capital
- Frame explicitly: *we are building the operating system for zero-front-of-house dining, and the restaurants are both the proof and the first customer*

### 5.11 Capital stack

**Round 1: $3.2M** (flagship + platform + corporate)
| Source | Amount | Terms |
|---|---|---|
| SBA 7(a) via America First CU | $1.5M | 10-yr, equipment + buildout collateral, personal guarantee |
| Equity (partner + angels) | $1.5M | Priced round, terms per current negotiation |
| Founder contribution + equipment financing | $200K | |

**Round 2: $9M to $11M** (locations 2 through 5 + corporate infrastructure), raised at T0 + 3mo once the flagship shows 90 days of real data. Blend of Series A equity, SBA against new units, and equipment lease-back.

Build the cap table and dilution module to accept valuation as an input rather than asserting one. Valuation is a negotiation, and the plan should not anchor against Dano.

**Model DSCR explicitly.** Lenders need debt service coverage above 1.25x. At base case flagship EBITDA of $1.29M against roughly $200K annual debt service, DSCR is ~6.4x. At conservative case ($2.82M revenue, ~$610K EBITDA), DSCR is ~3.0x. Both clear comfortably, and showing the conservative case clearing is the entire lender conversation. Surface this as a dedicated gauge in the Financials module.

> All figures in this spec are modeling assumptions for the interactive plan, not validated forecasts. Every number gets reviewed with the CPA and with America First before it goes in front of a lender. Build the engine so a single assumptions file change propagates everywhere, because these will change.

---

## 6. The Eleven Interactive Modules

Build in this priority order. Each is a route segment under `/plan`, registered in a central `SECTIONS` array with `{ key, order, titleKey, icon, audiences[], component }` so the nav, progress bar, print route, and analytics all derive from one source.

### 6.1 The Model (build first, everything else references it)

The centerpiece. A full-bleed interactive P&L where the investor becomes a participant.

- Scenario selector: Conservative / Base / Aggressive, plus "Custom"
- Live sliders: utilization, average check, food cost %, rent per sq ft, pods, labor count, dwell time
- Real-time recalculation: revenue, EBITDA, EBITDA margin, payback period, DSCR, break-even covers per day
- Waterfall chart from revenue down to EBITDA
- Side-by-side traditional restaurant comparison, always visible
- "Reset to base" and a **"Share my scenario"** button that encodes assumptions into a URL param and logs it as an interaction. When an investor builds their own bear case and sends it back, we have learned exactly what they are worried about.
- Mobile: sliders become a bottom sheet, results stay pinned to the top

### 6.2 The Floor Plan

An interactive, top-down 3,500 sq ft flagship layout with all 75 pods.

- SVG-based, zoomable, pannable
- Hover or tap any pod for its number, type (single / convertible duo), and position
- Toggle layers: pods, kitchen, sliding-panel delivery corridors, back of house, restrooms, entry and kiosk zone
- Animated "order journey" mode: play a 45-second sequence tracing one order from kiosk to pod arrival to sliding panel delivery, with timing annotations
- Square-footage breakdown panel: dining ~1,575 sf, kitchen ~1,100 sf, BOH and storage ~475 sf, restrooms and circulation ~350 sf
- **Honesty note to render in the UI:** 75 pods in 3,500 sf is tight. Roughly 21 sf per pod including circulation. State this, then show that the pod format is precisely what makes it work, because we are not seating parties at tables with chair pull-out clearance. Turning the tightest constraint into the clearest proof point is the move.

### 6.3 The Expansion Engine

A map with a time scrubber. Drag through months and watch the system light up.

- Phase 1: Utah map, five pins, each opening as the scrubber crosses its month
- Phase 2: US map, four metros
- Phase 3: world map, six international markets with structure labels (corporate / master franchise / JV)
- Running counters that update with the scrubber: locations open, system revenue run-rate, pods in service, covers served to date
- Click any pin for a market card: population, target trade area, daytime density, competitive notes, structure, target AUV
- Mobile: vertical timeline with a sticky map, not a scrubber

### 6.4 Unit Economics Builder

"Model your own location." Pick a market, adjust rent and check, see the pro-forma. Lets a landlord model their own space and lets an investor stress the assumptions on a market they know.

### 6.5 Sensitivity and Risk

- Tornado chart ranking every assumption by EBITDA impact
- Two-variable heat grid (utilization × average check) with break-even contour drawn
- Monte Carlo: 10,000 runs with distributions on the top five levers, outputting a probability distribution of Year 3 EBITDA. Run in a Web Worker so the UI never blocks.
- Named downside scenarios with mitigations: slow ramp, rent inflation, beef commodity spike, a well-capitalized copycat, pod hardware reliability, a Utah-specific labor or permitting shock

### 6.6 The Experience

The emotional core. Scroll-driven narrative of a single customer's visit, arrival through last bite. Real photography, the calligraphic mark, generous whitespace, minimal copy. Embeds the existing kiosk demo at `ohbeef.com/kiosk` in a device frame. This is the section that makes someone *want* it to succeed, which is what actually closes a round.

### 6.7 Market Analysis

- TAM / SAM / SOM with an interactive nested visualization. Per our established position: **anchor SOM at a deliberately small share of TAM and say so on purpose.** A modest SOM is a strength in a lender room, not a weakness. Build a callout that makes that argument explicitly.
- Utah market data: population growth, Silicon Slopes daytime employment, household income by trade area, Asian dining spend
- Competitive matrix, positioned on axes of experience quality × operational efficiency, with Oh! in the empty upper-right quadrant
- Category tailwinds: Asian fast-casual growth, solo dining normalization, labor cost pressure driving automation adoption

### 6.8 Operations and Technology

- The platform architecture diagram (Next.js / Fastify / Prisma / Postgres / Stripe / Clerk), rendered for a non-technical reader
- Pod lifecycle: AVAILABLE → RESERVED → OCCUPIED → CLEANING, animated
- Kitchen display system screenshot or live demo with add-on color coding
- Labor model breakdown: exactly who works here and what they do, hour by hour
- Supply chain and commissary strategy for multi-unit broth consistency, which is the single biggest operational risk in scaling this concept and should be addressed head-on
- Food safety, HACCP, and the Utah County Health Department pathway

### 6.9 Team and Governance

- Dano: 25+ years global IT leadership, Senior Director of Commerce and Global eCommerce at dōTERRA, scaled commerce through $750M to $2.5B+ hypergrowth across 50+ international markets, bilingual English and Mandarin, lived in Taiwan, Russia, Japan. The international expansion thesis is not aspirational for this founder, it is resume.
- Kristy: co-founder, 51% member
- Entity: Oh! Beef Noodle Soup, LLC, Utah, EIN on file, Articles filed 12/22/2025, effective 01/01/2026
- Advisory board gaps we are actively filling: multi-unit restaurant operator, culinary director, franchise development counsel
- Hiring plan by phase, with the key hire flagged as a Director of Operations before location three

### 6.10 Funding and Use of Funds

- Interactive use-of-funds sunburst
- Capital stack visualization with the SBA / equity / equipment split
- Dilution modeler with valuation as an input
- Milestone-based tranching proposal
- DSCR gauge (lender view defaults to this section open)
- Investor returns model: exit scenarios at restaurant multiple vs hybrid platform multiple, with the delta between them made visually obvious

### 6.11 Roadmap and Milestones

Interactive Gantt from today through Year 5, filterable by workstream (real estate, buildout, legal and permits, technology, capital, hiring). Pull real items from `Post_Formation_Checklist.pdf`: EIN complete, operating agreement signed, Utah TAP registration, Lehi business license, food service license, fire marshal, certificate of occupancy. Show completed items checked. Momentum is persuasive.

---

## 7. Technical Requirements

### 7.1 Stack constraints (non-negotiable, from `CLAUDE.md`)

- Next.js 16 App Router, React 19, TypeScript strict, **no `any`, ever**
- Server components by default. Client components only where interactivity demands it, and keep them leaf-level so the heavy modules do not drag the whole page client-side.
- Tailwind only. No CSS files. Exception: a single `print.css` for the PDF route, which is genuinely easier that way. Justify it in a comment.
- Mobile-first. Assume an investor opens this on a phone in an airport, because one will.
- Multi-tenant pattern does not apply here (see 4.2 note)

### 7.2 Libraries

- `recharts` for standard charts (already available)
- `d3-geo` + `topojson-client` for the expansion maps. Do not pull all of d3.
- `framer-motion` for scroll and transitions
- `jose` for JWT
- `@react-pdf/renderer` **or** Playwright-driven print-to-PDF for export. Prefer the print route plus Playwright: one rendering path, less drift.
- Vitest for the model tests

### 7.3 Performance budget

- LCP under 2.0s on 4G mobile
- Model recalculation under 16ms (it is arithmetic, it should be instant)
- Monte Carlo in a Web Worker, never on the main thread
- Lazy-load map topojson and the floor plan SVG
- Images: `next/image`, AVIF, explicit sizes

### 7.4 i18n

All copy through `next-intl` under a `plan.*` namespace in `apps/web/messages/{locale}.json`. **Never hardcode a user-facing string.**

**Recommendation on scope:** ship `en` complete and `zh-TW` complete. Stub `zh-CN` and `es` with the English fallback and a locale switcher that hides incomplete languages rather than showing half-translated financials. A Taipei master-franchise conversation in Traditional Chinese is worth building for. A half-Spanish P&L is worth nothing and actively damages credibility. Translating financial and legal language badly is worse than not translating it.

Number and currency formatting must be locale-aware via `Intl.NumberFormat`, with a currency toggle (USD / TWD / JPY / GBP / EUR / SGD / AUD) for the international sections. Use fixed illustrative conversion rates stored in the assumptions file with a visible "rates as of" date, not a live FX API. A stale live rate is worse than an honest static one.

### 7.5 Print and PDF

`/[locale]/plan/print` renders every allowed section flat, paginated, no interactivity, light theme on `oh.paper`. Charts render as static SVG at print resolution. Include a cover page, table of contents with page numbers, and a footer with the access code label and generation date on every page, so a lender's photocopy is still traceable.

SBA loan officers will print this. Make the printed artifact genuinely good, not an afterthought.

### 7.6 Accessibility

- WCAG 2.1 AA minimum. Contrast on `ash` over `charcoal` needs checking, it may fail; darken the background or lighten the text.
- Every chart needs a data table alternative, toggleable
- Full keyboard navigation including the floor plan and map
- `prefers-reduced-motion` honored everywhere
- Sliders: proper `role="slider"`, `aria-valuenow`, `aria-valuetext` with the formatted value

### 7.7 Security

- All plan routes `noindex, nofollow` via metadata and `robots.txt`
- No plan content in the public sitemap
- Financial data fetched server-side only. Do not ship the full assumption set to the client for sections the code is not allowed to see.
- Section allowlist enforced **server-side**, not by hiding nav items
- Never log raw access codes. Never log raw IPs.
- Add `PLAN_JWT_SECRET` and friends to Vercel env for preview and production, and confirm they are not in the repo

---

## 8. File Layout

```
apps/web/
├── app/[locale]/plan/
│   ├── layout.tsx                    # shell, nav, progress, analytics beacon
│   ├── page.tsx                      # executive summary / entry
│   ├── gate/page.tsx
│   ├── print/page.tsx
│   ├── model/page.tsx
│   ├── experience/page.tsx
│   ├── market/page.tsx
│   ├── floor-plan/page.tsx
│   ├── operations/page.tsx
│   ├── expansion/page.tsx
│   ├── unit-economics/page.tsx
│   ├── financials/page.tsx
│   ├── sensitivity/page.tsx
│   ├── team/page.tsx
│   ├── funding/page.tsx
│   └── roadmap/page.tsx
├── app/api/plan/
│   ├── auth/route.ts
│   ├── heartbeat/route.ts            # section dwell tracking
│   └── question/route.ts
├── components/plan/
│   ├── shell/                        # PlanNav, ProgressRail, SectionHeader, AudienceBadge
│   ├── charts/                       # Waterfall, Tornado, HeatGrid, RampCurve, StackedPL
│   ├── controls/                     # AssumptionSlider, ScenarioToggle, CurrencyToggle
│   ├── modules/                      # one folder per section from §6
│   └── primitives/                   # StatCard, BenchmarkCallout, DataTableToggle, CountUp
├── lib/plan/
│   ├── session.ts                    # JWT sign/verify
│   ├── analytics.ts                  # beacon client
│   └── sections.ts                   # SECTIONS registry (single source of truth)
└── messages/{en,zh-TW,zh-CN,es}.json # plan.* namespace

packages/plan-model/                  # see §5.2

apps/admin/app/plan-access/
├── page.tsx
└── [codeId]/page.tsx

docs/
├── OH_BUSINESS_PLAN_BUILD_SPEC.md    # this file
└── PHOTO_NEEDS.md                    # generated punch list
```

---

## 9. Build Phases

| Phase | Scope | Definition of done |
|---|---|---|
| 1 | Access control | Code issued from admin, gate works, session tracked, revoke works, rate limit tested |
| 2 | `@oh/plan-model` | All three scenarios produce the §5 numbers, 100% test coverage, zero `any` |
| 3 | Shell | Nav, progress rail, section registry, print route skeleton, analytics beacon firing |
| 4a | The Model | Fully interactive, share-scenario URL working, mobile bottom sheet |
| 4b | Floor Plan + Expansion Engine | |
| 4c | Financials + Funding + Sensitivity | |
| 4d | Experience + Market + Operations + Team + Roadmap | |
| 5 | Polish | i18n extraction, a11y audit, Lighthouse 95+, PDF export, `DECISIONS.md` updated |

Stop for review after each phase. Do not build ahead.

---

## 10. Reference Data (carry into the build)

**Entity:** Oh! Beef Noodle Soup, LLC
**Utah Entity Number:** 14642519-0160
**EIN:** on file (do not render in the app; reference only)
**Filed:** 12/22/2025, effective 01/01/2026
**Principal office:** 379 W 3175 N, Lehi, UT 84043
**Structure:** Member-managed. Dano Deen Didericksen 49%, Kristy Kay Didericksen 51%
**Primary domain:** ohbeef.com (Vercel). Six additional TLDs redirect.

**Note for the Team and Governance section:** the Articles of Organization and the two Operating Agreement versions in the project folder disagree (one is two-member 49/51, one is single-member 100%). Resolve which is operative before this goes to a lender, and render the operative structure only. Flag this in the build output so it is not forgotten.

**Product foundation:** beef shank (金錢腱) as the essential cut, 185 to 195°F braise, cool-in-broth overnight before slicing. Two-phase broth: long bone simmer plus flavor-building finish. Production tested in a Vulcan 12-gallon steam-jacketed kettle. Positioning is **premium fusion interpretation**, not traditional-authenticity claim. Do not let the copy drift into authenticity language, it is the wrong fight and we will lose it to a grandmother in Taipei.

**Business rules already locked:** no tipping (prices 15 to 20% higher, staff salaried), $5/$5 referral credits with 1st and 16th disbursement, flexible menu pricing (first free / extras priced), tiers CHOPSTICK → NOODLE_MASTER → BEEF_BOSS, sliding panel delivery, no front-of-house interaction.

**Reference concepts:** Ichiran (pod format), Crumbl (Utah multi-unit growth benchmark). Cite both in the Market section. Crumbl is especially useful because it proves a Utah-founded concept can scale nationally at speed, and the local lenders and investors all know the story.

---

## 11. What Makes This Different (hold the line on these)

Most business plans are a PDF that gets skimmed once. Five things make this one land:

1. **The investor manipulates the model instead of reading it.** Trust comes from letting someone break your assumptions themselves.
2. **We show the ugly parts on purpose.** The month-4 ramp trough. The $1,200/sq ft benchmark reality check. The tight 21 sf per pod. The commissary consistency risk. Every disclosed weakness buys credibility on the strengths.
3. **The plan is live.** Once the flagship opens, wire the same route to real admin analytics. The business plan becomes the investor update, and nobody else's does that.
4. **We know who read what.** Per-recipient codes plus dwell analytics turn a document into an intelligence-gathering instrument.
5. **The artifact proves the thesis.** A restaurant that claims to be a technology company, whose business plan is a working application. The medium is the message.

---

*Build it like the restaurant: quiet, precise, and better than it needs to be.*
