/**
 * Chappy chat stream helpers for the legacy widget (components/ChappyChat.tsx).
 * POST /chappy/chat answers text/event-stream frames: text {delta},
 * tool_start {name}, card {card}, done {usage, text, actions, cards},
 * error {code}. Task E1 replaces the widget; these stay small and pure.
 */

export type ChappyFrame = { event: string; data: Record<string, any> };

/** Split buffered SSE text into complete frames plus the unfinished rest. */
export function splitSseFrames(buffer: string): { frames: ChappyFrame[]; rest: string } {
  const frames: ChappyFrame[] = [];
  let rest = buffer;
  let sep = rest.indexOf("\n\n");
  while (sep >= 0) {
    const raw = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    sep = rest.indexOf("\n\n");
    let event = "message";
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) continue; // comments / keep-alives
    try {
      frames.push({ event, data: JSON.parse(dataLines.join("\n")) });
    } catch {
      // A malformed frame is skipped; the rest of the stream still renders.
    }
  }
  return { frames, rest };
}

// English for now; E1 moves these into next-intl.
export const CHAPPY_REFUSAL_TEXT = "I can't help with that one. Ask me about the menu, your order or your membership.";
export const CHAPPY_ERROR_TEXT = "Oops! Something went wrong. Please try again. - Chappy";

/**
 * The message to show when the stream ends. A REFUSAL discards any partial
 * text that already streamed (the refused answer must not be shown); other
 * errors keep what arrived, else show the generic error.
 */
export function finalChatText(frame: ChappyFrame | null, streamed: string): string {
  if (frame?.event === "error") {
    if (frame.data?.code === "REFUSAL") return CHAPPY_REFUSAL_TEXT;
    return streamed || CHAPPY_ERROR_TEXT;
  }
  if (frame?.event === "done") return streamed || String(frame.data?.text || "");
  return streamed || CHAPPY_ERROR_TEXT; // stream ended without a terminal frame
}
