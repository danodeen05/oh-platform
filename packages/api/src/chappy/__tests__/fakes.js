/**
 * Test doubles for Chappy: a fake Anthropic client that replays scripted
 * streams (no network, no model calls) and a tiny in-memory prisma.
 */
import { AnthropicError, APIError } from "@anthropic-ai/sdk";

let blockSeq = 0;
export const toolUse = (name, input, id = `toolu_${++blockSeq}`) => ({ type: "tool_use", id, name, input });
export const text = (t) => ({ type: "text", text: t });

/**
 * One scripted model response. `content` is the final message content;
 * stream events are derived from it (text deltas, tool_use starts).
 * `throws` makes the stream reject (e.g. an SDK JSON parse error).
 */
export function step({ content = [text("ok")], stop_reason = "end_turn", usage = {}, model = "claude-opus-5", throws = null } = {}) {
  return { content, stop_reason, usage, model, throws };
}

function makeStream(s) {
  const message = {
    id: `msg_${++blockSeq}`,
    type: "message",
    role: "assistant",
    model: s.model,
    content: s.content,
    stop_reason: s.stop_reason,
    stop_details: s.stop_reason === "refusal" ? { type: "refusal", category: "cyber", explanation: null } : null,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...s.usage },
  };
  const events = [{ type: "message_start", message: { ...message, content: [] } }];
  s.content.forEach((block, index) => {
    if (block.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } });
    } else if (block.type === "tool_use") {
      events.push({ type: "content_block_start", index, content_block: { ...block, input: {} } });
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
    } else {
      events.push({ type: "content_block_start", index, content_block: block });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta", delta: { stop_reason: s.stop_reason }, usage: { output_tokens: 5 } });
  events.push({ type: "message_stop" });
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) {
        if (s.throws && e.type === "content_block_stop") throw s.throws;
        yield e;
      }
    },
    async finalMessage() {
      if (s.throws) throw s.throws;
      return message;
    },
  };
}

/** A fake client exposing client.beta.messages.stream(params, options). */
export function fakeClient(script) {
  const calls = [];
  const client = {
    calls,
    beta: {
      messages: {
        stream(params, options) {
          calls.push({ params: structuredClone(params), options });
          const s = typeof script === "function" ? script(calls.length) : script[Math.min(calls.length - 1, script.length - 1)];
          return makeStream(s);
        },
      },
    },
  };
  return client;
}

export const jsonParseError = () => new AnthropicError("Unable to parse tool parameter JSON from model. JSON: {\"a\":");
export const apiError = (status = 529) => APIError.generate(status, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, "Overloaded", new Headers());

/** Minimal prisma for Chappy: conversations, users, tenant, locations, orders. */
export function fakePrisma({ users = [], conversations = [], orders = [] } = {}) {
  const convs = conversations.map((c) => ({ ...c }));
  const updates = [];
  let seq = 0;
  const prisma = {
    updates,
    convs,
    tenant: { findUnique: async () => ({ id: "tenant_oh", slug: "oh" }) },
    location: {
      findFirst: async () => ({ id: "loc_cc", name: "City Creek Mall", city: "Salt Lake City" }),
      findUnique: async ({ where }) => (where.id === "loc_cc" ? { id: "loc_cc", name: "City Creek Mall", city: "Salt Lake City" } : null),
    },
    user: {
      findUnique: async ({ where }) => users.find((u) => u.id === where.id) || null,
      findFirst: async () => {
        throw new Error("fakes: SMS identity must use an exact E.164 match (findMany + toE164), not findFirst/contains");
      },
      findMany: async ({ where }) => users.filter((u) => (where.phone?.endsWith ? (u.phone || "").endsWith(where.phone.endsWith) : true)),
      updateMany: async ({ where, data }) => {
        const hit = users.filter((u) => where.id?.in?.includes(u.id));
        for (const u of hit) Object.assign(u, data);
        return { count: hit.length };
      },
    },
    order: { findFirst: async ({ where }) => orders.find((o) => o.userId === where.userId) || null },
    chappyConversation: {
      findFirst: async ({ where }) =>
        convs.filter((c) => c.identifier === where.identifier && c.channel === where.channel && c.isActive).sort((a, b) => b.updatedAt - a.updatedAt)[0] || null,
      create: async ({ data }) => {
        const row = { id: `conv_${++seq}`, updatedAt: new Date(), ...data };
        convs.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        updates.push({ where, data: structuredClone(data) });
        const row = convs.find((c) => c.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const c of convs) if (c.identifier === where.identifier && c.channel === where.channel && c.isActive) (Object.assign(c, data), count++);
        return { count };
      },
    },
  };
  return prisma;
}

/** Collect every event a runTurn generator yields. */
export async function collect(gen) {
  const out = [];
  for await (const e of gen) out.push(e);
  return out;
}
