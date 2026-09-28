import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  SseParser,
  readSse,
  applyEvent,
  errorFromResponse,
  errorMessage,
  toolStatusKey,
  CHAPPY_ERROR_CODES,
  CHAPPY_TOOL_KEYS,
  type ChatMessage,
  type SseEvent,
} from "../stream";

function feed(chunks: string[], end = true): SseEvent[] {
  const p = new SseParser();
  const out: SseEvent[] = [];
  for (const c of chunks) out.push(...p.push(c));
  if (end) out.push(...p.end());
  return out;
}

describe("SseParser", () => {
  const wire =
    ": chappy\n\n" +
    'event: tool_start\ndata: {"name":"search_menu"}\n\n' +
    'event: text\ndata: {"delta":"We close "}\n\n' +
    'event: text\ndata: {"delta":"at 9."}\n\n' +
    'event: done\ndata: {"usage":{"output_tokens":12}}\n\n';

  const expected: SseEvent[] = [
    { event: "tool_start", data: { name: "search_menu" } },
    { event: "text", data: { delta: "We close " } },
    { event: "text", data: { delta: "at 9." } },
    { event: "done", data: { usage: { output_tokens: 12 } } },
  ];

  test("several events in one chunk come out in order; comments are skipped", () => {
    expect(feed([wire])).toEqual(expected);
  });

  test("every possible single split point, mid-event, gives the same events in order", () => {
    for (let i = 1; i < wire.length; i++) {
      expect(feed([wire.slice(0, i), wire.slice(i)])).toEqual(expected);
    }
  });

  test("one character at a time still gives the same events in order", () => {
    expect(feed(wire.split(""))).toEqual(expected);
  });

  test("CRLF line endings, including a CR/LF pair split across chunks", () => {
    const crlf = wire.replace(/\n/g, "\r\n");
    expect(feed([crlf])).toEqual(expected);
    for (let i = 1; i < crlf.length; i++) {
      if (crlf[i - 1] === "\r") expect(feed([crlf.slice(0, i), crlf.slice(i)])).toEqual(expected);
    }
  });

  test("a trailing partial event is held until it completes, and dropped if the stream ends first", () => {
    const p = new SseParser();
    expect(p.push('event: text\ndata: {"delta":"a"}\n\nevent: text\ndata: {"del')).toEqual([{ event: "text", data: { delta: "a" } }]);
    expect(p.push('ta":"b"}\n')).toEqual([]);
    expect(p.push("\n")).toEqual([{ event: "text", data: { delta: "b" } }]);
    expect(p.push('event: done\ndata: {"usage":{}}')).toEqual([]);
    expect(p.end()).toEqual([]);
  });

  test("a delta with blank lines inside is JSON-escaped on the wire and survives", () => {
    expect(feed([`event: text\ndata: ${JSON.stringify({ delta: "a\n\nb" })}\n\n`])).toEqual([{ event: "text", data: { delta: "a\n\nb" } }]);
  });

  test("a malformed data line is skipped, and the stream keeps going", () => {
    expect(feed(["event: text\ndata: {nope\n\n", 'event: text\ndata: {"delta":"ok"}\n\n'])).toEqual([{ event: "text", data: { delta: "ok" } }]);
  });

  test("a frame with no event name is a plain message", () => {
    expect(feed(['data: {"x":1}\n\n'])).toEqual([{ event: "message", data: { x: 1 } }]);
  });
});

describe("readSse (bytes -> TextDecoderStream -> events)", () => {
  test("a multi-byte zh-TW character split across byte chunks decodes intact", async () => {
    const text = 'event: text\ndata: {"delta":"我們晚上九點打烊"}\n\nevent: done\ndata: {}\n\n';
    const bytes = new TextEncoder().encode(text);
    // Split inside the first CJK character's 3-byte sequence.
    const cut = bytes.indexOf(0xe6) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut, cut + 7));
        controller.enqueue(bytes.slice(cut + 7));
        controller.close();
      },
    });
    const events: SseEvent[] = [];
    for await (const e of readSse(body)) events.push(e);
    expect(events).toEqual([
      { event: "text", data: { delta: "我們晚上九點打烊" } },
      { event: "done", data: {} },
    ]);
  });
});

describe("applyEvent (one assistant turn)", () => {
  const start = (): ChatMessage => ({ id: "a1", role: "assistant", text: "", cards: [], pending: true });

  test("text deltas append in order; tool_start sets the status; done settles", () => {
    let m = start();
    m = applyEvent(m, { event: "tool_start", data: { name: "search_menu" } });
    expect(m.tool).toBe("search_menu");
    m = applyEvent(m, { event: "text", data: { delta: "We close " } });
    expect(m.tool).toBeUndefined();
    m = applyEvent(m, { event: "text", data: { delta: "at 9." } });
    m = applyEvent(m, { event: "card", data: { card: { type: "pay", orderId: "o1" } } });
    m = applyEvent(m, { event: "done", data: { usage: {}, text: "We close at 9." } });
    expect(m).toMatchObject({ text: "We close at 9.", pending: false, cards: [{ type: "pay", orderId: "o1" }] });
  });

  test("done with no streamed text uses the final text", () => {
    expect(applyEvent(start(), { event: "done", data: { text: "Hi." } }).text).toBe("Hi.");
  });

  test("a REFUSAL throws away the partial text", () => {
    let m = applyEvent(start(), { event: "text", data: { delta: "Sure, here is how to" } });
    m = applyEvent(m, { event: "error", data: { code: "REFUSAL" } });
    expect(m).toMatchObject({ text: "", pending: false, error: { code: "REFUSAL" } });
  });

  test("other stream errors keep what arrived and add the error", () => {
    let m = applyEvent(start(), { event: "text", data: { delta: "Partial" } });
    m = applyEvent(m, { event: "error", data: { code: "BUSY" } });
    expect(m).toMatchObject({ text: "Partial", pending: false, error: { code: "BUSY" } });
  });

  test("unknown events change nothing", () => {
    const m = start();
    expect(applyEvent(m, { event: "ping", data: {} })).toBe(m);
  });
});

