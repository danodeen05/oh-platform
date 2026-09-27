/**
 * Seat labels: "B-07" (finger letter, then the 2-digit position from the
 * kitchen). A finger has two rows (west and east) that share one letter, so
 * the number is shifted past the west row's capacity on the east row -
 * `podLabel`/`parsePodLabel` agree on that shift, and `Pod.position` (which
 * keyboard navigation and the legacy plan code rely on as row-relative)
 * never changes.
 */
import { ROW_CAPACITY, type FingerIndex, type Pod } from "./layout";

const FINGER_LETTERS: Record<FingerIndex, string> = { 1: "A", 2: "B", 3: "C" };
const LETTER_FINGERS: Record<string, FingerIndex> = { A: 1, B: 2, C: 3 };

export function podLabel(pod: Pick<Pod, "finger" | "side" | "position">): string {
  const n = pod.side === "west" ? pod.position : pod.position + ROW_CAPACITY;
  return `${FINGER_LETTERS[pod.finger]}-${String(n).padStart(2, "0")}`;
}

export function parsePodLabel(label: string): { finger: FingerIndex; position: number } | null {
  const m = /^([A-Z])-(\d{2})$/.exec(label);
  if (!m) return null;
  const finger = LETTER_FINGERS[m[1] as string];
  if (!finger) return null;
  const n = Number(m[2]);
  const position = n > ROW_CAPACITY ? n - ROW_CAPACITY : n;
  return { finger, position };
}
