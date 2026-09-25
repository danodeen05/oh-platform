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

Open items for the owner before this goes to a lender: items 2, 4, 8, 11, 12; and the
operative Operating Agreement (two-member 49/51 vs single-member) per spec 10.

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
