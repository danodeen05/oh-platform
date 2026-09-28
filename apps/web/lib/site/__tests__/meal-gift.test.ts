import { describe, expect, it } from "vitest";
import { fetchNextMealGift } from "../meal-gift";

function api(status: number, body: unknown, calls: { url: string; init?: RequestInit }[] = []) {
  return async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
}

describe("fetchNextMealGift (Task D5 fix round 3 follow-up)", () => {
  it("calls the authenticated api fetch (not a bare fetch), so a signed-in caller's token reaches the server", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const gift = { id: "mg1", amountCents: 1800, giver: { name: "Lin C." } };
    const result = await fetchNextMealGift(api(200, gift, calls), "http://api", "L1");
    expect(result).toEqual(gift);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://api/meal-gifts/next/L1");
    // The headers passed through are the caller-supplied ones (x-tenant-slug);
    // it's `api` itself (the authenticated fetch) that attaches Authorization
    // when there is a signed-in caller, never a bare `fetch` that never could.
    expect((calls[0].init?.headers as Record<string, string>)["x-tenant-slug"]).toBe("oh");
  });

  it("a 404 (e.g. the caller's own gift was excluded and there's no other) resolves to null, never falling back to showing it anyway", async () => {
    const result = await fetchNextMealGift(api(404, { error: "No meal gifts available" }), "http://api", "L1");
    expect(result).toBeNull();
  });

  it("a malformed body (missing id/amountCents) resolves to null", async () => {
    const result = await fetchNextMealGift(api(200, { ok: true }), "http://api", "L1");
    expect(result).toBeNull();
  });

  it("a network failure resolves to null rather than throwing", async () => {
    const down = async () => {
      throw new TypeError("network");
    };
    const result = await fetchNextMealGift(down, "http://api", "L1");
    expect(result).toBeNull();
  });
});
