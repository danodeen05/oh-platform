"use client";

/**
 * Drop-in stand-ins for Clerk's `<SignInButton mode="modal">` and
 * `<SignUpButton mode="modal">` on (site) pages (Task G2a): they wrap one
 * child button, keep its own onClick, and open Clerk's modal through
 * SiteAuth, so the page doesn't need Clerk's React code to render. Hover,
 * touch or focus starts loading Clerk, so the modal is usually ready by the
 * time the tap lands.
 */
import { cloneElement, type MouseEvent, type ReactElement, type SyntheticEvent } from "react";
import { useSiteAuth, type ModalOptions } from "@/lib/site/auth";

type TriggerChild = ReactElement<{
  "aria-busy"?: boolean;
  "data-auth-pending"?: string;
  style?: React.CSSProperties;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onPointerEnter?: (e: SyntheticEvent) => void;
  onTouchStart?: (e: SyntheticEvent) => void;
  onFocus?: (e: SyntheticEvent) => void;
}>;

function withTrigger(children: TriggerChild, open: () => void, preload: () => void, pending = false) {
  const own = children.props;
  return cloneElement(children, {
    // Feedback while the modal waits for Clerk (G2a fix round 1).
    "aria-busy": pending || undefined,
    "data-auth-pending": pending ? "true" : undefined,
    style: pending ? { ...own.style, opacity: 0.7, cursor: "progress" } : own.style,
    onClick: (e: MouseEvent<HTMLElement>) => {
      own.onClick?.(e);
      open();
    },
    onPointerEnter: (e: SyntheticEvent) => {
      own.onPointerEnter?.(e);
      preload();
    },
    onTouchStart: (e: SyntheticEvent) => {
      own.onTouchStart?.(e);
      preload();
    },
    onFocus: (e: SyntheticEvent) => {
      own.onFocus?.(e);
      preload();
    },
  });
}

/** `returnTo`: where the visitor lands after signing in or up (default: stays on this page). */
export function SignInTrigger({ children, returnTo }: { children: TriggerChild; returnTo?: string }) {
  const auth = useSiteAuth();
  const opts: ModalOptions | undefined = returnTo ? { returnTo } : undefined;
  return withTrigger(children, () => auth.openSignIn(opts), auth.preload, auth.pending);
}

export function SignUpTrigger({ children, returnTo }: { children: TriggerChild; returnTo?: string }) {
  const auth = useSiteAuth();
  const opts: ModalOptions | undefined = returnTo ? { returnTo } : undefined;
  return withTrigger(children, () => auth.openSignUp(opts), auth.preload, auth.pending);
}

/** Clerk's <SignedIn> / <SignedOut>, from SiteAuth. */
export function SignedIn({ children }: { children: React.ReactNode }) {
  return useSiteAuth().isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return useSiteAuth().isSignedIn ? null : <>{children}</>;
}
