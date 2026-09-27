import { describe, expect, test } from "vitest";
import { devRole, ownerEmails, requestHeadersWithRole, resolveRole, ROLE_HEADER } from "../roles";

describe("resolveRole", () => {
  const owners = ["owner@x.com"];
  test("owner allowlist wins, case-insensitive", () => expect(resolveRole("OWNER@x.com", { adminRole: "station" }, owners)).toBe("owner"));
  test("metadata role otherwise", () => expect(resolveRole("m@x.com", { adminRole: "manager" }, owners)).toBe("manager"));
  test("nothing valid is null", () => {
    expect(resolveRole("m@x.com", { adminRole: "boss" }, owners)).toBeNull();
    expect(resolveRole(undefined, undefined, owners)).toBeNull();
  });
});

test("ownerEmails parses env and falls back to the defaults", () => {
  expect(ownerEmails(" A@x.com, b@x.com ")).toEqual(["a@x.com", "b@x.com"]);
  expect(ownerEmails("")).toEqual(["danodeen@me.com", "danodeen@gmail.com"]);
});

test("devRole", () => { expect(devRole("manager")).toBe("manager"); expect(devRole("x")).toBe("owner"); expect(devRole(undefined)).toBe("owner"); });

test("requestHeadersWithRole overwrites a spoofed header", () => {
  const h = requestHeadersWithRole(new Headers({ [ROLE_HEADER]: "owner", cookie: "c" }), "manager");
  expect(h.get(ROLE_HEADER)).toBe("manager");
  expect(h.get("cookie")).toBe("c");
  expect(requestHeadersWithRole(new Headers({ [ROLE_HEADER]: "owner" }), null).get(ROLE_HEADER)).toBeNull();
});
