import { describe, expect, it } from "vitest";
import { defaultEventDraft } from "../event-draft";
const steps = [
  { id: "bowl", title: "", sections: [
    { id: "soup", name: "", selectionMode: "SINGLE", required: true, items: [{ id: "s1", name: "Classic", basePriceCents: 0 }] },
    { id: "noodles", name: "", selectionMode: "SINGLE", required: true, items: [{ id: "n1", name: "Wide", basePriceCents: 0 }, { id: "n2", name: "Thin", basePriceCents: 0 }] } ] },
  { id: "customize", title: "", sections: [{ id: "sp", name: "", selectionMode: "SLIDER", item: { id: "sp", name: "Spice", basePriceCents: 0 }, sliderConfig: { labels: ["None", "Mild", "Medium"], default: 1 } }] },
] as any;
describe("defaultEventDraft", () => {
  it("picks the first soup and noodles and each slider default", () => {
    const d = defaultEventDraft(steps);
    expect(d.singles).toEqual({ soup: "s1", noodles: "n1" });
    expect(d.sliders).toEqual({ sp: 1 });
    expect(d.locationId).toBeNull();
  });
});

describe("event draft storage", () => {
  it("round-trips per slug in sessionStorage and clears", async () => {
    const { readEventDraft, writeEventDraft, clearEventDraft, EVENT_DRAFT_PREFIX } = await import("../event-draft");
    const store = new Map<string, string>();
    (globalThis as any).window = {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    };
    try {
      expect(readEventDraft("a")).toBeNull();
      const d = defaultEventDraft(steps);
      writeEventDraft("a", d);
      expect([...store.keys()]).toEqual([`${EVENT_DRAFT_PREFIX}a`]);
      expect(readEventDraft("a")?.singles).toEqual({ soup: "s1", noodles: "n1" });
      expect(readEventDraft("b")).toBeNull();
      clearEventDraft("a");
      expect(readEventDraft("a")).toBeNull();
    } finally {
      delete (globalThis as any).window;
    }
  });

  it("reads nothing when storage is unavailable", async () => {
    const { readEventDraft, writeEventDraft } = await import("../event-draft");
    expect(readEventDraft("a")).toBeNull();
    expect(() => writeEventDraft("a", defaultEventDraft(steps))).not.toThrow();
  });
});
