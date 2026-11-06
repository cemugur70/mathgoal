// Replays the archive day by day and returns each predicted race's features as they stood before its day; used by the tree and odds steps.
import {createHorseRatingEngine} from '../dist/horse-rating.mjs';
import {raceFeatures} from '../dist/horse-model.mjs';
import {ruleSignals} from '../dist/horse-rules.mjs';
import {createConnectionStats} from '../dist/horse-connections.mjs';
import {createSirePreference} from '../dist/horse-pedigree.mjs';
import {CITIES} from './liderform-source.mjs';

export function replayRaces({model,races,runsByHorse,sireByHorse,ruleWeights,from=model.warmupUntil}){
 const engine=createHorseRatingEngine(model.policy),connections=createConnectionStats(),pedigree=createSirePreference(runsByHorse,sireByHorse),out=[];let day=null,pending=[];
 const flush=()=>{for(const x of pending){engine.update(x.race,x.entries);connections.update(x.race,x.entries);}pending=[];};
 for(const x of races.filter(x=>x.race.status==='RESULT'&&x.race.winners)){
  if(x.race.date!==day){flush();day=x.race.date;}
  if(x.race.city in CITIES&&x.race.date>=from){
   const rows=raceFeatures(x.race,x.entries,{ratings:engine.predict(x.race,x.entries),runsByHorse,rules:ruleSignals(x.race,x.entries,ruleWeights),connections,pedigree}).map(r=>{const e=x.entries.find(y=>y.number===r.number);return {number:r.number,x:Float64Array.from(r.x),odds:e?.odds??null,agf:e?.agf1??null,place:e?.place??null};});
   if(rows.length>1&&rows.some(r=>x.race.winners.includes(r.number)))out.push({date:x.race.date,city:x.race.city,number:x.race.number,time:x.race.time??null,breed:x.race.breed,winners:x.race.winners,rows});
  }
  pending.push(x);
 }
 return out;
}
