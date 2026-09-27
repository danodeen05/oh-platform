import { getTranslations } from "next-intl/server";
import { registryAnchor } from "@oh/plan-model";
import type { OpenItem, OpenItemStatus } from "./openItems";

const STATUS_CLASS: Readonly<Record<OpenItemStatus, string>> = {
  "not-started": "bg-oh-mute/10 text-oh-mute ring-oh-mute/30",
  requested: "bg-oh-gold/15 text-oh-gold ring-oh-gold/40",
  "in-progress": "bg-oh-gold/15 text-oh-gold ring-oh-gold/40",
  received: "bg-oh-olive-light/15 text-oh-olive-light ring-oh-olive-light/40",
  validated: "bg-oh-olive-light/15 text-oh-olive-light ring-oh-olive-light/40",
};

/**
 * What no outside party has confirmed yet. Every item names the register
 * rows it would close, so a reader can see exactly which numbers are still
 * ours alone.
 */
export async function OpenItems({ items, registryKeys }: { items: readonly OpenItem[]; registryKeys: ReadonlySet<string> }) {
  const t = await getTranslations("plan.integrity.openItems");
  const open = items.filter((i) => i.status !== "validated").length;
  return (
    <section aria-labelledby="integrity-open">
      <h2 id="integrity-open" className="m-0 mb-1 font-display text-[1.5rem] text-oh-cream">
        {t("title")}
      </h2>
      <p className="m-0 mb-4 text-[0.85rem] text-oh-mute">{t("subtitle", { open, total: items.length })}</p>
      <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.key} id={`open-${item.key}`} data-open-item={item.key} className="rounded-lg border border-oh-stone bg-oh-ink px-4 py-4 target:ring-2 target:ring-oh-ember">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="m-0 font-display text-[1.05rem] leading-tight text-oh-cream">{t(`items.${item.key}.title`)}</p>
              <span className={["inline-block rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] ring-1", STATUS_CLASS[item.status]].join(" ")}>{t(`status.${item.status}`)}</span>
            </div>
            <p className="m-0 mt-1.5 text-[0.85rem] leading-snug text-oh-mute">{t(`items.${item.key}.body`)}</p>
            <p className="m-0 mt-2 text-[0.72rem] text-oh-mute">
              <span className="uppercase tracking-[0.12em]">{t("owner")}</span> <span className="text-oh-cream">{t(`owners.${item.owner}`)}</span>
            </p>
            <p className="m-0 mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.72rem] text-oh-mute">
              <span className="uppercase tracking-[0.12em]">{t("validates")}</span>
              {item.validates.map((k) =>
                registryKeys.has(k) ? (
                  <a key={k} href={`#${registryAnchor(k)}`} className="font-mono text-[0.7rem] text-oh-cream underline decoration-oh-stone underline-offset-2 hover:decoration-oh-ember">
                    {k}
                  </a>
                ) : (
                  <span key={k} className="font-mono text-[0.7rem] text-oh-mute">{k}</span>
                ),
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
