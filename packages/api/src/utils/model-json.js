/**
 * Parse a JSON object out of a model's text reply.
 *
 * Even when told to "respond with ONLY the JSON object", models sometimes wrap
 * it in a ```json fence or add a line of prose around it. Strip that, then
 * parse. Throws if no JSON can be recovered, so callers keep their fallbacks.
 */
export function parseModelJson(text) {
  let t = (text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch (err) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end <= start) throw err;
    return JSON.parse(t.slice(start, end + 1));
  }
}
