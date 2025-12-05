# Database Scripts

## Export to Production

This script exports data from your local development database to production, **excluding orders and user data**.

### What Gets Exported

✅ **Exported:**
- Tenants (brand configurations)
- Locations (restaurant locations)
- Menu Items (all items with pricing, slider configs, etc.)
- Badges (achievement badges)
- Challenges (gamification challenges)
- Seats (QR code seating)
- Location Stats (capacity info)

❌ **NOT Exported:**
- Orders
- Order Items
- Users
- Credit Events
- User Badges
- User Challenges
- Platform Transactions

### Usage

1. **Set your Railway database URL:**
   ```bash
   export RAILWAY_DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
   ```

2. **Run the export:**
   ```bash
   # From the project root:
   pnpm --filter @oh/db seed:prod

   # Or from packages/db:
   cd packages/db
   pnpm seed:prod
   ```

### Safety Features

- Uses `upsert` to avoid duplicates (updates existing records)
- Preserves IDs for data consistency
- No data deletion (only inserts/updates)
- Existing orders in production are completely untouched

### Example Output

```
🚀 Starting export to production...

📦 Exporting data from local database...

✓ Found 1 tenant(s)
✓ Found 2 location(s)
✓ Found 45 menu item(s)
✓ Found 14 badge(s)
✓ Found 4 challenge(s)
✓ Found 24 seat(s)
✓ Found 2 location stats record(s)

📤 Importing data to production...

Importing tenants...
  ✓ Oh! Beef Noodle Soup

Importing locations...
  ✓ Lehi Flagship (Lehi)
  ✓ Provo Station (Provo)

Importing menu items...
  ✓ Beef Noodle Bowl ($10.99) - SINGLE
  ✓ Baby Bok Choy ($3.99) - SLIDER
  ...

✅ Export to production completed successfully!
```

### Troubleshooting

**Error: "RAILWAY_DATABASE_URL environment variable is not set"**
- Make sure you've exported the variable in your current shell session
- Get the URL from your Railway dashboard → Database → Connect

**Error: "Cannot find module"**
- Make sure you're running from the project root or packages/db directory
- Ensure dependencies are installed: `pnpm install`

**Connection errors**
- Verify your DATABASE_URL is correct for local db
- Verify your RAILWAY_DATABASE_URL is correct for production
- Check network connectivity to Railway
