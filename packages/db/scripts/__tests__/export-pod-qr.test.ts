/** Task G3: pod QR export is read only, skips retired pods, and encodes the guest pod URL. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { exportPodQr, loadMailEnv, ownerMail, podQrUrl, printSheetHtml } from "../export-pod-qr.ts";
import { noWrites } from "./helpers/no-writes.ts";

function fakePrisma() {
  const locations = [
    { id: "cc", slug: "city-creek", name: "City Creek", isClosed: false },
    { id: "up", slug: "university-place", name: "University Place", isClosed: false },
  ];
  const seats = [
    { locationId: "cc", number: "A-01", label: "A-01", qrCode: "POD-cc-A-01", retiredAt: null },
    { locationId: "cc", number: "01", label: null, qrCode: "POD-old-01", retiredAt: new Date() },
    { locationId: "up", number: "B-07", label: "B-07", qrCode: "POD-up-B-07", retiredAt: null },
  ];
  return {
    location: { findUnique: async ({ where }: any) => locations.find((l) => l.slug === where.slug) ?? null },
    seat: {
      findMany: async ({ where }: any) => seats.filter((s) => s.locationId === where.locationId && (where.retiredAt !== null || s.retiredAt === null)),
    },
  };
}

const fakeQr = { toString: async (text: string) => `<svg data-url="${text}"></svg>` };

test("podQrUrl is the guest pod page URL", () => {
  assert.equal(podQrUrl("https://www.ohbeef.com/", "POD-xxpmm5hf-B-07"), "https://www.ohbeef.com/pod?qr=POD-xxpmm5hf-B-07");
});

test("dry run counts live pods and writes no file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "podqr-"));
  const { counts, sheets } = await exportPodQr(noWrites(fakePrisma()), fakeQr, { outDir: dir, dryRun: true });
  assert.deepEqual(counts, { "city-creek": 1, "university-place": 1 });
  assert.deepEqual(sheets, []);
  assert.deepEqual(readdirSync(dir), []);
});

test("a real run writes one SVG per live pod plus a print sheet, and re-running gives the same files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "podqr-"));
  const { sheets } = await exportPodQr(noWrites(fakePrisma()), fakeQr, { outDir: dir, dryRun: false });
  assert.deepEqual(readdirSync(join(dir, "city-creek")).sort(), ["A-01.svg", "city-creek-print-sheet.html", "index.html"]);
  assert.equal(sheets.length, 2);
  assert.match(sheets[0].html, /<svg data-url="https:\/\/www\.ohbeef\.com\/pod\?qr=POD-cc-A-01">/, "the mailed sheet carries the SVGs inline");
  assert.match(readFileSync(join(dir, "university-place", "B-07.svg"), "utf8"), /pod\?qr=POD-up-B-07/);
  const first = readFileSync(join(dir, "city-creek", "index.html"), "utf8");
  await exportPodQr(noWrites(fakePrisma()), fakeQr, { outDir: dir, dryRun: false });
  assert.equal(readFileSync(join(dir, "city-creek", "index.html"), "utf8"), first);
});

test("the print sheet escapes labels", () => {
  assert.ok(!printSheetHtml("<x>", [{ label: "<b>", file: "a.svg" }]).includes("<b>"));
});

test("the owner mail says to replace the stickers and attaches one inline sheet per location", () => {
  const mail = ownerMail("dano@ohbeef.com", [{ slug: "city-creek", name: "City Creek", count: 75, html: "<html>cc</html>" }]);
  assert.equal(mail.to, "dano@ohbeef.com");
  assert.match(mail.subject, /Replace the pod stickers/);
  assert.match(mail.html, /replace the pod stickers/);
  assert.ok(!mail.html.includes("\u2014"));
  assert.equal(mail.attachments[0].name, "city-creek-print-sheet.html");
  assert.equal(Buffer.from(mail.attachments[0].contentBytes, "base64").toString("utf8"), "<html>cc</html>");
});

test("loadMailEnv reads only the MS_* keys and refuses a file missing one", () => {
  const dir = mkdtempSync(join(tmpdir(), "podqr-env-"));
  const good = join(dir, "good.env");
  writeFileSync(good, 'DATABASE_URL="postgresql://x@127.0.0.1/y"\nMS_TENANT_ID=t\nMS_CLIENT_ID="c"\nMS_CLIENT_SECRET=s\nMS_SENDER_EMAIL=service@example.com\n');
  assert.deepEqual(loadMailEnv(good), { MS_TENANT_ID: "t", MS_CLIENT_ID: "c", MS_CLIENT_SECRET: "s", MS_SENDER_EMAIL: "service@example.com" });
  const bad = join(dir, "bad.env");
  writeFileSync(bad, "MS_TENANT_ID=t\nMS_CLIENT_ID=\n");
  assert.throws(() => loadMailEnv(bad), /MS_CLIENT_ID/);
});
