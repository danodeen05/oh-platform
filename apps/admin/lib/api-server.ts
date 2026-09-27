import "server-only";
import { auth } from "@clerk/nextjs/server";
import { API_BASE, ApiError, withQuery } from "./api";

/** Server component fetch that forwards the signed-in user's Clerk token. */
export async function serverApi<T>(path: string, query?: Parameters<typeof withQuery>[1]): Promise<T> {
  const headers: Record<string, string> = { "x-tenant-slug": "oh" };
  if (process.env.NODE_ENV !== "development") {
    const token = await (await auth()).getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${withQuery(path, query)}`, { cache: "no-store", headers });
  if (!res.ok) throw new ApiError(res.status, `API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}
