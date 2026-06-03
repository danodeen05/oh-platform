"use client";

import { useState, useEffect, useRef, Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ThemedBackground from "@/components/catering/ThemedBackground";
import CoBrandHeader from "@/components/catering/CoBrandHeader";
import Countdown from "@/components/catering/Countdown";
import LockedPreviewCard from "@/components/catering/LockedPreviewCard";
import { fetchCateringEvent, type CateringEvent } from "@/lib/catering/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface OrderData {
  id: string;
  orderNumber: string;
  kitchenOrderNumber: number;
  orderQrCode: string;
  status: string;
  guestName: string | null;
  items: Array<{ id: string; name: string; quantity: number; selectedValue?: string | null }>;
}

interface Fortune {
  fortune: string;
  luckyNumbers: number[];
  learnChinese: { traditional: string; pinyin: string; english: string } | null;
}

interface OrderCommentary {
  commentary: string | null;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; description: string; progress: number }> = {
  QUEUED: { label: "In Queue", description: "Your order is waiting to be prepared", progress: 25 },
  PREPPING: { label: "Preparing", description: "Our chefs are making your bowl fresh!", progress: 50 },
  READY: { label: "Ready!", description: "Your bowl is ready!", progress: 75 },
  SERVING: { label: "Enjoy!", description: "Your order has been delivered. Enjoy!", progress: 100 },
  COMPLETED: { label: "Completed", description: "Thank you for dining with us!", progress: 100 },
};

const ACTIVE_STATUSES = ["PREPPING", "READY", "SERVING", "COMPLETED"];

interface PageProps {
  params: Promise<{ locale: string; eventSlug: string }>;
}

