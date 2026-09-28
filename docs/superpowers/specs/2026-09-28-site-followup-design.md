# Site follow-up: open pod, new photo, One Red Step, Order Status in the Experience

Date: 2026-09-28. Branch `site-overhaul`; origin/main is at 0a5c9a9, the live release 2.

On approval:
- This file is copied to `docs/superpowers/specs/2026-09-28-site-followup-design.md`.
- Its task list goes to `docs/superpowers/plans/2026-09-28-site-followup.md`.
- Both are committed as the first commit.

## Context

The owner reviewed the live site on 2026-09-28 ("everything looks amazing") and asked for four follow-ups:

1. **Home, The Pod chapter.** The hatch-opening effect is "all off".
   - Today a cropped copy of the photo's wood slides up over `Image 5.jpeg`, where the hatch is closed glass.
   - The owner added `fromDano/plan/OpenPod.jpg`. It is 1448x1086, the same size and framing as `Image 5`: same woman, pod, bowl and tablet. The only differences are the hatch, which is open with a staff member passing water, and her arm, which reaches for the glass.
   - Goal: a transition from Image 5 to OpenPod that matches the design.
2. **Swap the male photo.** `MaleClosedPod.jpg` (hatch fully closed, same pod model) replaces `Image 6.jpeg` everywhere. Today `Image 6` is used in three places:
   - `pod-hatch-a` in the home ThePod chapter
   - the order flow's best-pod card (`PodStep.tsx:103`)
   - the business plan's `public/plan/experience-settle.webp`
3. **One Red Step At A Time**, the plan's giving pledge, is barely on the site.
   - The plan (`plan.foundation.guests.items`) names three touchpoints:
     - the order status screen, which is done
     - a Give Back block beside the no-tipping promise; today it's a separate chapter after Rewards
     - the footer of every page, which is **missing** from the new shell footer
   - The plan's mission, 501(c)(3)/EIN, red socks, and donate and store links appear nowhere on the site.
4. **Order Status in the Experience.** The plan's Experience has 8 steps (`ExperienceModule.tsx:13`: arrive, order, walk, settle, **status**, **panel**, taste, leave). Step 05 is a live phone running the demo status page. The site's `/experience` has 6 steps and only mentions the status page in passing.

## Owner decisions (AskUserQuestion, 2026-09-28)

| Topic | Decision |
|---|---|
| One Red Step | The plan's touchpoints done properly, plus a dedicated `/giving` page. Chappy learns it too. |
| Experience | Match the plan's 8 steps: add Status (a live demo phone) and Panel (the OpenPod photo). |
| Pod copy | Rewrite the open-hatch beat around the panel and drop "You never see a hand" (OpenPod shows a hand). |
| Pod photos | Three beats: MaleClosedPod, then Image 5 (closed glass), then the in-photo hatch opening to OpenPod. Image 2 leaves home but stays on the Experience settle step. |

## Standing rules (unchanged)

- **Layout and tone:** mobile-first at 390x844, then 1440. No emoji. No em dashes in copy. Plan voice.
- **Translation:** all copy in en, zh-TW, zh-CN and es. The zh-TW and zh-CN renders must contain no English.
- **Motion:** native-first (CSS scroll timelines, IntersectionObserver fallback). Every effect honors reduced motion.
- **Budgets:** stay under the per-route JS budget guard (G2b), with home LCP under 2.5 s.
- **Commits:** stage explicit paths only, with the Fable 5.1 trailer. Times to the owner are in MT.
- **Images:** never publish the deny-listed images.
- **The plan status-demo contract must keep working:**
  - `DEMO-PLAN`, `embed=1` and `demoSync=parent` behave as today.
  - The plan's floor-plan sync is unaffected.
  - `after-order.spec.ts` stays green.

## Design

### 1. Pod chapter: the hatch opens inside the photo

File: `apps/web/components/site/home/ThePod.tsx` (with `home.css`). `PinnedStory screens={3}` stays. The layers and captions change:

