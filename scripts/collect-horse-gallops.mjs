// Collects the public liderform gallop page (runners' last ten workouts before the race) of each cached programme race into
// data/horse/cache. Races come from the cached programme pages, so it can run before the database rebuild that reads them.
// Usage: node scripts/collect-horse-gallops.mjs --from 2026-01-01 [--to 2026-11-02]
import {readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {CITIES,createGallopClient} from './liderform-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),cache=path.join(dir,'cache');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;};
const from=arg('from'),to=arg('to')||'9999-12-31';
if(!/^\d{4}-\d{2}-\d{2}$/.test(from||''))throw Error('--from YYYY-AA-GG gerekli');
const races=(await readdir(cache)).map(f=>f.match(/^program-(\d{4}-\d{2}-\d{2})-([a-z]+)-(\d+)\.json\.gz$/)).filter(m=>m&&m[1]>=from&&m[1]<=to&&m[2] in CITIES)
 .map(([,date,city,number])=>({date,city,number})).sort((a,b)=>b.date.localeCompare(a.date)||a.city.localeCompare(b.city)||a.number-b.number);
const gallops=createGallopClient({cache});
const progress={from,to,startedAt:new Date().toISOString(),races:races.length,done:0,withWorkouts:0,notFound:0,errors:[]};
const save=()=>writeFile(path.join(dir,'gallop-progress.json'),JSON.stringify(progress,null,1));
for(const r of races){
 try{const page=await gallops(r.date,r.city,r.number);if(page.notFound)progress.notFound++;else if(page.runners.some(x=>x.workouts.length))progress.withWorkouts++;}
 catch(e){progress.errors.push({race:`${r.date}-${r.city}-${r.number}`,error:String(e.message).slice(0,200)});}
 progress.done++;if(progress.done%50===0){await save();console.log(`${progress.done}/${races.length} koşu · ${progress.withWorkouts} galoplu, ${progress.notFound} sayfa yok, ${progress.errors.length} hata`);}
}
progress.finishedAt=new Date().toISOString();await save();
console.log(JSON.stringify({races:races.length,withWorkouts:progress.withWorkouts,notFound:progress.notFound,errors:progress.errors.length}));
