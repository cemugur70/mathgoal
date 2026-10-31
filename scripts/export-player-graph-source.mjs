import {open,readdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readSourceFields} from './json-source-stream.mjs';
const directory=path.resolve(process.argv[2]??'dist/data/matches'),destination=path.resolve(process.argv[3]??'data/player-graph-source.json');
const matches=new Map(),conflicts=new Set();let sources=0;
let previousId=null;
try{let schema;for await(const field of readSourceFields(destination,{arrays:['matches'],scalars:['schemaVersion','id']})){
 if(field.key==='schemaVersion')schema=field.value;
 else if(field.key==='id')previousId=field.value;
 else matches.set(String(field.value.id),field.value);
}if(schema!==1)throw Error('Graph source schema mismatch');}catch(error){if(error.code!=='ENOENT')throw error;}
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function add(m){
 if(!m?.id||!m.home?.id||!m.away?.id||!Number.isFinite(Date.parse(m.date))||!finite(m.homeScore)||!finite(m.awayScore))return;
 const row={id:String(m.id),date:m.date,completedAt:m.completedAt??m.finishedAt??m.endDate??null,home:m.home,away:m.away,leagueId:m.leagueId,
  finished:m.finished,cancelled:m.cancelled,awarded:m.awarded,homeScore:m.homeScore,awayScore:m.awayScore,stats:m.stats??{},
  players:(m.players??[]).map(p=>({id:String(p.id),name:p.name,teamId:p.teamId,position:p.position,isGoalkeeper:p.isGoalkeeper,starter:p.starter,minutes:p.minutes,
   stats:Object.fromEntries(Object.entries(p.stats??{}).filter(([,v])=>finite(v)))}))};
 const previous=matches.get(row.id);
 if(previous&&(previous.homeScore!==row.homeScore||previous.awayScore!==row.awayScore||String(previous.home.id)!==String(row.home.id)||String(previous.away.id)!==String(row.away.id))){conflicts.add(row.id);return;}
 const quality=r=>r.players.reduce((n,p)=>n+Object.values(p.stats).filter(finite).length,0);
 if(!previous||quality(row)>quality(previous))matches.set(row.id,row);
}
for(const file of (await readdir(directory)).filter(f=>/^\d+\.json$/.test(f)).sort()){
 sources++;
 for await(const {value} of readSourceFields(path.join(directory,file),{arrays:['matches','playerHistoryMatches']}))add(value);
}
for(const id of conflicts)matches.delete(id);
const rows=[...matches.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
const hash=createHash('sha256');hash.update('[');
for(let i=0;i<rows.length;i++){if(i)hash.update(',');hash.update(JSON.stringify(rows[i]));}hash.update(']');
const id=hash.digest('hex'),output=await open(destination+'.tmp','w');
try{
 await output.writeFile(JSON.stringify({schemaVersion:1,id,sources,previousId,conflicts:[...conflicts]}).slice(0,-1)+',"matches":[');
 let buffer='';
 for(let i=0;i<rows.length;i++){buffer+=(i?',':'')+JSON.stringify(rows[i]);if(buffer.length>=64*1024){await output.writeFile(buffer);buffer='';}}
 await output.writeFile(buffer+']}');
}finally{await output.close();}
await rename(destination+'.tmp',destination);
console.log(JSON.stringify({destination,id,sources,matches:rows.length,playerRecords:rows.reduce((n,m)=>n+m.players.length,0),conflicts:[...conflicts]}));
