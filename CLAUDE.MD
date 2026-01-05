# Claude Code Context for Oh Platform

## CRITICAL: Cloud Development Environment

**ALL DEVELOPMENT HAPPENS ON THE DIGITALOCEAN DROPLET SERVER**

- **Server IP**: `162.243.3.7`
- **Project Path**: `/home/claude-user/projects/oh-platform`

**NEVER use localhost or local Mac paths. All changes must target the cloud server.**

### Development URLs (HTTPS Enabled)
| Service | URL |
|---------|-----|
| Web App | `https://devwebapp.ohbeef.com` |
| Admin Dashboard | `https://devadmin.ohbeef.com` |
| API | `https://devapi.ohbeef.com` |

### Cloud File Paths
| Resource | Path |
|----------|------|
| Project Root | `/home/claude-user/projects/oh-platform` |
| Certs Directory | `/home/claude-user/projects/oh-platform/certs/` |
| GA Service Account | `/home/claude-user/projects/oh-platform/oh-beef-noodle-soup-0b9bc2bc522b.json` |

---

## Project Overview
Oh Platform is a full-stack monorepo application built with modern web technologies. It's designed as a comprehensive platform scaffold with database integration, authentication, and payment processing capabilities.

## Tech Stack

### Core Technologies
- **Framework**: Next.js 16.0.4 (React 19 RC)
- **Language**: TypeScript 5.x
- **Package Manager**: pnpm 9.15.9 (workspace monorepo)
- **Database**: Prisma 5.19.1
- **Authentication**: Clerk 6.35.5
- **Payments**: Stripe (client & server)

## Project Structure

```
oh-platform/
├── apps/
│   ├── web/           # Main Next.js application (port 3000)
│   └── admin/         # Admin dashboard
├── packages/
│   ├── db/            # Prisma database package (@oh/db)
│   └── api/           # API package (@oh/api)
└── infra/            # Infrastructure configuration
```

## Workspaces
This is a pnpm workspace monorepo with the following packages:
- `@oh/web` - Main web application
- `@oh/admin` - Admin dashboard
- `@oh/db` - **Single source of truth for Prisma schema and client** (all packages import from here)
- `@oh/api` - Fastify API server (imports PrismaClient from `@oh/db`)

## Development Commands

### Main Commands
```bash
pnpm dev           # Start web app (port 3000)
pnpm build         # Build web app
pnpm start         # Start production web app
pnpm admin:dev     # Start admin dashboard
pnpm api:dev       # Start API in development
```

### Database Commands
```bash
pnpm db:push       # Push Prisma schema to database
pnpm db:studio     # Open Prisma Studio
```

## Database Architecture

**IMPORTANT**: The Prisma schema lives ONLY in `packages/db/prisma/schema.prisma`.
- All packages that need database access should import from `@oh/db`
- Example: `import { PrismaClient } from "@oh/db";`
- NEVER create separate Prisma schemas in other packages
- Run `npx prisma generate` in `packages/db` after schema changes
- For production migrations, use `DATABASE_PUBLIC_URL` from local machine

## Recent Major Changes
- **Instant Referral Credits**: Referrer now gets $5 instantly when referee's order reaches COMPLETED status (was previously scheduled for 1st/16th of month)
- **Quick Order Feature**: "Chef's Choice" one-click ordering for new guests ($15.99 preset bowl)
- **Dietary Icons**: Menu items now show vegetarian, vegan, gluten-free, and spice level indicators
- **Order Source Tracking**: Added `OrderSource` enum (WEB, KIOSK, MOBILE, STAFF) for analytics
- **Guest Name Display**: Kitchen Display and Cleaning screen show customer names (User or Guest)
- **Order Analytics**: Admin analytics page shows order breakdown by source
- **Kiosk Guest Records**: API creates Guest records from kiosk `guestName` field
- **Clerk Name Sync**: User names from Clerk sync to database on each interaction
- **Consolidated Prisma Schema**: API now uses shared `@oh/db` package (no duplicate schemas)
- **React 19 Upgrade**: Recently upgraded to React 19 RC with TypeScript support
- **Clerk Integration**: Authentication system implemented with Clerk
- **Flexible Pricing**: Added flexible pricing system for menu items (baby bok choy use case)
- **TypeScript Fixes**: Resolved TypeScript issues after React 19 upgrade
- **Navigation Pages**: Full content for Menu, Locations, Gift Cards, Store, Loyalty, Careers, Contact, Press, Privacy, Accessibility pages
- **Member Dashboard**: Order calendar with month navigation, tier badges, stats grid
- **Order History**: Favorites feature (up to 3), grouped order items (Bowl/Extras)
- **Home Page**: Private Pods section, No Tipping section, video logo animation
- **Dynamic Menu**: Menu page now fetches from API instead of hardcoded items
- **Noodle Ordering**: Custom display order (Ramen → Shaved → Wide → No Noodles)

