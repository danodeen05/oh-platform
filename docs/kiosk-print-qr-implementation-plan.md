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

---

# Kiosk Security & Multi-Location Architecture

**Priority:** High (implement alongside or before Print/QR features)

## Current Security Gaps

### Analysis of Current Implementation

1. **No Authentication**: `/kiosk` routes are publicly accessible with no login required
2. **Location Spoofing**: Location is passed via URL query param (`?locationId=xxx`) - anyone can access any location's kiosk
3. **Staff PIN Only for Exit**: The 4-digit PIN (`exitCode` in Location model) only controls exiting kiosk mode, not entering
4. **No Device Binding**: Any device can access any kiosk view for any location

### Security Risks

- Competitors could scrape menu/pricing from any location
- Fraudulent orders could be placed through unauthenticated access
- No audit trail of which device placed which order
- No way to remotely disable a compromised kiosk

---

## Implementation Plan: Hybrid Authentication + Location Binding

### Phase 1: Add Clerk Authentication to Kiosk Routes

**Files to Modify:**
- `apps/web/middleware.ts`
- `apps/web/app/[locale]/kiosk/layout.tsx`
- `apps/web/app/[locale]/kiosk/page.tsx`

**Step 1.1: Update Middleware to Protect Kiosk Routes**

```typescript
// In middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isKioskRoute = createRouteMatcher(['/kiosk(.*)', '/*/kiosk(.*)']);
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/public(.*)']);

export default clerkMiddleware((auth, req) => {
  // Kiosk routes require authentication
  if (isKioskRoute(req)) {
    auth().protect();
  }
});
```

**Step 1.2: Create Kiosk Sign-In Page**

**New File:** `apps/web/app/[locale]/kiosk/sign-in/page.tsx`

```typescript
'use client';

import { SignIn } from '@clerk/nextjs';

export default function KioskSignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAF9F6',
    }}>
      <div style={{ textAlign: 'center' }}>
        <img
          src="/Oh_Logo_Mark_Web.png"
          alt="Oh! Beef Noodle"
          style={{ width: 120, height: 120, marginBottom: 24 }}
        />
        <h1 style={{ marginBottom: 24, color: '#7C7A67' }}>Kiosk Login</h1>
        <SignIn
          appearance={{
            elements: {
              rootBox: { width: '100%' },
              card: { boxShadow: 'none', border: '1px solid #ddd' },
            },
          }}
          afterSignInUrl="/kiosk"
          signUpUrl={undefined} // Disable sign-up on kiosk
        />
      </div>
    </div>
  );
}
```

---

### Phase 2: Create Kiosk User Accounts in Clerk

**Approach:** Create dedicated Clerk accounts for each kiosk (one per location)

**User Metadata Structure:**
```typescript
interface KioskUserMetadata {
  role: 'kiosk';
  locationId: string;
  deviceName?: string; // e.g., "City Creek Kiosk 1"
  isActive: boolean;
}
```

**Step 2.1: Create Kiosk Users via Clerk Dashboard or API**

Option A: **Manual via Clerk Dashboard**
1. Go to Clerk Dashboard > Users
2. Create user: `kiosk-citycreek@ohbeefnoodle.com`
3. Set password (strong, store securely)
4. Add public metadata: `{ "role": "kiosk", "locationId": "clxxx...", "isActive": true }`

Option B: **Programmatic via Admin API**

**New File:** `packages/api/src/admin/create-kiosk-user.js`

```javascript
import { clerkClient } from '@clerk/clerk-sdk-node';

async function createKioskUser(locationId, locationName) {
  const email = `kiosk-${locationName.toLowerCase().replace(/\s+/g, '-')}@ohbeefnoodle.com`;
  const password = generateSecurePassword(); // Implement secure generation

  const user = await clerkClient.users.createUser({
    emailAddress: [email],
    password,
    publicMetadata: {
      role: 'kiosk',
      locationId,
      isActive: true,
    },
  });

  console.log(`Created kiosk user: ${email}`);
  console.log(`Password: ${password}`); // Store this securely!

  return { user, email, password };
}
```

---

### Phase 3: Derive Location from Session (Not URL)

