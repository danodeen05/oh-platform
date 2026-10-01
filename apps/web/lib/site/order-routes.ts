/**
 * Order flow routes (Task D5). Kept tiny and dependency-free: the shell's
 * dock and pill import it on every page.
 */
import { locales } from "@/i18n/config";

/**
 * /{locale}/order, /{locale}/order/location/..., /{locale}/order/payment:
 * the steps a guest builds and pays an order on. The dock hides here and the
 * top bar shows a Back chevron. (Status, confirmation, check-in and scan are
 * after the order and keep the dock.)
 */
export function isOrderBuildPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length && (locales as readonly string[]).includes(parts[0])) parts.shift();
  if (parts[0] !== "order") return false;
  return parts.length === 1 || parts[1] === "location" || parts[1] === "payment";
}

/**
 * /{locale}/e/{slug}/...: a private event's pages. A guest there is not a
 * dine-in customer, so the dock (whose Order leads to dine-in ordering) and
 * the active-order pill stay out of the way; the event pins its own CTA bar.
 */
export function isEventPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length && (locales as readonly string[]).includes(parts[0])) parts.shift();
  return parts[0] === "e" && parts.length >= 2;
}
