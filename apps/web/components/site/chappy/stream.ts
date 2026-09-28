/**
 * Chappy web chat, the pure parts (Task E1): the SSE parser, the reducer that
 * folds one turn's events into an assistant message, and the error-code
 * mapping. No React, no fetch, so they are unit tested on their own
 * (__tests__/stream.test.ts).
 *
 * POST /chappy/chat (packages/api/src/chappy/routes.js) answers
 * text/event-stream frames: text {delta}, tool_start {name}, card {card},
 * done {usage, text}, error {code}. Refusals that happen before the stream
 * starts (rate, budget, too long, unidentified) are plain JSON responses.
 */

export type SseEvent = { event: string; data: Record<string, any> };

/**
 * An incremental SSE parser. `push` takes decoded text in any chunking
 * (an event, a line or even a CR/LF pair may be split across chunks) and
 * returns the events it completed, in order. `end` drops an unfinished
 * trailing event, as the SSE spec does.
 */
export class SseParser {
  private buffer = "";

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    // Normalize CRLF and lone CR to LF, but hold a trailing CR: its LF may be
    // the first character of the next chunk.
    const holdCr = this.buffer.endsWith("\r");
    const body = holdCr ? this.buffer.slice(0, -1) : this.buffer;
    this.buffer = body.replace(/\r\n?/g, "\n") + (holdCr ? "\r" : "");

    const events: SseEvent[] = [];
    let sep = this.buffer.indexOf("\n\n");
    while (sep >= 0) {
      const frame = this.buffer.slice(0, sep);
      this.buffer = this.buffer.slice(sep + 2);
      const event = parseFrame(frame);
      if (event) events.push(event);
      sep = this.buffer.indexOf("\n\n");
    }
    return events;
  }

  end(): SseEvent[] {
    this.buffer = "";
    return [];
  }
}

function parseFrame(frame: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  try {
    const parsed = JSON.parse(data.join("\n"));
    return { event, data: parsed && typeof parsed === "object" ? parsed : { value: parsed } };
  } catch {
    return null; // a malformed frame is skipped; the rest of the stream still renders
  }
}

