"use client";
import type { ReactNode } from "react";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { HAS_SUPPORT } from "@/lib/nav";

type Tab = "dine-in" | "shop" | "support";

const TABS: SegmentOption<Tab>[] = [
  { value: "dine-in", label: "Dine-in", href: "/orders" },
  { value: "shop", label: "Shop", href: "/shop-orders" },
  ...(HAS_SUPPORT ? [{ value: "support" as const, label: "Support", href: "/support" }] : []),
];

/** Dine-in, Shop and (once it exists) Support share one Orders home. `children` (a search) sticks with the tabs. */
export function OrdersTabs({ current, children }: { current: Tab; children?: ReactNode }) {
  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 bg-oh-paper/95 px-4 py-2 backdrop-blur-sm lg:-mx-8 lg:px-8">
      <SegmentedControl label="Order type" options={TABS} value={current} className="lg:max-w-sm" />
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
