#!/bin/sh
set -e

# Always use absolute path inside Docker to avoid Prisma's schema-relative vs CWD-relative
# path resolution mismatch between the migration CLI and the runtime client.
export DATABASE_URL="file:/app/data/db.sqlite"
mkdir -p /app/data

node_modules/.bin/prisma migrate deploy
exec node .output/server/index.mjs
