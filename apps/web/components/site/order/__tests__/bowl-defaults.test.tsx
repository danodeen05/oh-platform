// Task 12: each slider's default segment is outlined (subtle) so the guest can still see
// what the default was after changing it; one quiet legend sits under the Customize title.
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import en from "../../../../messages/en.json";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string) => {
    const node = (ns ?? "").split(".").reduce<any>((o, p) => (p ? o?.[p] : o), en);
    return node?.[k] ?? k;
  },
  useLocale: () => "en",
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/site/icons/Icon", () => ({ Icon: () => null }));
vi.mock("@/components/site/picture/SitePicture", () => ({ SitePicture: () => null }));

import { BowlBuilder } from "../BowlBuilder";
import { emptyDraft } from "@/lib/site/order-draft";

const steps = [
  { id: "bowl", title: "Bowl", sections: [] },
  {
    id: "customize",
    title: "Customize",
    sections: [
      { id: "nt", name: "Noodle Texture", selectionMode: "SLIDER", item: { id: "nt", name: "Noodle Texture", basePriceCents: 0 }, sliderConfig: { labels: ["Firm", "Medium", "Soft"], default: 1 } },
    ],
  },
] as any;

function render(sliders: Record<string, number>) {
  const draft = { ...emptyDraft(), sliders };
  return renderToStaticMarkup(createElement(BowlBuilder, { steps, draft, update: () => {} }));
}

describe("slider defaults", () => {
  it("marks the default segment and shows the legend once", () => {
    const html = render({ nt: 2 });
    expect(html.match(/data-default="true"/g)?.length).toBe(1);
    expect(html.match(/Outlined is our usual/g)?.length).toBe(1);
    expect(html).toContain("Our usual");
    expect(html).toMatch(/data-default="true"[^>]*ring-oh-cream\/25/);
  });
  it("does not outline the default when it is the current choice", () => {
    const html = render({ nt: 1 });
    expect(html).toMatch(/data-default="true"[^>]*data-selected="true"/);
    expect(html).not.toMatch(/data-default="true"[^>]*ring-oh-cream\/25/);
  });
  it("shows no legend when no slider has a default", () => {
    const s2 = JSON.parse(JSON.stringify(steps));
    delete s2[1].sections[0].sliderConfig.default;
    const html = renderToStaticMarkup(createElement(BowlBuilder, { steps: s2, draft: emptyDraft(), update: () => {} }));
    expect(html).not.toContain("Outlined is our usual");
  });
});
