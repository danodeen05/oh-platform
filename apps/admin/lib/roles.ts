import { parseRole, type AdminRole } from "./access";

export const ROLE_HEADER = "x-admin-role";
export const DEFAULT_OWNER_EMAILS = ["danodeen@me.com", "danodeen@gmail.com"];

export function ownerEmails(env: string | undefined = process.env.OWNER_EMAILS): string[] {
  const list = (env || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_OWNER_EMAILS;
}

/** Same rule as the API's roleFor: allowlisted email is owner, else Clerk publicMetadata.adminRole. */
export function resolveRole(email: string | null | undefined, metadata: Record<string, unknown> | null | undefined, owners = ownerEmails()): AdminRole | null {
  if (email && owners.includes(email.toLowerCase())) return "owner";
  return parseRole(metadata?.adminRole);
}

/** Local dev skips Clerk; ADMIN_DEV_ROLE lets you preview the console as manager or station. */
export function devRole(env: string | undefined = process.env.ADMIN_DEV_ROLE): AdminRole {
  return parseRole(env) ?? "owner";
}

export function requestHeadersWithRole(incoming: Headers, role: AdminRole | null): Headers {
  const headers = new Headers(incoming);
  headers.delete(ROLE_HEADER);
  if (role) headers.set(ROLE_HEADER, role);
  return headers;
}
