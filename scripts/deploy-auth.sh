#!/bin/sh
# Deploys membership (sign-in gate, member admin page) and interface wording. Accounts live in data/auth on the data volume.
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
tar -xzf /tmp/mathgoal-auth.tar.gz -C /opt/mathgoal/app
mkdir -p /opt/mathgoal/app/data/auth
chown -R 1000:1000 /opt/mathgoal/app/data/auth
chmod 700 /opt/mathgoal/app/data/auth
cd /opt/mathgoal
docker compose build
docker compose up -d
rm -f -- /tmp/mathgoal-auth.tar.gz
echo DEPLOY_OK