| Beat | Image key (source) | Caption (new copy, 4 locales) |
|---|---|---|
| a | `pod-hatch-a` = **MaleClosedPod.jpg** | your pod, the panel closed (rewrite of steps.a) |
| b | `pod-hatch-b` = Image 5.jpeg | the kitchen is right behind the wall (hatch glass, closed) |
| c | **`pod-hatch-open` = OpenPod.jpg** (new key) | "The panel opens. Anything you ask for comes through the wall." (final wording in plan voice) |

**Transition from b to c**, driven by `--progress` over about 0.40 to 0.70:

1. **Hatch reveal.** The full-frame OpenPod layer sits over Image 5, clipped to the hatch opening:
   - `clip-path: inset(calc(top + (1 - ramp) * h) R B L)`, which reveals it **from the bottom edge up**, the way the glass lifts.
   - The hatch rectangle is measured once from the two photos, in percent of the frame. That is about x 13.5 to 53.5% and y 30 to 50%. The implementer measures it exactly on the 1448x1086 sources and records it as CSS variables.
   - A thin warm light line (a 2px ember-to-cream gradient with a soft blur) rides the leading edge.
   - There's a slight brightness lift on the revealed kitchen.
2. **The handoff.** Once the hatch is fully open, the clip dissolves into a full-frame crossfade (about 0.60 to 0.70). This brings in her reaching arm and the glass. The two photos are registered, so everything else stays still.
3. Captions b and c trade through the existing `.hm-window`. The 3-segment progress rule stays.

**Other details:**
- **Removed:** the cropped `.hm-hatch-panel` wood layer and its CSS.
- **Reduced motion:** the static list shows a, b, and c (open) with captions. `[data-pod-step]` still counts 3.
- **Other photo uses:** `PayStep.tsx:465` (`pod-hatch-b`) and `PodStep.tsx:103` (`pod-hatch-a`, now MaleClosedPod) keep their keys.
- **Alt text:** fix `siteImages.podHatchA` (hatch closed, now true) and add `siteImages.podHatchOpen`.

### 2. Image pipeline

- `scripts/site-images.mjs` `MAPPING`:
  - `pod-hatch-a: "MaleClosedPod.jpg"`
  - add `pod-hatch-open: "OpenPod.jpg"` with `ALT_KEYS` `siteImages.podHatchOpen`
- Regenerate `apps/web/public/site/*` and `lib/site/images.ts`. Remove the old `pod-hatch-a-*` outputs; they are overwritten in place.
- The business plan's `apps/web/public/plan/experience-settle.webp` (1200x900) is regenerated from MaleClosedPod with sharp, using the same encoding as the other `experience-*.webp` files. The plan's settle step then shows the closed-hatch man. Nothing else in the plan changes.
- `images.test.ts` stays green: the keys match, all widths exist, and nothing is deny-listed.

### 3. One Red Step At A Time

**Facts source:** `components/plan/modules/foundation/contact.ts`. It holds the name, EIN 33-7041706, website plus `/donate` and `/store`, the PO Box, socials and `/redsock-icon.png`. It also has `plan.foundation.*` copy: mission, pledge, the red socks, and "guest donations go straight to the foundation and are never counted as Oh! revenue".

Move `contact.ts`'s constants into `lib/site/foundation.ts`. Keep them client-safe, with no plan-model import. The plan re-exports them so the two stay in step.

**(a) New page `/[locale]/giving`** at `app/[locale]/(site)/giving/page.tsx` with `components/site/giving/*`. It's a server component with a mobile scroll. Sections:

