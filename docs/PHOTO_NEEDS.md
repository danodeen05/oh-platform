# Photo punch list for the business plan

Spec 3.4: authentic brand assets only, no stock, no AI imagery. Each slot
below renders as a typographic placeholder in the plan until a real
photograph replaces it. Shot descriptions match the placeholder text.

| Section | Slot | Shot |
|---|---|---|
| Experience | arrive | Entry at dusk, empty kiosks lit, the mark on the far wall |
| Experience | order | Hands on the kiosk, add-on grid visible, the beef choice highlighted |
| Experience | walk | The guest aisle looking down a row of numbered pods |
| Experience | settle | Inside a pod from the guest's seat, panel closed |
| Experience | panel | The sliding panel mid-open, steam, the bowl arriving |
| Experience | taste | Macro of the bowl: smoked brisket slices fanned, broth surface, noodles |
| Experience | leave | Guest leaving through the entry, pod panel closing behind |
| Operations | kds | Kitchen display in service: a live ticket rail with add-ons color-coded (screenshot) |
| Team | founder | Founder portrait, natural light, in the kitchen or at the pass |

## Status, 2026-09-26

All nine slots above are filled in `apps/web/public/plan/` and rendered through
`components/plan/primitives/PlanPhoto.tsx`. The seven Experience shots, the
Summary opener (`summary-bowl`), the Market product shot (`market-beef`) and
the five Unit Economics product images are **concept renders**, tagged as such
in the UI; they stay until real photographs of the flagship exist. Two real
captures are in: `team-founder` (763 px wide; a larger export would be sharper
on retina screens) and `operations-kds` (the idle screen; capture a live ticket
rail during a service to replace it).

Where to drop them: `apps/web/public/plan/<section>-<slot>.jpg` (AVIF or
WebP preferred), then replace the `PhotoPlaceholder` in the module with
`next/image` at explicit sizes. Until the flagship exists, the pod and
kitchen shots can come from the prototype pod and the production test
kitchen (Vulcan kettle).
