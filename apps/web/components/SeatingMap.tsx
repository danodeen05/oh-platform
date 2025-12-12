"use client";

import { useState } from "react";

export interface Seat {
  id: string;
  number: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  side: "left" | "bottom" | "right";
  row: number;
  col: number;
}

interface SeatingMapProps {
  seats: Seat[];
  selectedSeatId?: string | null;
  onSelectSeat: (seat: Seat) => void;
  disabled?: boolean;
}

export default function SeatingMap({
  seats,
  selectedSeatId,
  onSelectSeat,
  disabled = false,
}: SeatingMapProps) {
  // Group seats by side
  // Left: top to bottom (col ascending)
  // Bottom: left to right (col ascending)
  // Right: bottom to top (col descending) - to continue the U-shape flow
  const leftSeats = seats.filter((s) => s.side === "left").sort((a, b) => a.col - b.col);
  const bottomSeats = seats.filter((s) => s.side === "bottom").sort((a, b) => a.col - b.col);
  const rightSeats = seats.filter((s) => s.side === "right").sort((a, b) => b.col - a.col);

  const getSeatStyle = (seat: Seat) => {
    const isSelected = seat.id === selectedSeatId;
    const isAvailable = seat.status === "AVAILABLE";
    const isClickable = isAvailable && !disabled;

    let backgroundColor = "#e5e7eb"; // gray - unavailable
    let borderColor = "#d1d5db";
    let textColor = "#9ca3af";
    let cursor = "not-allowed";

    if (isAvailable) {
      backgroundColor = "#dcfce7"; // green
      borderColor = "#86efac";
      textColor = "#166534";
      cursor = disabled ? "not-allowed" : "pointer";
    }

    if (seat.status === "RESERVED") {
      backgroundColor = "#fef3c7"; // yellow
      borderColor = "#fcd34d";
      textColor = "#92400e";
    }

    if (seat.status === "CLEANING") {
      backgroundColor = "#dbeafe"; // blue
      borderColor = "#93c5fd";
      textColor = "#1e40af";
    }

    if (isSelected) {
      backgroundColor = "#7C7A67";
      borderColor = "#5c5a4f";
      textColor = "#ffffff";
    }

    return {
      width: "60px",
      height: "60px",
      borderRadius: "8px",
      border: `2px solid ${borderColor}`,
      backgroundColor,
      color: textColor,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      cursor,
      transition: "all 0.2s ease",
      fontWeight: isSelected ? "600" : "500",
      fontSize: "14px",
      opacity: disabled && !isSelected ? 0.7 : 1,
    };
  };

  const handleSeatClick = (seat: Seat) => {
    if (seat.status === "AVAILABLE" && !disabled) {
      onSelectSeat(seat);
    }
  };

  const renderSeat = (seat: Seat) => (
    <div
      key={seat.id}
      style={getSeatStyle(seat)}
      onClick={() => handleSeatClick(seat)}
      title={
        seat.status === "AVAILABLE"
          ? `Pod ${seat.number} - Available`
          : `Pod ${seat.number} - ${seat.status}`
      }
    >
      <span style={{ fontSize: "16px", fontWeight: "bold" }}>{seat.number}</span>
      {seat.status !== "AVAILABLE" && (
        <span style={{ fontSize: "10px", marginTop: "2px" }}>
          {seat.status === "RESERVED" && "Reserved"}
          {seat.status === "OCCUPIED" && "In Use"}
          {seat.status === "CLEANING" && "Cleaning"}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ padding: "20px" }}>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "20px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              backgroundColor: "#dcfce7",
              border: "2px solid #86efac",
            }}
          />
          <span style={{ fontSize: "12px", color: "#666" }}>Available</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              backgroundColor: "#7C7A67",
              border: "2px solid #5c5a4f",
            }}
          />
          <span style={{ fontSize: "12px", color: "#666" }}>Selected</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              backgroundColor: "#fef3c7",
              border: "2px solid #fcd34d",
            }}
          />
          <span style={{ fontSize: "12px", color: "#666" }}>Reserved</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              backgroundColor: "#e5e7eb",
              border: "2px solid #d1d5db",
            }}
          />
          <span style={{ fontSize: "12px", color: "#666" }}>Occupied</span>
        </div>
      </div>

      {/* U-Shape Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          maxWidth: "400px",
          margin: "0 auto",
        }}
      >
        {/* Entrance Label */}
        <div
          style={{
            fontSize: "12px",
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "8px",
          }}
        >
          Entrance
        </div>

        {/* Main Layout Container */}
        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          {/* Left Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {leftSeats.map(renderSeat)}
          </div>

          {/* Center - Kitchen */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              minWidth: "120px",
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: "12px",
                padding: "30px 20px",
                border: "2px dashed #d1d5db",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>👨‍🍳</div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Kitchen
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {rightSeats.map(renderSeat)}
          </div>
        </div>

        {/* Bottom Row */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          {bottomSeats.map(renderSeat)}
        </div>

        {/* Exit Label */}
        <div
          style={{
            fontSize: "12px",
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginTop: "8px",
          }}
        >
          Exit
        </div>
      </div>

      {/* Selection Info */}
      {selectedSeatId && (
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <span style={{ color: "#666" }}>Selected: </span>
          <span style={{ fontWeight: "600", color: "#222" }}>
            Pod {seats.find((s) => s.id === selectedSeatId)?.number}
          </span>
        </div>
      )}
    </div>
  );
}
