#!/bin/sh
set -e
mkdir -p /app/storage/receipts
chown -R nextjs:nodejs /app/storage
exec su-exec nextjs "$@"
