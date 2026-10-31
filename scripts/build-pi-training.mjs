import {readFile,writeFile,rename} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createPiRatingIndex,PI_FEATURE_NAMES,PI_POLICY} from '../dist/pi-ratings.mjs';
// Adds strictly as-of pi-rating features to schema-6 rows; the schema version stays 6 and older clients ignore the extra fields.
const file=new URL(process.argv[2]??'../dist/data/training.json',import.meta.url),data=JSON.parse(await readFile(file));
if(data.schemaVersion!==6)throw Error('Pi-rating katmanı için önce sezon özellikleri oluşturulmalı.');
const labels=JSON.parse(await readFile(new URL('../data/training-source.json',import.meta.url))),source=JSON.parse(await readFile(new URL('../data/player-graph-source.json',import.meta.url)));
const index=createPiRatingIndex([...labels.matches,...source.matches]);let ready=0;
// The replay only moves forward, so rows are visited in kickoff order.
for(const row of [...data.rows].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||String(a.id).localeCompare(String(b.id)))){
 if(!row.homeTeam?.id||!row.awayTeam?.id)throw Error('Missing teams '+row.id);
 const f=index.features({id:row.id,date:row.date,home:row.homeTeam,away:row.awayTeam},{cutoff:row.date});
 if(f.evidence.maxAvailableAt&&Date.parse(f.evidence.maxAvailableAt)>=Date.parse(row.date))throw Error('Future pi evidence: '+row.id);
 row.homePiFeatures=f.home;row.awayPiFeatures=f.away;row.piFeatureMaxAvailableAt=f.evidence.maxAvailableAt;row.piCoverage=f.coverage;if(f.coverage.status==='ready')ready++;
}
data.piFeatureNames=[...PI_FEATURE_NAMES];data.piPolicy={...PI_POLICY};data.piSource={labelsId:labels.sourceId,playerSourceId:source.id,archiveMatches:index.size,readyRows:ready};
data.id=createHash('sha256').update(JSON.stringify({previous:data.id,piPolicy:data.piPolicy,piSource:data.piSource})).digest('hex');data.createdAt=new Date().toISOString();
await writeFile(new URL(file.href+'.tmp'),JSON.stringify(data));await rename(new URL(file.href+'.tmp'),file);
console.log(JSON.stringify({schema:data.schemaVersion,id:data.id,rows:data.rows.length,piReadyRows:ready,archiveMatches:index.size,piFeatures:PI_FEATURE_NAMES.length}));
