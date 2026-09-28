/**
 * Task G2a fix round 1: the seal subset font (public/fonts/seal-glyphs.woff2)
 * must really contain every glyph the seals draw, not just list them in the
 * generated seal-font.ts. This reads the font's own character map: WOFF2 is
 * a Brotli stream of the sfnt tables (Node's zlib decodes it), and the cmap
 * table is never transformed, so no font library is needed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { SEAL_FONT_GLYPHS } from "../seal/seal-font";
import { DEFAULT_SEAL, SEALS } from "../seal/seals";

// WOFF2 "known table" tags, by index (WOFF2 spec, 5.1).
const KNOWN = "cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill".split(
  " ",
).filter(Boolean);

function woff2Tables(buf: Buffer): Map<string, Buffer> {
  expect(buf.subarray(0, 4).toString("latin1")).toBe("wOF2");
  const numTables = buf.readUInt16BE(12);
  let off = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[off++];
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error("bad UIntBase128");
  };
  const dir: Array<{ tag: string; length: number }> = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[off++];
    let tag: string;
    if ((flags & 0x3f) === 63) {
      tag = buf.subarray(off, off + 4).toString("latin1");
      off += 4;
    } else {
      tag = (KNOWN[flags & 0x3f] + "    ").slice(0, 4);
    }
    const version = flags >> 6;
    const origLength = base128();
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    const length = transformed ? base128() : origLength;
    dir.push({ tag, length });
  }
  const data = brotliDecompressSync(buf.subarray(off, off + buf.readUInt32BE(20)));
  const out = new Map<string, Buffer>();
  let p = 0;
  for (const t of dir) {
    out.set(t.tag, data.subarray(p, p + t.length));
    p += t.length;
  }
  return out;
}

function cmapCodepoints(cmap: Buffer): Set<number> {
  const cps = new Set<number>();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const sub = cmap.subarray(cmap.readUInt32BE(4 + i * 8 + 4));
    const format = sub.readUInt16BE(0);
    if (format === 12) {
      const groups = sub.readUInt32BE(12);
      for (let g = 0; g < groups; g++) {
        const start = sub.readUInt32BE(16 + g * 12);
        const end = sub.readUInt32BE(20 + g * 12);
        const gid = sub.readUInt32BE(24 + g * 12);
        for (let c = start; c <= end; c++) if (gid + (c - start) !== 0) cps.add(c);
      }
    } else if (format === 4) {
      const segs = sub.readUInt16BE(6) / 2;
      const ends = 14;
      const starts = ends + segs * 2 + 2;
      const deltas = starts + segs * 2;
      const ranges = deltas + segs * 2;
      for (let s = 0; s < segs; s++) {
        const end = sub.readUInt16BE(ends + s * 2);
        const start = sub.readUInt16BE(starts + s * 2);
        const delta = sub.readInt16BE(deltas + s * 2);
        const rangeOff = sub.readUInt16BE(ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid: number;
          if (rangeOff === 0) gid = (c + delta) & 0xffff;
          else {
            const at = ranges + s * 2 + rangeOff + (c - start) * 2;
            gid = sub.readUInt16BE(at);
            if (gid) gid = (gid + delta) & 0xffff;
          }
          if (gid !== 0) cps.add(c);
        }
      }
    }
  }
  return cps;
}

describe("seal subset font (Task G2a)", () => {
  const font = readFileSync(path.resolve(__dirname, "../../../public/fonts/seal-glyphs.woff2"));
  const tables = woff2Tables(font);
  const cps = cmapCodepoints(tables.get("cmap")!);

  it("its cmap maps every glyph a seal can draw", () => {
    const needed = [...new Set([...Object.values(SEALS), DEFAULT_SEAL].map((d) => d.glyph))];
    const missing = needed.filter((g) => !cps.has(g.codePointAt(0)!));
    expect(missing, "re-run scripts/subset-seal-font.mjs").toEqual([]);
  });

  it("holds exactly the generated glyph list (the subset wasn't truncated or swapped)", () => {
    for (const g of SEAL_FONT_GLYPHS) expect(cps.has(g.codePointAt(0)!), g).toBe(true);
    const cjk = [...cps].filter((c) => c >= 0x3400);
    expect(cjk.length).toBe([...SEAL_FONT_GLYPHS].length);
  });
});
