"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

export type ConfirmOptions = { title: string; body?: ReactNode; confirmLabel: string; tone?: "danger" | "primary" };
const Ctx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** `const ask = useConfirm(); if (await ask({ title, confirmLabel })) ...` */
export const useConfirm = () => useContext(Ctx);

/** Replaces the browser's blocking dialog for destructive and money actions. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current(false); // a newer question cancels an unanswered one
    resolver.current = resolve;
    setOpts(o);
  }), []);
  const done = useCallback((v: boolean) => { resolver.current(v); resolver.current = () => {}; setOpts(null); }, []);
  const cancel = useCallback(() => done(false), [done]);

  return (
    <Ctx.Provider value={ask}>
      {children}
      <Sheet open={opts !== null} onClose={cancel} title={opts?.title ?? ""} size="auto"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={cancel}>Cancel</Button>
            <Button className="flex-1" variant={opts?.tone === "danger" ? "danger" : "primary"} onClick={() => done(true)}>{opts?.confirmLabel}</Button>
          </div>
        }>
        {opts?.body && <div className="text-[15px] leading-relaxed text-oh-stone">{opts.body}</div>}
      </Sheet>
    </Ctx.Provider>
  );
}
