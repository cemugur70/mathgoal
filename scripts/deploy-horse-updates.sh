#!/bin/sh
# Deploys the horse-racing refresh (scheduler, collector, database builder, publisher) with the liderform page archive and model.
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-horse-updates.tar.gz -C /opt/mathgoal/app
chown -R 1000:1000 /opt/mathgoal/app/data/horse /opt/mathgoal/app/dist/data/horse
chmod -R u+rwX /opt/mathgoal/app/data/horse /opt/mathgoal/app/dist/data/horse
cd /opt/mathgoal
docker compose build
docker compose up -d
rm -f -- /tmp/mathgoal-horse-updates.tar.gz
echo DEPLOY_OK
