/**
 * Starting name and email for the NDA details form: what they saved, else
 * what this code's invitation knew (the API only sends `prefill` for the
 * viewer's own code, and only until they save details). Pure; every field
 * stays editable.
 */

import type { NdaState } from "./types";

export function startingIdentity(state: Pick<NdaState, "details" | "prefill">): { legalName: string; email: string } {
  if (state.details) return { legalName: state.details.legalName ?? "", email: state.details.email ?? "" };
  return { legalName: state.prefill?.legalName ?? "", email: state.prefill?.email ?? "" };
}
