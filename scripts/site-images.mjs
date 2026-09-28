#!/usr/bin/env node
// scripts/site-images.mjs
//
// Generates the customer-site image set for Task C6 (image pipeline).
//
// For each entry in MAPPING, resizes the source photo (read from
// fromDano/plan/, which is untracked and outside the repo) into AVIF and
// WebP at 390/780/1200px widths, strips EXIF (the default sharp behavior:
// metadata is dropped unless .withMetadata() is called), and writes the
// results to apps/web/public/site/. It then (re)generates
// apps/web/lib/site/images.ts from the same data so the two never drift.
//
// Usage: node scripts/site-images.mjs
//        PORTRAIT_ONLY=1 node scripts/site-images.mjs   (only the portrait crops,
//        reading the landscape dimensions from the files already on disk)
//
// Task G2a fix round 1: PORTRAIT adds art-directed portrait crops for phones
// (a full-height slice of the landscape photo), served by SitePicture under
// "(max-width: 767px) and (orientation: portrait)" with sizes="100vw", so a
// phone downloads only pixels it shows instead of a landscape frame it crops
// to a third of its width.
//
// This module's config (MAPPING, DENY_LIST, WIDTHS, ALT_KEYS) is also
// imported directly by apps/web/lib/site/__tests__/images.test.ts, so the
// side-effecting `main()` below only runs when this file is executed
// directly, not when it's imported.

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

export const SOURCE_DIR = "/home/claude-user/projects/oh-platform/fromDano/plan";
export const OUTPUT_DIR = path.join(REPO_ROOT, "apps/web/public/site");
export const IMAGES_TS_PATH = path.join(REPO_ROOT, "apps/web/lib/site/images.ts");

export const WIDTHS = [390, 780, 1200];
export const AVIF_QUALITY = 50;
export const WEBP_QUALITY = 72;

// Exact source-to-key mapping, verbatim from the C6 brief.
export const MAPPING = {
  "storefront-dusk": "Image 4.jpeg",
  "storefront-queue": "Image 3.jpeg",
  "hall-rows": "Image 1.jpeg",
  "hall-rows-alt": "Image.jpeg",
  "pod-hatch-a": "MaleClosedPod.jpg",
  "pod-hatch-b": "Image 5.jpeg",
  "pod-hatch-c": "Image 2.jpeg",
  "pod-hatch-open": "OpenPod.jpg",
  "bowl-slices-top": "Image 9.jpeg",
  "bowl-slices-side": "Image 8.jpeg",
  "beef-macro": "Image 12.jpeg",
  "bowl-chunks-top": "Image 11.jpeg",
  "bowl-chunks-side": "Image 10.jpeg",
  "store-interior": "Image 7.jpeg",
  "bowl-empty": "Image 3 (1).jpeg",
  "bowl-flatlay": "Image 7 (1).jpeg",
  chopsticks: "Image 6 (1).jpeg",
  "sign-pool": "1.jpeg",
};

// Portrait crops: `aspect` is width / height of the crop (full source
// height), `focusX` where it sits across the frame (0 left, 1 right; match the
// landscape art's object-position on phones), `widths` the files generated.
export const PORTRAIT = {
  "storefront-dusk": { aspect: 0.5, focusX: 0.46, widths: [780, 1170] },
};

export function buildPortraitSrcSet(key, ext) {
  return PORTRAIT[key].widths.map((width) => `/site/${key}-portrait-${width}.${ext} ${width}w`).join(", ");
}

// Hard deny list. The script refuses to run (exit 1) if any MAPPING value
// is one of these. IMG_5749.jpeg is a vendor proof with contact details;
// Dano_Signature.heic and Dano.JPG are personal; KitchenScreen.png and
// BlueprintSample.jpg (and its duplicate Image 9.jpg) are internal/kitchen
// assets. None of these may ever end up in apps/web/public.
export const DENY_LIST = [
  "IMG_5749.jpeg",
  "Dano_Signature.heic",
  "KitchenScreen.png",
  "BlueprintSample.jpg",
  "Image 9.jpg",
  "Dano.JPG",
];

// Dotted next-intl message keys under the `siteImages` namespace
// (apps/web/messages/*.json). Every locale carries the same key set.
export const ALT_KEYS = {
  "storefront-dusk": "siteImages.storefrontDusk",
  "storefront-queue": "siteImages.storefrontQueue",
  "hall-rows": "siteImages.hallRows",
  "hall-rows-alt": "siteImages.hallRowsAlt",
  "pod-hatch-a": "siteImages.podHatchA",
  "pod-hatch-b": "siteImages.podHatchB",
  "pod-hatch-c": "siteImages.podHatchC",
  "pod-hatch-open": "siteImages.podHatchOpen",
  "bowl-slices-top": "siteImages.bowlSlicesTop",
  "bowl-slices-side": "siteImages.bowlSlicesSide",
  "beef-macro": "siteImages.beefMacro",
  "bowl-chunks-top": "siteImages.bowlChunksTop",
  "bowl-chunks-side": "siteImages.bowlChunksSide",
  "store-interior": "siteImages.storeInterior",
  "bowl-empty": "siteImages.bowlEmpty",
  "bowl-flatlay": "siteImages.bowlFlatlay",
  chopsticks: "siteImages.chopsticks",
  "sign-pool": "siteImages.signPool",
};

function assertNoDeniedMapping() {
  const denied = new Set(DENY_LIST);
  const offenders = Object.entries(MAPPING).filter(([, source]) => denied.has(source));
  if (offenders.length > 0) {
    console.error("[site-images] Denied source file(s) are mapped:");
    for (const [key, source] of offenders) console.error(`  ${key} -> ${source}`);
    process.exit(1);
  }
}

