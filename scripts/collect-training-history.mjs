// Adds completed past-season league fixtures to the training archive.
// Usage: node scripts/collect-training-history.mjs [--leagues 87] [--seasons 2024/2025,2025/2026] [--source data/training-source.json] [--out <same as source>]
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFotMobClient} from './fotmob-source.mjs';
import {normalizeMatch} from '../dist/match-data.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const root=fileURLToPath(new URL('../',import.meta.url));
const leagues=arg('leagues','87').split(',').map(s=>s.trim()).filter(Boolean),seasonList=arg('seasons','2024/2025,2025/2026').split(',').map(s=>s.trim()).filter(Boolean);
if(!leagues.every(id=>/^\d{1,9}$/.test(id))||!seasonList.every(s=>/^\d{4}(\/\d{4})?$/.test(s)))throw Error('Geçersiz lig veya sezon seçimi.');
const sourceFile=path.resolve(root,arg('source','data/training-source.json')),outFile=path.resolve(root,arg('out',sourceFile));
const source=JSON.parse(await readFile(sourceFile,'utf8'));
const cache=path.join(root,'data','cache');await mkdir(cache,{recursive:true});
const get=createFotMobClient({cache,throttleMs:180});
const merged=new Map(source.matches.map(m=>[String(m.id),m])),errors=[],seasons=[];
for(const leagueId of leagues)for(const season of seasonList){
 const url=new URL('https://www.fotmob.com/api/data/leagues');url.searchParams.set('id',leagueId);url.searchParams.set('season',season);
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok){errors.push({leagueId,season,error:`League HTTP ${response.status}`});continue;}
 const league=await response.json();
 if(String(league.details?.id)!==leagueId||league.details?.selectedSeason!==season){errors.push({leagueId,season,error:'Season identity mismatch'});continue;}
 const fixtures=(league.fixtures?.allMatches??[]).filter(m=>m.status?.finished&&!m.status.cancelled&&!m.status.awarded);
 let next=0,acquired=0;
 await Promise.all(Array.from({length:3},async()=>{while(next<fixtures.length){const fixture=fixtures[next++];
  try{
   const raw=await get('matchDetails',fixture.id,false,{signal:AbortSignal.timeout(30000)});
   if(String(raw.general?.matchId)!==String(fixture.id)||![raw.general?.leagueId,raw.general?.parentLeagueId].map(String).includes(leagueId)||!raw.general?.finished)throw Error('Match identity/status mismatch');
   const m=normalizeMatch(raw,new Map());
   if(!Number.isInteger(m.homeScore)||!Number.isInteger(m.awayScore))throw Error('Missing final score');
   const row={id:String(m.id),date:m.date,home:m.home,away:m.away,homeScore:m.homeScore,awayScore:m.awayScore,
    leagueId:Number(leagueId),finished:true,completedAt:null,stats:Object.fromEntries(Object.entries(m.stats??{}).map(([k,v])=>[k,{values:v.values}]))};
   const old=merged.get(row.id);
   if(old&&(old.homeScore!==row.homeScore||old.awayScore!==row.awayScore||String(old.home.id)!==String(row.home.id)))throw Error('Conflicting archived outcome');
   if(!old)merged.set(row.id,row);acquired++;if(acquired%100===0)console.log(`${leagueId} ${season}: ${acquired}/${fixtures.length} geçmiş maç`);
  }catch(e){errors.push({leagueId,season,id:String(fixture.id),error:e.message});}
 }}));
 seasons.push({leagueId:Number(leagueId),season,expected:fixtures.length,acquired,source:url.href});
 console.log(`${leagueId} ${season}: ${acquired}/${fixtures.length} tamam`);
}
source.matches=[...merged.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
const known=new Set((source.sources??[]).filter(s=>s.season).map(s=>`${s.leagueId}:${s.season}`));
source.sources=[...(source.sources??[]),...seasons.filter(s=>!known.has(`${s.leagueId}:${s.season}`))];source.historyCollectionErrors=errors;source.createdAt=new Date().toISOString();
source.sourceId=createHash('sha256').update(JSON.stringify(source.matches)).digest('hex');
await writeFile(outFile+'.tmp',JSON.stringify(source));await rename(outFile+'.tmp',outFile);
console.log(JSON.stringify({matches:source.matches.length,seasons,errors:errors.length,errorSample:errors.slice(0,5)}));
