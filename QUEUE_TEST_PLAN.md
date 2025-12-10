# Queue System Test Plan

## Test Overview
This document outlines the test plan for the automated queue and pod management system.

## Test Environment
- API: http://localhost:4000
- Web: http://localhost:3000
- Admin: http://localhost:3001
- Database: PostgreSQL (local)
- Tenant: oh

## Test Scenarios

### 1. Order Creation with QR Code Generation
**Endpoint**: POST /orders
**Expected**: Order created with unique orderQrCode
**Verify**:
- orderQrCode field is populated
- Format matches: ORDER-{locationId}-{timestamp}-{random}
- orderQrCode is unique in database
- Order status is PENDING_PAYMENT

### 2. Payment Processing
**Endpoint**: PATCH /orders/:id (status: PAID)
**Expected**: Order marked as paid with timestamp
**Verify**:
- status changes to PAID
- paidAt timestamp is set
- No pod assigned yet (pod assignment happens at check-in)

### 3. Check-In with Available Pods
**Endpoint**: POST /orders/check-in
**Body**: { "orderQrCode": "ORDER-..." }
**Expected**: Immediate pod assignment
**Verify**:
- arrivedAt timestamp set
- arrivalDeviation calculated (if estimatedArrival exists)
- Pod assigned (seatId populated)
- Pod status changed to RESERVED
- podAssignedAt timestamp set
- podSelectionMethod set to "AUTO"
- Response includes pod number
- Response status is "ASSIGNED"
- Order status changed to QUEUED
- User arrival metrics updated

### 4. Check-In with No Available Pods (Queue)
**Endpoint**: POST /orders/check-in
**Prerequisites**: All pods OCCUPIED or RESERVED
**Expected**: Customer added to queue
**Verify**:
- WaitQueue entry created
- priority score calculated correctly
- queuePosition assigned
- estimatedWaitMinutes calculated
- Order status set to QUEUED
- Response status is "QUEUED"
- Response includes queue position and wait estimate

### 5. Priority Queue Calculation
**Test Cases**:
- CHOPSTICK tier customer (priority boost: +10)
- NOODLE_MASTER tier customer (priority boost: +25)
- BEEF_BOSS tier customer (priority boost: +50)
- On-time arrival (within 5 min, bonus: +20)
- Late arrival (>15 min, bonus: +30)
- High-value order (>$50, bonus: +5)

**Verify**: Priority scores match expected algorithm

### 6. Queue Processing When Pod Becomes Available
**Trigger**: PATCH /seats/:id/clean
**Expected**: Next customer in queue auto-assigned
**Verify**:
- processQueue() function called
- Highest priority customer selected from queue
- Pod assigned to customer
- Pod status changed to RESERVED
- WaitQueue status changed to ASSIGNED
- Order updated with seatId and podAssignedAt
- Notification sent (console log for now)
- notifiedAt and notificationMethod set

### 7. Order Status Transitions
**Test Each Transition**:
- PAID → QUEUED (at check-in or pod assignment)
- QUEUED → PREPPING (kitchen starts cooking)
- PREPPING → READY (food finished)
- READY → SERVING (food delivered to table)
- SERVING → COMPLETED (customer finished)

**Verify Timestamps**:
- prepStartTime set when PREPPING
- readyTime set when READY
- deliveredAt set when SERVING
- completedTime set when COMPLETED

### 8. Pod Release on Order Completion
**Endpoint**: PATCH /kitchen/orders/:id/status
**Body**: { "status": "COMPLETED" }
**Expected**: Pod released and queue processed
**Verify**:
- completedTime timestamp set
- Pod status changed to CLEANING
- processQueue() NOT called yet (waits for cleaning)

### 9. Pod Cleaning Triggers Queue
**Endpoint**: PATCH /seats/:id/clean
**Expected**: Pod marked available, queue processed
**Verify**:
- Pod status changed to AVAILABLE
- processQueue() called
- Next customer assigned (if queue not empty)

### 10. Real-Time Status API
**Endpoint**: GET /orders/status?orderQrCode=...
**Expected**: Complete order status returned
**Verify Response**:
- All order fields present
- Pod number (if assigned)
- Queue position (if queued)
- Location info
- All timestamps
- Order items list

### 11. Status Page UI
**URL**: /order/status?orderQrCode=...
**Expected**: Real-time status display
**Verify**:
- Page loads successfully
- Order status displayed correctly
- Progress bar shows correct percentage
- Pod assignment displayed (if assigned)
- Queue position displayed (if queued)
- Timeline shows all completed steps
- Auto-refresh works (5-second polling)

### 12. Confirmation Page Integration
**URL**: /order/confirmation?orderId=...
**Expected**: Track Order button appears
**Verify**:
- "Track Order Status" button visible (if orderQrCode exists)
- Button links to correct status page
- orderQrCode properly encoded in URL

## Edge Cases to Test

### EC1. Multiple Customers in Queue
**Setup**: 3+ customers waiting, 1 pod freed
**Expected**: Highest priority customer assigned
**Verify**: Correct prioritization

### EC2. Arrival Deviation Calculation
**Test Cases**:
- Customer arrives 10 min early (deviation: -10)
- Customer arrives exactly on time (deviation: 0)
- Customer arrives 20 min late (deviation: +20)
- Customer with no estimatedArrival (deviation: null)

### EC3. User Metrics Update
**After Multiple Check-Ins**:
- avgArrivalDeviation updated correctly
- arrivalAccuracy percentage correct
- onTimeArrivals count incremented

### EC4. Invalid QR Code
**Endpoint**: POST /orders/check-in
**Body**: { "orderQrCode": "INVALID" }
**Expected**: 404 error with message

### EC5. Duplicate Check-In
**Attempt to check-in same order twice**
**Expected**: Error message "Order already checked in"

### EC6. Check-In Before Payment
**Order with PENDING_PAYMENT status**
**Expected**: Error message "Order must be paid before check-in"

## Performance Tests

### P1. Queue Processing Speed
**Setup**: 20 customers in queue, 5 pods freed simultaneously
**Expected**: All 5 assigned within 1 second

### P2. Status API Response Time
**Expected**: < 200ms response time

### P3. Concurrent Check-Ins
**Setup**: 5 customers scan simultaneously
**Expected**: All processed correctly, no race conditions

## Test Results Log

### Test Run: [DATE/TIME]
| Test | Status | Notes |
|------|--------|-------|
| 1. Order Creation | ⏳ | |
| 2. Payment Processing | ⏳ | |
| 3. Check-In (pods available) | ⏳ | |
| 4. Check-In (queueing) | ⏳ | |
| 5. Priority Calculation | ⏳ | |
| 6. Queue Processing | ⏳ | |
| 7. Status Transitions | ⏳ | |
| 8. Pod Release | ⏳ | |
| 9. Pod Cleaning | ⏳ | |
| 10. Status API | ⏳ | |
| 11. Status Page UI | ⏳ | |
| 12. Confirmation Page | ⏳ | |

## Automation Script
See: `test-queue-flow.sh` (to be created)

## Known Issues
- Notification system uses placeholder (console.log only)
- Pod confirmation QR scanning not yet implemented
- No admin queue management UI yet

## Success Criteria
- ✅ All core test scenarios pass
- ✅ No database errors or race conditions
- ✅ Timestamps recorded accurately
- ✅ Queue processing fully automated
- ✅ Status page updates in real-time
- ✅ No manual staff intervention needed
