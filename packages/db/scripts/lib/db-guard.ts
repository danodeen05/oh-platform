/**
 * Shared target-database guard for the one-off and cutover scripts (Task G3).
 *
 * Every script that writes refuses a DATABASE_URL that is not on this
 * machine (127.0.0.1 / localhost) unless the operator opts in on purpose
 * with `ALLOW_NON_LOCAL=1` (or the script's own older flag, kept so the
 * E2/F2 instructions still work). It prints the target as host/database
 * only, never the user or password, so the operator can confirm which
 * database is about to be touched before any row is read.
 */

export interface DbTarget {
  host: string;
  database: string;
  local: boolean;
}

/** Parses a postgres URL into host/database (no credentials). Returns null for an unparseable URL. */
export function describeDatabaseUrl(url: string | undefined): DbTarget | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) return null;
    const host = parsed.hostname;
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    return { host, database, local: host === "127.0.0.1" || host === "localhost" };
  } catch {
    return null;
  }
}

/**
 * Throws unless DATABASE_URL is local or an allow flag is set to "1".
 * `extraFlags` are script-specific legacy flag names (e.g. ALLOW_NON_LOCAL_SCRUB).
 * Returns the described target (for the caller's log line).
 */
export function requireSafeTarget(scriptName: string, env: NodeJS.ProcessEnv = process.env, extraFlags: string[] = []): DbTarget {
  const target = describeDatabaseUrl(env.DATABASE_URL);
  if (!target) throw new Error(`[${scriptName}] DATABASE_URL is missing or not a postgres URL.`);
  const flags = ["ALLOW_NON_LOCAL", ...extraFlags];
  const allowed = flags.some((f) => env[f] === "1");
  if (!target.local && !allowed) {
    throw new Error(`[${scriptName}] DATABASE_URL points at ${target.host}/${target.database}, which is not local. Set ALLOW_NON_LOCAL=1 to run against it on purpose.`);
  }
  return target;
}

/** One log line naming the target and the mode, printed before any work. */
export function targetBanner(scriptName: string, target: DbTarget, dryRun: boolean): string {
  return `[${scriptName}] target ${target.local ? "LOCAL" : "REMOTE"} ${target.host}/${target.database}${dryRun ? " (dry run, no writes)" : " (WRITING)"}`;
}

/** True when this module is the entry point (tsx or node), matching the repo's isMain convention. */
export function isEntryPoint(importMetaUrl: string): boolean {
  return typeof process.argv[1] === "string" && importMetaUrl === new URL(`file://${process.argv[1]}`).href;
}
