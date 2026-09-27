# @oh/plan-model change log

The engine is the plan's source of truth. Every change to a preset, a formula or a
registry entry is logged here and in `src/changelog.ts` (`MODEL_CHANGELOG`, read by the
Model integrity section), with a dated snapshot in `MODEL_SNAPSHOTS` that a test holds
equal to the live engine. Owner-choice rows are marked **owner**; everything else is a
review finding applied to the base case.

## 2026.09.27: community giving pledge

Model version `2026.09.27`. **owner**: every company restaurant gives 1% of revenue to
ONE RED STEP AT A TIME®, a mental-health 501(c)(3) (EIN 33-7041706). New field
`communityGivingPct` (0.01 in all three scenarios, 0 in the legacy spec), new opex cost
line `communityGiving` (variable, below gross profit), registry key
`unit.communityGivingPct`, lever bounds 0 to 3% in 0.25% steps. DECISIONS.md item 35.

- Related party, disclosed: the foundation's founder is the owner's best friend; the
  owner serves as the foundation's volunteer CTO and receives no compensation from it.
- Guest donations made through the order-status CTA go straight to the foundation and
  are not Oh! revenue. Franchise units carry no pledge cost to Oh!.
- Revenue, check, labor and capex do not move. Every EBITDA-driven figure falls by
  exactly 1% of revenue:

| Metric (base) | 2026.09.26 | 2026.09.27 |
|---|---|---|
| Unit EBITDA | $473,010 (14.5%) | $440,367 (13.5%) |
| Pledge per unit | none | $32,643 a year |
| Break-even | 306 covers a day | 313 covers a day |
| Flagship payback from opening | 4.3 years | 4.7 years |
| Minimum cash | $231,735 (end of year 1) | $149,343 (end of year 3) |
| Year-5 exit EBITDA (5x) | $645,638 | $471,419 |
| Partner multiple, year 5 (common / preferred) | 0.18x / 0.37x | 0.13x / 0.27x |
| Partner multiple, year 7 hybrid (common / preferred) | 0.98x / 1.71x | 0.92x / 1.64x |
| Conservative unit EBITDA | -3.6% | -4.6% |
| Aggressive unit EBITDA | 20.2% | 19.2% |

The base now sits a point and a half under the 15% public target; the target does not
change and the plan says so. Scorecard unchanged at 12 pass, 5 watch, 1 fail; every
invariant passes.

## 2026.09.26: re-baseline after the diligence review

Model version `2026.09.26`. Share-link version 2 (version-1 links fail closed). The
2026-09-25 presets are frozen verbatim in `src/assumptions/legacy-spec.ts` and the spec
tables are still proven against them by `spec-anchors.test.ts` (retitled "spec drift").

### Headline movement (base case)

| Metric | 2026.09.25 | 2026.09.26 |
|---|---|---|
| Operating days | 355 | 313 (**owner**: closed Sundays) |
| Average check | $26.30 (asserted) | $23.18 (derived from the reset menu) |
| Unit revenue | $4,201,425 ($1,200/sf) | $3,264,340 ($933/sf) |
| Food cost | 30.0% | 32.7% (bowl-level build, Prime and American Wagyu) |
| Labor | 13.9% (7 FTE) | 23.9% (11.7 FTE from a 75-hour coverage schedule) |
| Four-wall EBITDA | 29.7% | 14.5% |
| Break-even | 173 covers/day | 306 covers/day |
| Flagship payback (steady / from opening) | 1.4 / 1.4 yr | 3.6 / 4.3 yr |
| Corporate overhead, year 5 | none | $2.88M (lean case $2.39M) |
| Franchise units, end of year 5 | 36 | 7 (**owner**: phased schedule) |
| Exit-year-5 EBITDA for the partner math | $11.74M | $0.65M (consolidated, recurring only) |
| Partner headline stake / multiple | 45% / 3.02x | 49% cap binds / 0.18x (0.37x under the preferred construct) |
| Year-7 hybrid case (6x) | not modeled | exit EBITDA $3.00M, partner 0.98x common, 1.71x preferred, cap binds |
| Public four-wall target | 25% | 15%, 20% stretch (**owner**) |

### Semantic changes (documented, not silent)

