/**
 * Chappy's two tools on the plan. Tool definitions are deterministic (same
 * text every request) so they sit inside the prompt cache.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { PlanClaims } from "@/lib/plan/session";
import { isSectionVisible, type SectionKey } from "@/lib/plan/sections";
import { planApi } from "@/lib/plan/api";
import { leverCatalog, whatIf, type WhatIfChange } from "./engine";

let whatIfTool: Anthropic.Beta.BetaTool | null = null;

function whatIfDefinition(): Anthropic.Beta.BetaTool {
  whatIfTool ??= {
    name: "what_if",
    description: `Recompute the flagship unit's economics with the plan's own engine after changing one or more levers. Returns before and after: revenue, average check, guests per day, food/labor/occupancy % of sales, four-wall EBITDA and margin, break-even guests per day, build cost and payback. Values are clamped to the Model page slider bounds. Give either an absolute value or a percent change per lever. Percent levers are fractions (foodCostPct 0.32 means 32%). Levers: ${leverCatalog()}.`,
    input_schema: {
      type: "object",
      properties: {
        scenario: { type: "string", enum: ["conservative", "base", "aggressive"], description: "Starting scenario. Default: the one the viewer is looking at." },
        changes: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              lever: { type: "string" },
              value: { type: "number", description: "New absolute value" },
              changePct: { type: "number", description: "Relative change in percent, e.g. -20 for 20% lower" },
            },
            required: ["lever"],
          },
        },
      },
      required: ["changes"],
    },
  };
  return whatIfTool;
}

const ESCALATE: Anthropic.Beta.BetaTool = {
  name: "escalate_to_owner",
  description:
    "Pass a question or request to the owner of Oh!, who gets a text right away and follows up personally. Use for meeting requests, document requests (such as the diligence package), deal terms, and questions the plan cannot answer.",
  input_schema: {
    type: "object",
    properties: {
      question: { type: "string", description: "The viewer's request in their own words, with enough context for the owner to act on it" },
      contact_email: { type: "string", description: "The viewer's email, only if they gave one" },
    },
    required: ["question"],
  },
};

/** The model page is where the levers live; viewers who cannot see it do not get the calculator. */
export function toolsFor(claims: Pick<PlanClaims, "aud" | "sec">): Anthropic.Beta.BetaTool[] {
  return isSectionVisible(claims, "model") ? [whatIfDefinition(), ESCALATE] : [ESCALATE];
}

export const TOOL_STATUS: Record<string, string> = { what_if: "Running the numbers", escalate_to_owner: "Texting the owner" };

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  escalated?: boolean;
}

export async function runTool(
  name: string,
  input: unknown,
  ctx: { claims: PlanClaims; sectionKey: SectionKey | null; scenario: string },
): Promise<ToolOutcome> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (name === "what_if") {
    if (!isSectionVisible(ctx.claims, "model")) return { content: "Not available for this viewer.", isError: true };
    const result = whatIf({
      scenario: typeof args.scenario === "string" ? args.scenario : ctx.scenario,
      changes: Array.isArray(args.changes) ? (args.changes as WhatIfChange[]) : [],
    });
    return { content: JSON.stringify(result) };
  }
  if (name === "escalate_to_owner") {
    const question = typeof args.question === "string" ? args.question.trim() : "";
    if (question.length < 3) return { content: "question is required", isError: true };
    const email = typeof args.contact_email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.contact_email.trim()) ? args.contact_email.trim() : null;
    const res = await planApi<{ ok: boolean }>(`/plan/sessions/${encodeURIComponent(ctx.claims.sid)}/questions`, {
      sectionKey: ctx.sectionKey ?? "summary",
      body: question,
      contactEmail: email,
    });
    if (res.status === 429) return { content: "The owner has already received the maximum number of questions from this invitation today. Tell the viewer to try again tomorrow.", isError: true };
    if (!res.ok) return { content: "Could not reach the owner right now.", isError: true };
    return { content: `Sent to the owner${email ? ` with reply address ${email}` : " (no reply address)"}.`, escalated: true };
  }
  return { content: `Unknown tool ${name}`, isError: true };
}
