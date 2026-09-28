import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The mapping, deny list and widths are the single source of truth in the
// generator script. Importing them here (rather than re-declaring them)
// means this test fails loudly if the script's config ever drifts from
// what actually got written to disk.
import { MAPPING, DENY_LIST, WIDTHS, buildSrcSet } from "../../../../../scripts/site-images.mjs";
import { SITE_IMAGES } from "../images";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../../../public/site");

// Parses a `srcset` attribute string ("/site/key-390.avif 390w, ...") into
// {url, width} pairs.
function parseSrcSet(srcSet: string): Array<{ url: string; width: number }> {
  return srcSet.split(",").map((part) => {
    const trimmed = part.trim();
    const [url, widthToken] = trimmed.split(" ");
    return { url, width: Number(widthToken.replace("w", "")) };
  });
}

describe("SITE_IMAGES", () => {
  const keys = Object.keys(SITE_IMAGES);

  it("has exactly one entry per source-to-key mapping", () => {
    expect(keys.sort()).toEqual(Object.keys(MAPPING).sort());
  });

  it.each(keys)("%s has avif and webp files on disk at 390, 780 and 1200 widths", (key) => {
    for (const width of WIDTHS) {
      const avif = path.join(PUBLIC_DIR, `${key}-${width}.avif`);
      const webp = path.join(PUBLIC_DIR, `${key}-${width}.webp`);
      expect(fs.existsSync(avif), `missing ${avif}`).toBe(true);
      expect(fs.existsSync(webp), `missing ${webp}`).toBe(true);
    }
  });

  it("every alt is a siteImages.* message key", () => {
    for (const key of keys) {
      const entry = SITE_IMAGES[key as keyof typeof SITE_IMAGES];
      expect(entry.alt).toMatch(/^siteImages\./);
      expect(entry.src.avif).toMatch(/^\/site\/.+\.avif$/);
      expect(entry.src.webp).toMatch(/^\/site\/.+\.webp$/);
      expect(entry.w).toBeGreaterThan(0);
      expect(entry.h).toBeGreaterThan(0);
    }
  });

  it.each(keys)("%s srcSet matches buildSrcSet(key, format) from the generator script", (key) => {
    const entry = SITE_IMAGES[key as keyof typeof SITE_IMAGES];
    expect(entry.srcSet.avif).toBe(buildSrcSet(key, "avif"));
    expect(entry.srcSet.webp).toBe(buildSrcSet(key, "webp"));
  });

  it.each(keys)("%s srcSet lists all 3 widths and every referenced file exists on disk", (key) => {
    const entry = SITE_IMAGES[key as keyof typeof SITE_IMAGES];
    for (const format of ["avif", "webp"] as const) {
      const parsed = parseSrcSet(entry.srcSet[format]);
      expect(parsed.map((p) => p.width).sort((a, b) => a - b)).toEqual([...WIDTHS].sort((a, b) => a - b));
      for (const { url } of parsed) {
        expect(url).toMatch(new RegExp(`^/site/${key}-\\d+\\.${format}$`));
        const onDisk = path.join(PUBLIC_DIR, path.basename(url));
        expect(fs.existsSync(onDisk), `missing ${onDisk} (from srcSet: ${url})`).toBe(true);
      }
    }
  });
});

describe("deny list", () => {
  it("no mapping value is a denied source file", () => {
    const denied = new Set(DENY_LIST);
    for (const [key, source] of Object.entries(MAPPING)) {
      expect(denied.has(source), `${key} maps to a denied file: ${source}`).toBe(false);
    }
  });

  it("no output file name on disk leaks a denied source's stem", () => {
    const files = fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR) : [];
    expect(files.length).toBeGreaterThan(0);
    const deniedStems = DENY_LIST.map((f) =>
      f
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    );
    for (const file of files) {
      const normalized = file.toLowerCase();
      for (const stem of deniedStems) {
        expect(normalized.includes(stem), `${file} leaks denied stem "${stem}"`).toBe(false);
      }
    }
  });
});
