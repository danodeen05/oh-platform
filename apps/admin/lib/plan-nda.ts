/** Plan NDA admin types and helpers (API: packages/api/src/plan/nda-admin.js). */
import { API_BASE, api } from "./api";

export interface Countersigner { name: string; title: string; signature: string; adoptedAt?: string }

export interface NdaAddress { line1: string; line2?: string; city: string; region: string; postalCode: string; country?: string }

export interface NdaAdminDetail {
  ndaRequired: boolean;
  current: {
    id: string;
    status: "DRAFT" | "SIGNED" | "VOIDED";
    details: { legalName: string; email: string; phone: string; address: NdaAddress; company: string; title: string } | null;
    audit: {
      version: string | null; startedAt: string; phoneVerifiedAt: string | null; consentAt: string | null; signedAt: string | null;
      ip: string | null; userAgent: string | null; signatureKind: string | null; documentSha256: string | null; pdfSha256: string | null;
      countersignerName: string | null; countersignerTitle: string | null; emailedAt: string | null; textedAt: string | null;
      ownerNotifiedAt: string | null; deliveryError: string | null; otpSendCount: number;
    };
  } | null;
  history: { id: string; status: string; createdAt: string; signedAt: string | null; voidedAt: string | null }[];
}

export async function fetchCountersigner(): Promise<Countersigner | null> {
  return (await api<{ countersigner: Countersigner | null }>("/admin/plan/nda/countersigner")).countersigner;
}

/** Fetch with the admin token (fetch is wrapped by ApiAuthInit) and save the PDF. */
export async function downloadNdaPdf(ndaId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/plan/ndas/${ndaId}/pdf`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || "Oh-Beef-NDA.pdf";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const addressLine = (a: NdaAddress | undefined) =>
  a ? [[a.line1, a.line2].filter(Boolean).join(", "), a.city, `${a.region} ${a.postalCode}`, a.country && a.country !== "United States" ? a.country : ""].filter(Boolean).join(", ") : "";
