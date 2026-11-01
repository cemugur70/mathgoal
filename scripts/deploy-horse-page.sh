#!/bin/sh
# Deploys the horse-racing page (static files) and its published data under dist/data/horse.
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-horse-page.tar.gz -C /opt/mathgoal/app
chown -R 1000:1000 /opt/mathgoal/app/dist/data/horse
chmod -R u+rwX /opt/mathgoal/app/dist/data/horse
cd /opt/mathgoal
docker compose build
docker compose up -d
rm -f -- /tmp/mathgoal-horse-page.tar.gz
echo DEPLOY_OK
