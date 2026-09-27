export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown = null) { super(message); }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path;
}

/** Client fetch to the API. ApiAuthInit adds the Clerk Bearer token. */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal; query?: Query } = {}): Promise<T> {
  const headers: Record<string, string> = { "x-tenant-slug": "oh" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${withQuery(path, opts.query)}`, {
      method: opts.method || "GET", headers, signal: opts.signal, cache: "no-store",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
      ? (data as { error: string }).error : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}
