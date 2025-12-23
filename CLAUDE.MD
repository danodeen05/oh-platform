# Claude Code Context for Oh Platform

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
**IMPORTANT**: When starting a new worktree/branch, ensure the `.env` file contains these keys:

```bash
# Clerk Authentication (REQUIRED - prevents keyless mode warning)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWR2YW5jZWQtc3F1aXJyZWwtNTUuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_Imh9fiIh2PGJ43Ztc0PXhOsZ1qNJpJLNuRiEF1cgRO

# API Configuration
API_PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000

# Database (local development)
DATABASE_URL=postgresql://oh:ohpassword@localhost:5432/ohdb?schema=public

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_51SX7kS1o2n32UrrMkLymiIMW6BXVHWXkZtrtruf6ufZJK2OYYHCaVv6e87GZl8kvDlGyvbVkiEslaQP4X2KMsIub00LVIzWigJ
```

**Setup for new worktree:**
```bash
# Copy root .env for API
cp /Users/ddidericksen/Projects/oh/oh-platform/.env .

# Copy to apps/web/.env.local for Next.js (REQUIRED for Clerk to work!)
cp /Users/ddidericksen/Projects/oh/oh-platform/.env apps/web/.env.local
```

## Git Branch
Current working branch: `elastic-knuth`

## Session Initialization

### For Worktrees
When starting a session in a git worktree, run `/init` or manually:
```bash
# Quick init script (copies env files, installs deps, generates Prisma)
/Users/ddidericksen/Projects/oh/oh-platform/scripts/init-worktree.sh

# Or manually:
cp /Users/ddidericksen/Projects/oh/oh-platform/.env .
cp /Users/ddidericksen/Projects/oh/oh-platform/apps/web/.env.local apps/web/
pnpm install
cd packages/db && pnpm exec prisma generate
```

### Required Environment Files
- `.env` (root) - Database URL and other secrets
- `apps/web/.env.local` - Clerk keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY)

### Start Servers
```bash
pnpm dev          # Web app (port 3000)
pnpm admin:dev    # Admin (port 3001)
pnpm api:dev      # API (port 4000)
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
