/**
 * Chappy's plan knowledge: the viewer's own print document, as text.
 *
 * The print route renders every section this viewer's code may see, with the
 * engine's live numbers, in their current scenario. Fetching it with the
 * viewer's own cookie means Chappy knows exactly what the viewer is allowed
 * to read and nothing more: a landlord's Chappy never has the funding page.
 * It also stays in step with whatever is deployed, with no second copy of
 * the plan to keep in sync.
 *
 * Cached in memory per (build, engine version, audience, allowlist,
 * scenario). The viewer's label is scrubbed before caching so one viewer's
 * name never reaches another's context.
 */

import { MODEL_VERSION } from "@oh/plan-model";
import { PLAN_BUILD } from "@/lib/plan/build";
import { PLAN_COOKIE, type PlanClaims } from "@/lib/plan/session";
import { PLAN_SCENARIO_COOKIE } from "@/lib/plan/scenario";
import { isSectionVisible } from "@/lib/plan/sections";
import { articleOf, htmlToText } from "./htmlToText";
import { scenarioComparisonText } from "./engine";

const TTL_MS = process.env.NODE_ENV === "production" ? 30 * 60 * 1000 : 3 * 60 * 1000;
const MAX_ENTRIES = 48;
const cache = new Map<string, { text: string; at: number }>();
const inflight = new Map<string, Promise<string>>();

export function knowledgeKey(claims: Pick<PlanClaims, "aud" | "sec">, scenario: string): string {
  return [PLAN_BUILD.commit || "dev", MODEL_VERSION, claims.aud, [...claims.sec].sort().join(","), scenario].join(":");
}

/** Where the server can reach its own print route. */
export function selfOrigin(requestOrigin: string): string {
  if (process.env.PLAN_SELF_ORIGIN) return process.env.PLAN_SELF_ORIGIN.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return `http://127.0.0.1:${process.env.PORT || 3000}`;
  return requestOrigin;
}

export function scrubLabel(text: string, label: string): string {
  return label.trim().length >= 2 ? text.split(label).join("the viewer") : text;
}

/** Compose the final knowledge text from the print text and the viewer's visibility. */
export function composeKnowledge(printText: string, claims: Pick<PlanClaims, "aud" | "sec" | "lbl">): string {
  const parts = [`<plan_document>\n${scrubLabel(printText, claims.lbl)}\n</plan_document>`];
  if (isSectionVisible(claims, "model") || isSectionVisible(claims, "financials")) {
    parts.push(`<engine_scenarios>\nComputed live by the plan's engine for the flagship unit in all three scenarios.\n${scenarioComparisonText()}\n</engine_scenarios>`);
  }
  return parts.join("\n\n");
}

export async function getPlanKnowledge(opts: {
  claims: PlanClaims;
  scenario: string;
  cookies: { plan: string; scenario?: string };
  requestOrigin: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const key = knowledgeKey(opts.claims, opts.scenario);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const cookie = [`${PLAN_COOKIE}=${opts.cookies.plan}`, `${PLAN_SCENARIO_COOKIE}=${opts.scenario}`].join("; ");
    const res = await (opts.fetchImpl ?? fetch)(`${selfOrigin(opts.requestOrigin)}/en/plan/print`, {
      headers: { cookie, "x-plan-knowledge": "1" },
      cache: "no-store",
      redirect: "manual",
    });
    if (!res.ok) throw new Error(`print fetch ${res.status}`);
    const text = composeKnowledge(htmlToText(articleOf(await res.text())), opts.claims);
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(key, { text, at: Date.now() });
    return text;
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}
