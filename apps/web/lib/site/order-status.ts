/**
 * Pure helpers for the after-order pages (Task D6): the status stages, the
 * plan's status demo, clock times and the pod-moved notice. No React, no
 * fetch, so every rule here is unit tested.
 *
 * Stages come from `PHONE_STAGES` in `@oh/floor-plan`, the same list the
 * business plan's floor plan animates its phone through.
 *
 * The plan's demo contract (binding, see the D6 notes):
 *   /{locale}/order/status?orderQrCode=DEMO-PLAN.<STAGE>&embed=1&demoSync=parent
 *   - a DEMO- code renders the synthetic order from the API
 *     (packages/api/src/demo/status-demo.js);
 *   - the stage comes from the code ("DEMO-PLAN.PREPPING"), else
 *     `?demoStage=`, else PAID;
 *   - with `demoSync=parent` the page follows
 *     `postMessage({ type: "oh-status-demo", stage })` from its parent (same
 *     origin only) and says `{ type: "oh-status-demo-ready" }` when it
 *     listens; without it the demo plays by itself.
 */
import { PHONE_STAGES, type PhoneStage } from "@oh/floor-plan";

export { PHONE_STAGES };
export type { PhoneStage };

export const DEMO_PREFIX = "DEMO-";
export const DEMO_MESSAGE = "oh-status-demo";
export const DEMO_READY_MESSAGE = "oh-status-demo-ready";

/** What plays next when the demo runs by itself (it stops at SERVING, like the real visit). */
export const DEMO_NEXT: Record<PhoneStage, PhoneStage | null> = {
  PAID: "QUEUED",
  QUEUED: "PREPPING",
  PREPPING: "READY",
  READY: "SERVING",
  SERVING: null,
  COMPLETED: "PAID",
};
export const DEMO_DWELL_MS: Record<PhoneStage, number> = { PAID: 9000, QUEUED: 8000, PREPPING: 30000, READY: 9000, SERVING: 0, COMPLETED: 15000 };

/** Stages with a live kitchen feed line (the commentary route). */
export const FEED_STAGES: readonly string[] = ["QUEUED", "PREPPING", "READY", "SERVING"];
/** Stages where the ingredient backstories make sense (the bowl is being made or eaten). */
export const BACKSTORY_STAGES: readonly string[] = ["PREPPING", "READY", "SERVING"];
/** Stages where the guest can call staff or add items at the pod. */
export const SERVICE_STAGES: readonly string[] = ["QUEUED", "PREPPING", "READY", "SERVING"];

export function isPhoneStage(value: unknown): value is PhoneStage {
  return typeof value === "string" && (PHONE_STAGES as readonly string[]).includes(value);
}

export function isDemoCode(code: string | null | undefined): boolean {
  return typeof code === "string" && code.startsWith(DEMO_PREFIX);
}

/** The demo's first stage: pinned in the code, else `?demoStage=`, else PAID. */
export function initialDemoStage(code: string | null | undefined, stageParam?: string | null): PhoneStage {
  const fromCode = typeof code === "string" ? code.split(".")[1] : undefined;
  if (isPhoneStage(fromCode)) return fromCode;
  if (isPhoneStage(stageParam)) return stageParam;
  return "PAID";
}

/** "DEMO-PLAN.PREPPING" + READY -> "DEMO-PLAN.READY". */
export function demoCodeFor(code: string, stage: PhoneStage): string {
  return `${code.split(".")[0]}.${stage}`;
}

/** The stage a parent's message asks for, or null for anything else. */
export function demoStageFromMessage(data: unknown): PhoneStage | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { type?: unknown; stage?: unknown };
  return d.type === DEMO_MESSAGE && isPhoneStage(d.stage) ? d.stage : null;
}

/** 0..5 for a phone stage, -1 for anything else (PENDING_PAYMENT, CANCELLED). */
export function stageIndex(status: string | null | undefined): number {
  return (PHONE_STAGES as readonly string[]).indexOf(status || "");
}

export type StepState = "done" | "current" | "upcoming";

export interface OrderTimes {
  paidAt?: string | null;
  arrivedAt?: string | null;
  queuedAt?: string | null;
  prepStartTime?: string | null;
  readyTime?: string | null;
  deliveredAt?: string | null;
  completedTime?: string | null;
}

/** When each stage began, from the order's own timestamps (QUEUED is the check-in). */
export function stageTime(stage: PhoneStage, o: OrderTimes): string | null {
  switch (stage) {
    case "PAID":
      return o.paidAt ?? null;
    case "QUEUED":
      return o.arrivedAt ?? o.queuedAt ?? null;
    case "PREPPING":
      return o.prepStartTime ?? null;
    case "READY":
      return o.readyTime ?? null;
    case "SERVING":
      return o.deliveredAt ?? null;
    case "COMPLETED":
      return o.completedTime ?? null;
  }
}

export interface TimelineStep {
  stage: PhoneStage;
  state: StepState;
  at: string | null;
}

/** The six stages with done / current / upcoming for this order. A COMPLETED order has every step done. */
export function timeline(status: string | null | undefined, times: OrderTimes = {}): TimelineStep[] {
  const idx = stageIndex(status);
  return PHONE_STAGES.map((stage, i) => ({
    stage,
    state: idx < 0 ? "upcoming" : i < idx || (status === "COMPLETED" && i === idx) ? "done" : i === idx ? "current" : "upcoming",
    at: idx >= 0 && i <= idx ? stageTime(stage, times) : null,
  }));
}

/** Fraction of the visit done, for the progress bar (0 before payment, 1 when completed). */
export function progress(status: string | null | undefined): number {
  const idx = stageIndex(status);
  if (idx < 0) return 0;
  return (idx + 1) / PHONE_STAGES.length;
}

/** A clock time in the location's zone and the page's language ("6:04 PM", "下午6:04"). */
export function formatClock(iso: string | null | undefined, locale: string, timeZone = "America/Denver"): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

/** Whole minutes from payment to the bowl reaching the pod, or null until it has. */
export function visitMinutes(o: OrderTimes): number | null {
  if (!o.paidAt || !o.deliveredAt) return null;
  const ms = new Date(o.deliveredAt).getTime() - new Date(o.paidAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 60000) : null;
}

/** The pod to show: the comb label ("B-07") when there is one, else the seat number (the demo's "32"). */
export function podLabelOf(o: { podLabel?: string | null; podNumber?: string | null } | null | undefined): string | null {
  return o?.podLabel || o?.podNumber || null;
}

/**
 * D12: a pod can move at payment (its hold lapsed and another order took it).
 * The pay step passes the label it showed as `?podFrom=`; when the order's pod
 * now differs, the page says so ("Your pod is now B-07"). `noPod` is the
 * other outcome: nothing was free, so the guest is seated at check-in.
 */
export function podMoved(from: string | null | undefined, current: string | null | undefined): { from: string; to: string } | null {
  if (!from || !current || from === current) return null;
  return { from, to: current };
}

/** The status page link the pay step goes to, carrying a pod change when there was one. */
export function statusPath(locale: string, qr: string, change?: { changed?: boolean; from?: string | null; to?: string | null; noPod?: boolean } | null): string {
  const q = new URLSearchParams({ orderQrCode: qr });
  if (change?.changed && change.from) q.set("podFrom", change.from);
  if (change?.noPod) q.set("podNone", "1");
  return `/${locale}/order/status?${q.toString()}`;
}