1. **Hero:** the red thread motif (reuse RedStep's `.hm-thread-path` draw), plus "Every visit is one more step." and the vision line.
2. **The pledge:** "1% of revenue from every company restaurant, in every scenario", "carried as its own budget line, never a promise without a budget". **No dollar projections.** Those are the NDA-gated plan's numbers.
3. **The foundation:** its mission quote, a Utah mental health nonprofit, 501(c)(3), EIN, donations tax-deductible.
4. **How your visit helps:**
   - No tip, fair wages built in.
   - After you settle into your pod, the status screen shows a short mental health fact and a way to give.
   - Guest gifts go straight to the foundation.
5. **Red socks:** the foundation's easy visible way to join in, with a Store link to the foundation store.
6. **Actions:**
   - Donate: `oneredstepatatime.org/donate`, external, `rel="noopener"`.
   - Visit the foundation.
   - Ask Chappy.
7. **Contact line:** the mail address and social links (text links, no icon library).

**Ruling:** the plan's related-party disclosure (the foundation's founder is the owner's best friend; the owner is its unpaid volunteer CTO) is investor material and stays **off** the public page. The owner can ask for it.

**(b) Footer, every page:** `components/site/shell/Footer.tsx` gets a foundation block with the red sock mark (`/redsock-icon.png`, 40px, alt from messages). It reads: "1% of revenue from every company restaurant goes to ONE RED STEP AT A TIME, a Utah mental health nonprofit." It links to `/giving`.

**(c) Home, Give Back beside the no-tip promise:**
- Move the `RedStep` chapter to directly after `NoTip`. The new order is arrive, walk-in, the-pod, the-bowl, no-tip, red-step, rewards, locations.
- Add a bridging line in NoTip's reason ("No tip. And 1% of every bowl's revenue gives back.").
- RedStep's primary link goes to `/giving`, with the foundation link as secondary.

**(d) Status screen:** `order/AiLines.tsx` `RedStepLine` keeps its Support-the-cause link and adds a quiet "How we give" link to `/giving`.

**(e) Navigation:** add `giving` to `SECONDARY_ITEMS` in `lib/site/nav.ts`, which covers the More sheet and the desktop nav. Its icon is a new in-house `thread` icon in `components/site/icons/paths.ts`.

**(f) Chappy:** add a One Red Step paragraph to the frozen system prompt in `packages/api/src/chappy/prompts.js` (facts only, pointing to `/giving`). The Chappy tests pin byte-identical prompts across users, and that stays true.

**(g) Routes:** add `/giving` to `lib/site/routes.ts`, which covers the leak crawl, the sweep and the bundle guard, and to `middleware.ts` public routes if it has an allowlist.

### 4. Experience: 8 steps, with Order Status

In `lib/site/experience.ts`, `EXPERIENCE_STEPS` becomes arrive, order, walk, settle, **status**, **panel**, taste, leave. The intro index lists 8.

**Status step: "Your phone runs the show."**
- Copy is adapted from `plan.experience.steps.status` into `experience.steps.status`, with its six features: Live Kitchen Feed, fortune cookie, order more to your pod, call staff, Roast My Order, One Red Step.
- **New `components/site/experience/StatusPhone.tsx`.** It is site-owned and uses no plan loader video or plan hex colors. It reuses `statusDemoSrc(locale)` from `lib/plan/statusDemo.ts`, which self-plays the DEMO-PLAN loop.
  - It renders a 390x844 iframe scaled into a site-styled phone frame. The scaling uses the `PhoneFrame.tsx` ResizeObserver pattern.
  - The iframe only mounts when the step is within one screen (IntersectionObserver). A poster frame shows first, so first-load JS and LCP don't change.
- **On phones**, the inline phone is a non-interactive preview (`pointer-events: none`, so it can't trap page scroll). A "Try it live" button opens a full-screen `Sheet` holding an interactive embed. The button has a 44px target.
- **At 768px and up**, the phone is interactive inline.
- The six features are a `SnapRail` of cards under the phone on phones, and a list beside it on desktop. They use in-house icons.
- There's also a link to the non-embed demo: `/[locale]/order/status?orderQrCode=DEMO-PLAN`.

**Panel step: "Seven minutes, and it comes through the wall."**
- Adapted from `plan.experience.steps.panel`, using the `pod-hatch-open` photo.

**JourneyMap:**
- `experience-progress.ts` places the dots for the two new steps:
  - status: guest at the pod, bowl in the kitchen (PREPPING)
  - panel: bowl at the hatch
- These use the layout's `journeyMarkers` progress values. The map captions get two new entries.

**FAQ:** the "phone" answer links to the Status step anchor `#status`.

## Files (main)

| Area | Paths |
|---|---|
| Home | `apps/web/components/site/home/{ThePod,NoTip,RedStep}.tsx`, `home.css`, `app/[locale]/(site)/page.tsx` (chapter order) |
| Images | `scripts/site-images.mjs`, `apps/web/lib/site/images.ts`, `apps/web/public/site/pod-hatch-{a,open}-*`, `apps/web/public/plan/experience-settle.webp` |
| Giving | `app/[locale]/(site)/giving/page.tsx`, `components/site/giving/*`, `lib/site/foundation.ts` (with `components/plan/modules/foundation/contact.ts` re-exporting it), `components/site/shell/Footer.tsx`, `lib/site/nav.ts`, `components/site/icons/paths.ts`, `components/site/order/AiLines.tsx`, `lib/site/routes.ts` |
| Experience | `lib/site/experience.ts`, `lib/site/experience-progress.ts`, `components/site/experience/{Steps,JourneyMap,StatusPhone}.tsx`, `app/[locale]/(site)/experience/page.tsx` |
| Chappy | `packages/api/src/chappy/prompts.js` |
| Copy | `apps/web/messages/{en,zh-TW,zh-CN,es}.json` (`home.pod`, `home.redStep`, `home.noTip`, `giving.*`, `experience.steps.{status,panel}`, `experience.map.captions`, `site.shell.footer.foundation`, `nav.giving`, `siteImages.podHatchOpen`) |
| Tests | `tests/e2e/site/{home,experience}.spec.ts` (chapter order, 8 steps), new `tests/e2e/site/giving.spec.ts`, `lib/site/__tests__/images.test.ts`, `packages/api/src/chappy/__tests__/*` |

## Execution

**Speed first.** The owner is short on time today (2026-09-28) and needs links to share, so we ship as soon as it's verified.
- All implementers and reviewers are **Fable agents** (`model: "fable"`).
- Lanes run in parallel, each in its own worktree.
- Review is one pass per lane. Only fixes for Critical or Important findings get a second round.

Three lanes:

| Lane | Contents |
|---|---|
| A | Items 1 and 2: images, Pod chapter, plan settle image |
| B | Item 4: the Experience 8 steps. It depends on A's `pod-hatch-open` key, so it starts after A's image commit or stubs the key |
| C | Item 3: One Red Step (page, footer, home order, nav, status link, Chappy) |

- Each lane is one implementer subagent, followed by one reviewer subagent.
- C runs in parallel with A. B starts once A's images land.
- The controller merges, runs the full suites, and then releases.

## Verification

1. **Unit tests:** `pnpm --filter @oh/web test` covers images, no-emoji, locale parity, literal-JSX, em dash and bundle guard. `pnpm --filter @oh/api test` covers the Chappy prompt tests.
2. **E2E on dev** (iPhone 15, Pixel 8, then 1440):
   - `home.spec` (new chapter order, 3 pod steps)
   - `experience.spec` (8 steps, dots move on status and panel, zh-TW has no English)
   - new `giving.spec` (renders; Donate goes to the foundation /donate; the footer link on every route goes to /giving; no overflow; axe clean)
   - `after-order.spec` (the demo contract)
   - the English-leak crawl, which now includes `/giving`
3. **Pod transition check:** screenshots at 390 and 1440 of the pinned pod chapter at progress 0.30, 0.45, 0.55, 0.65 and 0.75. They should show the hatch lifting from the bottom and the light line. The last frame should match OpenPod exactly.
4. **Plan check:** the plan's `/en/plan/experience` settle step shows MaleClosedPod, and the plan floor plan's phone sync still works.
5. **Performance:** home LCP under 2.5 s on throttled 4G. The `/experience` first-load JS stays under the budget, since the iframe is lazy.
6. **Release:**
   - Push to main. Railway runs `@oh/api` for the Chappy prompt; Vercel builds webapp.
   - Run the prod smoke (`cutover-smoke.mjs` and `prod_smoke.py`), plus a prod phone render of `/`, `/experience` and `/giving` in en and zh-TW.
   - Tell the owner the MT time and what changed (text, as before).
