import type { BadgeTone } from "../components/ui/Badge";
import { webUrl } from "./urls";

export type KioskDevice = {
  id: string;
  deviceId: string;
  name: string;
  location: { id: string; name: string };
  isActive: boolean;
  lastHeartbeat: string | null;
  appVersion: string | null;
  createdAt: string;
};

const ONLINE_MS = 2 * 60 * 1000;
const STALE_MS = 10 * 60 * 1000;

export type DeviceStatus = { label: "Disabled" | "Never connected" | "Online" | "Stale" | "Offline"; tone: BadgeTone };

/** Status badge for a kiosk row, from isActive and the last heartbeat. */
export function deviceStatus(d: Pick<KioskDevice, "isActive" | "lastHeartbeat">, now = new Date()): DeviceStatus {
  if (!d.isActive) return { label: "Disabled", tone: "neutral" };
  if (!d.lastHeartbeat) return { label: "Never connected", tone: "neutral" };
  const diff = now.getTime() - new Date(d.lastHeartbeat).getTime();
  if (diff < ONLINE_MS) return { label: "Online", tone: "good" };
  if (diff < STALE_MS) return { label: "Stale", tone: "pending" };
  return { label: "Offline", tone: "alert" };
}

/** The kiosk setup link for a freshly issued (or rotated) API key. */
export const kioskSetupUrl = (apiKey: string) => `${webUrl()}/en/kiosk/setup?key=${apiKey}`;
