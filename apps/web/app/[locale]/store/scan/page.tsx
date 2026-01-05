"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";

export default function ScanPage() {
  const router = useRouter();
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");

  // Start camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setScanning(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setHasCamera(false);
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            setCameraError("Camera permission denied. Please allow camera access to scan QR codes.");
          } else if (err.name === "NotFoundError") {
            setCameraError("No camera found on this device.");
          } else {
            setCameraError("Unable to access camera. Please enter the code manually.");
          }
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // QR code scanning using canvas
  // Note: In production, you'd use a library like @zxing/browser or jsQR
  // For now, we'll use manual entry as the primary method
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      router.push(`/${locale}/store/item/${manualCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div style={{ background: "#222", minHeight: "100vh", color: "white" }}>
      {/* Header */}
      <div style={{ padding: "80px 24px 24px" }}>
        <div style={{ maxWidth: "500px", margin: "0 auto" }}>
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
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
              fontWeight: "300",
              letterSpacing: "1px",
              marginBottom: "12px",
            }}
          >
            In-Store Shopping
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.95rem" }}>
            Scan a product QR code or enter the code manually to view and purchase items in-store.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "500px", margin: "0 auto", padding: "0 24px 80px" }}>
        {/* Camera View */}
        {hasCamera && (
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: "20px",
              overflow: "hidden",
              marginBottom: "32px",
              background: "#333",
            }}
          >
            <video
              ref={videoRef}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              playsInline
              muted
            />

            {/* Scanning overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: "60%",
                  aspectRatio: "1 / 1",
                  border: "3px solid white",
                  borderRadius: "16px",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                }}
              />
            </div>

            {/* Scanning indicator */}
            {scanning && (
              <div
                style={{
                  position: "absolute",
                  bottom: "16px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.7)",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.85rem",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#22c55e",
                    animation: "pulse 1.5s infinite",
                  }}
                />
                Scanning...
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        )}

        {/* Camera Error */}
        {cameraError && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "24px",
              color: "#fca5a5",
              fontSize: "0.9rem",
            }}
          >
            {cameraError}
          </div>
        )}

        {/* Manual Entry */}
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", fontWeight: "500", marginBottom: "16px" }}>
            {hasCamera ? "Or enter code manually" : "Enter product code"}
          </h2>

          <form onSubmit={handleManualSubmit}>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="OH-PROD-001"
                style={{
                  flex: 1,
                  padding: "16px",
                  background: "rgba(255,255,255,0.1)",
                  border: "2px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                  color: "white",
                  fontSize: "1rem",
                  outline: "none",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                style={{
                  padding: "16px 24px",
                  background: manualCode.trim() ? "#7C7A67" : "rgba(255,255,255,0.1)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: manualCode.trim() ? "pointer" : "not-allowed",
                }}
              >
                Go
              </button>
            </div>
          </form>

          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginTop: "12px" }}>
            The product code is printed on the price tag next to the item.
          </p>
        </div>

        {/* Features */}
        <div style={{ marginTop: "40px" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: "500", marginBottom: "20px", color: "rgba(255,255,255,0.9)" }}>
            In-Store Benefits
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(199, 168, 120, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: "500", marginBottom: "4px" }}>Skip the line</p>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                  Purchase instantly without waiting at the register.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(199, 168, 120, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: "500", marginBottom: "4px" }}>Use your credits</p>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                  Sign in to apply your Oh! credits (no limit for store purchases).
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(199, 168, 120, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C7A878" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: "500", marginBottom: "4px" }}>Instant pickup</p>
                <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                  Grab your item and go! Show your receipt at the door.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
