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
- `@oh/db` - Database schema and Prisma client
- `@oh/api` - API utilities

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

## Recent Major Changes
- **React 19 Upgrade**: Recently upgraded to React 19 RC with TypeScript support
- **Clerk Integration**: Authentication system implemented with Clerk
- **Flexible Pricing**: Added flexible pricing system for menu items (baby bok choy use case)
- **TypeScript Fixes**: Resolved TypeScript issues after React 19 upgrade

## Key Features
- User authentication via Clerk
- Payment processing with Stripe
- Prisma-based database layer
- Monorepo architecture with workspace support
- TypeScript throughout

## Important Notes
- Uses React 19 RC (not stable yet)
- Requires environment variables (see `.env.example`)
- Database operations should use the `@oh/db` package
- Port 3000 is used for the main web application

## Git Branch
Current working branch: `wonderful-torvalds`

## When Working on This Project
1. Always run commands from the workspace root
2. Use `pnpm --filter @oh/<package>` to run package-specific commands
3. Check TypeScript compilation before committing
4. Ensure Prisma schema is pushed before testing database features
5. Follow the existing monorepo structure when adding new packages