- `PlatformYear.royalties` and `PlatformYear.unitFees` are now what the brand receives
  (after the master's share and an FX haircut). The franchisee-paid figures are alongside as
  `grossRoyalties` and `grossUnitFees`. `companyRevenue` uses the brand figures.
- `OwnershipModel.exitEbitda` is consolidated and recurring only: unit EBITDA less corporate
  overhead plus recurring franchise profit and platform gross profit. Territory fees, unit
  fees and pre-opening are excluded unless `PartnershipTerms.recurringOnlyExit` is false.
- `PartnershipTerms.distributionPct` applies to post-tax free cash flow, not unit EBITDA.
- `PartnershipTerms.franchiseMarginPct` is deprecated and ignored; `STRUCTURE_ECONOMICS` in
  `platform.ts` carries franchise cost and share by deal structure.

Everything else is additive: existing fields keep their names and meanings (`PortfolioYear.revenue`
and `.ebitda` stay four-wall), new fields have defaults, and derived drivers (menu to check fields
and `foodCostPct`, coverage hours to `kitchenFTE`) are computed when the presets are built so
sliders, tornado, Monte Carlo and share links keep working.

### Changed fields (finding id, old, new, why)

Revenue
- R1 `operatingDaysPerYear` 355 -> 313. **owner**. Closed Sundays.
- R2 `avgBowlPrice` 19.50 -> 19.39; `addOnAttachRate` 0.62 -> 0.60; `avgAddOnSpend` 6.25 -> 3.90; `beverageAttachRate` 0.55 -> 0.40; `avgBeverageSpend` 4.50 -> 2.49. The check is derived from the live menu by `computeMenu` (`menu.ts`): $17.99 / $27.99 / $12.99 at a 68 / 20 / 12 mix (**owner**: menu reset as the base; conservative keeps $15.99 / $23.99 / $10.99).
- R3 `discountsCompsPct` new, 1.5%. Fast-casual 1% to 2%.
- R5 `salesTaxPct` new, 8.35%. Prices are tax-exclusive, revenue net; card processing is charged on the gross ticket.
- R6 escalators new: rent 3%, wages 3.5%, COGS 3%, menu price 2.5% a year from a unit's second year.

Cost of sales
- C1 `foodCostPct` 0.30 -> 0.327 (conservative 0.365). Bowl-level build: USDA Prime $6.25/lb ($5.50 to $7.00), American Wagyu $11.00/lb ($9.00 to $13.00), 55% cooked yield, 4.0 / 4.5 oz cooked, $3.10 base bowl, add-on 33%, beverage 28%, retail 50%, 2% waste. Supplier quotes are an open item. The review estimated 33.5% / 37.4%; the documented inputs compute 32.7% / 36.5%, and the engine's figure is what is pinned.
- C2 `memberProgramPct` new, 1.4%, plus `memberSwagAnnual` $30,000 (about 2.1% all-in). **owner**: recommended program design (instant referrals paid on the friend's first order, $5 moved to first order, 90-day expiry).

Labor
- L1 `kitchenFTE` 7 -> 11.7, from `kitchenHoursPerDay` 75 (new) and `coverageFactorPct` 4% (new) over 313 days at 2,080 hours (`labor.ts`). Conservative 70 h -> 11.0; aggressive 85 h -> 13.3.
- L2 `payrollBurdenPct` 0.18 -> 0.22. Health benefits for a salaried no-tip team.
- L3 `avgKitchenWage` $24 -> $21; `avgManagerSalary` $72,000 -> $63,500. Utah County market by role.

Other operating
- O1 `gaPct` 2.5% -> 1.5% (corporate G&A moved to `overhead.ts`). O2 `contingencyPct` 2% -> 1%. O3 `paymentProcessingPct` 2.7% -> 3.0% on the gross ticket. O4 `utilitiesPct` 3% -> 2.5%; `suppliesPct` 2.2% -> 1.5%.

Corporate
- K1 corporate overhead new (`overhead.ts`): founder $180,000 (**owner**) from T0-9, fractional CFO then controller, marketing, Oh! OS engineering 1 -> 4, support, Director of Operations at T0+10, HR, supply chain, EA, analytics, training, franchise development from year 3, franchise support 1 per 10 units, international development from year 4; legal, accounting and audit, FDD build and renewals, state registrations, international filings, D&O, key-person, travel, office, tools; 18% burden. Full: $1.01M / $1.50M / $2.15M / $2.67M / $2.88M. Lean (staged behind deals): $0.82M / $1.08M / $1.36M / $1.82M / $2.39M. The plan's item-9 targets of $3.6M / $5.0M in years 4 and 5 were not adopted: the cash test cannot bear them and the review's own text put year 5 at about $3.0M.
- K2 the $600K platform build (round 1) and $1.0M corporate infrastructure (round 2) are cash out in years 1 and 2, amortized over five years.
- K3 `computeDepreciation` new: pods, kitchen, FF&E 7 years; buildout net of TI 10; tech 3; design 10. About $208K a year for the flagship, $174K for later units.
- K4 `maintenanceCapexPct` new, 1.5% of revenue from a unit's second year.
- K5 `preOpening` $185,000 -> $110,000 (later units $140,000 -> $90,000), expensed over `preOpeningMonths` 3 (new) instead of capitalized; M1 `launchMarketing` new, $75,000 / $50,000, so the $1,710,000 / $1,411,000 totals hold.
- K6 `taxDistributionRate` new, 37%, on taxable income after a loss carryforward; distributions are 50% of post-tax free cash flow.
- Portfolio now emits pre-opening expense, overhead, consolidated EBITDA, depreciation, tax distributions, maintenance capex, growth capex, investments, equity raised, free cash flow and cumulative cash seeded with the rounds ($3.2M in year 1, $7.5M in year 2). `computeCompany` (`company.ts`) adds the franchise contribution and platform gross profit.

Ramp
- P1 `rampCurve` 18 months opening at 1.18 and plateauing at 1.06 -> 12 months `[0.70, 1.05, 1.00, 0.85, 0.78, 0.78, 0.82, 0.86, 0.90, 0.94, 0.97, 1.00]`; `rampPlateau` 1.06 -> 1.00. The month 4 to 6 trough is kept.

Franchise
- F1 phased `FRANCHISE_MARKETS` (**owner**): Las Vegas and Seattle signed year 3 and open year 4; Los Angeles, New York, Taipei year 4 to 5; Singapore, London, Melbourne year 5 to 6; Paris and Tokyo year 7; wave two (16 markets) territory year 8 with units from year 8. Units open: 0 / 0 / 0 / 2 / 7 / 15 / 27 through year 7.
- F2 `STRUCTURE_ECONOMICS` new: area franchise 100% of royalty and unit fee, $30K sales, $25K entry, $25K opening support, $12K per unit per year; master 50% / 50%, $75K per market plus $5K per unit, $120K entry, $50K first opening then $15K, $10K per unit per year; sub-franchise 25%, $60K entry, $10K opening, $6K per unit; 3% FX haircut on non-USD royalties (`FranchiseMarket.currency`, new).
- F3 JVs (Tokyo, Shanghai, Beijing, Chengdu) -> master franchises (**owner**).
- F4 territory and unit fees are company revenue when earned and excluded from `recurringFranchiseProfit`.

Ownership
- W1 preferred construct (**owner**): `preferredReturnPct` 8% simple on each tranche from the year after it lands, `liquidationPreference` 1x, common derived and capped at 49%; `partnerCapitalSchedule` $3.0M year 1 and $7.5M year 2; `exitYear` option 5 or 7; hybrid 6x multiple gated on recurring franchise profit at or above 25% of exit EBITDA. `cappedByOwner`, `partnerMultipleAtHeadline` and `impliedMultipleAtCap` are surfaced so the gap is never hidden.
- T1 `PUBLIC_EBITDA_TARGET` 0.25 -> 0.15; `MATURITY_EBITDA_TARGET` 0.20 (**owner**).

Integrity engine (new)
- `version.ts`, `registry.ts` (`ASSUMPTION_REGISTRY` as a Record over every assumption key, dynamic groups for schedule, markets, structures, overhead and rounds, `registryRows`, `registryAnchor`), `benchmarks.ts` (18 rows with pass and watch bands, `computeScorecard`), `checks.ts` (12 invariants, `runInvariants`), `changelog.ts` (`MODEL_CHANGELOG`, `MODEL_SNAPSHOTS`, `headlineDeltas`), and a committed test manifest `src/generated/test-manifest.ts` written by `scripts/test-manifest.mjs` (`pnpm --filter @oh/plan-model test:manifest`, run last) with a freshness test.

### Base-case scorecard at this version

Pass: food cost, labor, prime cost, occupancy, four-wall EBITDA, revenue per square foot, sales per pod, capex per unit and per pod, royalty, franchise segment margin, exit multiple. Watch: other operating 24.3% (carries the member program and comps), flagship payback 3.6 years, break-even at 68% of base covers, corporate overhead 8.1% of year-5 system sales, unit fee $55K. Fail: partner multiple 0.18x at the 49% cap.

### What the re-baseline says plainly

- The five corporate units on their own do not carry the HQ: corporate-only cumulative cash goes negative from year 3; the franchise contribution and platform gross profit are what keep the company's cash positive (minimum $232K, end of year 1).
- The conservative case (22% at today's prices) loses money at the unit level (-3.6%) and runs out of cash; the review's "about 5%" estimate did not survive the cost layers.
- With $10.7M in, no modeled exit returns 3x: year 5 at 5x gives the partner 0.18x on common (0.37x preferred), year 7 at the 6x hybrid gives 0.98x (1.71x preferred). Re-sequencing the ask is a plan decision, not an engine one.

## 2026.09.25: spec presets with the owner decisions of 2026-09-25

Recorded in `DECISIONS.md` items 1 to 24 and in `MODEL_SNAPSHOTS[0]`: unit revenue $4,201,425, EBITDA 29.7%, payback 1.42 years, 45% partner at 3.02x on an exit EBITDA of $11,741,284, $10.7M raised, 36 franchise units by year 5, no corporate overhead.
