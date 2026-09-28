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
import { useSiteAuth } from "@/lib/site/auth";

type TriggerChild = ReactElement<{
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onPointerEnter?: (e: SyntheticEvent) => void;
  onTouchStart?: (e: SyntheticEvent) => void;
  onFocus?: (e: SyntheticEvent) => void;
}>;

function withTrigger(children: TriggerChild, open: () => void, preload: () => void) {
  const own = children.props;
  return cloneElement(children, {
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

export function SignInTrigger({ children }: { children: TriggerChild }) {
  const auth = useSiteAuth();
  return withTrigger(children, auth.openSignIn, auth.preload);
}

export function SignUpTrigger({ children }: { children: TriggerChild }) {
  const auth = useSiteAuth();
  return withTrigger(children, auth.openSignUp, auth.preload);
}

/** Clerk's <SignedIn> / <SignedOut>, from SiteAuth. */
export function SignedIn({ children }: { children: React.ReactNode }) {
  return useSiteAuth().isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  return useSiteAuth().isSignedIn ? null : <>{children}</>;
}
