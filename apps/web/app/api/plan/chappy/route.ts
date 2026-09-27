/**
 * Chappy on the business plan.
 *
 *   GET  /api/plan/chappy   -> { history }         the viewer's conversation so far
 *   POST /api/plan/chappy   { message, sectionKey, locale } -> text/event-stream
 *        data: {"type":"text","text":"..."}      streamed reply
 *        data: {"type":"status","label":"..."}   a tool is running
 *        data: {"type":"done","escalated":bool}
 *        data: {"type":"error","code":"..."}
 *
 * The session id comes from the verified cookie, never the client. Fastify
 * stores both sides of every turn, rate limits, and texts the owner on the
 * first message of a visit; this route owns the plan knowledge and the model.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { planApi } from "@/lib/plan/api";
import { PLAN_COOKIE, verifyPlanToken, type PlanClaims } from "@/lib/plan/session";
import { PLAN_SCENARIO_COOKIE, resolveScenario } from "@/lib/plan/scenario";
import { isSectionKey, type SectionKey } from "@/lib/plan/sections";
import { getPlanKnowledge } from "@/lib/plan/chappy/knowledge";
import { systemBlocks, viewerBlock } from "@/lib/plan/chappy/prompt";
import { TOOL_STATUS, runTool, toolsFor } from "@/lib/plan/chappy/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.PLAN_CHAPPY_MODEL || "claude-opus-5";
const MAX_TOOL_ROUNDS = 4;
const MAX_CHARS = 1500;
const LOCALES = new Set(["en", "es", "zh-TW", "zh-CN"]);

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

type Turn = { role: "user" | "assistant"; content: string };

async function authed(req: NextRequest): Promise<PlanClaims | null> {
  return verifyPlanToken(req.cookies.get(PLAN_COOKIE)?.value);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const claims = await authed(req);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await planApi<{ history: Turn[] }>(`/plan/sessions/${encodeURIComponent(claims.sid)}/chat/history`, {});
  if (!res.ok) return NextResponse.json({ error: "unavailable" }, { status: res.status });
  return NextResponse.json({ history: res.data?.history ?? [] });
}

/** History from the API as model turns: starts with the user, no empty content. */
function toMessages(history: Turn[], message: string): Anthropic.Beta.BetaMessageParam[] {
  const turns = history.filter((t) => t.content.trim());
  while (turns.length && turns[0]!.role !== "user") turns.shift();
  return [...turns.map((t) => ({ role: t.role, content: t.content })), { role: "user", content: message }];
}

export async function POST(req: NextRequest): Promise<Response> {
  const claims = await authed(req);
  if (!claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { message?: unknown; sectionKey?: unknown; locale?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_CHARS) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sectionKey: SectionKey | null = typeof body.sectionKey === "string" && isSectionKey(body.sectionKey) ? body.sectionKey : null;
  const locale = typeof body.locale === "string" && LOCALES.has(body.locale) ? body.locale : "en";
  const scenario = resolveScenario(claims, req.cookies.get(PLAN_SCENARIO_COOKIE)?.value);

  const api = anthropic();
  if (!api) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const begin = await planApi<{ history: Turn[] }>(`/plan/sessions/${encodeURIComponent(claims.sid)}/chat/begin`, { message, sectionKey });
  if (begin.status === 429) return NextResponse.json({ error: "too_many_messages" }, { status: 429 });
  if (!begin.ok) return NextResponse.json({ error: begin.status === 401 ? "unauthorized" : "unavailable" }, { status: begin.status === 401 ? 401 : 502 });

  let knowledge: string;
  try {
    knowledge = await getPlanKnowledge({
      claims,
      scenario,
      cookies: { plan: req.cookies.get(PLAN_COOKIE)?.value ?? "" },
      requestOrigin: req.nextUrl.origin,
    });
  } catch (err) {
    console.error("[plan-chappy] knowledge fetch failed", err);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  const system = systemBlocks(knowledge, viewerBlock(claims, locale, sectionKey, scenario));
  const tools = toolsFor(claims);
  const messages = toMessages(begin.data?.history ?? [], message);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      let reply = "";
      let escalated = false;
      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
          const params = {
            model: MODEL,
            max_tokens: 4000,
            system,
            tools,
            messages,
            betas: ["server-side-fallback-2026-07-01"],
            // Not yet in this SDK's types: refusal fallbacks, adaptive thinking, effort.
            fallbacks: "default",
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
          } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming;
          const s = api.beta.messages.stream(params, { signal: req.signal });
          if (round > 0 && reply && !/\s$/.test(reply)) {
            reply += "\n\n";
            send({ type: "text", text: "\n\n" });
          }
          for await (const ev of s) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              reply += ev.delta.text;
              send({ type: "text", text: ev.delta.text });
            }
          }
          const final = await s.finalMessage();
          if (final.stop_reason === "refusal") {
            if (!reply.trim()) {
              reply = "That one I'm not touching. Ask me something about the plan.";
              send({ type: "text", text: reply });
            }
            break;
          }
          if (final.stop_reason !== "tool_use") break;

          messages.push({ role: "assistant", content: final.content as Anthropic.Beta.BetaContentBlockParam[] });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type !== "tool_use") continue;
            send({ type: "status", label: TOOL_STATUS[block.name] ?? "Thinking" });
            const out = await runTool(block.name, block.input, { claims, sectionKey, scenario });
            if (out.escalated) escalated = true;
            results.push({ type: "tool_result", tool_use_id: block.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
          }
          messages.push({ role: "user", content: results });
        }
        send({ type: "done", escalated });
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("[plan-chappy] stream failed", err);
          send({ type: "error", code: err instanceof Anthropic.RateLimitError ? "busy" : "failed" });
        }
      } finally {
        if (reply.trim()) {
          await planApi(`/plan/sessions/${encodeURIComponent(claims.sid)}/chat/complete`, { content: reply, sectionKey, escalated }).catch(() => undefined);
        }
        try {
          controller.close();
        } catch {
          /* already closed by an aborted client */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
