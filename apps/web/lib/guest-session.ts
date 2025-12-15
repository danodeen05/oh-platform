/**
 * Guest Session Management
 *
 * Handles guest checkout sessions using cookies.
 * Sessions last 24 hours and allow guests to order without creating an account.
 */

const GUEST_SESSION_COOKIE = "oh_guest_session";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface Guest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  sessionToken: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get the guest session token from cookies (client-side)
 */
export function getGuestSessionToken(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === GUEST_SESSION_COOKIE) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Set the guest session token in cookies (client-side)
 */
export function setGuestSessionToken(token: string): void {
  if (typeof document === "undefined") return;

  // Set cookie to expire in 24 hours
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${GUEST_SESSION_COOKIE}=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Clear the guest session token (client-side)
 */
export function clearGuestSession(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GUEST_SESSION_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

/**
 * Create a new guest session
 */
export async function createGuestSession(data?: { name?: string; phone?: string; email?: string }): Promise<Guest> {
  const response = await fetch(`${API_URL}/guests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-slug": "oh",
    },
    body: JSON.stringify(data || {}),
  });

  if (!response.ok) {
    throw new Error("Failed to create guest session");
  }

  const guest: Guest = await response.json();
  setGuestSessionToken(guest.sessionToken);
  return guest;
}

/**
 * Get the current guest from session token
 */
export async function getGuestFromSession(): Promise<Guest | null> {
  const token = getGuestSessionToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/guests/session/${encodeURIComponent(token)}`, {
      headers: {
        "x-tenant-slug": "oh",
      },
    });

    if (!response.ok) {
      // Session expired or invalid
      if (response.status === 401 || response.status === 404) {
        clearGuestSession();
      }
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Update guest details (name, phone, email)
 */
export async function updateGuestDetails(
  guestId: string,
  data: { name?: string; phone?: string; email?: string }
): Promise<Guest> {
  const response = await fetch(`${API_URL}/guests/${guestId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-slug": "oh",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update guest details");
  }

  return await response.json();
}

/**
 * Refresh an existing guest session (extend by 24 hours)
 */
export async function refreshGuestSession(): Promise<Guest | null> {
  const token = getGuestSessionToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/guests/session/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": "oh",
      },
      body: JSON.stringify({ sessionToken: token }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Check if there's an active guest session
 */
export function hasGuestSession(): boolean {
  return getGuestSessionToken() !== null;
}
