/**
 * Private events (/e/[slug]/order): the guest's bowl in progress, one
 * OrderDraft per event in sessionStorage under `oh-event-draft:{slug}`, so a
 * reload or a locale switch keeps the choices. Separate from the dine-in
 * draft (`oh-order-draft`): an event bowl never touches the dine-in cart.
 * Storage can be missing or throw, which reads as "no draft yet".
 */
import { emptyDraft, parseDraft, withMenuDefaults, type MenuStep, type OrderDraft } from "./order-draft";

export const EVENT_DRAFT_PREFIX = "oh-event-draft:";

const key = (slug: string) => `${EVENT_DRAFT_PREFIX}${slug}`;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** A fresh bowl: the house soup and noodles (else the first of each) and every slider's default. */
export function defaultEventDraft(steps: MenuStep[]): OrderDraft {
  return withMenuDefaults(emptyDraft(), steps);
}

/** The stored draft for this event, or null when there is none. Callers run it through `withMenuDefaults` against the live menu. */
export function readEventDraft(slug: string): OrderDraft | null {
  try {
    const raw = storage()?.getItem(key(slug));
    return raw ? parseDraft(raw) : null;
  } catch {
    return null;
  }
}

export function writeEventDraft(slug: string, draft: OrderDraft): void {
  try {
    storage()?.setItem(key(slug), JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the choices still hold for this page view.
  }
}

export function clearEventDraft(slug: string): void {
  try {
    storage()?.removeItem(key(slug));
  } catch {
    // Nothing to clear.
  }
}
