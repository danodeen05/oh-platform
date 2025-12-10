# Database Migration Guide for Production

## Overview
This deployment includes significant schema changes that must be applied to your production PostgreSQL database.

## Schema Changes Summary

### New Fields Added to Order Model
1. **orderQrCode** (String, unique, optional) - QR code for kiosk and pod scanning
2. **kitchenOrderNumber** (String, optional) - Daily sequential number for kitchen
3. **paidAt** (DateTime, optional) - Payment success timestamp
4. **arrivedAt** (DateTime, optional) - Kiosk check-in timestamp
5. **queuedAt** (DateTime, optional) - Queue entry timestamp
6. **prepStartTime** (DateTime, optional) - Kitchen prep start timestamp
7. **readyTime** (DateTime, optional) - Food ready timestamp
8. **deliveredAt** (DateTime, optional) - Food delivered timestamp
9. **completedTime** (DateTime, optional) - Customer finished timestamp
10. **podAssignedAt** (DateTime, optional) - Pod assignment timestamp
11. **podConfirmedAt** (DateTime, optional) - Pod QR scan confirmation timestamp
12. **podReservationExpiry** (DateTime, optional) - Reservation timeout
13. **podSelectionMethod** (String, optional) - Assignment method
14. **queuePosition** (Int, optional) - Position in queue
15. **estimatedWaitMinutes** (Int, optional) - Wait time estimate
16. **arrivalDeviation** (Int, optional) - Minutes early/late
17. **notifiedAt** (DateTime, optional) - Notification sent timestamp
18. **notificationMethod** (String, optional) - Notification channel

### New Enum Value
- **OrderStatus.SERVING** - Added to existing OrderStatus enum

### New Fields Added to User Model
1. **avgArrivalDeviation** (Float, optional) - Average arrival pattern
2. **arrivalAccuracy** (Float, optional) - On-time percentage (0-1)
3. **onTimeArrivals** (Int, default 0) - Count of on-time arrivals

### New Model: WaitQueue
```prisma
model WaitQueue {
  id              String      @id @default(cuid())
  orderId         String      @unique
  order           Order       @relation(fields: [orderId], references: [id])
  locationId      String
  location        Location    @relation(fields: [locationId], references: [id])

  arrivedAt       DateTime
  estimatedArrival DateTime?
  priority        Int
  status          QueueStatus @default(WAITING)

  assignedAt      DateTime?
  expiredAt       DateTime?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([locationId, status, priority])
}

enum QueueStatus {
  WAITING
  ASSIGNED
  CONFIRMED
  EXPIRED
}
```

### New Field Added to OrderItem Model
- **selectedValue** (String, optional) - For slider items (e.g., "Light", "Medium", "Rich")

## Migration Steps

### Step 1: Set Your Production Database URL

You need to set the `DATABASE_URL` environment variable to point to your production database. This should be in your `.env` file or set as an environment variable.

**IMPORTANT**: Make sure you have a backup of your production database before proceeding!

### Step 2: Push Schema to Production Database

Run this command to push the schema changes to production:

```bash
# If using local .env with production DATABASE_URL
pnpm db:push

# OR if you need to specify the database URL directly
DATABASE_URL="your-production-postgres-url" pnpm db:push
```

**Example with Supabase/Neon/Railway:**
```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname" pnpm db:push
```

### Step 3: Verify Migration Success

After running the migration, verify:

1. **Check for errors** in the console output
2. **Verify tables exist**:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('Order', 'User', 'WaitQueue', 'OrderItem');
   ```

3. **Check new columns**:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'Order'
   AND column_name IN ('orderQrCode', 'arrivedAt', 'queuedAt', 'completedTime');
   ```

4. **Verify enum updated**:
   ```sql
   SELECT enumlabel FROM pg_enum
   WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus');
   ```
   Should include: PENDING_PAYMENT, PAID, QUEUED, PREPPING, READY, SERVING, COMPLETED, CANCELLED

### Step 4: Regenerate Prisma Client in Production

After pushing schema changes, regenerate the Prisma client:

```bash
pnpm prisma generate
```

Or if your production uses a specific package:
```bash
cd packages/db
pnpm prisma generate
```

## Data Migration Notes

### Existing Orders
- All existing orders will have NULL values for new timestamp fields
- This is expected and safe
- New orders will populate these fields as they progress through the flow

### Existing Users
- All users will have default values:
  - `avgArrivalDeviation`: NULL
  - `arrivalAccuracy`: NULL
  - `onTimeArrivals`: 0
- These will populate as users check in at kiosks

### No Data Loss
- No existing data will be lost
- All new fields are optional (nullable) or have default values
- Existing orders and users remain unchanged

## Rollback Plan

If you need to rollback the schema changes:

### Option 1: Revert to Previous Schema (Not Recommended)
```bash
git checkout <previous-commit> packages/db/prisma/schema.prisma
pnpm db:push
```

### Option 2: Keep Schema but Remove Migration (Recommended)
The new fields are all optional, so the old code will continue to work even with the new schema. Simply redeploy the previous version of your application code.

## Production Database URL Examples

### Supabase
```
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Neon
```
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require"
```

### Railway
```
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/railway"
```

### Heroku Postgres
```
DATABASE_URL="postgres://[USER]:[PASSWORD]@[HOST]:5432/[DATABASE]"
```

## Testing After Migration

1. **Test order creation**:
   - Place a test order
   - Verify `orderQrCode` is generated

2. **Test kitchen display**:
   - Navigate to `/admin/kitchen`
   - Verify orders display correctly

3. **Test cleaning management**:
   - Navigate to `/admin/pods`
   - Verify pods display correctly

4. **Test check-in flow** (optional):
   - Use a test order QR code
   - Navigate to `/order/check-in`
   - Verify check-in works

## Environment Variables Required

Make sure these are set in production:

```env
# Required
DATABASE_URL="postgresql://..."

# For API
NEXT_PUBLIC_API_URL="https://your-api-domain.com"

# For Clerk (if not already set)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
```

## Support

If you encounter issues:

### Common Errors

**Error: "relation already exists"**
- This means the table already exists
- Safe to ignore if schema matches

**Error: "column already exists"**
- This means the column already exists
- Safe to ignore if data type matches

**Error: "enum value already exists"**
- This means the enum value is already there
- Safe to ignore

### Getting Help

1. Check Prisma logs: `pnpm prisma db push --help`
2. Verify database connection: `pnpm prisma db pull`
3. Review migration diff: Prisma will show you what changes will be applied

## Post-Migration Checklist

- [ ] Schema pushed to production database
- [ ] Prisma client regenerated
- [ ] New `SERVING` status appears in OrderStatus enum
- [ ] New `WaitQueue` table created
- [ ] New fields added to Order model
- [ ] New fields added to User model
- [ ] New field added to OrderItem model
- [ ] No existing data lost or corrupted
- [ ] Application deployed and running
- [ ] Kitchen Display loads without errors
- [ ] Cleaning Management loads without errors
- [ ] Test order can be created
- [ ] Performance metrics display correctly

---

**Migration Created**: December 9, 2025
**Schema Version**: v1.0 (Queue Management System)
**Breaking Changes**: None (all new fields are optional)
