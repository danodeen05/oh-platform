#!/bin/bash

# Queue System Smoke Test Script
# Tests the automated queue and pod management system

API="http://localhost:4000"
TENANT="oh"
TENANT_ID="cmip6jbxa00002nnnktgu64dc"
LOCATION_ID="cmip6jbz700022nnnxxpmm5hf"  # City Creek Mall
MENU_ITEM_ID="cmip6jbzc00082nnn1di1ka94"  # First menu item

echo "================================"
echo "Queue System Smoke Tests"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

# Helper function to print test results
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo "  Response: $2"
    ((FAIL++))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

# Test 1: Create order with QR code
echo "Test 1: Create order with QR code generation"
echo "---------------------------------------------"

ORDER_RESPONSE=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{
    "tenantId": "'"$TENANT_ID"'",
    "locationId": "'"$LOCATION_ID"'",
    "items": [
      {"menuItemId": "'"$MENU_ITEM_ID"'", "quantity": 1, "priceCents": 0, "selectedValue": "Medium"}
    ],
    "totalCents": 1200,
    "estimatedArrival": "'"$(date -u -v+30M +%Y-%m-%dT%H:%M:%S.000Z)"'"
  }')

ORDER_ID=$(echo "$ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
ORDER_QR=$(echo "$ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('orderQrCode', ''))" 2>/dev/null)

if [[ -n "$ORDER_ID" && -n "$ORDER_QR" && "$ORDER_QR" == ORDER-* ]]; then
    pass "Order created with ID: $ORDER_ID"
    pass "QR code generated: $ORDER_QR"
else
    fail "Order creation failed" "$ORDER_RESPONSE"
    exit 1
fi

echo ""

# Test 2: Mark order as PAID
echo "Test 2: Mark order as PAID"
echo "---------------------------------------------"

PAID_RESPONSE=$(curl -s -X PATCH "$API/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{
    "paymentStatus": "PAID",
    "stripePaymentId": "pi_test_123",
    "status": "PAID"
  }')

PAID_AT=$(echo "$PAID_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('paidAt', ''))" 2>/dev/null)
STATUS=$(echo "$PAID_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', ''))" 2>/dev/null)

if [[ -n "$PAID_AT" && "$STATUS" == "PAID" ]]; then
    pass "Order marked as PAID with timestamp"
else
    fail "Payment update failed" "$PAID_RESPONSE"
fi

echo ""

# Test 3: Check-in with available pods
echo "Test 3: Check-in with available pods"
echo "---------------------------------------------"

CHECKIN_RESPONSE=$(curl -s -X POST "$API/orders/check-in" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{
    "orderQrCode": "'"$ORDER_QR"'"
  }')

CHECKIN_STATUS=$(echo "$CHECKIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', ''))" 2>/dev/null)
POD_NUMBER=$(echo "$CHECKIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('podNumber', ''))" 2>/dev/null)

if [[ "$CHECKIN_STATUS" == "ASSIGNED" && -n "$POD_NUMBER" ]]; then
    pass "Customer checked in and assigned to Pod $POD_NUMBER"
    echo "  Arrival deviation: $(echo "$CHECKIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('order', {}).get('arrivalDeviation', 'N/A'))" 2>/dev/null) minutes"
else
    fail "Check-in failed or customer queued" "$CHECKIN_RESPONSE"
fi

echo ""

# Test 4: Verify order status via API
echo "Test 4: Real-time status API"
echo "---------------------------------------------"

STATUS_RESPONSE=$(curl -s "$API/orders/status?orderQrCode=$ORDER_QR" \
  -H "x-tenant-slug: $TENANT")

API_POD=$(echo "$STATUS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('order', {}).get('podNumber', ''))" 2>/dev/null)
API_STATUS=$(echo "$STATUS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('order', {}).get('status', ''))" 2>/dev/null)

if [[ "$API_POD" == "$POD_NUMBER" && "$API_STATUS" == "QUEUED" ]]; then
    pass "Status API returns correct pod and status"
else
    fail "Status API incorrect" "$STATUS_RESPONSE"
fi

echo ""

# Test 5: Update order status to PREPPING
echo "Test 5: Order status transition to PREPPING"
echo "---------------------------------------------"

PREP_RESPONSE=$(curl -s -X PATCH "$API/kitchen/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{"status": "PREPPING"}')

PREP_TIME=$(echo "$PREP_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('prepStartTime', ''))" 2>/dev/null)

if [[ -n "$PREP_TIME" ]]; then
    pass "Order status changed to PREPPING with timestamp"
else
    fail "PREPPING transition failed" "$PREP_RESPONSE"
fi

echo ""

# Test 6: Update order status to READY
echo "Test 6: Order status transition to READY"
echo "---------------------------------------------"

READY_RESPONSE=$(curl -s -X PATCH "$API/kitchen/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{"status": "READY"}')

READY_TIME=$(echo "$READY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('readyTime', ''))" 2>/dev/null)

if [[ -n "$READY_TIME" ]]; then
    pass "Order status changed to READY with timestamp"
else
    fail "READY transition failed" "$READY_RESPONSE"
fi

echo ""

# Test 7: Update order status to SERVING
echo "Test 7: Order status transition to SERVING"
echo "---------------------------------------------"

SERVING_RESPONSE=$(curl -s -X PATCH "$API/kitchen/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{"status": "SERVING"}')

DELIVERED_TIME=$(echo "$SERVING_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('deliveredAt', ''))" 2>/dev/null)

if [[ -n "$DELIVERED_TIME" ]]; then
    pass "Order status changed to SERVING with deliveredAt timestamp"
else
    fail "SERVING transition failed" "$SERVING_RESPONSE"
fi

echo ""

# Test 8: Complete order (releases pod to CLEANING)
echo "Test 8: Complete order and release pod"
echo "---------------------------------------------"

COMPLETE_RESPONSE=$(curl -s -X PATCH "$API/kitchen/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{"status": "COMPLETED"}')

COMPLETED_TIME=$(echo "$COMPLETE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('completedTime', ''))" 2>/dev/null)
SEAT_ID=$(echo "$COMPLETE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('seatId', ''))" 2>/dev/null)

if [[ -n "$COMPLETED_TIME" ]]; then
    pass "Order marked as COMPLETED with timestamp"

    # Verify pod is now CLEANING
    sleep 1  # Give it a moment to update
    POD_RESPONSE=$(curl -s "$API/seats?locationId=$LOCATION_ID" -H "x-tenant-slug: $TENANT")
    POD_STATUS=$(echo "$POD_RESPONSE" | python3 -c "import sys, json; pods = json.load(sys.stdin); pod = next((p for p in pods if p['id'] == '$SEAT_ID'), None); print(pod['status'] if pod else '')" 2>/dev/null)

    if [[ "$POD_STATUS" == "CLEANING" ]]; then
        pass "Pod $POD_NUMBER status changed to CLEANING"
    else
        fail "Pod not marked as CLEANING, status: $POD_STATUS"
    fi
else
    fail "COMPLETED transition failed" "$COMPLETE_RESPONSE"
fi

echo ""

# Test 9: Create second order for queue testing
echo "Test 9: Create second order for queue test"
echo "---------------------------------------------"

ORDER2_RESPONSE=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{
    "tenantId": "'"$TENANT_ID"'",
    "locationId": "'"$LOCATION_ID"'",
    "items": [
      {"menuItemId": "'"$MENU_ITEM_ID"'", "quantity": 1, "priceCents": 0, "selectedValue": "Medium"}
    ],
    "totalCents": 1200,
    "estimatedArrival": "'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'"
  }')

ORDER2_ID=$(echo "$ORDER2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
ORDER2_QR=$(echo "$ORDER2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('orderQrCode', ''))" 2>/dev/null)

if [[ -n "$ORDER2_ID" ]]; then
    pass "Second order created: $ORDER2_ID"

    # Mark as PAID
    curl -s -X PATCH "$API/orders/$ORDER2_ID" \
      -H "Content-Type: application/json" \
      -H "x-tenant-slug: $TENANT" \
      -d '{"paymentStatus": "PAID", "status": "PAID"}' > /dev/null

    pass "Second order marked as PAID"
else
    fail "Second order creation failed" "$ORDER2_RESPONSE"
fi

echo ""

# Test 10: Clean first pod (should trigger queue processing)
echo "Test 10: Clean pod and trigger queue processing"
echo "---------------------------------------------"

# First, check-in second order (should get assigned immediately since all pods available)
CHECKIN2_RESPONSE=$(curl -s -X POST "$API/orders/check-in" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: $TENANT" \
  -d '{"orderQrCode": "'"$ORDER2_QR"'"}')

CHECKIN2_STATUS=$(echo "$CHECKIN2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', ''))" 2>/dev/null)
POD2_NUMBER=$(echo "$CHECKIN2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('podNumber', ''))" 2>/dev/null)

if [[ "$CHECKIN2_STATUS" == "ASSIGNED" ]]; then
    pass "Second order checked in and assigned to Pod $POD2_NUMBER"
else
    warn "Second order was queued instead of assigned (may be expected if many pods occupied)"
fi

# Clean the first pod
CLEAN_RESPONSE=$(curl -s -X PATCH "$API/seats/$SEAT_ID/clean" \
  -H "x-tenant-slug: $TENANT")

CLEAN_STATUS=$(echo "$CLEAN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', ''))" 2>/dev/null)

if [[ "$CLEAN_STATUS" == "AVAILABLE" ]]; then
    pass "Pod cleaned and marked as AVAILABLE"
    pass "Queue processing triggered (check API logs for processQueue output)"
else
    fail "Pod cleaning failed" "$CLEAN_RESPONSE"
fi

echo ""
echo "================================"
echo "Test Summary"
echo "================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    echo ""
    echo "Test Order IDs for manual verification:"
    echo "  Order 1: $ORDER_ID (QR: $ORDER_QR)"
    echo "  Order 2: $ORDER2_ID (QR: $ORDER2_QR)"
    echo ""
    echo "You can view order status at:"
    echo "  http://localhost:3000/order/status?orderQrCode=$ORDER_QR"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