function StatusContent({ locale, eventSlug }: { locale: string; eventSlug: string }) {
  const searchParams = useSearchParams();
  const qrCode = searchParams.get("qrCode") || "";

  const [event, setEvent] = useState<CateringEvent | null>(null);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Commentary
  const [commentary, setCommentary] = useState<OrderCommentary | null>(null);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const lastCommentaryStatusRef = useRef<string | null>(null);

  // Fortune
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [fortuneLoading, setFortuneLoading] = useState(false);
  const [fortuneOpened, setFortuneOpened] = useState(false);

  const firstName = order?.guestName?.split(" ")[0] || null;

  // Load event
  useEffect(() => {
    fetchCateringEvent(eventSlug).then(setEvent).catch(console.error);
  }, [eventSlug]);

  async function fetchCommentary(status: string) {
    if (!qrCode || commentaryLoading) return;
    if (!["QUEUED", "PREPPING", "READY"].includes(status)) return;
    if (status === lastCommentaryStatusRef.current) return;

    setCommentaryLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/orders/commentary?orderQrCode=${encodeURIComponent(qrCode)}&locale=en`,
        { headers: { "x-tenant-slug": "oh" } }
      );
      if (res.ok) {
        const data = await res.json();
        setCommentary(data);
        lastCommentaryStatusRef.current = status;
      }
    } catch {
      // silently ignore
    } finally {
      setCommentaryLoading(false);
    }
  }

  async function fetchFortune() {
    if (!qrCode || fortuneLoading) return;
    setFortuneLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/orders/fortune?orderQrCode=${encodeURIComponent(qrCode)}&locale=en`,
        { headers: { "x-tenant-slug": "oh" } }
      );
      if (res.ok) setFortune(await res.json());
    } catch {
      // silently ignore
    } finally {
      setFortuneLoading(false);
    }
  }

  useEffect(() => {
    if (!qrCode) {
      setError("No order code provided");
      setLoading(false);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(
          `${API_URL}/orders/status?orderQrCode=${encodeURIComponent(qrCode)}`,
          { headers: { "x-tenant-slug": "oh" } }
        );
        if (!res.ok) throw new Error("Order not found");
        const data = await res.json();
        const orderData = data.order;
        if (!orderData) throw new Error("Order data missing");
        setOrder(orderData);
        setError("");
        if (orderData.status) fetchCommentary(orderData.status);
      } catch {
        setError("Could not find your order");
      } finally {
        setLoading(false);
      }
    };

    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [qrCode]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p style={{ color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>Loading...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", padding: "0 24px", textAlign: "center", gap: "16px" }}>
        <p style={{ color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>{error || "Order not found"}</p>
        <Link href={`/${locale}/catering/e/${eventSlug}/order`} style={{ color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", opacity: 0.65 }}>
          Place an Order
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.QUEUED;
  const isActive = ACTIVE_STATUSES.includes(order.status);
  const eventDate = event ? new Date(event.eventDate) : null;
  const isPhaseA = !isActive; // Show countdown/teaser before PREPPING

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 24px 80px",
        gap: "16px",
      }}
    >
      {event && (
        <CoBrandHeader
          clientLogoUrl={event.logoUrl}
          clientCompany={event.clientCompany}
          showOhLogo={false}
        />
      )}

      {/* Title */}
      <div style={{ textAlign: "center", maxWidth: "360px" }}>
        <h1 style={{
          margin: 0,
          fontSize: "clamp(1.1rem, 5vw, 1.4rem)",
          fontWeight: 700,
          color: "var(--brand-primary)",
          fontFamily: "'Raleway', sans-serif",
        }}>
          {firstName ? `Hi, ${firstName}!` : "Your Order"}
        </h1>
      </div>

      {/* PHASE A: countdown + locked teasers */}
      {isPhaseA && eventDate && (
        <>
          <Countdown targetDate={eventDate} label="Your event is coming up" />

          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--brand-primary)", opacity: 0.55, fontFamily: "'Raleway', sans-serif", textAlign: "center", maxWidth: "300px" }}>
            Order details, kitchen updates, and your digital fortune cookie will unlock once you have arrived at the event and your bowl is being prepared.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "360px" }}>
            <LockedPreviewCard title="Order Status" teaser="Unlocks when your bowl is being prepared" icon="🍜" />
            <LockedPreviewCard title="Kitchen Updates" teaser="Live commentary from our chefs" icon="🔥" />
            <LockedPreviewCard title="Digital Fortune" teaser="Crack it open after your bowl is ready" icon="🥠" />
          </div>
        </>
      )}

      {/* PHASE B: active order UI */}
      {isActive && (
        <>
          {/* Status badge */}
          <div style={{
            background: "var(--brand-primary)",
            borderRadius: "50px",
            padding: "8px 20px",
            boxShadow: "0 0 20px var(--brand-surface)",
          }}>
            <p style={{
              margin: 0, fontSize: "0.9rem", fontWeight: 700,
              color: "var(--brand-on-primary)", fontFamily: "'Raleway', sans-serif",
              textTransform: "uppercase", letterSpacing: "2px",
            }}>
              {statusConfig.label}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ width: "100%", maxWidth: "300px", height: "8px", background: "var(--brand-surface)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              width: `${statusConfig.progress}%`, height: "100%",
              background: "var(--brand-primary)", borderRadius: "4px",
              transition: "width 0.5s ease",
            }} />
          </div>

          {/* Commentary */}
          {["QUEUED", "PREPPING", "READY"].includes(order.status) && (
            <div style={{
              background: "var(--brand-surface)",
              border: "1px solid var(--brand-border)",
              borderRadius: "12px",
              padding: "14px 16px",
              maxWidth: "360px",
              width: "100%",
            }}>
              <p style={{ color: "var(--brand-primary)", fontSize: "0.9rem", margin: 0, fontStyle: "italic", fontFamily: "'Raleway', sans-serif", lineHeight: 1.4 }}>
                {commentaryLoading
                  ? "Listening to the kitchen..."
                  : commentary?.commentary
                    ? (() => {
                        const sentences = commentary.commentary.match(/[^.!?]+[.!?]+/g) || [commentary.commentary];
                        return sentences.slice(0, 2).join(" ").trim();
                      })()
                    : statusConfig.description}
              </p>
            </div>
          )}

          {/* Order items */}
          {order.items.length > 0 && (
            <div style={{
              background: "var(--brand-surface)",
              border: "1px solid var(--brand-border)",
              borderRadius: "12px",
              padding: "14px 16px",
              maxWidth: "360px",
              width: "100%",
            }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.7rem", color: "var(--brand-primary)", opacity: 0.55, fontFamily: "'Raleway', sans-serif", textTransform: "uppercase", letterSpacing: "1px" }}>
                Your Order:
              </p>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif", lineHeight: 1.6 }}>
                {order.items.map((item, i) => (
                  <span key={item.id || i}>
                    {item.name}
                    {item.selectedValue && ` (${item.selectedValue})`}
                    {i < order.items.length - 1 && ", "}
                  </span>
                ))}
              </p>
            </div>
          )}

          {/* Fortune cookie */}
          <div style={{
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "12px",
            padding: "16px",
            maxWidth: "360px",
            width: "100%",
            textAlign: "center",
          }}>
            {!fortuneOpened ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" }}>
                <span style={{ fontSize: "2rem" }}>🥠</span>
                <button
                  onClick={() => { setFortuneOpened(true); fetchFortune(); }}
                  style={{
                    padding: "10px 22px",
                    background: "var(--brand-primary)",
                    color: "var(--brand-on-primary)",
                    border: "none",
                    borderRadius: "50px",
                    fontFamily: "'Raleway', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    letterSpacing: "0.5px",
                  }}
                >
                  Crack It Open{firstName ? `, ${firstName}` : ""}!
                </button>
              </div>
            ) : fortuneLoading ? (
              <p style={{ color: "var(--brand-primary)", fontSize: "0.9rem", margin: 0, fontFamily: "'Raleway', sans-serif" }}>Reading the stars...</p>
            ) : fortune ? (
              <div>
                <p style={{ fontStyle: "italic", fontSize: "0.95rem", color: "var(--brand-primary)", margin: "0 0 12px", lineHeight: 1.5, fontFamily: "'Raleway', sans-serif" }}>
                  🥠 &ldquo;{fortune.fortune}&rdquo;
                </p>
                <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--brand-primary)", opacity: 0.6, fontFamily: "'Raleway', sans-serif" }}>Lucky #s:</span>
                  {fortune.luckyNumbers.map((n, i) => (
                    <span key={i} style={{
                      width: "24px", height: "24px", borderRadius: "50%",
                      background: "var(--brand-primary)", color: "var(--brand-on-primary)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontWeight: "bold", fontSize: "0.72rem", fontFamily: "'Raleway', sans-serif",
                    }}>{n}</span>
                  ))}
                </div>
                {fortune.learnChinese && (
                  <div style={{ marginTop: "10px", padding: "8px 12px", background: "var(--brand-border)", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--brand-primary)", fontFamily: "'Raleway', sans-serif" }}>
                      <span style={{ fontSize: "1.2rem", marginRight: "6px" }}>{fortune.learnChinese.traditional}</span>
                      <span style={{ fontWeight: 600 }}>{fortune.learnChinese.pinyin}</span>
                      {" = "}
                      {fortune.learnChinese.english}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "var(--brand-primary)", opacity: 0.5, fontSize: "0.85rem", margin: 0, fontFamily: "'Raleway', sans-serif" }}>Fortune unavailable</p>
            )}
          </div>

          <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--brand-primary)", opacity: 0.4, fontFamily: "'Raleway', sans-serif" }}>
            This page updates automatically
          </p>
        </>
      )}

      {/* Survey CTA (always visible) */}
      <Link
        href={`/${locale}/catering/e/${eventSlug}/survey?qrCode=${qrCode}`}
        style={{
          fontSize: "0.78rem",
          color: "var(--brand-primary)",
          opacity: 0.45,
          fontFamily: "'Raleway', sans-serif",
          textDecoration: "none",
          marginTop: "8px",
        }}
      >
        Share feedback about your experience with Oh! Beef Noodle Soup
      </Link>
    </div>
  );
}

export default function StatusPage({ params }: PageProps) {
  const { locale, eventSlug } = use(params);
  return (
    <>
      <ThemedBackground />
      <Suspense fallback={<div style={{ height: "100vh" }} />}>
        <StatusContent locale={locale} eventSlug={eventSlug} />
      </Suspense>
    </>
  );
}
