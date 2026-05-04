#!/bin/sh
set -e

# `prisma` is installed globally in the Dockerfile (one platform's
# engines). The Nuxt server bundle in .output/server has its own
# minimal node_modules with @prisma/client + the engine binary.
prisma migrate deploy
exec node .output/server/index.mjs
