"use client";

import { useState, useEffect } from "react";
import { POD_COLORS } from "@/lib/pod-selection/constants";

export interface Seat {
  id: string;
  number: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  side: "left" | "bottom" | "right";
  row: number;
  col: number;
  podType?: "SINGLE" | "DUAL";
  dualPartnerId?: string | null;
}

interface SeatingMapLabels {
  available?: string;
  selected?: string;
  reserved?: string;
  occupied?: string;
  dualPod?: string;
  entrance?: string;
  kitchen?: string;
  exit?: string;
  dual?: string;
  selectedPrefix?: string;
  pod?: string;
  cleaning?: string;
}

interface SeatingMapProps {
  seats: Seat[];
  selectedSeatId?: string | null;
  onSelectSeat: (seat: Seat) => void;
  disabled?: boolean;
  groupSize?: number;
  hostPaysAll?: boolean;
  labels?: SeatingMapLabels;
  locationId?: string;
}

// Hook to get responsive pod size
function useResponsivePodSize() {
  const [size, setSize] = useState(48);

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width >= 1024) setSize(64);
      else if (width >= 640) setSize(56);
      else setSize(48);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return size;
}

export default function SeatingMap({
  seats,
  selectedSeatId,
  onSelectSeat,
  disabled = false,
  groupSize = 1,
  hostPaysAll = false,
  labels = {},
  locationId,
}: SeatingMapProps) {
  const podSize = useResponsivePodSize();
  const gap = podSize >= 64 ? 10 : podSize >= 56 ? 8 : 6;

  // Default labels with fallbacks
  const l = {
    available: labels.available || "Available",
    selected: labels.selected || "Selected",
    reserved: labels.reserved || "Reserved",
    occupied: labels.occupied || "Occupied",
    dualPod: labels.dualPod || "Dual Pod",
    entrance: labels.entrance || "ENTRANCE",
    kitchen: labels.kitchen || "KITCHEN",
    exit: labels.exit || "EXIT",
    dual: labels.dual || "Dual",
    selectedPrefix: labels.selectedPrefix || "Selected:",
    pod: labels.pod || "Pod",
    cleaning: labels.cleaning || "Cleaning",
  };

  const isDualPod = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return true;
    return seats.some((s) => s.dualPartnerId === seat.id);
  };

  const getPartner = (seat: Seat) => {
    if (seat.dualPartnerId) {
      return seats.find((s) => s.id === seat.dualPartnerId);
    }
    return seats.find((s) => s.dualPartnerId === seat.id);
  };

  const canSelectDualPod = groupSize >= 2 && hostPaysAll;

  const shouldHideSeat = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    if (seat.dualPartnerId) return false;
    return seats.some((s) => s.dualPartnerId === seat.id);
  };

  // Group seats by side
  const leftSeats = seats
    .filter((s) => s.side === "left")
    .sort((a, b) => a.col - b.col);
  const bottomSeats = seats
    .filter((s) => s.side === "bottom")
    .sort((a, b) => a.col - b.col);
  const rightSeats = seats
    .filter((s) => s.side === "right")
    .sort((a, b) => b.col - a.col);

  const getPodStyle = (seat: Seat, isDual: boolean = false) => {
    const isSelected =
      seat.id === selectedSeatId ||
      (isDual && getPartner(seat)?.id === selectedSeatId);
    const isAvailable = seat.status === "AVAILABLE";
    const partner = isDual ? getPartner(seat) : null;
    const partnerAvailable = partner ? partner.status === "AVAILABLE" : true;
    const bothAvailable = isAvailable && partnerAvailable;
    const canClick = bothAvailable && !disabled && (!isDual || canSelectDualPod);

    // Determine orientation
    const isBottomDual = isDual && seat.side === "bottom";

    // Color logic matching kiosk design
    let bgColor = POD_COLORS.occupied;
    let textColor = "rgba(255,255,255,0.7)";

    if (bothAvailable) {
      if (isDual) {
        if (canSelectDualPod) {
          bgColor = POD_COLORS.dualPod;
          textColor = "#ffffff";
        } else {
          bgColor = POD_COLORS.unavailableDual;
          textColor = "rgba(255,255,255,0.7)";
        }
      } else {
        bgColor = POD_COLORS.available;
        textColor = "#ffffff";
      }
    }

    if (seat.status === "CLEANING" || (partner && partner.status === "CLEANING")) {
      bgColor = POD_COLORS.cleaning;
      textColor = "#ffffff";
    }

    if (isSelected) {
      bgColor = POD_COLORS.selected;
      textColor = "#ffffff";
    }

    return {
      width: isDual ? (isBottomDual ? podSize * 2 + gap : podSize) : podSize,
      height: isDual ? (isBottomDual ? podSize : podSize * 2 + gap) : podSize,
      borderRadius: 12,
      border: isSelected ? `3px solid #1a1a1a` : "none",
      backgroundColor: bgColor,
      color: textColor,
      display: "flex",
      flexDirection: isBottomDual ? "row" as const : "column" as const,
      alignItems: "center",
      justifyContent: "center",
      cursor: canClick ? "pointer" : "not-allowed",
      transition: "all 0.2s",
      fontWeight: 700,
      fontSize: podSize >= 64 ? 18 : podSize >= 56 ? 16 : 14,
      gap: isDual ? (podSize >= 64 ? 6 : 4) : 0,
      opacity: disabled && !isSelected ? 0.6 : 1,
      boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
    };
  };

  const handleSeatClick = (seat: Seat) => {
    const isDual = isDualPod(seat);
    const partner = isDual ? getPartner(seat) : null;
    const bothAvailable =
      seat.status === "AVAILABLE" && (!partner || partner.status === "AVAILABLE");

    if (!bothAvailable || disabled) return;
    if (isDual && !canSelectDualPod) return;

    onSelectSeat(seat);
  };

  const renderSeat = (seat: Seat) => {
    const isDual = isDualPod(seat);
    const partner = isDual ? getPartner(seat) : null;

    if (shouldHideSeat(seat)) {
      return null;
    }

    let title = `Pod ${seat.number}`;
    if (isDual && partner) {
      title = `Dual Pod ${seat.number} & ${partner.number}`;
    }

    const bothAvailable =
      seat.status === "AVAILABLE" && (!partner || partner.status === "AVAILABLE");
    if (bothAvailable) {
      if (isDual && !canSelectDualPod) {
        title += " - Dual Pod (requires group of 2+ with shared payment)";
      } else {
        title += " - Available";
      }
    } else {
      const status = seat.status !== "AVAILABLE" ? seat.status : partner?.status;
      title += ` - ${status}`;
    }

    const isBottomRow = seat.side === "bottom";
    const isRightSide = seat.side === "right";

    return (
      <button
        key={seat.id}
        style={getPodStyle(seat, isDual) as React.CSSProperties}
        onClick={() => handleSeatClick(seat)}
        title={title}
        disabled={disabled || (!bothAvailable && seat.id !== selectedSeatId)}
        type="button"
      >
        {isDual && partner ? (
          (() => {
            const seatNum = parseInt(seat.number);
            const partnerNum = parseInt(partner.number);

            let firstNum: string, secondNum: string;
            if (isBottomRow) {
              firstNum = seatNum < partnerNum ? seat.number : partner.number;
              secondNum = seatNum < partnerNum ? partner.number : seat.number;
            } else if (isRightSide) {
              firstNum = seatNum > partnerNum ? seat.number : partner.number;
              secondNum = seatNum > partnerNum ? partner.number : seat.number;
            } else {
              firstNum = seatNum < partnerNum ? seat.number : partner.number;
              secondNum = seatNum < partnerNum ? partner.number : seat.number;
            }

            return (
              <>
                <span style={{ fontWeight: "bold" }}>{firstNum}</span>
                <span
                  style={{
                    fontSize: podSize >= 64 ? 10 : 8,
                    opacity: 0.8,
                  }}
                >
                  {l.dual}
                </span>
                <span style={{ fontWeight: "bold" }}>{secondNum}</span>
              </>
            );
          })()
        ) : (
          <span style={{ fontWeight: "bold" }}>{seat.number}</span>
        )}
      </button>
    );
  };

  // Kitchen center size
  const kitchenSize = podSize >= 64 ? 80 : podSize >= 56 ? 70 : 60;

  return (
    <div style={{ padding: podSize >= 64 ? 24 : 16 }}>
      {/* Store Floor Plan Container */}
      <div
        style={{
          position: "relative",
          padding: podSize >= 64 ? "32px 40px" : podSize >= 56 ? "24px 32px" : "20px 24px",
          background: POD_COLORS.background,
          border: `4px solid ${POD_COLORS.border}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Entrance Opening */}
        <div
          style={{
            position: "absolute",
            top: -4,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#f9fafb",
            padding: "0 16px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: 1,
              fontWeight: 600,
            }}
          >
            {l.entrance}
          </span>
        </div>

        {/* Main U-Shape Layout */}
        <div
          style={{
            display: "flex",
            gap: gap * 2,
            marginTop: 8,
          }}
        >
          {/* Left Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap,
            }}
          >
            {leftSeats.map(renderSeat)}
          </div>

          {/* Kitchen Center */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              minWidth: kitchenSize + 40,
              padding: 16,
            }}
          >
            <div
              style={{
                width: kitchenSize,
                height: kitchenSize,
                borderRadius: "50%",
                border: `3px solid ${POD_COLORS.border}`,
                background: POD_COLORS.kitchenBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Oh_Logo_Mark_Web.png"
                alt="Oh! Kitchen"
                width={kitchenSize - 20}
                height={kitchenSize - 20}
                style={{
                  objectFit: "contain",
                  animation: "gentle-pulse 3s ease-in-out infinite",
                }}
              />
            </div>
            <span
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: 1,
                fontWeight: 600,
              }}
            >
              {l.kitchen}
            </span>
          </div>

          {/* Right Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap,
            }}
          >
            {rightSeats.map(renderSeat)}
          </div>
        </div>

        {/* Bottom Row */}
        <div
          style={{
            display: "flex",
            gap,
            marginTop: gap * 2,
          }}
        >
          {bottomSeats.map(renderSeat)}
        </div>

        {/* Exit Opening */}
        <div
          style={{
            position: "absolute",
            bottom: -4,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#f9fafb",
            padding: "0 16px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: 1,
              fontWeight: 600,
            }}
          >
            {l.exit}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 20,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: POD_COLORS.available,
            }}
          />
          <span style={{ fontSize: 12, color: "#666" }}>{l.available}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 16,
              height: 24,
              borderRadius: 4,
              backgroundColor: POD_COLORS.dualPod,
            }}
          />
          <span style={{ fontSize: 12, color: "#666" }}>{l.dualPod}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: POD_COLORS.cleaning,
            }}
          />
          <span style={{ fontSize: 12, color: "#666" }}>{l.cleaning}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: POD_COLORS.occupied,
            }}
          />
          <span style={{ fontSize: 12, color: "#666" }}>{l.occupied}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: POD_COLORS.selected,
              border: "2px solid #1a1a1a",
            }}
          />
          <span style={{ fontSize: 12, color: "#666" }}>{l.selected}</span>
        </div>
      </div>

      {/* Selection Info */}
      {selectedSeatId && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            backgroundColor: "rgba(124, 122, 103, 0.1)",
            borderRadius: 12,
            textAlign: "center",
            border: `1px solid ${POD_COLORS.borderLight}`,
          }}
        >
          <span style={{ color: "#666" }}>{l.selectedPrefix} </span>
          <span style={{ fontWeight: 600, color: "#222" }}>
            {(() => {
              const selectedSeat = seats.find((s) => s.id === selectedSeatId);
              if (!selectedSeat) return "";
              if (isDualPod(selectedSeat)) {
                const partner = getPartner(selectedSeat);
                if (partner) {
                  const num1 = parseInt(selectedSeat.number);
                  const num2 = parseInt(partner.number);
                  return `${l.dualPod} ${Math.min(num1, num2).toString().padStart(2, "0")} & ${Math.max(num1, num2).toString().padStart(2, "0")}`;
                }
              }
              return `${l.pod} ${selectedSeat.number}`;
            })()}
          </span>
        </div>
      )}

      {/* CSS Animation - using dangerouslySetInnerHTML to avoid styled-jsx TS issues */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes gentle-pulse {
              0%, 100% {
                transform: scale(1);
                opacity: 0.9;
              }
              50% {
                transform: scale(1.05);
                opacity: 1;
              }
            }
          `,
        }}
      />
    </div>
  );
}
