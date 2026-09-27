import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-oh-linen text-oh-stone/70" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
      )}
      <p className="font-display text-[1.625rem] leading-tight text-oh-charcoal">{title}</p>
      {body && <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-oh-stone/70">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
