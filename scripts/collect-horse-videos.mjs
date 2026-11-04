// Reads TJK race videos for archived races into data/horse/video/{date}-{city}-{number}.json (splits and running positions).
// Usage: node scripts/collect-horse-videos.mjs --from 2026-09-01 [--to <archive end>] [--all-tracks] [--concurrency 2]
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {summarizeRace} from '../dist/horse-video.mjs';
import {parseTiming} from '../dist/horse-speed.mjs';
import {readRaceVideo,videoUrl,VIDEO_CITY} from './horse-video-source.mjs';
import {CITIES} from './liderform-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),out=path.join(dir,'video');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;};
const from=arg('from'),to=arg('to')||'9999-12-31',concurrency=Number(arg('concurrency')||2),allTracks=process.argv.includes('--all-tracks');
if(!/^\d{4}-\d{2}-\d{2}$/.test(from||''))throw Error('--from YYYY-AA-GG gerekli');
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw Error('--concurrency 1–3 olmalı');
const db=new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true});
const races=db.prepare("SELECT id,date,city,number,distance FROM races WHERE status='RESULT' AND date>=? AND date<=? ORDER BY date DESC,city,number").all(from,to)
 .filter(r=>r.city in VIDEO_CITY&&(allTracks||r.city in CITIES));
const runners=db.prepare("SELECT e.number,e.place,(SELECT u.timing FROM runs u WHERE u.horse_id=e.horse_id AND u.date=?) timing FROM entries e WHERE e.race_id=? AND e.status<>'NONRUNNER'");
const field=new Map(races.map(r=>[r.id,runners.all(r.date,r.id)]));db.close();
await mkdir(out,{recursive:true});
const progress={from,to,startedAt:new Date().toISOString(),races:races.length,done:0,cached:0,ok:0,missing:0,failed:0,errors:[]};
const save=()=>writeFile(path.join(dir,'video-progress.json'),JSON.stringify(progress,null,1));
let next=0;
const worker=async()=>{while(next<races.length){const r=races[next++],file=path.join(out,`${r.date}-${r.city}-${r.number}.json`);
 if(await access(file).then(()=>true,()=>false)){progress.cached++;}
 else{
  const es=field.get(r.id),url=videoUrl(r.date,r.city,r.number),winner=es.find(e=>e.place===1);let rec;
  try{const frames=await readRaceVideo(url);rec={url,distance:r.distance,...summarizeRace(frames,{distance:r.distance,field:es.map(e=>Number(e.number)),winnerTime:parseTiming(winner?.timing)})};}
  catch(e){rec={url,ok:false,reason:e.notFound?'missing':'error',error:String(e.message).slice(0,200)};}
  rec.readAt=new Date().toISOString();
  // Network failures are not cached, so a rerun retries them.
  if(rec.reason!=='error')await writeFile(file,JSON.stringify(rec));
  if(rec.ok)progress.ok++;else if(rec.reason==='missing')progress.missing++;else{progress.failed++;if(rec.reason==='error')progress.errors.push({race:r.id,error:rec.error});}
 }
 progress.done++;if(progress.done%25===0){await save();console.log(`${progress.done}/${races.length} koşu · ${progress.ok} okundu, ${progress.missing} video yok, ${progress.failed} okunamadı`);}
}};
await Promise.all(Array.from({length:concurrency},worker));
progress.finishedAt=new Date().toISOString();await save();console.log('Bitti',JSON.stringify({...progress,errors:progress.errors.length}));
