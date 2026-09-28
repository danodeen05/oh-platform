/** Shapes returned by the API's /plan/sessions/:sid/nda* routes (packages/api/src/plan/nda.js). */

import type { NdaRecipient } from "./document";

export type NdaStep = "details" | "verify" | "sign" | "done";

export interface NdaCountersigner {
  name: string;
  title: string;
  signature: string;
}

export interface NdaState {
  required: boolean;
  step: NdaStep;
  ndaId: string | null;
  details: NdaRecipient | null;
  /** Starting values from this code's invitation, until they save their own details. */
  prefill?: { legalName: string; email: string } | null;
  phoneMasked: string | null;
  otpSentAt: string | null;
  countersigner: NdaCountersigner | null;
  audit: { openedAt: string | null; detailsAt: string | null; phoneVerifiedAt: string | null; signedAt: string | null };
  signedAt: string | null;
}
