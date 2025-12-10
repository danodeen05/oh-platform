# Quick Reference Guide

## Production URLs
- **Website**: https://ohbeef.com
- **Admin**: https://admin.ohbeef.com
- **API**: https://ohapi-production.up.railway.app

## Database Credentials
See `.env.production` and `PRODUCTION_CREDENTIALS.md` for Railway PostgreSQL credentials.

## Common Commands

### Development
```bash
pnpm dev              # Start web app (port 3000)
pnpm admin:dev        # Start admin app (port 3001)
pnpm api:dev          # Start API (port 4000)
```

### Database
```bash
# Local development
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Prisma Studio

# Production (from packages/db)
DATABASE_URL="<prod-url>" pnpm prisma db push --accept-data-loss
```

### Deployment
```bash
# Push to production
git push origin <branch>:main

# Railway will auto-deploy API
# Vercel will auto-deploy web and admin apps
```

## Environment Variables Required in Vercel

### Web App (ohbeef.com)
```
NEXT_PUBLIC_API_URL=https://ohapi-production.up.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

### Admin App (admin.ohbeef.com)
```
NEXT_PUBLIC_API_URL=https://ohapi-production.up.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

## Troubleshooting

### Railway API Not Deploying
- Check `packages/api/railway.toml` exists
- Verify Railway is watching `main` branch
- Check build logs in Railway dashboard

### Database Schema Mismatch
```bash
cd packages/db
DATABASE_URL="postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@yamabiko.proxy.rlwy.net:55841/railway" pnpm prisma db push --accept-data-loss
```

### CORS Errors in Admin
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Ensure API has `origin: true` in CORS config
- Check browser console for exact error

### Locations Not Loading
- Check API is running: `curl https://ohapi-production.up.railway.app/locations -H "x-tenant-slug: oh"`
- Verify tenant exists in database
- Check for Prisma schema mismatches

## Project Structure
```
oh-platform/
├── apps/
│   ├── web/              # Customer-facing app (ohbeef.com)
│   └── admin/            # Admin dashboard (admin.ohbeef.com)
├── packages/
│   ├── db/               # Prisma schema and client
│   └── api/              # Fastify API (Railway)
└── infra/                # Infrastructure config
```

## Tech Stack Versions
- Next.js: 16.0.8
- React: 19.2.1
- Clerk: 6.35.5
- Prisma: 5.19.1
- pnpm: 9.15.9
- Node: 20.x (Railway)

## Key Files
- `packages/api/railway.toml` - Railway build config
- `apps/admin/middleware.ts` - Admin authentication
- `packages/db/prisma/schema.prisma` - Database schema
- `.env.production` - Production credentials
- `CLAUDE.md` - Full project context
