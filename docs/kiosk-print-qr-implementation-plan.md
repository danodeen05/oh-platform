# Kiosk Print & QR Code Implementation Plan

**Created:** 2024-12-31
**Status:** Ready for Implementation
**Priority:** High

## Overview

This document outlines the implementation plan for kiosk receipt printing with QR codes that serve dual purposes:
1. Pod check-in/arrival confirmation
2. Customer access to Order Status page (with sign-up CTA)

## Current State

### QR Code Format (Current)
- Deep link format: `oh://order/{orderId}`
- Only works with native apps
- Cannot be scanned by phone camera to open web page

### CompleteView (Current)
- Shows QR codes per guest
- No print functionality
- No queue position display
- 30-second auto-reset countdown

### Order Status Page (Current)
- Full-featured: Live commentary, fortune cookie, roast, backstory, add-ons
- Accessed via `orderQrCode` query parameter
- No sign-up CTA for unauthenticated guests

---

## Implementation Tasks

### Task 1: Update QR Code URL Format

**File:** `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

**Current Code (line ~4946):**
```typescript
const getQRValue = (guest: GuestOrder) => {
  if (guest.orderId) {
    return `oh://order/${guest.orderId}`;
  }
  return `oh://order/${guest.orderNumber || guest.dailyOrderNumber}`;
};
```

**New Code:**
```typescript
const getQRValue = (guest: GuestOrder) => {
  // Use the orderQrCode if available, otherwise fall back to orderId
  const qrCode = guest.orderQrCode || guest.orderId;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/order/status?orderQrCode=${encodeURIComponent(qrCode)}`;
};
```

**Dependencies:**
- Need to ensure `orderQrCode` is returned from the order creation API and stored in `GuestOrder`
- Check API response at `/orders` POST endpoint

**API Check Required:**
- Verify `/orders` POST returns `orderQrCode` field
- If not, add it to the API response (packages/api/src/index.js)

---

### Task 2: Update GuestOrder Type to Include orderQrCode

**File:** `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

**Find the GuestOrder type definition and add:**
```typescript
interface GuestOrder {
  // ... existing fields
  orderQrCode?: string; // Add this field
}
```

**Update order submission handler** to capture `orderQrCode` from API response:
```typescript
// In handleSubmitOrder or similar
updateCurrentGuest({
  orderId: order.id,
  orderNumber: order.orderNumber,
  orderQrCode: order.orderQrCode, // Add this
  dailyOrderNumber: order.kitchenOrderNumber,
  // ...
});
```

---

### Task 3: Handle Queue Scenario (No Pods Available)

**File:** `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

**Location:** Pod selection and payment flow

**When all pods are occupied:**
1. Allow order to complete
2. Store queue position from API response
3. Display queue info on CompleteView instead of pod assignment

**Update GuestOrder type:**
```typescript
interface GuestOrder {
  // ... existing fields
  queuePosition?: number;
  estimatedWaitMinutes?: number;
}
```

**Update CompleteView to handle queue scenario:**
```typescript
// In CompleteView render
{g.selectedPodId ? (
  // Pod assigned
  <div style={{ /* pod display styles */ }}>
    <div style={{ fontSize: "1rem", color: COLORS.textMuted }}>Your Pod</div>
    <div style={{ fontSize: "2rem", fontWeight: 700, color: COLORS.primary }}>
      Pod {pod?.number}
    </div>
  </div>
) : g.queuePosition ? (
  // In queue - no pod assigned
  <div style={{ /* queue display styles */ }}>
    <div style={{ fontSize: "1rem", color: COLORS.warning }}>Queue Position</div>
    <div style={{ fontSize: "2.5rem", fontWeight: 700, color: COLORS.warning }}>
      #{g.queuePosition}
    </div>
    <div style={{ fontSize: "0.9rem", color: COLORS.textMuted }}>
      ~{g.estimatedWaitMinutes} min wait
    </div>
    <div style={{ fontSize: "0.85rem", color: COLORS.textMuted, marginTop: 8 }}>
      We'll assign your pod soon!
    </div>
  </div>
) : null}
```

**API Integration:**
- The `/orders/:id/check-in` endpoint already returns `queuePosition` and `estimatedWaitMinutes` when pods are full
- Capture these values when order is submitted/checked-in

---

### Task 4: Generate Printable PDF Receipt

**New File:** `apps/web/components/kiosk/PrintableReceipt.tsx`

**Dependencies to Install:**
```bash
pnpm add @react-pdf/renderer
```

**Component Structure:**
```typescript
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import QRCode from 'qrcode';

interface PrintableReceiptProps {
  guestName: string;
  orderNumber: string;
  dailyOrderNumber: string;
  qrCodeUrl: string;
  podNumber?: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  locationName: string;
  items: Array<{ name: string; quantity: number; priceCents: number }>;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxRate: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  orderNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#7C7A67',
    marginBottom: 10,
  },
  qrCode: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginVertical: 20,
  },
  podSection: {
    textAlign: 'center',
    marginVertical: 15,
    padding: 15,
    backgroundColor: '#f5f5f0',
    borderRadius: 8,
  },
  podLabel: {
    fontSize: 14,
    color: '#666',
  },
  podNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#7C7A67',
  },
  queueSection: {
    textAlign: 'center',
    marginVertical: 15,
    padding: 15,
    backgroundColor: '#fff8e6',
    borderRadius: 8,
  },
  queueNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#d97706',
  },
  instructions: {
    textAlign: 'center',
    fontSize: 11,
    color: '#666',
    marginTop: 15,
    lineHeight: 1.5,
  },
  footer: {
    textAlign: 'center',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  footerText: {
    fontSize: 10,
    color: '#999',
  },
  signupCta: {
    textAlign: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#7C7A67',
    borderRadius: 5,
  },
  signupText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export function PrintableReceipt({
  guestName,
  orderNumber,
  dailyOrderNumber,
  qrCodeUrl,
  podNumber,
  queuePosition,
  estimatedWaitMinutes,
  locationName,
}: PrintableReceiptProps) {
  // Generate QR code as data URL
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(qrCodeUrl, { width: 200, margin: 1 })
      .then(setQrDataUrl);
  }, [qrCodeUrl]);

  return (
    <Document>
      <Page size={[226, 400]} style={styles.page}> {/* 80mm thermal receipt width */}
        {/* Header */}
        <View style={styles.header}>
          <Image src="/Oh_Logo_Mark_Web.png" style={styles.logo} />
          <Text style={styles.title}>Oh! Beef Noodle</Text>
          <Text style={{ fontSize: 10, color: '#666' }}>{locationName}</Text>
        </View>

        {/* Guest Name & Order Number */}
        <View style={{ textAlign: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{guestName}</Text>
          <Text style={styles.orderNumber}>#{dailyOrderNumber}</Text>
        </View>

        {/* QR Code */}
        {qrDataUrl && (
          <Image src={qrDataUrl} style={styles.qrCode} />
        )}

        {/* Pod or Queue Info */}
        {podNumber ? (
          <View style={styles.podSection}>
            <Text style={styles.podLabel}>Your Pod</Text>
            <Text style={styles.podNumber}>Pod {podNumber}</Text>
            <Text style={{ fontSize: 10, color: '#666', marginTop: 5 }}>
              Scan QR at your pod to check in
            </Text>
          </View>
        ) : queuePosition ? (
          <View style={styles.queueSection}>
            <Text style={{ fontSize: 14, color: '#d97706' }}>Queue Position</Text>
            <Text style={styles.queueNumber}>#{queuePosition}</Text>
            <Text style={{ fontSize: 10, color: '#666', marginTop: 5 }}>
              ~{estimatedWaitMinutes} min wait
            </Text>
            <Text style={{ fontSize: 10, color: '#666', marginTop: 5 }}>
              We'll assign your pod soon!
            </Text>
          </View>
        ) : null}

        {/* Instructions */}
        <Text style={styles.instructions}>
          Scan this QR code with your phone{'\n'}
          to track your order status{'\n'}
          and unlock fun features!
        </Text>

        {/* Sign-up CTA */}
        <View style={styles.signupCta}>
          <Text style={styles.signupText}>
            Sign up & earn rewards on this order!
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for dining with Oh!
          </Text>
          <Text style={styles.footerText}>
            ohbeefnoodle.com
          </Text>
        </View>
      </Page>
    </Document>
  );
}
```

---

### Task 5: Add Print Button to CompleteView

**File:** `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

**Add PDF generation and print trigger:**
```typescript
import { pdf } from '@react-pdf/renderer';
import { PrintableReceipt } from '@/components/kiosk/PrintableReceipt';

// In CompleteView component
const handlePrint = async () => {
  // Generate PDF for each guest
  for (const guest of guestOrders) {
    const pod = seats.find((s) => s.id === guest.selectedPodId);
    const qrUrl = getQRValue(guest);

    const doc = (
      <PrintableReceipt
        guestName={guest.guestName}
        orderNumber={guest.orderNumber}
        dailyOrderNumber={guest.dailyOrderNumber}
        qrCodeUrl={qrUrl}
        podNumber={pod?.number}
        queuePosition={guest.queuePosition}
        estimatedWaitMinutes={guest.estimatedWaitMinutes}
        locationName={location.name}
      />
    );

    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);

    // Open print dialog
    const printWindow = window.open(url);
    printWindow?.print();
  }
};

