"use client";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PERIOD_OPTIONS, type Period } from "@/lib/analytics";

export function PeriodSelector({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  return <SegmentedControl scroll label="Period" options={PERIOD_OPTIONS} value={value} onChange={onChange} />;
}
