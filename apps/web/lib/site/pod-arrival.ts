/**
 * "I'm here" on the pod page (Task D6, fix round 2): the order of attempts
 * against POST /pods/confirm-arrival, and what each answer means.
 *
 * A signed-in member or a guest session tries the session match FIRST (no
 * code sent), so a saved code from some earlier, finished order can never
 * block one-tap check-in. A saved code is only a fallback, and one the API
 * doesn't recognize any more (the order is finished or unknown) is dropped.
 */

/** "retired": 410 POD_RETIRED, an old sticker retired at the comb cutover (shown as the retired-pod notice, Task G1). */
export type ArrivalOutcome = "ok" | "already" | "needCode" | "stale" | "wrongPod" | "retired" | "failed";

/** The codes to try, in order: `null` means "match my session, send no code". */
export function arrivalAttempts({ hasSession, saved }: { hasSession: boolean; saved: string | null }): (string | null)[] {
  const out: (string | null)[] = [];
  if (hasSession) out.push(null);
  if (saved) out.push(saved);
  return out;
}

/** What POST /pods/confirm-arrival's answer means for the attempt made with `code` (null = session match). */
export function classifyArrival(status: number, body: { code?: string } | null, code: string | null): ArrivalOutcome {
  if (status >= 200 && status < 300) return "ok";
  const c = body?.code;
  if (c === "ALREADY_CONFIRMED") return "already";
  if (c === "ORDER_CODE_REQUIRED") return "needCode";
  if (c === "WRONG_POD") return "wrongPod";
  if (status === 410 || c === "POD_RETIRED") return "retired";
  // A code the API no longer knows as an open, paid order: finished, cancelled or never real.
  if (code && (status === 404 || c === "ORDER_NOT_FOUND")) return "stale";
  return "failed";
}

/** After a saved-code attempt: whether to drop that code from this device. */
export function shouldForgetSaved(outcome: ArrivalOutcome): boolean {
  return outcome === "stale";
}

/**
 * Whether the loop moves on to the next attempt: a session miss, or a saved
 * code that turned out stale or for another pod, never blocks (the next step
 * is the next attempt, or the "enter your code" form).
 */
export function tryNext(outcome: ArrivalOutcome): boolean {
  return outcome === "needCode" || outcome === "stale" || outcome === "wrongPod";
}
