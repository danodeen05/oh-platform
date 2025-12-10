# Phase 1 Implementation Progress

## Session Summary
Started implementing the fully automated queue and pod management system based on the refined requirements.

## Completed ✅

### 1. Prisma Schema Updates
**File**: `packages/db/prisma/schema.prisma`

**Order Model Enhancements:**
- Added `orderQrCode` field (unique, for kiosk/pod scanning)
- Added `SERVING` status (food delivered, customer eating)
- Added lifecycle timestamps:
  - `paidAt` - Payment success
  - `arrivedAt` - Kiosk check-in
  - `queuedAt` - Entered queue
  - `deliveredAt` - Food brought to table
- Added queue fields:
  - `queuePosition` - Position in line
  - `estimatedWaitMinutes` - Wait time estimate
  - `arrivalDeviation` - Minutes early/late
- Added pod reservation fields:
  - `podReservationExpiry` - Timeout for pod claims
  - `podSelectionMethod` - How pod was assigned
- Added notification tracking:
  - `notifiedAt` - When customer was notified
  - `notificationMethod` - Channel used

**WaitQueue Model (New):**
```prisma
model WaitQueue {
  id              String      @id
  orderId         String      @unique
  locationId      String
  arrivedAt       DateTime    // Actual arrival
  estimatedArrival DateTime?  // Selected arrival time
  priority        Int         // Queue priority score
  status          QueueStatus
  assignedAt      DateTime?
  expiredAt       DateTime?
}

enum QueueStatus {
  WAITING, ASSIGNED, CONFIRMED, EXPIRED
}
```

**User Model Enhancements:**
- `avgArrivalDeviation` - Historical arrival patterns
- `arrivalAccuracy` - On-time percentage
- `onTimeArrivals` - Count of on-time arrivals

**Database Migration:**
- ✅ Prisma client generated
- ✅ Schema pushed to database
- ✅ 79 existing orders preserved

## Next Steps (In Order)

### 2. Order Creation - Add QR Code Generation
**File to modify**: `packages/api/src/index.js`
**Location**: `app.post("/orders")` endpoint (~line 895)

**Changes needed:**
```javascript
// Generate order QR code
const orderQrCode = `ORDER-${locationId}-${Date.now()}-${generateRandomString(6)}`;

const order = await prisma.order.create({
  data: {
    // ... existing fields
    orderQrCode,
    // ... rest
  }
});
```

### 3. Check-In Endpoint (NEW)
**File**: `packages/api/src/index.js`
**New endpoint**: `POST /orders/:orderQrCode/check-in`

**Functionality:**
- Scan order QR at kiosk
- Record `arrivedAt` timestamp
- Calculate `arrivalDeviation`
- Check pod availability
- If available → assign pod
- If not → add to WaitQueue with priority calculation
- Return assignment or queue status

### 4. Queue Processing Logic (NEW)
**File**: `packages/api/src/index.js`
**New function**: `processQueue(locationId)`

**Triggered by:**
- Pod becomes AVAILABLE
- Called automatically when order COMPLETED

**Logic:**
- Get all WAITING queue entries for location
- Sort by priority (desc)
- Get available pods
- Assign pods to top N in queue
- Send notifications
- Update queue status to ASSIGNED

### 5. Order Status Transitions
**Files to update**: `packages/api/src/index.js`

**Endpoints to add/modify:**
- `PATCH /orders/:id/status` - Generic status updater
- `POST /orders/:id/start-prep` - QUEUED → PREPPING
- `POST /orders/:id/mark-ready` - PREPPING → READY
- `POST /orders/:id/mark-delivered` - READY → SERVING
- `POST /orders/:id/complete` - SERVING → COMPLETED (triggers pod release)

### 6. Real-Time Status API
**New endpoint**: `GET /orders/:orderQrCode/status`

