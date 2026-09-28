"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useCart } from "@/contexts/cart-context";

export default function CartPage() {
  const t = useTranslations("store");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { items, itemCount, subtotalCents, updateQuantity, removeItem, clearCart } = useCart();

  const shippingCents = subtotalCents >= 7500 ? 0 : 799; // Free shipping over $75
  const taxCents = Math.round(subtotalCents * 0.0825); // 8.25% tax
  const totalCents = subtotalCents + shippingCents + taxCents;

  if (items.length === 0) {
    return (
      <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ background: "#222", padding: "80px 24px 40px" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <Link
              href={`/${locale}/store`}
              style={{
                color: "rgba(255,255,255,0.7)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "24px",
                fontSize: "0.9rem",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Store
            </Link>
            <h1
              style={{
                fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
                fontWeight: "300",
                color: "white",
                letterSpacing: "1px",
              }}
            >
              Your Cart
            </h1>
          </div>
        </div>

        {/* Empty Cart */}
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              background: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "500", color: "#222", marginBottom: "12px" }}>
            Your cart is empty
          </h2>
          <p style={{ color: "#666", marginBottom: "32px" }}>
            Looks like you haven&apos;t added anything to your cart yet.
          </p>
          <Link
            href={`/${locale}/store`}
            style={{
              display: "inline-block",
              padding: "16px 40px",
              background: "#7C7A67",
              color: "white",
              borderRadius: "12px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "1rem",
            }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#faf9f7", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#222", padding: "80px 24px 40px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <Link
            href={`/${locale}/store`}
            style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
              fontSize: "0.9rem",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Store
          </Link>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
              fontWeight: "300",
              color: "white",
              letterSpacing: "1px",
            }}
          >
            Your Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
          {/* Cart Items */}
          <div>
            <div style={{ background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              {items.map((item, index) => (
                <div
                  key={`${item.id}-${item.variant || ""}`}
                  style={{
                    display: "flex",
                    gap: "20px",
                    padding: "24px",
                    borderBottom: index < items.length - 1 ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  {/* Product Image */}
                  <div
                    style={{
                      position: "relative",
                      width: "100px",
                      height: "100px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "#f3f4f6",
                      flexShrink: 0,
                    }}
                  >
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="100px"
                        style={{ objectFit: "cover" }}
                      />
                    )}
                  </div>

                  {/* Product Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222", marginBottom: "4px" }}>
                      {item.name}
                    </h3>
                    {item.variant && (
                      <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "8px" }}>
                        {item.variant}
                      </p>
                    )}
                    <p style={{ fontSize: "1rem", fontWeight: "600", color: "#7C7A67" }}>
                      ${(item.priceCents / 100).toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity & Actions */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                        style={{
                          width: "32px",
                          height: "32px",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          background: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                          color: "#666",
                        }}
                      >
                        -
                      </button>
                      <span style={{ width: "32px", textAlign: "center", fontWeight: "500" }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                        style={{
                          width: "32px",
                          height: "32px",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          background: "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                          color: "#666",
                        }}
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id, item.variant)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc2626",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                    <p style={{ fontWeight: "600", color: "#222", fontSize: "1.1rem" }}>
                      ${((item.priceCents * item.quantity) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={clearCart}
              style={{
                marginTop: "16px",
                background: "none",
                border: "none",
                color: "#666",
                cursor: "pointer",
                fontSize: "0.9rem",
                textDecoration: "underline",
              }}
            >
              Clear Cart
            </button>
          </div>

          {/* Order Summary */}
          <div>
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#222", marginBottom: "20px" }}>
                Order Summary
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Subtotal</span>
                  <span style={{ fontWeight: "500" }}>${(subtotalCents / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Shipping</span>
                  <span style={{ fontWeight: "500", color: shippingCents === 0 ? "#16a34a" : undefined }}>
                    {shippingCents === 0 ? "FREE" : `$${(shippingCents / 100).toFixed(2)}`}
                  </span>
                </div>
                {shippingCents > 0 && (
                  <p style={{ fontSize: "0.8rem", color: "#7C7A67", marginTop: "-4px" }}>
                    Free shipping on orders over $75
                  </p>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Estimated Tax</span>
                  <span style={{ fontWeight: "500" }}>${(taxCents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "16px",
                  borderTop: "2px solid #e5e7eb",
                  marginBottom: "24px",
                }}
              >
                <span style={{ fontSize: "1.1rem", fontWeight: "600", color: "#222" }}>Total</span>
                <span style={{ fontSize: "1.25rem", fontWeight: "700", color: "#7C7A67" }}>
                  ${(totalCents / 100).toFixed(2)}
                </span>
              </div>

              <Link
                href={`/${locale}/store/checkout`}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "18px",
                  background: "#7C7A67",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  textAlign: "center",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(124, 122, 103, 0.3)",
                }}
              >
                Proceed to Checkout
              </Link>

              <Link
                href={`/${locale}/store`}
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: "16px",
                  color: "#7C7A67",
                  textDecoration: "none",
                  fontSize: "0.95rem",
                }}
              >
                Continue Shopping
              </Link>
            </div>

            {/* Trust Badges */}
            <div
              style={{
                marginTop: "24px",
                display: "flex",
                justifyContent: "center",
                gap: "24px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#666", fontSize: "0.85rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Secure Checkout
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#666", fontSize: "0.85rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13" rx="2" />
                  <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-5" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                Free Shipping 75+
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
