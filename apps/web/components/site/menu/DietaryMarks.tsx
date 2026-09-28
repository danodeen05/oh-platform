/**
 * Dietary and spice marks for a menu item (Task D3): the in-house Icon set,
 * never emoji. A leaf for vegan or vegetarian, wheat-off for gluten free,
 * and one flame per spice level (1 to 3).
 *
 *  - `compact` (the list rows): icons only; each mark is `role="img"` with
 *    its translated name, so a screen reader hears "Vegan, Spicy".
 *  - `full` (the item sheet and the legend): icon plus its label.
 *
 * No hooks beyond next-intl's useTranslations, so it renders in server and
 * client components alike.
 */
import { useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import type { MenuMarks } from "@/lib/site/menu";

type MarkKey = "leaf" | "wheat-off" | "flame";

interface Mark {
  key: MarkKey;
  label: string;
  count: number;
  tone: string;
}

export function marksList(marks: MenuMarks, t: (key: string) => string): Mark[] {
  const list: Mark[] = [];
  if (marks.plant) list.push({ key: "leaf", label: t(marks.plant), count: 1, tone: "text-oh-olive" });
  if (marks.glutenFree) list.push({ key: "wheat-off", label: t("glutenFree"), count: 1, tone: "text-oh-clay" });
  if (marks.spice > 0) list.push({ key: "flame", label: t(`spice${marks.spice}`), count: marks.spice, tone: "text-oh-ember-deep" });
  return list;
}

function Flames({ mark, size }: { mark: Mark; size: number }) {
  return (
    <span className={`inline-flex items-center ${mark.tone}`} aria-hidden="true">
      {Array.from({ length: mark.count }, (_, i) => (
        <Icon key={i} name={mark.key} size={size} className={i ? "-ml-1" : undefined} />
      ))}
    </span>
  );
}

export function DietaryMarks({ marks, variant = "compact", className }: { marks: MenuMarks; variant?: "compact" | "full"; className?: string }) {
  const t = useTranslations("menuPage.marks");
  const list = marksList(marks, t);
  if (!list.length) return null;

  if (variant === "full") {
    return (
      <ul data-dietary-marks className={`m-0 flex list-none flex-wrap gap-2 p-0 ${className ?? ""}`}>
        {list.map((mark) => (
          <li key={mark.key} data-mark={mark.key} data-count={mark.count} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-oh-linen px-3 text-[15px] text-oh-ink">
            <Flames mark={mark} size={18} />
            {mark.label}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <span data-dietary-marks className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {list.map((mark) => (
        <span key={mark.key} role="img" aria-label={mark.label} title={mark.label} data-mark={mark.key} data-count={mark.count} className="inline-flex">
          <Flames mark={mark} size={16} />
        </span>
      ))}
    </span>
  );
}
