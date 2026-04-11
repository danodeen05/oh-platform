"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal, flushSync } from "react-dom";
import Image from "next/image";
import { loadStripe, Stripe, PaymentRequest } from "@stripe/stripe-js";
import { StripeProvider } from "./payments/StripeProvider";
import { PaymentForm } from "./payments/PaymentForm";

// Singleton Stripe promise
let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

// Apple Pay pending order interface
interface ApplePayOrder {
  orderId: string;
  orderNumber: string;
  clientSecret: string;
  totalCents: number;
  locationName: string;
}

// Brand colors
const COLORS = {
  olive: "#7C7A67",
  oliveDark: "#5a5848",
  oliveLight: "#a3a18f",
  orange: "#F97316",
  red: "#C54B31",
  black: "#1a1a1a",
  cream: "#faf9f7",
  white: "#ffffff",
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
  },
};

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: Action[];
  cards?: Card[];
  images?: string[];
}

interface Action {
  label: string;
  action: string;
  variant: "primary" | "secondary" | "outline" | "ghost";
}

interface Card {
  type: "menu_item" | "order_summary" | "tier_progress" | "credits" | "location";
  id?: string;
  name?: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

interface ChappyChatProps {
  userId?: string;
  guestId?: string;
  sessionId?: string;
  locationId?: string;
  apiUrl?: string;
  position?: "bottom-right" | "bottom-left";
  onOrderCreated?: (order: unknown) => void;
}

export function ChappyChat({
  userId,
  guestId,
  sessionId,
  locationId,
  apiUrl = "",
  position = "bottom-right",
  onOrderCreated,
}: ChappyChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Apple Pay state
  const [applePayOrder, setApplePayOrder] = useState<ApplePayOrder | null>(null);
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
  const [isProcessingApplePay, setIsProcessingApplePay] = useState(false);
  const [showCardPaymentForm, setShowCardPaymentForm] = useState(false);
  const stripeRef = useRef<Stripe | null>(null);
  const paymentRequestRef = useRef<PaymentRequest | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const userScrolledUpRef = useRef(false);

  // Track if component is mounted (for SSR hydration)
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Generate session ID if not provided
  const effectiveSessionId = sessionId || `chappy-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Auto-scroll to bottom on new messages (only if user hasn't scrolled up)
  const scrollToBottom = useCallback(() => {
    if (!userScrolledUpRef.current && messagesEndRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 0);
    }
  }, []);

  // Use useLayoutEffect to scroll synchronously after DOM updates
  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, streamingStatus, isLoading, scrollToBottom]);

  // Track if user has scrolled up
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    userScrolledUpRef.current = !isNearBottom;
  };

  // Reset scroll tracking when user sends a message
  const resetScrollTracking = useCallback(() => {
    userScrolledUpRef.current = false;
  }, []);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setHasNewMessage(false);
    }
  }, [isOpen]);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const identifier = userId || guestId || effectiveSessionId;
        if (!identifier) return;

        const params = new URLSearchParams();
        if (userId) params.set("userId", userId);
        else if (guestId) params.set("guestId", guestId);
        else params.set("sessionId", effectiveSessionId);

        const res = await fetch(`${apiUrl}/chappy/history?${params}`);
        const data = await res.json();

        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages
              .filter((m: Message) => m.content)
              .map((m: Message) => ({
                ...m,
                timestamp: m.timestamp || new Date().toISOString(),
              }))
          );
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    };

    loadHistory();
  }, [userId, guestId, effectiveSessionId, apiUrl]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Initialize Stripe and check Apple Pay availability
  useEffect(() => {
    const initStripe = async () => {
      const stripe = await getStripe();
      if (stripe) {
        stripeRef.current = stripe;
        // Check if Apple Pay / Google Pay is available
        const pr = stripe.paymentRequest({
          country: "US",
          currency: "usd",
          total: {
            label: "Oh! Beef Order",
            amount: 100, // Placeholder, will be updated when order is created
          },
          requestPayerName: true,
          requestPayerEmail: true,
        });

        const result = await pr.canMakePayment();
        setIsApplePayAvailable(!!result);
        if (result) {
          paymentRequestRef.current = pr;
        }
      }
    };

    initStripe();
  }, []);

  // Handle Apple Pay payment
  const handleApplePay = useCallback(async () => {
    if (!applePayOrder || !stripeRef.current || isProcessingApplePay) return;

    setIsProcessingApplePay(true);

    try {
      const stripe = stripeRef.current;

      // Create a new payment request with the correct amount
      const paymentRequest = stripe.paymentRequest({
        country: "US",
        currency: "usd",
        total: {
          label: `Oh! Beef - ${applePayOrder.locationName}`,
          amount: applePayOrder.totalCents,
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      // Check if can make payment
      const canPay = await paymentRequest.canMakePayment();
      if (!canPay) {
        // Apple Pay not available - show card payment form instead
        setShowCardPaymentForm(true);
        setIsProcessingApplePay(false);
        return;
      }

      // Handle the payment method event
      paymentRequest.on("paymentmethod", async (event) => {
        try {
          // Confirm the payment with Stripe
          const { error, paymentIntent } = await stripe.confirmCardPayment(
            applePayOrder.clientSecret,
            { payment_method: event.paymentMethod.id },
            { handleActions: false }
          );

          if (error) {
            event.complete("fail");
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Payment failed: ${error.message}. Try again or use a different payment method.`,
                timestamp: new Date().toISOString(),
              },
            ]);
            setIsProcessingApplePay(false);
            return;
          }

          if (paymentIntent?.status === "requires_action") {
            // Handle 3D Secure if needed
            const { error: confirmError } = await stripe.confirmCardPayment(applePayOrder.clientSecret);
            if (confirmError) {
              event.complete("fail");
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Payment verification failed. Please try again.`,
                  timestamp: new Date().toISOString(),
                },
              ]);
              setIsProcessingApplePay(false);
              return;
            }
          }

          event.complete("success");

          // Confirm the order with our API
          const confirmResponse = await fetch(`${apiUrl}/chappy/confirm-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: applePayOrder.orderId,
              paymentIntentId: paymentIntent?.id,
            }),
          });

          const confirmData = await confirmResponse.json();

          if (confirmData.success) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Payment successful! ${confirmData.message}\n\nOrder #${confirmData.kitchenOrderNumber}\nTotal: ${confirmData.total}`,
                timestamp: new Date().toISOString(),
              },
            ]);
            setApplePayOrder(null);
            if (onOrderCreated) {
              onOrderCreated(confirmData);
            }
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Payment went through but we had trouble confirming your order. Please contact support with order ID: ${applePayOrder.orderId}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        } catch (err) {
          event.complete("fail");
          console.error("Apple Pay error:", err);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Something went wrong with the payment. Please try again.",
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        setIsProcessingApplePay(false);
      });

      // Show the payment sheet
      paymentRequest.show();
    } catch (error) {
      console.error("Apple Pay initialization error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Could not start Apple Pay. Please try again or use a different payment method.",
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsProcessingApplePay(false);
    }
  }, [applePayOrder, apiUrl, isProcessingApplePay, onOrderCreated]);

  // Send message with streaming
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || isStreaming) return;

      const userMessage: Message = {
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      // Clear input immediately
      setInputValue("");

      // FORCE React to render the user message IMMEDIATELY using flushSync
      // This guarantees the DOM is updated before we continue
      flushSync(() => {
        setMessages((prev) => [...prev, userMessage]);
      });

      // Scroll to bottom - DOM is now guaranteed to have the new message
      resetScrollTracking();
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }

      // CRITICAL: Wait for browser to PAINT before continuing
      // Double requestAnimationFrame ensures the frame has been painted
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      // NOW start loading state - user has seen their message
      setIsLoading(true);
      setIsStreaming(true);
      setStreamingText("");
      setStreamingStatus(null);

      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Build query params
      const params = new URLSearchParams({
        message: encodeURIComponent(text.trim()),
      });
      if (userId) params.set("userId", userId);
      else if (guestId) params.set("guestId", guestId);
      else params.set("sessionId", effectiveSessionId);
      if (locationId) params.set("locationId", locationId);

      // Connect to streaming endpoint
      const eventSource = new EventSource(`${apiUrl}/chappy/chat/stream?${params}`);
      eventSourceRef.current = eventSource;

      let accumulatedText = "";

      eventSource.addEventListener("thinking", () => {
        setStreamingStatus("Chappy is thinking...");
      });

      eventSource.addEventListener("text", (e) => {
        const data = JSON.parse(e.data);
        accumulatedText += data.text;
        setStreamingText(accumulatedText);
        setStreamingStatus(null);
        setIsLoading(false);
      });

      eventSource.addEventListener("tool_start", (e) => {
        const data = JSON.parse(e.data);
        const toolNames: Record<string, string> = {
          browse_menu: "Checking the menu",
          get_user_profile: "Looking up your account",
          get_points_balance: "Checking your points",
          get_order_history: "Reviewing your order history",
          suggest_dishes: "Finding recommendations",
          create_order: "Creating your order",
          get_locations: "Finding nearby locations",
          get_tier_progress: "Checking your tier progress",
          get_challenges: "Looking at your challenges",
        };
        setStreamingStatus(toolNames[data.toolName] || `Working on it...`);
      });

      eventSource.addEventListener("tool_executing", (e) => {
        const data = JSON.parse(e.data);
        const toolNames: Record<string, string> = {
          browse_menu: "Loading menu items",
          get_user_profile: "Getting your details",
          get_points_balance: "Calculating points",
          get_order_history: "Fetching orders",
          suggest_dishes: "Picking perfect dishes",
          create_order: "Processing order",
          get_locations: "Loading locations",
          get_tier_progress: "Calculating progress",
          get_challenges: "Loading challenges",
        };
        setStreamingStatus(toolNames[data.toolName] || "Processing...");
      });

      eventSource.addEventListener("tool_complete", () => {
        setStreamingStatus("Almost done...");
      });

      eventSource.addEventListener("done", (e) => {
        const data = JSON.parse(e.data);

        const assistantMessage: Message = {
          role: "assistant",
          content: data.text || data.formattedText || accumulatedText,
          timestamp: new Date().toISOString(),
          actions: data.actions,
          cards: data.cards,
          images: data.images,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setIsStreaming(false);
        setStreamingText("");
        setStreamingStatus(null);
        setIsLoading(false);

        // Reset scroll tracking so the useEffect will scroll to show the response
        userScrolledUpRef.current = false;

        // Check if Apple Pay is required for this order
        if (data.applePayOrder) {
          setApplePayOrder({
            orderId: data.applePayOrder.orderId,
            orderNumber: data.applePayOrder.orderNumber,
            clientSecret: data.applePayOrder.clientSecret,
            totalCents: data.applePayOrder.totalCents,
            locationName: data.applePayOrder.locationName,
          });
        }

        // Check if order was created
        if (data.order && onOrderCreated) {
          onOrderCreated(data.order);
        }

        // Show notification if chat is closed
        if (!isOpen) {
          setHasNewMessage(true);
        }

        eventSource.close();
      });

      eventSource.addEventListener("error", (e) => {
        console.error("Stream error:", e);
        eventSource.close();

        // Only show error if we haven't received any text
        if (!accumulatedText) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Oops! Something went wrong. Please try again. - Chappy",
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          // If we have text, use what we got
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: accumulatedText,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        setIsStreaming(false);
        setStreamingText("");
        setStreamingStatus(null);
        setIsLoading(false);
      });
    },
    [userId, guestId, effectiveSessionId, locationId, apiUrl, isLoading, isStreaming, isOpen, onOrderCreated, resetScrollTracking]
  );

  // Handle action button clicks
  const handleAction = useCallback(
    (action: string) => {
      const actionMessages: Record<string, string> = {
        start_order: "I'd like to start an order",
        browse_menu: "Show me the menu",
        browse_mains: "Show me the main dishes",
        browse_sides: "What sides do you have?",
        browse_drinks: "What drinks do you have?",
        check_points: "What's my points balance?",
        check_order: "Where's my order?",
        reorder: "Reorder my usual",
        reorder_usual: "I'll have my usual",
        add_to_cart: "Add that to my cart",
        view_cart: "What's in my cart?",
        more_recommendations: "Show me more options",
        account: "Tell me about my account",
        add_recommended: "Add that to my order",
        more_info: "Tell me more about that",
        pay: "I'm ready to pay",
      };

      const message = actionMessages[action] || action;
      sendMessage(message);
    },
    [sendMessage]
  );

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // Toggle chat
  const toggleChat = () => setIsOpen(!isOpen);

  // Styles as CSS string for animations
  const animationStyles = `
    @keyframes chappyPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(124, 122, 103, 0.4); }
      50% { transform: scale(1.05); box-shadow: 0 6px 30px rgba(124, 122, 103, 0.6); }
    }

    @keyframes chappyBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes chappyWave {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-10deg); }
      75% { transform: rotate(10deg); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes messagePop {
      0% { opacity: 0; transform: scale(0.8) translateY(10px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    @keyframes dotBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    @keyframes notificationPing {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2); opacity: 0; }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    .chappy-button {
      animation: chappyPulse 3s ease-in-out infinite;
    }

    .chappy-button:hover {
      animation: chappyBounce 0.6s ease-in-out infinite;
    }

    .chappy-avatar-wave {
      animation: chappyWave 1s ease-in-out infinite;
    }

    .chappy-message {
      animation: messagePop 0.3s ease-out forwards;
    }

    .chappy-user-message {
      /* User messages appear instantly, no animation delay */
      opacity: 1;
    }

    .chappy-panel {
      animation: slideUp 0.3s ease-out forwards;
    }

    .chappy-typing-dot {
      animation: dotBounce 1.2s infinite;
    }

    .chappy-notification-ping {
      animation: notificationPing 1.5s ease-out infinite;
    }
  `;

  // Chat button with animated avatar and label
  const chatButton = (
    <button
      onClick={toggleChat}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      aria-label={isOpen ? "Close chat" : "Chat with Chappy"}
      className="chappy-button"
      style={{
        position: "fixed",
        bottom: 24,
        [position === "bottom-right" ? "right" : "left"]: 24,
        height: isOpen ? 68 : 56,
        width: isOpen ? 68 : "auto",
        borderRadius: isOpen ? "50%" : 28,
        background: `linear-gradient(145deg, ${COLORS.olive}, ${COLORS.oliveDark})`,
        color: COLORS.white,
        border: "3px solid rgba(255,255,255,0.2)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        zIndex: 9999,
        padding: isOpen ? 0 : "8px 18px 8px 8px",
        overflow: "hidden",
        transition: "all 0.3s ease",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
      }}
    >
      {isOpen ? (
        <span style={{ fontSize: "1.75rem", fontWeight: "bold" }}>×</span>
      ) : (
        <>
          {/* Avatar - zoomed in on face */}
          <div
            className={isHovering ? "chappy-avatar-wave" : ""}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              overflow: "hidden",
              background: COLORS.cream,
              border: "2px solid rgba(255,255,255,0.3)",
              flexShrink: 0,
            }}
          >
            <img
              src="/Chappy.png"
              alt="Chappy"
              style={{
                width: "180%",
                height: "180%",
                objectFit: "cover",
                objectPosition: "50% 15%",
                marginLeft: "-40%",
                marginTop: "-10%",
              }}
            />
          </div>
          {/* Label */}
          <span
            style={{
              fontWeight: 600,
              fontSize: "0.95rem",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            Chat with Chappy
          </span>
        </>
      )}

      {/* New message notification */}
      {hasNewMessage && !isOpen && (
        <>
          <span
            className="chappy-notification-ping"
            style={{
              position: "absolute",
              top: -4,
              left: -4,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: COLORS.orange,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: -4,
              left: -4,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: COLORS.orange,
              border: `3px solid ${COLORS.white}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.7rem",
              fontWeight: "bold",
              color: "white",
            }}
          >
            !
          </span>
        </>
      )}

    </button>
  );

  // Chat panel
  const chatPanel = isOpen && (
    <div
      className="chappy-panel"
      style={{
        position: "fixed",
        bottom: 108,
        [position === "bottom-right" ? "right" : "left"]: 24,
        width: 400,
        maxWidth: "calc(100vw - 48px)",
        height: 560,
        maxHeight: "calc(100vh - 140px)",
        background: COLORS.white,
        borderRadius: 20,
        boxShadow: "0 10px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 9998,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          background: `linear-gradient(135deg, ${COLORS.olive}, ${COLORS.oliveDark})`,
          color: COLORS.white,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Chappy Avatar */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: COLORS.cream,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.3)",
            flexShrink: 0,
          }}
        >
          <img
            src="/Chappy.png"
            alt="Chappy"
            style={{
              width: "180%",
              height: "180%",
              objectFit: "cover",
              objectPosition: "50% 15%",
              marginLeft: "-40%",
              marginTop: "-10%",
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
            Chappy Chopstix
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#4ade80",
                display: "inline-block",
              }}
            />
            Online • Your ordering assistant
          </div>
        </div>
        <button
          onClick={toggleChat}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: 8,
            padding: "8px 10px",
            cursor: "pointer",
            color: "white",
            fontSize: "1.1rem",
            lineHeight: 1,
            transition: "background 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: `linear-gradient(180deg, ${COLORS.gray[50]} 0%, ${COLORS.white} 100%)`,
        }}
      >
        {messages.length === 0 && (
          <WelcomeScreen onAction={handleAction} />
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={idx}
            message={msg}
            onAction={handleAction}
            isLatest={idx === messages.length - 1 && !isStreaming}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingText && (
          <StreamingMessage text={streamingText} status={streamingStatus} />
        )}

        {/* Status indicator when no text yet */}
        {isStreaming && !streamingText && streamingStatus && (
          <StreamingStatus status={streamingStatus} />
        )}

        {isLoading && !isStreaming && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Payment Section - shown when order is ready for payment */}
      {applePayOrder && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${COLORS.gray[200]}`,
            background: `linear-gradient(180deg, ${COLORS.cream} 0%, ${COLORS.white} 100%)`,
          }}
        >
          <div style={{ marginBottom: 8, textAlign: "center" }}>
            <span style={{ fontSize: "0.85rem", color: COLORS.gray[600] }}>
              Order ready • ${(applePayOrder.totalCents / 100).toFixed(2)}
            </span>
          </div>

          {/* Card Payment Form - shown when Apple Pay isn't available */}
          {showCardPaymentForm ? (
            <div style={{ marginBottom: 12 }}>
              <StripeProvider clientSecret={applePayOrder.clientSecret}>
                <PaymentForm
                  amountCents={applePayOrder.totalCents}
                  returnUrl={typeof window !== "undefined" ? window.location.href : ""}
                  showExpressCheckout={true}
                  onSuccess={async (paymentIntentId) => {
                    // Payment successful - confirm order on backend
                    try {
                      const response = await fetch(`${apiUrl}/chappy/confirm-payment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          orderId: applePayOrder.orderId,
                          paymentIntentId,
                        }),
                      });
                      const result = await response.json();

                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "assistant",
                          content: result.message || `Order confirmed! Your order number is ${applePayOrder.orderNumber}. Head to ${applePayOrder.locationName} to pick up your food.`,
                          timestamp: new Date().toISOString(),
                        },
                      ]);

                      setApplePayOrder(null);
                      setShowCardPaymentForm(false);
                      onOrderCreated?.(result.order);
                    } catch (error) {
                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "assistant",
                          content: "Payment successful but there was an issue confirming your order. Please contact support.",
                          timestamp: new Date().toISOString(),
                        },
                      ]);
                    }
                  }}
                  onError={(error) => {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: `Payment failed: ${error}. Please try again or use a different card.`,
                        timestamp: new Date().toISOString(),
                      },
                    ]);
                  }}
                />
              </StripeProvider>
              <button
                onClick={() => {
                  setShowCardPaymentForm(false);
                  setApplePayOrder(null);
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: 8,
                  background: "transparent",
                  color: COLORS.gray[500],
                  border: "none",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancel order
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleApplePay}
                disabled={isProcessingApplePay}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "#000000",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: isProcessingApplePay ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isProcessingApplePay ? 0.7 : 1,
                }}
              >
                {isProcessingApplePay ? (
                  <>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Processing...
                  </>
                ) : isApplePayAvailable ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Pay with Apple Pay
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Complete Payment
                  </>
                )}
              </button>
              <button
                onClick={() => setApplePayOrder(null)}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginTop: 8,
                  background: "transparent",
                  color: COLORS.gray[500],
                  border: "none",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancel order
              </button>
            </>
          )}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: 16,
          borderTop: `1px solid ${COLORS.gray[200]}`,
          background: COLORS.white,
          display: applePayOrder ? "none" : "block", // Hide input when Apple Pay is shown
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            background: COLORS.gray[100],
            borderRadius: 28,
            padding: "6px 6px 6px 18px",
            alignItems: "center",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Chappy is responding..." : "Message Chappy..."}
            disabled={isLoading || isStreaming}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              background: "transparent",
              fontSize: "0.95rem",
              outline: "none",
              color: COLORS.gray[700],
            }}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading || isStreaming}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: inputValue.trim() && !isStreaming
                ? `linear-gradient(135deg, ${COLORS.olive}, ${COLORS.oliveDark})`
                : COLORS.gray[300],
              color: COLORS.white,
              border: "none",
              cursor: inputValue.trim() && !isLoading && !isStreaming ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              transition: "all 0.2s ease",
              transform: inputValue.trim() && !isStreaming ? "scale(1)" : "scale(0.95)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  // Don't render until mounted (prevents hydration mismatch)
  if (!isMounted) return null;

  return createPortal(
    <>
      <style>{animationStyles}</style>
      {chatButton}
      {chatPanel}
    </>,
    document.body
  );
}

// Welcome screen component
function WelcomeScreen({ onAction }: { onAction: (action: string) => void }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "24px 16px",
      }}
    >
      {/* Chappy intro */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: COLORS.cream,
          margin: "0 auto 16px",
          overflow: "hidden",
          border: `3px solid ${COLORS.olive}`,
        }}
      >
        <img
          src="/Chappy.png"
          alt="Chappy"
          style={{
            width: "180%",
            height: "180%",
            objectFit: "cover",
            objectPosition: "50% 15%",
            marginLeft: "-40%",
            marginTop: "-10%",
          }}
        />
      </div>

      <h3 style={{ margin: "0 0 8px", fontSize: "1.25rem", fontWeight: 700, color: COLORS.black }}>
        Hey! I'm Chappy
      </h3>
      <p style={{ margin: "0 0 20px", fontSize: "0.9rem", color: COLORS.gray[500], lineHeight: 1.5 }}>
        Your friendly chopsticks assistant! I can help you order delicious beef noodle soup, check your points, or answer any questions.
      </p>

      {/* Quick action cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <QuickActionCard
          icon="🍜"
          title="Start an Order"
          description="Browse our menu and build your perfect bowl"
          onClick={() => onAction("start_order")}
          primary
        />
        <div style={{ display: "flex", gap: 10 }}>
          <QuickActionCard
            icon="📋"
            title="See Menu"
            description="View all dishes"
            onClick={() => onAction("browse_menu")}
            compact
          />
          <QuickActionCard
            icon="⭐"
            title="My Points"
            description="Check balance"
            onClick={() => onAction("check_points")}
            compact
          />
        </div>
      </div>
    </div>
  );
}

// Quick action card
function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  primary = false,
  compact = false,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
  compact?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        flex: compact ? 1 : undefined,
        display: "flex",
        alignItems: "center",
        gap: compact ? 10 : 14,
        padding: compact ? "12px 14px" : "14px 18px",
        background: primary
          ? isHovered ? COLORS.oliveDark : COLORS.olive
          : isHovered ? COLORS.gray[100] : COLORS.white,
        color: primary ? COLORS.white : COLORS.black,
        border: primary ? "none" : `1px solid ${COLORS.gray[200]}`,
        borderRadius: 14,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.2s ease",
        transform: isHovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: isHovered
          ? "0 4px 12px rgba(0,0,0,0.1)"
          : "0 2px 4px rgba(0,0,0,0.05)",
      }}
    >
      <span style={{ fontSize: compact ? "1.25rem" : "1.5rem" }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: compact ? "0.85rem" : "0.95rem" }}>{title}</div>
        <div style={{
          fontSize: compact ? "0.75rem" : "0.8rem",
          opacity: 0.7,
          marginTop: 2,
        }}>
          {description}
        </div>
      </div>
    </button>
  );
}

// Message bubble component
function MessageBubble({
  message,
  onAction,
  isLatest,
}: {
  message: Message;
  onAction: (action: string) => void;
  isLatest: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={isUser ? "chappy-user-message" : (isLatest ? "chappy-message" : "")}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 8,
        // User messages: no animation, instantly visible
        ...(isUser ? { opacity: 1, transform: "none", animation: "none" } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          maxWidth: "88%",
          flexDirection: isUser ? "row-reverse" : "row",
        }}
      >
        {!isUser && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: COLORS.olive,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src="/Chappy.png"
              alt="Chappy"
              style={{
                width: "180%",
                height: "180%",
                objectFit: "cover",
                objectPosition: "50% 15%",
                marginLeft: "-40%",
                marginTop: "-10%",
              }}
            />
          </div>
        )}

        <div
          style={{
            padding: "12px 16px",
            borderRadius: 18,
            borderBottomLeftRadius: isUser ? 18 : 6,
            borderBottomRightRadius: isUser ? 6 : 18,
            background: isUser
              ? `linear-gradient(135deg, ${COLORS.olive}, ${COLORS.oliveDark})`
              : COLORS.white,
            color: isUser ? COLORS.white : COLORS.black,
            fontSize: "0.925rem",
            lineHeight: 1.5,
            boxShadow: isUser
              ? "0 2px 8px rgba(124, 122, 103, 0.3)"
              : "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <RichText content={message.content} isUser={isUser} />
        </div>
      </div>

      {/* Images */}
      {message.images && message.images.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginLeft: 42, flexWrap: "wrap" }}>
          {message.images.map((img, idx) => (
            <div
              key={idx}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <img
                src={img}
                alt=""
                style={{
                  maxWidth: 200,
                  maxHeight: 150,
                  objectFit: "cover",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      {message.cards && message.cards.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginLeft: 42, flexWrap: "wrap" }}>
          {message.cards.map((card, idx) => (
            <ItemCard key={idx} card={card} onAction={onAction} />
          ))}
        </div>
      )}

      {/* Action buttons */}
      {message.actions && message.actions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginLeft: 42,
          }}
        >
          {message.actions.map((action, idx) => (
            <ActionButton key={idx} action={action} onClick={() => onAction(action.action)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Rich text renderer
function RichText({ content, isUser }: { content: string; isUser: boolean }) {
  // Parse markdown-style formatting
  const parseContent = (text: string) => {
    // Split by lines first
    const lines = text.split("\n");

    return lines.map((line, lineIdx) => {
      // Handle headers
      if (line.startsWith("## ")) {
        return (
          <div key={lineIdx} style={{ fontWeight: 700, fontSize: "1rem", marginTop: lineIdx > 0 ? 12 : 0, marginBottom: 6 }}>
            {line.slice(3)}
          </div>
        );
      }

      // Handle bullet points
      if (line.startsWith("- ")) {
        const bulletContent = formatInlineStyles(line.slice(2), isUser);
        return (
          <div key={lineIdx} style={{ display: "flex", gap: 8, marginLeft: 4 }}>
            <span style={{ opacity: 0.5 }}>•</span>
            <span>{bulletContent}</span>
          </div>
        );
      }

      // Regular line
      if (line.trim()) {
        return (
          <div key={lineIdx} style={{ marginBottom: lineIdx < lines.length - 1 ? 4 : 0 }}>
            {formatInlineStyles(line, isUser)}
          </div>
        );
      }

      // Empty line = paragraph break
      return <div key={lineIdx} style={{ height: 8 }} />;
    });
  };

  return <div>{parseContent(content)}</div>;
}

// Format inline styles (bold, italic, links, etc.)
function formatInlineStyles(text: string, isUser: boolean): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for markdown links [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, linkMatch.index)}</span>);
      }
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: isUser ? "#fff" : COLORS.red,
            textDecoration: "underline",
            fontWeight: 600,
          }}
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    // Check for bold (**text**)
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      // Add text before the match
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      // Add the bold text
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Check for italic (*text*)
    const italicMatch = remaining.match(/\*(.+?)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, italicMatch.index)}</span>);
      }
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // No more matches, add remaining text
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

// Item card component
function ItemCard({ card, onAction }: { card: Card; onAction: (action: string) => void }) {
  if (card.type === "menu_item") {
    return (
      <div
        style={{
          background: COLORS.white,
          borderRadius: 14,
          padding: 14,
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          border: `1px solid ${COLORS.gray[200]}`,
          minWidth: 180,
          maxWidth: 220,
        }}
      >
        {card.imageUrl && (
          <div
            style={{
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 10,
              height: 100,
              background: COLORS.gray[100],
            }}
          >
            <img
              src={card.imageUrl}
              alt={card.name}
              style={{
                width: "180%",
                height: "180%",
                objectFit: "cover",
                objectPosition: "50% 15%",
                marginLeft: "-40%",
                marginTop: "-10%",
              }}
            />
          </div>
        )}
        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>{card.name}</div>
        {card.description && (
          <div style={{ fontSize: "0.8rem", color: COLORS.gray[500], marginBottom: 8 }}>
            {card.description}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: COLORS.olive }}>{card.price}</span>
          <button
            onClick={() => onAction(`add_item_${card.id}`)}
            style={{
              padding: "6px 12px",
              background: COLORS.olive,
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// Action button component
function ActionButton({ action, onClick }: { action: Action; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  const getStyles = () => {
    switch (action.variant) {
      case "primary":
        return {
          background: isHovered ? COLORS.oliveDark : COLORS.olive,
          color: COLORS.white,
          border: "none",
        };
      case "secondary":
        return {
          background: isHovered ? COLORS.gray[200] : COLORS.gray[100],
          color: COLORS.gray[700],
          border: "none",
        };
      case "outline":
        return {
          background: isHovered ? COLORS.gray[50] : "transparent",
          color: COLORS.olive,
          border: `1.5px solid ${COLORS.olive}`,
        };
      default:
        return {
          background: isHovered ? COLORS.gray[100] : "transparent",
          color: COLORS.gray[600],
          border: "none",
        };
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "9px 16px",
        borderRadius: 20,
        fontSize: "0.825rem",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        ...getStyles(),
      }}
    >
      {action.label}
    </button>
  );
}

// Streaming message component - shows text as it arrives
function StreamingMessage({ text, status }: { text: string; status: string | null }) {
  return (
    <div
      className="chappy-message"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          maxWidth: "88%",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: COLORS.olive,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <img
            src="/Chappy.png"
            alt="Chappy"
            style={{
                width: "180%",
                height: "180%",
                objectFit: "cover",
                objectPosition: "50% 15%",
                marginLeft: "-40%",
                marginTop: "-10%",
              }}
          />
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderRadius: 18,
            borderBottomLeftRadius: 6,
            background: COLORS.white,
            color: COLORS.black,
            fontSize: "0.925rem",
            lineHeight: 1.5,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <RichText content={text} isUser={false} />
          {/* Streaming cursor */}
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: "1em",
              background: COLORS.olive,
              marginLeft: 2,
              animation: "blink 1s infinite",
            }}
          />
        </div>
      </div>

      {/* Status indicator */}
      {status && (
        <div
          style={{
            marginLeft: 42,
            fontSize: "0.75rem",
            color: COLORS.gray[500],
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: COLORS.orange,
              animation: "pulse 1s infinite",
            }}
          />
          {status}
        </div>
      )}
    </div>
  );
}

// Streaming status component - shows while waiting for text
function StreamingStatus({ status }: { status: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: COLORS.olive,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <img
          src="/Chappy.png"
          alt="Chappy"
          style={{
                width: "180%",
                height: "180%",
                objectFit: "cover",
                objectPosition: "50% 15%",
                marginLeft: "-40%",
                marginTop: "-10%",
              }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "14px 18px",
          background: COLORS.white,
          borderRadius: 18,
          borderBottomLeftRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* Animated spinner */}
          <div
            style={{
              width: 16,
              height: 16,
              border: `2px solid ${COLORS.gray[200]}`,
              borderTopColor: COLORS.olive,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: "0.875rem", color: COLORS.gray[600] }}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: COLORS.olive,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <img
          src="/Chappy.png"
          alt="Chappy"
          style={{
                width: "180%",
                height: "180%",
                objectFit: "cover",
                objectPosition: "50% 15%",
                marginLeft: "-40%",
                marginTop: "-10%",
              }}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 5,
          padding: "14px 18px",
          background: COLORS.white,
          borderRadius: 18,
          borderBottomLeftRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="chappy-typing-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: COLORS.gray[400],
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default ChappyChat;