**Returns:**
```json
{
  "order": {
    "id": "...",
    "status": "QUEUED",
    "queuePosition": 5,
    "estimatedWaitMinutes": 12,
    "podNumber": "07",
    "podAssignedAt": "...",
    "...": "..."
  }
}
```

### 7. Order Status Tracking Page
**New file**: `apps/web/app/order/status/page.tsx`

**Features:**
- Real-time polling (every 5s)
- Progress bar visualization
- Queue position display
- Pod assignment display
- Notification when pod ready

### 8. Notification System Hooks
**New file**: `packages/api/src/notifications.js`

**Functions:**
```javascript
async function notifyPodReady(order) {
  // Push notification (placeholder)
  // SMS notification (placeholder)
  // Email notification (placeholder)
  await updateOrder({ notifiedAt, notificationMethod });
}

async function notifyQueueUpdate(order) {
  // Update customer on queue position
}
```

### 9. Pod Confirmation Update
**File**: `packages/api/src/index.js`
**Endpoint**: `POST /orders/:id/confirm-pod`

**Changes:**
- Accept `orderQrCode` instead of pod QR code
- Validate order is assigned to this pod
- Mark as confirmed
- Update WaitQueue status to CONFIRMED

### 10. Testing
**Create test script**: `test-queue-flow.sh`

**Test scenarios:**
1. ASAP order, pods available → immediate assignment
2. Future order, check-in, pods available → immediate assignment
3. Check-in, no pods → queue → pod freed → auto-assign → notification
4. Queue with multiple priorities (tiers, wait times)
5. Pod reservation expiry
6. Complete flow end-to-end

## Architecture Decisions Made

### Queue Priority Algorithm
```typescript
priority =
  waitMinutes * 1.0 +
  tierBoost (BEEF_BOSS: 50, NOODLE_MASTER: 25, CHOPSTICK: 10) +
  arrivalBonus (on-time: +20, late: +30) +
  orderValueBonus (>$50: +5)
```

### Pod Assignment Strategy
1. **ASAP/Soon orders** → Pod selection UI (if available)
2. **Check-in** → Auto-assign or queue
3. **Queue processing** → Priority-based automatic assignment
4. **No staff intervention** → Fully automated

### Notification Channels
1. **Primary**: Push notifications (web/mobile)
2. **Backup**: SMS (via Twilio/similar)
3. **Fallback**: Email
4. **Always**: Real-time status page updates

### Timing Constants
- Queue check interval: 30 seconds
- Pod reservation timeout: 10 minutes
- Pod cleaning time: 2 minutes
- Status polling interval: 5 seconds
- No-show timeout: 5 minutes after assignment

## Key Files Modified

1. ✅ `packages/db/prisma/schema.prisma` - Schema updates
2. ⏳ `packages/api/src/index.js` - API endpoints
3. ⏳ `apps/web/app/order/status/page.tsx` - Status tracking page
4. ⏳ `apps/web/app/order/confirmation/page.tsx` - Update to use orderQrCode
5. ⏳ `apps/web/app/order/scan/page.tsx` - Update to scan order QR
6. ⏳ `apps/admin/app/kitchen/kitchen-display.tsx` - Add SERVING status
7. ⏳ `apps/admin/app/queue/page.tsx` - NEW: Queue management view

## API Endpoints Summary

### Existing (to modify):
- `POST /orders` - Add orderQrCode generation
- `POST /orders/:id/assign-pod` - Keep for manual assignment
- `POST /orders/:id/confirm-pod` - Change to use orderQrCode
- `PATCH /orders/:id` - Add status transitions

### New endpoints needed:
- `POST /orders/:orderQrCode/check-in` - Kiosk check-in
- `GET /orders/:orderQrCode/status` - Real-time status
- `GET /queue/:locationId` - View queue
- `POST /queue/:locationId/process` - Manual queue processing (admin)
- `GET /arrivals/:locationId/forecast` - Predicted arrivals

## Database Queries to Optimize

