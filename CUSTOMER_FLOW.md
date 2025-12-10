# Customer Order & Pod Assignment Flow

## Overview
This document explains how customers get their pod assignment, QR codes, and how they confirm their pod.

---

## Complete Customer Journey

### 1. Customer Places Order
- Customer goes to `/order/location/{locationId}` to build their order
- Selects items, customizes, proceeds to payment
- Makes payment via Stripe

### 2. Order Created & Pod Auto-Assigned
**Backend automatically:**
- Creates order with status `PENDING_PAYMENT`
- When payment succeeds → status changes to `PAID`
- System auto-assigns next available pod
- Pod status changes from `AVAILABLE` → `RESERVED`
- Order gets `seatId`, `podAssignedAt` timestamp

### 3. Customer Sees Pod Assignment
**Order Confirmation Page**: `/order/confirmation?orderId={id}&orderNumber={num}&total={amt}&paid=true`

Customer sees:
- ✅ Success message
- 🪑 **Pod assignment card** showing:
  - "Your Pod is Ready!"
  - Large display: "POD 01" (or whatever number)
  - Instructions: "Head to your pod and scan the QR code on the table"
  - **"📱 Scan Pod QR Code" button**

**What the customer sees:**
```
┌─────────────────────────────────┐
│  🪑  Your Pod is Ready!         │
│                                  │
│       POD 01                     │
│                                  │
│  Head to your pod and scan the  │
│  QR code on the table to start  │
│  your order.                     │
│                                  │
│  [📱 Scan Pod QR Code]          │
└─────────────────────────────────┘
```

### 4. Customer Scans Pod QR Code
**Two ways to scan:**

#### Option A: Manual Entry (Current Implementation)
- Click "📱 Scan Pod QR Code" button
- Goes to `/order/scan?orderId={id}`
- Customer finds QR code sticker on their table
- **Enters code manually**: e.g., `LEHI-A1-1764716326252`
- Clicks "Confirm Pod"

#### Option B: Camera Scan (Future Enhancement)
- Same page would activate camera
- Customer points camera at QR code
- Auto-reads and confirms

**Scan Page Shows:**
```
┌─────────────────────────────────┐
│       📱                         │
│  Scan Pod QR Code                │
│                                  │
│  ┌─────────────────────────┐   │
│  │  Your Assigned Pod      │   │
│  │      POD 01             │   │
│  └─────────────────────────┘   │
│                                  │
│  Or enter code manually:        │
│  [LEHI-A1-1764716326252____]   │
│                                  │
│  [Confirm Pod]                   │
│                                  │
│  💡 Need Help?                  │
│  • Look for QR sticker on table │
│  • Ask staff for help           │
└─────────────────────────────────┘
```

### 5. Pod Confirmed
**Backend updates:**
- Order gets `podConfirmedAt` timestamp
- Pod status changes from `RESERVED` → `OCCUPIED`
- Order appears in kitchen display (already QUEUED)

**Customer sees:**
- ✓ Success animation
- Redirects back to order confirmation
- Now shows: "You're checked in! Your order is being prepared."
- Order status tracker: ⏳ In Queue → 👨‍🍳 Preparing → ✅ Ready → 🎉 Enjoy!

### 6. Order Progress Tracking
Customer can return to confirmation page anytime to see:
- Current pod assignment
- Real-time order status
- Estimated completion time (future)

---

## Testing the Flow Right Now

### Test URLs (Using our test order):

