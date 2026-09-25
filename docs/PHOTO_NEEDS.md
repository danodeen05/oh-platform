# Photo punch list for the business plan

Spec 3.4: authentic brand assets only, no stock, no AI imagery. Each slot
below renders as a typographic placeholder in the plan until a real
photograph replaces it. Shot descriptions match the placeholder text.

| Section | Slot | Shot |
|---|---|---|
| Experience | arrive | Entry at dusk, empty kiosks lit, the mark on the far wall |
| Experience | order | Hands on the kiosk, add-on grid visible, shank highlighted |
| Experience | walk | The guest aisle looking down a row of numbered pods |
| Experience | settle | Inside a pod from the guest's seat, panel closed |
| Experience | panel | The sliding panel mid-open, steam, the bowl arriving |
| Experience | taste | Macro of the bowl: shank slices fanned, broth surface, noodles |
| Experience | leave | Guest leaving through the entry, pod panel closing behind |
| Operations | kds | Kitchen display in service: a live ticket rail with add-ons color-coded (screenshot) |
| Team | founder | Founder portrait, natural light, in the kitchen or at the pass |

Where to drop them: `apps/web/public/plan/<section>-<slot>.jpg` (AVIF or
WebP preferred), then replace the `PhotoPlaceholder` in the module with
`next/image` at explicit sizes. Until the flagship exists, the pod and
kitchen shots can come from the prototype pod and the production test
kitchen (Vulcan kettle).
