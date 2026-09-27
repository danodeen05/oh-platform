import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

type Props = { href?: string; onClick?: () => void; leading?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; chevron?: boolean };

export function ListRow({ href, onClick, leading, title, meta, trailing, chevron = Boolean(href) }: Props) {
  const inner = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-oh-charcoal">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-sm text-oh-stone/70">{meta}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-right">{trailing}</span>}
      {chevron && <Icon name="chevron-right" size={18} className="-mr-1 shrink-0 text-oh-ash" />}
    </>
  );
  const interactive = href || onClick;
  const cls = `flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left ${interactive ? "transition-colors hover:bg-oh-linen/60 active:bg-oh-linen focus-visible:-outline-offset-2!" : ""}`;
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
