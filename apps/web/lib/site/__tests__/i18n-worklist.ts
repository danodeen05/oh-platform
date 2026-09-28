/**
 * Shared plumbing for the Task C5 translation guards (not a test file).
 *
 * Task F1 made the guards ordinary tests (they were `it.fails` from C5
 * until the translations were complete). A failing guard names every gap
 * in its assertion message; each also prints a summary line:
 *
 *   pnpm --filter @oh/web test                       -> one summary line per failing guard
 *   I18N_WORKLIST=1 pnpm --filter @oh/web test       -> the full worklist, grouped
 */

export const SHOW_WORKLIST = Boolean(process.env.I18N_WORKLIST);

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
