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
- API runs on port 4001 in development

## Production Database (Railway)
```
DATABASE_URL=postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@postgres.railway.internal:5432/railway
DATABASE_PUBLIC_URL=postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@yamabiko.proxy.rlwy.net:55841/railway
```
- Use `DATABASE_URL` (internal) when running from within Railway
- Use `DATABASE_PUBLIC_URL` (public) when running migrations locally

## Git Branch
Current working branch: `nervous-lichterman`

## When Working on This Project
1. Always run commands from the workspace root
2. Use `pnpm --filter @oh/<package>` to run package-specific commands
3. Check TypeScript compilation before committing
4. Ensure Prisma schema is pushed before testing database features
5. Follow the existing monorepo structure when adding new packages
