#!/bin/sh
set -e

# Run migrations / schema setup is handled by postgres initdb on first container start.
# Seed demo data if requested and trips table is empty.
if [ "${SEED_ON_START}" = "true" ]; then
  node scripts/seed.js || true
fi

# Start the SSR application.
exec node .output/server/index.mjs
