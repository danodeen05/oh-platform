/**
 * Server-side client for the Fastify /plan/* routes. Adds the shared
 * PLAN_API_KEY header. Never import this from a client component.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface PlanApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

export interface PlanApiOptions {
  /** Salted viewer IP hash; the API rate limits /plan/auth on it. */
  ipHash?: string;
}

export async function planApi<T>(path: string, body: unknown, options: PlanApiOptions = {}): Promise<PlanApiResult<T>> {
  const key = process.env.PLAN_API_KEY;
  if (!key) throw new Error("PLAN_API_KEY is not set");
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-plan-api-key": key };
  if (options.ipHash) headers["x-plan-ip-hash"] = options.ipHash;
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}
