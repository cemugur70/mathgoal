#!/bin/sh
set -eu
test "$(readlink -f /opt/mathgoal/app)" = /opt/mathgoal/app
# Keep the currently displayed match, including user-triggered collections.
docker exec mathgoal node -e "const fs=require('fs');const p='/app/dist/data/bundle.json';const d=JSON.parse(fs.readFileSync(p,'utf8'));fs.mkdirSync('/app/dist/data/matches',{recursive:true});fs.writeFileSync('/app/dist/data/matches/'+d.target.id+'.json',JSON.stringify(d));"
tar -xzf /tmp/mathgoal-match-isolation.tar.gz -C /opt/mathgoal/app
chown -R 1000:1000 /opt/mathgoal/app/dist/data
chmod -R u+rwX /opt/mathgoal/app/dist/data
cd /opt/mathgoal
docker compose build
docker compose up -d
rm -f -- /tmp/mathgoal-match-isolation.tar.gz
