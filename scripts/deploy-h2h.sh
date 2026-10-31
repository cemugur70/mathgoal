#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-h2h-update.tar.gz -C /opt/mathgoal/app
chown -R 1000:1000 /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
chmod -R u+rwX /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
cd /opt/mathgoal
docker compose build
docker compose up -d
docker exec mathgoal node scripts/h2h-enrich.mjs
rm -f -- /tmp/mathgoal-h2h-update.tar.gz
