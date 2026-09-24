/**
 * Plan session: JWT sign/verify for the `oh_plan` cookie.
 *
 * Server-only. `verifyPlanToken` is also imported by middleware.ts, so this
 * file must stay edge-safe: jose only, no Node built-ins, no Prisma.
 *
 * Claims are deliberately short (the cookie travels on every request):
 *   sid  PlanViewSession.id
 *   acid PlanAccessCode.id
 *   aud  PlanAudience
 *   scn  PlanScenario (the code's default scenario)
 *   sec  allowed section keys; [] means every section
 *   lbl  code label (shown in the shell and the print footer)
 */

import { SignJWT, jwtVerify } from "jose";
import type { SectionKey } from "./sections";

export const PLAN_COOKIE = "oh_plan";
export const PLAN_SESSION_DAYS = 14;

export type PlanAudience = "INVESTOR" | "LENDER" | "LANDLORD" | "PARTNER" | "ADVISOR" | "INTERNAL";
export type PlanScenario = "CONSERVATIVE" | "BASE" | "AGGRESSIVE";

export interface PlanClaims {
  sid: string;
  acid: string;
  aud: PlanAudience;
  scn: PlanScenario;
  sec: string[];
  lbl: string;
}

const AUDIENCES: readonly PlanAudience[] = ["INVESTOR", "LENDER", "LANDLORD", "PARTNER", "ADVISOR", "INTERNAL"];
const SCENARIOS: readonly PlanScenario[] = ["CONSERVATIVE", "BASE", "AGGRESSIVE"];

function secretKey(): Uint8Array {
  const secret = process.env.PLAN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PLAN_JWT_SECRET is missing or shorter than 32 characters");
  }
  return new TextEncoder().encode(secret);
}

function isClaims(value: unknown): value is PlanClaims {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sid === "string" &&
    typeof v.acid === "string" &&
    typeof v.aud === "string" && (AUDIENCES as readonly string[]).includes(v.aud) &&
    typeof v.scn === "string" && (SCENARIOS as readonly string[]).includes(v.scn) &&
    Array.isArray(v.sec) && v.sec.every((s) => typeof s === "string") &&
    typeof v.lbl === "string"
  );
}

export async function signPlanToken(claims: PlanClaims, now: Date = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + PLAN_SESSION_DAYS * 24 * 60 * 60)
    .setIssuer("oh-plan")
    .sign(secretKey());
}

/** Returns the claims, or null for a missing, malformed, expired, or tampered token. */
export async function verifyPlanToken(token: string | undefined | null): Promise<PlanClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], issuer: "oh-plan" });
    const { sid, acid, aud, scn, sec, lbl } = payload as Record<string, unknown>;
    const candidate = { sid, acid, aud, scn, sec, lbl };
    return isClaims(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** Section allowlist: an empty list means the code may see every section. */
export function canViewSection(claims: Pick<PlanClaims, "sec">, key: SectionKey | string): boolean {
  return claims.sec.length === 0 || claims.sec.includes(key);
}