// Add print button to CompleteView UI
<button
  onClick={handlePrint}
  style={{
    padding: "16px 32px",
    background: COLORS.primary,
    border: "none",
    borderRadius: 12,
    color: COLORS.textOnPrimary,
    fontSize: "1.1rem",
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 16,
  }}
>
  Print Receipts
</button>
```

**Alternative: Auto-print on completion**
```typescript
// In CompleteView useEffect
useEffect(() => {
  // Auto-trigger print on mount
  handlePrint();
}, []);
```

---

### Task 6: Add Sign-up Modal to Order Status Page

**File:** `apps/web/app/[locale]/order/status/page.tsx`

**New Component to Add:**
```typescript
interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderQrCode: string;
  onSuccess: (user: any) => void;
}

function SignUpModal({ isOpen, onClose, orderQrCode, onSuccess }: SignUpModalProps) {
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create account
      const signupRes = await fetch(`${BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': 'oh'
        },
        body: JSON.stringify(formData),
      });

      if (!signupRes.ok) {
        const data = await signupRes.json();
        throw new Error(data.error || 'Sign up failed');
      }

      const { user, token } = await signupRes.json();

      // 2. Link the current order to the new account
      await fetch(`${BASE}/orders/link-to-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': 'oh',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ orderQrCode }),
      });

      // 3. Success!
      setStep('success');
      onSuccess(user);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 32,
        maxWidth: 400,
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {step === 'form' && (
          <>
            <h2 style={{ margin: 0, marginBottom: 8 }}>Join Oh! Rewards</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              Sign up now and we'll credit this order to your new account!
            </p>

            {/* Benefits */}
            <div style={{
              background: '#f5f5f0',
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>You'll get:</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#666' }}>
                <li>Credit for today's order</li>
                <li>Free birthday noodles</li>
                <li>Exclusive member rewards</li>
                <li>Order history & favorites</li>
              </ul>
            </div>

            {error && (
              <div style={{
                background: '#fee',
                color: '#c00',
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    fontSize: '1rem',
                  }}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  fontSize: '1rem',
                }}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  fontSize: '1rem',
                }}
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  background: 'white',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Maybe Later
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !formData.firstName || !formData.email || !formData.password}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 8,
                  border: 'none',
                  background: '#7C7A67',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Creating...' : 'Sign Up'}
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: '#e8f5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 style={{ margin: 0, marginBottom: 8 }}>Welcome to Oh!</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              Your account is ready and this order has been credited to your rewards!
            </p>
            <button
              onClick={onClose}
              style={{
                padding: 14,
                borderRadius: 8,
                border: 'none',
                background: '#7C7A67',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Add to StatusContent component:**
```typescript
// State
const [showSignUpModal, setShowSignUpModal] = useState(false);
const [isAuthenticated, setIsAuthenticated] = useState(false);

// Check authentication status on mount
useEffect(() => {
  const token = localStorage.getItem('authToken');
  setIsAuthenticated(!!token);
}, []);

// In the render, add sign-up CTA for unauthenticated users
{!isAuthenticated && status?.order && (
  <div style={{
    background: 'linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    textAlign: 'center',
  }}>
    <h3 style={{ color: 'white', margin: 0, marginBottom: 8 }}>
      Earn Rewards on This Order!
    </h3>
    <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, marginBottom: 16, fontSize: '0.9rem' }}>
      Sign up now and we'll credit today's order to your new account
    </p>
    <button
      onClick={() => setShowSignUpModal(true)}
      style={{
        padding: '12px 24px',
        borderRadius: 50,
        border: '2px solid white',
        background: 'transparent',
        color: 'white',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Sign Up & Get Credit
    </button>
  </div>
)}

{/* Sign-up Modal */}
<SignUpModal
  isOpen={showSignUpModal}
  onClose={() => setShowSignUpModal(false)}
  orderQrCode={orderQrCode || ''}
  onSuccess={(user) => {
    setIsAuthenticated(true);
    // Optionally refresh order status to show linked user
    fetchStatus();
  }}
/>
```

---

### Task 7: Create API Endpoint to Link Order to Account

**File:** `packages/api/src/index.js`

**New Endpoint:**
```javascript
// POST /orders/link-to-account - Link a guest order to a user account
app.post("/orders/link-to-account", async (req, reply) => {
  const { orderQrCode } = req.body || {};

  if (!orderQrCode) {
    return reply.code(400).send({ error: "orderQrCode required" });
  }

  // Get user from auth token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);

  // Verify token and get user (implement based on your auth system)
  const user = await verifyTokenAndGetUser(token);
  if (!user) {
    return reply.code(401).send({ error: "Invalid token" });
  }

  // Find the order
  const order = await prisma.order.findFirst({
    where: { orderQrCode },
    include: { user: true },
  });

  if (!order) {
    return reply.code(404).send({ error: "Order not found" });
  }

  // Check if order is already linked to a different user
  if (order.userId && order.userId !== user.id) {
    return reply.code(400).send({ error: "Order is already linked to another account" });
  }

  // Link order to user
  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { userId: user.id },
    include: {
      user: true,
      items: { include: { menuItem: true } },
    },
  });

  // Award points/rewards for the order
  // (implement based on your rewards system)
  if (order.totalCents > 0) {
    const pointsEarned = Math.floor(order.totalCents / 100); // 1 point per dollar
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lifetimePoints: { increment: pointsEarned },
        currentPoints: { increment: pointsEarned },
      },
    });
  }

  return {
    success: true,
    order: updatedOrder,
    message: "Order linked to your account!",
  };
});
```

---

### Task 8: Update CompleteView Design (Match Other Screens)

**File:** `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

Apply the same design pattern as PaymentView:
- Large KioskBrand (xlarge) at top: 48, left: 48
- Colored top bar with title
- Colored bottom bar with actions
- Scrollable content area

```typescript
function CompleteView({
  guestOrders,
  seats,
  location,
  onNewOrder,
}: {
  guestOrders: GuestOrder[];
  seats: Seat[];
  location: Location;
  onNewOrder: () => void;
}) {
  // ... existing state

  const getQRValue = (guest: GuestOrder) => {
    const qrCode = guest.orderQrCode || guest.orderId;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/order/status?orderQrCode=${encodeURIComponent(qrCode)}`;
  };

  const handlePrint = async () => {
    // PDF generation logic
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: COLORS.surface,
        color: COLORS.text,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Oh! mark */}
      <div style={{ /* ... existing watermark styles */ }} />

      {/* Large Brand Header */}
      <div style={{ position: "absolute", top: 48, left: 48, zIndex: 1 }}>
        <KioskBrand size="xlarge" />
      </div>

      {/* Fixed Header with color */}
      <div style={{
        textAlign: "center",
        paddingTop: 32,
        paddingBottom: 20,
        background: COLORS.successLight,
        borderBottom: `1px solid ${COLORS.success}`,
        zIndex: 1,
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="kiosk-title" style={{ fontSize: "3rem", fontWeight: 700, marginBottom: 8 }}>
          You're All Set!
        </h1>
        <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "1.25rem" }}>
          Your receipt is printing. Scan the QR code at your pod!
        </p>
      </div>

      {/* Scrollable Content - Order Cards */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px",
        paddingBottom: 140,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          justifyContent: "center",
          maxWidth: 1200,
        }}>
          {guestOrders.map((g) => {
            const pod = seats.find((s) => s.id === g.selectedPodId);
            const qrUrl = getQRValue(g);

            return (
              <div
                key={g.guestNumber}
                style={{
                  background: COLORS.surfaceElevated,
                  borderRadius: 24,
                  padding: 28,
                  border: `2px solid ${g.queuePosition ? COLORS.warning : COLORS.primary}`,
                  minWidth: 280,
                  textAlign: "center",
                }}
              >
                {/* Guest name */}
                <div style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: 4 }}>
                  {g.guestName}
                </div>

                {/* Order number */}
                <div style={{ fontSize: "2.5rem", fontWeight: 700, color: COLORS.primary, marginBottom: 16 }}>
                  #{g.dailyOrderNumber || "---"}
                </div>

                {/* QR Code */}
                <div style={{
                  background: "white",
                  padding: 12,
                  borderRadius: 12,
                  display: "inline-block",
                  marginBottom: 16,
                }}>
                  <QRCode value={qrUrl} size={140} />
                </div>

                {/* Pod or Queue info */}
                {pod ? (
                  <div style={{
                    background: COLORS.primaryLight,
                    borderRadius: 12,
                    padding: 16,
                  }}>
                    <div style={{ fontSize: "1rem", color: COLORS.textMuted }}>Your Pod</div>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: COLORS.primary }}>
                      Pod {pod.number}
                    </div>
                  </div>
                ) : g.queuePosition ? (
                  <div style={{
                    background: COLORS.warningLight,
                    borderRadius: 12,
                    padding: 16,
                  }}>
                    <div style={{ fontSize: "1rem", color: COLORS.warning }}>Queue Position</div>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: COLORS.warning }}>
                      #{g.queuePosition}
                    </div>
                    <div style={{ fontSize: "0.9rem", color: COLORS.textMuted, marginTop: 4 }}>
                      ~{g.estimatedWaitMinutes} min wait
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: 32,
          textAlign: "center",
          maxWidth: 500,
        }}>
          <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, lineHeight: 1.6 }}>
            Scan the QR code with your phone to track your order,
            play with fun features, and sign up for rewards!
          </p>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "16px 24px",
        background: COLORS.primaryLight,
        borderTop: `1px solid ${COLORS.primaryBorder}`,
        display: "flex",
        justifyContent: "center",
        gap: 16,
        zIndex: 10,
      }}>
        <div style={{ color: COLORS.textMuted, fontSize: "1.1rem" }}>
          Screen resets in {countdown}s
        </div>
        <button
          onClick={handlePrint}
          style={{
            padding: "16px 32px",
            background: "transparent",
            border: `2px solid ${COLORS.border}`,
            borderRadius: 12,
            color: COLORS.textMuted,
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          Reprint Receipts
        </button>
        <button
          onClick={onNewOrder}
          style={{
            padding: "16px 48px",
            background: COLORS.primary,
            border: "none",
            borderRadius: 12,
            color: COLORS.textOnPrimary,
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start New Order
        </button>
      </div>
    </main>
  );
}
```

---

## Testing Checklist

### QR Code Testing
- [ ] Scan printed QR code with phone - should open Order Status page
- [ ] Scan QR code at pod - should confirm arrival
- [ ] QR code URL includes correct orderQrCode parameter

### Queue Scenario Testing
- [ ] Set all pods to OCCUPIED status
- [ ] Complete an order through kiosk
- [ ] Verify queue position is displayed (not pod number)
- [ ] Verify estimated wait time is shown

### Print Testing
- [ ] PDF generates correctly for single guest
- [ ] PDF generates correctly for multiple guests (group order)
- [ ] Print dialog opens
- [ ] Receipt includes all required information

### Sign-up Modal Testing
- [ ] Modal appears for unauthenticated users on Order Status page
- [ ] Sign-up form validates required fields
- [ ] Account creation succeeds
- [ ] Order is linked to new account
- [ ] Points/rewards are credited
- [ ] Modal shows success state

---

## Dependencies

### NPM Packages to Install
```bash
cd apps/web
pnpm add @react-pdf/renderer qrcode
pnpm add -D @types/qrcode
```

### Files to Create
- `apps/web/components/kiosk/PrintableReceipt.tsx`

### Files to Modify
- `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`
- `apps/web/app/[locale]/order/status/page.tsx`
- `packages/api/src/index.js`

---

## Estimated Effort

| Task | Complexity | Est. Time |
|------|------------|-----------|
| Task 1: QR URL format | Low | 15 min |
| Task 2: GuestOrder type | Low | 10 min |
| Task 3: Queue handling | Medium | 30 min |
| Task 4: PrintableReceipt | High | 1-2 hours |
| Task 5: Print button | Medium | 30 min |
| Task 6: Sign-up modal | High | 1-2 hours |
| Task 7: Link order API | Medium | 30 min |
| Task 8: CompleteView redesign | Medium | 45 min |
| Testing | Medium | 1 hour |

**Total Estimated Time:** 5-7 hours

---

## Future Enhancements

1. **Hardware Printing**: Integrate with actual receipt printer via browser print API or dedicated kiosk software
2. **Email Receipt Option**: "Email me my receipt" in addition to print
3. **NFC/Tap**: Allow NFC tap at pod instead of QR scan
4. **Queue Notifications**: SMS/push when pod becomes available for queued customers
5. **Kiosk Welcome Screen QR**: Add membership QR code to idle/welcome screen for passers-by
