"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  position?: "center" | "bottom";
}

const maxWidthClasses = {
  sm: 400,
  md: 500,
  lg: 600,
  xl: 800,
  full: "100%",
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  maxWidth = "md",
  position = "center",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      dialogRef.current?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const content = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: position === "bottom" ? "flex-end" : "center",
        justifyContent: "center",
        padding: position === "bottom" ? 0 : 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
    >
      {/* Backdrop */}
      <div
        onClick={closeOnBackdrop ? onClose : undefined}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(2px)",
        }}
        aria-hidden="true"
      />

      {/* Dialog Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        style={{
          position: "relative",
          background: "white",
          borderRadius: position === "bottom" ? "24px 24px 0 0" : 16,
          width: "100%",
          maxWidth: typeof maxWidthClasses[maxWidth] === "number"
            ? maxWidthClasses[maxWidth]
            : maxWidthClasses[maxWidth],
          maxHeight: position === "bottom" ? "85vh" : "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          animation: position === "bottom"
            ? "slideUp 0.3s ease"
            : "fadeIn 0.2s ease",
        }}
      >
        <style>
          {`
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
          `}
        </style>

        {/* Header */}
        {(title || showCloseButton) && (
          <div
            style={{
              position: "sticky",
              top: 0,
              background: "white",
              padding: "20px 24px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 1,
            }}
          >
            {title && (
              <h2
                id="dialog-title"
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: "#111",
                }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#666",
                  padding: 8,
                  marginLeft: "auto",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );

  if (typeof window !== "undefined") {
    return createPortal(content, document.body);
  }

  return null;
}

// Alert Dialog - for simple messages with OK button
export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  confirmLabel?: string;
}

const typeStyles = {
  info: { icon: "ℹ️", color: "#3b82f6", bgColor: "#eff6ff" },
  success: { icon: "✓", color: "#22c55e", bgColor: "#f0fdf4" },
  warning: { icon: "⚠️", color: "#f59e0b", bgColor: "#fffbeb" },
  error: { icon: "✕", color: "#ef4444", bgColor: "#fef2f2" },
};

export function AlertDialog({
  open,
  onClose,
  title,
  message,
  type = "info",
  confirmLabel,
}: AlertDialogProps) {
  const t = useTranslations("common");
  const styles = typeStyles[type];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      showCloseButton={false}
    >
      <div style={{ textAlign: "center" }}>
        {/* Oh! Character Logo */}
        <div style={{ marginBottom: 12 }}>
          <img
            src="/Oh_Logo_Mark_Web.png"
            alt="Oh!"
            style={{
              height: 64,
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: styles.bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: type === "success" || type === "error" ? "1.25rem" : "1.5rem",
            color: styles.color,
            fontWeight: type === "success" || type === "error" ? "bold" : "normal",
          }}
        >
          {styles.icon}
        </div>

        {/* Title */}
        {title && (
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "#111",
            }}
          >
            {title}
          </h3>
        )}

        {/* Message */}
        <p
          style={{
            margin: "0 0 24px",
            color: "#666",
            fontSize: "1rem",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        {/* Confirm Button */}
        <button
          onClick={onClose}
          style={{
            padding: "12px 32px",
            background: "#7C7A67",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            minWidth: 120,
          }}
        >
          {confirmLabel || t("ok")}
        </button>
      </div>
    </Dialog>
  );
}

// Confirm Dialog - for yes/no confirmations
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: "info" | "warning" | "danger";
  loading?: boolean;
}

const confirmTypeStyles = {
  info: { confirmBg: "#7C7A67", confirmHover: "#5a584a" },
  warning: { confirmBg: "#f59e0b", confirmHover: "#d97706" },
  danger: { confirmBg: "#ef4444", confirmHover: "#dc2626" },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  type = "info",
  loading = false,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const styles = confirmTypeStyles[type];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      showCloseButton={false}
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
    >
      <div style={{ textAlign: "center" }}>
        {/* Oh! Character Logo */}
        <div style={{ marginBottom: 16 }}>
          <img
            src="/Oh_Logo_Mark_Web.png"
            alt="Oh!"
            style={{
              height: 64,
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Title */}
        {title && (
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "#111",
            }}
          >
            {title}
          </h3>
        )}

        {/* Message */}
        <p
          style={{
            margin: "0 0 24px",
            color: "#666",
            fontSize: "1rem",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "12px 24px",
              background: "white",
              color: "#374151",
              border: "2px solid #d1d5db",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              minWidth: 100,
            }}
          >
            {cancelLabel || t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "12px 24px",
              background: styles.confirmBg,
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              minWidth: 100,
            }}
          >
            {loading ? "..." : confirmLabel || t("confirm")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
