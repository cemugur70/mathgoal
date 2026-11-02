// Collects the public liderform profile of every horse in data/horse/horses.db into data/horse/profiles.
// Usage: node scripts/collect-horse-profiles.mjs [--max-age-days 30] [--concurrency 1-4]   (default: only horses without a cached profile)
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHorseProfileClient} from './liderform-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;};
const maxAgeDays=arg('max-age-days')===null?Infinity:Number(arg('max-age-days'));
const concurrency=Number(arg('concurrency')||1);
if(!(maxAgeDays>=0))throw Error('--max-age-days sayı olmalı');
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('--concurrency 1–4 olmalı');
// Most recently raced horses first, so a partial run already covers the fields the page predicts.
const db=new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true});
const ids=db.prepare('SELECT e.horse_id id FROM entries e JOIN races r ON r.id=e.race_id WHERE e.horse_id IS NOT NULL GROUP BY e.horse_id ORDER BY max(r.date) DESC').all().map(r=>r.id);
db.close();
const profile=createHorseProfileClient({cache:path.join(dir,'profiles'),maxAgeMs:maxAgeDays*86400000});
const progress={startedAt:new Date().toISOString(),horses:ids.length,done:0,notFound:0,errors:[]};
const save=()=>writeFile(path.join(dir,'profiles-progress.json'),JSON.stringify(progress,null,1));
// A few workers share the list for the one-off archive fill; the daily run stays sequential.
let next=0;
const worker=async()=>{while(next<ids.length){const id=ids[next++];
 try{const p=await profile(id);if(p.notFound)progress.notFound++;}catch(e){progress.errors.push({id,error:String(e.message)});}
 progress.done++;if(progress.done%500===0){await save();console.log(`${progress.done}/${ids.length} at, ${progress.notFound} bulunamadı, ${progress.errors.length} hata`);}
}};
await Promise.all(Array.from({length:concurrency},worker));
progress.finishedAt=new Date().toISOString();await save();console.log('Bitti',JSON.stringify({...progress,errors:progress.errors.length}));
