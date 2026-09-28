import { describe, expect, it } from "vitest";
import { claimPendingReferral, PENDING_REFERRAL_KEY } from "../referral";

function storage(code: string | null) {
  const m = new Map<string, string>();
  if (code !== null) m.set(PENDING_REFERRAL_KEY, code);
  return { getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k), has: () => m.has(PENDING_REFERRAL_KEY) };
}

function api(status: number, body: unknown, calls: { url: string; body: unknown }[] = []) {
  return async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(body), { status });
  };
}

describe("claimPendingReferral (Task D5 fix round 1)", () => {
  it("sends the saved code once with POST /users, then clears it", async () => {
    const s = storage("MEI123");
    const calls: { url: string; body: unknown }[] = [];
    const result = await claimPendingReferral(api(200, { id: "u1", referralJustApplied: true }, calls), "http://api", { email: "m@x.com", name: "Mei" }, s);
    expect(result).toBe("applied");
    expect(calls).toEqual([{ url: "http://api/users", body: { email: "m@x.com", name: "Mei", referredByCode: "MEI123" } }]);
    expect(s.has()).toBe(false);
    // A second call has nothing to send.
    expect(await claimPendingReferral(api(200, {}, calls), "http://api", { email: "m@x.com" }, s)).toBe("none");
    expect(calls).toHaveLength(1);
  });

  it("clears the code when the API declines it (already referred, own code)", async () => {
    const s = storage("MEI123");
    expect(await claimPendingReferral(api(200, { id: "u1" }), "http://api", { email: "m@x.com" }, s)).toBe("not-applied");
    expect(s.has()).toBe(false);
  });

  it("keeps the code for later when the API can't be reached or is busy", async () => {
    const s = storage("MEI123");
    const down = async () => {
      throw new TypeError("network");
    };
    expect(await claimPendingReferral(down, "http://api", { email: "m@x.com" }, s)).toBe("failed");
    expect(await claimPendingReferral(api(429, {}), "http://api", { email: "m@x.com" }, s)).toBe("failed");
    expect(s.has()).toBe(true);
  });

  it("does nothing without a saved code", async () => {
    const calls: { url: string; body: unknown }[] = [];
    expect(await claimPendingReferral(api(200, {}, calls), "http://api", { email: "m@x.com" }, storage(null))).toBe("none");
    expect(calls).toHaveLength(0);
  });
});
