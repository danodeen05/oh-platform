# Group Order, Guest Checkout & Couple Pods - Feature Design

> **Status:** Ready for implementation
> **Last Updated:** December 13, 2024
> **Next Step:** Phase 1 - Schema changes + Guest Checkout

---

## Overview

This document captures the complete design for three interconnected features:
1. **Group Orders** - Allow multiple people to order together with flexible payment options
2. **Guest Checkout** - Allow unauthenticated customers to order without creating an account
3. **Couple Pods** - Special 2-seat pods for couples, with smart assignment logic

---

## Couple Pods

### Configuration
- Two adjacent seats can be linked as a "Couple Pod" via a partner reference
- Both seats must reference each other (bidirectional link)
- On the seating map, linked seats display as one merged pod
- Configure via existing pod management page in admin (will need enhancement)

### Assignment Rules
- Couple pods are ONLY assignable to groups with exactly 2 orders
- Single orders can NEVER be auto-assigned to a couple pod
- If a group of 2 wants a couple pod but none available, fall back to 2 adjacent singles
- Groups of 3+ are NEVER assigned couple pods - only singles

---

## Group Orders

### Creation
- Host initiates group order, selects location, gets a 6-character shareable code
- Group expires automatically after 30 minutes OR when host manually closes
- Guests join via link (`/group/CODE`) or QR scan
- **Max group size: 8 people**

### Join Methods
- **Option A (Remote):** Host shares link, guests open on their phones
- **Option B (In-Person):** Host shows QR code, guests scan to join
- **Option C (Kiosk):** Walk-in group starts at kiosk, passes device between members

### Membership
- Each guest builds and submits their own order (not paid yet)
- Orders are held in PENDING_PAYMENT until group payment completes
- Host sees all submitted orders in real-time

### Member Deletion
- Any member can delete their own order before:
  - Their individual payment is made (Pay Your Own mode), OR
  - The host finalizes and pays (Host Pays All mode)
- Once payment is made for an order, it cannot be deleted
- Host cannot delete other members' orders (only their own)
- If host deletes their order, they must transfer host role to another member OR cancel the entire group

### Closing
- Host can close early ("We're all here") or system auto-closes at 30 min
- No new members can join after close
- Guests who haven't submitted are dropped from group

### Payment Options
- **Host Pays All:** Single charge for total of all orders
- **Pay Your Own:** Each guest pays their own subtotal individually

### Payment Failure Handling (Pay Your Own)
- Paid members proceed normally and receive their QR codes
- Failed members see retry prompt, do not block others
- Group status shows "Partially Paid" until all complete or failed members retry/cancel

---

## Seating Assignment for Groups

### Priority Order
1. **Group of 2:** Couple pod if available → 2 adjacent singles → 2 closest singles → queue
2. **Group of 3+:** Adjacent singles (lowest proximity score) → closest available singles → queue individually

### Proximity Scoring
- Score = sum of distances between all seat pairs in the group
- Distance = |row difference| + |column difference|
- Lower score = better clustering

### Busy Location Fallback
- If not enough adjacent/close seats available, each order enters the standard queue
- Notify group: "We'll seat you as pods become available"

---

## Guest Checkout

### Entry Points
- Homepage: Primary "Order Now" button opens Clerk sign-in; secondary "Continue as Guest" link skips auth
- Kiosk: Guest checkout is the default (no sign-in required)

### Session
- Guest session created on first visit, stored in secure cookie
- Session lasts 24 hours
- Guest provides name (required) and phone/email (optional) at checkout
- **Guest data retained indefinitely** for restaurant records and analytics

### Limitations vs Members
- No referral credits earned or redeemable
- No tier progression or badges
- No order history after session expires
- No saved favorites

### Conversion Prompt
- Show subtle "Create account for rewards" banner during checkout
- Non-blocking - can dismiss and continue as guest

---

## Kiosk Flow

