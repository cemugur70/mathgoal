#!/bin/sh
# Deploys the background training queue, pi-rating layer and past-season archive; then starts one background retraining.
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
backup=/opt/mathgoal/backup-history-pi-$(date +%Y%m%d%H%M%S)
mkdir -p "$backup"
cp /opt/mathgoal/docker-compose.yml /opt/mathgoal/app/data/training-source.json /opt/mathgoal/app/dist/data/training.json "$backup/"
tar -xzf /tmp/mathgoal-history-pi.tar.gz -C /opt/mathgoal/app
chown -R 1000:1000 /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
chmod -R u+rwX /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
# The 10k-match archive needs about 1.2 GB of heap during training; the old 1 GB container limit allowed only ~550 MB.
cd /opt/mathgoal
sed -i 's/^    mem_limit: 1g$/    mem_limit: 3g/' docker-compose.yml
grep -q 'NODE_OPTIONS' docker-compose.yml || sed -i 's/^      NODE_ENV: production$/      NODE_ENV: production\n      NODE_OPTIONS: --max-old-space-size=2048/' docker-compose.yml
grep -q '^    mem_limit: 3g$' docker-compose.yml
grep -q 'NODE_OPTIONS: --max-old-space-size=2048' docker-compose.yml
docker compose build
docker compose up -d
docker exec mathgoal node scripts/merge-training-archive.mjs data/history-seasons.json
docker exec mathgoal sh -c 'echo "{\"matchId\":\"history-pi-deploy\",\"requestedAt\":\"$(date -u +%FT%TZ)\"}" > data/training.pending'
docker exec -d mathgoal sh -c 'node scripts/train-queue.mjs >> data/training-queue.log 2>&1'
rm -f -- /tmp/mathgoal-history-pi.tar.gz
echo "DEPLOY_OK backup=$backup"
