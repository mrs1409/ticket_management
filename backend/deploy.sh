#!/usr/bin/env bash
# deploy.sh — Run once after setting up production DB to apply migrations and seed
# Usage: DATABASE_URL="postgres://..." npm run migrate && npm run seed

set -e

echo "=== Running database migration ==="
npx ts-node src/db/migrate.ts

echo "=== Seeding initial data ==="
npx ts-node src/db/seed.ts

echo "=== Deployment DB setup complete ==="
