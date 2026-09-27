/**
 * Build-time stamp for the plan shell. The values are baked in by
 * next.config.mjs (`env`) at build time, so every deploy carries the date it
 * was built and the commit it came from; in dev they are the server start.
 */
export const PLAN_BUILD = {
  builtAt: process.env.NEXT_PUBLIC_PLAN_BUILT_AT ?? "",
  commit: process.env.NEXT_PUBLIC_PLAN_COMMIT ?? "",
} as const;
