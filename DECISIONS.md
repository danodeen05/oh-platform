# Decision Log

Business and engineering decisions that are not derivable from the code.
Newest at the bottom. The interactive business plan spec
(`docs/OH_BUSINESS_PLAN_BUILD_SPEC.md`) supersedes earlier decisions where they conflict.

| When | Decision | Why |
|---|---|---|
| Sep 2026 | Pivot back to the two-location dine-in concept; catering is admin-only | Physical-location deal with investors moving fast; the site and plan must match |
| Sep 2026 | 75 pods / 3,500 sq ft standard footprint | Partner-driven acceleration; unit economics improve materially at 75 pods with same kitchen |
| Sep 2026 | Pod-count constants: nothing in code used 40. Seeds use 12 pods per location and were left alone | Changing seeded seats is a data change for prod and needs its own go-ahead |
| Sep 2026 | Plan access uses per-recipient codes and an `oh_plan` JWT, not Clerk | Recipients must not have to create an account (spec 4.1) |
| Sep 2026 | All plan DB access lives in the Fastify API behind `PLAN_API_KEY`; Next route handlers are thin proxies | `apps/web` has no Prisma; one data path |

## Financial engine (`packages/plan-model`), Sep 2026

The spec's tables do not all reconcile with its assumption list. The engine is the
source of truth and the plan copy reads from it. Each item below is an owner decision
taken with a stated default; flip the constant and the tests say what moved.

