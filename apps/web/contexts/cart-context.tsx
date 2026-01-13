"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
  variant?: string; // For size variations, etc.
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string, variant?: string) => void;
  updateQuantity: (id: string, quantity: number, variant?: string) => void;
  getItemQuantity: (id: string, variant?: string) => number;
  clearCart: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "oh-shop-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (err) {
      console.error("Error loading cart from localStorage:", err);
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (err) {
        console.error("Error saving cart to localStorage:", err);
      }
    }
  }, [items, isLoaded]);

  // Calculate totals
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  // Get unique key for item (combining id and variant)
  const getItemKey = (id: string, variant?: string) => variant ? `${id}-${variant}` : id;

  const addItem = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((current) => {
      const existingIndex = current.findIndex(
        (i) => i.id === item.id && i.variant === item.variant
      );

      if (existingIndex >= 0) {
        // Update existing item quantity
        const updated = [...current];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      // Add new item
      return [...current, { ...item, quantity }];
    });

    // Open cart drawer when adding
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string, variant?: string) => {
    setItems((current) =>
      current.filter((item) => !(item.id === id && item.variant === variant))
    );
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number, variant?: string) => {
    if (quantity <= 0) {
      removeItem(id, variant);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id && item.variant === variant
          ? { ...item, quantity }
          : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getItemQuantity = useCallback((id: string, variant?: string) => {
    const item = items.find((i) => i.id === id && i.variant === variant);
    return item?.quantity || 0;
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotalCents,
        addItem,
        removeItem,
        updateQuantity,
        getItemQuantity,
        clearCart,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
