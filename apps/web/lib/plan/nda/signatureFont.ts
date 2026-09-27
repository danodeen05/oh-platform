/** Script face for typed signatures on the NDA page (rendered to a PNG, so the PDF never needs it). */
import { Allura } from "next/font/google";

export const signatureFont = Allura({ weight: "400", subsets: ["latin"], display: "swap" });
