# Test Plan - Location and Kitchen Flow Updates

## Overview
This test plan covers all changes made to the kitchen display, pod management system, and order numbering features.

## Test Environment
- API Server: http://localhost:4000
- Admin App: http://localhost:3001
- Web App: http://localhost:3000
- Database: PostgreSQL (ohdb)

---

## 1. Daily Order Numbering System

### Test 1.1: Kitchen Order Number Generation
**Objective**: Verify that new orders receive sequential daily kitchen order numbers per location

**Steps**:
1. Create a new order via API for location A
2. Verify the order has a `kitchenOrderNumber` field
3. Check that the number is formatted as 4 digits (e.g., "0001")
4. Create a second order for the same location
5. Verify it gets the next sequential number (e.g., "0002")

**Expected Result**: Orders get sequential numbers starting from 0001

**API Endpoint**: `POST /orders`

---

### Test 1.2: Kitchen Order Number Per Location
**Objective**: Verify that kitchen order numbers are independent per location

**Steps**:
1. Create an order for Location A
2. Create an order for Location B
3. Verify both have kitchen order number "0001"

**Expected Result**: Each location has its own sequence

---

### Test 1.3: Kitchen Order Number Daily Reset
**Objective**: Verify that numbers only count PAID orders from today

**Steps**:
1. Check current count of today's orders
2. Create a new PAID order
3. Verify the kitchen order number matches today's count + 1

**Expected Result**: Only today's PAID orders are counted

---

### Test 1.4: Kitchen Display Shows Kitchen Order Number
**Objective**: Verify kitchen display shows simplified order numbers

**Steps**:
1. Navigate to http://localhost:3001/kitchen
2. Look at active orders
3. Verify order numbers display as "#0001", "#0002" etc.
4. Verify fallback to last 6 chars if kitchenOrderNumber is null

**Expected Result**: Kitchen display shows 4-digit numbers prominently

---

## 2. Kitchen Display UI Updates

### Test 2.1: Location in Header
**Objective**: Verify selected location appears in kitchen display header

**Steps**:
1. Navigate to http://localhost:3001/kitchen
2. Check header shows "Kitchen Display for [Location Name]"
3. Change location dropdown
4. Verify header updates with new location name

**Expected Result**: Header dynamically shows selected location

---

### Test 2.2: Location Dropdown Placement
**Objective**: Verify location dropdown is above kitchen display content

**Steps**:
1. Navigate to http://localhost:3001/kitchen
2. Verify location dropdown appears before the order columns

**Expected Result**: Dropdown is in a separate section above orders

---

### Test 2.3: Order Cards Show Pod Number
**Objective**: Verify order cards show pod assignment correctly

**Steps**:
1. Create an order and assign it to a pod
2. Check kitchen display
3. Verify order card shows "Pod [number]" instead of location name
4. For orders without pod assignment, verify shows "Dine-In"

**Expected Result**: Pod number or "Dine-In" displayed, no location name

---

### Test 2.4: Order Cards Show Slider Values
**Objective**: Verify slider customizations display in order items

**Steps**:
1. Create an order with slider items (e.g., Soup Richness: Rich)
2. Check kitchen display
3. Verify each item shows the selectedValue below the item name in gray

**Expected Result**: Customizations visible below item names

---

### Test 2.5: Auto-Refresh Functionality
**Objective**: Verify kitchen display auto-refreshes every 10 seconds

**Steps**:
1. Open kitchen display
2. In another tab, create a new order via API
3. Wait 10 seconds
4. Verify new order appears automatically

**Expected Result**: Display updates without manual refresh

---

## 3. Pod Management API Endpoints

### Test 3.1: Create Pod
**Objective**: Verify pod creation with auto-generated QR code

**Steps**:
1. POST to `/seats` with locationId and pod number
2. Verify response includes id, number, qrCode, status=AVAILABLE
3. Verify qrCode is a unique string
4. Check database to confirm pod was created

**Expected Result**: Pod created with unique QR code

**API Call**:
```bash
curl -X POST http://localhost:4000/seats \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: oh" \
  -d '{"locationId": "LOCATION_ID", "number": "001"}'
```

---

### Test 3.2: List Pods for Location
**Objective**: Verify fetching all pods for a specific location

**Steps**:
1. GET `/locations/{locationId}/seats`
2. Verify returns array of pods for that location only
3. Verify each pod has id, number, qrCode, status, orders array

**Expected Result**: Returns all pods for location with current orders

---

### Test 3.3: Update Pod Number
**Objective**: Verify pod number can be updated

