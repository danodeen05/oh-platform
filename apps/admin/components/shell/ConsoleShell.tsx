"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { Dock } from "./Dock";
import { Sidebar } from "./Sidebar";
import { MoreSheet } from "./MoreSheet";

/** Night frame around paper work: charcoal top bar, dock (phone) or sidebar (lg). */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  return (
    <div className="oh-console min-h-svh bg-oh-paper lg:pl-[248px]">
      <Sidebar />
      <TopBar />
      <main className="mx-auto w-full min-w-0 max-w-[1200px] overflow-x-clip px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      <Dock onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
