// Publishes the horse-racing page data to dist/data/horse: the model's validation summary, out-of-sample predictions for the
// most recent settled race days and predictions for today's and (once published) tomorrow's programme.
// Usage: node scripts/publish-horse-ui.mjs [--days 21] [--date YYYY-AA-GG]
import {readFile,writeFile,mkdir,rm,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHorseRatingEngine,createMeetingIndex,distanceBucket} from '../dist/horse-rating.mjs';
import {raceFeatures,raceProbabilities,FEATURE_NAMES} from '../dist/horse-model.mjs';
import {normalizeRacePage,SURFACES} from '../dist/horse-data.mjs';
import {ruleSignals} from '../dist/horse-rules.mjs';
import {createLiderformClient,createGallopClient,CITIES} from './liderform-source.mjs';
import {gallopProfile} from '../dist/horse-gallop.mjs';
import {buildSpeedPars,attachSpeedFigures} from '../dist/horse-speed.mjs';
import {loadHorseArchive} from './horse-archive.mjs';
import {createConnectionStats} from '../dist/horse-connections.mjs';
import {createSirePreference} from '../dist/horse-pedigree.mjs';
import {surpriseInputs,surpriseRisk,surpriseCandidates,riskLevel} from '../dist/horse-surprise.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/horse'),out=path.join(root,'dist/data/horse');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null;};
const today=new Date().toISOString().slice(0,10),dayCount=Number(arg('days')||21);
const upcoming=arg('date')?[arg('date')]:[today,new Date(Date.now()+86400000).toISOString().slice(0,10)];
const model=JSON.parse(await readFile(path.join(dir,'horse-model.json'),'utf8'));
const {races,runsByHorse,breedByHorse,sireByHorse,gallopPars,range}=loadHorseArchive(new DatabaseSync(path.join(dir,'horses.db'),{readOnly:true}));
// Settled days are shown with pars from the discovery period, matching their weights; live days use pars from the whole archive.
attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse,{before:model.split}));
const finished=races.filter(x=>x.race.status==='RESULT'&&x.race.winners),predicted=x=>x.race.city in CITIES;
// Settled days use the weights and rules learned on the discovery period only, so days on or after the split are true out-of-sample forecasts.
const byName=w=>FEATURE_NAMES.map(f=>w[f]??0),discWeights={obsidian:byName(model.models.obsidian.weights),piyasasiz:byName(model.models.piyasasiz.weights)};
const days=[...new Set(finished.filter(predicted).map(x=>x.race.date))].slice(-dayCount),shown=new Set(days);
const meetingIndex=createMeetingIndex(finished);
const r3=v=>v==null?null:+v.toFixed(3);

