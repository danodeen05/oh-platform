/**
 * Shared plumbing for the Task C5 translation guards (not a test file).
 *
 * The guards are `it.fails` until F1, like C2's emoji guard: a known-red
 * guard that doesn't block the suite. Because an expected failure hides
 * its own output, each guard also prints its worklist:
 *
 *   pnpm --filter @oh/web test                       -> one summary line per guard
 *   I18N_WORKLIST=1 pnpm --filter @oh/web test       -> the full worklist, grouped
 *   I18N_STRICT=1 pnpm --filter @oh/web test         -> guards run as normal tests and
 *                                                       fail with the worklist (F1 flips
 *                                                       this on by deleting `.fails`)
 */
import { it } from "vitest";

export const STRICT = Boolean(process.env.I18N_STRICT);
export const SHOW_WORKLIST = Boolean(process.env.I18N_WORKLIST) || STRICT;

/** `it.fails` until F1; a normal `it` under I18N_STRICT=1. */
export const guard: typeof it.fails = STRICT ? (it as unknown as typeof it.fails) : it.fails;

/** Group `items` by `groupOf`, as "group (n)\n  item\n  item" blocks. */
export function formatWorklist<T>(title: string, items: T[], groupOf: (t: T) => string, line: (t: T) => string): string {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const g = groupOf(item);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(line(item));
  }
  const blocks = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, lines]) => `${g} (${lines.length})\n${lines.map((l) => `  ${l}`).join("\n")}`);
  return `${title}: ${items.length} item(s) in ${groups.size} group(s)\n${blocks.join("\n")}`;
}

/** Print a guard's summary always, and its full worklist when asked. */
export function report(title: string, items: unknown[], full: string): void {
  if (items.length === 0) return;
  // Straight to stdout: vitest hides console output from tests that end as expected failures.
  process.stdout.write(`${SHOW_WORKLIST ? full : `[i18n worklist] ${title}: ${items.length} (I18N_WORKLIST=1 for the list)`}\n`);
}
