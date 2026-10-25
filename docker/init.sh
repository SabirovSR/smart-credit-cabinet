#!/bin/sh
set -eu
mkdir -p /data/uploads
chown 1000:1000 /data/uploads
./node_modules/.bin/prisma migrate deploy
if [ "${DEMO_MODE:-false}" = "true" ]; then
  ./node_modules/.bin/tsx prisma/seed.ts
fi