/** One race as the page shows it: runners ranked by model probability, rule hits, and the strongest head-to-head pairs. */
function raceRecord(race,entries,{ratings,rules,watched,weights,surpriseWeights,date}){
 const rows=raceFeatures(race,entries,{ratings,runsByHorse,rules,connections,pedigree}),set=entries.some(e=>e.agf1>0)?'obsidian':'piyasasiz',probs=raceProbabilities(rows,weights[set]);
 // Long-shot risk of the race and the horses outside the AGF top 3 that the model rates well above their AGF share.
 const agfRows=rows.map(r=>({number:r.number,agf:entries.find(e=>e.number===r.number)?.agf1??null}));
 const risk=surpriseWeights?surpriseRisk(surpriseInputs(race,agfRows,probs),surpriseWeights):null,candidates=new Set(surpriseWeights?surpriseCandidates(agfRows,probs,model.surprise.candidates):[]);
 const runners=rows.map((r,i)=>{const e=entries.find(x=>x.number===r.number),g=r.rating,p=r.profile,net=ratings.find(x=>x.number===r.number);
  const hits=[...rules.get(r.number).rules.map(x=>({text:x.text,weight:r3(x.weight),applied:true})),
   ...watched.get(r.number).rules.filter(x=>!rules.get(r.number).rules.some(y=>y.id===x.id)).map(x=>({text:x.text,weight:r3(x.weight),applied:false}))];
  return {number:r.number,name:r.name,prob:r3(probs[i]),netProb:r3(net?.prob),rating:{base:r3(g.base),surface:r3(g.surface),distance:r3(g.distance),starts:g.starts},
   pref:{surface:{v:r3(p.surface.value),n:p.surface.n},distance:{v:r3(p.distance.value),n:p.distance.n}},surfaces:p.surfaces,last:p.lastPlaces,
   // Three or more starts in a row outside the first three: shown as a warning, not a model input (the blend already prices it).
   drought:p.sinceTop3>=3?{runs:p.sinceTop3,never:!p.everTop3}:null,start:e?.start??null,kg:e?.kg??null,
   jockey:e?.jockey??null,handicap:e?.handicap??null,point:e?.point??null,agf:e?.agf1??null,odds:e?.odds??null,place:e?.place??null,candidate:candidates.has(r.number),rules:hits};
 }).sort((a,b)=>b.prob-a.prob);
 const network=meetingIndex.fieldNetwork(entries,date).filter(p=>p.meetings.length||p.commonOpponents)
  .sort((a,b)=>b.meetings.length-a.meetings.length||b.commonOpponents-a.commonOpponents).slice(0,12)
  .map(p=>({a:p.a,b:p.b,aName:p.aName,bName:p.bName,aheadA:p.aheadA,aheadB:p.aheadB,common:p.commonOpponents,indirect:p.indirect,
   last:p.meetings.slice(0,3).map(m=>({date:m.date,city:m.city,surface:SURFACES[m.surface]??m.surface,distance:m.distance,label:m.label,placeA:m.placeA,placeB:m.placeB}))}));
 return {id:race.id,city:race.city,number:race.number,time:race.time??null,label:race.label,surface:SURFACES[race.surface]??race.surface,distance:race.distance,
  bucket:distanceBucket(race.distance),breed:race.breed,age:race.age??null,model:set,surprise:risk==null?null:{risk:r3(risk),level:riskLevel(risk)},winners:race.winners??null,order:race.order??null,runners,network};
}

// Replay: each shown day is predicted from ratings built on earlier days only, then its results are applied.
const engine=createHorseRatingEngine(model.policy),connections=createConnectionStats(),pedigree=createSirePreference(runsByHorse,sireByHorse),byDay=new Map();let day=null,pending=[];
const flush=()=>{for(const x of pending){engine.update(x.race,x.entries);connections.update(x.race,x.entries);}pending=[];};
for(const x of finished){
 if(x.race.date!==day){flush();day=x.race.date;}
 if(shown.has(day)&&predicted(x)){
  const ratings=engine.predict(x.race,x.entries),rules=ruleSignals(x.race,x.entries,model.ruleWeights.discovery);
  (byDay.get(day)??byDay.set(day,[]).get(day)).push(raceRecord(x.race,x.entries,{ratings,rules,watched:rules,weights:discWeights,surpriseWeights:model.surprise?.weights,date:day}));
 }
 pending.push(x);
}
flush();

// Upcoming programme: the full archive state, production weights and only the rules confirmed in both backtest periods.
attachSpeedFigures(runsByHorse,breedByHorse,buildSpeedPars(runsByHorse,breedByHorse));
const live=new Map(),program=createLiderformClient({cache:path.join(dir,'cache'),today}),gallops=createGallopClient({cache:path.join(dir,'cache'),today});
for(const date of upcoming.filter(d=>d>range.to)){
 const index=await program(date),list=[];
 for(const loc of index.raceLocationsData||[]){
  const city=Object.keys(CITIES).find(k=>CITIES[k]===loc.track_code);if(!city)continue;
  const first=await program(date,city,1);if(first.notFound)continue;
  for(const n of first.raceTimeList.map(r=>r.race_number)){
   const t=normalizeRacePage(n===1?first:await program(date,city,n),{date,city,number:n});if(!t)continue;
   if(gallopPars)await attachGallops(t,date,city,n);
   for(const u of t.runs){const runs=runsByHorse.get(u.horseId)??runsByHorse.set(u.horseId,[]).get(u.horseId);if(!runs.some(y=>y.date===u.date))runs.push(u);}
   list.push(raceRecord(t.race,t.entries,{ratings:engine.predict(t.race,t.entries),rules:ruleSignals(t.race,t.entries,model.ruleWeights.production),
    watched:ruleSignals(t.race,t.entries,model.ruleWeights.discovery),weights:model.production,surpriseWeights:model.surprise?.production,date}));
  }
 }
 if(list.length)live.set(date,list);
}

