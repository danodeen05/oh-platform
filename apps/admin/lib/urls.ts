/** Customer web origin for links and QR codes (was duplicated in kiosks and catering). */
export function webUrl(): string {
  if (process.env.NEXT_PUBLIC_WEB_URL) return process.env.NEXT_PUBLIC_WEB_URL;
  if (typeof window === "undefined") return "https://www.ohbeef.com";
  const host = window.location.hostname;
  if (host.includes("devadmin") || host.includes("localhost")) return host.includes("localhost") ? "http://localhost:3000" : "https://devwebapp.ohbeef.com";
  return "https://www.ohbeef.com";
}
export const planInviteUrl = (code: string) => `${webUrl()}/plan?c=${encodeURIComponent(code)}`;
