#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-collection-cache.tar.gz -C /opt/mathgoal/app
cd /opt/mathgoal
docker compose build
docker compose up -d
rm -f -- /tmp/mathgoal-collection-cache.tar.gz
