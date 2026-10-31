#!/bin/sh
set -eu
# Explicitly authorized by the user: permanently replace mathgoal.io without backup.
test "$(readlink -f /opt/mathgoal)" = /opt/mathgoal
test -d /opt/mathgoal
test ! -L /opt/mathgoal
test "$(docker inspect mathgoal --format '{{index .Config.Labels "com.docker.compose.project"}}')" = mathgoal
docker rm -f mathgoal
docker image rm mathgoal:latest
rm -f -- /etc/cron.d/mathgoal.disabled /etc/logrotate.d/mathgoal
rm -rf -- /opt/mathgoal
mkdir -p /opt/mathgoal/app
tar -xzf /tmp/mathgoal-network-new.tar.gz -C /opt/mathgoal/app
cp /opt/mathgoal/app/docker-compose.yml /opt/mathgoal/docker-compose.yml
chown -R 1000:1000 /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
chmod -R u+rwX /opt/mathgoal/app/data /opt/mathgoal/app/dist/data
cd /opt/mathgoal
docker compose build
docker compose up -d
rm -f -- /tmp/mathgoal-network-new.tar.gz
echo 'New MathGoal application deployed; old site directory and databases removed without backup.'
