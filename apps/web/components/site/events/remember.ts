/**
 * Private events: what this browser remembers about its guest for one event
 * (name, phone, birthday, invite token, the reserved order), so a return visit skips
 * the form and shows the reservation. localStorage key `oh-event:{slug}`.
 * Storage can be missing or throw (private mode, blocked site data), so
 * every access is wrapped and a failure reads as "nothing remembered".
 */
export interface RememberedGuest {
  name: string;
  phone: string;
  token?: string;
  orderQrCode?: string;
  /** MM/DD/YYYY from the guest form, sent with the order for the guest's zodiac. */
  dob?: string;
}

const key = (slug: string) => `oh-event:${slug}`;

export function readRemembered(slug: string): RememberedGuest | null {
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RememberedGuest> | null;
    if (!v || typeof v.name !== "string" || typeof v.phone !== "string") return null;
    return {
      name: v.name,
      phone: v.phone,
      ...(typeof v.token === "string" && v.token ? { token: v.token } : {}),
      ...(typeof v.orderQrCode === "string" && v.orderQrCode ? { orderQrCode: v.orderQrCode } : {}),
      ...(typeof v.dob === "string" && v.dob ? { dob: v.dob } : {}),
    };
  } catch {
    return null;
  }
}

export function writeRemembered(slug: string, data: RememberedGuest): void {
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(data));
  } catch {
    // Storage unavailable: the guest just fills the form again next time.
  }
}

export function clearRemembered(slug: string): void {
  try {
    window.localStorage.removeItem(key(slug));
  } catch {
    // Nothing to clear.
  }
}
