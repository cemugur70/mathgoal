import {readFile,writeFile,readdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const directory=path.resolve(process.argv[2]??'dist/data/matches'),destination=path.resolve(process.argv[3]??'data/training-source.json');
const matches=new Map(),conflicts=new Set(),sources=[];
function add(m){
 if(!m?.id||!m.home?.id||!m.away?.id||!Number.isFinite(Date.parse(m.date)))return;
 if(!Number.isInteger(m.homeScore)||!Number.isInteger(m.awayScore)||Math.min(m.homeScore,m.awayScore)<0||Math.max(m.homeScore,m.awayScore)>30)return;
 if(m.finished===false||m.cancelled||m.awarded||Number(m.leagueId)===489)return;
 const id=String(m.id),row={id,date:m.date,home:m.home,away:m.away,homeScore:m.homeScore,awayScore:m.awayScore,
  leagueId:m.leagueId,finished:true,completedAt:m.completedAt??m.finishedAt??m.endDate??null,
  stats:Object.fromEntries(Object.entries(m.stats??{}).filter(([,v])=>Array.isArray(v?.values)).map(([k,v])=>[k,{values:v.values.map(x=>typeof x==='number'&&Number.isFinite(x)?x:null)}]))};
 const previous=matches.get(id);
 if(previous&&(String(previous.home.id)!==String(row.home.id)||String(previous.away.id)!==String(row.away.id)||previous.date!==row.date||previous.homeScore!==row.homeScore||previous.awayScore!==row.awayScore)){conflicts.add(id);return;}
 if(!previous||Object.keys(row.stats).length>Object.keys(previous.stats).length)matches.set(id,row);
}
try{
 const previous=JSON.parse(await readFile(destination,'utf8'));
 for(const m of previous.matches??[])add(m);
 sources.push(...(previous.sources??[]).filter(s=>s.season));
}catch(error){if(error.code!=='ENOENT')throw error;}
for(const file of (await readdir(directory)).filter(f=>/^\d+\.json$/.test(f)).sort()){
 const bundle=JSON.parse(await readFile(path.join(directory,file),'utf8'));
 sources.push({file,matchId:bundle.target?.id,collectedAt:bundle.collectedAt,matches:bundle.matches?.length??0});
 for(const m of bundle.matches??[])add(m);
 if(bundle.target?.finished&&bundle.actual)add({...bundle.target,...bundle.actual,stats:{}});
}
for(const id of conflicts)matches.delete(id);
const rows=[...matches.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
const sourceId=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
await writeFile(destination+'.tmp',JSON.stringify({schemaVersion:1,sourceId,createdAt:new Date().toISOString(),sources,conflictingMatchIds:[...conflicts],matches:rows}));await rename(destination+'.tmp',destination);
console.log(JSON.stringify({destination,sourceId,sources:sources.length,matches:rows.length,conflicts:[...conflicts],first:rows[0]?.date,last:rows.at(-1)?.date}));
