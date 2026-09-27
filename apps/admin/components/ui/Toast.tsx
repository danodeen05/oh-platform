"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastInput = { message: string; tone?: "good" | "alert" | "info"; action?: { label: string; onClick: () => void }; durationMs?: number };
export type ToastItem = ToastInput & { id: number };

const MAX = 3;

/** Pure queue helpers, kept separate so they can be unit tested. */
export const toastQueue = {
  push: (q: ToastItem[], t: ToastItem) => [...q, t].slice(-MAX),
  expire: (q: ToastItem[], id: number) => q.filter((t) => t.id !== id),
};

const Ctx = createContext<{ show: (t: ToastInput) => void }>({ show: () => {} });
export const useToast = () => useContext(Ctx);

const DOT = { good: "bg-oh-olive-light", alert: "bg-oh-ember-light", info: "bg-oh-gold" } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((q) => toastQueue.expire(q, id));
  }, []);

  const show = useCallback((t: ToastInput) => {
    const id = next.current++;
    setItems((q) => toastQueue.push(q, { ...t, id }));
    timers.current.set(id, setTimeout(() => dismiss(id), t.durationMs ?? (t.action ? 5000 : 3000)));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="oh-console pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 bg-transparent px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {items.map((t) => (
          <div key={t.id} role={t.tone === "alert" ? "alert" : "status"}
            className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-xl bg-oh-charcoal py-1.5 pl-4 pr-1.5 text-[15px] text-oh-cream shadow-[0_8px_30px_rgb(28_27_25/0.3)] motion-safe:animate-[oh-toast-in_180ms_ease-out]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[t.tone ?? "info"]}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 py-1.5 leading-snug">{t.message}</span>
            {t.action && (
              <button type="button" className="min-h-11 shrink-0 rounded-lg px-3 font-semibold text-oh-gold hover:bg-oh-cream/10"
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
