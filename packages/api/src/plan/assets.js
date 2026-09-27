/** Email image assets bundled with the API (packages/api/src/plan/assets), base64 and cached. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const cache = new Map();

/** Base64 of an asset file, or "" when it is missing (the email then renders without it). */
export function assetBase64(name) {
  if (!cache.has(name)) {
    try {
      cache.set(name, readFileSync(path.join(here, "assets", name)).toString("base64"));
    } catch {
      cache.set(name, "");
    }
  }
  return cache.get(name);
}
