# Vercel Environment Variables Setup

## Required for Production Deployment

### Web App (ohbeef.com)

Go to: https://vercel.com/oh-beef-noodle-soup/webapp/settings/environment-variables

Add these environment variables:

```env
# Production API URL
NEXT_PUBLIC_API_URL=https://ohapi-production.up.railway.app

# Clerk Authentication (if not already set)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWR2YW5jZWQtc3F1aXJyZWwtNTUuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=[your-clerk-secret-key]
```

### Admin App (admin.ohbeef.com)

Go to: https://vercel.com/oh-beef-noodle-soup/admin/settings/environment-variables

Add these environment variables:

```env
# Production API URL
NEXT_PUBLIC_API_URL=https://ohapi-production.up.railway.app

# Production Database (Railway)
DATABASE_URL=postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@yamabiko.proxy.rlwy.net:55841/railway

# Clerk Authentication (if not already set)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWR2YW5jZWQtc3F1aXJyZWwtNTUuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=[your-clerk-secret-key]
```

## How to Add Environment Variables in Vercel

1. Go to your project in Vercel
2. Click **Settings** tab
3. Click **Environment Variables** in left sidebar
4. Click **Add New**
5. Enter:
   - **Key**: Variable name (e.g., `NEXT_PUBLIC_API_URL`)
   - **Value**: Variable value (e.g., `https://ohapi-production.up.railway.app`)
   - **Environment**: Select "Production" (and optionally Preview/Development)
6. Click **Save**
7. **Redeploy** your application for changes to take effect

## After Adding Variables

**IMPORTANT**: You must redeploy for environment variables to take effect!

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **...** (three dots)
4. Click **Redeploy**
5. Select **Use existing Build Cache** (faster)
6. Click **Redeploy**

## Verify Setup

After redeployment, test:

### Web App
1. Go to https://ohbeef.com/order
2. You should see locations listed
3. If you see "No locations available" → check NEXT_PUBLIC_API_URL

### Admin App
1. Go to https://admin.ohbeef.com/admin/kitchen
2. You should see the Kitchen Display
3. If you get authentication errors → check Clerk variables
4. If you get database errors → check DATABASE_URL

## Troubleshooting

### No locations showing
- ✅ Check NEXT_PUBLIC_API_URL is set
- ✅ Verify Railway API is running at https://ohapi-production.up.railway.app/health
- ✅ Check browser console for errors
- ✅ Redeploy Vercel app

### Admin dashboard not loading
- ✅ Check DATABASE_URL is set
- ✅ Check Clerk variables are set
- ✅ Verify you're signed in with Clerk
- ✅ Redeploy Vercel admin app

### API errors
- ✅ Check Railway API logs
- ✅ Verify DATABASE_URL in Railway matches your production database
- ✅ Check Prisma client is up to date (Railway should regenerate on deploy)

---

**Last Updated**: December 9, 2025
**API URL**: https://ohapi-production.up.railway.app
**Web App**: https://ohbeef.com
**Admin App**: https://admin.ohbeef.com
