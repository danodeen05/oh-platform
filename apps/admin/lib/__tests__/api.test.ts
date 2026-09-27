import { afterEach, expect, test, vi } from "vitest";
import { api, ApiError } from "../api";

afterEach(() => vi.unstubAllGlobals());

test("sends tenant header, JSON body and query; returns parsed JSON", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  const out = await api<{ ok: number }>("/menu/1", { method: "PATCH", body: { isAvailable: false }, query: { a: "x", b: undefined } });
  expect(out).toEqual({ ok: 1 });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url.endsWith("/menu/1?a=x")).toBe(true);
  expect((init.headers as Record<string, string>)["x-tenant-slug"]).toBe("oh");
  expect(init.body).toBe(JSON.stringify({ isAvailable: false }));
});

test("throws ApiError with the server's error message", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Nope" }), { status: 403 })));
  await expect(api("/x")).rejects.toMatchObject({ status: 403, message: "Nope" });
  await expect(api("/x")).rejects.toBeInstanceOf(ApiError);
});

test("network failure becomes a friendly ApiError", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
  await expect(api("/x")).rejects.toMatchObject({ status: 0, message: "Can't reach the server. Check your connection." });
});
