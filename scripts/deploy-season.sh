#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-season-features.tar.gz -C /opt/mathgoal/app
chown -R 1000:1000 /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
chmod -R u+rwX /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
cd /opt/mathgoal
docker compose build
docker compose up -d
docker exec mathgoal node scripts/train.mjs
rm -f -- /tmp/mathgoal-season-features.tar.gz