## Documentation
- **Gamification Improvements**: See `docs/GAMIFICATION-IMPROVEMENTS.md` for tier/badge/challenge system analysis and improvement roadmap
- **Hours of Operation Plan**: See `docs/HOURS-OF-OPERATION.md` for implementation plan

## Operating Hours (TODO: Not Yet Implemented)

**Standard Hours**: Mon-Sat 11am - 9pm, Closed Sundays

**Online Ordering Rules**:
- Orders accepted starting 1 hour before opening (10am)
- Last online order at 8:45pm (15 minutes before close)
- Arrival time options filtered to only show valid times within operating hours
- After hours: "Order Now" button replaced with "Opens at 11am" or similar

**Implementation Status**: Planned but not yet built. See `docs/HOURS-OF-OPERATION.md` for full plan.

**Key Files to Modify**:
- `packages/db/prisma/schema.prisma` - Add `operatingHours` JSON field to Location
- `packages/api/src/utils/operating-hours.js` - Hours validation utilities (new file)
- `packages/api/src/index.js` - Add `/locations/:id/availability` endpoint
- `apps/web/app/[locale]/order/location/[locationId]/_components/enhanced-menu-builder.tsx` - Filter arrival times
- `apps/web/app/[locale]/page.tsx` - Conditional "Order Now" button
- `apps/web/messages/*.json` - Update hours display strings

## Key Features
- User authentication via Clerk with custom "My Oh! Account" menu item
- Payment processing with Stripe
- Prisma-based database layer
- Monorepo architecture with workspace support
- TypeScript throughout
- **Private Dining Pods**: Individual pod dining experience
- **No Tipping Policy**: Competitive salaries for all staff
- **Order Favorites**: Save up to 3 favorite orders for quick reordering
- **Visit Calendar**: Track order history by month on member dashboard
- **Loyalty Tiers**: Chopstick, Noodle Master, Beef Boss progression

## Important Notes
- Uses React 19 RC (not stable yet)
- Requires environment variables (see `.env.example`)
- Database operations should use the `@oh/db` package
- Port 3000 is used for the main web application
- API runs on port 4000 in development
- Admin dashboard runs on port 3001

## Order Flow Architecture

### Order Status Flow
```
PENDING_PAYMENT → QUEUED → PREPPING → READY → SERVING → COMPLETED
```

### Key Order Fields
| Field | Description |
|-------|-------------|
| `seatId` | Pod assigned to order |
| `podAssignedAt` | When pod was assigned |
| `podConfirmedAt` | When customer confirmed at pod (required for Kitchen Display) |
| `podSelectionMethod` | "CUSTOMER_SELECTED", "AUTO", or "STAFF_ASSIGNED" |
| `status` | Order status (see flow above) |
| `paymentStatus` | PENDING, PAID, FAILED, REFUNDED |
| `orderSource` | WEB, KIOSK, MOBILE, or STAFF (for analytics) |
| `userId` | Authenticated user (from Clerk) |
| `guestId` | Guest record (for kiosk anonymous orders) |

### Seat/Pod Status Flow
```
AVAILABLE → RESERVED (web order paid) → OCCUPIED (customer at pod) → CLEANING → AVAILABLE
AVAILABLE → OCCUPIED (kiosk order) → CLEANING → AVAILABLE
```

### Two Ordering Paths

#### 1. Web App Order Flow (`apps/web/app/[locale]/order/`)
1. Customer selects pod during menu browsing (optional)
2. Checkout & payment → `paymentStatus: PAID`, `status: QUEUED`
3. If pod pre-selected: seat status → `RESERVED`, 15-min expiry set
4. Customer arrives, scans order QR at kiosk → `POST /orders/check-in`
5. Customer scans pod QR → `POST /orders/confirm-pod` → `podConfirmedAt` set, seat → `OCCUPIED`
6. Order appears in Kitchen Display (requires `podConfirmedAt`)
7. Kitchen workflow: QUEUED → PREPPING → READY → SERVING
8. Cleaning screen: SERVING → COMPLETED, seat → `CLEANING`
9. Staff marks clean → seat → `AVAILABLE`

