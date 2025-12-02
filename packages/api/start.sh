#!/bin/bash
set -e

echo "Running database migration..."
npx prisma db push --accept-data-loss --schema=./prisma/schema.prisma

echo "Starting API server..."
node src/index.js
