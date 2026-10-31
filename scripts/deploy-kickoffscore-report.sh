#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
test "$(sha256sum /opt/mathgoal/app/dist/index.html | cut -d ' ' -f 1)" = 4040a4a5da7a98e3a6b0046c22913cdd5975ca0c29d120b0295a5c81b84787c3
tar -xzf /tmp/mathgoal-kickoffscore-report.tar.gz -C /opt/mathgoal/app
chown 1000:1000 /opt/mathgoal/app/dist/index.html /opt/mathgoal/app/dist/release.mjs /opt/mathgoal/app/dist/sources/kickoffscore-1557444.html
chmod 644 /opt/mathgoal/app/dist/index.html /opt/mathgoal/app/dist/release.mjs /opt/mathgoal/app/dist/sources/kickoffscore-1557444.html
cd /opt/mathgoal
docker compose build
docker compose up -d