**Steps**:
1. PATCH `/seats/{seatId}` with new number
2. Verify response shows updated number
3. Verify unique constraint enforced (can't duplicate number at same location)

**Expected Result**: Pod number updates successfully

---

### Test 3.4: Delete Pod
**Objective**: Verify pod deletion with safety checks

**Steps**:
1. Create a pod
2. DELETE `/seats/{seatId}`
3. Verify pod is deleted
4. Try to delete a pod with active orders
5. Verify deletion is prevented with error message

**Expected Result**: Can delete empty pods, blocked for pods with active orders

---

### Test 3.5: Assign Pod to Order (Auto)
**Objective**: Verify automatic pod assignment

**Steps**:
1. Create an order without specifying seatId
2. POST to `/orders/{orderId}/assign-pod` with no body
3. Verify system assigns first available pod
4. Verify pod status changes to RESERVED
5. Verify order has seatId and podAssignedAt timestamp

**Expected Result**: System auto-assigns first available pod

---

### Test 3.6: Assign Pod to Order (Manual)
**Objective**: Verify manual pod assignment

**Steps**:
1. Create an order
2. POST to `/orders/{orderId}/assign-pod` with specific seatId
3. Verify order is assigned to that specific pod
4. Verify pod status changes to RESERVED

**Expected Result**: Order assigned to specified pod

---

### Test 3.7: Confirm Pod Assignment
**Objective**: Verify customer QR confirmation updates status

**Steps**:
1. Assign a pod to an order
2. POST to `/orders/{orderId}/confirm-pod`
3. Verify pod status changes from RESERVED to OCCUPIED
4. Verify order has podConfirmedAt timestamp
5. Verify order status changes to QUEUED

**Expected Result**: Pod marked as occupied, order enters kitchen queue

---

### Test 3.8: Release Pod
**Objective**: Verify pod release changes status to CLEANING

**Steps**:
1. Create and confirm a pod assignment
2. POST to `/orders/{orderId}/release-pod`
3. Verify pod status changes to CLEANING
4. Verify seatId is NOT removed from order (for historical tracking)

**Expected Result**: Pod status becomes CLEANING

---

### Test 3.9: Mark Pod Clean
**Objective**: Verify marking pod clean returns it to available

**Steps**:
1. Get a pod in CLEANING status
2. PATCH `/seats/{seatId}/clean`
3. Verify pod status changes to AVAILABLE

**Expected Result**: Pod returns to available pool

---

### Test 3.10: Pod Status Lifecycle
**Objective**: Verify complete pod lifecycle

**Steps**:
1. Start with AVAILABLE pod
2. Assign to order → RESERVED
3. Customer confirms → OCCUPIED
4. Order completed → CLEANING
5. Staff marks clean → AVAILABLE

**Expected Result**: Pod goes through full lifecycle correctly

---

## 4. Pod Management Admin UI

### Test 4.1: View Pods Page
**Objective**: Verify pods management page loads correctly

**Steps**:
1. Navigate to http://localhost:3001/pods
2. Verify page shows location selector
3. Verify "Add Pod" button is visible
4. Verify pods grid displays

**Expected Result**: Page loads with all controls visible

---

### Test 4.2: Location Selector
**Objective**: Verify location selector filters pods

**Steps**:
1. Select different locations from dropdown
2. Verify pods list updates to show only pods for selected location
3. Verify location name displays correctly

**Expected Result**: Pods filtered by selected location

---

### Test 4.3: Status Summary Cards
**Objective**: Verify status summary shows correct counts

**Steps**:
1. Count pods in each status manually
2. Verify summary cards show matching counts
3. Create a new pod and verify Available count increments
4. Assign a pod and verify Reserved count increments

**Expected Result**: Status counts are accurate and update in real-time

---

### Test 4.4: Create New Pod
**Objective**: Verify pod creation via UI

**Steps**:
1. Click "Add Pod" button
2. Verify form appears
3. Enter pod number (e.g., "005")
4. Click "Create"
5. Verify pod appears in grid
6. Verify pod has QR code
7. Try creating duplicate number at same location
8. Verify error message appears

**Expected Result**: Can create pods, duplicates prevented

---

### Test 4.5: Edit Pod Number
**Objective**: Verify pod number editing

**Steps**:
1. Click "Edit" on a pod
2. Verify input field appears with current number
3. Change number
4. Click "Save"
5. Verify pod number updates
6. Click "Cancel" during edit
7. Verify changes are discarded

**Expected Result**: Can edit pod numbers, cancel works

---

### Test 4.6: Delete Pod
**Objective**: Verify pod deletion via UI

**Steps**:
1. Click "Delete" on an empty pod
2. Verify confirmation dialog appears
3. Confirm deletion
4. Verify pod is removed from list
5. Try deleting a pod with active order
6. Verify error message appears

**Expected Result**: Can delete empty pods, prevented for occupied pods

---

### Test 4.7: Mark Pod Clean
**Objective**: Verify marking pod clean via UI

**Steps**:
1. Get a pod in CLEANING status
2. Verify "Mark Clean" button appears
3. Click button
4. Verify pod status changes to AVAILABLE
5. Verify button disappears

**Expected Result**: Pod marked clean and returns to available

---

### Test 4.8: View Pod QR Code
**Objective**: Verify QR code modal displays correctly

**Steps**:
1. Click "QR Code" button on any pod
2. Verify modal appears with dark overlay
3. Verify modal shows pod number and location
4. Verify QR code image is displayed
5. Verify QR code value text is shown below
6. Click "Close" button
7. Verify modal closes
8. Open modal again and click outside
9. Verify modal closes

**Expected Result**: QR code modal works perfectly

---

### Test 4.9: Current Order Display
**Objective**: Verify occupied pods show current order info

**Steps**:
1. Assign and confirm a pod to an order
2. View pod in pods manager
3. Verify "Current Order" section appears
4. Verify shows kitchen order number
5. Verify shows order status

**Expected Result**: Active orders displayed in pod cards

---

### Test 4.10: Pod Card Styling
**Objective**: Verify pod cards have correct status colors

**Steps**:
1. View pods in different statuses
2. Verify AVAILABLE has green badge
3. Verify RESERVED has orange badge
4. Verify OCCUPIED has red badge
5. Verify CLEANING has blue badge

**Expected Result**: Status colors match design

---

## 5. QR Code Component

### Test 5.1: QR Code Component Renders
**Objective**: Verify QR code component displays correctly

**Steps**:
1. View QR code in pod modal
2. Verify white background with padding
3. Verify QR code is centered
4. Verify correct size (250px in modal)
5. Verify value text displays below

**Expected Result**: QR code renders cleanly

---

### Test 5.2: QR Code Scannability
**Objective**: Verify generated QR codes are scannable

**Steps**:
1. Display a pod QR code
2. Use a QR scanner app on phone
3. Verify it scans successfully
4. Verify scanned value matches displayed value

**Expected Result**: QR codes are scannable

---

## 6. Schema and Database

### Test 6.1: Prisma Schema Valid
**Objective**: Verify schema is valid and can generate client

**Steps**:
1. Run `pnpm prisma generate` in packages/db
2. Verify no errors
3. Verify PrismaClient is generated

**Expected Result**: Schema generates successfully

---

### Test 6.2: Schema Migrations
**Objective**: Verify schema can be pushed to database

**Steps**:
1. Run `pnpm db:push`
2. Verify schema pushes without errors
3. Check that all new fields exist in database

**Expected Result**: Database schema updated

---

### Test 6.3: Unique Constraints
**Objective**: Verify unique constraints work

**Steps**:
1. Try creating two pods with same number at same location
2. Verify second one fails
3. Create pods with same number at different locations
4. Verify both succeed

**Expected Result**: Constraints enforced properly

---

## 7. Integration Tests

### Test 7.1: Complete Order Flow
**Objective**: Verify end-to-end order flow with pod assignment

**Steps**:
1. Create an order (status: PENDING_PAYMENT)
2. Mark as PAID
3. Assign pod (auto or manual)
4. Confirm pod via QR
5. Verify order appears in kitchen display as QUEUED
6. Mark as PREPPING
7. Mark as READY
8. Mark as COMPLETED
9. Release pod
10. Mark pod clean

**Expected Result**: Full flow works without errors

---

### Test 7.2: Multi-Location Isolation
**Objective**: Verify locations are properly isolated

**Steps**:
1. Create orders at Location A
2. Create orders at Location B
3. Filter kitchen display to Location A
4. Verify only Location A orders show
5. Check pod management for Location A
6. Verify only Location A pods show

**Expected Result**: Data properly isolated by location

---

### Test 7.3: Kitchen Display Real-Time Updates
**Objective**: Verify kitchen display reflects API changes

**Steps**:
1. Open kitchen display
2. Use API to create and update orders
3. Verify changes appear within 10 seconds
4. Move orders through statuses
5. Verify columns update correctly

**Expected Result**: Kitchen display stays synchronized

---

## 8. Error Handling

### Test 8.1: Missing Required Fields
**Objective**: Verify API handles missing fields gracefully

**Steps**:
1. Try creating pod without locationId
2. Verify error message
3. Try creating pod without number
4. Verify error message

**Expected Result**: Clear error messages returned

---

### Test 8.2: Invalid IDs
**Objective**: Verify API handles invalid IDs

**Steps**:
1. Try assigning pod with invalid orderId
2. Verify 404 error
3. Try assigning invalid seatId
4. Verify 404 error

**Expected Result**: Proper error responses

---

### Test 8.3: Pod Already Assigned
**Objective**: Verify can't assign occupied pod

**Steps**:
1. Assign a pod to an order
2. Try assigning same pod to different order
3. Verify error message

**Expected Result**: Error prevents double-booking

---

### Test 8.4: Network Errors
**Objective**: Verify UI handles API failures

**Steps**:
1. Stop API server
2. Try loading kitchen display
3. Verify error message or loading state
4. Try creating pod via UI
5. Verify error handling

**Expected Result**: Graceful error handling

---

## Test Execution Summary

**Total Tests**: 50+
**Categories**:
- Daily Order Numbering (4 tests)
- Kitchen Display UI (5 tests)
- Pod Management API (10 tests)
- Pod Management UI (10 tests)
- QR Code Component (2 tests)
- Schema/Database (3 tests)
- Integration (3 tests)
- Error Handling (4 tests)

---

## Bug Tracking

Any bugs found during testing will be documented here:

| Test ID | Issue | Severity | Status | Fix |
|---------|-------|----------|--------|-----|
|         |       |          |        |     |
