/**
 * Chappy guest identity (Task E1). A signed-out visitor chats with a SIGNED
 * guest token from POST /chappy/guest-token, sent as the `x-chappy-guest`
 * header; the API never accepts a raw guest or session id. The token lives
 * in localStorage under `oh-chappy-guest` so a guest's conversation survives
 * a reload, and in memory when storage is unavailable (private mode).
 */

export const GUEST_TOKEN_KEY = "oh-chappy-guest";
/** The retired widget's key. Cleared on first use so a stale token never lingers. */
const LEGACY_GUEST_TOKEN_KEY = "oh-chappy-guest-token";

let memoryToken: string | null = null;
let inflight: Promise<string | null> | null = null;

export function readGuestToken(): string | null {
  try {
    localStorage.removeItem(LEGACY_GUEST_TOKEN_KEY);
    return localStorage.getItem(GUEST_TOKEN_KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

function storeGuestToken(token: string) {
  memoryToken = token;
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  } catch {
    /* storage unavailable: memory only */
  }
}

export function clearGuestToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The stored guest token, or a fresh one from the API. Concurrent callers
 * share one request. `fresh` discards the stored token first (the API
 * refused it: expired, or the secret rotated). Resolves null when the API
 * can't issue one (offline, rate limited, guest chat disabled).
 */
export function ensureGuestToken(apiBase: string, { fresh = false }: { fresh?: boolean } = {}): Promise<string | null> {
  if (fresh) clearGuestToken();
  const stored = readGuestToken();
  if (stored) return Promise.resolve(stored);
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch(`${apiBase}/chappy/guest-token`, { method: "POST" });
        const token = res.ok ? (await res.json())?.token : null;
        if (typeof token === "string" && token) {
          storeGuestToken(token);
          return token;
        }
        return null;
      } catch {
        return null;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}
