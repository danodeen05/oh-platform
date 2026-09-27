import { describe, expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { buildNdaDocument } from "../document";
import { ndaDocumentHash } from "../hash";
import { renderNdaPdf } from "../pdf";

const DOT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("renderNdaPdf", () => {
  test("renders a multi-page executed PDF", async () => {
    const doc = buildNdaDocument({
      recipient: { legalName: "James Robertson", email: "jim@firm.com", phone: "+18015551234", address: { line1: "1 Main St", city: "Lehi", region: "UT", postalCode: "84043", country: "United States" }, company: "America First CU", title: "VP" },
      effectiveDate: new Date("2026-09-27T18:00:00Z"),
    });
    const pdf = await renderNdaPdf({
      doc,
      ndaId: "cmtestnda0001",
      signedAt: new Date("2026-09-27T18:00:00Z"),
      recipientSignature: DOT,
      signatureKind: "drawn",
      countersigner: { name: "Test Signer", title: "Founder", signature: DOT },
      audit: { openedAt: "2026-09-27T17:50:00Z", detailsAt: "2026-09-27T17:52:00Z", phoneVerifiedAt: "2026-09-27T17:55:00Z", ip: "203.0.113.9", userAgent: "vitest", documentSha256: ndaDocumentHash(doc) },
    });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBeGreaterThanOrEqual(5);
    expect(pdf.length).toBeLessThan(2_500_000);
    if (process.env.NDA_PDF_OUT) writeFileSync(process.env.NDA_PDF_OUT, pdf);
  }, 30_000);
});
