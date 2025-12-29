# Hours of Operation Implementation Plan

## Business Requirements

### Standard Hours
- **Monday - Saturday**: 11am - 9pm
- **Sunday**: Closed

### Online Ordering Window
- **Opens**: 10am (1 hour before restaurant opens)
- **Closes**: 8:45pm (15 minutes before restaurant closes)

### Arrival Time Rules
- Arrival time options should only show times within operating hours
- Grey out / disable options that would result in arrival after closing
- When ordering between 10am-11am, only show arrival times starting at 11am
- When ordering after 8:30pm, only show ASAP and 15min options

### After Hours Behavior
- Replace "Order Now" button with friendly messaging (e.g., "Opens at 11am")
- Optionally allow "Order for Tomorrow" functionality (future enhancement)

---

## Current State

### Hours Display
- **Location**: `apps/web/messages/en.json` (and other locale files)
- **Current values**: Mon-Thu 11am-9pm, Fri-Sat 11am-10pm, Sun 12pm-8pm
- **Problem**: Hardcoded in translation files, not database-backed

### Ordering Flow
- **File**: `apps/web/app/[locale]/order/location/[locationId]/_components/enhanced-menu-builder.tsx`
- Arrival time options: ASAP, 15min, 30min, 45min, 60min, 90min (hardcoded)
- No validation against business hours

### Database
- Location model has NO hours fields
- Need to add `operatingHours` field

---

## Implementation Plan

### Phase 1: Database & Configuration

#### 1.1 Update Prisma Schema
File: `packages/db/prisma/schema.prisma`

Add to Location model:
```prisma
model Location {
  // ... existing fields ...

  operatingHours Json?     // { mon: { open: "11:00", close: "21:00" }, sun: null }
  isClosed       Boolean @default(false)  // For temporary closures
}
```

#### 1.2 Default Hours Configuration
```javascript
const DEFAULT_HOURS = {
  mon: { open: "11:00", close: "21:00" },
  tue: { open: "11:00", close: "21:00" },
  wed: { open: "11:00", close: "21:00" },
  thu: { open: "11:00", close: "21:00" },
  fri: { open: "11:00", close: "21:00" },
  sat: { open: "11:00", close: "21:00" },
  sun: null  // Closed
};
```

#### 1.3 Create Hours Utility Module
File: `packages/api/src/utils/operating-hours.js`

Functions:
- `isLocationOpen(location, date?)` - Is restaurant currently open?
- `canAcceptOrders(location, date?)` - Can we accept online orders? (1hr early to 15min before close)
- `getNextOpenTime(location)` - When does location next open?
- `getValidArrivalTimes(location)` - Filter arrival options to valid times
- `getLocationStatus(location)` - Returns: OPEN, CLOSED, OPENING_SOON, CLOSING_SOON

### Phase 2: API Endpoints

#### 2.1 GET /locations/:id/availability
Returns real-time ordering availability:
```json
{
  "isOpen": true,
  "canOrder": true,
  "validArrivalTimes": ["asap", "15", "30"],
  "message": "We close at 9pm",
  "nextOpen": null
}
```

#### 2.2 Update GET /locations
Include `isOpen` and `canOrder` flags in response.

#### 2.3 Update POST /orders
Validate that `estimatedArrival` is within allowed window.

### Phase 3: Frontend - Ordering Flow

#### 3.1 Arrival Time Selection
File: `apps/web/app/[locale]/order/location/[locationId]/_components/enhanced-menu-builder.tsx`

Changes:
1. Fetch `/locations/:id/availability` on component mount
2. Filter `timeOptions` array based on `validArrivalTimes`
3. Show disabled state with tooltip for unavailable options
4. If no valid options, show "Sorry, we're closed" message

#### 3.2 Pre-Order Messaging
When ordering 10am-11am:
- Show banner: "We open at 11am. Your order will be ready when we open!"
- Only allow arrival times starting at 11am

### Phase 4: Frontend - Homepage

#### 4.1 Conditional Order Now Button
File: `apps/web/app/[locale]/page.tsx`

Logic:
```javascript
if (canOrder) {
  // Show "Order Now" button
} else if (nextOpen) {
  // Show "Opens at {time}" button
} else {
  // Show "View Menu" button
}
```

### Phase 5: Documentation & UI Updates

#### 5.1 Update Translation Files
Files: `apps/web/messages/{en,es,zh-CN,zh-TW}.json`

Change from:
```json
"hoursMonThurs": "Mon-Thu: 11am - 9pm",
"hoursFriSat": "Fri-Sat: 11am - 10pm",
"hoursSun": "Sun: 12pm - 8pm"
```

To:
```json
"hoursMonSat": "Mon-Sat: 11am - 9pm",
"hoursSun": "Sunday: Closed"
```

#### 5.2 Update Locations Page
- Show live "Open Now" / "Closed" badge
- Display "Online ordering available" status

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/db/prisma/schema.prisma` | Add `operatingHours` and `isClosed` fields |
| `packages/api/src/utils/operating-hours.js` | NEW: Hours utility functions |
| `packages/api/src/index.js` | Add availability endpoint, update location endpoints |
| `apps/web/.../enhanced-menu-builder.tsx` | Filter arrival times based on hours |
| `apps/web/app/[locale]/page.tsx` | Conditional Order Now button |
| `apps/web/app/[locale]/locations/page.tsx` | Show open/closed status |
| `apps/web/messages/en.json` | Update hours strings |
| `apps/web/messages/es.json` | Update hours strings |
| `apps/web/messages/zh-CN.json` | Update hours strings |
| `apps/web/messages/zh-TW.json` | Update hours strings |

---

## Edge Cases

1. **Customer starts order at 8:40pm, finishes at 8:50pm**
   - API validates on submission, rejects if arrival time now invalid
   - Show friendly error: "Sorry, we're now closed for online orders"

2. **Timezone handling**
   - Store hours in location's local timezone (Mountain Time for Utah locations)
   - Server validates using location timezone

3. **Holiday closures**
   - Use `isClosed` flag for manual overrides
   - Future: Add `closedDates` array for scheduled closures

4. **Multiple locations with different hours**
   - Each location has its own `operatingHours` JSON
   - Fall back to DEFAULT_HOURS if null

---

## Testing Checklist

- [ ] Ordering at 9am shows "Opens at 10am for ordering"
- [ ] Ordering at 10am allows orders with 11am+ arrival times
- [ ] Ordering at 8:30pm only shows ASAP/15min options
- [ ] Ordering at 8:50pm shows closed message
- [ ] Sunday shows closed all day
- [ ] Homepage shows appropriate button state
- [ ] Locations page shows correct hours
- [ ] API rejects invalid arrival times

---

## Future Enhancements

1. **Order for Tomorrow** - Allow ordering after hours for next-day pickup
2. **Holiday Hours** - Admin UI to set special hours for holidays
3. **Per-Location Hours** - Different hours for different locations
4. **Push Notifications** - Notify wallet pass holders when ordering opens
