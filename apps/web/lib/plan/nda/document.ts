/**
 * Builds the NDA as shown to one signer (Key Terms filled in) and its
 * canonical text. The same builder feeds the online page, the PDF and the
 * SHA-256 recorded at signing, so all three always describe one document.
 * Pure: safe for server and client.
 */

import { CLAUSES, COMPANY, CONSENT_ELECTRONIC, CONSENT_TERMS, NDA_TITLE, NDA_VERSION, PREAMBLE, type NdaClause } from "./content";

export interface NdaAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country?: string;
}

export interface NdaRecipient {
  legalName: string;
  email: string;
  phone: string;
  address: NdaAddress;
  company?: string;
  title?: string;
}

export interface NdaKeyTerm {
  label: string;
  value: string;
}

export interface NdaDocument {
  version: string;
  title: string;
  preamble: string;
  effectiveDate: string; // "September 27, 2026" (America/Denver)
  recipient: NdaRecipient | null;
  keyTerms: NdaKeyTerm[];
  clauses: readonly NdaClause[];
  consents: { electronic: string; terms: string };
}

export function formatAddress(a: NdaAddress | undefined): string {
  if (!a) return "";
  const street = [a.line1, a.line2].filter(Boolean).join(", ");
  const country = a.country && a.country !== "United States" ? `, ${a.country}` : "";
  return `${street}, ${a.city}, ${a.region} ${a.postalCode}${country}`;
}

export function formatNdaDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", dateStyle: "long" }).format(d);
}

export function recipientLine(r: NdaRecipient | null): string {
  if (!r) return "The person signing below";
  const who = r.company ? `${r.legalName}, individually and on behalf of ${r.company}` : r.legalName;
  return `${who}, ${formatAddress(r.address)} ("you")`;
}

export function buildNdaDocument({ recipient, effectiveDate }: { recipient: NdaRecipient | null; effectiveDate: Date }): NdaDocument {
  const keyTerms: NdaKeyTerm[] = [
    { label: "Company", value: `${COMPANY.legalName}, ${COMPANY.entity} (Utah entity no. ${COMPANY.entityNumber}), ${COMPANY.address} ("Oh!")` },
    { label: "Recipient", value: recipientLine(recipient) },
    { label: "Effective Date", value: `${formatNdaDate(effectiveDate)}, the date you sign` },
    { label: "Purpose", value: "Evaluating a possible investment, partnership, lease, supply, franchise, lending or advisory relationship with Oh!" },
    { label: "Type", value: "One-way. Oh! discloses; you keep it confidential." },
    { label: "Confidentiality", value: "Three years after the later of the Effective Date and your last access. Trade secrets stay protected for as long as they remain trade secrets." },
    { label: "Non-solicitation", value: "Twelve months, for Oh! team members you meet or learn about" },
    { label: "Non-circumvention", value: "Eighteen months, for landlords, sites, suppliers and co-investors identified to you" },
    { label: "Law and courts", value: "Utah law. State courts in Utah County or the U.S. District Court for the District of Utah." },
  ];
  return {
    version: NDA_VERSION,
    title: NDA_TITLE,
    preamble: PREAMBLE,
    effectiveDate: formatNdaDate(effectiveDate),
    recipient,
    keyTerms,
    clauses: CLAUSES,
    consents: { electronic: CONSENT_ELECTRONIC, terms: CONSENT_TERMS },
  };
}

/** The exact words of the agreement, one line per paragraph. Hashed at signing. */
export function ndaCanonicalText(doc: NdaDocument): string {
  const lines: string[] = [`${doc.title} (version ${doc.version})`, doc.preamble, "Key Terms"];
  for (const t of doc.keyTerms) lines.push(`${t.label}: ${t.value}`);
  for (const c of doc.clauses) {
    lines.push(`${c.n}. ${c.title}`);
    for (const b of c.blocks) {
      if (typeof b === "string") lines.push(b);
      else b.list.forEach((item, i) => lines.push(`(${String.fromCharCode(97 + i)}) ${item}`));
    }
  }
  if (doc.recipient) lines.push(`Recipient email: ${doc.recipient.email}`, `Recipient mobile: ${doc.recipient.phone}`);
  lines.push(`Consent: ${doc.consents.electronic}`, `Consent: ${doc.consents.terms}`);
  return lines.join("\n");
}
