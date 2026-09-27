import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The tiny subset of markdown Chappy is told to use: paragraphs, "- " lists,
 * **bold**, and [links](...). Rendered as React elements, never as HTML, so
 * nothing in a reply can inject markup. Links go through only when they
 * point inside the plan (next/link) or to https.
 */

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${i++}`;
    if (m[1] !== undefined) {
      out.push(
        <strong key={k} className="font-semibold text-oh-cream">
          {m[1]}
        </strong>,
      );
    } else {
      const label = m[2] ?? "";
      const href = m[3] ?? "";
      if (/^\/(en|es|zh-TW|zh-CN)\/plan(\/[a-z0-9-]*)?(#[\w-]+)?$/.test(href)) {
        out.push(
          <Link key={k} href={href} className="text-oh-ember-light underline decoration-oh-ember/50 underline-offset-2 hover:decoration-oh-ember-light">
            {label}
          </Link>,
        );
      } else if (/^https:\/\//.test(href)) {
        out.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-oh-ember-light underline underline-offset-2">
            {label}
          </a>,
        );
      } else {
        out.push(label);
      }
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ChappyMarkdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length === 0) return null;
        const bullets = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        if (bullets) {
          return (
            <ul key={b} className="m-0 mb-2 list-disc space-y-1 pl-5 text-inherit last:mb-0">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${b}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={b} className="m-0 mb-2 text-inherit last:mb-0">
            {lines.map((l, i) => {
              const bullet = /^\s*[-*•]\s+/.test(l);
              return (
                <span key={i}>
                  {i > 0 ? <br /> : null}
                  {bullet ? "• " : null}
                  {inline(bullet ? l.replace(/^\s*[-*•]\s+/, "") : l, `${b}-${i}`)}
                </span>
              );
            })}
          </p>
        );
      })}
    </>
  );
}
