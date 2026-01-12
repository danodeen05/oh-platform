'use client';

import { useKioskPrinter } from '@/components/kiosk';

export default function PrinterTestPage() {
  const { isConnected, isConnecting, error, connect, testPrint } = useKioskPrinter();

  const handleTestPrint = async () => {
    const success = await testPrint();
    if (success) {
      alert('Test print sent successfully!');
    } else {
      alert('Test print failed. Check console for details.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      background: '#FAF9F6',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '2rem', color: '#1a1a1a' }}>Printer Test</h1>

      <div style={{
        padding: 24,
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center',
        minWidth: 300,
      }}>
        <div style={{ marginBottom: 16 }}>
          <strong>Status:</strong>{' '}
          {isConnecting ? (
            <span style={{ color: '#f59e0b' }}>Connecting...</span>
          ) : isConnected ? (
            <span style={{ color: '#22c55e' }}>Connected</span>
          ) : (
            <span style={{ color: '#ef4444' }}>Disconnected</span>
          )}
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: 16, fontSize: '0.875rem' }}>
            Error: {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isConnected && (
            <button
              onClick={connect}
              disabled={isConnecting}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                background: '#7C7A67',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: isConnecting ? 'wait' : 'pointer',
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect to Printer'}
            </button>
          )}

          <button
            onClick={handleTestPrint}
            disabled={!isConnected}
            style={{
              padding: '16px 32px',
              fontSize: '1.25rem',
              background: isConnected ? '#22c55e' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: isConnected ? 'pointer' : 'not-allowed',
            }}
          >
            Print Test Page
          </button>
        </div>

        <div style={{ marginTop: 24, fontSize: '0.75rem', color: '#666' }}>
          Printer IP: {process.env.NEXT_PUBLIC_KIOSK_PRINTER_IP || 'Not configured'}
        </div>
      </div>

      <a href="/en/kiosk" style={{ color: '#7C7A67', textDecoration: 'underline' }}>
        Back to Kiosk
      </a>
    </div>
  );
}
