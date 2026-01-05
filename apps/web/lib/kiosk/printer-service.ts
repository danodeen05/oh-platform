/**
 * Kiosk Printer Service for Epson TM-M30III
 *
 * Uses Epson ePOS SDK for direct WebSocket communication with the thermal printer.
 *
 * Setup Requirements:
 * 1. Connect TM-M30III to same network as kiosk
 * 2. Configure static IP on printer (via Epson utility)
 * 3. Enable ePOS-Print service on printer (default port 8008)
 * 4. Set NEXT_PUBLIC_KIOSK_PRINTER_IP in .env
 *
 * Documentation: https://reference.epson-biz.com/modules/ref_epos_sdk_js_en/index.php
 */

export interface PrinterConfig {
  ipAddress: string;
  port?: number;  // Default 8008 for ePOS
  timeout?: number;  // Connection timeout in ms
}

export interface QRSlipData {
  guestName: string;
  dailyOrderNumber: string;  // e.g., "042"
  qrCodeUrl: string;         // Full URL for order status
  podNumber?: string;        // e.g., "7"
  queuePosition?: number;    // e.g., 3
  estimatedWaitMinutes?: number;
}

export interface PrinterStatus {
  connected: boolean;
  online: boolean;
  paperStatus: 'ok' | 'near_end' | 'empty' | 'unknown';
  coverOpen: boolean;
  error: string | null;
}

// Epson ePOS SDK types (loaded from CDN)
declare global {
  interface Window {
    epson: {
      ePOSDevice: new () => EPOSDevice;
    };
  }
}

interface EPOSDevice {
  connect(ip: string, port: number, callback: (result: string) => void): void;
  disconnect(): void;
  createDevice(
    deviceId: string,
    type: number,
    options: { crypto: boolean; buffer: boolean },
    callback: (device: EPOSPrinter | null, code: string) => void
  ): void;
  deleteDevice(device: EPOSPrinter, callback: (code: string) => void): void;
}

interface EPOSPrinter {
  addTextAlign(align: number): void;
  addTextSize(width: number, height: number): void;
  addTextStyle(reverse: boolean, ul: boolean, em: boolean, color: number): void;
  addText(text: string): void;
  addFeedLine(lines: number): void;
  addSymbol(data: string, type: number, level: number, width: number, height: number, size: number): void;
  addCut(type: number): void;
  send(): void;
  onreceive: ((res: { success: boolean; code: string; status: number }) => void) | null;
  onerror: ((err: { status: number; responseText: string }) => void) | null;
}

// Constants for ePOS SDK
const EPOS_CONSTANTS = {
  DEVICE_TYPE_PRINTER: 1,
  ALIGN_LEFT: 0,
  ALIGN_CENTER: 1,
  ALIGN_RIGHT: 2,
  SYMBOL_QRCODE_MODEL_2: 49,
  LEVEL_Q: 81,  // 25% error correction
  CUT_FEED: 65,
};

export class KioskPrinterService {
  private eposDevice: EPOSDevice | null = null;
  private printer: EPOSPrinter | null = null;
  private connected: boolean = false;
  private config: PrinterConfig | null = null;

  /**
   * Check if Epson ePOS SDK is loaded
   */
  private isSDKLoaded(): boolean {
    return typeof window !== 'undefined' && window.epson?.ePOSDevice !== undefined;
  }

