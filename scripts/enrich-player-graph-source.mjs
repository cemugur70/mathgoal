import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeMatchPlayers} from '../dist/player-data.mjs';
const file=new URL('../data/player-graph-source.json',import.meta.url),source=JSON.parse(await readFile(file,'utf8'));
const labels=JSON.parse(await readFile(new URL('../data/training-source.json',import.meta.url),'utf8'));
const keys=new Set(['minutes_played','goals','expected_goals','expected_goals_on_target_variant','expected_goals_on_target','expected_assists','chances_created','key_passes','accurate_passes','defensive_actions','tackles','won_tackle','matchstats.headers.tackles','interceptions','goals_prevented','saves','keeper_saves']);
const matches=new Map(source.matches.map(m=>[String(m.id),m])),errors=[];let local=0,missing=0;
const quality=m=>(m?.players??[]).reduce((n,p)=>n+Object.values(p.stats??{}).filter(Number.isFinite).length,0);
for(const m of labels.matches){
 let row={...m,players:[]};
 try{
  const raw=JSON.parse(await readFile(new URL(`../data/cache/matchDetails-${m.id}.json`,import.meta.url),'utf8')),g=raw.general;
  if(String(g?.matchId)!==String(m.id)||String(g.homeTeam?.id)!==String(m.home.id)||String(g.awayTeam?.id)!==String(m.away.id)||raw.header?.teams?.[0]?.score!==m.homeScore||raw.header?.teams?.[1]?.score!==m.awayScore)throw Error('Source identity or outcome mismatch');
  row.players=normalizeMatchPlayers(raw).map(p=>({...p,stats:Object.fromEntries(Object.entries(p.stats??{}).filter(([k])=>keys.has(k))),statTotals:undefined}));local++;
 }catch(error){if(error.code==='ENOENT')missing++;else errors.push({id:m.id,error:error.message});}
 const previous=matches.get(String(m.id));
 if(previous&&(previous.homeScore!==m.homeScore||previous.awayScore!==m.awayScore||String(previous.home.id)!==String(m.home.id)||String(previous.away.id)!==String(m.away.id))){errors.push({id:m.id,error:'Conflicting normalized identity'});continue;}
 if(!previous||quality(row)>quality(previous))matches.set(String(m.id),row);
 if((local+missing+errors.length)%400===0)console.log(`${local} yerel ayrıntı, ${missing} yerel önbellek dışı`);
}
source.matches=[...matches.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||String(a.id).localeCompare(String(b.id)));
source.id=createHash('sha256').update(JSON.stringify(source.matches)).digest('hex');
source.enrichment={labelSourceId:labels.sourceId,localRawMatches:local,missingLocalCache:missing,errors};
await writeFile(file,JSON.stringify(source));
console.log(JSON.stringify({id:source.id,matches:source.matches.length,withPlayers:source.matches.filter(m=>m.players?.some(p=>p.minutes>0)).length,playerRecords:source.matches.reduce((n,m)=>n+(m.players?.length??0),0),...source.enrichment}));
