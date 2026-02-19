"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { AnimatedBackground } from "@/components/cny/AnimatedBackground";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// CNY Party 2026 Configuration
const CNY_PARTY_LOCATION_ID = "cny-party-2026";
const CNY_TENANT_ID = "cmip6jbxa00002nnnktgu64dc"; // Oh! tenant
const CNY_EVENT_CODE = "cny-party-2026";

// Menu Item IDs (from production seed)
const MENU_ITEMS = {
  beefSoup: "cmip6jbza00062nnnskz6ntt8", // Classic Beef Noodle Soup
  noBeefSoup: "cmip6jbzc000a2nnnewnr00lb", // Classic Beef Noodle Soup (no beef)
  bokChoy: "cmip6jc0200272nnnmx2bv246", // Baby Bok Choy
  greenOnions: "cmip6jc0g00292nnnwsr3nsiq", // Green Onions
  cilantro: "cmip6jc0h002b2nnnedxu3hy6", // Cilantro
  sprouts: "cmip6jc0h002d2nnn4zrbfozw", // Sprouts
};

// Slider labels
const SLIDER_LABELS = ["None", "Light", "Normal", "Extra"];

// Default topping values
const DEFAULT_TOPPINGS = {
  bokChoy: 2, // Default: Normal
  greenOnions: 2, // Default: Normal
  cilantro: 1, // Default: Light
  sprouts: 2, // Default: Normal
} as const;

function CNYOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get guest info from URL params (from RSVP/SMS link)
  const guestName = searchParams.get("name") || "";
  const guestPhone = searchParams.get("phone") || "";
  const firstName = guestName.split(" ")[0];

  const [step, setStep] = useState(1); // 1: Base, 2: Toppings, 3: Review
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Existing order state
  const [existingOrder, setExistingOrder] = useState<{
    orderNumber: string;
    qrCode: string;
    items: Array<{ menuItem: { name: string }; selectedValue?: string }>;
  } | null>(null);

  // Order state
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [toppings, setToppings] = useState({ ...DEFAULT_TOPPINGS });

  // Check for existing order on load
  useEffect(() => {
    const checkExistingOrder = async () => {
      if (!guestPhone) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/orders/event/check?phone=${encodeURIComponent(guestPhone)}`,
          {
            headers: { "x-tenant-slug": "oh" },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            setExistingOrder({
              orderNumber: data.kitchenOrderNumber,
              qrCode: data.orderQrCode,
              items: data.items || [],
            });
            setStep(3); // Go to review page to show existing order
          }
        }
      } catch (err) {
        console.error("Error checking existing order:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingOrder();
  }, [guestPhone]);

  // Show welcome modal after loading if no existing order and we have a name
  useEffect(() => {
    if (!isLoading && !existingOrder && firstName) {
      setShowWelcomeModal(true);
    }
  }, [isLoading, existingOrder, firstName]);

  const handleBaseSelect = (base: string) => {
    setSelectedBase(base);
  };

  const handleToppingChange = (topping: keyof typeof toppings, value: number) => {
    setToppings((prev) => ({ ...prev, [topping]: value }));
  };

  // Check if a topping value is the default
  const isDefault = (topping: keyof typeof DEFAULT_TOPPINGS, value: number) => {
    return DEFAULT_TOPPINGS[topping] === value;
  };

  const handleSubmit = async () => {
    if (!guestName || !guestPhone) {
      setError("Missing guest information. Please use the link from your invitation.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const items = [
        { menuItemId: selectedBase, quantity: 1 },
        {
          menuItemId: MENU_ITEMS.bokChoy,
          quantity: toppings.bokChoy,
          selectedValue: SLIDER_LABELS[toppings.bokChoy],
        },
        {
          menuItemId: MENU_ITEMS.greenOnions,
          quantity: toppings.greenOnions,
          selectedValue: SLIDER_LABELS[toppings.greenOnions],
        },
        {
          menuItemId: MENU_ITEMS.cilantro,
          quantity: toppings.cilantro,
          selectedValue: SLIDER_LABELS[toppings.cilantro],
        },
        {
          menuItemId: MENU_ITEMS.sprouts,
          quantity: toppings.sprouts,
          selectedValue: SLIDER_LABELS[toppings.sprouts],
        },
      ];

      const response = await fetch(`${API_URL}/orders/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "oh",
        },
        body: JSON.stringify({
          locationId: CNY_PARTY_LOCATION_ID,
          tenantId: CNY_TENANT_ID,
          items,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          eventCode: CNY_EVENT_CODE,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("One order per guest")) {
          setExistingOrder({
            orderNumber: data.existingOrderNumber,
            qrCode: data.existingOrderQrCode || "",
            items: [],
          });
          setError(
            `You've already placed your order (#${data.existingOrderNumber}). If you want to change your order, come visit us in the kitchen area.`
          );
        } else {
          setError(data.error || "Failed to place order");
        }
        setIsSubmitting(false);
        return;
      }

      // Success! Redirect to confirmation
      router.push(
        `/en/cny/order/confirmation?orderNumber=${data.kitchenOrderNumber}&qrCode=${data.orderQrCode}`
      );
    } catch (err) {
      console.error("Order submission error:", err);
      setError("Failed to place order. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="cny-page cny-page-3">
        <AnimatedBackground theme="gold" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <p style={{ color: "#D7B66E", fontSize: "1.1rem", fontFamily: "'Raleway', sans-serif" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cny-page cny-page-3">
      <AnimatedBackground theme="gold" />

      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <h1
          className="cny-heading"
          style={{
            fontSize: step === 2 ? "clamp(1.2rem, 5vw, 1.6rem)" : "clamp(1.5rem, 6vw, 2rem)",
            marginBottom: step === 2 ? "6px" : "8px",
            color: "#D7B66E",
          }}
        >
          {step === 1 && "Choose Your Soup"}
          {step === 2 && "Add Your Toppings"}
          {step === 3 && (firstName ? `${firstName}'s Order` : "Review Your Order")}
        </h1>

        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: step === 2 ? "10px" : "16px",
          }}
        >
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: s === step ? "#D7B66E" : "rgba(215, 182, 110, 0.3)",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* Step 1: Base Selection */}
        {step === 1 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              width: "100%",
              maxWidth: "360px",
              transform: "scale(0.9)",
            }}
          >
            {/* Beef Noodle Soup */}
            <button
              onClick={() => handleBaseSelect(MENU_ITEMS.beefSoup)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px",
                background:
                  selectedBase === MENU_ITEMS.beefSoup
                    ? "rgba(215, 182, 110, 0.3)"
                    : "rgba(255, 255, 255, 0.1)",
                border:
                  selectedBase === MENU_ITEMS.beefSoup
                    ? "3px solid #D7B66E"
                    : "2px solid rgba(215, 182, 110, 0.3)",
                borderRadius: "16px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#f5f5f5",
                }}
              >
                <Image
                  src="/menu images/Classic Bowl.png"
                  alt="Beef Noodle Soup"
                  width={80}
                  height={80}
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div style={{ textAlign: "left" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#D7B66E",
                    fontFamily: "'Raleway', sans-serif",
                  }}
                >
                  Beef Noodle Soup
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.85rem",
                    color: "rgba(215, 182, 110, 0.8)",
                    fontFamily: "'Raleway', sans-serif",
                  }}
                >
                  Classic braised beef with noodles
                </p>
              </div>
            </button>

            {/* Soup Only */}
            <button
              onClick={() => handleBaseSelect(MENU_ITEMS.noBeefSoup)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px",
                background:
                  selectedBase === MENU_ITEMS.noBeefSoup
                    ? "rgba(215, 182, 110, 0.3)"
                    : "rgba(255, 255, 255, 0.1)",
                border:
                  selectedBase === MENU_ITEMS.noBeefSoup
                    ? "3px solid #D7B66E"
                    : "2px solid rgba(215, 182, 110, 0.3)",
                borderRadius: "16px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#f5f5f5",
                }}
              >
                <Image
                  src="/menu images/Classic Bowl No Beef.png"
                  alt="Soup Only"
                  width={80}
                  height={80}
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div style={{ textAlign: "left" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#D7B66E",
                    fontFamily: "'Raleway', sans-serif",
                  }}
                >
                  Soup Only (No Beef)
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.85rem",
                    color: "rgba(215, 182, 110, 0.8)",
                    fontFamily: "'Raleway', sans-serif",
                  }}
                >
                  Rich broth with noodles, no meat
                </p>
              </div>
            </button>

            <button
              onClick={() => setStep(2)}
              disabled={!selectedBase}
              className="cny-button cny-button-glow"
              style={{
                marginTop: "12px",
                width: "100%",
                opacity: selectedBase ? 1 : 0.5,
                pointerEvents: selectedBase ? "auto" : "none",
              }}
            >
              Add Your Toppings
            </button>

            {/* Horse mascot */}
            <img
              src="/cny/horse.svg"
              alt="Year of the Horse"
              className="cny-horse-animated"
              style={{
                marginTop: "16px",
                width: "clamp(260px, 70vw, 400px)",
                height: "auto",
              }}
            />
          </div>
        )}

        {/* Step 2: Toppings */}
        {step === 2 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              width: "100%",
              maxWidth: "380px",
            }}
          >
            {/* Legend */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "6px",
                marginBottom: "4px",
                marginRight: "16px",
              }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px dashed rgba(215, 182, 110, 0.6)",
                  borderRadius: "4px",
                }}
              />
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "rgba(215, 182, 110, 0.7)",
                  fontFamily: "'Raleway', sans-serif",
                }}
              >
                Recommended
              </span>
            </div>

            {/* Topping Sliders */}
            {[
              { key: "bokChoy", label: "Baby Bok Choy", image: "/menu images/Baby Bok Choy.png" },
              { key: "greenOnions", label: "Green Onions", image: "/menu images/Green Onions.png" },
              { key: "cilantro", label: "Cilantro", image: "/menu images/Cilantro.png" },
              { key: "sprouts", label: "Sprouts", image: "/menu images/Sprouts.png" },
            ].map((topping) => {
              const currentValue = toppings[topping.key as keyof typeof toppings];
              const defaultValue = DEFAULT_TOPPINGS[topping.key as keyof typeof DEFAULT_TOPPINGS];
              const hasChanged = currentValue !== defaultValue;

              return (
                <div
                  key={topping.key}
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "8px 12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        flexShrink: 0,
                        background: "#f5f5f5",
                      }}
                    >
                      <Image
                        src={topping.image}
                        alt={topping.label}
                        width={50}
                        height={50}
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        color: "#D7B66E",
                        fontFamily: "'Raleway', sans-serif",
                      }}
                    >
                      {topping.label}
                    </p>
                  </div>

                  {/* Slider buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                    }}
                  >
                    {SLIDER_LABELS.map((label, index) => {
                      const isSelected = currentValue === index;
                      const isDefaultOption = defaultValue === index;

                      return (
                        <button
                          key={label}
                          onClick={() =>
                            handleToppingChange(topping.key as keyof typeof toppings, index)
                          }
                          style={{
                            flex: 1,
                            padding: "6px 3px",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            fontFamily: "'Raleway', sans-serif",
                            background: isSelected
                              ? "#D7B66E"
                              : "rgba(215, 182, 110, 0.2)",
                            color: isSelected ? "#910C1E" : "#D7B66E",
                            border: hasChanged && isDefaultOption
                              ? "2px dashed rgba(215, 182, 110, 0.6)"
                              : "2px solid transparent",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "20px" }}>
              <button
                onClick={() => setStep(3)}
                className="cny-button cny-button-glow"
                style={{
                  padding: "10px 40px",
                  fontSize: "0.85rem",
                }}
              >
                Review Order
              </button>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: "6px 20px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  fontFamily: "'Raleway', sans-serif",
                  background: "transparent",
                  color: "rgba(215, 182, 110, 0.7)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review Order */}
        {step === 3 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              width: "100%",
              maxWidth: "400px",
            }}
          >
            {/* Order Summary */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                padding: "20px",
              }}
            >
              {existingOrder ? (
                // Show existing order details
                <>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "0.75rem",
                      color: "rgba(215, 182, 110, 0.7)",
                      fontFamily: "'Raleway', sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Order #{existingOrder.orderNumber}
                  </p>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontFamily: "'Raleway', sans-serif",
                    }}
                  >
                    {existingOrder.items.map((item, index) => (
                      <p
                        key={index}
                        style={{
                          margin: "8px 0",
                          display: "flex",
                          justifyContent: "space-between",
                          color: "#D7B66E",
                        }}
                      >
                        <span>{item.menuItem.name}</span>
                        {item.selectedValue && (
                          <span style={{ fontWeight: 600, color: "#D7B66E" }}>
                            {item.selectedValue}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                // Show new order details
                <>
                  <p
                    style={{
                      margin: "0 0 16px",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "#D7B66E",
                      fontFamily: "'Raleway', sans-serif",
                    }}
                  >
                    {selectedBase === MENU_ITEMS.beefSoup
                      ? "Beef Noodle Soup"
                      : "Soup Only (No Beef)"}
                  </p>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontFamily: "'Raleway', sans-serif",
                    }}
                  >
                    <p style={{ margin: "8px 0", display: "flex", justifyContent: "space-between", color: "#D7B66E" }}>
                      <span>Baby Bok Choy</span>
                      <span style={{ fontWeight: 600, color: "#D7B66E" }}>{SLIDER_LABELS[toppings.bokChoy]}</span>
                    </p>
                    <p style={{ margin: "8px 0", display: "flex", justifyContent: "space-between", color: "#D7B66E" }}>
                      <span>Green Onions</span>
                      <span style={{ fontWeight: 600, color: "#D7B66E" }}>{SLIDER_LABELS[toppings.greenOnions]}</span>
                    </p>
                    <p style={{ margin: "8px 0", display: "flex", justifyContent: "space-between", color: "#D7B66E" }}>
                      <span>Cilantro</span>
                      <span style={{ fontWeight: 600, color: "#D7B66E" }}>{SLIDER_LABELS[toppings.cilantro]}</span>
                    </p>
                    <p style={{ margin: "8px 0", display: "flex", justifyContent: "space-between", color: "#D7B66E" }}>
                      <span>Sprouts</span>
                      <span style={{ fontWeight: 600, color: "#D7B66E" }}>{SLIDER_LABELS[toppings.sprouts]}</span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {error && (
              <p
                style={{
                  color: "#D7B66E",
                  fontSize: "0.85rem",
                  textAlign: "center",
                  margin: 0,
                  padding: "12px",
                  background: "rgba(215, 182, 110, 0.15)",
                  borderRadius: "8px",
                  lineHeight: 1.4,
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "20px" }}>
              {existingOrder ? (
                <a
                  href={`/en/cny/order/status?qrCode=${existingOrder.qrCode}`}
                  className="cny-button cny-button-glow"
                  style={{
                    padding: "10px 40px",
                    fontSize: "0.85rem",
                    textDecoration: "none",
                  }}
                >
                  My Order Status
                </a>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="cny-button cny-button-glow"
                  style={{
                    padding: "10px 40px",
                    fontSize: "0.85rem",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? "Placing Order..." : "Place My Order!"}
                </button>
              )}
              {!existingOrder && (
                <button
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  style={{
                    padding: "6px 20px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    fontFamily: "'Raleway', sans-serif",
                    background: "transparent",
                    color: "rgba(215, 182, 110, 0.7)",
                    border: "none",
                    cursor: "pointer",
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  ← Back
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "24px",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #910C1E 0%, #6B0A17 100%)",
              borderRadius: "24px",
              padding: "32px 28px",
              maxWidth: "360px",
              width: "100%",
              textAlign: "center",
              border: "3px solid #D7B66E",
              boxShadow: "0 0 60px rgba(215, 182, 110, 0.3)",
              animation: "popIn 0.4s ease",
            }}
          >
            {/* Animated Horse */}
            <img
              src="/cny/horse.svg"
              alt="Year of the Horse"
              className="cny-horse-animated"
              style={{
                width: "120px",
                height: "auto",
                marginBottom: "8px",
              }}
            />

            {/* Welcome message */}
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: "2rem",
                fontWeight: 700,
                color: "#D7B66E",
                fontFamily: "'Raleway', sans-serif",
              }}
            >
              {firstName}!
            </h2>

            <p
              style={{
                margin: "0 0 20px",
                fontSize: "1.1rem",
                color: "#fff",
                fontFamily: "'Raleway', sans-serif",
                lineHeight: 1.5,
              }}
            >
              You made it!<br />We're <span style={{ color: "#D7B66E", fontWeight: 700 }}>so hyped</span> you're here!
            </p>

            <p
              style={{
                margin: "0 0 24px",
                fontSize: "0.95rem",
                color: "rgba(255, 255, 255, 0.9)",
                fontFamily: "'Raleway', sans-serif",
                lineHeight: 1.5,
              }}
            >
              Build your perfect bowl and we'll have it out to you <span style={{ fontWeight: 600 }}>fresh & fast</span>!
            </p>

            {/* Important note */}
            <div
              style={{
                background: "rgba(215, 182, 110, 0.15)",
                border: "1px solid rgba(215, 182, 110, 0.4)",
                borderRadius: "12px",
                padding: "14px 16px",
                marginBottom: "24px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "#D7B66E",
                  fontFamily: "'Raleway', sans-serif",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 700 }}>Tip:</span> Find your seat first, then place your order — we make it fresh the moment you order!
              </p>
            </div>

            <button
              onClick={() => setShowWelcomeModal(false)}
              className="cny-button cny-button-glow"
              style={{
                padding: "14px 40px",
                fontSize: "1rem",
                width: "100%",
              }}
            >
              Let's Go! 🔥
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export default function CNYOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="cny-page cny-page-3">
          <AnimatedBackground theme="gold" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
            }}
          >
            <p style={{ color: "#D7B66E", fontSize: "1.2rem" }}>Loading...</p>
          </div>
        </div>
      }
    >
      <CNYOrderContent />
    </Suspense>
  );
}