async function processOne(key, sourceFile) {
  const sourcePath = path.join(SOURCE_DIR, sourceFile);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[site-images] Source file not found for "${key}": ${sourcePath}`);
  }

  const dims = {};
  for (const width of WIDTHS) {
    const avifPath = path.join(OUTPUT_DIR, `${key}-${width}.avif`);
    const webpPath = path.join(OUTPUT_DIR, `${key}-${width}.webp`);

    // .rotate() with no args auto-orients using the EXIF orientation tag
    // before it's stripped. Not calling .withMetadata() is what strips
    // EXIF/ICC/XMP from the output (sharp's default).
    const avifInfo = await sharp(sourcePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: AVIF_QUALITY })
      .toFile(avifPath);

    await sharp(sourcePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpPath);

    dims[width] = { w: avifInfo.width, h: avifInfo.height };
  }
  return dims;
}

async function processPortrait(key, sourceFile) {
  const { aspect, focusX, widths } = PORTRAIT[key];
  const sourcePath = path.join(SOURCE_DIR, sourceFile);
  const meta = await sharp(sourcePath).rotate().metadata();
  const cropW = Math.round(meta.height * aspect);
  const left = Math.round((meta.width - cropW) * focusX);
  const dims = {};
  for (const width of widths) {
    // The crop is narrower than the widest file (the source is 1448x1086, so
    // a full-height 1:2 slice is 543 px wide): enlarging here is deliberate,
    // so 3x phones get a file matched to their pixels (lanczos) rather than
    // the browser's cheaper upscale of a smaller one.
    const base = () =>
      sharp(sourcePath).rotate().extract({ left, top: 0, width: cropW, height: meta.height }).resize({ width });
    const info = await base().avif({ quality: AVIF_QUALITY }).toFile(path.join(OUTPUT_DIR, `${key}-portrait-${width}.avif`));
    await base().webp({ quality: WEBP_QUALITY }).toFile(path.join(OUTPUT_DIR, `${key}-portrait-${width}.webp`));
    dims[width] = { w: info.width, h: info.height };
  }
  const widest = widths[widths.length - 1];
  return dims[widest];
}

// Builds a standard `srcset` attribute string ("/site/key-390.avif 390w, ...")
// from WIDTHS, the single source of truth for which widths were generated.
export function buildSrcSet(key, ext) {
  return WIDTHS.map((width) => `/site/${key}-${width}.${ext} ${width}w`).join(", ");
}

function generateImagesTs(dimsByKey, portraitDims) {
  const keys = Object.keys(MAPPING);
  const typeUnion = keys.map((k) => `  | "${k}"`).join("\n");
  const entries = keys
    .map((k) => {
      const { w, h } = dimsByKey[k][1200];
      return `  "${k}": {
    src: { avif: "/site/${k}-1200.avif", webp: "/site/${k}-1200.webp" },
    srcSet: { avif: "${buildSrcSet(k, "avif")}", webp: "${buildSrcSet(k, "webp")}" },
    w: ${w},
    h: ${h},
    alt: "${ALT_KEYS[k]}",${
      PORTRAIT[k]
        ? `
    portrait: {
      srcSet: { avif: "${buildPortraitSrcSet(k, "avif")}", webp: "${buildPortraitSrcSet(k, "webp")}" },
      w: ${portraitDims[k].w},
      h: ${portraitDims[k].h},
    },`
        : ""
    }
  },`;
    })
    .join("\n");

  return `// GENERATED by scripts/site-images.mjs. Do not edit by hand.
// Re-run \`node scripts/site-images.mjs\` after changing the mapping in that
// file (it also regenerates apps/web/public/site/*.{avif,webp}).

export type ImageKey =
${typeUnion};

// Dotted next-intl message key, e.g. "siteImages.storefrontDusk".
export type MessageKey = \`siteImages.\${string}\`;

export interface SiteImage {
  // The largest (1200w) file in each format. Used as the <img> fallback's
  // base and as a plain single-image src for callers that don't need a
  // <picture>.
  src: { avif: string; webp: string };
  // A full \`srcset\` attribute string ("/site/key-390.avif 390w, ...") built
  // from every generated width (390/780/1200), for responsive <source> tags.
  srcSet: { avif: string; webp: string };
  w: number;
  h: number;
  alt: MessageKey;
  // Art-directed crop for phones held upright (scripts/site-images.mjs
  // PORTRAIT); SitePicture serves it with sizes="100vw". w/h: the widest file.
  portrait?: { srcSet: { avif: string; webp: string }; w: number; h: number };
}

export const SITE_IMAGES: Record<ImageKey, SiteImage> = {
${entries}
};
`;
}

async function main() {
  assertNoDeniedMapping();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const dimsByKey = {};
  for (const [key, sourceFile] of Object.entries(MAPPING)) {
    if (process.env.PORTRAIT_ONLY === "1") {
      const m = await sharp(path.join(OUTPUT_DIR, `${key}-1200.avif`)).metadata();
      dimsByKey[key] = { 1200: { w: m.width, h: m.height } };
      continue;
    }
    process.stdout.write(`[site-images] ${key} <- ${sourceFile}\n`);
    dimsByKey[key] = await processOne(key, sourceFile);
  }
  const portraitDims = {};
  for (const key of Object.keys(PORTRAIT)) {
    process.stdout.write(`[site-images] ${key} portrait crop\n`);
    portraitDims[key] = await processPortrait(key, MAPPING[key]);
  }

  fs.writeFileSync(IMAGES_TS_PATH, generateImagesTs(dimsByKey, portraitDims), "utf8");
  process.stdout.write(`[site-images] wrote ${IMAGES_TS_PATH}\n`);
  process.stdout.write(`[site-images] done: ${Object.keys(MAPPING).length} images x ${WIDTHS.length} widths x 2 formats\n`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
