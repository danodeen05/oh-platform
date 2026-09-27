/**
 * What a plan session may do right now, from the API's live status:
 *   ok    read the plan
 *   nda   signed in, but must sign the NDA first (/[locale]/plan/nda)
 *   none  no valid session (the gate)
 */

export type PlanAccessState = "ok" | "nda" | "none";

export interface PlanStatus {
  active: boolean;
  nda?: "none" | "pending" | "signed";
  contactOnFile?: boolean;
}

export function accessState(ok: boolean, status: PlanStatus | null): PlanAccessState {
  if (!ok || !status?.active) return "none";
  return status.nda === "pending" ? "nda" : "ok";
}
