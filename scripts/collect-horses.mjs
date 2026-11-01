// Collects liderform program pages for the five covered tracks, newest date first, into data/horse/cache.
// Usage: node scripts/collect-horses.mjs [--from 2024-01-01] [--to <yesterday>]
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createLiderformClient,CITIES} from './liderform-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;};
const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
const from=arg('from')||'2024-01-01',to=arg('to')||yesterday;
if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('--from / --to YYYY-AA-GG olmalı');
const program=createLiderformClient({cache:path.join(dir,'cache'),today});
const slugOf=Object.fromEntries(Object.entries(CITIES).map(([slug,code])=>[code,slug]));
const progress={from,to,startedAt:new Date().toISOString(),dates:0,meetings:0,races:0,errors:[]};
const save=()=>writeFile(path.join(dir,'collect-progress.json'),JSON.stringify(progress,null,1));
await mkdir(dir,{recursive:true});
for(let t=Date.parse(to);t>=Date.parse(from);t-=86400000){
 const date=new Date(t).toISOString().slice(0,10);
 try{
  const index=await program(date);progress.dates++;
  for(const loc of index.raceLocationsData||[]){
   const city=slugOf[loc.track_code];if(!city)continue;
   const first=await program(date,city,1);if(first.notFound)continue;
   const numbers=first.raceTimeList.map(r=>r.race_number).filter(n=>n>1);progress.meetings++;progress.races++;
   for(const n of numbers){try{await program(date,city,n);progress.races++;}catch(e){progress.errors.push({date,city,n,error:String(e.message)});}}
  }
 }catch(e){progress.errors.push({date,error:String(e.message)});}
 progress.lastDate=date;if(progress.dates%5===0){await save();console.log(`${date}: ${progress.meetings} toplantı, ${progress.races} koşu, ${progress.errors.length} hata`);}
}
progress.finishedAt=new Date().toISOString();await save();console.log('Bitti',JSON.stringify({...progress,errors:progress.errors.length}));