**Files to Modify:**
- `apps/web/app/[locale]/kiosk/page.tsx`
- `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

**Step 3.1: Update Kiosk Layout to Validate and Inject Location**

```typescript
// apps/web/app/[locale]/kiosk/layout.tsx
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect('/kiosk/sign-in');
  }

  // Validate this is a kiosk account
  const metadata = user.publicMetadata as KioskUserMetadata;

  if (metadata?.role !== 'kiosk') {
    // Not a kiosk account - show error or redirect
    redirect('/unauthorized?reason=not-kiosk-account');
  }

  if (!metadata.isActive) {
    // Kiosk has been disabled
    redirect('/kiosk/disabled');
  }

  if (!metadata.locationId) {
    // No location assigned
    redirect('/kiosk/setup-required');
  }

  // Pass locationId to children via context or fetch
  return (
    <KioskProvider locationId={metadata.locationId}>
      {children}
    </KioskProvider>
  );
}
```

**Step 3.2: Create Kiosk Context Provider**

**New File:** `apps/web/components/kiosk/KioskProvider.tsx`

```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';

interface KioskContextValue {
  locationId: string;
}

const KioskContext = createContext<KioskContextValue | null>(null);

export function KioskProvider({
  locationId,
  children,
}: {
  locationId: string;
  children: ReactNode;
}) {
  return (
    <KioskContext.Provider value={{ locationId }}>
      {children}
    </KioskContext.Provider>
  );
}

export function useKiosk() {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk must be used within a KioskProvider');
  }
  return context;
}
```

**Step 3.3: Update Kiosk Order Flow to Use Context**

```typescript
// apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx

// Remove URL-based location param
// Before:
// const searchParams = useSearchParams();
// const locationId = searchParams.get('locationId') || DEFAULT_LOCATION_ID;

// After:
import { useKiosk } from '@/components/kiosk/KioskProvider';

export function KioskOrderFlow() {
  const { locationId } = useKiosk();
  // Use locationId from authenticated context
  // ...
}
```

---

### Phase 4: Optional - Device Registration Model

**Purpose:** Track which physical devices are authorized kiosks for audit and remote management.

**Step 4.1: Add Prisma Model**

```prisma
// packages/db/prisma/schema.prisma

