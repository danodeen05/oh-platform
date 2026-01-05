'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  KioskPrinterService,
  QRSlipData,
  PrinterStatus,
  getKioskPrinter,
  getDefaultPrinterConfig,
} from '@/lib/kiosk/printer-service';

interface KioskPrinterContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  status: PrinterStatus | null;
  error: string | null;

  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => void;
  printQRSlip: (data: QRSlipData) => Promise<boolean>;
  testPrint: () => Promise<boolean>;
}

const KioskPrinterContext = createContext<KioskPrinterContextValue | null>(null);

interface KioskPrinterProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  onPrintSuccess?: (data: QRSlipData) => void;
  onPrintError?: (error: string, data: QRSlipData) => void;
}

export function KioskPrinterProvider({
  children,
  autoConnect = true,
  onPrintSuccess,
  onPrintError,
}: KioskPrinterProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const printerService = getKioskPrinter();

  // Connect to printer
  const connect = useCallback(async () => {
    const config = getDefaultPrinterConfig();
    if (!config) {
      const errorMsg = 'Printer not configured. Set NEXT_PUBLIC_KIOSK_PRINTER_IP in environment.';
      console.warn('[KioskPrinter]', errorMsg);
      setError(errorMsg);
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const success = await printerService.connect(config);
      setIsConnected(success);

      if (success) {
        const printerStatus = await printerService.getStatus();
        setStatus(printerStatus);
        console.log('[KioskPrinter] Connected to printer at', config.ipAddress);
      } else {
        setError('Failed to connect to printer');
      }

      return success;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setIsConnected(false);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [printerService]);

  // Disconnect from printer
  const disconnect = useCallback(() => {
    printerService.disconnect();
    setIsConnected(false);
    setStatus(null);
    console.log('[KioskPrinter] Disconnected');
  }, [printerService]);

  // Print QR slip
  const printQRSlip = useCallback(async (data: QRSlipData): Promise<boolean> => {
    if (!isConnected) {
      // Try to reconnect
      const reconnected = await connect();
      if (!reconnected) {
        const errorMsg = 'Printer not connected';
        onPrintError?.(errorMsg, data);
        return false;
      }
    }

    try {
      const success = await printerService.printQRSlip(data);

      if (success) {
        onPrintSuccess?.(data);
        console.log('[KioskPrinter] Printed QR slip for', data.guestName);
      } else {
        const errorMsg = 'Print failed';
        onPrintError?.(errorMsg, data);
      }

      return success;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Print error';
      onPrintError?.(errorMsg, data);
      return false;
    }
  }, [isConnected, connect, printerService, onPrintSuccess, onPrintError]);

  // Test print
  const testPrint = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      const reconnected = await connect();
      if (!reconnected) return false;
    }

    return printerService.testPrint();
  }, [isConnected, connect, printerService]);

  // Auto-connect on mount if configured
  useEffect(() => {
    if (autoConnect) {
      const config = getDefaultPrinterConfig();
      if (config) {
        connect();
      }
    }

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount - keep connection alive for the session
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <KioskPrinterContext.Provider
      value={{
        isConnected,
        isConnecting,
        status,
        error,
        connect,
        disconnect,
        printQRSlip,
        testPrint,
      }}
    >
      {children}
    </KioskPrinterContext.Provider>
  );
}

/**
 * Hook to access kiosk printer functionality
 */
export function useKioskPrinter(): KioskPrinterContextValue {
  const context = useContext(KioskPrinterContext);

  if (!context) {
    // Return a no-op implementation when used outside provider
    // This allows graceful degradation when printer is not configured
    return {
      isConnected: false,
      isConnecting: false,
      status: null,
      error: 'KioskPrinterProvider not found',
      connect: async () => false,
      disconnect: () => {},
      printQRSlip: async () => {
        console.warn('[KioskPrinter] Provider not found, skipping print');
        return false;
      },
      testPrint: async () => false,
    };
  }

  return context;
}

/**
 * Component to show printer status (for debugging/admin)
 */
export function PrinterStatusIndicator() {
  const { isConnected, isConnecting, error } = useKioskPrinter();

  if (isConnecting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b' }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#f59e0b',
          animation: 'pulse 1s infinite',
        }} />
        <span style={{ fontSize: '0.75rem' }}>Connecting...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ef4444',
        }} />
        <span style={{ fontSize: '0.75rem' }}>Printer Error</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e' }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#22c55e',
        }} />
        <span style={{ fontSize: '0.75rem' }}>Printer Ready</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af' }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#9ca3af',
      }} />
      <span style={{ fontSize: '0.75rem' }}>Printer Offline</span>
    </div>
  );
}