```sql
-- Get next in queue
SELECT * FROM WaitQueue
WHERE locationId = ? AND status = 'WAITING'
ORDER BY priority DESC
LIMIT 1;

-- Get available pods
SELECT * FROM Seat
WHERE locationId = ? AND status = 'AVAILABLE';

-- Predict arrivals
SELECT COUNT(*) FROM Order
WHERE locationId = ?
  AND estimatedArrival BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
  AND arrivedAt IS NULL;
```

## Current State

**Schema**: ✅ Complete and deployed
**API**: ✅ 90% complete (all core endpoints implemented)
**UI**: ✅ 80% complete (status page created, confirmation page updated)
**Queue System**: ✅ Complete and automated
**Notifications**: 🔄 Placeholder functions ready (push/SMS need real integration)

**Estimated remaining work**: 1-2 hours of testing + notification integration

## Session 2 Accomplishments

### Completed Implementation ✅

1. **Order QR Code Generation** (packages/api/src/index.js:946-956)
   - Generates unique orderQrCode for each order
   - Format: `ORDER-{locationId}-{timestamp}-{random}`
   - Stored in database for scanning at kiosk and pod

2. **Check-In Endpoint** (packages/api/src/index.js:790-967)
   - POST /orders/check-in
   - Scans orderQrCode at kiosk
   - Calculates arrival deviation vs estimated time
   - Auto-assigns pod if available
   - Or adds to priority queue if pods full
   - Updates user arrival accuracy metrics

3. **Queue Processing Logic** (packages/api/src/index.js:28-123)
   - processQueue() function
   - Priority-based assignment algorithm
   - Automatically triggered when pods become available
   - Integrated into pod cleaning workflow (line 1147)
   - Integrated into order completion workflow (line 2003-2014)

4. **Order Status Transitions** (packages/api/src/index.js:1967-2017)
   - PATCH /kitchen/orders/:id/status
   - Sets timestamps for PREPPING, READY, SERVING, COMPLETED
   - Releases pod when order completed
   - Marks pod as CLEANING when customer done

5. **Real-Time Status API** (packages/api/src/index.js:969-1044)
   - GET /orders/status?orderQrCode=...
   - Returns full order status with timestamps
   - Includes pod assignment, queue position, location info
   - Used by customer-facing status page

6. **Order Status Tracking Page** (apps/web/app/order/status/page.tsx)
   - Real-time status display with 5-second polling
   - Progress bar visualization
   - Pod assignment display
   - Queue position tracker
   - Timeline of order events
   - Fully responsive mobile-first design

7. **Confirmation Page Updates** (apps/web/app/order/confirmation/page.tsx:550-573)
   - Added "Track Order Status" button
   - Links to status page with orderQrCode
   - Conditional display based on order data

8. **Notification System Hooks** (packages/api/src/index.js:125-146)
   - notifyPodReady() function created
   - Placeholder for push notifications
   - Placeholder for SMS via Twilio
   - Placeholder for email notifications
   - Tracks notification method and timestamp in database

## Next Steps (Priority Order)

### Remaining Tasks

1. **Testing** ⏳
   - Test check-in flow (with/without available pods)
   - Test queue processing when pod freed
   - Test status page real-time updates
   - Test complete end-to-end flow
   - Verify all timestamps recorded correctly

2. **Notification Integration** (Optional - can be done later)
   - Implement web push notifications
   - Integrate SMS via Twilio
   - Set up email templates
   - Test notification delivery

3. **Pod Selection UI** (Future Enhancement)
   - Movie theater-style pod map
   - For ASAP orders when pods available
   - Allow customer to choose preferred pod

4. **Queue Management Admin View** (Future Enhancement)
   - apps/admin/app/queue/page.tsx
   - View current queue for location
   - Manual queue management if needed
   - Queue analytics and metrics

---

**Session 2 ended**: Core queue system fully implemented and automated
**Next session**: Testing and validation of complete flow
**Optional next**: Notification integration (push/SMS/email)
