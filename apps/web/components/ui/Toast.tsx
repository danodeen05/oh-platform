"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { createPortal } from "react-dom";

// Toast Types
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  success: (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) => string;
  error: (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) => string;
  warning: (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) => string;
  info: (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast styling
const toastStyles: Record<ToastType, { bg: string; border: string; icon: string; iconBg: string }> = {
  success: {
    bg: "#f0fdf4",
    border: "#22c55e",
    icon: "✓",
    iconBg: "#22c55e",
  },
  error: {
    bg: "#fef2f2",
    border: "#ef4444",
    icon: "✕",
    iconBg: "#ef4444",
  },
  warning: {
    bg: "#fffbeb",
    border: "#f59e0b",
    icon: "!",
    iconBg: "#f59e0b",
  },
  info: {
    bg: "#eff6ff",
    border: "#3b82f6",
    icon: "i",
    iconBg: "#3b82f6",
  },
};

// Individual Toast Component
function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const styles = toastStyles[toast.type];

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
      }, toast.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        background: styles.bg,
        borderLeft: `4px solid ${styles.border}`,
        borderRadius: "0 8px 8px 0",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        minWidth: 300,
        maxWidth: 420,
        animation: isExiting
          ? "slideOut 0.3s ease forwards"
          : "slideIn 0.3s ease",
      }}
      role="alert"
    >
      {/* Icon */}
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: styles.iconBg,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.85rem",
          fontWeight: "bold",
          flexShrink: 0,
        }}
      >
        {styles.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.95rem",
            color: "#111",
            lineHeight: 1.5,
          }}
        >
          {toast.message}
        </p>

        {/* Action Button */}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            style={{
              marginTop: 8,
              padding: "4px 12px",
              background: "transparent",
              color: styles.border,
              border: `1px solid ${styles.border}`,
              borderRadius: 4,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "#9ca3af",
          cursor: "pointer",
          padding: 4,
          fontSize: "1rem",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// Toast Container Component
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  const content = (
    <div
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        pointerEvents: "none",
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );

  if (typeof window !== "undefined") {
    return createPortal(content, document.body);
  }

  return null;
}

// Toast Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) =>
      addToast({ message, type: "success", ...options }),
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) =>
      addToast({ message, type: "error", ...options }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) =>
      addToast({ message, type: "warning", ...options }),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "message" | "type">>) =>
      addToast({ message, type: "info", ...options }),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// Custom hook to use toasts
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
