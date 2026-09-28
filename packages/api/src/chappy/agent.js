/**
 * Chappy Chopstix - agent loop v3 (Task B1).
 *
 * One turn = one customer message. runTurn streams it through Claude with a
 * manual tool loop and yields transport-neutral events:
 *
 *   {type:"text", delta} | {type:"tool_start", name} | {type:"card", card}
 *   | {type:"done", usage, text} | {type:"error", code}
 *
 * Request shape (every round, see buildRequest):
 *   client.beta.messages.stream({ model: CHAPPY_MODEL, max_tokens: 16000,
 *     thinking: {type:"adaptive"}, output_config: {effort:"medium"},
 *     betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
 *     system: [{type:"text", text: FROZEN_SYSTEM, cache_control:{type:"ephemeral"}}],
 *     tools: TOOL_DEFS (sorted by name, strict, eager_input_streaming), messages })
 *
 * Caching: tools + system are byte-identical for every caller and end at the
 * cache breakpoint. The per-user facts ride in a <context> block at the start
 * of each user turn, after the breakpoint (prompts.js buildContextBlock).
 *
 * Loop rules:
 *  - At most MAX_TOOL_ROUNDS (6) rounds of tool execution per turn, then one
 *    final request with tool_choice {type:"none"} (tools stay in the request
 *    so the cached prefix is unchanged). A 7th tool round is never run: if the
 *    final request still returns tool_use, those calls are dropped and a
 *    canned text ends the turn.
 *  - stop_reason is checked before content is used: "refusal" ends the turn
 *    with {type:"error", code:"REFUSAL"}; the refused content is never saved,
 *    but tool rounds that already ran this turn are (so are they on an API
 *    error), because their side effects are real; "max_tokens" keeps
 *    the text and runs no tools.
 *  - Eager input streaming means inputs are not validated server-side, so
 *    every tool input is validated against its schema before it runs; a bad
 *    one becomes an is_error INVALID_JSON tool_result. JSON the SDK cannot
 *    parse at all re-issues the request (at most twice); API errors do not.
 *  - After a mid-output server-side fallback, blocks the declined model wrote
 *    before the last `fallback` block (thinking, tool_use) are not echoed or run.
 *
 * History: the last HISTORY_LIMIT (20) messages, trimmed so it starts on a
 * real customer turn and never holds an orphaned tool_use or tool_result.
 */
import { APIError, AnthropicError } from "@anthropic-ai/sdk";
import { FROZEN_SYSTEM, CHAPPY_LOCALES, buildContextBlock, neutralizeContextTags, fallbackText } from "./prompts.js";
import { TOOL_DEFS, executeTool, validateToolInput } from "./tools.js";

export const CHAPPY_MODEL = process.env.CHAPPY_MODEL || "claude-opus-5";
export const MAX_TOKENS = 16000;
export const MAX_TOOL_ROUNDS = 6;
export const HISTORY_LIMIT = 20;
export const MESSAGE_MAX_CHARS = 1500;
export const CHAPPY_BETAS = Object.freeze(["server-side-fallback-2026-07-01"]);
export { CHAPPY_LOCALES };

