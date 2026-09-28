/**
 * Task G3 fix round 1: Railway variable reads/writes for the cutover, through
 * the Railway CLI with the value on STDIN (never in argv), validated first.
 * `run(args, input?)` executes `railway <args>` and returns stdout; the CLI
 * script passes execFileSync, tests pass a fake.
 */
import { validateEnvValue } from "./env-values.js";

export const API_SERVICE = "@oh/api";

/** The variable map of a service (values stay in memory, never printed). */
export function railwayVars(run, service = API_SERVICE) {
  const out = run(["variable", "list", "--service", service, "--json"]);
  const parsed = JSON.parse(out);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("unexpected railway variable list output");
  return parsed;
}

/** Validates, then sets KEY from stdin with --skip-deploys, then reads it back. */
export function railwaySet(run, { key, value, service = API_SERVICE, dryRun }) {
  validateEnvValue(key, value);
  if (dryRun) return { written: false, dryRun: true };
  run(["variable", "set", key, "--stdin", "--skip-deploys", "--service", service], value);
  const back = railwayVars(run, service)[key];
  if (back !== value) throw new Error(`${key} did not read back as written on ${service}`);
  return { written: true, dryRun: false };
}