// Live races take their runners' workouts from the race's gallop page; a missing page leaves the gallop features neutral.
async function attachGallops(t,date,city,n){
 const page=await gallops(date,city,n).catch(()=>null);if(!page?.runners)return;
 const byNo=new Map(page.runners.map(r=>[String(r.number),r]));
 for(const e of t.entries){const r=byNo.get(String(e.number));e.gallop=r?gallopProfile(r.workouts,t.race,t.race.breed,gallopPars):null;}
}

const hitStats=list=>{const s=list.filter(r=>r.winners);return {races:s.length,top1:s.filter(r=>r.winners.includes(r.runners[0]?.number)).length,top3:s.filter(r=>r.runners.slice(0,3).some(x=>r.winners.includes(x.number))).length};};
// Written beside the served folder and swapped in at the end, so the page never reads a half-written set.
const next=out+'.next';await rm(next,{recursive:true,force:true});await mkdir(next,{recursive:true});
const dayList=[];
for(const [d,list] of [...live].reverse()){await writeFile(path.join(next,`day-${d}.json`),JSON.stringify({date:d,kind:'live',races:list}));dayList.push({date:d,kind:'live',...hitStats(list),settled:hitStats(list).races,races:list.length});}
for(const d of [...byDay.keys()].reverse()){const list=byDay.get(d);await writeFile(path.join(next,`day-${d}.json`),JSON.stringify({date:d,kind:'settled',races:list}));dayList.push({date:d,kind:'settled',...hitStats(list),races:list.length});}
const conf=Object.fromEntries([...Object.entries(model.models).map(([k,m])=>[k,m.confirmation]),['closingOdds',model.references.closingOdds.confirmation],['uniform',model.references.uniform.confirmation]]);
const byBreed=Object.fromEntries([...Object.entries(model.models).map(([k,m])=>[k,m.byBreed]),['closingOdds',model.references.closingOdds.byBreed]]);
const rules=model.ruleWeights.table.filter(t=>t.discoveryPass).map(t=>({breed:t.breed,text:t.text,n:t.n,discovery:{diff:r3(t.discovery.diff),n:t.discovery.n},
 confirmation:{diff:r3(t.confirmation.diff),p:t.confirmation.p==null?null:+t.confirmation.p.toPrecision(2),n:t.confirmation.n},confirmed:t.confirmed})).sort((a,b)=>b.confirmed-a.confirmed||a.confirmation.diff-b.confirmation.diff);
await writeFile(path.join(next,'summary.json'),JSON.stringify({generatedAt:new Date().toISOString(),trainedAt:model.trainedAt,range,split:model.split,cities:CITIES,
 confirmation:conf,byBreed,rules,surprise:model.surprise?{odds:model.surprise.odds,candidates:model.surprise.candidates,risk:model.surprise.risk.confirmation,results:model.surprise.candidateResults,types:model.surprise.types}:null,days:dayList}));
await rm(out,{recursive:true,force:true});await rename(next,out);
console.log(JSON.stringify({days:dayList.map(d=>`${d.date}:${d.kind}:${d.races}${d.kind==='settled'?` top1 ${d.top1}`:''}`)}));
