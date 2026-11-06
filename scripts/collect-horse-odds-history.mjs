// Collects each settled race's win-pool price series from TJK's public probable-payouts page into data/horse/odds-history/YYYY-MM.jsonl (one race per line).
// Usage: node scripts/collect-horse-odds-history.mjs --from 2026-01-01 [--to 2026-11-05]. Resumes where it stopped; newest races first; at most two requests a second.
import {readFile,appendFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {parseOddsHistory} from '../dist/horse-odds.mjs';
import {CITIES} from './liderform-source.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse/odds-history');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;},from=arg('from')||'2026-01-01',to=arg('to')||'9999-12-31',PAUSE=500;
await mkdir(dir,{recursive:true});
const done=new Set();
for(const f of await readdir(dir))for(const line of (await readFile(path.join(dir,f),'utf8')).split('\n'))if(line){try{const r=JSON.parse(line);done.add(`${r.date}|${r.city}|${r.number}`);}catch{}}
const db=new DatabaseSync(path.join(root,'data/horse/horses.db'),{readOnly:true});
const races=db.prepare("SELECT date,city,number FROM races WHERE status='RESULT' AND date>=? AND date<=? ORDER BY date DESC,city,number").all(from,to).filter(r=>r.city in CITIES&&!done.has(`${r.date}|${r.city}|${r.number}`));
db.close();
console.log(JSON.stringify({bekleyen:races.length,zatenVar:done.size,from,to}));
let n=0,empty=0,failed=0;const started=Date.now();
for(const r of races){
 const url=`https://vhs.tjk.org/muhtemeller/data/history?date=${r.date}&hipodromkey=${CITIES[r.city]}&no=${r.number}&bet=GANYAN`;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; MathGoalResearch/1.0)'},signal:AbortSignal.timeout(30000)});
   if(!res.ok)throw Error('HTTP '+res.status);
   const j=await res.json();if(!j.success)throw Error('success=false');
   const h=parseOddsHistory(j.data);if(!h.t.length)empty++;
   await appendFile(path.join(dir,r.date.slice(0,7)+'.jsonl'),JSON.stringify({date:r.date,city:r.city,number:r.number,...h})+'\n');n++;break;
  }catch(error){if(attempt===3){failed++;console.error('HATA',url,String(error.message).slice(0,100));}else await delay(5000*attempt);}
 }
 // Too many failures in a row means the source does not want this; stop rather than press on.
 if(failed>=20&&failed>n*.2){console.error('Çok fazla hata, durduruldu.');process.exitCode=1;break;}
 if(n%500===0&&n)console.log(JSON.stringify({yazilan:n,bos:empty,hata:failed,dk:+((Date.now()-started)/60000).toFixed(1)}));
 await delay(PAUSE);
}
console.log(JSON.stringify({bitti:true,yazilan:n,bos:empty,hata:failed,dk:+((Date.now()-started)/60000).toFixed(1)}));
