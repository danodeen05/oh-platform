/**
 * Task G3 cutover: printable QR codes for the new comb pods, emailed to the
 * owner with a "replace the pod stickers" note (fix round 1).
 *
 * Each live pod (`retiredAt` null) at the two comb locations gets one SVG
 * whose QR encodes `<base>/pod?qr=<Seat.qrCode>`: the URL the guest pod page
 * (apps/web .../pod/page.tsx, `?qr=`) reads, which calls
 * `GET /pods/info?qrCode=`. The middleware adds the locale. Old stickers keep
 * working in the sense that matters: a retired pod's code answers "this pod
 * code is out of date" and offers the kiosk or choosing a pod.
 *
 * Output, per location: one SVG per pod plus `index.html` (a print sheet,
 * 4 per row, label under each code) in `--out`, and, with `--email=<to>`, one
 * self-contained print sheet per location (SVGs inline) attached to a mail
 * sent through the API's Microsoft Graph mailer (packages/api/src/email/graph.js).
 * The mailer credentials come ONLY from `--mail-env-file=<path>` (the MS_*
 * keys of that file are read; nothing else in it is used), so the database
 * URL on the command line is never mixed with a local .env.
 *
 * READ ONLY on the database. `--dry-run` prints the counts and writes and
 * sends nothing. Locations resolve by slug (run seed-comb-seats first).
 *
 * Usage (from packages/db):
 *   pnpm exec tsx scripts/export-pod-qr.ts --dry-run
 *   pnpm exec tsx scripts/export-pod-qr.ts --out=/path/to/pod-qr [--base-url=https://www.ohbeef.com]
 *       [--email=dano@ohbeef.com --mail-env-file=/path/to/.env]
 * Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { sendGraphMail } from "../../api/src/email/graph.js";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";
import { LOCATIONS } from "./seed-comb-seats.ts";

export const DEFAULT_BASE_URL = "https://www.ohbeef.com";
const MAIL_KEYS = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_SENDER_EMAIL"] as const;

export function podQrUrl(baseUrl: string, qrCode: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/pod?qr=${encodeURIComponent(qrCode)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const SHEET_STYLE = `body{font-family:system-ui,sans-serif;margin:12mm;color:#000;background:#fff}
h1{font-size:14pt;margin:0 0 6mm}
main{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}
figure{margin:0;text-align:center;break-inside:avoid;border:1px dashed #999;padding:3mm}
img,svg{width:100%;height:auto;display:block}
figcaption{font-size:18pt;font-weight:700;letter-spacing:.05em}`;

function sheet(title: string, cells: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
${SHEET_STYLE}
</style></head>
<body><h1>${escapeHtml(title)}</h1><main>
${cells}
</main></body></html>
`;
}

/** Print sheet that links the SVG files next to it. */
export function printSheetHtml(title: string, pods: { label: string; file: string }[]): string {
  return sheet(title, pods.map((p) => `<figure><img src="${escapeHtml(p.file)}" alt="${escapeHtml(p.label)}"><figcaption>${escapeHtml(p.label)}</figcaption></figure>`).join("\n"));
}

/** Self-contained print sheet (SVGs inline), for the email attachment. */
export function inlineSheetHtml(title: string, pods: { label: string; svg: string }[]): string {
  return sheet(title, pods.map((p) => `<figure>${p.svg}<figcaption>${escapeHtml(p.label)}</figcaption></figure>`).join("\n"));
}

type QrLib = { toString(text: string, opts: Record<string, unknown>): Promise<string> };

export interface ExportCounts {
  [slug: string]: number;
}

export interface PodSheet {
  slug: string;
  name: string;
  count: number;
  html: string;
}

