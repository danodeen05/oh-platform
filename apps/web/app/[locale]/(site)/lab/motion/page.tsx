/**
 * Task C3 (motion kit): dev-only demo of every components/site/motion
 * primitive, for manual QA and the Playwright long-task check.
 *
 * NAMING NOTE (deviation from the brief): the brief and controller notes
 * both ask for this at a path segment named `_lab`. Next.js's App Router
 * treats any `_`-prefixed folder as a "private folder" and excludes it
 * from routing entirely -- in every environment, not just production --
 * so `app/[locale]/_lab/motion/page.tsx` 404s unconditionally and can
 * never be reached to demo or Playwright-test. Verified locally: the
 * identical page under `_lab/` 404s, and under `lab/` (this file) it
 * serves normally. Using `lab` (no underscore) instead, with the actual
 * production gate done here in code via `notFound()`.
 *
 * Task C4 moved it into `(site)` so the kit is seen inside the new shell.
 * A route group can't gate `notFound()` for us, so the gate stays here.
 * This is a plain server component so the env
 * check runs before anything client-side mounts; the actual demo content
 * lives in a client component.
 */
import { notFound } from "next/navigation";
import { MotionLabClient } from "./MotionLabClient";

export default function MotionLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <MotionLabClient />;
}
