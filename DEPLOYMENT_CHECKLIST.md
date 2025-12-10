# Production Deployment Checklist - December 9, 2025

## ✅ Completed Steps

### 1. Code Changes
- [x] Kitchen Display performance metrics implemented
- [x] Cleaning Management performance metrics implemented
- [x] Status color consistency fixes applied
- [x] Home page font updates (Ma Shan Zheng & Bebas Neue)
- [x] All code changes committed to git
- [x] Changes merged to main branch
- [x] Main branch pushed to GitHub

### 2. Database Migration
- [x] Production DATABASE_URL stored in `.env.production`
- [x] Credentials documented in `PRODUCTION_CREDENTIALS.md`
- [x] Schema pushed to production database (Railway PostgreSQL)
- [x] Prisma Client regenerated
- [x] All new fields and tables created:
  - Order: orderQrCode, kitchenOrderNumber, lifecycle timestamps
  - User: arrival tracking fields
  - WaitQueue: new table created
  - OrderItem: selectedValue field
  - OrderStatus: SERVING enum value added

### 3. Documentation
- [x] DEPLOYMENT_SUMMARY.md created
- [x] ADMIN_ACCESS_GUIDE.md created
- [x] DATABASE_MIGRATION_GUIDE.md created
- [x] PRODUCTION_CREDENTIALS.md created
- [x] Credential files added to .gitignore

## 🚀 Next Steps - Deploy to Production

### Step 1: Deploy Applications

You need to deploy three services to production:

#### A. Deploy Web App (Customer-facing)
```bash
# If using Vercel/Railway/similar
# Push to main triggers auto-deployment
# OR manually deploy:
cd apps/web
# Deploy using your platform's CLI
```

#### B. Deploy Admin App (Staff-facing)
```bash
# If using Vercel/Railway/similar
cd apps/admin
# Deploy using your platform's CLI
```

#### C. Deploy API Backend
```bash
# If using Railway/Render/similar
cd packages/api
# Deploy using your platform's CLI
```

**IMPORTANT**: Make sure all three services use the production DATABASE_URL:
```
postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@postgres.railway.internal:5432/railway
```

### Step 2: Verify Production Environment Variables

Ensure these are set in your production environment:

**For all apps:**
```env
DATABASE_URL="postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@postgres.railway.internal:5432/railway"
NEXT_PUBLIC_API_URL="https://your-api-domain.com"
```

**For Clerk authentication (if not already set):**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
```

### Step 3: Test Production Deployment

Once deployed, test the following:

#### A. Test Home Page
- [ ] Go to `https://ohbeef.com`
- [ ] Verify fonts load correctly (Ma Shan Zheng for 哦, Bebas Neue for title)
- [ ] Check page loads without errors

#### B. Test Admin Dashboard
- [ ] Go to `https://ohbeef.com/admin`
- [ ] Verify you can access the dashboard
- [ ] Click "Kitchen Display"
- [ ] Click "Cleaning Management"

#### C. Test Kitchen Display
- [ ] Go to `https://ohbeef.com/admin/kitchen`
- [ ] Check "Average Order Processing Time" displays (should show --:-- if no orders today)
- [ ] Verify location dropdown works
- [ ] Check page auto-refreshes every 10 seconds

#### D. Test Cleaning Management
- [ ] Go to `https://ohbeef.com/admin/pods`
- [ ] Check "Average Cleaning Time for Today" displays (should show --:-- if no cleanings today)
- [ ] Verify location dropdown works
- [ ] Check pods display in three columns (Occupied, Cleaning, Available)
- [ ] Check page auto-refreshes every 5 seconds

#### E. Test Full Order Flow
- [ ] Place a test order as a customer
- [ ] Verify order appears in Kitchen Display
- [ ] Progress order through statuses: QUEUED → PREPPING → READY → SERVING
- [ ] Check order status on customer status page
- [ ] Customer clicks "I'm Done Eating"
- [ ] Verify pod moves to Cleaning in Pods Manager
- [ ] Staff clicks "Cleaning Complete"
- [ ] Verify pod moves to Available
- [ ] Check that metrics update correctly

### Step 4: Monitor for Errors

Check application logs for:
- [ ] Database connection errors
- [ ] API endpoint errors
- [ ] Missing environment variables
- [ ] Prisma client errors
- [ ] Frontend console errors

### Step 5: Performance Verification

- [ ] Kitchen Display loads in < 2 seconds
- [ ] Cleaning Management loads in < 2 seconds
- [ ] Average metrics calculate correctly
- [ ] Color coding displays correctly (green/orange/red)
- [ ] Auto-refresh works without performance issues

## 📝 Production URLs Reference

### Customer URLs
- Home: `https://ohbeef.com`
- Menu: `https://ohbeef.com/menu`
- Order: `https://ohbeef.com/order`
- Order Status: `https://ohbeef.com/order/status`

### Admin URLs
- Dashboard: `https://ohbeef.com/admin`
- Kitchen: `https://ohbeef.com/admin/kitchen`
- Pods: `https://ohbeef.com/admin/pods`

### API URLs
- Base: `https://your-api-domain.com` (update NEXT_PUBLIC_API_URL)
- Kitchen Metrics: `GET /kitchen/average-processing-time`
- Cleaning Metrics: `GET /cleaning/average-time`

## 🔧 Rollback Plan (If Needed)

If critical issues occur:

### 1. Rollback Code
```bash
git revert HEAD
git push origin main
# Redeploy all services
```

### 2. Database Rollback (Not Recommended)
The schema changes are backward compatible. Old code will work with new schema.
Only rollback database if absolutely necessary.

## ✅ Post-Deployment Tasks

After successful deployment:
- [ ] Update PRODUCTION_CREDENTIALS.md with actual production API URL
- [ ] Share admin dashboard URLs with staff
- [ ] Train kitchen staff on Kitchen Display
- [ ] Train cleaning staff on Pods Manager
- [ ] Set up monitoring/alerts for production
- [ ] Schedule regular database backups

## 📞 Support

If issues arise:
1. Check browser console for frontend errors
2. Check application logs for backend errors
3. Verify DATABASE_URL is correct in production
4. Verify all environment variables are set
5. Check Prisma Client is using production database

---

**Deployment Date**: December 9, 2025
**Database Migration**: ✅ Completed
**Code Deployment**: ⏳ Pending
**Status**: Ready for production deployment