export async function exportPodQr(
  prisma: any,
  qr: QrLib,
  { outDir, baseUrl = DEFAULT_BASE_URL, dryRun }: { outDir: string; baseUrl?: string; dryRun: boolean },
): Promise<{ counts: ExportCounts; sheets: PodSheet[] }> {
  const counts: ExportCounts = {};
  const sheets: PodSheet[] = [];
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
    const linked: { label: string; file: string }[] = [];
    const inline: { label: string; svg: string }[] = [];
    for (const seat of seats) {
      const label = seat.label || seat.number;
      const file = `${label}.svg`;
      // eslint-disable-next-line no-await-in-loop
      const svg = await qr.toString(podQrUrl(baseUrl, seat.qrCode), { type: "svg", errorCorrectionLevel: "M", margin: 2 });
      writeFileSync(join(dir, file), svg);
      linked.push({ label, file });
      inline.push({ label, svg });
    }
    const title = `${location.name} pods (${seats.length})`;
    writeFileSync(join(dir, "index.html"), printSheetHtml(title, linked));
    const html = inlineSheetHtml(title, inline);
    writeFileSync(join(dir, `${entry.slug}-print-sheet.html`), html);
    sheets.push({ slug: entry.slug, name: location.name, count: seats.length, html });
  }
  return { counts, sheets };
}

/** Reads only the MS_* mailer keys from an env file; throws if any is missing or empty. */
export function loadMailEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*(MS_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const missing = MAIL_KEYS.filter((k) => !env[k]);
  if (missing.length) throw new Error(`mail env file lacks ${missing.join(", ")}`);
  return env;
}

export function ownerMail(to: string, sheets: PodSheet[]) {
  const rows = sheets.map((s) => `<li>${escapeHtml(s.name)}: ${s.count} pods (attachment ${escapeHtml(s.slug)}-print-sheet.html)</li>`).join("");
  return {
    to,
    subject: "Replace the pod stickers: new pod QR codes",
    html:
      `<p>The site release moved both stores to the new comb pods. Please replace the pod stickers.</p>` +
      `<ul>${rows}</ul>` +
      `<p>Open each attachment in a browser and print it (4 codes per row, the pod label under each). ` +
      `Put each sticker on the pod with that label, then remove the old numbered stickers.</p>` +
      `<p>Until then the old stickers still work safely: scanning one says the pod code is out of date and sends the guest to the kiosk or to choose a pod.</p>`,
    attachments: sheets.map((s) => ({ name: `${s.slug}-print-sheet.html`, contentType: "text/html", contentBytes: Buffer.from(s.html, "utf8").toString("base64") })),
  };
}

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const outArg = flag("out");
  const baseUrl = flag("base-url") ?? DEFAULT_BASE_URL;
  const email = flag("email");
  const mailEnvFile = flag("mail-env-file");
  if (!dryRun && !outArg) throw new Error("--out=<directory> is required (or pass --dry-run)");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email is not an address");
  if (email && !mailEnvFile) throw new Error("--email needs --mail-env-file=<path> (the MS_* keys)");
  const mailEnv = email && mailEnvFile ? loadMailEnv(mailEnvFile) : null; // fail before any work
  const outDir = resolve(outArg ?? ".");
  const target = requireSafeTarget("export-pod-qr");
  console.log(`${targetBanner("export-pod-qr", target, true).replace(" (dry run, no writes)", " (read only)")}${dryRun ? " [dry run: no files, no mail]" : ` -> ${outDir}`} base ${baseUrl}${email ? ` email ${email}` : ""}`);
  // qrcode is a dependency of @oh/api, not @oh/db; resolve it from there.
  const qr = createRequire(new URL("../../api/package.json", import.meta.url))("qrcode") as QrLib;
  const prisma = new PrismaClient();
  try {
    const { counts, sheets } = await exportPodQr(prisma, qr, { outDir, baseUrl, dryRun });
    console.log(`[export-pod-qr] ${JSON.stringify(counts)}`);
    if (!dryRun && email && mailEnv) {
      const res = await sendGraphMail(ownerMail(email, sheets), { env: mailEnv });
      if (!res.success) throw new Error(`mail not sent: ${res.reason || res.error}`);
      console.log(`[export-pod-qr] mailed ${sheets.length} print sheets to ${email}`);
    }
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
