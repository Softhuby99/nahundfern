#!/bin/sh
set -e

# Apply pending database migrations before serving traffic.
# Idempotent: schema_migrations tracks what has already been applied.
node scripts/migrate.js

# Seed demo data only when explicitly enabled (default: off).
if [ "${SEED_ON_START}" = "true" ]; then
  node scripts/seed.js || true
fi

# Start the SSR application.
exec node .output/server/index.mjs
