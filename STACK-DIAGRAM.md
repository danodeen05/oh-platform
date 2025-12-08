# Oh Platform - Stack Diagram

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │    Customer Web      │    │    Admin Dashboard    │          │
│  │    (apps/web)        │    │    (apps/admin)       │          │
│  │                      │    │                       │          │
│  │  • Next.js 16        │    │  • Next.js 15         │          │
│  │  • React 19 RC       │    │  • React 18           │          │
│  │  • Clerk Auth        │    │  • Admin UI           │          │
│  │  • Stripe Payments   │    │                       │          │
│  │  • Port 3000         │    │  • Port 3001          │          │
│  └──────────┬───────────┘    └──────────┬───────────┘          │
│             │                           │                       │
└─────────────┼───────────────────────────┼───────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Fastify API                            │   │
│  │                  (packages/api)                           │   │
│  │                                                           │   │
│  │  Endpoints:                                               │   │
│  │  • GET/POST /users - User management                      │   │
│  │  • GET /users/:id/profile - Profile with tiers            │   │
│  │  • GET /users/:id/orders - Order history                  │   │
│  │  • GET/POST /orders - Order management                    │   │
│  │  • GET /menu/steps - Menu structure                       │   │
│  │  • GET /badges - Badge definitions                        │   │
│  │  • GET /locations - Location list                         │   │
│  │                                                           │   │
│  │  Port: 4001                                               │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │   Prisma ORM         │    │   PostgreSQL DB      │          │
│  │   (packages/db)      │───▶│   (Railway)          │          │
│  │                      │    │                       │          │
│  │  Models:             │    │  Tables:              │          │
│  │  • User              │    │  • users              │          │
│  │  • Order             │    │  • orders             │          │
│  │  • OrderItem         │    │  • order_items        │          │
│  │  • MenuItem          │    │  • menu_items         │          │
│  │  • MenuSection       │    │  • menu_sections      │          │
│  │  • MenuStep          │    │  • menu_steps         │          │
│  │  • Location          │    │  • locations          │          │
│  │  • Badge             │    │  • badges             │          │
│  │  • UserBadge         │    │  • user_badges        │          │
│  │  • Tenant            │    │  • tenants            │          │
│  └──────────────────────┘    └──────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │     Clerk      │  │     Stripe     │  │    Railway     │    │
│  │                │  │                │  │                │    │
│  │  • Auth        │  │  • Payments    │  │  • Hosting     │    │
│  │  • User mgmt   │  │  • Checkout    │  │  • PostgreSQL  │    │
│  │  • Sessions    │  │  • Webhooks    │  │  • Auto-deploy │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | Next.js | 16.0.4 / 15.0.5 |
| UI Library | React | 19 RC / 18.3 |
| Language | TypeScript | 5.x |
| Package Manager | pnpm | 9.15.9 |
| API Framework | Fastify | 4.x |
| ORM | Prisma | 5.19.1 |
| Database | PostgreSQL | 15.x |
| Authentication | Clerk | 6.35.5 |
| Payments | Stripe | Latest |
| Hosting | Railway | - |

## Data Flow

```
User Action → Next.js Page → API Call → Fastify Route → Prisma → PostgreSQL
                                ↓
                          Response JSON
                                ↓
                     React State Update → UI Render
```

## Key Directories

```
oh-platform/
├── apps/
│   ├── web/                    # Customer-facing Next.js app
│   │   ├── app/                # App router pages
│   │   │   ├── page.tsx        # Home page
│   │   │   ├── menu/           # Menu display
│   │   │   ├── order/          # Order flow
│   │   │   ├── member/         # Member dashboard
│   │   │   ├── locations/      # Locations page
│   │   │   ├── loyalty/        # Loyalty program
│   │   │   ├── gift-cards/     # Gift cards
│   │   │   └── store/          # Merchandise
│   │   └── components/         # Shared components
│   │
│   └── admin/                  # Admin dashboard
│       └── app/                # Admin pages
│
├── packages/
│   ├── api/                    # Fastify API server
│   │   └── src/
│   │       ├── index.js        # Entry point
│   │       └── routes/         # API routes
│   │
│   └── db/                     # Prisma database package
│       ├── prisma/
│       │   └── schema.prisma   # Database schema
│       └── src/
│           └── client.ts       # Prisma client export
│
└── infra/                      # Infrastructure config
```
