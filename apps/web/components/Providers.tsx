"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { CartProvider } from "@/contexts/cart-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ToastProvider>{children}</ToastProvider>
    </CartProvider>
  );
}
