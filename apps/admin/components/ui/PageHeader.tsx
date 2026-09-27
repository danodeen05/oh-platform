import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        {back && (
          <Link href={back.href} className="-ml-1.5 mb-1 inline-flex min-h-11 items-center gap-0.5 pr-2 text-sm font-semibold text-oh-stone/75 transition-colors hover:text-oh-charcoal">
            <Icon name="chevron-left" size={18} />{back.label}
          </Link>
        )}
        <h1 className="font-display text-[2rem] leading-[1.1] text-oh-charcoal lg:text-[2.5rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-oh-stone/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
