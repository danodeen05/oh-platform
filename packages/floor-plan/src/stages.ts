/**
 * Order status page stages, as the guest's phone shows them during the
 * journey. Their own module (Task G2b) with a subpath export
 * ("@oh/floor-plan/stages"), because the package entry pulls in the layout
 * geometry and the plan model it reads (about 24 KB gzipped of plan data),
 * which the customer site's status page and Chappy tracker never need.
 * layout.ts re-exports these unchanged, so every existing import still works.
 */
export const PHONE_STAGES = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING", "COMPLETED"] as const;
export type PhoneStage = (typeof PHONE_STAGES)[number];
