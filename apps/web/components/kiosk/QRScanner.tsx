'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

// Kiosk color system
const COLORS = {
  primary: "#7C7A67",
  surface: "#FFFFFF",
  surfaceDark: "#1a1a1a",
  textMuted: "#999999",
  textOnDark: "#FFFFFF",
};

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
  active?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * QR Scanner component for kiosk using device camera
 * Uses @zxing/library for QR code detection
 *
 * QR Code Formats:
 * - Member check-in: oh://member/{memberId}
 * - Order check-in: oh://order/{orderToken}
 */
export function QRScanner({
  onScan,
  onError,
  active = true,
  className,
  width = 320,
  height = 320,
}: QRScannerProps) {
  const t = useTranslations("kiosk");
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  // Debounced scan handler - prevents duplicate scans within 2 seconds
  const handleScan = useCallback((result: string) => {
    const now = Date.now();
    if (result === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
      return;
    }
    lastScanRef.current = result;
    lastScanTimeRef.current = now;
    onScan(result);
  }, [onScan]);

  useEffect(() => {
    if (!active || !videoRef.current) return;

    // Configure hints for QR code detection
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, 500); // 500ms between decode attempts
    readerRef.current = reader;

    // Start camera and begin scanning
    reader.decodeFromVideoDevice(
      undefined, // Use default camera (usually front-facing on Elo)
      videoRef.current,
      (result, error) => {
        if (result) {
          handleScan(result.getText());
        }
        // NotFoundException is normal during scanning - ignore it
        if (error && !(error instanceof NotFoundException)) {
          console.warn('QR scan error:', error);
        }
      }
    ).then(() => {
      setIsScanning(true);
      setHasCamera(true);
    }).catch((err) => {
      console.error('Failed to start camera:', err);
      setHasCamera(false);
      onError?.(err);
    });

    return () => {
      reader.reset();
      readerRef.current = null;
      setIsScanning(false);
    };
  }, [active, handleScan, onError]);

  return (
    <div
      className={`kiosk-qr-viewfinder ${className || ''}`}
      style={{
        width,
        height,
        background: COLORS.surfaceDark,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Video feed from camera */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        playsInline
        muted
        autoPlay
      />

      {/* Scanning overlay with viewfinder */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {/* Dark overlay around viewfinder */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
          }}
        />

        {/* Clear center viewfinder area */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: width * 0.7,
            height: height * 0.7,
            background: 'transparent',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            borderRadius: 16,
          }}
        />

        {/* Corner accents */}
        <div className="kiosk-qr-corners">
          <div className="kiosk-qr-corner kiosk-qr-corner-tl" />
          <div className="kiosk-qr-corner kiosk-qr-corner-tr" />
          <div className="kiosk-qr-corner kiosk-qr-corner-bl" />
          <div className="kiosk-qr-corner kiosk-qr-corner-br" />
        </div>

        {/* Scanning animation line */}
        {isScanning && <div className="kiosk-scan-line" />}
      </div>

      {/* Status indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        {!hasCamera ? (
          <span
            style={{
              color: '#ef4444',
              fontSize: '1rem',
              background: 'rgba(0,0,0,0.7)',
              padding: '8px 16px',
              borderRadius: 8,
            }}
          >
            {t("qrScanner.cameraNotAvailable")}
          </span>
        ) : isScanning ? (
          <span
            style={{
              color: COLORS.textOnDark,
              fontSize: '1.125rem',
              background: 'rgba(0,0,0,0.6)',
              padding: '10px 20px',
              borderRadius: 10,
            }}
          >
            {t("qrScanner.positionQR")}
          </span>
        ) : (
          <span
            style={{
              color: COLORS.textMuted,
              fontSize: '1rem',
              background: 'rgba(0,0,0,0.7)',
              padding: '8px 16px',
              borderRadius: 8,
            }}
          >
            {t("qrScanner.startingCamera")}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Parse kiosk QR code data
 * Returns structured data based on QR code format
 *
 * Supported formats:
 * - Member deep link: oh://member/{userId}
 * - Member ID (raw): Just the user ID string from wallet pass
 * - Referral deep link: oh://referral/{referralCode}
 * - Referral URL: https://...?ref={referralCode} (Member Referral QR codes)
 * - Order deep link: oh://order/{orderQrCode}
 * - Order QR code: ORDER-{loc8}-{timestamp}-{random}
 */
export function parseKioskQR(data: string): {
  type: 'member' | 'order' | 'unknown';
  id?: string;
  token?: string;
  raw: string;
} {
  // Member deep link format: oh://member/{userId}
  if (data.startsWith('oh://member/')) {
    return {
      type: 'member',
      id: data.replace('oh://member/', ''),
      raw: data,
    };
  }

  // Referral deep link format: oh://referral/{referralCode}
  // The API supports looking up by referral code, so we treat this like a member lookup
  if (data.startsWith('oh://referral/')) {
    return {
      type: 'member',
      id: data.replace('oh://referral/', ''),
      raw: data,
    };
  }

  // Member Referral URL format: https://...?ref={referralCode} or https://...?REF={referralCode}
  // Example: HTTPS://DEVWEBAPP.OHBEEF.COM/ORDER?REF=CMJRJS8GD000A146JZD60LS6B
  // These URLs contain referral codes that can be used to look up members
  try {
    const url = new URL(data);
    const refCode = url.searchParams.get('ref') || url.searchParams.get('REF');
    if (refCode) {
      return {
        type: 'member',
        id: refCode,
        raw: data,
      };
    }
  } catch {
    // Not a valid URL, continue checking other formats
  }

  // Order deep link format: oh://order/{orderQrCode}
  if (data.startsWith('oh://order/')) {
    return {
      type: 'order',
      token: data.replace('oh://order/', ''),
      raw: data,
    };
  }

  // Order QR code format: ORDER-{loc8}-{timestamp}-{random}
  // Example: ORDER-avpp161j-1765302140841-0670D9
  if (data.startsWith('ORDER-')) {
    return {
      type: 'order',
      token: data,
      raw: data,
    };
  }

  // Raw member ID or referral code from wallet pass (cuid format, typically starts with c and is ~25 chars)
  // These could be user IDs or referral codes stored directly in the wallet pass barcode
  // The API will try both user ID and referral code lookups
  if (/^c[a-z0-9]{20,30}$/.test(data)) {
    return {
      type: 'member',
      id: data,
      raw: data,
    };
  }

  return {
    type: 'unknown',
    raw: data,
  };
}

export default QRScanner;
