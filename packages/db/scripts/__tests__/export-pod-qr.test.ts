/** Task G3: pod QR export is read only, skips retired pods, and encodes the guest pod URL. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportPodQr, podQrUrl, printSheetHtml } from "../export-pod-qr.ts";
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
  const counts = await exportPodQr(noWrites(fakePrisma()), fakeQr, { outDir: dir, dryRun: true });
  assert.deepEqual(counts, { "city-creek": 1, "university-place": 1 });
  assert.deepEqual(readdirSync(dir), []);
});

test("a real run writes one SVG per live pod plus a print sheet, and re-running gives the same files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "podqr-"));
  await exportPodQr(noWrites(fakePrisma()), fakeQr, { outDir: dir, dryRun: false });
  assert.deepEqual(readdirSync(join(dir, "city-creek")).sort(), ["A-01.svg", "index.html"]);
  assert.match(readFileSync(join(dir, "university-place", "B-07.svg"), "utf8"), /pod\?qr=POD-up-B-07/);
  const first = readFileSync(join(dir, "city-creek", "index.html"), "utf8");
  await exportPodQr(noWrites(fakePrisma()), fakeQr, { outDir: dir, dryRun: false });
  assert.equal(readFileSync(join(dir, "city-creek", "index.html"), "utf8"), first);
});

test("the print sheet escapes labels", () => {
  assert.ok(!printSheetHtml("<x>", [{ label: "<b>", file: "a.svg" }]).includes("<b>"));
});
