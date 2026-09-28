# Customer Website Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer site at www.ohbeef.com as a mobile-first, fully translated, richly interactive experience that matches the business plan. It includes a real membership program, a Chappy that can safely order and resolve issues, and bookable comb-layout seating at both locations.

**Architecture:**
- **Backend first.** Domain logic moves out of the 14.9k-line `packages/api/src/index.js` into focused modules: `membership/`, `orders/service.js`, `support/`, `auth/customer.js` and `chappy/`. Each is registered as a Fastify plugin with injected dependencies (the `registerPlanRoutes(app, { prisma, ... })` pattern), so tests run with `fastify.inject()` and a Prisma stub.
- **Shared geometry.** `packages/floor-plan` serves the business plan, the site, the kiosk and admin.
- **Frontend.** The web app gets a site design system (`components/site/*`) built on the plan's Tailwind tokens. Every customer page is rebuilt on it, and translation and emoji guards fail the tests.

**Tech Stack:**
- Next.js 16.1 and React 19.2, with next-intl 4 (en, zh-TW, zh-CN, es).
- Tailwind v4 (unlayered utilities, no preflight), framer-motion 13, three 0.186 / r3f 9 (lazy).
- Fastify 4, Prisma, Postgres.
- Stripe (Payment Element and Express Checkout), Clerk (`@clerk/backend` 2).
- `@anthropic-ai/sdk` with `claude-opus-5`.
- Tests: vitest 5 (web, floor-plan), `node:test` (api), Playwright (e2e), `sharp` (image pipeline).

**Spec:** `docs/superpowers/specs/2026-09-27-customer-site-overhaul-design.md`

## Global Constraints

- **Mobile-first:** design at 390x844 first, then 1440. Minimum 44px touch targets, 16px input text, `svh` units and safe-area insets.
- **No emoji:** no emoji codepoints anywhere in `apps/web/{app,components,lib,messages}`, `packages/api/src` or `packages/db/prisma/seed*`. Icons are in-house SVG only, with no icon libraries.
- **Copy:** no em dashes (U+2014) in user-facing copy, and none in `messages/*.json`. Plan voice: short, declarative, calm.
- **Translations:** every user-visible string goes through next-intl. All 4 locale files have identical key sets. Database copy has per-locale fields.
- **Palette:** tokens come only from `--color-oh-*`. linen is `#EDE6DA` (new). ember-deep `#A94422` is for filled buttons with cream text.
- **Performance:** under 170 KB of gzipped JS per customer route. LCP under 2.5 s on throttled 4G, measured on a mid-range phone profile. three.js loads only via `next/dynamic` on user action.
- **Money:**
  - Chappy never moves money without a human tap.
  - Goodwill grants are `CreditLot` rows only: $5 per order, $10 per rolling 30 days, $45 lifetime, all in config.
  - Staff can approve credit or a full-order card refund, never partial.
- **Payments:** PAID only after server-verified Stripe PaymentIntent (`succeeded`, amount matches `quoteOrder`, `metadata.orderId` matches), or a server-verified zero balance. Idempotent.
- **Membership config:**
  - Tiers are CHOPSTICK, then NOODLE_MASTER (10 orders + 2 referrals), then BEEF_BOSS (25 + 5 after the reset). Cashback 1/2/3%.
  - Referral $5 + $5, capped at 10 per rolling 30 days. Credits expire after 90 days.
  - Free bowl on each upgrade. One premium add-on per quarter at Beef Boss.
  - Early access 8 / 4 / 1 days before `releaseAt`. Queue priority +25/+50.
- **Seating:** City Creek has 75 comb pods with `mirror: false`. University Place has 70 with `mirror: true`, the front pod trimmed from 5 of 6 rows, and 5 duos kept. Seat labels look like `B-07` (finger letter A/B/C, then the 2-digit position from the kitchen).
- **Model:** `claude-opus-5`, `thinking: {type:"adaptive"}`, `output_config.effort:"medium"`, `betas:["server-side-fallback-2026-07-01"]` with `fallbacks:"default"`. At most 6 tool rounds. `strict: true` tools. Check `stop_reason` before reading content.
- **Git:** stage explicit paths only, never `git add -A` (another session may share the checkout). Each commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Dev only; no prod deploy until the owner says so.
- **Plan status demo (merged in 2612145 by another session; must keep working):**
  - The business plan embeds `/{locale}/order/status?embed=1&demoSync=parent` in `components/plan/primitives/PhoneFrame.tsx`.
  - `?embed=1` sets `x-embed`, and the locale layout then drops the header, footer and chat.
  - `DEMO-*` / `demo-*` orders are synthetic, from `packages/api/src/demo/status-demo.js` (`withStatusDemo()`), and a deny-by-default preHandler returns 409 on writes naming a demo order.
  - Chappy handlers use `basePrisma`.
  - `JOURNEY_POD` must stay pod 32.
  - Any task touching the status page, the shell, order routes, Chappy or the geometry must keep these, and a test pins them (see D6, C4, A6, B2, A1).
- **Dev environment:**
  - The API runs `node --watch` on :4000 (never stack instances). Web runs on :3000 with `NODE_OPTIONS=--max-old-space-size=4096`.
  - Dev uses the local Postgres (127.0.0.1). Keep `PLAN_VISIT_SUMMARIES=off`.
  - The Playwright MCP doesn't work here; use node scripts with `chromium.launch({args:["--no-sandbox"]})`.

## Review Focus

Five input classes or failure modes that aren't obvious from the spec, most likely first. Each has a pinned test in its owning task.

1. **Two people take the same pod at once.** When two checkouts pick or auto-assign the same pod, exactly one gets it and the other gets the next best pod, never a double booking. Pinned in Task A6 with a conditional `updateMany` test.
2. **Stripe return and webhook both fire.** When the 3DS or redirect return page and the webhook both confirm, the order is marked PAID once: one cashback, one streak increment, one confirmation. Pinned in Task A6 (idempotent `markPaid`).
3. **Credit expires between quote and pay.** A lot that expires after the quote but before payment must not be spent. The quote is re-validated inside `markPaid`, and a short balance fails with a clear, translated error rather than a negative balance. Pinned in Task A4 and Task A6.
4. **America/Denver time edges.** Arrival slots near close, DST transitions, and quarter boundaries for the Beef Boss add-on and early-access windows are computed in `America/Denver`, not UTC. Pinned in Task A5 (quarter at 2026-12-31T23:30 MST) and Task A6 (slots on the DST fall-back day, 2026-11-01).
5. **Long Chinese and Spanish strings on a 390px screen.** Buttons, the dock and cards must wrap or truncate cleanly, never overflow horizontally. Pinned in Task G1 (horizontal-overflow assertion per route per locale).

---

## File structure (new or heavily changed)

```
packages/floor-plan/                 NEW  pure TS geometry (moved from apps/web/components/plan/modules/floor-plan/layout.ts)
  src/layout.ts                        buildLayout({pods,mirror}) + constants
  src/labels.ts                        seat label helpers (A-01)
  src/index.ts
  test/layout.test.ts
packages/db/prisma/migrations/20260928000000_site_overhaul/migration.sql   NEW additive
packages/db/scripts/seed-comb-seats.ts                                       NEW
packages/db/scripts/cutover-credit-lots.ts                                   NEW
packages/api/src/membership/program.js      NEW rules (single source)
packages/api/src/membership/credits.js      NEW CreditLot ledger
packages/api/src/membership/engine.js       NEW order-completed, referrals, rewards, early access
packages/api/src/membership/routes.js       NEW /membership/program, /users/:id/rewards
packages/api/src/orders/pricing.js          NEW pure pricing (extracted calculateItemPrice + tax)
packages/api/src/orders/service.js          NEW quote/create/markPaid/pickBestPod
packages/api/src/orders/routes.js           NEW POST /orders, /orders/:id/payment-intent, /orders/:id/confirm-payment
packages/api/src/support/caps.js            NEW goodwill caps
packages/api/src/support/routes.js          NEW /support/cases + /admin/support/*
packages/api/src/auth/customer.js           NEW Clerk session -> User, guest token
packages/api/src/chappy/agent.js            REWRITE
packages/api/src/chappy/tools.js            REWRITE (18 tools)
packages/api/src/chappy/prompts.js          REWRITE (frozen system + context block)
packages/api/src/chappy/routes.js           NEW (moves /chappy/* out of index.js)
apps/web/components/site/                   NEW design system
  tokens.css  fonts.ts  icons/  seal/  motion/  shell/  floor-plan/  chappy/  cards/
apps/web/lib/site/                          NEW hooks, api client, image map, guards
apps/web/app/[locale]/...                   customer pages rebuilt (see Phase D)
apps/admin/app/support/                     NEW Support tab
tests/e2e/site/*.spec.ts                    NEW Playwright mobile suite
scripts/site-images.mjs                     NEW sharp pipeline
```

---

## Phase 0: Setup

### Task 0: Worktree, docs, and test harness

**Files:**
- Create: `docs/superpowers/specs/2026-09-27-customer-site-overhaul-design.md` (spec section of this file)
- Create: `docs/superpowers/plans/2026-09-27-customer-site-overhaul.md` (plan section of this file)
- Modify: `apps/web/vitest.config.ts`

- [ ] **Step 1:** Create the worktree with superpowers:using-git-worktrees. Name the branch `site-overhaul`, based on `main` (`2612145` or later). Re-check `git log` first, because another session may have committed.
- [ ] **Step 2:** Copy the spec and plan sections of this file into the two docs paths above.
- [ ] **Step 3:** Widen the vitest include so the site tests run:

```ts
// apps/web/vitest.config.ts
test: {
  include: ["lib/**/__tests__/**/*.test.ts", "components/site/**/__tests__/**/*.test.{ts,tsx}"],
  environment: "node",
},
```

- [ ] **Step 4:** Run the baseline suites and record the counts in the commit message:
  - `pnpm --filter @oh/web test`
  - `pnpm --filter @oh/api test`
  - `pnpm --filter @oh/plan-model test`

  Expected: all PASS.
- [ ] **Step 5:** Save the mobile-first memory file to `~/.claude/projects/-home-claude-user-projects-oh-platform/memory/mobile-first-site.md`, type feedback, and add it to `MEMORY.md`.
- [ ] **Step 6:** Commit:

```bash
git add docs/superpowers/specs/2026-09-27-customer-site-overhaul-design.md docs/superpowers/plans/2026-09-27-customer-site-overhaul.md apps/web/vitest.config.ts
git commit -m "docs: customer site overhaul spec and plan; widen web test include"
```

---

## Phase A: Backend foundations

### Task A1: `packages/floor-plan` with `buildLayout({ pods, mirror })`

**Files:**
- Create: `packages/floor-plan/package.json`, `packages/floor-plan/tsconfig.json`, `packages/floor-plan/src/{layout.ts,labels.ts,index.ts}`, `packages/floor-plan/test/layout.test.ts`, `packages/floor-plan/test/__snapshots__/`
- Modify: `apps/web/components/plan/modules/floor-plan/layout.ts` (becomes a re-export shim of the default layout), `apps/web/package.json` (add `"@oh/floor-plan": "workspace:*"`), `apps/web/next.config.*` (`transpilePackages` gains `@oh/floor-plan` if `@oh/plan-model` is listed there)
- Modify, for west/east from data: `FloorPlanSvg.tsx:348,381,392-393,465-476`, `three/Pods.tsx:25,33`, `three/Walls.tsx:41`, `three/useIsoCamera.ts:29`
- Test: `packages/floor-plan/test/layout.test.ts`. The existing `apps/web/lib/plan/__tests__/floor-plan-layout.test.ts` must stay green, unchanged.

**Interfaces:**
- Produces:

```ts
export interface LayoutOptions { pods: number; mirror: boolean }
export interface Layout {
  options: LayoutOptions;
  building: { w: 70; h: 50 };
  zones: readonly Zone[]; fingers: readonly Finger[]; staffCorridors: readonly StaffCorridor[];
  guestAisles: readonly GuestAisle[]; crossAisle: Rect; pass: Rect; kiosks: readonly Rect[];
  walls: readonly Wall[]; doors: readonly Door[]; openings: readonly Opening[];
  rows: readonly Row[]; pods: readonly Pod[]; duoPairs: readonly [number, number][];
  areas: readonly AreaLine[]; totalSqft: number; territoryTotals: Record<Territory, number>;
  diningSqftPerPod: number; shellFacts: typeof SHELL_FACTS;
  journeyTarget: Pod; guestPath: readonly Point[]; guestExitPath: readonly Point[];
  bowlPath: readonly Point[]; dirtyPath: readonly Point[];
  territory(p: Point): Territory | null;
  journeyMarkers(progress: number): JourneyMarkers;
}
export function buildLayout(opts?: Partial<LayoutOptions>): Layout; // default {pods:75, mirror:false}
export const LOCATION_LAYOUTS: Record<"comb-75" | "comb-70-mirrored", LayoutOptions>;
export function podLabel(pod: Pod): string;            // "B-07"
export function parsePodLabel(label: string): { finger: 1|2|3; position: number } | null;
```

  - `Pod` gains `side: Side` (already on `Row`), `finger: FingerIndex`, `position: number` (1-based, counted from the kitchen) and `label: string`.
  - `Row` keeps `side`. The `hatch` and `facing` fields are derived from `side` after mirroring.
