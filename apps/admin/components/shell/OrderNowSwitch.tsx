"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

type State = { status: "loading" | "ready" | "error"; enabled: boolean; saving: boolean };

/**
 * One shared copy of the flag, so the sidebar, the More sheet and Today never
 * disagree after a flip.
 */
let state: State = { status: "loading", enabled: false, saving: false };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const SERVER: State = { status: "loading", enabled: false, saving: false };

function load(force = false) {
  if (inflight || (!force && state.status === "ready")) return inflight;
  set({ status: "loading" });
  inflight = api<{ enabled: boolean }>("/admin/site-config/order-now")
    .then((r) => set({ status: "ready", enabled: Boolean(r?.enabled) }))
    .catch(() => set({ status: "error" }))
    .finally(() => { inflight = null; });
  return inflight;
}

export function OrderNowSwitch({ variant = "row", surface = "light" }: { variant?: "row" | "card"; surface?: "light" | "dark" }) {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  const ask = useConfirm();
  const { show } = useToast();
  useEffect(() => { load(); }, []);

  const flip = useCallback(async (next: boolean) => {
    if (state.saving || state.status !== "ready") return;
    if (!next) {
      const ok = await ask({
        title: "Turn off dine-in ordering?",
        body: "Guests won't be able to place dine-in orders until you turn it back on.",
        confirmLabel: "Turn off",
        tone: "danger",
      });
      if (!ok) return;
    }
    const prev = state.enabled;
    set({ enabled: next, saving: true });
    try {
      const r = await api<{ enabled: boolean }>("/admin/site-config/order-now", { method: "PATCH", body: { enabled: next } });
      const now = typeof r?.enabled === "boolean" ? r.enabled : next;
      set({ enabled: now, saving: false });
      show({ message: now ? "Dine-in ordering is live" : "Dine-in ordering is off", tone: now ? "good" : "info" });
    } catch (err) {
      set({ enabled: prev, saving: false });
      show({ message: `Couldn't change dine-in ordering. ${(err as Error)?.message || "Try again."}`, tone: "alert" });
    }
  }, [ask, show]);

  const dark = surface === "dark";
  const meta = s.status === "loading" ? "Checking" : s.status === "error" ? "Couldn't load" : s.enabled ? "Live" : "Off";
  const sw = (
    <button type="button" role="switch" aria-checked={s.enabled} aria-label="Dine-in ordering"
      disabled={s.status !== "ready" || s.saving} onClick={() => flip(!s.enabled)}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end disabled:cursor-not-allowed disabled:opacity-50">
      <span className={`relative inline-flex h-8 w-[52px] items-center rounded-full transition-colors duration-200 ${s.enabled ? "bg-oh-olive" : dark ? "bg-oh-cream/20" : "bg-oh-stone/30"}`}>
        <span className={`absolute left-1 h-6 w-6 rounded-full bg-oh-paper shadow-[0_1px_3px_rgb(28_27_25/0.3)] transition-transform duration-200 ${s.enabled ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
  const retry = s.status === "error" && (
    <Button size="sm" variant="ghost" onClick={() => load(true)} className={dark ? "text-oh-cream hover:bg-oh-cream/10" : ""}>Retry</Button>
  );
  const dot = (
    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.status === "ready" ? (s.enabled ? "bg-oh-olive-light" : "bg-oh-ash") : "bg-transparent"}`} />
  );

  if (variant === "card") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-oh-charcoal text-oh-gold"><Icon name="bowl" size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-oh-charcoal">Dine-in ordering</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-oh-stone/70">{dot}{meta}</p>
          </div>
          {retry || sw}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-oh-stone/80">
          {s.enabled ? "Guests can order at the table from their phones." : "Guests can't place dine-in orders right now."}
        </p>
      </Card>
    );
  }

  if (dark) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-xl pl-3 pr-1">
        <Icon name="bowl" size={20} className="shrink-0 text-oh-cream/60" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-oh-cream/85">Dine-in ordering</span>
          <span className="flex items-center gap-1.5 text-xs text-oh-cream/50">{dot}{meta}</span>
        </span>
        {retry || sw}
      </div>
    );
  }

  return (
    <div className="flex min-h-14 w-full items-center gap-3 px-4 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-oh-linen text-oh-stone"><Icon name="bowl" size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-oh-charcoal">Dine-in ordering</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-sm text-oh-stone/70">{dot}{meta}</span>
      </span>
      {retry || sw}
    </div>
  );
}