model KioskDevice {
  id              String    @id @default(cuid())
  clerkUserId     String    @unique  // Links to Clerk kiosk user
  locationId      String
  location        Location  @relation(fields: [locationId], references: [id])
  deviceName      String    // e.g., "City Creek Kiosk 1"
  deviceType      String?   // e.g., "iPad Pro 12.9", "Surface Pro"
  lastActiveAt    DateTime?
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@map("kiosk_devices")
}
```

**Step 4.2: Update Location Model**

```prisma
model Location {
  // ... existing fields
  kioskDevices    KioskDevice[]
}
```

**Step 4.3: Track Kiosk Activity**

```typescript
// In kiosk order flow, update lastActiveAt on each order
await fetch(`${API_BASE}/kiosks/heartbeat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
});
```

---

### Phase 5: Admin Panel for Kiosk Management

**New Admin UI Components:**

**File:** `apps/web/app/[locale]/admin/kiosks/page.tsx`

```typescript
export default function AdminKiosksPage() {
  // List all kiosk devices with:
  // - Location assignment
  // - Last active timestamp
  // - Active/Inactive status toggle
  // - Option to force sign-out remotely

  return (
    <div>
      <h1>Kiosk Management</h1>

      <table>
        <thead>
          <tr>
            <th>Device Name</th>
            <th>Location</th>
            <th>Last Active</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {kioskDevices.map((device) => (
            <tr key={device.id}>
              <td>{device.deviceName}</td>
              <td>{device.location.name}</td>
              <td>{formatRelativeTime(device.lastActiveAt)}</td>
              <td>
                <StatusBadge active={device.isActive} />
              </td>
              <td>
                <button onClick={() => toggleActive(device.id)}>
                  {device.isActive ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => forceSignOut(device.clerkUserId)}>
                  Force Sign Out
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={() => setShowCreateModal(true)}>
        + Add New Kiosk
      </button>
    </div>
  );
}
```

---

## Security Implementation Checklist

### Phase 1: Authentication
- [ ] Update middleware to protect `/kiosk` routes
- [ ] Create kiosk sign-in page
- [ ] Disable sign-up on kiosk login (use existing accounts only)
- [ ] Test that unauthenticated access redirects to sign-in

### Phase 2: Kiosk Accounts
- [ ] Create Clerk accounts for each location
- [ ] Set correct public metadata (`role`, `locationId`)
- [ ] Store credentials securely (password manager, etc.)
- [ ] Test login with each kiosk account

### Phase 3: Location Binding
- [ ] Create KioskProvider context
- [ ] Update layout to validate kiosk role
- [ ] Remove URL-based locationId param
- [ ] Test that kiosk can only access its assigned location

### Phase 4: Device Registration (Optional)
- [ ] Add KioskDevice Prisma model
- [ ] Run migration
- [ ] Create device registration endpoint
- [ ] Add heartbeat/activity tracking

### Phase 5: Admin Panel (Optional)
- [ ] Create kiosk management page
- [ ] Implement enable/disable toggle
- [ ] Implement force sign-out
- [ ] Add new kiosk creation flow

---

## Rollout Plan

### Pre-Deployment
1. Create Clerk kiosk accounts for each location
2. Store credentials securely
3. Test locally with kiosk authentication flow

### Deployment
1. Deploy updated middleware (routes now protected)
2. Immediately log in to each physical kiosk device
3. Verify order flow works with authenticated session
4. Monitor for any authentication errors

### Post-Deployment
1. Rotate kiosk passwords after initial setup
2. Set up monitoring for unusual kiosk activity
3. Document kiosk login procedure for staff

---

## Estimated Effort

| Phase | Complexity | Est. Time |
|-------|------------|-----------|
| Phase 1: Authentication | Medium | 1-2 hours |
| Phase 2: Kiosk Accounts | Low | 30 min |
| Phase 3: Location Binding | Medium | 1-2 hours |
| Phase 4: Device Registration | Medium | 1-2 hours |
| Phase 5: Admin Panel | High | 2-3 hours |
| Testing & Deployment | Medium | 1-2 hours |

**Total Estimated Time:** 6-11 hours

**Recommended Minimum:** Phases 1-3 (3-4 hours) - provides core security without optional features

---

# Kiosk Language Selection & Full i18n Support

**Priority:** High (user-facing feature for inclusive experience)

## Current State

### Existing i18n Infrastructure
- Next.js i18n routing via `[locale]` segment
- Translation files: `en.json`, `es.json`, `zh-CN.json`, `zh-TW.json`
- `useTranslations` hook from `next-intl`
- Locale detected from URL path (e.g., `/en/kiosk`, `/es/kiosk`)

### Current Gaps
1. **No language selector UI** on kiosk screens
2. **Incomplete translations** - some kiosk-specific strings may be missing
3. **No language persistence** - if user changes language, it should persist through the entire flow
4. **Printed receipts** - need to print in selected language

---

## Implementation Plan

### Task 1: Add Language Selector to Kiosk Welcome Screen

**File:** `apps/web/app/[locale]/kiosk/kiosk-welcome.tsx`

**Design:** Floating language button (top-right corner) that opens a language picker modal

```typescript
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇲🇽' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
];

function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === locale) || SUPPORTED_LANGUAGES[0];

  const handleLanguageChange = (langCode: string) => {
    // Replace locale segment in path
    const segments = pathname.split('/');
    segments[1] = langCode; // Replace locale
    const newPath = segments.join('/');
    router.push(newPath);
    setIsOpen(false);
  };

  return (
    <>
      {/* Language Button - Fixed Position */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          padding: '12px 20px',
          background: 'rgba(255,255,255,0.95)',
          border: '2px solid #ddd',
          borderRadius: 50,
          fontSize: '1.1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <span style={{ fontSize: '1.3rem' }}>{currentLang.flag}</span>
        <span>{currentLang.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Language Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 24,
              padding: 32,
              minWidth: 320,
              maxWidth: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, marginBottom: 24, textAlign: 'center' }}>
              Select Language
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  style={{
                    padding: '16px 24px',
                    background: lang.code === locale ? '#7C7A67' : '#f5f5f0',
                    color: lang.code === locale ? 'white' : '#333',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{lang.flag}</span>
                  <span style={{ fontWeight: lang.code === locale ? 600 : 400 }}>
                    {lang.label}
                  </span>
                  {lang.code === locale && (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ marginLeft: 'auto' }}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Add to Welcome Screen:**
```typescript
// In kiosk-welcome.tsx render
return (
  <main>
    <LanguageSelector />
    {/* ... rest of welcome content */}
  </main>
);
```

---

### Task 2: Add Compact Language Selector to Order Flow

**File:** `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

For screens during the order flow, use a smaller, less intrusive selector:

```typescript
function CompactLanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === locale);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const segments = pathname.split('/');
    segments[1] = e.target.value;
    router.push(segments.join('/'));
  };

  return (
    <select
      value={locale}
      onChange={handleChange}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid #ddd',
        background: 'white',
        fontSize: '0.9rem',
        cursor: 'pointer',
      }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.label}
        </option>
      ))}
    </select>
  );
}
```

**Placement:** Add to top navigation bar on each kiosk screen (near back button or in header).

---

### Task 3: Audit & Complete Kiosk Translations

**Files to audit:**
- `apps/web/messages/en.json`
- `apps/web/messages/es.json`
- `apps/web/messages/zh-CN.json`
- `apps/web/messages/zh-TW.json`

**Required kiosk translation keys:**

```json
{
  "kiosk": {
    "welcome": {
      "title": "Welcome to Oh!",
      "subtitle": "Tap to start your order",
      "dineIn": "Dine In",
      "takeOut": "Take Out"
    },
    "checkIn": {
      "title": "Check In",
      "subtitle": "Enter your phone number or scan your QR code",
      "guestCheckIn": "Continue as Guest",
      "memberCheckIn": "Member Check-In"
    },
    "guestCount": {
      "title": "How many guests?",
      "solo": "Just me",
      "guests": "guests"
    },
    "guestNames": {
      "title": "Guest Names",
      "subtitle": "Enter a name for each guest",
      "placeholder": "Guest name",
      "continue": "Continue"
    },
    "menu": {
      "title": "Build Your Bowl",
      "addToOrder": "Add to Order",
      "customize": "Customize",
      "viewOrder": "View Order",
      "items": "items"
    },
    "pods": {
      "title": "Choose Your Pod",
      "subtitle": "Select where you'd like to sit",
      "available": "Available",
      "occupied": "Occupied",
      "yourPod": "Your Pod"
    },
    "payment": {
      "title": "Payment",
      "oneCheck": "One check for {count} guests",
      "separateChecks": "Separate checks",
      "subtotal": "Subtotal",
      "tax": "Tax",
      "total": "Total",
      "payNow": "Pay",
      "back": "Back"
    },
    "complete": {
      "title": "You're All Set!",
      "subtitle": "Your receipt is printing. Scan the QR code at your pod!",
      "orderNumber": "Order",
      "yourPod": "Your Pod",
      "queuePosition": "Queue Position",
      "estimatedWait": "~{minutes} min wait",
      "scanInstructions": "Scan the QR code with your phone to track your order and unlock fun features!",
      "reprintReceipts": "Reprint Receipts",
      "startNewOrder": "Start New Order",
      "resetCountdown": "Screen resets in {seconds}s"
    },
    "common": {
      "back": "Back",
      "next": "Next",
      "cancel": "Cancel",
      "confirm": "Confirm",
      "loading": "Loading...",
      "error": "Something went wrong"
    }
  }
}
```

**Audit Process:**
1. Extract all hardcoded strings from kiosk components
2. Create translation keys in `en.json`
3. Translate to `es.json`, `zh-CN.json`, `zh-TW.json`
4. Replace hardcoded strings with `t('kiosk.xxx')` calls

---

### Task 4: Update All Kiosk Components to Use Translations

**Files to update:**
- `apps/web/app/[locale]/kiosk/page.tsx`
- `apps/web/app/[locale]/kiosk/kiosk-welcome.tsx`
- `apps/web/app/[locale]/kiosk/check-in/page.tsx`
- `apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

**Pattern:**
```typescript
// Before
<h1>Welcome to Oh!</h1>

// After
import { useTranslations } from 'next-intl';

export function Component() {
  const t = useTranslations('kiosk');

  return (
    <h1>{t('welcome.title')}</h1>
  );
}
```

---

### Task 5: Print Receipts in Selected Language

**File:** `apps/web/components/kiosk/PrintableReceipt.tsx`

Pass locale to receipt generation and use translated strings:

```typescript
interface PrintableReceiptProps {
  // ... existing props
  locale: string; // Add locale
}

export function PrintableReceipt({ locale, ...props }: PrintableReceiptProps) {
  // Load translations for the specific locale
  const translations = getReceiptTranslations(locale);

  return (
    <Document>
      <Page>
        {/* Use translations.yourPod instead of hardcoded "Your Pod" */}
        <Text>{translations.yourPod}</Text>
        <Text>{translations.orderNumber}: #{props.orderNumber}</Text>
        <Text>{translations.scanInstructions}</Text>
      </Page>
    </Document>
  );
}

// Helper to get receipt-specific translations
function getReceiptTranslations(locale: string) {
  const translations = {
    en: {
      yourPod: 'Your Pod',
      orderNumber: 'Order',
      queuePosition: 'Queue Position',
      scanInstructions: 'Scan this QR code with your phone to track your order!',
      thankYou: 'Thank you for dining with Oh!',
    },
    es: {
      yourPod: 'Tu Pod',
      orderNumber: 'Pedido',
      queuePosition: 'Posición en la Cola',
      scanInstructions: '¡Escanea este código QR con tu teléfono para seguir tu pedido!',
      thankYou: '¡Gracias por comer con Oh!',
    },
    'zh-CN': {
      yourPod: '您的座位',
      orderNumber: '订单',
      queuePosition: '排队位置',
      scanInstructions: '用手机扫描此二维码追踪您的订单！',
      thankYou: '感谢您在Oh!用餐！',
    },
    'zh-TW': {
      yourPod: '您的座位',
      orderNumber: '訂單',
      queuePosition: '排隊位置',
      scanInstructions: '用手機掃描此二維碼追蹤您的訂單！',
      thankYou: '感謝您在Oh!用餐！',
    },
  };

  return translations[locale] || translations.en;
}
```

---

## i18n Implementation Checklist

### Language Selector
- [ ] Create `LanguageSelector` component for welcome screen
- [ ] Create `CompactLanguageSelector` for order flow screens
- [ ] Add language selector to kiosk welcome screen
- [ ] Add compact selector to order flow header
- [ ] Test language switching persists through flow

### Translation Audit
- [ ] Extract all hardcoded strings from kiosk components
- [ ] Create comprehensive `kiosk` namespace in `en.json`
- [ ] Translate to Spanish (`es.json`)
- [ ] Translate to Simplified Chinese (`zh-CN.json`)
- [ ] Translate to Traditional Chinese (`zh-TW.json`)
- [ ] Review translations with native speakers (if possible)

### Component Updates
- [ ] Update `kiosk-welcome.tsx` to use translations
- [ ] Update `check-in/page.tsx` to use translations
- [ ] Update `kiosk-order-flow.tsx` to use translations
- [ ] Update all view components (MenuView, PodsView, PaymentView, CompleteView)
- [ ] Update error messages and loading states

### Receipt Printing
- [ ] Pass locale to PrintableReceipt component
- [ ] Create receipt translation helper
- [ ] Test printing in all languages

### Testing
- [ ] Test complete order flow in English
- [ ] Test complete order flow in Spanish
- [ ] Test complete order flow in Simplified Chinese
- [ ] Test complete order flow in Traditional Chinese
- [ ] Verify no missing translation keys (check console for warnings)
- [ ] Test language switching mid-flow

---

## Estimated Effort

| Task | Complexity | Est. Time |
|------|------------|-----------|
| Task 1: Welcome language selector | Medium | 1 hour |
| Task 2: Compact selector for flow | Low | 30 min |
| Task 3: Translation audit & creation | High | 2-3 hours |
| Task 4: Update all components | Medium | 1-2 hours |
| Task 5: Receipt translations | Low | 30 min |
| Testing all languages | Medium | 1 hour |

**Total Estimated Time:** 6-8 hours
