"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { IconButton } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { CalendarSlotInfo, CateringSlot } from "@/lib/catering";

type RawEntry = { date: string; slot: CateringSlot; status: string; event?: { id: string; clientCompany: string } };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(date.toISOString().slice(0, 10));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

const chipBase = "flex min-h-11 w-full items-center justify-center rounded-lg border px-1 text-[11px] font-semibold leading-tight";

function SlotChip({ info, onOpen }: { info: CalendarSlotInfo | undefined; onOpen: () => void }) {
  if (info?.blocked) {
    return <span className={`${chipBase} cursor-not-allowed border-oh-ember/30 bg-oh-ember/10 text-oh-ember-deep`} title="Blocked">Blocked</span>;
  }
  if (info?.booked) {
    const tone = info.slot === "LUNCH" ? "border-oh-olive/40 bg-oh-olive/15 text-oh-olive" : "border-oh-ink/30 bg-oh-ink/10 text-oh-ink";
    return (
      <button type="button" onClick={onOpen} title={info.clientCompany} className={`${chipBase} truncate ${tone} hover:opacity-80`}>
        {info.clientCompany}
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} aria-label={`Book ${info?.slot === "DINNER" ? "dinner" : "lunch"}`}
      className={`${chipBase} border-dashed border-oh-stone/25 text-oh-stone/50 hover:border-oh-stone/45 hover:text-oh-stone`}>
      +
    </button>
  );
}

export function BookingCalendar({ year, month, onMonthChange, onCreateWithPrefill }: {
  year: number; month: number; onMonthChange: (year: number, month: number) => void;
  onCreateWithPrefill: (date: string, slot: CateringSlot) => void;
}) {
  const router = useRouter();
  const key = `catering-calendar:${year}-${month}`;
  const res = useResource(key, async (signal) => {
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const data = await api<RawEntry[]>("/admin/catering/calendar", { signal, query: { from, to } });
    const map: Record<string, CalendarSlotInfo[]> = {};
    for (const entry of Array.isArray(data) ? data : []) {
      const list = map[entry.date] ?? (map[entry.date] = []);
      list.push({
        date: entry.date, slot: entry.slot, booked: entry.status === "BOOKED", blocked: entry.status === "BLOCKED",
        clientCompany: entry.event?.clientCompany, eventId: entry.event?.id,
      });
    }
    return map;
  });

  const days = useMemo(() => daysInMonth(year, month), [year, month]);
  const firstDow = new Date(year, month, 1).getDay();
  const today = new Date().toISOString().slice(0, 10);

  function prevMonth() {
    onMonthChange(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  }
  function nextMonth() {
    onMonthChange(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
  }
  function openSlot(date: string, info: CalendarSlotInfo | undefined, slot: CateringSlot) {
    if (info?.booked && info.eventId) router.push(`/catering/${info.eventId}`);
    else onCreateWithPrefill(date, slot);
  }

  return (
    <Card padded={false}
      title={<span className="tabular-nums">{MONTHS[month]} {year}</span>}
      action={
        <span className="flex gap-1">
          <IconButton icon="chevron-left" label="Previous month" onClick={prevMonth} />
          <IconButton icon="chevron-right" label="Next month" onClick={nextMonth} />
        </span>
      }>
      <div className="p-3">
        {res.error && !res.data ? (
          <ErrorCard message="Couldn't load the calendar." onRetry={res.reload} />
        ) : !res.data ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => <div key={d} className="pb-1 text-center text-xs font-semibold text-oh-stone/60">{d}</div>)}
              {Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)}
              {days.map((date) => {
                const slots = res.data![date] || [];
                const lunch = slots.find((s) => s.slot === "LUNCH");
                const dinner = slots.find((s) => s.slot === "DINNER");
                const dayNum = Number(date.slice(8));
                const isToday = date === today;
                return (
                  <div key={date} className={`min-h-[74px] rounded-lg border p-1 ${isToday ? "border-oh-ember-deep bg-oh-ember/5" : "border-oh-stone/10"}`}>
                    <div className={`mb-1 text-center text-xs tabular-nums ${isToday ? "font-bold text-oh-ember-deep" : "text-oh-stone/70"}`}>{dayNum}</div>
                    <div className="space-y-1">
                      <SlotChip info={lunch} onOpen={() => openSlot(date, lunch, "LUNCH")} />
                      <SlotChip info={dinner} onOpen={() => openSlot(date, dinner, "DINNER")} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-oh-stone/70">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-oh-olive/40 bg-oh-olive/15" />Lunch booked</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-oh-ink/30 bg-oh-ink/10" />Dinner booked</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-oh-ember/30 bg-oh-ember/10" />Blocked</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-oh-stone/25" />Available, tap to create</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
