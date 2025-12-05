#!/bin/bash

# Production Seed Script
# Seeds production database with local data (excluding orders)

set -e

echo "🌱 Production Database Seed Script"
echo "===================================="
echo ""
echo "This script will export data from your local database and import it to production."
echo "The following data will be exported:"
echo "  ✓ Tenants"
echo "  ✓ Locations"
echo "  ✓ Menu Items (with all configurations)"
echo "  ✓ Badges"
echo "  ✓ Challenges"
echo "  ✓ Seats"
echo "  ✓ Location Stats"
echo ""
echo "⚠️  The following data will NOT be exported:"
echo "  ✗ Orders"
echo "  ✗ Users"
echo "  ✗ Credit Events"
echo "  ✗ User Badges"
echo "  ✗ User Challenges"
echo ""

# Check if RAILWAY_DATABASE_URL is set
if [ -z "$RAILWAY_DATABASE_URL" ]; then
  echo "❌ Error: RAILWAY_DATABASE_URL environment variable is not set"
  echo ""
  echo "Please set it using:"
  echo "  export RAILWAY_DATABASE_URL=\"postgresql://postgres:PASSWORD@HOST:PORT/railway\""
  echo ""
  echo "Or run this script with the variable:"
  echo "  RAILWAY_DATABASE_URL=\"...\" npm run seed:prod"
  exit 1
fi

echo "✓ Railway database URL is set"
echo ""

# Set local database URL if not set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://oh:ohpassword@localhost:5432/ohdb?schema=public"
  echo "✓ Using default local database URL"
else
  echo "✓ Using custom local database URL"
fi

echo ""
read -p "⚠️  This will update your production database. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 1
fi

echo ""
echo "🚀 Starting export..."
echo ""

# Run the export script with proper PATH
export PATH="/opt/homebrew/bin:/opt/homebrew/Cellar/node@20/20.19.5/bin:$PATH"
cd "$(dirname "$0")/.."
node --loader tsx scripts/export-to-production.js

echo ""
echo "✅ Production seed completed!"