#### 2. Kiosk Order Flow (`apps/web/app/[locale]/kiosk/order/`)
1. Customer orders at physical kiosk
2. Customer selects pod before payment
3. Payment → `PATCH /orders/:id` with:
   - `paymentStatus: PAID`
   - `seatId` (selected pod)
   - `podConfirmedAt` (set at payment - customer is physically present)
   - `podSelectionMethod: "CUSTOMER_SELECTED"`
4. Seat status → `OCCUPIED` (not RESERVED, since customer is already there)
5. Order appears in Kitchen Display immediately
6. Same kitchen/cleaning workflow as web orders

### Key API Endpoints

**Order Management:**
- `POST /orders` - Create order
- `PATCH /orders/:id` - Update order (payment, seatId, podConfirmedAt, etc.)
- `POST /orders/check-in` - Kiosk check-in (scan order QR)
- `POST /orders/confirm-pod` - Pod confirmation (scan pod QR)

**Kitchen Display (`apps/admin/app/kitchen/`):**
- `GET /kitchen/orders?status=active` - Get active orders for kitchen
- `PATCH /kitchen/orders/:id/status` - Update order status
- `GET /kitchen/stats` - Order counts by status

**Cleaning Screen (`apps/admin/app/cleaning/`):**
- `GET /locations/:id/seats` - Get pods with their current orders
- `PATCH /seats/:id/clean` - Mark pod as cleaned

**Analytics (`apps/admin/app/analytics/`):**
- `GET /analytics/order-sources` - Order counts by source (WEB, KIOSK, MOBILE, STAFF)

### Important: Kitchen Display Requirements
Orders only appear in Kitchen Display when:
1. `paymentStatus = "PAID"`
2. `status` is one of: QUEUED, PREPPING, READY, SERVING
3. Has associated `seatId` (pod assignment)

### Important: Cleaning Screen Requirements
Pods appear in Cleaning screen when:
1. Pod `status = "OCCUPIED"` with order in SERVING status (ready for cleaning)
2. Pod `status = "CLEANING"` (being cleaned)

## Production Database (Railway)
```
DATABASE_URL=postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@postgres.railway.internal:5432/railway
DATABASE_PUBLIC_URL=postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@yamabiko.proxy.rlwy.net:55841/railway
```
- Use `DATABASE_URL` (internal) when running from within Railway
- Use `DATABASE_PUBLIC_URL` (public) when running migrations locally

## Development Environment Variables
**IMPORTANT**: All development happens on the DigitalOcean cloud server (162.243.3.7).

```bash
# Clerk Authentication (REQUIRED - prevents keyless mode warning)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWR2YW5jZWQtc3F1aXJyZWwtNTUuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_Imh9fiIh2PGJ43Ztc0PXhOsZ1qNJpJLNuRiEF1cgRO

# API Configuration (CLOUD SERVER - NOT localhost)
API_PORT=4000
NEXT_PUBLIC_API_URL=https://devapi.ohbeef.com

# Database (Railway - production)
DATABASE_URL=postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@yamabiko.proxy.rlwy.net:55841/railway

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_51SX7kS1o2n32UrrMkLymiIMW6BXVHWXkZtrtruf6ufZJK2OYYHCaVv6e87GZl8kvDlGyvbVkiEslaQP4X2KMsIub00LVIzWigJ

# File Paths (CLOUD SERVER)
GA_SERVICE_ACCOUNT_PATH=/home/claude-user/projects/oh-platform/oh-beef-noodle-soup-0b9bc2bc522b.json
APPLE_PASS_CERT_PATH=/home/claude-user/projects/oh-platform/certs/oh-pass-cert.pem
APPLE_PASS_KEY_PATH=/home/claude-user/projects/oh-platform/certs/oh-pass-key.pem
APPLE_WWDR_CERT_PATH=/home/claude-user/projects/oh-platform/certs/wwdr.pem
```

## Git Branch
Current working branch: `elastic-knuth`

## Session Initialization

### Cloud Server Setup
All development happens on the DigitalOcean droplet at `162.243.3.7`. Environment files are already configured at `/home/claude-user/projects/oh-platform`.

