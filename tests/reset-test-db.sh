#!/usr/bin/env bash
# Recreates the throwaway test database, applies migrations and seeds demo data.
set -euo pipefail
export DATABASE_URL="${TEST_DATABASE_URL:-postgresql://shyamdham:shyamdham@localhost:5432/shyamdham_test?schema=public}"
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's#.*/([^?]+).*#\1#')
psql "${DATABASE_URL%/*}/postgres" -qc "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE);" -c "CREATE DATABASE $DB_NAME;"
npx prisma migrate deploy >/dev/null
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD=change-me-now SEED_DEMO=1 npx tsx prisma/seed.ts
