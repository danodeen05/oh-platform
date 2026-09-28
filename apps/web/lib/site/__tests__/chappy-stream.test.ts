import { describe, expect, test } from "vitest";
import { splitSseFrames, finalChatText, CHAPPY_REFUSAL_TEXT, CHAPPY_ERROR_TEXT } from "../chappy-stream";

describe("splitSseFrames", () => {
  test("parses complete frames, skips comments, keeps the unfinished rest", () => {
    const buf = `: chappy\n\nevent: text\ndata: {"delta":"Hi"}\n\nevent: done\ndata: {"text":"Hi"}\n\nevent: te`;
    const { frames, rest } = splitSseFrames(buf);
    expect(frames).toEqual([
      { event: "text", data: { delta: "Hi" } },
      { event: "done", data: { text: "Hi" } },
    ]);
    expect(rest).toBe("event: te");
  });

  test("a delta containing a blank line is JSON-escaped and survives", () => {
    const { frames } = splitSseFrames(`event: text\ndata: ${JSON.stringify({ delta: "a\n\nb" })}\n\n`);
    expect(frames[0].data.delta).toBe("a\n\nb");
  });
});

describe("finalChatText", () => {
  test("a REFUSAL discards partial streamed text and shows the refusal message", () => {
    expect(finalChatText({ event: "error", data: { code: "REFUSAL" } }, "Sure, here is how to")).toBe(CHAPPY_REFUSAL_TEXT);
    expect(finalChatText({ event: "error", data: { code: "REFUSAL" } }, "")).toBe(CHAPPY_REFUSAL_TEXT);
  });

  test("other errors keep what arrived, else the generic error", () => {
    expect(finalChatText({ event: "error", data: { code: "BUSY" } }, "Partial answer")).toBe("Partial answer");
    expect(finalChatText({ event: "error", data: { code: "BUSY" } }, "")).toBe(CHAPPY_ERROR_TEXT);
    expect(finalChatText(null, "")).toBe(CHAPPY_ERROR_TEXT);
  });

  test("done shows the streamed text, falling back to the server's text", () => {
    expect(finalChatText({ event: "done", data: { text: "server" } }, "streamed")).toBe("streamed");
    expect(finalChatText({ event: "done", data: { text: "server" } }, "")).toBe("server");
  });
});
