#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-simulation-audit-update.tar.gz -C /opt/mathgoal/app
cd /opt/mathgoal
docker compose build
docker compose up -d
