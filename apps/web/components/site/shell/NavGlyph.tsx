/**
 * The mark above a dock label (Task C4 fix round 1): an in-house brush icon,
 * the owner's traced tier mark (Rewards), or an image (Chappy's own face).
 * Icons and the tier mark fill with currentColor, so they follow the dock's
 * active and inactive text colors; the avatar can't, so it shows its state
 * with a cream ring when active and slightly lower opacity when not.
 */
import Image from "next/image";
import { Icon } from "@/components/site/icons/Icon";
import { TierMark } from "@/components/site/tiers/TierMark";
import type { NavGlyph as Glyph } from "@/lib/site/nav";

/** Always 24px: the dock's glyph slot. */
export function NavGlyph({ glyph, active = false }: { glyph: Glyph; active?: boolean }) {
  if ("icon" in glyph) return <Icon name={glyph.icon} size={24} />;
  if ("tier" in glyph) return <TierMark tier={glyph.tier} tone="current" size={24} />;
  return (
    <span
      data-nav-avatar
      data-active={active ? "true" : "false"}
      className="block h-6 w-6 shrink-0 overflow-hidden rounded-full opacity-85 ring-offset-1 ring-offset-oh-ink transition-[opacity,box-shadow] data-[active=true]:opacity-100 data-[active=true]:ring-[1.5px] data-[active=true]:ring-oh-cream"
    >
      <Image src={glyph.avatar} alt="" width={24} height={24} className="h-full w-full object-cover" />
    </span>
  );
}
