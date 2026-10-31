import {readFile,writeFile,rename} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createSeasonFeatureIndex,SEASON_FEATURE_NAMES,SEASON_POLICY} from '../dist/season-features.mjs';
const file=new URL(process.argv[2]??'../dist/data/training.json',import.meta.url),data=JSON.parse(await readFile(file));
if(data.schemaVersion<5)throw Error('Sezon katmanı için önce pazar ağı özellikleri oluşturulmalı.');
const labels=JSON.parse(await readFile(new URL('../data/training-source.json',import.meta.url))),source=JSON.parse(await readFile(new URL('../data/player-graph-source.json',import.meta.url)));
const index=createSeasonFeatureIndex([...labels.matches,...source.matches]),targets=new Map(labels.matches.map(m=>[String(m.id),m]));let processed=0,ready=0,rowDerived=0;
for(const row of data.rows){let target=targets.get(String(row.id));if(!target){if(!row.homeTeam?.id||!row.awayTeam?.id)throw Error('Missing target '+row.id);target={id:row.id,date:row.date,leagueId:row.leagueId,home:row.homeTeam,away:row.awayTeam};rowDerived++;}
 const f=index.features(target,{cutoff:row.date});
 if(f.evidence.matchIds.includes(String(row.id))||f.evidence.maxAvailableAt&&Date.parse(f.evidence.maxAvailableAt)>=Date.parse(row.date))throw Error('Target / future season evidence: '+row.id);
 row.homeSeasonFeatures=f.home;row.awaySeasonFeatures=f.away;row.seasonFeatureMaxAvailableAt=f.evidence.maxAvailableAt;
 row.seasonCoverage={status:f.coverage.status,homeMatches:f.coverage.homeMatches,awayMatches:f.coverage.awayMatches,leagueTeams:f.coverage.leagueTeams,season:f.season,calendar:f.calendar};
 if(f.coverage.status==='ready')ready++;
 if(++processed%500===0)console.log(`${processed}/${data.rows.length} sezon-içi özellik satırı`);
}
data.schemaVersion=6;data.seasonFeatureNames=[...SEASON_FEATURE_NAMES];data.seasonPolicy={...SEASON_POLICY,calendarLeagues:[...SEASON_POLICY.calendarLeagues],defaults:{...SEASON_POLICY.defaults}};
data.seasonSource={labelsId:labels.sourceId,playerSourceId:source.id,archiveMatches:index.size,calendarLeagues:index.calendarLeagues,readyRows:ready,rowDerivedTargets:rowDerived};
data.id=createHash('sha256').update(JSON.stringify({sourceId:data.sourceId,graphSource:data.graphSource,starterSource:data.starterSource,marketSource:data.marketSource,
 starterPolicy:data.starterPolicy,marketPolicy:data.marketPolicy,marketNetworkPolicy:data.marketNetworkPolicy,seasonPolicy:data.seasonPolicy,rows:data.rows})).digest('hex');data.createdAt=new Date().toISOString();
await writeFile(new URL(file.href+'.tmp'),JSON.stringify(data));await rename(new URL(file.href+'.tmp'),file);
console.log(JSON.stringify({schema:data.schemaVersion,id:data.id,rows:data.rows.length,readyRows:ready,rowDerivedTargets:rowDerived,archiveMatches:index.size,calendarLeagues:index.calendarLeagues,seasonFeatures:SEASON_FEATURE_NAMES.length}));
