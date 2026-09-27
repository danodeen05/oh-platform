/** SHA-256 of the NDA's canonical text (server only). */

import { createHash } from "node:crypto";
import { ndaCanonicalText, type NdaDocument } from "./document";

export function ndaDocumentHash(doc: NdaDocument): string {
  return createHash("sha256").update(ndaCanonicalText(doc), "utf8").digest("hex");
}
