"use client";

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
  selectedPrefix?: string; // "Selected:" prefix text
  pod?: string; // "Pod" label for selection info
}

interface SeatingMapProps {
  seats: Seat[];
  selectedSeatId?: string | null;
  onSelectSeat: (seat: Seat) => void;
  disabled?: boolean;
  groupSize?: number; // Number of people in the order/group - determines if dual pods are selectable
  labels?: SeatingMapLabels; // Translated labels
}

export default function SeatingMap({
  seats,
  selectedSeatId,
  onSelectSeat,
  disabled = false,
  groupSize = 1,
  labels = {},
}: SeatingMapProps) {
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
  };
  // Helper to check if a seat is part of a dual pod (either it points to a partner, or another seat points to it)
  const isDualPod = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    // Check if this seat has a partner reference
    if (seat.dualPartnerId) return true;
    // Check if another seat points to this one
    return seats.some(s => s.dualPartnerId === seat.id);
  };

  // Helper to get partner seat (works both directions)
  const getPartner = (seat: Seat) => {
    // If this seat has a partner reference, use it
    if (seat.dualPartnerId) {
      return seats.find(s => s.id === seat.dualPartnerId);
    }
    // Otherwise, find the seat that points to this one
    return seats.find(s => s.dualPartnerId === seat.id);
  };

  // For dual pods, check if the dual pod can be selected (groupSize must be 2)
  const canSelectDualPod = groupSize === 2;

  // Check if a seat should be hidden (it's the secondary seat of a dual pod pair)
  // The secondary seat is the one that does NOT have the dualPartnerId set (it's pointed TO)
  const shouldHideSeat = (seat: Seat) => {
    if (seat.podType !== "DUAL") return false;
    // If this seat has the dualPartnerId, it's the primary - don't hide it
    if (seat.dualPartnerId) return false;
    // If another seat points to this one, this is the secondary - hide it
    return seats.some(s => s.dualPartnerId === seat.id);
  };

  // Group seats by side
  // Left: top to bottom (col ascending)
  // Bottom: left to right (col ascending)
  // Right: bottom to top (col descending) - to continue the U-shape flow
  const leftSeats = seats.filter((s) => s.side === "left").sort((a, b) => a.col - b.col);
  const bottomSeats = seats.filter((s) => s.side === "bottom").sort((a, b) => a.col - b.col);
  const rightSeats = seats.filter((s) => s.side === "right").sort((a, b) => b.col - a.col);

  const getSeatStyle = (seat: Seat, isDual: boolean = false) => {
    const isSelected = seat.id === selectedSeatId || (isDual && getPartner(seat)?.id === selectedSeatId);
    const isAvailable = seat.status === "AVAILABLE";
    const partner = isDual ? getPartner(seat) : null;
    const partnerAvailable = partner ? partner.status === "AVAILABLE" : true;
    const bothAvailable = isAvailable && partnerAvailable;

    // For dual pods: only clickable if groupSize is 2
    // For single pods: clickable as normal
    const canClick = bothAvailable && !disabled && (!isDual || canSelectDualPod);

    let backgroundColor = "#e5e7eb"; // gray - unavailable
    let borderColor = "#d1d5db";
    let textColor = "#9ca3af";
    let cursor = "not-allowed";

    if (bothAvailable) {
      if (isDual) {
        // Dual pod available styling - cyan/teal theme
        if (canSelectDualPod) {
          backgroundColor = "#cffafe"; // cyan-100
          borderColor = "#22d3ee"; // cyan-400
          textColor = "#0e7490"; // cyan-700
          cursor = disabled ? "not-allowed" : "pointer";
        } else {
          // Dual pod not selectable (wrong group size) - dimmed cyan
          backgroundColor = "#ecfeff"; // cyan-50
          borderColor = "#a5f3fc"; // cyan-200
          textColor = "#0891b2"; // cyan-600
          cursor = "not-allowed";
        }
      } else {
        // Regular single pod available styling - green
        backgroundColor = "#dcfce7"; // green
        borderColor = "#86efac";
        textColor = "#166534";
        cursor = disabled ? "not-allowed" : "pointer";
      }
    }

    if (seat.status === "RESERVED" || (partner && partner.status === "RESERVED")) {
      backgroundColor = "#fef3c7"; // yellow
      borderColor = "#fcd34d";
      textColor = "#92400e";
    }

    if (seat.status === "CLEANING" || (partner && partner.status === "CLEANING")) {
      backgroundColor = "#dbeafe"; // blue
      borderColor = "#93c5fd";
      textColor = "#1e40af";
    }

    if (isSelected) {
      backgroundColor = "#7C7A67";
      borderColor = "#5c5a4f";
      textColor = "#ffffff";
    }

    // Bottom dual pods should be horizontal, left/right dual pods should be vertical
    const isBottomDual = isDual && seat.side === "bottom";

    return {
      position: "relative" as const,
      width: isDual ? (isBottomDual ? "120px" : "60px") : "60px",
      height: isDual ? (isBottomDual ? "60px" : "120px") : "60px",
      borderRadius: "8px",
      border: `2px solid ${borderColor}`,
      backgroundColor,
      color: textColor,
      display: "flex",
      flexDirection: (isBottomDual ? "row" : "column") as const,
      alignItems: "center",
      justifyContent: "center",
      cursor,
      transition: "all 0.2s ease",
      fontWeight: isSelected ? "600" : "500",
      fontSize: "14px",
      opacity: disabled && !isSelected ? 0.7 : 1,
      gap: isBottomDual ? "8px" : undefined,
    };
  };

  const handleSeatClick = (seat: Seat) => {
    const isDual = isDualPod(seat);
    const partner = isDual ? getPartner(seat) : null;
    const bothAvailable = seat.status === "AVAILABLE" && (!partner || partner.status === "AVAILABLE");

    if (!bothAvailable || disabled) return;

    // For dual pods, only allow selection if groupSize is 2
    if (isDual && !canSelectDualPod) return;

    onSelectSeat(seat);
  };

  const renderSeat = (seat: Seat) => {
    const isDual = isDualPod(seat);
    const partner = isDual ? getPartner(seat) : null;

    // Skip rendering the secondary seat of a dual pod (it's merged into the primary)
    if (shouldHideSeat(seat)) {
      return null;
    }

    // Generate title based on status and type
    let title = `Pod ${seat.number}`;
    if (isDual && partner) {
      title = `Dual Pod ${seat.number} & ${partner.number}`;
    }

    const bothAvailable = seat.status === "AVAILABLE" && (!partner || partner.status === "AVAILABLE");
    if (bothAvailable) {
      if (isDual && !canSelectDualPod) {
        title += " - Dual Pod (requires 2 guests)";
      } else {
        title += " - Available";
      }
    } else {
      const status = seat.status !== "AVAILABLE" ? seat.status : partner?.status;
      title += ` - ${status}`;
    }

    return (
      <div
        key={seat.id}
        style={getSeatStyle(seat, isDual)}
        onClick={() => handleSeatClick(seat)}
        title={title}
      >
        {isDual && partner ? (
          // Combined dual pod display
          // Bottom row: horizontal (left to right), Side columns: vertical
          (() => {
            const seatNum = parseInt(seat.number);
            const partnerNum = parseInt(partner.number);
            const isBottomRow = seat.side === "bottom";
            const isRightSide = seat.side === "right";

            // For bottom row (horizontal): lower number on left
            // For right side (vertical): higher number on top
            // For left side (vertical): lower number on top
            let firstNum: string, secondNum: string;
            if (isBottomRow) {
              // Horizontal: lower number on left
              firstNum = seatNum < partnerNum ? seat.number : partner.number;
              secondNum = seatNum < partnerNum ? partner.number : seat.number;
            } else if (isRightSide) {
              // Vertical: higher number on top
              firstNum = seatNum > partnerNum ? seat.number : partner.number;
              secondNum = seatNum > partnerNum ? partner.number : seat.number;
            } else {
              // Left side vertical: lower number on top
              firstNum = seatNum < partnerNum ? seat.number : partner.number;
              secondNum = seatNum < partnerNum ? partner.number : seat.number;
            }

            return (
              <>
                <span style={{ fontSize: "16px", fontWeight: "bold" }}>{firstNum}</span>
                <span style={{ fontSize: "9px", margin: isBottomRow ? "0 4px" : "4px 0" }}>{l.dual}</span>
                <span style={{ fontSize: "16px", fontWeight: "bold" }}>{secondNum}</span>
                {!bothAvailable && (
                  <span style={{ fontSize: "9px", marginTop: isBottomRow ? "0" : "4px", marginLeft: isBottomRow ? "4px" : "0" }}>
                    {seat.status === "RESERVED" || partner.status === "RESERVED" ? "Reserved" : ""}
                    {seat.status === "OCCUPIED" || partner.status === "OCCUPIED" ? "In Use" : ""}
                    {seat.status === "CLEANING" || partner.status === "CLEANING" ? "Cleaning" : ""}
                  </span>
                )}
              </>
            );
          })()
        ) : (
          // Regular single pod display
          <>
            <span style={{ fontSize: "16px", fontWeight: "bold" }}>{seat.number}</span>
            {seat.status !== "AVAILABLE" && (
              <span style={{ fontSize: "10px", marginTop: "2px" }}>
                {seat.status === "RESERVED" && "Reserved"}
                {seat.status === "OCCUPIED" && "In Use"}
                {seat.status === "CLEANING" && "Cleaning"}
              </span>
            )}
          </>
        )}
      </div>
    );
  };

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
          <span style={{ fontSize: "12px", color: "#666" }}>{l.available}</span>
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
          <span style={{ fontSize: "12px", color: "#666" }}>{l.selected}</span>
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
          <span style={{ fontSize: "12px", color: "#666" }}>{l.reserved}</span>
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
          <span style={{ fontSize: "12px", color: "#666" }}>{l.occupied}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "16px",
              height: "32px",
              borderRadius: "4px",
              backgroundColor: "#cffafe",
              border: "2px solid #22d3ee",
            }}
          />
          <span style={{ fontSize: "12px", color: "#666" }}>{l.dualPod}</span>
        </div>
      </div>

      {/* U-Shape Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          maxWidth: "500px",
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
          {l.entrance}
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
                {l.kitchen}
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
          {l.exit}
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
          <span style={{ color: "#666" }}>{l.selectedPrefix} </span>
          <span style={{ fontWeight: "600", color: "#222" }}>
            {(() => {
              const selectedSeat = seats.find((s) => s.id === selectedSeatId);
              if (!selectedSeat) return "";
              if (isDualPod(selectedSeat)) {
                const partner = getPartner(selectedSeat);
                if (partner) {
                  const num1 = parseInt(selectedSeat.number);
                  const num2 = parseInt(partner.number);
                  return `${l.dualPod} ${Math.min(num1, num2).toString().padStart(2, '0')} & ${Math.max(num1, num2).toString().padStart(2, '0')}`;
                }
              }
              return `${l.pod} ${selectedSeat.number}`;
            })()}
          </span>
        </div>
      )}
    </div>
  );
}
