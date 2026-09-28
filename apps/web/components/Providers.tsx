"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { CartProvider } from "@/contexts/cart-context";

// Chappy is no longer mounted here (Task C4): the (legacy) chrome mounts the
// old floating widget (components/legacy/LegacyChrome.tsx) and the site
// shell opens it from the dock (components/site/chappy/ChappyLauncher.tsx).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ToastProvider>{children}</ToastProvider>
    </CartProvider>
  );
}
