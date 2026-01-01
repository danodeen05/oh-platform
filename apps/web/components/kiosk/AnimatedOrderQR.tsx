"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

type AnimatedOrderQRProps = {
  locationId: string;
  size?: number;
  showVideo?: boolean;
};

const COLORS = {
  primary: "#7C7A67",
  gold: "#C7A878",
  surface: "#FFFFFF",
};

export default function AnimatedOrderQR({
  locationId,
  size = 180,
  showVideo = false,
}: AnimatedOrderQRProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate the order URL with location pre-selected
  // Use full domain: devwebapp.ohbeef.com for dev, www.ohbeef.com for prod
  const getWebBaseUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    if (apiUrl.includes("devapi.ohbeef.com")) {
      return "https://devwebapp.ohbeef.com";
    }
    // Production or default
    return "https://www.ohbeef.com";
  };
  const orderUrl = `${getWebBaseUrl()}/order/location/${locationId}`;

  // Logo size (roughly 20-25% of QR size for good scannability with level H)
  const logoSize = Math.round(size * 0.22);

  // Handle video end - pause for 12 seconds on last frame, then restart (same as kiosk page)
  const handleVideoEnded = useCallback(() => {
    pauseTimeoutRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    }, 12000); // 12 second pause on last frame
  }, []);

  // Handle video ready state and cleanup
  useEffect(() => {
    if (showVideo && videoRef.current) {
      const video = videoRef.current;
      const handleCanPlay = () => setVideoReady(true);
      video.addEventListener("canplaythrough", handleCanPlay);
      return () => {
        video.removeEventListener("canplaythrough", handleCanPlay);
        if (pauseTimeoutRef.current) {
          clearTimeout(pauseTimeoutRef.current);
        }
      };
    }
  }, [showVideo]);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated glow ring */}
      <div
        className="qr-glow-ring"
        style={{
          position: "absolute",
          inset: -8,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${COLORS.gold}40, ${COLORS.primary}40, ${COLORS.gold}40)`,
          backgroundSize: "200% 200%",
          animation: "qr-gradient-shift 3s ease-in-out infinite",
          opacity: isHovered ? 1 : 0.7,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Pulsing outer ring */}
      <div
        className="qr-pulse-ring"
        style={{
          position: "absolute",
          inset: -12,
          borderRadius: 24,
          border: `2px solid ${COLORS.gold}`,
          animation: "qr-pulse 2s ease-in-out infinite",
          opacity: 0,
        }}
      />

      {/* QR Code container with white background */}
      <div
        style={{
          position: "relative",
          background: COLORS.surface,
          borderRadius: 16,
          padding: 12,
          boxShadow: isHovered
            ? `0 8px 32px rgba(124, 122, 103, 0.4)`
            : `0 4px 16px rgba(0,0,0,0.15)`,
          transition: "box-shadow 0.3s ease, transform 0.3s ease",
          transform: isHovered ? "scale(1.02)" : "scale(1)",
        }}
      >
        {/* The QR Code with embedded logo */}
        <QRCodeSVG
          value={orderUrl}
          size={size}
          level="H" // High error correction for logo overlay
          marginSize={0}
          imageSettings={!showVideo ? {
            src: "/Oh_Logo_Mark_Web.png",
            height: logoSize,
            width: logoSize,
            excavate: true, // Clear QR modules behind logo
          } : undefined}
        />

        {/* Video overlay in center (optional) */}
        {showVideo && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: logoSize + 8,
              height: logoSize + 8,
              borderRadius: 8,
              overflow: "hidden",
              background: COLORS.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              style={{
                width: logoSize + 4,
                height: logoSize + 4,
                objectFit: "cover",
                borderRadius: 6,
                opacity: videoReady ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            >
              <source src="/kiosk-video.mp4" type="video/mp4" />
            </video>
            {/* Fallback logo while video loads */}
            {!videoReady && (
              <img
                src="/Oh_Logo_Mark_Web.png"
                alt="Oh!"
                style={{
                  position: "absolute",
                  width: logoSize,
                  height: logoSize,
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        )}

        {/* Shimmer effect across QR */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 16,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "-100%",
              width: "50%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
              animation: "qr-shimmer 3s ease-in-out infinite",
              animationDelay: "1s",
            }}
          />
        </div>
      </div>

      {/* "Scan to Order" label */}
      <div
        style={{
          position: "absolute",
          bottom: -32,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: COLORS.primary,
          background: "rgba(255,255,255,0.95)",
          padding: "5px 14px",
          borderRadius: 14,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          animation: "qr-label-bounce 2s ease-in-out infinite",
        }}
      >
        <span style={{ marginRight: 4 }}>📱</span>
        Scan to Order Online
      </div>

      {/* CSS Animations - using global style tag */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes qr-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes qr-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.5;
          }
        }

        @keyframes qr-shimmer {
          0% { left: -100%; }
          50%, 100% { left: 150%; }
        }

        @keyframes qr-label-bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }
      `}} />
    </div>
  );
}
