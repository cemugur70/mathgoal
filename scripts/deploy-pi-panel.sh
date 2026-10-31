#!/bin/sh
# Deploys the pi-rating panel; a restart interrupts any running training, so the queue is restarted afterwards.
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-pi-panel.tar.gz -C /opt/mathgoal/app
cd /opt/mathgoal
docker compose build
docker compose up -d
# No training can be running in the fresh container; a lock from the old one would otherwise look alive if its pid is reused.
docker exec mathgoal sh -c 'rm -f data/training.lock; test -f data/training.pending || echo "{\"matchId\":\"pi-panel-deploy\",\"requestedAt\":\"$(date -u +%FT%TZ)\"}" > data/training.pending'
docker exec -d mathgoal sh -c 'node scripts/train-queue.mjs >> data/training-queue.log 2>&1'
rm -f -- /tmp/mathgoal-pi-panel.tar.gz
echo DEPLOY_OK
