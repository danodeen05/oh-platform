/**
 * Manual per-company brand overrides for catering co-branding.
 *
 * When the AI website scrape gets a client's logo/colors wrong, we store the
 * corrected values here (keyed by a normalized company name). At booking
 * creation, if the client company matches an override, we apply the stored
 * logo + brand colors instead of (or on top of) the AI result.
 *
 * Data lives in brand-overrides.json (so a large logo data-URL doesn't clutter
 * source). Add entries by exporting the corrected logoUrl + brandColors from an
 * event you've fixed in the admin tool.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OVERRIDES_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "brand-overrides.json"
);

let _cache = null;
function loadOverrides() {
  if (_cache) return _cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
    _cache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Return the brand override for a company name, or null.
 * Matches an exact normalized key, or a company that starts with a key
 * (e.g. "Leland Submarine LLC" still matches the "leland" override).
 */
export function getBrandOverride(company) {
  const key = normalize(company);
  if (!key) return null;
  const overrides = loadOverrides();
  if (overrides[key]) return overrides[key];
  for (const k of Object.keys(overrides)) {
    const nk = normalize(k);
    if (nk && key.startsWith(nk)) return overrides[k];
  }
  return null;
}
