# Oh! OS order status page in the business plan: design

**Owner request (2026-09-27):** show the benefits of the guest's order status page (AI-driven live status, digital fortune cookie, ordering more to the pod, and so on) on The Experience and in The Floor Plan's timed flow, plus anywhere else that makes sense, with a rendering of the page.

## Owner decisions

- **Status link is texted.** Build it: the order confirmation text now carries the live status link, and so does the pod-ready text.
- **Rendering is a live demo in a phone**, not screenshots.
- The owner asked to proceed through every section without further approval gates.

## What the status page does (as built)

- Live progress through the stages Paid, In Queue, Preparing, Ready and Enjoy, with a timeline.
- **AI Live Kitchen Feed:** narrates the guest's own order by name.
- **Pod card:** confirm at pod, Call Staff, Add Items and Ready for Dessert.
- **Add Items:** free refills and extra vegetables, plus paid add-ons delivered through the hatch.
- **AI digital fortune cookie:** a fortune, lucky numbers, this day in history, and a word of Chinese.
- **AI Roast My Order and Behind the Scenes.**
- **One Red Step:** a mental health fact and a giving link.
- Rewards sign-up, and "I'm done eating".

## Design

1. **Demo order with no database rows** (`packages/api/src/demo/status-demo.js`).
   - `DEMO-` codes resolve through a Prisma query extension to a synthetic order. It is built from the tenant's real menu rows: Alex at Pod 32, City Creek Mall.
   - Every existing route, including the AI prompts, works unchanged.
   - A preHandler hook answers every write for a `demo-` id or `DEMO-` code with a simulated success: call staff, refill, extra vegetables, dessert, add-ons, PATCH on the order, kitchen status, and link to account.
   - The stage is pinned in the code (`DEMO-PLAN.PREPPING`). Otherwise it follows a two-minute server clock.
2. **Demo mode on the status page.**
   - The page plays its stages by itself: confirming at the pod advances it, and "I'm done eating" completes it.
   - With `demoSync=parent`, it instead follows `{type: "oh-status-demo", stage}` postMessages from the embedding page.
   - A banner reads "Live demo · not a real order".
   - `embed=1` drops the site header, footer and chat widget. Middleware sets the `x-embed` header and the locale layout reads it.
3. **Plan changes.**
   - **PhoneFrame primitive:** renders the page at 390 x 844 and scales it to fit.
   - **Experience:** a new step 05, "Your phone runs the show", with the live phone and six features. Copy touches on order, walk (Pod 32), settle, panel, taste and leave. The print version lists the features.
   - **Floor Plan journey:** six phone beats (texted, checkin, feed, fortune, addon, done), flagged `phone: true` and shown with a Phone badge. `statusStageAt(progress)` maps the journey to status stages. A mini phone at the top of the side column follows the animation.
   - **Operations:** the status page is the fourth front door into the API, plus a block titled "The guest's phone does a server's job".
   - All copy is in en and zh-TW, with no em dashes.
4. **Texts.** `orderConfirmationText` and the pod-ready text carry `orderStatusUrl`, built from `WEB_APP_URL` (default `https://www.ohbeef.com`). Texts still go only to guests who opted in.

## Verification

- 94 API tests (demo module, write guard, status link) and 68 web tests (journey phone beats, stage mapping, demo URL).
- Plan typecheck, and a production build of the web app.
- A 10-check browser run on the dev build and on the production build:
  - the phone plays on its own
  - the floor plan phone follows Paid, then Preparing, then Completed
  - six Phone badges on the timeline
  - the Operations block
  - no horizontal scroll on mobile
  - print carries the new copy