const JSON_RETRY_LIMIT = 2;
const CONVERSATION_IDLE_MS = 30 * 60 * 1000;
const IN_POD_WINDOW_MS = 4 * 60 * 60 * 1000;
const ACTIVE_ORDER_STATUSES = ["PAID", "QUEUED", "PREPPING", "READY", "SERVING"];

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** The exact request body for one round. Deterministic for equal inputs. */
export function buildRequest({ messages, toolDefs = TOOL_DEFS, finalRound = false }) {
  const req = {
    model: CHAPPY_MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    betas: [...CHAPPY_BETAS],
    fallbacks: "default",
    system: [{ type: "text", text: FROZEN_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [...toolDefs].sort(byName),
    messages,
  };
  // The round after the last tool round: answer in text, no more tools.
  if (finalRound) req.tool_choice = { type: "none" };
  return req;
}

// ---------------------------------------------------------------------------
// History

function blocksOf(m) {
  if (typeof m?.content === "string") return [{ type: "text", text: m.content }];
  return Array.isArray(m?.content) ? m.content : [];
}

/** A turn the customer typed (not a tool_result carrier). */
export function isCustomerTurn(m) {
  if (!m || m.role !== "user") return false;
  if (typeof m.content === "string") return m.content.length > 0;
  const blocks = blocksOf(m);
  return blocks.some((b) => b.type === "text") && !blocks.some((b) => b.type === "tool_result");
}

/**
 * Drop what the API would reject: tool_use blocks without a tool_result in the
 * next message, tool_results without their tool_use in the previous message,
 * and messages left empty. Legacy histories (interrupted streams) need this.
 */
export function repairHistory(messages) {
  const list = (Array.isArray(messages) ? messages : []).filter((m) => m && (m.role === "user" || m.role === "assistant"));
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (typeof m.content === "string") {
      if (m.content) out.push({ role: m.role, content: m.content });
      continue;
    }
    let blocks = blocksOf(m);
    if (m.role === "assistant") {
      const answered = new Set(blocksOf(list[i + 1]).filter((b) => b.type === "tool_result").map((b) => b.tool_use_id));
      blocks = blocks.filter((b) => b.type !== "tool_use" || answered.has(b.id));
      if (!blocks.some((b) => b.type === "text" || b.type === "tool_use")) continue;
    } else {
      const prev = out.at(-1);
      const asked = new Set(prev && prev.role === "assistant" ? blocksOf(prev).filter((b) => b.type === "tool_use").map((b) => b.id) : []);
      blocks = blocks.filter((b) => b.type !== "tool_result" || asked.has(b.tool_use_id));
    }
    if (blocks.length) out.push({ role: m.role, content: blocks });
  }
  return out;
}

/** The last `limit` messages, starting on a customer turn, with no orphans. */
export function trimHistory(messages, limit = HISTORY_LIMIT) {
  const msgs = repairHistory(messages);
  if (msgs.length === 0) return [];
  const from = Math.max(0, msgs.length - limit);
  let start = from;
  while (start < msgs.length && !isCustomerTurn(msgs[start])) start++;
  if (start >= msgs.length) {
    // One very long turn: keep it whole rather than send a headless history.
    start = from;
    while (start > 0 && !isCustomerTurn(msgs[start])) start--;
    if (!isCustomerTurn(msgs[start])) return [];
  }
  return msgs.slice(start);
}

/**
 * Assistant content safe to echo back: known block types only, and after a
 * mid-output fallback nothing model-internal from before the last boundary.
 */
export function echoableContent(content) {
  const blocks = Array.isArray(content) ? content : [];
  let boundary = -1;
  blocks.forEach((b, i) => {
    if (b?.type === "fallback") boundary = i;
  });
  const out = [];
  blocks.forEach((b, i) => {
    if (!b) return;
    if (b.type === "text") {
      if (!b.text) return;
      const t = { type: "text", text: b.text };
      if (Array.isArray(b.citations) && b.citations.length) t.citations = b.citations;
      out.push(t);
    } else if (i < boundary) {
      // Declined model's thinking / tool calls: never echoed, never run.
    } else if (b.type === "tool_use") {
      out.push({ type: "tool_use", id: b.id, name: b.name, input: b.input ?? {} });
    } else if (b.type === "thinking") {
      out.push({ type: "thinking", thinking: b.thinking ?? "", signature: b.signature });
    } else if (b.type === "redacted_thinking") {
      out.push({ type: "redacted_thinking", data: b.data });
    }
  });
  return out;
}

const withoutToolUse = (blocks) => blocks.filter((b) => b.type !== "tool_use");
const textOf = (blocks) => blocks.filter((b) => b.type === "text").map((b) => b.text).join("");

// ---------------------------------------------------------------------------
// Identity, conversations and per-turn context

/** The conversation key for an identity. Guests are namespaced so they can never collide with a member id. */
export function conversationIdentifier(identity) {
  if (!identity) return null;
  if (identity.kind === "member") return identity.userId;
  if (identity.kind === "guest") return `guest:${identity.guestKey}`;
  if (identity.kind === "sms") return identity.phone;
  return null;
}

export async function loadOrCreateConversation(prisma, identifier, channel, now = new Date()) {
  let conversation = await prisma.chappyConversation.findFirst({
    where: { identifier, channel, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!conversation || conversation.updatedAt < new Date(now.getTime() - CONVERSATION_IDLE_MS)) {
    conversation = await prisma.chappyConversation.create({ data: { identifier, channel, messages: [], isActive: true } });
  }
  return conversation;
}

export async function saveConversation(prisma, conversation, messages, now = new Date()) {
  await prisma.chappyConversation.update({
    where: { id: conversation.id },
    data: { messages: trimHistory(messages, HISTORY_LIMIT), updatedAt: now, lastMessageAt: now },
  });
}

export async function resetConversation(prisma, identifier, channel) {
  await prisma.chappyConversation.updateMany({ where: { identifier, channel, isActive: true }, data: { isActive: false } });
}

/**
 * Server facts for this turn: the public part goes in the <context> block,
 * the rest (ids) only into the tool context. Never throws; missing data is null.
 */
export async function loadTurnContext({ prisma, identity, channel, locale, now = new Date() }) {
  const out = { tenantId: null, userId: null, locationId: null, public: { tier: null, cart: null, location: null, locale, inPod: null, channel } };
  const safe = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      console.error("[Chappy] context lookup failed:", err?.message);
      return null;
    }
  };
  const tenant = await safe(() => prisma.tenant.findUnique({ where: { slug: "oh" } }));
  out.tenantId = tenant?.id || null;
  const userId = identity?.kind === "member" || identity?.kind === "sms" ? identity.userId || null : null;
  if (userId) {
    const user = await safe(() => prisma.user.findUnique({ where: { id: userId }, select: { id: true, membershipTier: true } }));
    if (user) {
      out.userId = user.id;
      out.public.tier = user.membershipTier || null;
    }
  }
  const location = await safe(() =>
    identity?.locationId
      ? prisma.location.findUnique({ where: { id: identity.locationId } })
      : prisma.location.findFirst({ where: { tenantId: out.tenantId }, orderBy: { name: "asc" } }),
  );
  if (location) {
    out.locationId = location.id;
    out.public.location = { id: location.id, name: location.name };
  }
  if (out.userId) {
    const order = await safe(() =>
      prisma.order.findFirst({
        where: {
          userId: out.userId,
          paymentStatus: "PAID",
          seatId: { not: null },
          status: { in: ACTIVE_ORDER_STATUSES },
          createdAt: { gte: new Date(now.getTime() - IN_POD_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
        select: { orderNumber: true, status: true, seat: { select: { number: true } } },
      }),
    );
    if (order?.seat) out.public.inPod = { pod: order.seat.number, orderNumber: order.orderNumber, status: order.status };
  }
  return out;
}

// ---------------------------------------------------------------------------
// The loop

function errorCode(err) {
  if (err instanceof APIError) {
    if (err.name === "APIUserAbortError" || err.constructor?.name === "APIUserAbortError") return "ABORTED";
    if (err.status === 429 || err.status === 529 || err.status === 503) return "BUSY";
    if (err.status === 400) return "BAD_REQUEST";
    return "UPSTREAM";
  }
  if (err?.name === "AbortError") return "ABORTED";
  return "INTERNAL";
}

/** The SDK's own tool-input JSON failure (not an API error): safe to re-issue. */
function isToolJsonError(err) {
  return err instanceof AnthropicError && !(err instanceof APIError);
}

/** Cards the widget can render, from a tool result. */
function cardsFrom(result) {
  if (!result || typeof result !== "object") return [];
  const cards = [];
  if (result.card && typeof result.card === "object") cards.push(result.card);
  if (result.requiresApplePay && result.clientSecret) {
    cards.push({
      kind: "apple_pay",
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      clientSecret: result.clientSecret,
      totalCents: result.totalCents,
      locationName: result.locationName,
    });
  }
  return cards;
}

function addUsage(total, message) {
  const u = message?.usage || {};
  for (const k of ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]) {
    if (typeof u[k] === "number") total[k] += u[k];
  }
  total.model = message?.model || total.model;
  const iterations = Array.isArray(u.iterations) ? u.iterations : [];
  if ((message?.content || []).some((b) => b?.type === "fallback") || iterations.some((it) => it?.type === "fallback_message")) total.fallback = true;
}

/**
 * Run one customer turn. Never throws: failures end with an error event.
 * @param {object} p
 * @param {object} p.client        Anthropic client (client.beta.messages.stream)
 * @param {object} p.prisma        basePrisma (never the demo-wrapped client)
 * @param {object} p.identity      {kind:"member",userId} | {kind:"guest",guestKey} | {kind:"sms",phone,userId}
 * @param {string} p.channel       "web" | "sms"
 * @param {string} p.locale        en | zh-TW | zh-CN | es (anything else is en)
 * @param {string} p.message       the customer's text (length already capped by the route)
 * @param {object} p.conversation  the ChappyConversation row to continue and save
 * @param {object} [p.tools]       { defs, execute(name, input, ctx) }; default TOOL_DEFS / executeTool
 * @param {Date}   [p.now]
 * @param {AbortSignal} [p.signal] aborts the model stream (client went away)
 */
export async function* runTurn({ client, prisma, identity, channel = "web", locale = "en", message, conversation, tools, now = new Date(), signal }) {
  const toolset = tools || { defs: TOOL_DEFS, execute: executeTool };
  const defsByName = new Map(toolset.defs.map((d) => [d.name, d]));
  const lang = CHAPPY_LOCALES.includes(locale) ? locale : "en";

  const ctx = await loadTurnContext({ prisma, identity, channel, locale: lang, now });
  const toolCtx = { prisma, userId: ctx.userId, guestId: null, locationId: ctx.locationId, tenantId: ctx.tenantId, channel, locale: lang };

  const messages = [
    ...trimHistory(conversation?.messages || [], HISTORY_LIMIT),
    { role: "user", content: [buildContextBlock(ctx.public), { type: "text", text: neutralizeContextTags(message) }] },
  ];

  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, rounds: 0, model: null, fallback: false };
  let emittedText = false;
  let finalText = "";

  function* say(textToSay) {
    if (emittedText) yield { type: "text", delta: "\n\n" };
    emittedText = true;
    yield { type: "text", delta: textToSay };
  }

  // When a turn ends in a refusal or an error AFTER tool rounds ran, those
  // tools may have had side effects (an order, a PaymentIntent). Keep the
  // completed rounds (each tool_use with its tool_result) in history so the
  // next turn knows about them; the refused/failed partial is never saved.
  const baseLength = messages.length;
  async function saveCompletedRounds() {
    let end = messages.length;
    while (end > baseLength && messages[end - 1].role !== "user") end--;
    if (end <= baseLength) return;
    try {
      await saveConversation(prisma, conversation, messages.slice(0, end), now);
    } catch (err) {
      console.error("[Chappy] saving completed tool rounds failed:", err?.message);
    }
  }

  // Requests 1..6 may run tools; request 7 (if reached) is tool_choice "none".
  for (let round = 1; round <= MAX_TOOL_ROUNDS + 1; round++) {
    const finalRound = round > MAX_TOOL_ROUNDS;
    let final = null;
    // After a JSON re-issue whose first attempt already streamed text, the
    // retry's text is not streamed again (the customer would see it twice).
    let suppressText = false;
    for (let attempt = 0; ; attempt++) {
      let needsBreak = emittedText;
      let sentThisAttempt = false;
      try {
        const stream = client.beta.messages.stream(buildRequest({ messages, toolDefs: toolset.defs, finalRound }), signal ? { signal } : undefined);
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            yield { type: "tool_start", name: event.content_block.name };
          } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text && !suppressText) {
            if (needsBreak) {
              yield { type: "text", delta: "\n\n" };
              needsBreak = false;
            }
            emittedText = true;
            sentThisAttempt = true;
            yield { type: "text", delta: event.delta.text };
          }
        }
        final = await stream.finalMessage();
        break;
      } catch (err) {
        if (isToolJsonError(err) && attempt < JSON_RETRY_LIMIT) {
          console.warn(`[Chappy] tool input JSON unparseable, re-issuing (attempt ${attempt + 1})`);
          if (sentThisAttempt) suppressText = true;
          continue;
        }
        console.error("[Chappy] model request failed:", err?.status || "", err?.message);
        await saveCompletedRounds();
        yield { type: "error", code: errorCode(err) };
        return;
      }
    }

    usage.rounds = round;
    addUsage(usage, final);

    // stop_reason first, content second.
    if (final.stop_reason === "refusal") {
      await saveCompletedRounds();
      yield { type: "error", code: "REFUSAL" };
      return;
    }

    const content = echoableContent(final.content);
    const toolUses = content.filter((b) => b.type === "tool_use");

    if (final.stop_reason === "tool_use" && toolUses.length > 0 && !finalRound) {
      messages.push({ role: "assistant", content });
      const results = [];
      for (const block of toolUses) {
        const def = defsByName.get(block.name);
        if (!def) {
          results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: `Unknown tool: ${block.name}` });
          continue;
        }
        const check = validateToolInput(def.input_schema, block.input);
        if (!check.ok) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: JSON.stringify({ INVALID_JSON: JSON.stringify(block.input ?? null), errors: check.errors }),
          });
          continue;
        }
        try {
          const result = await toolset.execute(block.name, block.input, toolCtx);
          for (const card of cardsFrom(result)) yield { type: "card", card };
          results.push({ type: "tool_result", tool_use_id: block.id, content: typeof result === "string" ? result : JSON.stringify(result ?? null) });
        } catch (err) {
          console.error(`[Chappy] tool ${block.name} failed:`, err?.message);
          results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: `Error: ${err?.message || "tool failed"}` });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    // Terminal round: end_turn, max_tokens (tools never run on a truncated
    // turn), pause_turn, or the round cap with tools still requested.
    let finalContent = withoutToolUse(content);
    const capped = final.stop_reason === "tool_use" && toolUses.length > 0;
    if (capped) {
      const note = fallbackText("roundCap", lang);
      yield* say(note);
      finalContent = [...finalContent, { type: "text", text: note }];
    } else if (!textOf(finalContent) && !emittedText) {
      const note = fallbackText("empty", lang);
      yield* say(note);
      finalContent = [...finalContent, { type: "text", text: note }];
    }
    if (!finalContent.some((b) => b.type === "text")) finalContent.push({ type: "text", text: fallbackText("empty", lang) });
    finalText = textOf(finalContent);
    messages.push({ role: "assistant", content: finalContent });
    break;
  }

  try {
    await saveConversation(prisma, conversation, messages, now);
  } catch (err) {
    console.error("[Chappy] saving the conversation failed:", err?.message);
  }
  yield { type: "done", usage, text: finalText };
}

/** SMS keywords handled without the model. */
export function handleSpecialKeywords(message) {
  const normalized = String(message || "").trim().toUpperCase();
  if (normalized === "STOP") {
    return { handled: true, response: "You've been unsubscribed from Oh! Beef Noodle Soup messages. Text START to resubscribe.", action: "UNSUBSCRIBE" };
  }
  if (normalized === "HELP") {
    return {
      handled: true,
      response: "Oh! Beef Noodle Soup: Text to order, check points, or get recommendations. Reply STOP to unsubscribe. Msg&data rates may apply. Contact: hello@ohbeef.com",
      action: "HELP",
    };
  }
  if (normalized === "START") {
    return { handled: true, response: "Welcome back! I'm Chappy, your Oh! ordering assistant. How can I help you today?", action: "RESUBSCRIBE" };
  }
  return { handled: false };
}

export default { runTurn, resetConversation, handleSpecialKeywords };