### Party Size Selection
- First screen asks: "How many dining today?"
- 1 person → standard single order flow
- 2+ people → "One check or separate checks?"

### One Check (Host Pays All)
- First person orders → "Pass to next guest" → repeat → single payment at end

### Separate Checks (Pay Your Own)
- First person orders + pays → "Pass to next guest" → repeat
- Each person completes their own payment before passing

### Pod Selection
- Kiosk always shows the seating map after order/payment
- Customers select their own pod(s) from available options
- Couple pods only appear selectable for groups of 2
- Selection follows same rules: couple pod for 2, singles for 3+

### Queue Handling
- If no pods available (or not enough for the group), customer enters queue
- Kiosk prints a physical queue ticket with queue number (e.g., "#1234")
- Customer waits in designated area

### Overhead Queue Display
- Separate display screen shows queue status
- Format: "#1234 is now ready - Pod 07" / "#1235 is next"
- Updates in real-time as pods become available
- Audio chime when number is called (optional per location config)

### Security
- Staff PIN required to exit kiosk mode

---

## Schema Changes Required

### Seat Model Additions
- `podType`: SINGLE or COUPLE
- `couplePartner`: Reference to paired seat ID (bidirectional)

### New GroupOrder Model
- `code`: 6-character shareable code
- `hostUserId` / `hostGuestId`: Host can be member or guest
- `locationId`, `tenantId`: Location context
- `status`: GATHERING → CLOSED → PAYING → PAID / PARTIALLY_PAID / CANCELLED
- `paymentMethod`: HOST_PAYS_ALL or PAY_YOUR_OWN
- `estimatedArrival`: When group plans to arrive
- `expiresAt`: Auto-cancel time (30 min from creation)
- `closedAt`: When host closed for new members
- `finalizedAt`: When payment completed

### New Guest Model
- `name`: Required at checkout
- `phone`, `email`: Optional
- `sessionToken`: For cookie-based session
- `expiresAt`: Session expiry (24 hours)
- Data retained indefinitely

### Order Model Additions
- `groupOrderId`: Link to GroupOrder
- `isGroupHost`: Boolean flag
- `guestId`: Link to Guest (alternative to userId)

---

## Implementation Phases

### Phase 1: Foundation (Schema + Guest Checkout)
1. Add schema changes (Guest, GroupOrder, Seat enhancements)
2. Run migration
3. Implement guest session middleware
4. Update homepage CTAs ("Order Now" + "Continue as Guest")
5. Allow guest ordering flow
6. Update payment to handle guest orders

### Phase 2: Couple Pods
1. Enhance admin pod management page for couple pod config
2. Update seed data with example couple pods
3. Update seating map UI to show merged couple pods
4. Implement couple pod assignment logic
5. Restrict couple pod selection to 2-person groups

### Phase 3: Group Orders (Core)
1. Create GroupOrder API endpoints
2. Build "Group Order" and "Dine Together" entry UI
3. Build group join page (`/group/[code]`)
4. Build group status/lobby page
5. Implement host controls (close group, select payment, transfer host)
6. Implement member deletion (before payment)
7. Wire up payment flows (host pays / pay your own)

### Phase 4: Kiosk Flow
1. Create kiosk-specific UI (`/kiosk`)
2. Build party size selector
3. Implement pass-to-next-person flow
4. Add staff PIN protection for exiting kiosk mode
5. Integrate queue ticket printing
6. Build overhead queue display page
7. Test with tablet/large screen

### Phase 5: Polish
1. Add group order indicators to kitchen display
2. Proximity-based pod assignment for 3+ groups
3. Notifications when group is ready
4. Analytics for group orders
5. Audio chime configuration per location

---

## Confirmed Decisions

| Question | Decision |
|----------|----------|
| Couple pod admin UI | Enhance existing pod management page |
| Hard group cap | Max 8 people per group |
| Guest data retention | Indefinite (for records/analytics) |
| Kiosk security | Staff PIN required to exit kiosk mode |
