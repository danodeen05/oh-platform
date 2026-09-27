import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const admin = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const web = readFileSync(path.resolve(__dirname, "../../../web/app/globals.css"), "utf8");
const tokens = (css: string) => Object.fromEntries([...css.matchAll(/--color-oh-([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2].toUpperCase()]));

describe("Night tokens", () => {
  test("every web token exists in admin with the same value", () => {
    const a = tokens(admin);
    for (const [name, hex] of Object.entries(tokens(web))) expect(a[name], name).toBe(hex);
  });
  test("admin adds linen", () => expect(tokens(admin).linen).toBe("#EDE6DA"));
});