- Consumes: `BASE_ASSUMPTIONS.pods` from `@oh/plan-model` (default only).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/floor-plan/test/layout.test.ts
import { describe, expect, it } from "vitest";
import { buildLayout, LOCATION_LAYOUTS, podLabel, parsePodLabel } from "../src";

const overlaps = (a: {x:number;y:number;w:number;h:number}, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("buildLayout", () => {
  it("default equals the plan layout byte for byte", () => {
    expect(JSON.stringify(buildLayout())).toMatchSnapshot();
  });
  it("City Creek: 75 pods, unmirrored, rows 13/12 per finger", () => {
    const l = buildLayout(LOCATION_LAYOUTS["comb-75"]);
    expect(l.pods).toHaveLength(75);
    expect(l.rows.map((r) => r.capacity)).toEqual([13, 12, 13, 12, 13, 12]);
    expect(l.duoPairs).toHaveLength(5);
  });
  it("University Place: 70 pods, front pod trimmed from 5 of 6 rows, 5 duos kept", () => {
    const l = buildLayout(LOCATION_LAYOUTS["comb-70-mirrored"]);
    expect(l.pods).toHaveLength(70);
    const perRow = l.rows.map((r) => l.pods.filter((p) => p.row === r.key).length);
    expect(perRow).toEqual([12, 11, 12, 11, 12, 12]);
    expect(l.duoPairs).toHaveLength(5);
  });
  it("mirror reflects every rect across x = 35 and swaps sides", () => {
    const a = buildLayout({ pods: 75, mirror: false });
    const b = buildLayout({ pods: 75, mirror: true });
    a.pods.forEach((p, i) => {
      const q = b.pods[i]!;
      expect(q.x).toBeCloseTo(70 - p.x - p.w, 9);
      expect(q.y).toBeCloseTo(p.y, 9);
      expect(q.side).toBe(p.side === "west" ? "east" : "west");
    });
    const store = (l: typeof a) => l.zones.find((z) => z.key === "store")!;
    expect(store(b).x).toBeCloseTo(70 - store(a).x - store(a).w, 9);
  });
  it.each([["comb-75"], ["comb-70-mirrored"]] as const)("%s: no pod overlaps, areas sum to 3,500, paths stay in their territory", (key) => {
    const l = buildLayout(LOCATION_LAYOUTS[key]);
    for (let i = 0; i < l.pods.length; i++) for (let j = i + 1; j < l.pods.length; j++) expect(overlaps(l.pods[i]!, l.pods[j]!)).toBe(false);
    expect(l.totalSqft).toBeCloseTo(3500, 6);
    for (const p of l.guestPath) expect(l.territory(p)).not.toBe("staff");
    for (const p of l.bowlPath) expect(l.territory(p)).not.toBe("guest");
  });
  it("plan journey still targets pod 32 (plan status demo copy depends on it)", () => {
    expect(buildLayout().journeyTarget.number).toBe(32);
  });
  it("labels are finger letter + 2-digit position and round-trip", () => {
    const l = buildLayout(LOCATION_LAYOUTS["comb-75"]);
    const labels = l.pods.map(podLabel);
    expect(new Set(labels).size).toBe(75);
    expect(labels[0]).toMatch(/^A-0[1-9]$/);
    for (const p of l.pods) expect(parsePodLabel(podLabel(p))).toEqual({ finger: p.finger, position: p.position });
    expect(parsePodLabel("Z-99")).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `pnpm --filter @oh/floor-plan test`. Expected: FAIL (module not found).
- [ ] **Step 3: Move the geometry**
  - Copy `layout.ts` to `packages/floor-plan/src/layout.ts` and wrap every module-level derived constant (`ROWS`, `PODS`, `AREAS`, the paths, `SHELL_FACTS`, `territory`, `journeyMarkers`) in `buildLayout`.
  - Mirror at the end, in data, with `const mx = (r: Rect): Rect => ({ ...r, x: BUILDING.w - r.x - r.w })`:
    - Points map `[x, y]` to `[BUILDING.w - x, y]`.
    - `side` swaps with `const flip = (s: Side): Side => (s === "west" ? "east" : "west")`.
    - Door and opening swing directions swap the same way.
  - Trim rule for pod counts under 75: build the full 75, then remove the front-most pod (largest `y`) of rows in the order `f1e, f2e, f1w, f2w, f3w, f3e` until the count is reached, skipping any pod that belongs to a duo. For 70 this removes one pod from each of the first five rows. Throw `RangeError` for counts under 60 or over 75.
  - Keep `generatePods(count)` exported for the plan test that uses it.
  - Package setup: `package.json` gets `"name": "@oh/floor-plan"`, `"type": "module"`, `"exports": {".": "./src/index.ts"}`, `"scripts": {"test": "vitest run"}`, and the devDependencies `vitest` and `typescript`, copying `packages/plan-model/package.json`.
- [ ] **Step 4:** Turn the web file into a shim: `export * from "@oh/floor-plan"; export const { pods: PODS, rows: ROWS, ... } = buildLayout();` Keep every name the existing test imports, and replace the four west/east consumers with `pod.side` / `row.side`.
- [ ] **Step 5:** Run `pnpm --filter @oh/floor-plan test -- -u` once to write the snapshot. Then run it again without `-u`, plus `pnpm --filter @oh/web test` and `pnpm --filter @oh/web typecheck:plan`. Expected: all PASS, and the existing plan tests are untouched.
- [ ] **Step 6:** Check `/en/plan/floor-plan` in the browser (plan code `OH-PEPPER-7871`) and confirm it looks identical in 2D, territory and 3D.
- [ ] **Step 7:** Commit with `feat(floor-plan): shared buildLayout with mirror and pod count`.

### Task A2: Additive database migration

**Files:**
- Create: `packages/db/prisma/migrations/20260928000000_site_overhaul/migration.sql`
- Modify: `packages/db/prisma/schema.prisma`

**Interfaces (produced, Prisma):**

```prisma
model Location { /* + */ layoutKey String? layoutMirror Boolean @default(false) podCount Int? slug String? @unique i18n Json? }
model Seat { /* + */ finger Int? rowSide String? position Int? label String? retiredAt DateTime?
             /* side/row/col keep defaults; stop writing them for comb seats */ @@index([locationId, retiredAt]) }
model MenuItem { /* + */ releaseAt DateTime? }
model Badge { /* + */ iconKey String? i18n Json? }       // iconEmoji kept nullable for rollback, unused
model Challenge { /* + */ iconKey String? i18n Json? }
model User { /* + */ locale String? welcomeSeenAt DateTime? lastTierCelebrated MembershipTier? }
enum CreditLotSource { CASHBACK REFERRAL WELCOME GOODWILL CHALLENGE ADMIN LEGACY }
model CreditLot { id String @id @default(cuid()) userId String user User @relation(fields:[userId], references:[id])
  source CreditLotSource amountCents Int remainingCents Int expiresAt DateTime orderId String? note String?
  createdAt DateTime @default(now()) @@index([userId, expiresAt]) }
enum RewardType { FREE_BOWL PREMIUM_ADDON }
model Reward { id String @id @default(cuid()) userId String user User @relation(fields:[userId], references:[id])
  type RewardType issuedFor String windowEndsAt DateTime redeemedOrderId String? redeemedAt DateTime?
  createdAt DateTime @default(now()) @@unique([userId, type, issuedFor]) }
enum SupportCaseType { POD_ISSUE ORDER_ISSUE REFUND_REQUEST GENERAL CONTACT }
enum SupportCaseStatus { OPEN RESOLVED DECLINED }
enum SupportResolution { GOODWILL_CREDIT STAFF_CREDIT FULL_REFUND DECLINED INFO }
model SupportCase { id String @id @default(cuid()) userId String? orderId String? type SupportCaseType
  status SupportCaseStatus @default(OPEN) summary String transcript Json? contact Json? locale String?
  resolution SupportResolution? amountCents Int? resolvedBy String? resolvedAt DateTime? createdAt DateTime @default(now())
  @@index([status, createdAt]) }
```

  - Add `GOODWILL`, `WELCOME`, `REWARD_REDEEMED` and `REFUND_RESTORE` to `CreditEventType`.
  - Add the back-relations on `User`: `creditLots CreditLot[]`, `rewards Reward[]`.

- [ ] **Step 1:** Edit the schema. Generate the SQL with `pnpm --filter @oh/db exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, run against the local database. Hand-check that the SQL is additive only: `ADD COLUMN`, `CREATE TABLE`, `CREATE TYPE`, `ALTER TYPE ... ADD VALUE`. No `DROP` and no `NOT NULL` without a default.
- [ ] **Step 2:** Apply it locally with `psql "$DATABASE_URL" -f migration.sql`, then run `pnpm --filter @oh/db exec prisma generate`. Expected: success, and `\d "CreditLot"` shows the table.
- [ ] **Step 3:** Run `pnpm --filter @oh/api test`. Expected: PASS (no code uses the new models yet).
- [ ] **Step 4:** Commit with `feat(db): additive schema for site overhaul (layout, credit lots, rewards, support, i18n)`.

### Task A3: Membership rules (`program.js`)

**Files:**
- Create: `packages/api/src/membership/program.js`, `packages/api/src/membership/__tests__/program.test.js`

**Interfaces (produced):**

```js
export const PROGRAM = {
  tiers: [
    { key: "CHOPSTICK",     cashbackPct: 1, next: "NOODLE_MASTER", need: { orders: 10, referrals: 2 }, queueBoost: 0,  earlyAccessDays: 1 },
    { key: "NOODLE_MASTER", cashbackPct: 2, next: "BEEF_BOSS",     need: { orders: 25, referrals: 5 }, queueBoost: 25, earlyAccessDays: 4 },
    { key: "BEEF_BOSS",     cashbackPct: 3, next: null,            need: null,                         queueBoost: 50, earlyAccessDays: 8 },
  ],
  upgradeReward: "FREE_BOWL", upgradeRewardWindowDays: 30,
  quarterlyPerk: { tier: "BEEF_BOSS", type: "PREMIUM_ADDON" },
  referral: { referrerCents: 500, refereeCents: 500, maxPaidPer30Days: 10 },
  creditExpiryDays: 90, expiryWarningDays: 7,
  goodwill: { perOrderCents: 500, per30DaysCents: 1000, lifetimeCents: 4500, orderAgeHours: 24 },
  timezone: "America/Denver",
};
export function tierRule(tier) {}                 // -> tier object; throws on unknown
export function evaluateProgress(user) {}         // -> { tier, next, orders:{have,need}, referrals:{have,need}, ready:boolean }
export function publicProgram() {}                // JSON-safe copy for GET /membership/program (no goodwill caps)
```

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAM, tierRule, evaluateProgress, publicProgram } from "../program.js";

test("thresholds match the owner decision", () => {
  assert.deepEqual(tierRule("CHOPSTICK").need, { orders: 10, referrals: 2 });
  assert.deepEqual(tierRule("NOODLE_MASTER").need, { orders: 25, referrals: 5 });
  assert.equal(tierRule("BEEF_BOSS").next, null);
});
test("progress needs both counts", () => {
  assert.equal(evaluateProgress({ membershipTier: "CHOPSTICK", tierProgressOrders: 12, tierProgressReferrals: 1 }).ready, false);
  assert.equal(evaluateProgress({ membershipTier: "CHOPSTICK", tierProgressOrders: 10, tierProgressReferrals: 2 }).ready, true);
  assert.equal(evaluateProgress({ membershipTier: "BEEF_BOSS", tierProgressOrders: 99, tierProgressReferrals: 99 }).ready, false);
});
test("public program never exposes goodwill caps", () => {
  assert.equal("goodwill" in publicProgram(), false);
  assert.equal(publicProgram().tiers.length, 3);
});
test("unknown tier throws", () => assert.throws(() => tierRule("GOLD")));
```

- [ ] **Step 2:** Run `node --test packages/api/src/membership/__tests__/program.test.js`. Expected: FAIL (cannot find module).
- [ ] **Step 3:** Implement `program.js` exactly as the interface above. `evaluateProgress` reads `tierProgressOrders` and `tierProgressReferrals`. `publicProgram` is `const { goodwill, ...rest } = PROGRAM; return structuredClone(rest)`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(membership): single rules module`.

### Task A4: Credit lot ledger (`credits.js`)

**Files:**
- Create: `packages/api/src/membership/credits.js`, `packages/api/src/membership/__tests__/credits.test.js`
- Modify: `packages/api/src/plan/__tests__/helpers/prisma-stub.js`. Extend it, or add a new `packages/api/src/__tests__/helpers/prisma-memory.js` in-memory stub with `creditLot`, `creditEvent`, `user`, `reward`, `order`, `seat` and `supportCase` delegates plus `$transaction(fn)`.

**Interfaces (produced):**

```js
export async function grantCredit(prisma, { userId, source, amountCents, orderId = null, note = null, now = new Date() }) {}
// creates CreditLot (expiresAt = now + PROGRAM.creditExpiryDays), increments User.creditsCents, writes CreditEvent; returns lot
export async function availableCredit(prisma, userId, now = new Date()) {}   // sum remainingCents where expiresAt > now
export async function spendCredit(prisma, { userId, amountCents, orderId, now = new Date() }) {}
// soonest-expiring first; throws CreditShortError if available < amountCents; decrements lots + User.creditsCents in one $transaction
export async function expireLots(prisma, now = new Date()) {}                // zeroes expired lots, writes CREDIT_EXPIRED events; returns count
export async function expiringSoon(prisma, userId, now = new Date()) {}      // lots expiring within expiryWarningDays
export async function convertLegacyBalances(prisma, now = new Date()) {}     // cutover: one LEGACY lot per user with creditsCents>0 and no lots
export class CreditShortError extends Error { constructor(availableCents) {} }
```

- [ ] **Step 1: Write the failing tests.** Cover:
  - Grant, then spend: soonest-expiring lot first, across two lots.
  - Overspend throws `CreditShortError` and changes nothing.
  - **Review Focus 3:** a lot that expires 1 ms before the spend is not counted: `spendCredit` with `now` after `expiresAt` throws.
  - `expireLots` zeroes the lot and writes the event.
  - `convertLegacyBalances` is idempotent when run twice.

```js
test("spend skips a lot that expired between quote and pay", async () => {
  const prisma = makeMemoryPrisma({ users: [{ id: "u1", creditsCents: 0 }] });
  const t0 = new Date("2026-10-01T12:00:00-06:00");
  await grantCredit(prisma, { userId: "u1", source: "CASHBACK", amountCents: 300, now: new Date(t0.getTime() - 90 * 864e5) });
  await assert.rejects(() => spendCredit(prisma, { userId: "u1", amountCents: 300, orderId: "o1", now: new Date(t0.getTime() + 1) }), CreditShortError);
  assert.equal((await prisma.user.findUnique({ where: { id: "u1" } })).creditsCents, 300); // untouched until expireLots runs
});
```

- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `spendCredit` runs inside `prisma.$transaction(async (tx) => ...)`: read the lots `where: { userId, remainingCents: { gt: 0 }, expiresAt: { gt: now } }` ordered by `expiresAt asc`, decrement them, then `tx.user.update({ creditsCents: { decrement } })` and a `CREDIT_APPLIED` event.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(membership): credit lots with 90-day expiry`.

### Task A5: Membership engine (cashback, tiers, referrals, rewards, early access)

**Files:**
- Create: `packages/api/src/membership/engine.js`, `packages/api/src/membership/routes.js`, `packages/api/src/membership/__tests__/engine.test.js`, `packages/api/src/membership/__tests__/routes.test.js`
- Modify: `packages/api/src/index.js`:
  - Delete `getTierBenefits` / `getNextTier` / `checkTierUpgrade` (around 6796-6900) and route their callers to the engine.
  - Delete `/cron/disburse-credits` (5973) and its scheduling.
  - The referral credit block at 6586 moves into the engine.
  - Register `registerMembershipRoutes(app, { prisma })`.
- Modify: `packages/api/src/cron/wallet-cron.js` (add the `expire-credits` daily and `quarterly-perk` jobs)

**Interfaces (produced):**

```js
export async function onOrderCompleted(prisma, { orderId, now }) {}   // idempotent via CreditEvent CASHBACK orderId uniqueness check
// -> { cashbackCents, upgradedTo: tier|null, rewardIssued: Reward|null, referralPaid: boolean }
export async function applyReferralSignup(prisma, { userId, referralCode, now }) {} // WELCOME lot for referee, sets referredById
export async function issueQuarterlyPerks(prisma, now) {}           // one PREMIUM_ADDON per BEEF_BOSS per quarter (issuedFor "2026-Q4")
export function quarterKey(date, tz = "America/Denver") {}          // "2026-Q4"
export function earlyAccessVisible(menuItem, tier, now) {}           // boolean
export async function redeemReward(tx, { userId, rewardId, orderId, now }) {} // marks redeemed; throws if expired/used
export async function profileForUser(prisma, userId, now) {}         // tier, progress, credits, expiring, rewards, badges, flags
// routes: GET /membership/program ; GET /users/:id/rewards (requires customer auth == id, Task A10)
```

- [ ] **Step 1: Write the failing tests:**
  - Cashback of 1% on a $17.99 order is 17 cents, floored, as a CASHBACK lot.
  - A second `onOrderCompleted` for the same order changes nothing.
  - 10 orders + 2 referrals upgrades to NOODLE_MASTER, resets progress, and issues a FREE_BOWL reward with `issuedFor: "upgrade:NOODLE_MASTER"`.
  - The referral pays $5 to the referrer on the friend's first completed order only.
  - An 11th paid referral in 30 days pays nothing and writes a note event.
  - `quarterKey(new Date("2026-12-31T23:30:00-07:00"))` is `"2026-Q4"` (**Review Focus 4**; it's `2027-Q1` in UTC).
  - `issueQuarterlyPerks` is idempotent per quarter.
  - `earlyAccessVisible` with `releaseAt` = now + 5 days: BEEF_BOSS true, NOODLE_MASTER false, CHOPSTICK false, and a null tier (guest) false.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement against `program.js` and `credits.js`. `quarterKey` uses `Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric" })`.
- [ ] **Step 4:** Update the index.js callers:
  - `PATCH /orders/:id` status COMPLETED: call `onOrderCompleted`.
  - `/users/:id/profile`: return `profileForUser`, keeping the old response keys (`tierBenefits`, `nextTier`, `tierProgress`) mapped from the engine so the old UI keeps working until Phase D.
  - `GET /menu/steps`: filter with `earlyAccessVisible`, using the caller's tier from customer auth (Task A10) or null.
  - Wallet passes (`packages/api/src/wallet/*`): the tier, perks and progress text come from `profileForUser` and `PROGRAM`, not hard-coded strings.
  - Chappy's formatter `chappy/formatters/web.js:184` loses its hard-coded tier text (it is rewritten in B1).
- [ ] **Step 5:** Run `pnpm --filter @oh/api test`. Expected: PASS.
- [ ] **Step 6:** Commit with `feat(membership): engine for cashback, tiers, capped referrals, rewards, early access`.

### Task A6: Order service and payment integrity

**Files:**
- Create: `packages/api/src/orders/pricing.js`, `packages/api/src/orders/service.js`, `packages/api/src/orders/routes.js`, `packages/api/src/orders/__tests__/{pricing,service,routes}.test.js`
- Modify: `packages/api/src/index.js`:
  - Remove `POST /orders` (3529) and `/create-payment-intent` (4731) for food orders. Store and gift-card purchases keep their own validated amounts; add a `kind` guard.
  - Strip `paymentStatus`, `totalCents`, `taxCents` and the promo fields from `PATCH /orders/:id` (4269).
  - Move the PAID side effects (seat RESERVED 15 min plus dual partner, promo usage, `sendOrderConfirmation`, streak) into `markPaid`.
- Modify: `packages/api/src/utils/operating-hours.js` (export `slotsFor(location, date, now)` if one isn't there)

**Interfaces (produced):**

```js
// pricing.js (pure)
export function itemPriceCents(menuItem, quantity) {}   // exact copy of calculateItemPrice semantics (index.js:3566-3581)
export function priceLines(menuItems, items) {}          // -> [{menuItemId, quantity, priceCents, selectedValue}]
export function taxCents(subtotalCents, taxRate) {}      // Math.round
// service.js
export async function quoteOrder(prisma, { locationId, items, userId, promoCode, useCreditsCents, rewardId, giftCardCode, now }) {}
// -> { lines, subtotalCents, discounts:{promoCents, creditsCents, rewardCents, giftCardCents}, taxCents, totalCents, amountDueCents, warnings[] }
export async function createOrder(prisma, { quote, locationId, tenantId, userId, estimatedArrival, seatRequest, partySize, source, now }) {}
// enforces isDineInOrdersEnabled(), canAcceptOrders/validateArrivalTime, assigns seat via pickBestPod or requested label (conditional update)
export async function pickBestPod(tx, { locationId, arrival, partySize, requestedLabel }) {} // -> seat | throws PodUnavailableError
export async function createPaymentIntent(prisma, stripe, { orderId, userId, savePaymentMethod }) {} // amount from order.amountDueCents
export async function markPaid(prisma, stripe, { orderId, paymentIntentId = null, now }) {}
// verifies PI (succeeded, amount === order.amountDueCents, metadata.orderId === orderId) or amountDueCents === 0;
// idempotent: returns {alreadyPaid:true} when paymentStatus already PAID; spends credit (spendCredit), redeems reward, records promo, reserves seat, notifies, streak
// routes.js
// POST /orders                         (customer auth or kiosk device auth) body: {locationId, items, estimatedArrival, seat:{label?|best:true}, partySize, promoCode, useCreditsCents, rewardId, giftCardCode}
// POST /orders/quote                   same body -> quote (no writes)
// POST /orders/:id/payment-intent      -> {clientSecret}
// POST /orders/:id/confirm-payment     body {paymentIntentId?} -> order
```

- [ ] **Step 1: Write the failing tests**
  - **Pricing parity.** Using the seeded menu fixture (`packages/db/prisma/seed-prod.ts` items), `priceLines` matches the old `calculateItemPrice` for quantities 0 to 4 of every item. Include `includedQuantity: 1` bok choy: quantity 1 costs 0, and quantity 2 costs `basePriceCents`.
  - **Payment integrity:**

```js
test("client cannot mark an order paid without a verified PaymentIntent", async () => {
  const { app, prisma } = await buildApp({ stripe: fakeStripe({ pi_1: { status: "requires_payment_method", amount: 1999, metadata: { orderId: "o1" } } }) });
  const res = await app.inject({ method: "POST", url: "/orders/o1/confirm-payment", headers: auth("u1"), payload: { paymentIntentId: "pi_1" } });
  assert.equal(res.statusCode, 402);
  assert.equal((await prisma.order.findUnique({ where: { id: "o1" } })).paymentStatus, "PENDING");
});
test("PATCH /orders/:id ignores paymentStatus", async () => { /* PATCH {paymentStatus:"PAID"} -> 400 unknown field */ });
test("amount mismatch is rejected", async () => { /* PI amount 100, order due 1999 -> 402 */ });
```

  - **Review Focus 2.** Call `markPaid` twice (webhook, then return page). The second returns `{alreadyPaid:true}`, and cashback, streak and confirmation are each counted once (assert the fake notifier's call count is 1).
  - **Review Focus 1.** Two concurrent `createOrder` calls requesting `B-07` at the same arrival: one gets `B-07`, and the other gets `PodUnavailableError` for an explicit label, or the next best pod for `best:true`. Implement the claim as `tx.seat.updateMany({ where: { id, status: "AVAILABLE", retiredAt: null }, data: { status: "RESERVED" } })` and check `count === 1`.
  - **Review Focus 3.** A quote uses 300 cents of credit, the lot then expires, and `markPaid` throws a translated `CREDIT_SHORT` error code. The order stays unpaid.
  - **Review Focus 4.** `slotsFor` on 2026-11-01 (the DST fall-back) has no duplicate or missing 15-minute slots, and none after close minus 15.
  - **Dine-in flag off:** POST /orders returns 403 with the existing message.
  - **Plan demo:** `POST /orders/demo-plan/confirm-payment` returns 409 from the existing `status-demo.js` deny preHandler. The new routes must be registered after `withStatusDemo()` wraps prisma, and must go through the preHandler.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `pricing.js` (move `calculateItemPrice` verbatim), then `service.js`, then `routes.js`.
  - The PAID-time cashback block in today's `PATCH /orders/:id` (around 4520) is **deleted, not moved**. Cashback and referral payouts happen only in `onOrderCompleted` (A5) when the order reaches COMPLETED, per the spec.
  - `markPaid` keeps the streak, seat, promo and confirmation side effects.
  - A test asserts that `markPaid` writes no CASHBACK lot. `createPaymentIntent` uses `stripe.paymentIntents.create({ amount, currency:"usd", customer, setup_future_usage: savePaymentMethod ? "off_session" : undefined, automatic_payment_methods:{enabled:true}, metadata:{ orderId } })`.
- [ ] **Step 4:** Run `pnpm --filter @oh/api test`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(orders): shared order service with server-verified payment`.

### Task A7: Move callers to verified payment

**Files:**
- Modify:
  - `apps/web/app/[locale]/order/payment/payment-form.tsx` (lines 172, 426-524, 803)
  - `apps/web/app/[locale]/order/confirmation/page.tsx:109`
  - `apps/web/app/[locale]/order/group-payment/group-payment-form.tsx:41`
  - `apps/web/app/[locale]/order/status/page.tsx:810`
  - `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx:859,892`
  - `apps/web/app/api/webhooks/stripe/route.ts:91-185`
  - The group-order API paths in `index.js` (`/group-orders/:code/orders`) so they call `quoteOrder`/`createOrder`
  - Every other `/group-orders*` route (create, join, patch, transfer-host, complete, delete): the acting member comes from `req.customer`, and client-sent user ids are ignored (added during execution, after A10b)
- Create: `apps/web/lib/site/orders.ts` (typed client: `quote`, `create`, `paymentIntent`, `confirmPayment`)

This task keeps the current UI working on the new API. Phase D replaces the UI itself.

- [ ] **Step 1:** Write `tests/e2e/site/payment-integrity.spec.ts`. With the Stripe test card `4242...`, a web order reaches PAID. A direct `fetch(PATCH /orders/:id {paymentStatus:"PAID"})` from the page context returns 400.
- [ ] **Step 2:** Run it against dev. Expected: FAIL (the PATCH still works today).
- [ ] **Step 3:** Replace every `PATCH ... paymentStatus: "PAID"` with `confirmPayment(orderId, paymentIntentId)`. The webhook calls `POST /orders/:id/confirm-payment` with the PaymentIntent id, and the server re-verifies. The kiosk's zero-balance and in-person paths call confirm with no id, and the server requires a zero amount due or kiosk device auth plus a terminal PaymentIntent.
- [ ] **Step 4:** Run the e2e spec and a manual kiosk order on `devwebapp.ohbeef.com/en/kiosk`. Expected: PASS.
- [ ] **Step 5:** Commit with `fix(payments): clients confirm via server-verified PaymentIntent`.

### Task A8: Comb seats (seed, endpoints, location auth)

**Files:**
- Create: `packages/db/scripts/seed-comb-seats.ts`, `packages/api/src/seats/__tests__/seats.test.js`
- Modify:
  - `index.js` `GET /locations/:id/seats` (1517) and `/availability` (665): exclude `retiredAt`, return `{layoutKey, layoutMirror, seats:[{id,label,finger,rowSide,position,status,podType,dualPartnerId}]}`.
  - Add `requireAdminAuth` to `PATCH/DELETE /locations/:id`.
  - `packages/db/prisma/seed-prod.ts`: replace `cityCreekSeats` / `universityPlaceSeats` (344-438) with a call to the new script's function, and replace `totalSeats: 12` with `podCount`.

**Interfaces:**
- Consumes: `buildLayout`, `LOCATION_LAYOUTS` and `podLabel` from `@oh/floor-plan`.
- Produces: `seedCombSeats(prisma, { locationId, layoutKey, now }) -> { created, retired }`. It's idempotent: upsert by `(locationId, number = label)`, set `qrCode = "POD-" + locationId.slice(-8) + "-" + label`, and set `retiredAt` on seats whose number isn't among the labels. It links duo partners through `dualPartnerId`. Location slugs: `city-creek` and `university-place`.

- [ ] **Step 1:** Write the test: after seeding, the location has 75 or 70 active seats, the old `01..12` seats are retired, a second run creates 0, retired seats never appear in `GET /locations/:id/seats`, and `PATCH /locations/:id` without auth returns 401.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement the script, the endpoint changes and the auth.
- [ ] **Step 4:** Run the tests. Then run the script against local dev with `pnpm --filter @oh/db exec tsx scripts/seed-comb-seats.ts --all` and check the counts with `psql`.
- [ ] **Step 5:** Commit with `feat(seats): comb seats for City Creek (75) and University Place (70, mirrored)`.

### Task A8b: No customer PII on the public seat endpoints (added during execution)

A8 restored per-seat active `orders` on `GET /locations/:id/seats` (and `/availability` reuses it). Those endpoints are PUBLIC and return the seated customer's name, membership tier and order items. The same leak exists in prod today. Public callers must get seat status only.

**Files:**
- Modify: `packages/api/src/seats/service.js` and the seat routes in `index.js`
- Modify, the staff callers: `apps/admin/app/(display)/cleaning/pods-manager.tsx` (the admin Bearer token is already attached by `ApiAuthInit`), and the kiosk callers in `apps/web/app/[locale]/kiosk/**` (they send `kioskAuthHeaders()`)
- Test: `packages/api/src/seats/__tests__/seats.test.js`

**Behavior:**
- **Anonymous or customer callers** get `{layoutKey, layoutMirror, seats:[{id, label, finger, rowSide, position, status, podType, dualPartnerId, bestRank}]}`, with NO `orders`, no names, no tier and no items.
- **Staff callers** get the per-seat `orders` exactly as A8 restored them. Staff means `requireAdminAuth` passes (the admin session, or `x-admin-api-key`), or a valid kiosk device key for THAT location (`createKioskAuth` in `auth/kiosk.js`). Decide this with a non-failing check: optional auth that never returns 401 on these public routes, just the public shape.
- **A signed-in customer** who owns an active order in a seat may see `isMine: true` on that seat, and nothing else.
- Keep `route-classification.test.js` green. The routes stay public, with the staff view as an optional upgrade.

- [ ] **Step 1:** Write the failing tests:
  - anonymous: no `orders` key, and no "name" substring anywhere in the JSON;
  - admin: gets `orders`;
  - a kiosk key for another location: public shape;
  - a kiosk key for this location: gets `orders`;
  - the owner sees `isMine`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement, and update the admin and kiosk callers.
- [ ] **Step 4:** Run `pnpm --filter @oh/api test`, `pnpm --filter @oh/web test` and `pnpm --filter @oh/admin test`. Expected: PASS.
- [ ] **Step 5:** Commit with `fix(seats): public seat endpoints return status only; orders for staff and kiosk`.

### Task A9: Support cases, goodwill caps, and full-refund-only staff actions

**Files:**
- Create: `packages/api/src/support/caps.js`, `packages/api/src/support/routes.js`, `packages/api/src/support/__tests__/{caps,routes}.test.js`
- Modify: `index.js` (register the routes). `notifications.js` `sendSMS` and `email/graph.js` `sendGraphMail` are injected, not changed.

**Interfaces (produced):**

```js
// caps.js
export async function goodwillAllowance(prisma, { userId, orderId, now }) {}
// -> { allowedCents, reason: null | "ORDER_TOO_OLD" | "NOT_OWNER" | "PER_ORDER" | "PER_30_DAYS" | "LIFETIME" }
// sums CreditLot source GOODWILL for per-order (orderId), rolling 30 days, lifetime; order must be user's and completedAt/createdAt within 24h
export async function grantGoodwill(prisma, { userId, orderId, requestedCents, caseId, now }) {} // min(requested, allowed); grantCredit(source GOODWILL)
// routes.js
// POST /support/cases                 (customer auth optional; contact form + Chappy) {type, summary, orderId?, contact?, transcript?, locale}
// GET  /admin/support/cases?status=   (requireAdminAuth)
// POST /admin/support/cases/:id/resolve {action: "credit"|"full_refund"|"decline", amountCents?, reason?}
//   credit: grantCredit(source ADMIN, amountCents) ; full_refund: stripe.refunds.create({payment_intent}) with NO amount field,
//   then restore credits used on the order via grantCredit(source ADMIN, note "refund restore") + CreditEvent REFUND_RESTORE,
//   and restore gift-card balance on the GiftCard row ; decline: reason required
export function notifyCase(deps, supportCase, { urgent }) {}   // SMS when urgent or amount >= 2000 cents; always email
```

- [ ] **Step 1: Write the failing tests:**
  - Caps: the per-order $5 limit, the rolling 30-day $10 limit, and the $45 lifetime limit (10 prior grants of $4.50 means 0 allowed, reason `LIFETIME`).
  - Someone else's order gives `NOT_OWNER`. An order older than 24 hours gives `ORDER_TOO_OLD`.
  - `resolve` with `{action:"full_refund", amountCents: 500}` returns 400 `PARTIAL_REFUND_NOT_ALLOWED`.
  - `full_refund` calls the fake `stripe.refunds.create` with no `amount` key.
  - Goodwill writes a `CreditLot` and never calls Stripe.
  - An urgent case sends one SMS and one email.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(support): cases, goodwill caps, full-refund-only staff actions`.

### Task A9b: Owner-only full refunds and refund edge cases (added during execution)

This runs after the rebase onto the admin-console release (origin/main adc654a). It brings in `requireRole` from `createAdminAuth()` (`packages/api/src/auth/admin.js`) and `registerAdminAuthHooks` (`packages/api/src/auth/admin-hook.js`).

**Files:**
- Modify: `packages/api/src/support/routes.js`, `packages/api/src/support/refund.js`, `packages/api/src/orders/service.js`, `packages/api/src/index.js` (the wiring only)
- Test: `packages/api/src/support/__tests__/*`

**Items:**
1. The resolve route's injectable `requireOwner` (marked `TODO(roles)`) becomes `requireRole("owner")` from `createAdminAuth()` in `index.js`. `resolvedBy` records the verified admin identity (email or user id) that `requireAdminAuth`/`requireRole` attach to the request; read `admin.js` for the property name. `x-admin-api-key` service callers record `"service"`.
   - Test: a manager-role admin gets 403 on `full_refund`, and 200 on `credit` and `decline`. An owner gets 200 on `full_refund`.
   - `/admin/support/*` keeps the STAFF default from `adminPathRoles`.
2. Wording, to follow the owner's rule: A6's partial-prior-refund SupportCase text in `orders/service.js` (it currently says "refund it manually") must say that the payment was already partly refunded outside the app, that it must NOT be refunded again in Stripe, and that staff should give store credit or escalate to the owner. Test: the summary doesn't contain "manually".
3. The final case update in `refund.js` becomes conditional on this actor's claim: `resolvedAt` equals its lease timestamp, or the pending marker is its own. A slower second actor must not overwrite `resolutionDetail`, and must not write `amountCents` onto a second case when another case already refunded the order; it records `resolution: INFO` with the note "order already refunded by case <id>". Test.
4. `cancelActiveOrder` drops its stale-status early return and relies on its conditional `updateMany` (an order that moves PAID to QUEUED during the Stripe call still gets cancelled). Test.
5. A case whose order was already refunded by another case can be closed: `full_refund` returns `ALREADY_REFUNDED`, and a stale pending marker on it no longer blocks `decline`/INFO closing. Add a resolve action `"close"` (reason required, `resolution: INFO`, no money), allowed for STAFF. Test.
6. A meal-gift `NOT_RESTORED` outcome is surfaced in `warnings[]` like the gift card. Test.

- [ ] **Step 1:** Write the failing tests for items 1-6. Run them. Expected: FAIL.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Run `pnpm --filter @oh/api test` (route classification included) and `node --check packages/api/src/index.js`. Expected: PASS.
- [ ] **Step 4:** Commit with `fix(support): owner-only full refunds via requireRole; refund edge cases`.

### Task A10: Customer identity (`auth/customer.js`)

**Files:**
- Create: `packages/api/src/auth/customer.js`, `packages/api/src/auth/__tests__/customer.test.js`
- Modify: `index.js`:
  - Add a `resolveCustomer` preHandler on member-scoped routes: `/users/:id/*`, `/orders*`, `/membership/*`, `/support/cases`, `/chappy/*`.
  - Lock `GET /users/by-email/:email` to the verified caller's own email.
  - `POST /users` stays as the sign-up upsert, but must match the verified email.
- Modify: `apps/web/lib/site/api.ts` (new fetch wrapper that attaches `Authorization: Bearer ${await getToken()}` from Clerk `useAuth`, reusing the admin `ApiAuthInit` pattern)

**Interfaces (produced):**

```js
export function createCustomerAuth({ env, verifyToken, getUser, prisma, now }) {}
// -> { resolve(req): Promise<{ kind:"user", userId, email } | { kind:"guest", guestKey } | { kind:"anonymous" }>,
//      issueGuestToken(): string, requireUser(req, reply), requireSelf(req, reply, id) }
// Clerk JWT verified against CLERK_SECRET_KEY / CLERK_SECRET_KEY_DEV (same as admin.js); email -> prisma.user by email (cached 5 min)
// guest token: "g1.<random>.<hmac>" with CHAPPY_GUEST_SECRET, 30-day expiry
```

- [ ] **Step 1: Write the failing tests:**
  - A forged `userId` in the body is ignored: the route sees the verified id.
  - `requireSelf` returns 403 for another user's `/users/:id/profile`.
  - An expired or tampered guest token resolves to anonymous.
  - `/users/by-email/other@x.com` returns 403 for a caller who is `me@x.com`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Mirror `admin.js`'s `verifyAgainstAny` and its injection points so the tests use fakes.
- [ ] **Step 4:** Update the web callers of member routes to `lib/site/api.ts`. Verify that `/member` still loads on dev when signed in.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with `feat(auth): verified customer identity for member, order and Chappy routes`.

### Task A10b: Close the remaining client-id routes (added during execution)

Task A10 found more routes that act on a client-supplied user id. They are the same hole class, so they get the same fix.

**Files:**
- Modify: `packages/api/src/index.js` (the routes below) and their web or kiosk callers
- Test: `packages/api/src/auth/__tests__/hardening.test.js`

**Routes and required behavior:**

| Route | Required behavior |
|---|---|
| `POST /shop/orders/:id/apply-credits` | Credits come only from the verified caller (`requireUser`), who must own the shop order. A body `userId` is ignored. |
| `POST /gift-cards/:id/redeem` | The redeemer is the verified caller. Keep the existing code and balance checks. |
| `GET /users/referral/:code` | Returns only public-safe fields (the referrer's first name, the code, validity). Never the email, id or phone. |
| `/wallet/test-push/:userId`, `/wallet/debug` | Admin only (`requireAdminAuth`), or 404 when `NODE_ENV === "production"` (pick whichever the routes' purpose fits, and document the choice). |
| `POST /group-orders/:code/orders` | The member's `userId` comes from the verified caller, and guests get null (same rule as `POST /orders` after A10). |
| Kiosk `GET /orders/by-member`, unfiltered `GET /orders` | Require kiosk device auth or admin auth. Find the existing kiosk device mechanism (`KioskDevice` model, the `apps/web/app/[locale]/kiosk` flows) and reuse it. Anonymous callers get 401. |

- [ ] **Step 1:** Write failing tests for each row: another user's id in the body is ignored or refused, the referral lookup response has no `email` key, the wallet debug route is 401 or 404 anonymously, and anonymous `GET /orders` is 401.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement, and update the callers found by grep (R8). The kiosk flows must keep working. Smoke-test a kiosk order on the worktree servers.
- [ ] **Step 4:** Run `pnpm --filter @oh/api test` and `pnpm --filter @oh/web test`. Expected: PASS.
- [ ] **Step 5:** Commit with `fix(security): no client-id trust on shop credits, gift cards, referral lookup, wallet debug, kiosk order lists`.

---

## Phase B: Chappy backend

### Task B1: Agent loop v3

**Files:**
- Create: `packages/api/src/chappy/routes.js` (moves the `/chappy/*` routes out of index.js 14423-14831), `packages/api/src/chappy/__tests__/agent.test.js`
- Rewrite: `packages/api/src/chappy/agent.js`, `packages/api/src/chappy/prompts.js`
- Delete: `packages/api/src/chappy/agent-v2.js`, plus the `@stripe/agent-toolkit`, `ai` and `@ai-sdk/anthropic` dependencies if nothing else imports them (check with `grep -rn` first).

**Interfaces (produced):**

```js
export const CHAPPY_MODEL = process.env.CHAPPY_MODEL || "claude-opus-5";
export async function* runTurn({ client, prisma, identity, channel, locale, message, conversation, tools, now })
// yields {type:"text", delta} | {type:"tool_start", name} | {type:"card", card} | {type:"done", usage} | {type:"error", code}
// request: client.beta.messages.stream({ model: CHAPPY_MODEL, max_tokens: 16000, thinking:{type:"adaptive"},
//   output_config:{effort:"medium"}, betas:["server-side-fallback-2026-07-01"], fallbacks:"default",
//   system:[{type:"text", text: FROZEN_SYSTEM, cache_control:{type:"ephemeral"}}],
//   tools: TOOL_DEFS /* sorted by name, strict:true, eager_input_streaming:true */, messages })
// per-user context is a user-turn prefix block "<context>{tier, cart, location, locale, inPod}</context>" after the cache breakpoint
// loop: max 6 tool rounds; stop_reason "refusal" -> {type:"error", code:"REFUSAL"}; "max_tokens" -> finish text, no tools run
// history: last 20 messages, trimmed so it starts on a user turn and never orphans tool_result
// POST /chappy/chat  (text/event-stream) body {message<=1500, locale, channel:"web"} ; GET /chappy/history ; POST /chappy/reset
```

- [ ] **Step 1: Write the failing tests** with a fake Anthropic client that replays scripted streams:
  - A 7th tool round is not requested; the loop ends with a text fallback.
  - A refusal yields the error event.
  - History trimming never starts on an assistant turn.
  - The system block and tools are byte-identical across two users, which is required for caching (compare `JSON.stringify`).
  - A message over 1,500 characters gives 413.
  - The SSE response has no `Access-Control-Allow-Origin: *`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Read the claude-api skill's `typescript/claude-api/{README,streaming,tool-use}.md` for the exact streaming and fallback call shapes before writing.
  - The persona text comes from the current `getBasePersonality`, with no emoji and an added **Issue mode** paragraph: calm, brief, and never sarcastic when the user reports a problem.
  - Business rules are rewritten from `PROGRAM` and the `/experience` FAQ content.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(chappy): v3 agent loop with verified identity, caching and limits`.

### Task B2: Chappy tools (18, all real)

**Files:**
- Rewrite: `packages/api/src/chappy/tools.js`
- Create: `packages/api/src/chappy/cart.js` (server-held cart in `ChappyConversation.metadata`), `packages/api/src/chappy/__tests__/tools.test.js`

**Interfaces (produced):** `TOOL_DEFS` (strict JSON schemas) and `executeTool(name, input, ctx)`. The handlers call only services:

| Tool | Access | Calls |
|---|---|---|
| `search_menu`, `get_menu_item` | public | menu query + `earlyAccessVisible` |
| `get_locations` | public | locations + `slotsFor` + free pod count |
| `get_membership_program` | public | `publicProgram()` |
| `get_my_profile` | user | `profileForUser` |
| `get_my_orders`, `get_order_status` | user, own only | prisma `where: { userId: identity.userId }` |
| `get_usual_order`, `reorder` | user | order history, then `cart.replace` |
| `cart` (`op`: add/remove/set_quantity/clear/view) | user | `cart.js`, then `quoteOrder` |
| `set_arrival_and_pod` | user | `slotsFor`, `pickBestPod` dry-run |
| `apply_savings` | user | `quoteOrder` with credits/promo/reward |
| `checkout` | user | `createOrder` + `createPaymentIntent`, which returns a **pay card** only |
| `start_group_order` | user | existing group-order create, returns a share card |
| `report_issue` | user or guest | PodCall if in a pod, else `SupportCase` + `grantGoodwill` + `notifyCase` |
| `request_refund` | user | `SupportCase` REFUND_REQUEST |
| `escalate_to_human` | any | `SupportCase` + `notifyCase` urgent |

  - Guests calling a user tool get a `SIGN_IN_REQUIRED` result plus a sign-in card.

- [ ] **Step 1: Write the failing tests:**
  - Every name in `TOOL_DEFS` has a handler.
  - `get_order_status` for another user's order returns `NOT_FOUND`.
  - `checkout` never calls `markPaid` or `stripe.paymentIntents.confirm`; it returns `{card:{type:"pay", clientSecret}}`.
  - A guest calling `cart` gets `SIGN_IN_REQUIRED`.
  - `report_issue` with an active pod order creates a PodCall and no credit.
  - `report_issue` for a cold bowl yesterday within 24 hours grants at most 500 cents as a GOODWILL lot.
  - No tool schema contains `amountCents` for a refund.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Delete `create_and_pay_order`, `create_apple_pay_order`, `/chappy/confirm-payment` and the placeholder payment link. Tool handlers receive `basePrisma` (unwrapped), as they do today in `status-demo.js`, so Chappy never sees synthetic demo orders as real.
- [ ] **Step 4:** Adapt SMS (`POST /chappy/sms`): the pay card becomes `WEB_BASE_URL/{locale}/order/payment?orderId=...`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with `feat(chappy): 18 service-backed tools; human-tap payments only`.

### Task B3: Chappy limits and budget

**Files:**
- Modify: `packages/api/src/chappy/routes.js`; add `packages/api/src/chappy/limits.js` and its test.

**Interface:** `checkLimits({ identityKey, now }) -> { ok } | { ok:false, code:"RATE" | "BUDGET" }`. Limits: 20 messages per 10 minutes per identity, 200 per day, and 300k output tokens per identity per day. These live in memory, following the plan-routes pattern, and are configurable through `CHAPPY_LIMITS_JSON`.

- [ ] **Step 1:** Write tests: the 21st message in 10 minutes gives 429 `RATE`, and the budget is reached after the recorded usage.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement, and record `usage.output_tokens` from the `done` event.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(chappy): per-identity rate and token limits`.

---

## Phase C: Web foundation

### Task C1: Site tokens, fonts, and retiring the global element rules

**Files:**
- Modify: `apps/web/app/globals.css`:
  - Add `--color-oh-linen: #EDE6DA` to `@theme`.
  - Delete the element rules: button, input, textarea (including `textarea:focus`), a, h1 to h6, p.
  - Change the comment to say Tailwind utilities now apply site-wide.
- Create: `apps/web/components/site/fonts.ts` (promote `lib/plan/fonts.ts`: Instrument Serif, Noto Serif TC/SC, Noto Sans TC/SC, all via next/font), `apps/web/components/site/Text.tsx` (`Display`, `Title`, `Body`, `Eyebrow`, with locale-aware font classes)
- Modify: `apps/web/app/layout.tsx` (drop the Google Fonts `<link>` for Bebas, Ma Shan Zheng and LXGW WenKai unless the CNY pages use them; keep those only for `/cny`)

- [ ] **Step 1:** Write a guard test, `lib/site/__tests__/globals.test.ts`: read `globals.css` and assert it has no bare `button {`, `input {`, `textarea:focus` or `h1 {` selectors.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Make the CSS and font changes.
- [ ] **Step 4:** Run it. Expected: PASS. Screenshot `/en/plan` (gate plus one section) before and after at 390 and 1440. The plan pages must look identical, because they already set classes on every button and input (memory: "Every plan `<button>` must set a bg class").
- [ ] **Step 5:** Commit with `feat(site): design tokens and fonts; retire global element rules`.

### Task C2: Icons, chop seals, and the no-emoji guard

**Files:**
- Create: `apps/web/components/site/icons/{Icon.tsx,paths.ts}`
  - Names: bowl, chopsticks, pod, hatch, clock, pin, chevron, close, menu, user, gift, store, spark, flame (spice), leaf (vegan), wheat-off (GF), seal, check, alert, share, wallet, arrow.
  - 24px viewBox, stroke 1.5, `strokeLinecap="round"`, and a tapered end made from a second thin path.
- Create: `apps/web/components/site/seal/{Seal.tsx,seals.ts}`
- Create: `apps/web/lib/site/__tests__/no-emoji.test.ts`
- Create: `apps/web/components/site/tiers/TierMark.tsx`, with inline SVG traced from `public/tiers/*.png` and a `tone: "cream" | "gold" | "ink"` prop

**Interfaces:**
- `<Icon name={IconName} size?={number} className? title?/>`
- `<Seal iconKey={string} size? earned?={boolean}/>`
- `SEALS: Record<string, {glyph: string; border: "square"|"round"|"double"}>` keyed by badge slug, for example `first-bowl: {glyph:"初", border:"square"}`, `vip: {glyph:"牛", border:"double"}`. Glyph text is `aria-hidden`; the accessible name comes from the translated badge name.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { globSync, readFileSync } from "node:fs";
const EMOJI = /\p{Extended_Pictographic}/u;
const ROOTS = ["app", "components", "lib", "messages"].map((d) => `${__dirname}/../../../${d}`);
const EXTRA = ["../../packages/api/src", "../../packages/db/prisma"];
describe("no emoji", () => {
  it("customer code, messages, API and seeds contain no emoji", () => {
    const files = [...ROOTS, ...EXTRA.map((p) => `${__dirname}/../../../${p}`)]
      .flatMap((r) => globSync(`${r}/**/*.{ts,tsx,js,json}`, { exclude: (f) => /node_modules|\/plan\/|__tests__|\.next/.test(f) }));
    const hits = files.flatMap((f) => readFileSync(f, "utf8").split("\n").map((l, i) => (EMOJI.test(l) ? `${f}:${i + 1}` : null)).filter(Boolean));
    expect(hits).toEqual([]);
  });
});
```

  (Node 22+ has `fs.globSync`. If the repo's Node is older, use `fast-glob`, which is already in the tree through Next.)
- [ ] **Step 2:** Run it. Expected: FAIL, listing about 272 lines. The Phase D tasks drive this to zero. Mark the test `it.fails` until Task F1, then flip it back. It is removed from `it.fails` in F1 Step 5.
- [ ] **Step 3:** Implement `Icon`, `Seal` and `TierMark`. Add `components/site/__tests__/seal.test.tsx` (render with `react-dom/server` `renderToString` and assert `<svg` output, including an `aria-label` from props).
- [ ] **Step 4:** Commit with `feat(site): in-house icon set, chop seals, tier marks, emoji guard`.

### Task C3: Motion kit

**Files:**
- Create: `apps/web/components/site/motion/{Reveal.tsx,PinnedStory.tsx,FrameSequence.tsx,Sheet.tsx,SnapRail.tsx,CountUp.tsx,ParallaxLayer.tsx,useReducedMotion.ts,motion.css}` and `components/site/motion/__tests__/pinned.test.ts`

**Interfaces:**
- `<Reveal as? delay? from="up"|"fade"|"scale">`: uses the CSS class `.oh-reveal`, with `animation-timeline: view(); animation-range: entry 0% cover 30%`, inside `@supports (animation-timeline: view())`, and an IntersectionObserver fallback that toggles `data-in`.
- `<PinnedStory screens={number} children={(progressVar: string) => ReactNode}>`: an outer height of `screens * 100svh`, a sticky inner `100svh`, and `--progress` from 0 to 1 set by a scroll-driven `@property --progress` animation, with an rAF fallback.
- `<FrameSequence frames={string[]} alt={string} poster={string}>`: canvas, preloading the first 8 frames and then idle loading the rest.
- `<Sheet open onClose snapPoints?={[0.5,1]} label>`: framer-motion `drag="y"`, dismissing at 30% or on velocity. Focus trap and Esc.
- `<SnapRail>`: `scroll-snap-type: x mandatory`, with `aria-roledescription="carousel"`.
- `useReducedMotion(): boolean`. Every primitive renders its static final state when it returns true.

- [ ] **Step 1:** Write a pure test for `progressFromScroll(top, height, viewport)` (clamped to 0..1, with edge cases) and for `useReducedMotion` returning true under a mocked `matchMedia`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Add a dev-only demo route at `app/[locale]/_lab/motion/page.tsx`, excluded from production with `notFound()` when `NODE_ENV === "production"`.
- [ ] **Step 4:** Run the tests. On an iPhone 15 Playwright profile, record the lab page scrolling and check there's no jank: the `PerformanceObserver` long-task total stays under 200 ms during a 3-second scroll.
- [ ] **Step 5:** Commit with `feat(site): native-first motion kit`.

### Task C4: Shell (top bar, dock, More sheet, desktop nav)

**Files:**
- Create: `apps/web/components/site/shell/{SiteShell.tsx,TopBar.tsx,Dock.tsx,MoreSheet.tsx,DesktopNav.tsx,LocaleSwitch.tsx,Footer.tsx}`
- Modify: `apps/web/app/[locale]/layout.tsx` (wrap the non-plan, non-kiosk, non-CNY branch in `SiteShell`, replacing `Header` and `Footer`), `apps/web/components/Providers.tsx` (Chappy mounts inside the dock from Task E1; remove the floating mount)
- Delete: `apps/web/components/Header.tsx`, `apps/web/components/Footer.tsx`, `apps/web/components/LanguageSwitcher.tsx` (replaced)

**Interfaces:**
- `SiteShell({ children })`.
- `Dock` items come from `lib/site/nav.ts`: `[{key:"order", href:"/order", icon:"bowl", primary:true}, {key:"menu"...}, {key:"rewards"...}, {key:"chappy", action:"openChappy"}]`. Labels come from `t("nav.<key>")`.
- The dock height is exposed as the CSS variable `--dock-h` so pages pad their bottoms.

- [ ] **Step 1:** Write `tests/e2e/site/shell.spec.ts`:
  - On iPhone 15: the dock is visible, its 4 targets are each at least 44x44, the More sheet opens and closes with a drag, and the locale switch goes from `/en/menu` to `/zh-TW/menu` with the same path.
  - At 1440: no dock, and a top nav with the same items.
  - With the `x-embed` header (`?embed=1`), `SiteShell` renders children only: no top bar, no dock and no Chappy.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(site): mobile dock shell and desktop nav`.

### Task C5: Translation infrastructure and guards

**Files:**
- Modify: `apps/web/i18n/request.ts`: add `onError` (throws in test, logs in dev) and `getMessageFallback` (returns an empty string in production and logs), and keep `withPlanFallback`.
- Create:
  - `apps/web/lib/site/__tests__/locale-parity.test.ts`
  - `apps/web/lib/site/__tests__/no-literal-jsx.test.ts` (TypeScript compiler API: walk the `.tsx` files under `app/[locale]` excluding `plan`, `kiosk`, `agents` and `_lab`, plus `components/site` and `components/*.tsx`; flag `JsxText` nodes with letters, plus string-literal `aria-label`, `alt`, `title` and `placeholder` attributes)
  - `tests/e2e/site/english-leak.spec.ts`
  - `apps/web/lib/site/i18n-allowlist.ts` (brand names and units: `Oh!`, `Wagyu`, `Chappy`, `Stripe`, `Apple Pay`, `Google Pay`, `QR`, `oz`, `mi`)

- [ ] **Step 1: Write the tests**

```ts
// locale-parity.test.ts
import en from "@/messages/en.json"; import zhTW from "@/messages/zh-TW.json"; import zhCN from "@/messages/zh-CN.json"; import es from "@/messages/es.json";
const keys = (o: any, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const nonPlan = (ks: string[]) => ks.filter((k) => !k.startsWith("plan."));
it.each([["zh-TW", zhTW], ["zh-CN", zhCN], ["es", es]])("%s has every non-plan key", (_n, m) => {
  expect(nonPlan(keys(en)).filter((k) => !keys(m).includes(k))).toEqual([]);
});
it("no em dashes in any locale", () => { for (const m of [en, zhTW, zhCN, es]) expect(JSON.stringify(m)).not.toContain("—"); });
```

  The English-leak spec: for every route in `lib/site/routes.ts` and each locale in `["zh-TW","zh-CN"]`, load the page on the iPhone 15 profile. Collect `document.body.innerText`, `alt`, `aria-label` and `placeholder` values. Remove the allowlist terms, digits and currency. Fail on any `/[A-Za-z]{3,}/` match, and report the route and text.
- [ ] **Step 2:** Run them. Expected: FAIL, with a long list; that's the Phase D and F1 worklist. Mark the parity, literal-JSX and em-dash tests `it.fails` until F1, like C2.
- [ ] **Step 3:** Implement the `request.ts` changes. Create `lib/site/routes.ts`, listing every customer route with its sample params.
- [ ] **Step 4:** Commit with `feat(i18n): locale parity, literal-JSX and English-leak guards`.

### Task C6: Image pipeline

**Files:**
- Create: `scripts/site-images.mjs` (uses `sharp`; add it to the root devDependencies if it's missing), `apps/web/public/site/*.{avif,webp}`, `apps/web/lib/site/images.ts`
- Modify: `apps/web/lib/menu-images.ts` (Classic Bowl uses `bowl-slices-*`, the Wagyu bowl `bowl-chunks-*`, and Classic Bowl No Beef keeps its existing png)

**Interface:** `SITE_IMAGES: Record<ImageKey, { src: { avif: string; webp: string }; w: number; h: number; alt: MessageKey }>`

Mapping:

| Key | Source |
|---|---|
| `storefront-dusk` | `Image 4.jpeg` |
| `storefront-queue` | `Image 3.jpeg` |
| `hall-rows` | `Image 1.jpeg` |
| `hall-rows-alt` | `Image.jpeg` |
| `pod-hatch-a` | `Image 6.jpeg` |
| `pod-hatch-b` | `Image 5.jpeg` |
| `pod-hatch-c` | `Image 2.jpeg` |
| `bowl-slices-top` | `Image 9.jpeg` |
| `bowl-slices-side` | `Image 8.jpeg` |
| `beef-macro` | `Image 12.jpeg` |
| `bowl-chunks-top` | `Image 11.jpeg` |
| `bowl-chunks-side` | `Image 10.jpeg` |
| `store-interior` | `Image 7 (1).jpeg` |
| `bowl-empty` | `Image 3 (1).jpeg` |
| `bowl-flatlay` | `Image 7.jpeg` |
| `chopsticks` | `Image 6 (1).jpeg` |
| `sign-pool` | `Image 1.jpg` |

The script has a hard deny list: `IMG_5749.jpeg`, `Dano_Signature.heic`, `KitchenScreen.png`, `BlueprintSample.jpg`, `Image 9.jpg` and `Dano.JPG`. It exits non-zero if any denied file is mapped.

- [ ] **Step 1:** Write `lib/site/__tests__/images.test.ts`. Every `SITE_IMAGES` entry has both files on disk at 390, 780 and 1200 widths, and no output file name contains a denied source stem.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Run `node scripts/site-images.mjs`: widths 390/780/1200, AVIF quality 50 and WebP quality 72, with EXIF stripped. Write `images.ts`.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit the script, the generated files and `images.ts`, staged by explicit paths: `git add scripts/site-images.mjs apps/web/public/site apps/web/lib/site/images.ts apps/web/lib/menu-images.ts`.

---

## Phase D: Pages

Every Phase D task follows the same pattern, and each gets its own Playwright spec under `tests/e2e/site/` that is written first and fails first:
- Build from `components/site/*`, with Tailwind classes only (no inline `style` except CSS variables).
- Server components where there's no interactivity.
- All copy in `messages/en.json` under the page's namespace. The zh-TW, zh-CN and es entries are added in the same task, as drafts; they're reviewed in F1.
- Images through `next/image` with `SITE_IMAGES`.

Every spec asserts:
- The page renders on the iPhone 15 profile with no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`).
- The primary CTA works.
- `axe` finds no violations (`@axe-core/playwright`).
- Reduced motion (`page.emulateMedia({ reducedMotion: "reduce" })`) still shows all content.

Each task's final step removes that route's entries from the C2/C5 `it.fails` worklists by fixing them, and runs `pnpm --filter @oh/web test`.

### Task D1: Home story (`app/[locale]/page.tsx`)

**Files:**
- Rewrite: `apps/web/app/[locale]/page.tsx` (from 1,290 lines to about 80; it composes the chapters)
- Create: `apps/web/components/site/home/{Arrive.tsx,WalkIn.tsx,ThePod.tsx,TheBowl.tsx,NoTip.tsx,RewardsTeaser.tsx,RedStep.tsx,TwoLocations.tsx,BrushMark.tsx}`, `apps/web/lib/site/live.ts` (`useLiveStatus(locationId)` polls `/locations/:id/availability` every 60 s and pauses while hidden), `tests/e2e/site/home.spec.ts`
- Messages: the `home.*` namespace is rewritten. Reuse plan lines by copying them, not by reference: the chapter headlines are in section 5 of the spec, and there are no em dashes.

**Behavior:**
- **Arrive.** Full-bleed `storefront-dusk` with `priority` on the image, and `BrushMark` (the `Oh_Logo_Mark_Light` SVG revealed by an SVG mask stroke with `stroke-dashoffset` animated on load). Live status comes from `useLiveStatus` for the nearer location, falling back to City Creek.
- **WalkIn.** `PinnedStory screens={2.5}`: `hall-rows` with 6 row-light overlays whose opacity follows `--progress` thresholds.
- **ThePod.** `PinnedStory screens={3}` crossfading `pod-hatch-a/b/c`. An SVG hatch panel slides up over the hatch region of `pod-hatch-b`.
- **TheBowl.** A linen section. `bowl-slices-top` rotates with `rotate: calc(var(--progress) * 40deg)`. Four callouts use `Reveal`. It ends on `beef-macro`.
- **RewardsTeaser.** `TierMark`s with `CountUp` on the cashback percentages.
- **TwoLocations.** Two cards showing pods free, hours today and a directions link.

- [ ] **Step 1:** Write the spec: the hero and Order CTA are visible above the fold at 390x844, all 8 chapters are present, the Order CTA leads to `/{locale}/order`, and LCP is under 2.5 s on a throttled 4G CDP profile (`Network.emulateNetworkConditions` at 1.6 Mbps and 150 ms RTT, plus CPU 4x).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS. Take screenshots at 390 and 1440 in all 4 locales and review them.
- [ ] **Step 5:** Commit with `feat(site): home scroll story`.

### Task D2: Experience page (`/experience`)

**Files:**
- Create: `apps/web/app/[locale]/experience/page.tsx`, `components/site/experience/{Steps.tsx,JourneyMap.tsx}`, `tests/e2e/site/experience.spec.ts`
- Consumes: `buildLayout(LOCATION_LAYOUTS["comb-75"])`, its `journeyMarkers(progress)`, and `CombMap` in `mode="journey"` (Task D4)

**Behavior:**
- Six full-screen steps in a vertical `SnapRail` (`scroll-snap-type: y mandatory` on mobile): arrive, order, walk, settle, taste, leave.
- Copy is adapted from `plan.experience.steps.*` into the new `experience.*` namespace.
- The images are the `experience-*` webps already in `public/plan/` plus `SITE_IMAGES`.
- A pinned `JourneyMap` moves the guest dot and bowl with step progress.
- An FAQ accordion follows, from `experience.faq.*`.

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. The spec asserts 6 steps, that the journey dot's position changes between step 2 and step 4, and that the FAQ opens with the keyboard. Commit with `feat(site): experience page`.

### Task D3: Menu page (`/menu`)

**Files:**
- Rewrite: `apps/web/app/[locale]/menu/page.tsx`
- Create: `components/site/menu/{MenuList.tsx,ItemSheet.tsx,DietaryMarks.tsx}`, `tests/e2e/site/menu.spec.ts`
- Data: `GET /menu/steps?locale=` (unchanged API; early-access filtering from A5)

**Behavior:**
- Linen panels grouped by category.
- `ItemSheet` holds the photo, description, dietary marks (Icon leaf, wheat-off, and flame times spice level) and an "Order this" CTA to `/order?item=<id>`.
- The English spice emoji is gone.

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. The spec asserts item names appear in zh-TW when that locale is selected (from `nameZhTW`), and that the sheet opens and closes by drag. Commit with `feat(site): menu`.

### Task D4: `CombMap` and location pages

**Files:**
- Create: `apps/web/components/site/floor-plan/{CombMap.tsx,useSeats.ts,PodCell.tsx,RowZoom.tsx,Legend.tsx}`, `apps/web/components/site/floor-plan/__tests__/combmap.test.tsx`
- Rewrite: `apps/web/app/[locale]/locations/page.tsx`
- Create: `apps/web/app/[locale]/locations/[slug]/page.tsx`, `tests/e2e/site/locations.spec.ts`
- Delete: `apps/web/components/SeatingMap.tsx` (after D5 and D11 move its users)

**Interfaces:**

```tsx
type CombMapProps = {
  layoutKey: "comb-75" | "comb-70-mirrored";
  mode: "live" | "pick" | "journey";
  seats?: { label: string; status: "AVAILABLE"|"RESERVED"|"OCCUPIED"|"CLEANING"; podType: "SINGLE"|"DUAL"; dualPartnerLabel?: string }[];
  selected?: string | null;                 // label
  onSelect?: (label: string) => void;       // pick mode only
  partySize?: 1 | 2;                        // highlights duos when 2
  journeyProgress?: number;                 // journey mode
  orientation?: "auto" | "portrait" | "landscape"; // auto: portrait under 768px (rotate 90deg in data: swap x/y)
};
```

- Rendering: SVG in feet, scaled with `viewBox`. Status is shown by fill plus pattern (`<pattern>` diagonal hatch for reserved, dots for cleaning).
- `RowZoom`: tapping a row animates `viewBox` to the row's bounds over 350 ms (instant with reduced motion), so pods render at 44px or more on 390px screens.
- Pinch-zoom uses pointer events.
- 3D: a "See it in 3D" button lazy-loads `components/plan/modules/floor-plan/three/FloorPlan3D` with a `layout` prop. FloorPlan3D gains an optional `layout` prop that defaults to the plan layout.

- [ ] **Step 1: Write failing tests:**
  - Component test with `renderToString`: `comb-70-mirrored` renders 70 `[data-pod]` nodes; the entry `data-zone="lobby"` is at x under 35 when mirrored and at 35 or more when not; labels read left to right (no `scale(-1` in the markup).
  - e2e: `/en/locations/university-place` shows 70 pods and `/en/locations/city-creek` shows 75. On iPhone 15, tapping row B zooms so the pod bounding box is at least 44px. The 3D button loads a canvas with `data-ready="1"` (launch with the swiftshader flags).
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement `CombMap` and the pages.
  - Location data comes from `GET /locations` plus `Location.i18n` for the name, address and landmarks.
  - The `/locations` index shows two cards and the "Coming Soon" list from `locations.comingSoon.*`.
  - Detail page heroes: `sign-pool` for City Creek and `storefront-queue` for University Place.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(site): CombMap and location pages`.

### Task D5: Order flow rebuild

**Files:**
- Rewrite: `apps/web/app/[locale]/order/page.tsx`, `order/location-selector.tsx`, `order/location/[locationId]/page.tsx`, `order/location/[locationId]/_components/enhanced-menu-builder.tsx` (split into `components/site/order/{BowlBuilder.tsx,StepSheet.tsx,ArrivalPicker.tsx,PodStep.tsx,SavingsStep.tsx,PayStep.tsx}`), `order/payment/page.tsx`, `order/payment/payment-form.tsx`
- Modify: `components/payments/{StripeProvider.tsx,PaymentForm.tsx}` (take `locale`; wire "Save this card" through `savePaymentMethod` to A6's `createPaymentIntent`)
- Delete: `order/location/[locationId]/menu-builder.tsx`, plus the `.backup` and `.broken` files under `app/[locale]/order`
- Create: `tests/e2e/site/order.spec.ts`

**Behavior:**
- Steps: location, then bowl, then arrival, then pod, then savings, then pay.
- Each step is a `StepSheet` with a sticky bottom CTA above the dock. The dock hides during the order flow, and a Back chevron shows in the top bar.
- Pod step: "Best pod for you" is selected by default, and the result shows the label (for example "Pod B-07, 20 steps from the entrance"). "Choose my own" opens `CombMap mode="pick"`.
- Savings step: credits (with an expiring-soon hint), promo, gift card, and rewards (a free bowl makes the bowl line $0).
- Pay step: Stripe Payment Element plus Express Checkout with `locale`. The `returnUrl` includes the locale prefix (fixing `payment-form.tsx:842,1419`).
- Prices come from `POST /orders/quote`. The client never computes totals.

- [ ] **Step 1:** Write the spec on iPhone 15, in en and zh-TW:
  - Best-pod order with the test card reaches the status page, and the order shows the pod label.
  - Choose-my-own selects `A-03`, and the order has `A-03`.
  - Applying a free-bowl reward (seed one for the test user) makes the total equal tax only.
  - Changing locale mid-flow keeps the cart (the cart lives in `sessionStorage` under `oh-order-draft`).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(site): one-handed order flow on shared order service`.

### Task D6: After-order pages (status, confirmation, check-in, scan, pod)

**Files:**
- Rewrite: `app/[locale]/order/{status,confirmation,check-in,scan}/page.tsx`, `app/[locale]/pod/page.tsx`
- Create: `components/site/order/{StatusTimeline.tsx,PodCard.tsx}`
- Messages: move the roast, fortune and commentary strings from `order/status/page.tsx` into `orderStatus.lines.*` in all 4 locales.
- Test: `tests/e2e/site/after-order.spec.ts`

**Behavior:**
- The status timeline uses `PHONE_STAGES` from `@oh/floor-plan`.
- The icons are custom SVGs, replacing the 55 emoji.
- Confirmation calls `confirmPayment` (A7).
- The pod page is translated and shows `CombMap mode="live"` with your pod highlighted.

**Plan demo contract (must keep):**
- `?embed=1` renders with no shell, dock or Chappy.
- `?demoSync=parent` follows `{type:"oh-status-demo", stage}` postMessages.
- `DEMO-PLAN.<STAGE>` codes render the synthetic order.
- The AI routes (feed, fortune, roast, backstory) are still called.
- The page fits the 390x844 `PhoneFrame`.

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. The spec asserts:
  - No emoji in the DOM (`/\p{Extended_Pictographic}/u` on `innerText`), and a zh-CN render with no leak.
  - **Plan demo regression:** `/en/order/status?orderQrCode=DEMO-PLAN.PREPPING&embed=1` has no `[data-site-dock]`, shows the PREPPING stage, and changes stage when the test posts `{type:"oh-status-demo", stage:"READY"}`.
  - Plan `/en/plan/experience` (code `OH-PEPPER-7871`) still shows the phone with the status page inside it.

  Commit with `feat(site): after-order pages`.

### Task D7: Rewards page and the path simulator

**Files:**
- Create:
  - `app/[locale]/rewards/page.tsx`
  - `components/site/rewards/{Climb.tsx,TierCards.tsx,PathSimulator.tsx,CreditTimeline.tsx,SealGallery.tsx,ReferralPanel.tsx}`
  - `apps/web/lib/site/simulate.ts`, `apps/web/lib/site/__tests__/simulate.test.ts`
  - `tests/e2e/site/rewards.spec.ts`
- Modify: `apps/web/next.config.*` (redirect `/:locale/loyalty` to `/:locale/rewards`, permanent 308)
- Delete: `app/[locale]/loyalty/page.tsx`

**Interface:**

```ts
export function simulate(program: PublicProgram, input: { bowlsPerMonth: number; friendsPerMonth: number; avgTicketCents: number; months: number }):
  { tierDates: { tier: string; month: number | null }[]; freeBowls: number; cashbackCents: number; timeline: { month: number; tier: string; orders: number; referrals: number }[] }
```

  - Referrals are capped per program (10 per 30 days).
  - A month in which both needs are met triggers an upgrade, and progress resets.

- [ ] **Step 1: Write failing tests:**
  - `simulate(program, {bowlsPerMonth:4, friendsPerMonth:1, avgTicketCents:1799, months:24})`: Noodle Master in month 3 (10 orders by month 3, 2 referrals by month 2), and Beef Boss in month 10 (25 orders after the month-3 reset, reached at month 10 since 4 x 7 = 28; 5 referrals by month 8).
  - `freeBowls === 2`, and `cashbackCents` equals the hand-computed sum.
  - `friendsPerMonth: 0` means no upgrade ever, and the dates are `month: null`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement `simulate`, then the page. The sections are in the spec (section 6). Program data comes from `GET /membership/program` (server component fetch, revalidated every 3600 s). The Beef Boss foil is a CSS `background: conic-gradient(...)` whose angle follows `--progress`.
- [ ] **Step 4:** Write the e2e: on iPhone 15, moving the friends slider to 0 shows the translated "never" state, and `/zh-TW/loyalty` redirects to `/zh-TW/rewards`.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit with `feat(site): rewards page with live path simulator`.

### Task D8: Member passport, welcome, and tier-up

**Files:**
- Rewrite: `app/[locale]/member/page.tsx`, `member/member-dashboard.tsx` (split into `components/site/member/{Passport.tsx,ProgressArcs.tsx,RewardsWallet.tsx,CreditsCard.tsx,SealCollection.tsx,WelcomeSheet.tsx,TierUpMoment.tsx}`), `member/orders/page.tsx`, `member/credits/page.tsx`
- API: add `POST /users/:id/moments {welcomeSeen?:true, tierCelebrated?:tier}` in `membership/routes.js`, with `requireSelf`.
- Test: `tests/e2e/site/member.spec.ts`

**Behavior:**
- Everything comes from `profileForUser` (A5).
- The welcome sheet shows when `welcomeSeenAt` is null.
- The tier-up moment shows when `lastTierCelebrated !== membershipTier`: a seal stamp animation, the free-bowl reveal, and `navigator.vibrate?.(30)`.
- Badge and challenge names come from `i18n[locale]`, falling back to en only if a DB row is missing a locale. The F1 seed makes that impossible, and a test asserts it.

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. The spec covers:
  - A fresh test user sees the welcome sheet once.
  - After forcing a tier (with the admin API key on dev), the tier-up moment shows once and then never again.
  - Arcs show `orders 3/10` and `referrals 1/2` from the seeded data.
  - zh-TW shows no English.

  Commit with `feat(site): member passport, welcome and tier-up moments`.

### Task D9: Referral and challenges

**Files:**
- Rewrite: `app/[locale]/referral/{page.tsx,referral-dashboard.tsx}`, `app/[locale]/challenges/meal-for-stranger/page.tsx`, `components/MealGiftModal.tsx` (moved to `components/site/gift/MealGiftSheet.tsx`)
- Test: `tests/e2e/site/referral.spec.ts`

**Behavior:**
- Referral uses `navigator.share` with a copy fallback.
- Cap messaging comes from the program ("up to 10 paid referrals every 30 days").
- Earnings come from the `CreditLot`s with source `REFERRAL`.

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. Commit with `feat(site): referral and challenges`.

### Task D10: Store and gift cards

**Files:**
- Rewrite: `app/[locale]/store/**` and `app/[locale]/gift-cards/**` (all pages)
- Modify: `contexts/cart-context.tsx` (only the strings move)
- Test: `tests/e2e/site/store.spec.ts`

**Behavior:**
- The store hero is `store-interior`. Products use the existing `public/store/*` images, except that the bowl product uses `bowl-empty` and the chopsticks use `chopsticks`, matched by slug.
- `/store/placeholder.png` is replaced by `bowl-flatlay`.
- The gift-card visual is `bowl-flatlay`, and the purchase and balance pages are fully translated (fixing the 35 missing `giftCards.purchase.*` keys).

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. The spec covers a gift-card purchase with the test card in es, and a store cart in zh-CN. Commit with `feat(site): store and gift cards`.

### Task D11: Contact, legal, cleanup, group lobby, CNY

**Files:**
- Rewrite: `app/[locale]/{contact,privacy,accessibility,sms-consent}/page.tsx`. Contact posts to `POST /support/cases {type:"CONTACT"}`.
- Rewrite: `app/[locale]/group/[code]/{page.tsx,group-lobby.tsx}` and `order/group-payment/*` (CombMap pick mode, translated, the new payment confirm)
- Translate: `app/[locale]/cny/**` (strings only; the layout is unchanged)
- Delete: `app/[locale]/tenants/page.tsx`, and the `.DS_Store`, `._*` and `.ai` files in `apps/web/public`
- Test: `tests/e2e/site/misc.spec.ts`

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. The spec covers:
  - Submitting the contact form creates an OPEN support case (checked with the admin key).
  - `/en/tenants` returns 404.
  - The group lobby in zh-TW shows the CombMap and no English legend.

  Commit with `feat(site): contact, legal, group lobby, CNY translations, cleanup`.

### Task D12: Kiosk seat map, admin seat labels, admin Support tab

**Files:**
- Modify: the kiosk pod picker under `apps/web/app/[locale]/kiosk/**`, switching the `SeatingMap` import to `CombMap mode="pick"` (the kiosk is a landscape tablet, so `orientation="landscape"`)
- Modify: admin seat and pod views (`grep -rn "seat\|pod" apps/admin/app --include=*.tsx -l` to find them): show `label`
- Create: `apps/admin/app/support/{page.tsx,[id]/page.tsx}` (list by status; case detail with transcript, order and customer context; action buttons **Give credit** (amount), **Refund full order**, **Decline** (reason), and no partial-refund input)
- Modify: the admin nav, to add Support
- Test: `tests/e2e/site/admin-support.spec.ts` (on devadmin)

- [ ] **Steps 1 to 5:** Follow the Phase D pattern. The spec covers a case created through Chappy (Task E) or the contact form appearing in admin; the refund dialog having no amount field; and a resolve updating the status. Commit with `feat(admin): support queue; kiosk and admin on comb seats`.

---

## Phase E: Chappy web widget

### Task E1: Widget shell, streaming client, identity, translations

**Files:**
- Create: `apps/web/components/site/chappy/{ChappyProvider.tsx,ChappySheet.tsx,ChappyPanel.tsx,Composer.tsx,MessageList.tsx,useChappyStream.ts,guest.ts}`, `components/site/chappy/__tests__/stream.test.ts`
- Delete: `apps/web/components/ChappyChat.tsx`, `apps/web/components/ChappyChatWrapper.tsx`
- Messages: a new `chappyWeb.*` namespace in all 4 locales (welcome, placeholder, tool status labels, quick actions, errors: RATE, BUDGET, REFUSAL, SIGN_IN_REQUIRED, OFFLINE)

**Interfaces:**
- `useChappyStream({ locale }) -> { messages, send(text), status, reset() }`.
  - Uses `fetch(POST ${API}/chappy/chat, { headers: { Authorization: Bearer <Clerk token> | "x-chappy-guest": <token> }, body })`.
  - Parses SSE from `response.body` with a `TextDecoderStream`.
  - Keeps a stable identity (fixes `ChappyChat.tsx:131,203`).
- `ChappyProvider` exposes `openChappy(prefill?: string)` to the dock and to "Ask Chappy" links.
- Phone: `ChappySheet` goes full screen with `visualViewport` resize handling, so the composer stays above the keyboard. The composer text is 16px.
- 768px and up: `ChappyPanel` is a 420px side panel.

- [ ] **Step 1:** Write the failing unit test: the SSE parser handles chunk boundaries mid-event, and events are delivered in order.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Write `tests/e2e/site/chappy.spec.ts`:
  - Guest on iPhone 15: opening Chappy from the dock shows the translated welcome in zh-TW; "what time do you close" gets a reply containing hours; the composer is visible after focusing, with the keyboard simulated by `page.setViewportSize({width:390,height:500})`.
  - Signed-in user: "order my usual" shows a pay card.
- [ ] **Step 5:** Run it. Expected: PASS. The spec uses the live model on dev; mark it `@live` and run it on demand.
- [ ] **Step 6:** Commit with `feat(chappy): mobile sheet widget with streaming and verified identity`.

### Task E2: Native cards

**Files:**
- Create: `apps/web/components/site/chappy/cards/{MenuItemCard.tsx,CartCard.tsx,PodCard.tsx,PayCard.tsx,OrderTrackerCard.tsx,RewardCard.tsx,SignInCard.tsx,SupportCaseCard.tsx,index.ts}`

**Interface:** `renderCard(card: ChappyCard)`, a discriminated union on `card.type` that mirrors the B2 tool outputs.
- `PayCard` mounts the Stripe Payment Element and Express Checkout with the returned `clientSecret`. On success it calls `confirmPayment` (A7) and posts a system note back to the conversation.
- `PodCard` embeds `CombMap mode="pick"` scaled to the card.

- [ ] **Step 1:** Write a component test: each card type renders with an `aria-label` and no literal English (the C5 literal-JSX test covers this folder).
- [ ] **Step 2:** Write the e2e: a signed-in user completes a full chat order through the PayCard with the test card, and the order reaches PAID. "My bowl was cold" on yesterday's order gives a SupportCaseCard showing a store credit of $5 or less, and no card refund.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(chappy): native cards incl. human-tap pay card`.

---

## Phase F: Content and translations

### Task F1: Complete translations and database content in all locales

**Files:**
- Modify: `apps/web/messages/{zh-TW,zh-CN,es}.json`. Fill every non-plan key: the 94 known gaps, plus every key added in Phases C to E that's still in draft.
- Modify: `packages/db/prisma/seed-prod.ts`:
  - Badges and challenges get `iconKey` and `i18n` for all 4 locales, with no emoji, keeping the existing slugs.
  - Slider configs get `labelsI18n`.
  - Locations get `i18n` and `slug`.
- Create: `packages/db/scripts/backfill-i18n.ts` (idempotent update of existing rows by slug, for dev and prod)
- Create: `docs/i18n-review-2026-09.md` (a table of every new or changed key with en, zh-TW, zh-CN and es, for native review)

- [ ] **Step 1:** Flip the `it.fails` guards (C2 no-emoji, C5 parity, literal-JSX, em dash) back to `it`.
- [ ] **Step 2:** Run `pnpm --filter @oh/web test`. Expected: FAIL, with the remaining keys, literals and emoji listed.
- [ ] **Step 3:** Translate.
  - zh-TW uses Taiwan usage and zh-CN mainland usage. Don't just convert zh-TW to simplified; check the vocabulary, for example 外帶 versus 外带/打包, and 點餐 versus 点餐.
  - Brand terms: tier names stay translated per the existing `loyalty.tiers.*` translations.
  - Run `backfill-i18n.ts` on local.
- [ ] **Step 4:** Run all the guards plus `tests/e2e/site/english-leak.spec.ts`. Expected: PASS with zero hits.
- [ ] **Step 5:** Commit with `feat(i18n): complete zh-TW, zh-CN and es coverage for the customer site`.

### Task F2: Localized notifications

**Files:**
- Modify: `packages/api/src/notifications.js` (`sendOrderConfirmation` and the new `sendTierUp` and `sendCreditExpiryWarning` pick templates by `user.locale`), `apps/web/components/LanguageTracker.tsx` (`PATCH /users/:id {locale}` when a signed-in user changes locale)
- Create: `packages/api/src/notifications/templates/{en,zh-TW,zh-CN,es}.js`, `packages/api/src/notifications/__tests__/templates.test.js`

- [ ] **Step 1:** Write tests: all 4 template files export the same keys, and a zh-TW user's confirmation SMS body has no Latin words outside the allowlist (the same regex as C5).
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Hook `expireLots` and `expiringSoon` into the daily cron to send the warning.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(notifications): localized order, tier-up and expiry messages`.

---

## Phase G: Verification and release preparation

### Task G1: Full mobile e2e and overflow sweep

**Files:**
- Create: `tests/e2e/site/sweep.spec.ts`
- Modify: `playwright.config.ts` (projects `iphone15` from `devices["iPhone 15"]`, `pixel8` from `devices["Pixel 7"]` with a 412x915 override, and `desktop` at 1440x900; `baseURL` `https://devwebapp.ohbeef.com`)

- [ ] **Step 1:** Write the sweep. For every route in `lib/site/routes.ts`, in all 4 locales, on iphone15 and pixel8, assert:
  - No horizontal overflow (**Review Focus 5**).
  - No element with `innerText` wider than its container (`el.scrollWidth > el.clientWidth + 1` on buttons, dock items and cards).
  - Zero axe violations.
  - No emoji.
  - No console errors.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/site`. Expected: PASS for all specs. Fix failures in the owning page's files, and commit each fix separately.
- [ ] **Step 3:** Save screenshots of every route at 390 and 1440 for en and zh-TW to `docs/site-screenshots/` (gitignored), and review them.
- [ ] **Step 4:** Commit with `test(e2e): mobile-first sweep across routes and locales`.

### Task G2: Performance and Lighthouse

**Files:**
- Create: `scripts/site-lighthouse.mjs` (the `lighthouse` npm package run programmatically against dev with the mobile preset; writes `docs/site-lighthouse-2026-09.md`)

- [ ] **Step 1:** Run it against every customer route. Targets: performance 85 or higher, accessibility 100, LCP under 2.5 s.
- [ ] **Step 2:** For each miss, fix the cause: check `next build` bundle output per route (in a separate worktree `.next`, never the dev server's), lazy imports, and image `sizes`. Re-run until every route hits target.
- [ ] **Step 3:** Commit with `perf(site): meet mobile budget on all customer routes`.

### Task G3: Cutover runbook and scripts; whole-branch review

**Files:**
- Create: `packages/db/scripts/cutover-credit-lots.ts` (runs `convertLegacyBalances`, then pays out every undisbursed `PendingCredit` via `grantCredit(source REFERRAL)` and marks them disbursed; supports `--dry-run`)
- Create: `docs/runbooks/site-overhaul-cutover.md`, containing:
  1. Apply `20260928000000_site_overhaul/migration.sql` to Railway Postgres with psql (URL from `.env.prod-bak`).
  2. Run `seed-comb-seats --all` and `backfill-i18n` against prod.
  3. Run `cutover-credit-lots --dry-run`, review it, then run it for real.
  4. Generate and print the new pod QR codes from admin. Confirm every prod `KioskDevice` has its `apiKey` set on its tablet (keyless kiosks lose member-QR check-in after A10b).
  5. Set Railway variables: `CHAPPY_GUEST_SECRET`, `CHAPPY_LIMITS_JSON`, `CHAPPY_MODEL` (optional).
  6. Deploy Railway, then Vercel. Verify `prisma` is a dependency, not a devDependency (memory: railway-prisma-build).
  7. Run the prod smoke test (the G1 subset against www, with a Stripe live-mode $0 path using a reward, so there's no real charge).
  8. Rollback steps.
- [ ] **Step 1:** Write the tests: `cutover-credit-lots` in dry-run makes no writes, and a real run is idempotent (memory stub).
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement, and run it on local dev.
- [ ] **Step 4:** Run everything: `pnpm --filter @oh/web test`, `pnpm --filter @oh/api test`, `pnpm --filter @oh/floor-plan test`, `pnpm --filter @oh/plan-model test`, `pnpm --filter @oh/web typecheck:plan` and `npx playwright test tests/e2e/site`. Expected: all PASS.
- [ ] **Step 5:** Request a whole-branch review with superpowers:requesting-code-review, and address the findings with superpowers:receiving-code-review.
- [ ] **Step 6:** Commit with `chore(release): cutover runbook and credit-lot migration script`. Then STOP. Tell the owner the branch is ready, and deploy nothing until they say so.

---

## Verification (end to end)

1. **Unit:** the web, api, floor-plan and plan-model suites are all green. The guards (no emoji, locale parity, no literal JSX, no em dash, images deny list, globals) are live.
2. **E2E on dev** (`devwebapp.ohbeef.com`, iPhone 15 and Pixel 8 first, then desktop):
   - Home story, menu, experience, locations with 75 and 70 mirrored pods.
   - Web order with best pod and with choose-my-own.
   - Chappy guest Q&A, Chappy order through the pay card, and Chappy issue leading to store credit plus a support case.
   - Admin support resolve, with full refund only.
   - Rewards simulator, member passport, welcome and tier-up moments.
   - All 4 locales, with no English leak in zh-TW or zh-CN.
3. **Security:**
   - Direct `PATCH /orders/:id {paymentStatus:"PAID"}` returns 400.
   - A forged `userId` to Chappy is ignored.
   - `/users/by-email` for another email returns 403.
   - The refund endpoint rejects `amountCents`.
4. **Performance:** Lighthouse mobile of 85+ on every route, LCP under 2.5 s, zero axe violations.
5. **The business plan is unchanged:** the `/plan/floor-plan` snapshot is identical, and plan print is still 13 of 13.