| # | Item | Decision | Effect |
|---|---|---|---|
| 1 | Base average check | `retailAttachRate` 0.025 (spec 5.3 says 0.04) | Check is exactly $26.30 per spec 5.4; 0.04 gives $26.57 |
| 2 | Labor hours | Added `annualHoursPerFTE` = 1,850 | Reproduces spec 5.5 ($536,664, 12.8%, EBITDA 30.8%). CPA convention 2,080 gives $582,259 (13.9%) and EBITDA 29.7% |
| 3 | Year 1 flagship revenue and plateau | Engine wins: Y1 $4.01M (spec prose "~$3.90M"); ramp holds 1.06 after month 18 | Y2 is $4.40M, not $4.20M |
| 4 | Portfolio rollup | Keep spec 5.8 offsets (T0+4/7/10/13); years counted from flagship opening | Corporate revenue Y1 $9.3M / Y2 $20.2M / Y3 $22.2M vs spec table 3.9 / 9.4 / 20.1. Materially larger Y1 promise; owner to confirm |
| 5 | Cost table basis | Spec 5.5 amounts are on a rounded $4.2M basis | Tests assert percentages exactly and amounts within $1 at that basis; one golden test pins exact-revenue EBITDA $1,294,124 |
| 6 | Payback definitions | `fromStabilization` = capex ÷ (EBITDA − debt service) = 1.56 yrs; `fromOpening` = cumulative levered ramp cash flow = 1.60 yrs | Spec's "~2.3 years from opening" does not reproduce under any natural definition |
| 7 | Conservative EBITDA / DSCR | Engine gives $628K and 3.15x (spec prose ~$610K, ~3.0x) | Prose reads from the engine |
| 8 | SBA rate | 6.0% preset (matches spec's ~$200K/yr); real 7(a) pricing ≈ Prime + 2.75–3.0% | Rate exposed as a lender lever in Funding; at 10.75% debt service is ~$243K and base DSCR ~5.3x |
| 9 | "System revenue" Y4/Y5 | Engine exposes `companyRevenue` and `systemWideSales` separately | Spec's "~$52M system" in Y5 only reproduces as company revenue incl. fees and royalties (~$53.6M), not franchisee gross sales |
| 10 | Platform revenue from corporate units | Corporate units transfer 1.8% of revenue (internal); franchisees pay the $1,800/mo license; ARR headline = $1,800 × all locations | Internal transfer is excluded from company revenue |
| 11 | US metro assumptions | NYC/LA/Vegas/Seattle open T0+37/40/43/46 with market overrides (rent, wage, price, utilization) tuned to $5.5–6.5M AUV | Not in spec; engine assumptions flagged for owner review |
| 12 | Franchise schedule | First territories Y4 (Taipei, Tokyo, London, Singapore), Paris and Melbourne Y5; 31 franchise units by Y5, 40 system locations | Territory fees inside the spec's $250K–750K range; unit counts are engine assumptions |
| 13 | Round 1 uses | Flagship $1.71M, platform $600K, corporate and working capital $890K | Spec gives only the $3.2M total |
| 14 | Round 2 | Modeled at $10M midpoint | Spec gives $9M–11M |
| 15 | FX | Fixed illustrative rates dated 2026-09-01 | Spec 7.4: no live FX |
| 16 | Monte Carlo | Pure seeded function; UI runs it in a Web Worker | 5,000 runs ≈ 28 ms on the droplet; unit recalculation ≈ 0.05 ms |

Owner decisions taken 2026-09-25 (supersede items 2, 4, 8, 11, 12, 13, 14 above):

| # | Item | Decision | Effect |
|---|---|---|---|
| 17 | Labor hours | `annualHoursPerFTE` = 2,080 (CPA convention) | Labor $582,259 (13.9%), base EBITDA $1,248,529 (29.7%), conservative EBITDA $583K. Public target stays 25% |
| 18 | Opening dates | Locations 2 to 5 at T0+16/19/22/25 | Reproduces the spec 5.8 table: corporate revenue Y1 $4.0M, Y2 $9.7M, Y3 $20.2M. Section 2's "within 12 months" is superseded |
| 19 | No SBA loan | Base case carries no debt (`NO_DEBT`); `SBA_REFERENCE_LOAN` remains a lever for any lender conversation | DSCR is null in the base case; unlevered payback 1.37 yrs from stabilization, 1.42 yrs from opening |
| 20 | Single financial partner | Two equity rounds: $3.2M pre-opening ($3.0M partner + $200K founder) and $7.5M at about T0+12 for units 2 to 5, corporate infrastructure and reserve. Total $10.7M | `PARTNERSHIP_TERMS` and `computeOwnership` in `packages/plan-model/src/partnership.ts` |
| 21 | Partner ownership method | Derived, never asserted: partner % = (partner capital × target multiple) ÷ (exit-year EBITDA × exit multiple), rounded to 5%. Defaults: 3.0x over 5 years (≈25% IRR), 5.0x EBITDA exit (middle of the 4x to 6x small multi-unit range), 60% of royalties and unit fees reaching EBITDA. Checked against the 25% to 40% operator sweat-equity benchmark | Base case 51% → headline 50/50 (partner 2.9x at headline). Conservative 85% partner, aggressive 35%. Founder residual sits above the benchmark at base |
| 22 | Corporate vs franchise | Only the five Utah locations are corporate. From the sixth location on, everything is franchised: US metros (NYC, LA, Las Vegas, Seattle) as area-development franchises from year 4 with a $100K development fee and AUV indexes 1.3 to 1.5 ($5.5M to $6.3M); international master franchises and JVs per spec 5.9 | Portfolio has 5 locations; platform has 12 franchise units in Y4, 39 in Y5 (44 system), license ARR $950K in Y5 |
| 23 | Owners | Two-owner model: founder plus the financial partner, at the derived split. The 49/51 LLC structure from spec 10 is not rendered | Team and Governance shows founder + partner |

| 24 | Ownership ceiling and exit option | Partner ownership is capped at 49% (`partnerPctCap`); the founder keeps control in every scenario. The return math now counts yearly distributions (50% of corporate EBITDA) plus the exit, and rounds UP to 5% so the target is met, not just missed. `computeOwnershipImpact` shows the founder's distributions, exit proceeds and total for any split, target (3x or 5x) and exit multiple, plus `buyoutAtTarget`: the price to buy the partner out once they have their target, the owner's "option to get out" | Base: 43% by the math, 45% headline, partner 3.1x. Conservative caps at 49% (partner ~2.0x). Aggressive 30%. At 49%/3x the founder's five-year total is ~$37M and the buyout at target is ~$26M, cheaper than the partner's market stake |

Still open: US metro dates and fees (item 22 defaults accepted "for now"); confirm the 3x target, 5x exit multiple and 50% distribution rate with the partner before the Funding module ships.

## Plan shell (Phase 3), Sep 2026

| Item | Decision | Why |
|---|---|---|
| Tailwind v4 | Theme + utilities only, no preflight; utilities imported unlayered | The site's element rules (button, input, a, h1..h6, p) are unlayered, and a layered utility would lose to them regardless of specificity. Marketing pages verified byte-identical apart from the `next-size-adjust` meta that next/font adds |
| Fonts | Instrument Serif + Noto Sans TC/SC via next/font inside the plan layouts; body stays Raleway | Spec 3.2; keeps the marketing site's Google Fonts link untouched |
| Section visibility | A code's explicit allowlist wins; otherwise audience defaults (landlords do not see model, financials, sensitivity, funding) | Admin can always widen a specific code; defaults keep the capital stack away from landlords |
| Analytics | One visible section per second (largest viewport share) earns dwell; interactions attributed by nearest `data-section`; flush every 15 s and on hide/unload via sendBeacon | Prevents double counting when two sections are on screen |
| Print route | Sibling route group `(print)` with its own layout; light theme on paper; fixed footer repeats per page; TOC has section numbers, not page numbers | Chromium has no `target-counter()`; the Phase 5 droplet PDF script can add page numbers |
| `print.css` | The one CSS file allowed by spec 7.1 | Paged-media rules cannot be expressed as utilities |
| Muted text | `oh-mute` #9A9188 for small text; `oh-ash` #8A8178 fails AA on ink | Spec 7.6 |

## Modules and polish (Phases 4 and 5), Sep 2026

| Item | Decision | Why |
|---|---|---|
| Model levers | Seven sliders (utilization, bowl price, food cost, rent, pods, kitchen FTE, dwell); "average check" is moved through bowl price and shown as a result | Attach rates are second-order; one price lever reads cleanly |
| Floor plan geometry | 70 × 50 ft, three rows of 25 pods (2.35 × 4.5 ft, 2.6 ft pitch), two 2.5 to 3 ft delivery corridors, one 3.5 ft guest aisle, 2.5 ft entry strip; zones reproduce the spec's square-footage breakdown exactly | The spec's 1,575 sf dining for 75 pods forces these dimensions; the module says so out loud |
| Expansion counters | Franchise openings in a plan year are spread evenly across its months; covers scale with revenue | Engine has no month-level franchise data |
| Market data | TAM $63B (US Asian restaurant sales), SAM $2.4B (nine trade areas), SOM = engine year-3 corporate revenue (~$20M, 0.03% of TAM); Utah trade-area figures are rounded public estimates labeled as such | Spec 6.7: SOM deliberately small and said so |
| Monte Carlo | 10,000 runs, triangular distributions symmetric on revenue levers and skewed against us on costs, in a Web Worker; reports P10/P50/P90 and probability of missing the 25% public target | Neutral rather than flattering; the worker keeps the UI responsive |
| Downside scenarios | Six spec-named risks modeled as lever moves (rent +$15, food cost +5 pts, utilization −20%, five pods offline plus maintenance, wage +$3 plus one FTE, ramp −15%) | Each card shows a computed impact, not a paragraph |
| Team | Founder and financial partner only; the 49/51 LLC members from spec 10 are not rendered; EIN and personal finances never appear | Owner decision 23 |
| Roadmap status | Articles and EIN marked complete; operating agreement, TAP, licenses, fire marshal, CO pending | Post-formation checklist PDF not in the repo; confirm and flip flags in roadmapData.ts |
| Accessibility | axe WCAG 2.1 AA clean on every page after: `<html lang>` from middleware, `oh-mute` for small muted text, `oh-ember-light` for small ember text, `oh-ember-deep` (#A94422) for filled buttons (ember itself is 4.0:1 under cream), `oh-olive-light` for olive text, explicit `bg-transparent` on every plan button (the site's global button rule leaves the UA gray otherwise), map SVG is a group not an image | Spec 7.6 |
| Performance | Plan routes skip ClerkProvider, Google Analytics and the site's five-family Google Fonts stylesheet (Raleway only; CJK via next/font); logo served at 176 px instead of the 487 KB original | Lighthouse mobile went from 41 to 53 with these costs on the page; the marketing homepage scores 32 under the same throttling, so the remaining gap is site-wide |
| PDF export | `scripts/plan-export-pdf.cjs` (Playwright, droplet-side) prints `/plan/print` for a code; Vercel has no Chromium | Spec 7.5 |
| Print page numbers | Not in the contents list; browsers lack `target-counter()` | Phase 5 leftover |
