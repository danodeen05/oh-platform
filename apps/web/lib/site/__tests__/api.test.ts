import { describe, expect, test, vi, afterEach } from "vitest";

import { authedFetch } from "../api";

function captureFetch() {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
    calls.push({ input, init });
    return new Response("{}", { status: 200 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("authedFetch", () => {
  test("attaches the Clerk session token as a Bearer header and keeps other headers", async () => {
    const calls = captureFetch();
    await authedFetch(async () => "tok_123", "http://api/users/u1/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok_123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(calls[0].init.method).toBe("POST");
  });

  test("sends no Authorization when signed out or when getToken throws", async () => {
    const calls = captureFetch();
    await authedFetch(async () => null, "http://api/x");
    await authedFetch(async () => {
      throw new Error("clerk not loaded");
    }, "http://api/x");
    expect(new Headers(calls[0].init.headers).has("Authorization")).toBe(false);
    expect(new Headers(calls[1].init.headers).has("Authorization")).toBe(false);
  });

  test("an explicit Authorization header wins", async () => {
    const calls = captureFetch();
    const getToken = vi.fn(async () => "tok_123");
    await authedFetch(getToken, "http://api/x", { headers: { Authorization: "Bearer g1.guest.mac" } });
    expect(new Headers(calls[0].init.headers).get("Authorization")).toBe("Bearer g1.guest.mac");
    expect(getToken).not.toHaveBeenCalled();
  });
});
