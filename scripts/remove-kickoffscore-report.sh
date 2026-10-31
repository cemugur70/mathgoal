#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
test "$(sha256sum /opt/mathgoal/app/dist/index.html | cut -d ' ' -f 1)" = 27248b972eda1b80386c3f9d497fbd06a0cb3a7baef5b02724ec04f9f0527e88
tar -xzf /tmp/mathgoal-remove-source-report.tar.gz -C /opt/mathgoal/app
rm -f /opt/mathgoal/app/dist/sources/kickoffscore-1557444.html
chown 1000:1000 /opt/mathgoal/app/dist/index.html /opt/mathgoal/app/dist/release.mjs
chmod 644 /opt/mathgoal/app/dist/index.html /opt/mathgoal/app/dist/release.mjs
# Take the report and entry offline immediately; the rebuilt image persists it.
docker cp /opt/mathgoal/app/dist/index.html mathgoal:/app/dist/index.html
docker exec mathgoal rm -f /app/dist/sources/kickoffscore-1557444.html
cd /opt/mathgoal
docker compose build
docker compose up -d
