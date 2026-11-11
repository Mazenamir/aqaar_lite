#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Seeding initial multi-tenant data..."
npx tsx prisma/seed.ts || echo "Seed already applied or failed gracefully"

echo "Starting Aqar Lite production server..."
exec npm start
