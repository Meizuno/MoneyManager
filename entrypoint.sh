#!/bin/sh
set -e

node_modules/.bin/prisma migrate deploy
exec node .output/server/index.mjs
