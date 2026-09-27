import { LinkButton } from "@/components/ui/Button";
import type { IconName } from "@/components/ui/icons";

const ACTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/menu?focus=search", label: "Mark item sold out", icon: "bowl" },
  { href: "/promos?new=1", label: "New promo", icon: "tag" },
  { href: "/gift-cards?focus=search", label: "Find gift card", icon: "gift" },
];

/** The three jobs people open the console for on the floor. */
export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions">
      <h2 id="quick-actions" className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">Quick actions</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {ACTIONS.map((a) => (
          <LinkButton key={a.href} href={a.href} icon={a.icon}
            className="min-h-22 flex-col gap-2! whitespace-normal! rounded-card! px-2 py-3 text-center text-sm leading-tight! shadow-card">
            {a.label}
          </LinkButton>
        ))}
      </div>
    </section>
  );
}