### Required Environment Files
- `.env` (root) - Database URL, API keys, and cloud paths
- `apps/web/.env.local` - Clerk keys, API URL pointing to cloud server
- `apps/admin/.env.local` - Admin-specific config pointing to cloud server
- `packages/db/.env` - Database and API configuration

### Start Servers (on cloud server)
```bash
pnpm dev          # Web app (port 3000) → https://devwebapp.ohbeef.com
pnpm admin:dev    # Admin (port 3001) → https://devadmin.ohbeef.com
pnpm api:dev      # API (port 4000) → https://devapi.ohbeef.com
```

## When Working on This Project
1. Always run commands from the workspace root
2. Use `pnpm --filter @oh/<package>` to run package-specific commands
3. Check TypeScript compilation before committing
4. Ensure Prisma schema is pushed before testing database features
5. Follow the existing monorepo structure when adding new packages

## Git & Deployment
- You are working in a **git worktree** on a separate branch (not main)
- Railway deploys from `main` branch
- When pushing changes for deployment, use: `git push origin <branch>:main`
- This pushes the current worktree branch directly to main to trigger Railway deployment
- Do NOT try to checkout main (it's already checked out in the main repo)

## CRITICAL: Dev Environment Architecture

**Dev subdomains point to LOCAL dev servers on this droplet (NOT Railway/Vercel):**

| Subdomain | Points To | Process |
|-----------|-----------|---------|
| `https://devwebapp.ohbeef.com` | `localhost:3000` | `pnpm dev` |
| `https://devadmin.ohbeef.com` | `localhost:3001` | `pnpm admin:dev` |
| `https://devapi.ohbeef.com` | `localhost:4000` | `pnpm api:dev` |

Nginx on the droplet proxies these subdomains to the local ports.

### Dev Testing Workflow (NO git push needed!)
1. Make code changes in `/home/claude-user/projects/oh-platform`
2. Restart the relevant dev server (see commands below)
3. User tests via dev subdomains immediately

### Restarting Dev Servers
```bash
# Use screen sessions to keep servers running
screen -ls                    # List existing sessions
screen -S api -X quit         # Kill old API session
screen -dmS api bash -c "pnpm api:dev 2>&1 | tee api.log"

screen -S admin -X quit       # Kill old admin session
screen -dmS admin bash -c "pnpm admin:dev 2>&1 | tee admin.log"

screen -S web -X quit         # Kill old web session
screen -dmS web bash -c "pnpm dev 2>&1 | tee web.log"
```

### IMPORTANT: User Accounts
- **claude-user**: YOUR development environment. All dev servers should run under this user.
- **ohdev**: Legacy/separate environment. DO NOT modify or use ohdev's processes.

### Production Deployment (separate from dev)
- Production uses Vercel/Railway deployed from `main` branch
- Only push to `main` when changes are tested and ready for production
- Dev testing does NOT require git push

## Meal for a Stranger Challenge - Implementation Status (Dec 30, 2024)

### Status: READY FOR TESTING

The recipient notification modal has been implemented. Changes made:

**Files Modified:**
1. `apps/web/app/[locale]/order/location/[locationId]/_components/enhanced-menu-builder.tsx`
   - Added MealGiftModal integration
   - Fetches pending gifts on page load
   - Handlers for Accept/Pay Forward/Close

2. `apps/web/app/[locale]/order/payment/page.tsx`
   - Passes mealGiftId to PaymentForm

3. `apps/web/app/[locale]/order/payment/payment-form.tsx`
   - Accepts meal gift during checkout

**Testing Steps:**
1. User A: Go to `/challenges/meal-for-stranger`, create a gift at a location
2. User B: Go to `/order/location/{locationId}` for the same location
3. User B should see the MealGiftModal popup
4. Test "Accept" flow (should apply at checkout)
5. Test "Pay Forward" flow (should pass to next person)
6. Test "Maybe Later" (should dismiss modal)

**Backups Created:**
- `/tmp/enhanced-menu-builder-backup.tsx`
- `/tmp/payment-form-backup.tsx`

## Kiosk Order Flow UI - Implementation Status (Dec 31, 2024)

### Status: IN PROGRESS - READY FOR FINAL TESTING

The kiosk ordering screens have been redesigned for a better touch-screen experience. All 4 steps have been styled but need final testing and polish.

### Key File
`apps/web/app/[locale]/kiosk/order/kiosk-order-flow.tsx`

### COLORS Constant (for reference)
```typescript
const COLORS = {
  primary: "#7C7A67",        // Olive/sage - main brand color
  primaryDark: "#5a5848",    // Darker olive for selected states
  primaryLight: "#f5f4f0",   // Light olive tint for backgrounds
  textOnPrimary: "#FFFFFF",  // White text on primary buttons
  text: "#1a1a1a",           // Dark text
  textMuted: "#666666",      // Muted text
  border: "#e5e7eb",         // Light gray borders
  success: "#22c55e",        // Green for FREE labels
  surfaceElevated: "#ffffff" // White card backgrounds
};
```

### Step 1: Choose Your Base (COMPLETE)
- **Layout**: 2-column side-by-side (Noodle Type | Soup Base)
- **Selection style**: Tap-to-select cards with images
- **Selected indicator**: 哦 logo + checkmark overlay, gold border
- **"No Noodles" button**: Centered below noodle grid
- **Dietary badges**: Show on cards (vegetarian, vegan, GF, spice)

### Step 2: Customize Your Bowl (COMPLETE)
- **Layout**: 2-column grid for sliders
- **Sliders**:
  - Spice Level: Progressive red glow (pink → deep red)
  - Soup Richness: Progressive deep brown glow
  - Noodle Texture: Progressive tan glow (Firm=bold, Soft=light)
  - Vegetables: Deep green highlight
- **Slider cards**: Show image + label, no selection indicator pills
- **Allergen Info**: Modal popup accessible from header

### Step 3: Add-Ons & Sides (COMPLETE)
- **Layout**: Side-by-side columns (Add-Ons | Side Dishes)
- **Card style**: Smaller cards matching Step 1 sizing
- **Interaction**: Tap anywhere on card to add (+1)
- **Qty controls**: Right-justified, inline with name/price
  - Minus button (29x29px) + qty number
  - Tap card to increase, tap minus to decrease
- **Pricing**: Shows "$X.XX each" format
- **Subtotal**: Updates correctly for multiple quantities

### Step 4: Drinks & Dessert (COMPLETE - NEEDS TESTING)
- **Layout**: Side-by-side with vertical divider
  - Beverages (left): 2-column grid, "(free refills)" in title
  - Dessert (right): Single column, centered, "(free)" in title
- **Separation**: Left border + padding on Dessert column
- **Pricing**:
  - Shows price for paid items
  - Shows "FREE" (green) for $0 items (water, dessert)
- **Dessert card**: Same size as beverage cards (50% width)

### Known Bug Fixes Applied
1. **Price calculation bug**: Fixed in 4 files - `additionalPriceCents` defaulting to 0 caused subtotal to not update. Now uses `effectiveAdditionalPrice = item.additionalPriceCents || item.basePriceCents`
   - `kiosk-order-flow.tsx`
   - `menu-builder.tsx`
   - `enhanced-menu-builder.tsx`
   - `checkbox-group.tsx`

### Testing Checklist
- [ ] Step 1: Verify noodle and soup base selection works
- [ ] Step 1: Verify "No Noodles" button works
- [ ] Step 1: Verify dietary badges display correctly
- [ ] Step 2: Verify all sliders work and show color glows
- [ ] Step 2: Verify Allergen Info popup works
- [ ] Step 3: Verify tap-to-add on cards works
- [ ] Step 3: Verify minus button decreases qty
- [ ] Step 3: Verify subtotal calculates correctly for multiple items
- [ ] Step 4: Verify beverage selection works
- [ ] Step 4: Verify dessert selection works
- [ ] Step 4: Verify "FREE" label shows for water/dessert
- [ ] Complete order: Verify total at bottom updates correctly
- [ ] Complete order: Verify payment flow works

### Related Files
- `apps/web/app/[locale]/kiosk/kiosk.css` - Custom kiosk styles
- `apps/web/app/[locale]/kiosk/layout.tsx` - Kiosk layout wrapper
- `apps/web/app/[locale]/kiosk/check-in/page.tsx` - Check-in screen
- `apps/web/app/[locale]/kiosk/kiosk-welcome.tsx` - Welcome screen
- `apps/web/components/kiosk/` - Kiosk-specific components

### UI Polish Applied
- Decorative 哦 logo appears on all kiosk pages
- Header/footer use COLORS.primary (olive) background
- Cards have consistent border-radius (10-12px)
- Touch-friendly sizing throughout
- Dietary badges use compact icons

## Apple Wallet Pass System - Implementation Complete (Jan 2, 2026)

### Overview
Apple Wallet loyalty passes with real-time updates for credit balance, pod availability, and geolocation notifications.

### Key Files
```
packages/api/src/wallet/
├── wallet-pass.js           # Pass generation (PKPass)
├── apns-service.js          # Apple Push Notification Service
├── wallet-web-service.js    # Apple's required web service endpoints
├── wallet-notification-service.js  # 6 notification types
└── pass-template.pass/      # Pass images (logo, icon)

packages/api/src/services/
├── credit-service.js        # Credits + auto wallet refresh
└── wallet-realtime-service.js  # Pod availability tracking
```

### How Real-Time Updates Work
1. When data changes (credits, pod availability), `markPassUpdated()` updates `WalletPassRegistration.updatedAt`
2. APNs push sent to device via `notifyUserPassUpdate()`
3. Apple Wallet checks `GET /wallet/v1/devices/:id/registrations/:passTypeId`
4. If `updatedAt` is newer, fetches `GET /wallet/v1/passes/:passTypeId/:serialNumber`
5. Pass regenerated with current data, returned with `Last-Modified` header

### Production Environment Variables (Railway)
```bash
# Pass Signing (required)
APPLE_PASS_TYPE_ID=pass.com.ohbeef.loyalty
APPLE_TEAM_ID=<10-char team ID>
APPLE_PASS_CERT_BASE64=<base64 cert>
APPLE_PASS_KEY_BASE64=<base64 key>
APPLE_WWDR_CERT_BASE64=<base64 WWDR cert>

# APNs Push Notifications (required for real-time updates)
APPLE_APNS_KEY_ID=<10-char key ID>
APPLE_APNS_PRIVATE_KEY_BASE64=<base64 .p8 file>

# Web Service
WALLET_WEB_SERVICE_URL=https://api.ohbeef.com/wallet
WALLET_AUTH_SECRET=<random secret>
```

### Cron Jobs (cron-job.org)
All require header: `x-cron-secret: <CRON_SECRET>`

| Job | Endpoint | Schedule |
|-----|----------|----------|
| Pod Availability | `POST /cron/wallet-pod-availability` | Every 5 min |
| Streak Reminders | `POST /cron/wallet-streak-notifications` | Daily 5pm MT |
| Challenge Deadlines | `POST /cron/wallet-challenge-notifications` | Daily 10am MT |
| Credits Reminder | `POST /cron/wallet-credits-reminder` | Weekly Mon 11am |
| Tier Progress | `POST /cron/wallet-tier-progress` | Daily noon MT |

### Debug/Test Endpoints
- `GET /wallet/debug` - Check APNs config & registrations
- `POST /wallet/test-push/:userId` - Send test push notification
- `POST /wallet/refresh-all` - Force refresh all passes

### Geolocation Notification Message Format
```
"Our [location] location is so close! We have X pods currently available with X min wait. Stop by and use your $X.XX available credit!!"
```

### Important Notes
- APNs defaults to **production** (wallet passes use production certs)
- `Last-Modified` header is required for Apple Wallet to track updates
- Location coordinates must match production for geofencing to work
- DNS: `api.ohbeef.com` → `ohapi-production.up.railway.app` (CNAME)

## Railway CLI - Deployment Management

### Usage
Railway CLI is available via npx. Set `RAILWAY_TOKEN` env var for authentication.

```bash
# Export token (get from Railway dashboard → Project Settings → Tokens)
export RAILWAY_TOKEN="<your-project-token>"

# Check project status
npx @railway/cli status

# Trigger API redeploy
npx @railway/cli redeploy --service "@oh/api" --yes

# View deployment logs
npx @railway/cli logs
```

### Project Info
- **Project Name**: oh-beef
- **Environment**: production
- **API Service**: @oh/api
- **Token Location**: Railway dashboard → Project Settings → Tokens

---

## Twilio SMS - Credentials & Configuration

### Credentials
Twilio credentials are stored in environment variables. See `.env.example` for required variables:
- `TWILIO_ACCOUNT_SID` - Account SID from Twilio console
- `TWILIO_AUTH_TOKEN` - Auth token from Twilio console
- `TWILIO_PHONE_NUMBER` - Toll-free number (requires verification)
- `ADMIN_PHONE_NUMBER` - Receives new user SMS alerts

### Status
- **Toll-free verification**: Pending (required for SMS delivery)
- **Admin SMS on new user**: Implemented in `POST /users` endpoint
- **Notification file**: `packages/api/src/notifications.js`