describe("error code mapping", () => {
  test("HTTP refusals before the stream map to the translated codes", () => {
    expect(errorFromResponse(429, { error: "RATE", retryAfterSeconds: 90 })).toEqual({ code: "RATE", retryAfterSeconds: 90 });
    expect(errorFromResponse(429, { error: "BUDGET" })).toEqual({ code: "BUDGET" });
    expect(errorFromResponse(413, { error: "MESSAGE_TOO_LONG", max: 1500 })).toEqual({ code: "TOO_LONG" });
    expect(errorFromResponse(401, { error: "x" })).toEqual({ code: "SIGN_IN_REQUIRED" });
    expect(errorFromResponse(503, { error: "CHAPPY_UNAVAILABLE" })).toEqual({ code: "BUSY" });
    expect(errorFromResponse(500, null)).toEqual({ code: "INTERNAL" });
    expect(errorFromResponse(400, { error: "MESSAGE_REQUIRED" })).toEqual({ code: "INTERNAL" });
  });

  test("stream error codes fold into the translated set", () => {
    expect(errorMessage("REFUSAL")).toEqual({ key: "REFUSAL" });
    expect(errorMessage("SIGN_IN_REQUIRED")).toEqual({ key: "SIGN_IN_REQUIRED" });
    expect(errorMessage("OFFLINE")).toEqual({ key: "OFFLINE" });
    expect(errorMessage("BUDGET")).toEqual({ key: "BUDGET" });
    expect(errorMessage("TOO_LONG")).toEqual({ key: "TOO_LONG", values: { max: 1500 } });
    for (const code of ["BUSY", "UPSTREAM"]) expect(errorMessage(code)).toEqual({ key: "BUSY" });
    for (const code of ["INTERNAL", "BAD_REQUEST", "ABORTED", "WHATEVER", undefined]) expect(errorMessage(code)).toEqual({ key: "INTERNAL" });
  });

  test("RATE rounds the wait up to whole minutes, or says 'in a moment' without one", () => {
    expect(errorMessage("RATE", 90)).toEqual({ key: "RATE", values: { minutes: 2 } });
    expect(errorMessage("RATE", 30)).toEqual({ key: "RATE", values: { minutes: 1 } });
    expect(errorMessage("RATE")).toEqual({ key: "RATE_SOON" });
    expect(errorMessage("RATE", -5)).toEqual({ key: "RATE_SOON" });
  });

  test("tool names map to a status label, unknown tools to a generic one", () => {
    expect(toolStatusKey("search_menu")).toBe("search_menu");
    expect(toolStatusKey("checkout")).toBe("checkout");
    expect(toolStatusKey("something_new")).toBe("working");
    expect(toolStatusKey(undefined)).toBe("working");
  });
});

describe("chappyWeb translations", () => {
  const locales = ["en", "es", "zh-TW", "zh-CN"];
  const load = (l: string) => JSON.parse(readFileSync(path.resolve(__dirname, `../../../../messages/${l}.json`), "utf8"));
  const keys = (o: unknown, prefix = ""): string[] =>
    o && typeof o === "object" ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k)) : [prefix];

  test("all 4 locales have the same chappyWeb keys, and none is empty", () => {
    const en = keys(load("en").chappyWeb).sort();
    expect(en.length).toBeGreaterThan(20);
    for (const l of locales) {
      const ns = load(l).chappyWeb;
      expect(keys(ns).sort(), l).toEqual(en);
      for (const k of keys(ns)) expect(String(k.split(".").reduce((o: any, p) => o[p], ns)).trim().length, `${l} ${k}`).toBeGreaterThan(0);
    }
  });

  test("every error code and tool status the widget can show has a string", () => {
    const en = load("en").chappyWeb;
    for (const code of CHAPPY_ERROR_CODES) expect(en.errors[code], code).toBeTruthy();
    for (const tool of CHAPPY_TOOL_KEYS) expect(en.tools[tool], tool).toBeTruthy();
  });

  test("no em dashes and no emoji in any chappyWeb string", () => {
    for (const l of locales) {
      const s = JSON.stringify(load(l).chappyWeb);
      expect(s.includes("\u2014"), l).toBe(false);
      expect(/\p{Extended_Pictographic}/u.test(s), l).toBe(false);
    }
  });

  test("translated locales are not English copies", () => {
    const en = load("en").chappyWeb;
    for (const l of ["es", "zh-TW", "zh-CN"]) {
      const t = load(l).chappyWeb;
      expect(t.welcome, l).not.toBe(en.welcome);
      expect(t.quick.usual, l).not.toBe(en.quick.usual);
      expect(t.errors.RATE, l).not.toBe(en.errors.RATE);
    }
  });
});
