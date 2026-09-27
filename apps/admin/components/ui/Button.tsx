import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-oh-ember-deep text-oh-cream shadow-[0_1px_0_rgb(28_27_25/0.12)] hover:bg-oh-ember active:bg-oh-ember-deep",
  secondary: "bg-oh-cream text-oh-charcoal border border-oh-stone/20 hover:bg-oh-linen active:bg-oh-linen",
  ghost: "bg-transparent text-oh-charcoal hover:bg-oh-stone/8 active:bg-oh-stone/12",
  danger: "bg-transparent text-oh-ember-deep border border-oh-ember/40 hover:bg-oh-ember/10 active:bg-oh-ember/15",
};
const SIZE = { md: "min-h-11 px-4 text-[15px]", sm: "min-h-11 px-3 text-sm" };
const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold leading-none transition-colors select-none disabled:opacity-50 disabled:pointer-events-none";

type Common = { variant?: ButtonVariant; size?: keyof typeof SIZE; icon?: IconName; children?: ReactNode; className?: string };

export function Button({ variant = "secondary", size = "md", icon, loading, children, className = "", ...rest }: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} aria-busy={loading || undefined}
      className={`${base} ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {loading
        ? <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
        : icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "secondary", size = "md", icon, children, className = "", ...rest }: Common & { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} {...rest} className={`${base} ${VARIANT[variant]} ${SIZE[size]} ${className}`}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Link>
  );
}

/** 44x44 square button with an accessible name. The label also shows as a tooltip on desktop. */
export function IconButton({ icon, label, className = "", ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-oh-stone/10 active:bg-oh-stone/15 disabled:opacity-50 disabled:pointer-events-none ${className}`}>
      <Icon name={icon} />
    </button>
  );
}