/** Reads a fetch response body as SSE events, decoding UTF-8 with a TextDecoderStream. */
export async function* readSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  // The cast: lib.dom types TextDecoderStream's writable side as BufferSource, a superset of Uint8Array.
  const reader = body.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  const parser = new SseParser();
  try {
    while (true) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      for (const e of parser.push(value)) yield e;
    }
    for (const e of parser.end()) yield e;
  } finally {
    reader.cancel().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

/** A card from a tool result. E1 renders a translated fallback; E2 builds the native ones. */
export type ChappyCard = { type: string; [key: string]: unknown };

export type ChatError = { code: string; retryAfterSeconds?: number };

export type ChatMessage = {
  id: string;
  /** "note": a line the widget itself posts (a pay card settled, Task E2); never sent to the API. */
  role: "user" | "assistant" | "note";
  text: string;
  cards: ChappyCard[];
  /** The assistant turn is still streaming. */
  pending?: boolean;
  /** A note that reports a problem (an alert mark instead of the paid check). */
  alert?: boolean;
  /** A same-site link under a note (e.g. the member's orders page). */
  link?: { href: string; label: string };
  /** The tool Chappy is running right now (cleared when text arrives). */
  tool?: string;
  error?: ChatError;
};

/** Folds one SSE event into the assistant message it belongs to. Returns the same object when nothing changes. */
export function applyEvent(message: ChatMessage, e: SseEvent): ChatMessage {
  switch (e.event) {
    case "text": {
      const delta = typeof e.data.delta === "string" ? e.data.delta : "";
      if (!delta) return message;
      return { ...message, text: message.text + delta, tool: undefined };
    }
    case "tool_start":
      return { ...message, tool: typeof e.data.name === "string" ? e.data.name : "working" };
    case "card": {
      const card = e.data.card;
      if (!card || typeof card !== "object" || typeof card.type !== "string") return message;
      return { ...message, cards: [...message.cards, card as ChappyCard] };
    }
    case "done": {
      const text = message.text || (typeof e.data.text === "string" ? e.data.text : "");
      return { ...message, text, pending: false, tool: undefined };
    }
    case "error": {
      const code = typeof e.data.code === "string" ? e.data.code : "INTERNAL";
      // A refused answer must not be shown, even the part that streamed.
      const text = code === "REFUSAL" ? "" : message.text;
      return { ...message, text, pending: false, tool: undefined, error: { code } };
    }
    default:
      return message;
  }
}

/* -------------------------------------------------------------------------- */
/* Errors and tool status                                                     */
/* -------------------------------------------------------------------------- */

export const CHAPPY_MESSAGE_MAX = 1500;

/** Every key under chappyWeb.errors. */
export const CHAPPY_ERROR_CODES = ["RATE", "RATE_SOON", "BUDGET", "REFUSAL", "SIGN_IN_REQUIRED", "OFFLINE", "TOO_LONG", "BUSY", "INTERNAL"] as const;
export type ChappyErrorKey = (typeof CHAPPY_ERROR_CODES)[number];

/** A non-OK POST /chappy/chat response (sent before any stream) as a chat error. */
export function errorFromResponse(status: number, body: unknown): ChatError {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const code = typeof b.error === "string" ? b.error : "";
  if (code === "RATE") {
    const retry = Number(b.retryAfterSeconds);
    return Number.isFinite(retry) && retry > 0 ? { code: "RATE", retryAfterSeconds: retry } : { code: "RATE" };
  }
  if (code === "BUDGET") return { code: "BUDGET" };
  if (status === 413) return { code: "TOO_LONG" };
  if (status === 401) return { code: "SIGN_IN_REQUIRED" };
  if (status === 429 || status === 503) return { code: "BUSY" };
  return { code: "INTERNAL" };
}

/** The chappyWeb.errors key (and ICU values) for an error code. */
export function errorMessage(code?: string, retryAfterSeconds?: number): { key: ChappyErrorKey; values?: Record<string, number> } {
  switch (code) {
    case "RATE":
      return Number.isFinite(retryAfterSeconds) && (retryAfterSeconds as number) > 0
        ? { key: "RATE", values: { minutes: Math.max(1, Math.ceil((retryAfterSeconds as number) / 60)) } }
        : { key: "RATE_SOON" };
    case "BUDGET":
    case "REFUSAL":
    case "SIGN_IN_REQUIRED":
    case "OFFLINE":
      return { key: code };
    case "TOO_LONG":
      return { key: "TOO_LONG", values: { max: CHAPPY_MESSAGE_MAX } };
    case "BUSY":
    case "UPSTREAM":
      return { key: "BUSY" };
    default:
      return { key: "INTERNAL" };
  }
}

/** Errors worth a "Try again" button (the same message may well work a moment later). */
export function isRetryable(code?: string): boolean {
  // Not BAD_REQUEST: the same request would fail the same way.
  return code === "BUSY" || code === "UPSTREAM" || code === "OFFLINE" || code === "INTERNAL" || code === "ABORTED";
}

/** Chappy's tools (packages/api/src/chappy/tools.js), each with a chappyWeb.tools label. */
export const CHAPPY_TOOL_KEYS = [
  "search_menu",
  "get_menu_item",
  "get_locations",
  "get_membership_program",
  "get_my_profile",
  "get_my_orders",
  "get_order_status",
  "get_usual_order",
  "reorder",
  "cart",
  "set_arrival_and_pod",
  "apply_savings",
  "checkout",
  "start_group_order",
  "report_issue",
  "request_refund",
  "escalate_to_human",
  "working",
] as const;
export type ChappyToolKey = (typeof CHAPPY_TOOL_KEYS)[number];

export function toolStatusKey(name?: string): ChappyToolKey {
  return (CHAPPY_TOOL_KEYS as readonly string[]).includes(name ?? "") ? (name as ChappyToolKey) : "working";
}

/** Card types Chappy's tools emit; each has a chappyWeb.cards fallback until E2. */
export const CHAPPY_CARD_TYPES = ["sign-in", "pay", "confirm-zero", "group-share", "pod-call", "support-case"] as const;

/** chappyWeb.cards key for a card type ("confirm-zero" -> "confirmZero"), "unknown" for anything else. */
export function cardKey(type: string): string {
  if (!(CHAPPY_CARD_TYPES as readonly string[]).includes(type)) return "unknown";
  return type.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}
