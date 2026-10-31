#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-player-explorer.tar.gz -C /opt/mathgoal/app
cd /opt/mathgoal
docker compose build
docker compose up -d
