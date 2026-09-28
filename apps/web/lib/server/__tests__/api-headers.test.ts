/**
 * Task G3b: the server-to-server key header is added only on the server,
 * only when ADMIN_API_KEY is set, and no "use client" file imports it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SERVER_KEY_HEADER, serverApiHeaders } from "../api-headers";

const WEB_ROOT = join(__dirname, "..", "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("serverApiHeaders", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("adds x-oh-server-key with ADMIN_API_KEY and keeps the other headers", () => {
    vi.stubEnv("ADMIN_API_KEY", "k".repeat(64));
    expect(SERVER_KEY_HEADER).toBe("x-oh-server-key");
    expect(serverApiHeaders({ "x-tenant-slug": "oh" })).toEqual({ "x-tenant-slug": "oh", "x-oh-server-key": "k".repeat(64) });
  });

  it("adds nothing when the key is unset or empty", () => {
    vi.stubEnv("ADMIN_API_KEY", "");
    expect(serverApiHeaders({ a: "1" })).toEqual({ a: "1" });
  });

  it("adds nothing in a browser", () => {
    vi.stubEnv("ADMIN_API_KEY", "k".repeat(64));
    vi.stubGlobal("window", {});
    try {
      expect(serverApiHeaders()).toEqual({});
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("is never imported by a \"use client\" file", () => {
    const offenders = [...walk(join(WEB_ROOT, "app")), ...walk(join(WEB_ROOT, "components")), ...walk(join(WEB_ROOT, "lib"))]
      .filter((f) => /server\/api-headers/.test(readFileSync(f, "utf8")))
      .filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8").slice(0, 400)))
      .map((f) => relative(WEB_ROOT, f));
    expect(offenders).toEqual([]);
  });
});
