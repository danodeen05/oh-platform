"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { describeBlackout, WEEKDAYS, type Blackout, type CateringSlot } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export function BlackoutManager() {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource("catering-blackouts", (signal) => api<Blackout[]>("/admin/catering/blackouts", { signal }));
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"date" | "weekday">("date");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [weekday, setWeekday] = useState("0");
  const [slot, setSlot] = useState<"" | CateringSlot>("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const rows = res.data ?? [];
  const sundaysBlocked = rows.some((b) => b.weekday === 0 && b.slot === null);

  async function create(body: Record<string, unknown>) {
    setSaving(true);
    setFormError(null);
    try {
      await api("/admin/catering/blackouts", { method: "POST", body });
      res.reload();
      return true;
    } catch (e) {
      setFormError(errorText(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const slotVal = slot || undefined;
    const reasonVal = reason.trim() || undefined;
    let ok: boolean;
    if (mode === "weekday") {
      ok = await create({ weekday: Number(weekday), slot: slotVal, reason: reasonVal });
    } else {
      if (!startDate) { setFormError("Pick a start date."); return; }
      ok = await create({ startDate, endDate: endDate || undefined, slot: slotVal, reason: reasonVal });
      if (ok) { setStartDate(""); setEndDate(""); }
    }
    if (ok) setReason("");
  }

  async function remove(b: Blackout) {
    const ok = await ask({ title: `Unblock ${describeBlackout(b)}?`, confirmLabel: "Unblock", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/admin/catering/blackouts/${b.id}`, { method: "DELETE" });
      res.reload();
      show({ message: "Unblocked.", tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Blocked dates and slots">
        <p className="mb-4 text-sm text-oh-stone/70">Dates and slots blocked here are removed from the public booking calendar and rejected at checkout.</p>
        <Button variant={sundaysBlocked ? "secondary" : "primary"} disabled={saving || sundaysBlocked}
          onClick={() => create({ weekday: 0, reason: "Closed Sundays" })}>
          {sundaysBlocked ? "Sundays blocked" : "Block all Sundays"}
        </Button>

        <div className="mt-5 space-y-4 rounded-xl border border-oh-stone/15 bg-oh-linen/50 p-4">
          <Field label="Type">
            <Select value={mode} onChange={(e) => setMode(e.target.value as "date" | "weekday")}>
              <option value="date">Specific date or range</option>
              <option value="weekday">Recurring weekday</option>
            </Select>
          </Field>
          {mode === "date" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="block min-h-11 w-full rounded-xl border border-oh-stone/25 bg-oh-paper px-3 text-[16px] text-oh-charcoal focus:border-oh-gold focus:outline-none focus:ring-3 focus:ring-oh-gold/30" />
              </Field>
              <Field label="To" hint="Optional">
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="block min-h-11 w-full rounded-xl border border-oh-stone/25 bg-oh-paper px-3 text-[16px] text-oh-charcoal focus:border-oh-gold focus:outline-none focus:ring-3 focus:ring-oh-gold/30" />
              </Field>
            </div>
          ) : (
            <Field label="Weekday">
              <Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Slot">
            <Select value={slot} onChange={(e) => setSlot(e.target.value as "" | CateringSlot)}>
              <option value="">Whole day</option>
              <option value="LUNCH">Lunch only</option>
              <option value="DINNER">Dinner only</option>
            </Select>
          </Field>
          <Field label="Reason" hint="Optional" error={formError ?? undefined}>
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Holiday, private event" />
          </Field>
          <Button variant="primary" onClick={handleAdd} loading={saving}>Block</Button>
        </div>
      </Card>

      <Card title="Blocked" padded={false}>
        {res.error && !res.data ? (
          <div className="p-4"><ErrorCard message="Couldn't load blocked dates." onRetry={res.reload} /></div>
        ) : !res.data ? (
          <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-oh-stone/70">Nothing blocked yet.</p>
        ) : (
          rows.map((b) => (
            <div key={b.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-oh-charcoal">{describeBlackout(b)}</span>
                {b.reason && <span className="block text-sm text-oh-stone/70">{b.reason}</span>}
              </span>
              <Button size="sm" variant="danger" onClick={() => remove(b)}>Unblock</Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
