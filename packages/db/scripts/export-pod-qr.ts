/**
 * Task G3 cutover: printable QR codes for the new comb pods.
 *
 * Each live pod (`retiredAt` null) at the two comb locations gets one SVG
 * whose QR encodes `<base>/pod?qr=<Seat.qrCode>`: the URL the guest pod page
 * (apps/web .../pod/page.tsx, `?qr=`) reads, which calls
 * `GET /pods/info?qrCode=`. The middleware adds the locale.
 * It also writes one `index.html` per location: a print sheet (label under
 * each code, 4 per row) to print on the store printer.
 *
 * READ ONLY on the database. `--dry-run` prints the counts and writes no
 * files. Locations resolve by slug (run seed-comb-seats first).
 *
 * Usage (from packages/db):
 *   pnpm exec tsx scripts/export-pod-qr.ts --dry-run
 *   pnpm exec tsx scripts/export-pod-qr.ts --out=/path/to/pod-qr [--base-url=https://www.ohbeef.com]
 * Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";
import { LOCATIONS } from "./seed-comb-seats.ts";

export const DEFAULT_BASE_URL = "https://www.ohbeef.com";

export function podQrUrl(baseUrl: string, qrCode: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/pod?qr=${encodeURIComponent(qrCode)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function printSheetHtml(title: string, pods: { label: string; file: string }[]): string {
  const cells = pods
    .map((p) => `<figure><img src="${escapeHtml(p.file)}" alt="${escapeHtml(p.label)}"><figcaption>${escapeHtml(p.label)}</figcaption></figure>`)
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:12mm;color:#000;background:#fff}
h1{font-size:14pt;margin:0 0 6mm}
main{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}
figure{margin:0;text-align:center;break-inside:avoid;border:1px dashed #999;padding:3mm}
img{width:100%;height:auto}
figcaption{font-size:18pt;font-weight:700;letter-spacing:.05em}
</style></head>
<body><h1>${escapeHtml(title)}</h1><main>
${cells}
</main></body></html>
`;
}

type QrLib = { toString(text: string, opts: Record<string, unknown>): Promise<string> };

export interface ExportCounts {
  [slug: string]: number;
}

export async function exportPodQr(
  prisma: any,
  qr: QrLib,
  { outDir, baseUrl = DEFAULT_BASE_URL, dryRun }: { outDir: string; baseUrl?: string; dryRun: boolean },
): Promise<ExportCounts> {
  const counts: ExportCounts = {};
  for (const entry of LOCATIONS) {
    // eslint-disable-next-line no-await-in-loop
    const location = await prisma.location.findUnique({ where: { slug: entry.slug } });
    if (!location) throw new Error(`${entry.slug}: no location has this slug. Run seed-comb-seats first.`);
    if (location.isClosed) throw new Error(`${entry.slug}: the row holding this slug is closed.`);
    // eslint-disable-next-line no-await-in-loop
    const seats = await prisma.seat.findMany({ where: { locationId: location.id, retiredAt: null }, orderBy: { number: "asc" } });
    counts[entry.slug] = seats.length;
    if (dryRun) continue;
    const dir = join(outDir, entry.slug);
    mkdirSync(dir, { recursive: true });
    const sheet: { label: string; file: string }[] = [];
    for (const seat of seats) {
      const label = seat.label || seat.number;
      const file = `${label}.svg`;
      // eslint-disable-next-line no-await-in-loop
      const svg = await qr.toString(podQrUrl(baseUrl, seat.qrCode), { type: "svg", errorCorrectionLevel: "M", margin: 2 });
      writeFileSync(join(dir, file), svg);
      sheet.push({ label, file });
    }
    writeFileSync(join(dir, "index.html"), printSheetHtml(`${location.name} pods (${seats.length})`, sheet));
  }
  return counts;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const baseArg = process.argv.find((a) => a.startsWith("--base-url="));
  if (!dryRun && !outArg) throw new Error("--out=<directory> is required (or pass --dry-run)");
  const outDir = resolve(outArg ? outArg.slice("--out=".length) : ".");
  const baseUrl = baseArg ? baseArg.slice("--base-url=".length) : DEFAULT_BASE_URL;
  const target = requireSafeTarget("export-pod-qr");
  console.log(`${targetBanner("export-pod-qr", target, true).replace(" (dry run, no writes)", " (read only)")}${dryRun ? " [dry run: no files]" : ` -> ${outDir}`} base ${baseUrl}`);
  // qrcode is a dependency of @oh/api, not @oh/db; resolve it from there.
  const qr = createRequire(new URL("../../api/package.json", import.meta.url))("qrcode") as QrLib;
  const prisma = new PrismaClient();
  try {
    const counts = await exportPodQr(prisma, qr, { outDir, baseUrl, dryRun });
    console.log(`[export-pod-qr] ${JSON.stringify(counts)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error(`[export-pod-qr] failed: ${err?.message ?? err}`);
    process.exit(1);
  });
}
