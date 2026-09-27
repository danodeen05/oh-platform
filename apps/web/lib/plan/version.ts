/**
 * Plan version label shown in the shell footer and on the print cover. It is
 * the engine's model version, so a preset change and the label can never drift.
 */
import { MODEL_VERSION } from "@oh/plan-model";

export const PLAN_VERSION = MODEL_VERSION;
export const PLAN_VERSION_LABEL = `Plan v${PLAN_VERSION}`;
