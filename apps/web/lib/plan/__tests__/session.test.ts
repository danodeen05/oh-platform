import { beforeAll, describe, expect, it } from "vitest";

process.env.PLAN_JWT_SECRET = "test-secret-that-is-definitely-longer-than-32-chars";
process.env.PLAN_IP_HASH_SALT = "salt";

const claims = {
  sid: "sess_1",
  acid: "code_1",
  aud: "LENDER" as const,
  scn: "CONSERVATIVE" as const,
  sec: ["model", "funding"],
  lbl: "Jim R. - AFCU",
};

describe("plan session tokens", () => {
  let session: typeof import("../session");
  beforeAll(async () => {
    session = await import("../session");
  });

  it("round-trips claims", async () => {
    const token = await session.signPlanToken(claims);
    expect(await session.verifyPlanToken(token)).toEqual(claims);
  });

  it("rejects missing, malformed, tampered, and foreign-issuer tokens", async () => {
    expect(await session.verifyPlanToken(undefined)).toBeNull();
    expect(await session.verifyPlanToken("")).toBeNull();
    expect(await session.verifyPlanToken("not.a.jwt")).toBeNull();
    const token = await session.signPlanToken(claims);
    const [h, p, s] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ ...claims, sec: [] })).toString("base64url");
    expect(await session.verifyPlanToken(`${h}.${tamperedPayload}.${s}`)).toBeNull();
    expect(await session.verifyPlanToken(`${h}.${p}.${s}x`)).toBeNull();
  });

  it("expires after 14 days", async () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 3600 * 1000);
    const token = await session.signPlanToken(claims, fifteenDaysAgo);
    expect(await session.verifyPlanToken(token)).toBeNull();
    const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 3600 * 1000);
    expect(await session.verifyPlanToken(await session.signPlanToken(claims, thirteenDaysAgo))).not.toBeNull();
  });

  it("rejects tokens whose claims fail validation", async () => {
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.PLAN_JWT_SECRET);
    const bad = await new SignJWT({ sid: "x", acid: "y", aud: "KING", scn: "BASE", sec: [], lbl: "" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("oh-plan")
      .setExpirationTime("1h")
      .sign(key);
    expect(await session.verifyPlanToken(bad)).toBeNull();
  });

  it("enforces the section allowlist; empty list means everything", () => {
    expect(session.canViewSection(claims, "model")).toBe(true);
    expect(session.canViewSection(claims, "team")).toBe(false);
    expect(session.canViewSection({ sec: [] }, "team")).toBe(true);
  });
});

describe("ip hashing", () => {
  it("hashes deterministically with the salt and never returns the raw ip", async () => {
    const { hashIp, clientIp } = await import("../ip");
    const h = hashIp("203.0.113.9");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).toBe(hashIp("203.0.113.9"));
    expect(h).not.toContain("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
