import { describe, expect, test } from "vitest";
import { CLAUSES, NDA_VERSION } from "../content";
import { buildNdaDocument, formatAddress, ndaCanonicalText, recipientLine } from "../document";
import { ndaDocumentHash } from "../hash";

const RECIPIENT = {
  legalName: "James Robertson",
  email: "jim@firm.com",
  phone: "+18015551234",
  address: { line1: "1 Main St", line2: "Suite 4", city: "Lehi", region: "UT", postalCode: "84043", country: "United States" },
  company: "America First CU",
  title: "VP",
};
const AT = new Date("2026-09-28T03:30:00Z"); // Sep 27 in Denver

describe("NDA document", () => {
  test("clauses are numbered 1..n in order and Section 3 is Confidential Information", () => {
    CLAUSES.forEach((c, i) => expect(c.n).toBe(i + 1));
    expect(CLAUSES[2].title).toBe("Confidential Information");
  });

  test("no em dashes anywhere in the text", () => {
    const text = ndaCanonicalText(buildNdaDocument({ recipient: RECIPIENT, effectiveDate: AT }));
    expect(text).not.toMatch(/—/);
  });

  test("key terms fill in the recipient and a Denver effective date", () => {
    const doc = buildNdaDocument({ recipient: RECIPIENT, effectiveDate: AT });
    expect(doc.effectiveDate).toBe("September 27, 2026");
    expect(doc.version).toBe(NDA_VERSION);
    const recipient = doc.keyTerms.find((t) => t.label === "Recipient")!.value;
    expect(recipient).toBe('James Robertson, individually and on behalf of America First CU, 1 Main St, Suite 4, Lehi, UT 84043 ("you")');
  });

  test("an individual without a company, and foreign addresses", () => {
    expect(recipientLine({ ...RECIPIENT, company: "" })).toMatch(/^James Robertson, 1 Main St/);
    expect(formatAddress({ line1: "10 Downing St", city: "London", region: "England", postalCode: "SW1A 2AA", country: "United Kingdom" })).toBe("10 Downing St, London, England SW1A 2AA, United Kingdom");
    expect(recipientLine(null)).toBe("The person signing below");
  });

  test("hash is stable and changes with any detail", () => {
    const a = ndaDocumentHash(buildNdaDocument({ recipient: RECIPIENT, effectiveDate: AT }));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(ndaDocumentHash(buildNdaDocument({ recipient: RECIPIENT, effectiveDate: AT }))).toBe(a);
    expect(ndaDocumentHash(buildNdaDocument({ recipient: { ...RECIPIENT, email: "x@y.com" }, effectiveDate: AT }))).not.toBe(a);
    expect(ndaDocumentHash(buildNdaDocument({ recipient: RECIPIENT, effectiveDate: new Date("2026-09-29T18:00:00Z") }))).not.toBe(a);
  });
});
