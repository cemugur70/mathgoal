#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-player-graph-prediction-code.tar.gz -C /opt/mathgoal/app
tar -xzf /tmp/mathgoal-player-graph-prediction-data.tar.gz -C /opt/mathgoal/app
chown 1000:1000 /opt/mathgoal/app/dist/data/training.json /opt/mathgoal/app/data/player-graph-source.json
chmod 644 /opt/mathgoal/app/dist/data/training.json /opt/mathgoal/app/data/player-graph-source.json
cd /opt/mathgoal
docker compose build
docker compose up -d
