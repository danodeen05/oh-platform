/**
 * Turns the plan's print route HTML into compact, structured text for
 * Chappy's context: headings become "#" lines, list items "- ", table rows
 * "| a | b |", and chrome (scripts, styles, SVG art, `.plan-print-noprint`
 * controls, aria-hidden footers) is dropped. A small tag scanner, not a full
 * parser: the input is our own server-rendered markup.
 */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const SKIP_TAGS = new Set(["script", "style", "svg", "noscript", "template", "button", "canvas"]);
const BLOCK = new Set(["p", "div", "section", "article", "header", "footer", "dl", "dt", "dd", "ul", "ol", "table", "thead", "tbody", "figure", "figcaption", "blockquote", "aside", "nav", "main"]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', middot: "·", times: "×", minus: "-" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function shouldSkip(tag: string, attrs: string): boolean {
  if (SKIP_TAGS.has(tag)) return true;
  if (/\bclass="[^"]*\bplan-print-noprint\b/.test(attrs)) return true;
  return /\baria-hidden="true"/.test(attrs);
}

/** Extract the `<article>` body when present (the print route wraps everything in one). */
export function articleOf(html: string): string {
  const a = html.indexOf("<article");
  const b = html.lastIndexOf("</article>");
  return a >= 0 && b > a ? html.slice(a, b + "</article>".length) : html;
}

export function htmlToText(html: string): string {
  const out: string[] = [];
  const stack: { tag: string; skip: boolean }[] = [];
  let skipDepth = 0;
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const push = (s: string) => {
    if (skipDepth === 0) out.push(s);
  };

  while ((m = re.exec(html))) {
    const [raw, tagName, attrs = "", text] = m;
    if (text !== undefined) {
      push(decodeEntities(text).replace(/\s+/g, " "));
      continue;
    }
    if (!tagName) continue; // comment
    const tag = tagName.toLowerCase();
    const closing = raw.startsWith("</");
    const selfClosing = raw.endsWith("/>") || VOID.has(tag);

    if (!closing) {
      if (tag === "img") {
        const alt = /\balt="([^"]*)"/.exec(attrs)?.[1];
        if (alt && alt.length > 3) push(` [image: ${decodeEntities(alt)}] `);
        continue;
      }
      if (tag === "br") {
        push("\n");
        continue;
      }
      if (selfClosing) continue;
      const skip = shouldSkip(tag, attrs);
      stack.push({ tag, skip });
      if (skip) skipDepth += 1;
      if (/^h[1-6]$/.test(tag)) push(`\n\n${"#".repeat(Math.min(4, Number(tag[1])))} `);
      else if (tag === "li") push("\n- ");
      else if (tag === "tr") push("\n|");
      else if (tag === "dt") push("\n");
      else if (tag === "dd") push(": ");
      else if (BLOCK.has(tag)) push("\n");
      continue;
    }

    // Closing tag: pop to the matching open element (tolerates sloppy nesting).
    let idx = stack.length - 1;
    while (idx >= 0 && stack[idx]!.tag !== tag) idx -= 1;
    if (idx < 0) continue;
    while (stack.length > idx) {
      const el = stack.pop()!;
      if (el.skip) skipDepth -= 1;
      if (el.tag === "td" || el.tag === "th") push(" |");
      else if (/^h[1-6]$/.test(el.tag)) push("\n");
      else if (el.tag === "p" || el.tag === "dd") push("\n");
    }
  }

  return out
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(- |\|)\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