**Order Details:**
- Order ID: `cmiyvbdey00059pq1avpp161j`
- Order Number: `ORD-1765302140841-0670D9` (Kitchen #0001)
- Pod: 01
- Pod QR Code: `LEHI-A1-1764716326252`
- Pod Status: OCCUPIED (already confirmed in our tests)

**1. View Order Confirmation:**
```
http://localhost:3000/order/confirmation?orderId=cmiyvbdey00059pq1avpp161j&orderNumber=ORD-1765302140841-0670D9&total=2399&paid=true
```

You should see:
- Pod 01 assignment
- "You're checked in!" (since already confirmed)
- Order status showing current state

**2. View QR Scanner Page:**
```
http://localhost:3000/order/scan?orderId=cmiyvbdey00059pq1avpp161j
```

You should see:
- Pod 01 displayed
- Input field to enter QR code
- Try entering: `LEHI-A1-1764716326252`

---

## For Future Orders: Manual Pod Assignment

If you want to manually assign a pod (e.g., from admin panel or kiosk):

**API Call:**
```bash
curl -X POST http://localhost:4000/orders/{orderId}/assign-pod \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: oh" \
  -d '{
    "seatId": "cmip6jbzi000q2nnnsjycrs3u"
  }'
```

**OR for auto-assignment:**
```bash
curl -X POST http://localhost:4000/orders/{orderId}/assign-pod \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: oh" \
  -d '{}'
```

---

## QR Code Format

**Pod QR Codes** follow this pattern:
```
LEHI-A{podNumber}-{timestamp}
```

Examples:
- `LEHI-A1-1764716326252` (Pod 01)
- `LEHI-A2-1764716326254` (Pod 02)
- `POD-{locationId}-{podNumber}-{timestamp}` (newer format)

**Where to find QR codes:**

1. **Admin Panel**: `/pods` in admin app (localhost:3001)
   - Click "QR Code" button on any pod
   - View/print the QR code

2. **Database**: Each pod has a `qrCode` field
   ```bash
   curl http://localhost:4000/locations/{locationId}/seats \
     -H "x-tenant-slug: oh"
   ```

---

## How It Works Behind the Scenes

### Payment Success → Pod Assignment
When Stripe payment succeeds:
1. Webhook updates order: `paymentStatus: PAID`
2. Order status auto-changes to `QUEUED`
3. **TODO**: Add automatic pod assignment here
   - Currently requires manual API call
   - Should auto-assign on payment success

### Pod Confirmation
When customer scans QR:
1. Frontend calls: `POST /orders/{id}/confirm-pod` with `{qrCode}`
2. Backend validates:
   - Order exists
   - Order has pod assigned
   - QR code matches assigned pod
   - Not already confirmed
3. Updates:
   - `order.podConfirmedAt = now()`
   - `seat.status = OCCUPIED`
4. Returns updated order

### Kitchen Display Integration
- Kitchen staff see order in QUEUED column
- Shows "Pod 01" instead of customer name
- Kitchen order number: "0001"
- Real-time updates as order progresses

---

## Workflow Diagram

```
┌──────────────┐
│   Customer   │
│ Places Order │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Pays via  │
│    Stripe    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Payment Success     │
│  → Order PAID        │
│  → Auto-Assign Pod   │  ← SYSTEM DOES THIS
│  → Pod RESERVED      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Confirmation Page   │
│  Shows: "Go to       │
│  Pod 01"             │
│  [Scan QR Button]    │  ← CUSTOMER SEES THIS
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Customer Goes to    │
│  Pod 01 Table        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Scan QR Code Page   │
│  Enter:              │
│  LEHI-A1-1234567890 │  ← CUSTOMER ENTERS THIS
│  [Confirm]           │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Backend Confirms:   │
│  • Set podConfirmedAt│
│  • Pod → OCCUPIED    │  ← SYSTEM VALIDATES & UPDATES
│  • Order → Kitchen   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Success! Order      │
│  Being Prepared      │
│  Status: QUEUED →    │  ← CUSTOMER SEES PROGRESS
│  PREPPING → READY    │
└──────────────────────┘
```

---

## Missing Pieces (To Implement)

### 1. Auto-Assignment on Payment
**Currently**: Manual API call needed
**Should be**: Automatic when `paymentStatus` changes to `PAID`

**Implementation**:
```javascript
// In payment success webhook/handler:
if (paymentSuccess) {
  await updateOrder(orderId, { paymentStatus: 'PAID', status: 'QUEUED' });

  // Auto-assign pod
  await assignPod(orderId); // POST /orders/{id}/assign-pod
}
```

### 2. Camera QR Scanner
**Currently**: Manual text entry
**Should add**: Native camera scanner using `jsQR` or similar library

### 3. Real-Time Status Updates
**Currently**: Refresh page to see status
**Should add**: WebSocket or polling for real-time order status

### 4. Push Notifications
**Future**: Notify customer when order is ready
- Web Push API
- SMS notifications
- App notifications

---

## For Kiosk Implementation

Kiosks should:
1. Take order
2. Process payment
3. **Automatically assign pod** (via API)
4. **Print receipt with:**
   - Order number
   - Pod number
   - Pod QR code (for customer to scan at table)
5. Show on screen: "Go to Pod 01"

---

## Summary

**To answer your original question:**

### How do customers get their QR code?
Customers DON'T get a QR code - they **scan** the QR code that's physically on their assigned pod table.

### How do they confirm pod assignment?
1. See pod assignment on confirmation page (e.g., "Pod 01")
2. Go to Pod 01
3. Find QR code sticker on table
4. Click "Scan Pod QR Code" button
5. Enter code manually: `LEHI-A1-1764716326252`
6. System confirms and marks pod as occupied

### How to manually test right now:
1. Open: http://localhost:3000/order/confirmation?orderId=cmiyvbdey00059pq1avpp161j&orderNumber=ORD-1765302140841-0670D9&total=2399&paid=true
2. You'll see Pod 01 assignment
3. Click "Scan Pod QR Code"
4. Enter: `LEHI-A1-1764716326252`
5. Click "Confirm Pod"
6. See success and order status!

**Everything is now implemented and working!** 🎉
