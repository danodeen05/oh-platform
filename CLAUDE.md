# Claude Code Configuration

This document captures CLI integrations, tokens, and important context for Claude Code sessions.

## CLI Integrations

### Railway CLI

**Status:** Installed and configured

**Location:** `~/.railway/bin/railway`

**Authentication:** Token-based via `RAILWAY_TOKEN` in `.env`

**Usage:**
```bash
export PATH="$HOME/.railway/bin:$PATH"
export RAILWAY_TOKEN="<from .env>"

# Check status
railway status

# Set environment variables
railway variables set KEY=value --service "@oh/api"

# View logs
railway logs --service "@oh/api"

# Redeploy
railway redeploy --service "@oh/api"
```

**Project:** oh-beef (production environment)
- API Service: `@oh/api` → https://api.ohbeef.com
- Database: Postgres-yOLk

---

### Vercel CLI/API

**Status:** Installed (via pnpm) and configured

**Authentication:** Token-based via `VERCEL_TOKEN` in `.env`

**Team ID:** `team_lcuKROVnRGMXAYN6Q3x44DKh`

**Projects:**
- `webapp` (prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0) → https://www.ohbeef.com
- `admin` → https://admin-oh-beef-noodle-soup.vercel.app

**Usage via API (preferred for non-interactive):**
```bash
# List projects
curl -s "https://api.vercel.com/v9/projects?teamId=team_lcuKROVnRGMXAYN6Q3x44DKh" \
  -H "Authorization: Bearer $VERCEL_TOKEN"

# Get env vars
curl -s "https://api.vercel.com/v9/projects/prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0/env?teamId=team_lcuKROVnRGMXAYN6Q3x44DKh" \
  -H "Authorization: Bearer $VERCEL_TOKEN"

# Update env var (PATCH)
curl -X PATCH "https://api.vercel.com/v9/projects/PROJECT_ID/env/ENV_ID?teamId=TEAM_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "new-value"}'

# Trigger redeploy
curl -X POST "https://api.vercel.com/v13/deployments?teamId=TEAM_ID&forceNew=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "webapp", "deploymentId": "DEPLOYMENT_ID", "target": "production"}'
```

---

### Clerk CLI

**Status:** Available via `npx clerk`

**Authentication:** Requires browser OAuth login (`npx clerk auth login`)

**Note:** The `CLERK_SECRET_KEY` in `.env` is sufficient for app functionality. CLI login only needed for advanced management tasks.

**Usage:**
```bash
npx clerk doctor          # Check integration
npx clerk env pull        # Pull API keys to .env
npx clerk api ls          # List available API endpoints
```

---

## Environment Variables

### Tokens (in .env)

| Variable | Purpose |
|----------|---------|
| `RAILWAY_TOKEN` | Railway CLI authentication |
| `VERCEL_TOKEN` | Vercel API/CLI authentication |
| `CLERK_SECRET_KEY` | Clerk authentication (app + CLI) |

### Current Mode

**Stripe:** TEST MODE
- API uses `sk_test_...`
- Web uses `pk_test_...`

**Time Restrictions:** BYPASSED
- `DISABLE_TIME_RESTRICTIONS=true` in Railway

### To Go Live

1. Remove `DISABLE_TIME_RESTRICTIONS` from Railway
2. Update Stripe keys to live:
   - Railway: `railway variables set STRIPE_SECRET_KEY="sk_live_..."`
   - Vercel: Update `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `pk_live_...`

---

## Locations

All locations use timezone: `America/Denver`

| Location | ID |
|----------|-----|
| SoHo | cmpw19e... |
| City Creek Mall | cmpw19e... |
| University Place | cmpw19e... |

---

## Common Tasks

### Switch Stripe to Live Mode
```bash
# Railway API
export RAILWAY_TOKEN="<from .env>"
railway variables set STRIPE_SECRET_KEY="sk_live_51SX7kH0xt8Aa8ToE..." --service "@oh/api"

# Vercel (via API)
curl -X PATCH "https://api.vercel.com/v9/projects/prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0/env/yW84aS9TuTywKNTZ?teamId=team_lcuKROVnRGMXAYN6Q3x44DKh" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "pk_live_51SX7kH0xt8Aa8ToEGLB4yNwGXweFhN..."}'
```

### Enable Time Restrictions (Go Live)
```bash
railway variables set DISABLE_TIME_RESTRICTIONS=false --service "@oh/api"
# Or remove the variable entirely
```

### Check Deployment Status
```bash
# Railway
railway status

# Vercel
curl -s "https://api.vercel.com/v6/deployments?projectId=prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0&teamId=team_lcuKROVnRGMXAYN6Q3x44DKh&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```
