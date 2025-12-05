# Production Database Seed Guide

This guide explains how to seed your production database with data from your local development database.

## What This Does

✅ **Exports from Local → Production:**
- **2 Tenants**: Tosh's Ramen and Oh! Beef Noodle Soup
- **2 Locations**: University Place (Orem) and City Creek Mall (Salt Lake City)
- **26 Menu Items**: Including all sliders, single selections, and multiple selections with proper pricing
- **14 Badges**: Achievement badges for gamification
- **4 Challenges**: Active challenges with rewards
- **24 Seats**: QR code seating system
- **2 Location Stats**: Capacity information

❌ **Does NOT Export (Stays in Production):**
- Orders (23 in local, but production orders remain untouched)
- Users
- Credit Events
- User Badges
- User Challenges

## Step-by-Step Instructions

### 1. Preview the Data (Optional but Recommended)

First, see what data will be exported:

```bash
cd /Users/ddidericksen/Projects/oh/oh-platform
pnpm --filter @oh/db seed:prod:preview
```

This shows a summary of all the data that will be sent to production.

### 2. Get Your Railway Database URL

1. Go to your Railway dashboard: https://railway.app
2. Navigate to your project
3. Click on your PostgreSQL database
4. Find the "Connect" section
5. Copy the **Connection URL** (it looks like: `postgresql://postgres:PASSWORD@HOST:PORT/railway`)

### 3. Run the Production Seed

Set the Railway database URL and run the export:

```bash
export RAILWAY_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:PORT/railway"

# Then run the seed
pnpm --filter @oh/db seed:prod
```

**Or do it in one command:**

```bash
RAILWAY_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:PORT/railway" pnpm --filter @oh/db seed:prod
```

### 4. Verify in Production

After the seed completes, verify your production data:

1. Visit your production website
2. Check that menu items are displaying correctly
3. Test the order flow with the new menu items
4. Verify locations are showing

## What the Script Does

The script uses **upsert** operations, which means:
- If a record exists (by ID), it **updates** it
- If a record doesn't exist, it **creates** it
- **No data is deleted** - existing production orders and users are safe

## Safety Features

✅ **Safe to run multiple times** - Uses upsert, won't create duplicates
✅ **Preserves IDs** - Maintains relationships between records
✅ **No deletion** - Only inserts and updates
✅ **Orders untouched** - Production orders remain completely intact

## Troubleshooting

### Error: "RAILWAY_DATABASE_URL environment variable is not set"

Make sure you've exported the variable:
```bash
export RAILWAY_DATABASE_URL="your-url-here"
```

### Connection Errors

- Verify the Railway URL is correct (copy it fresh from Railway dashboard)
- Check that your IP is not blocked by Railway (they whitelist by default)
- Ensure the database is running in Railway

### "Cannot find module" Errors

Make sure all dependencies are installed:
```bash
pnpm install
```

## After Seeding

Once the seed completes successfully:

1. ✅ Your production menu will match your local development menu
2. ✅ All slider configurations, pricing, and selection modes will be correct
3. ✅ Badges and challenges will be available for gamification
4. ✅ Locations will be properly configured
5. ✅ **Existing production orders remain untouched**

## Example Output

When the seed runs successfully, you'll see:

```
🚀 Starting export to production...

📦 Exporting data from local database...

✓ Found 2 tenant(s)
✓ Found 2 location(s)
✓ Found 26 menu item(s)
✓ Found 14 badge(s)
✓ Found 4 challenge(s)
✓ Found 24 seat(s)
✓ Found 2 location stats record(s)

📤 Importing data to production...

Importing tenants...
  ✓ Tosh's Ramen
  ✓ Oh! Beef Noodle Soup

Importing locations...
  ✓ University Place (Orem)
  ✓ City Creek Mall (Salt Lake City)

Importing menu items...
  ✓ Classic Beef Noodle Soup ($15.99) - SINGLE
  ✓ Soup Richness ($0.00) - SLIDER
  ... [24 more items]

Importing badges...
  ✓ 🍜 First Bowl
  ... [13 more badges]

Importing challenges...
  ✓ 🗺️ Noodle Explorer ($5.00)
  ... [3 more challenges]

  ✓ Imported 24 seat(s)
  ✓ Imported 2 location stats record(s)

✅ Export to production completed successfully!

Summary:
  - 2 tenant(s)
  - 2 location(s)
  - 26 menu item(s)
  - 14 badge(s)
  - 4 challenge(s)
  - 24 seat(s)
  - 2 location stats

⚠️  Note: Orders, users, and related data were NOT exported (as requested)
```

## Need Help?

If you encounter any issues:
1. Check the error message carefully
2. Verify your DATABASE_URL (local) is correct
3. Verify your RAILWAY_DATABASE_URL (production) is correct
4. Make sure both databases are accessible
5. Check that you have the latest code: `git pull`
