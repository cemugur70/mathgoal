#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-outcome-code.tar.gz -C /opt/mathgoal/app
tar -xzf /tmp/mathgoal-outcome-data.tar.gz -C /opt/mathgoal/app
chown 1000:1000 /opt/mathgoal/app/data/training-source.json /opt/mathgoal/app/dist/data/training.json
chmod u+rw /opt/mathgoal/app/data/training-source.json /opt/mathgoal/app/dist/data/training.json
cd /opt/mathgoal
docker compose build
docker compose up -d