  /**
   * Load Epson ePOS SDK from CDN if not already loaded
   */
  async loadSDK(): Promise<boolean> {
    if (this.isSDKLoaded()) return true;

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.epson.com/epos-print/epos-2.27.0.js';
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.error('[Printer] Failed to load Epson ePOS SDK');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Connect to the printer
   */
  async connect(config: PrinterConfig): Promise<boolean> {
    this.config = config;
    const port = config.port || 8008;

    // Load SDK if needed
    if (!await this.loadSDK()) {
      console.error('[Printer] SDK not available');
      return false;
    }

    return new Promise((resolve) => {
      try {
        this.eposDevice = new window.epson.ePOSDevice();

        this.eposDevice.connect(config.ipAddress, port, (result: string) => {
          if (result === 'OK' || result === 'SSL_CONNECT_OK') {
            console.log('[Printer] Connected to device');

            // Create printer object
            this.eposDevice?.createDevice(
              'local_printer',
              EPOS_CONSTANTS.DEVICE_TYPE_PRINTER,
              { crypto: false, buffer: false },
              (device, code) => {
                if (code === 'OK' && device) {
                  this.printer = device;
                  this.connected = true;
                  console.log('[Printer] Printer device created');
                  resolve(true);
                } else {
                  console.error('[Printer] Failed to create device:', code);
                  resolve(false);
                }
              }
            );
          } else {
            console.error('[Printer] Connection failed:', result);
            resolve(false);
          }
        });
      } catch (err) {
        console.error('[Printer] Connection error:', err);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from the printer
   */
  disconnect(): void {
    if (this.printer && this.eposDevice) {
      this.eposDevice.deleteDevice(this.printer, () => {});
    }
    if (this.eposDevice) {
      this.eposDevice.disconnect();
    }
    this.printer = null;
    this.eposDevice = null;
    this.connected = false;
    console.log('[Printer] Disconnected');
  }

  /**
   * Check if connected to printer
   */
  isConnected(): boolean {
    return this.connected && this.printer !== null;
  }

  /**
   * Print a QR slip for a guest order
   */
  async printQRSlip(data: QRSlipData): Promise<boolean> {
    if (!this.isConnected() || !this.printer) {
      console.error('[Printer] Not connected');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const printer = this.printer!;

        // Set up response handler
        printer.onreceive = (res) => {
          if (res.success) {
            console.log('[Printer] Print successful');
            resolve(true);
          } else {
            console.error('[Printer] Print failed:', res.code);
            resolve(false);
          }
        };

        printer.onerror = (err) => {
          console.error('[Printer] Print error:', err);
          resolve(false);
        };

        // Build receipt
        // Header
        printer.addTextAlign(EPOS_CONSTANTS.ALIGN_CENTER);
        printer.addTextStyle(false, false, true, 0);  // Bold
        printer.addTextSize(2, 2);
        printer.addText('Oh!\n');
        printer.addFeedLine(1);

        // Guest name
        printer.addTextSize(2, 2);
        printer.addText(`${data.guestName}\n`);

        // Order number
        printer.addTextSize(1, 1);
        printer.addTextStyle(false, false, false, 0);  // Normal
        printer.addText(`Order #${data.dailyOrderNumber}\n`);
        printer.addFeedLine(2);

        // QR Code (200px = ~6 dots/mm = ~33mm width)
        printer.addSymbol(
          data.qrCodeUrl,
          EPOS_CONSTANTS.SYMBOL_QRCODE_MODEL_2,
          EPOS_CONSTANTS.LEVEL_Q,
          6,  // Module width
          6,  // Module height
          200 // Size
        );
        printer.addFeedLine(2);

        // Pod or Queue info
        printer.addTextSize(2, 2);
        printer.addTextStyle(false, false, true, 0);  // Bold
        if (data.podNumber) {
          printer.addText(`POD ${data.podNumber}\n`);
        } else if (data.queuePosition) {
          printer.addText(`QUEUE #${data.queuePosition}\n`);
          printer.addTextSize(1, 1);
          printer.addText(`~${data.estimatedWaitMinutes || '?'} min wait\n`);
        }
        printer.addFeedLine(1);

        // Footer
        printer.addTextSize(1, 1);
        printer.addTextStyle(false, false, false, 0);  // Normal
        printer.addText('Scan to track your order\n');
        printer.addText('& earn rewards!\n');
        printer.addFeedLine(3);

        // Cut paper
        printer.addCut(EPOS_CONSTANTS.CUT_FEED);

        // Send to printer
        printer.send();

      } catch (err) {
        console.error('[Printer] Error building receipt:', err);
        resolve(false);
      }
    });
  }

  /**
   * Print a test page to verify printer is working
   */
  async testPrint(): Promise<boolean> {
    if (!this.isConnected() || !this.printer) {
      console.error('[Printer] Not connected');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const printer = this.printer!;

        printer.onreceive = (res) => {
          resolve(res.success);
        };

        printer.onerror = () => {
          resolve(false);
        };

        printer.addTextAlign(EPOS_CONSTANTS.ALIGN_CENTER);
        printer.addTextSize(2, 2);
        printer.addText('=== TEST PRINT ===\n');
        printer.addFeedLine(1);
        printer.addTextSize(1, 1);
        printer.addText('Oh! Kiosk Printer\n');
        printer.addText(`${new Date().toLocaleString()}\n`);
        printer.addFeedLine(1);
        printer.addText('Printer is working!\n');
        printer.addFeedLine(3);
        printer.addCut(EPOS_CONSTANTS.CUT_FEED);
        printer.send();

      } catch (err) {
        console.error('[Printer] Test print error:', err);
        resolve(false);
      }
    });
  }

  /**
   * Get printer status (if available)
   */
  async getStatus(): Promise<PrinterStatus> {
    // Basic status based on connection
    return {
      connected: this.connected,
      online: this.connected,
      paperStatus: 'unknown',
      coverOpen: false,
      error: this.connected ? null : 'Not connected',
    };
  }
}

// Singleton instance for easy access
let printerInstance: KioskPrinterService | null = null;

export function getKioskPrinter(): KioskPrinterService {
  if (!printerInstance) {
    printerInstance = new KioskPrinterService();
  }
  return printerInstance;
}

// Default configuration from environment
export function getDefaultPrinterConfig(): PrinterConfig | null {
  if (typeof window === 'undefined') return null;

  const ip = process.env.NEXT_PUBLIC_KIOSK_PRINTER_IP;
  if (!ip) return null;

  return {
    ipAddress: ip,
    port: parseInt(process.env.NEXT_PUBLIC_KIOSK_PRINTER_PORT || '8008', 10),
    timeout: 10000,
  };
}
