#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-upcoming-update.tar.gz -C /opt/mathgoal/app
chown -R 1000:1000 /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
chmod -R u+rwX /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
cd /opt/mathgoal
docker compose build
docker compose up -d
rm -f -- /tmp/mathgoal-upcoming-update.tar.gz
