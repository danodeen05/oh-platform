"use client";
import { QRCodeSVG } from "qrcode.react";

type QRCodeProps = {
  value: string;
  size?: number;
  title?: string;
  showValue?: boolean;
};

export default function QRCode({ value, size = 200, title, showValue = true }: QRCodeProps) {
  return (
    <div style={{ textAlign: "center" }}>
      {title && (
        <div style={{ marginBottom: 12, fontWeight: "bold", fontSize: "1.1rem" }}>
          {title}
        </div>
      )}
      <div
        style={{
          background: "white",
          padding: 16,
          borderRadius: 12,
          display: "inline-block",
        }}
      >
        <QRCodeSVG value={value} size={size} level="H" />
      </div>
      {showValue && (
        <div
          style={{
            marginTop: 12,
            fontSize: "0.85rem",
            color: "#9ca3af",
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
