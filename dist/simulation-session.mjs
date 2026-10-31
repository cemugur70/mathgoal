import {validateSimulationLineups} from './player-simulation.mjs';

const keyFor=input=>JSON.stringify([input.matchId,input.formCount,input.teams.map(t=>String(t.id))]);
export function defaultSimulationSeed(input){
 let hash=2166136261;
 for(const c of 'mathgoal-simulation-v1:'+keyFor(input))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 return hash;
}
export const validSimulationSeed=value=>Number.isInteger(value)&&value>=0&&value<=0xffffffff;

// Model choice is intentionally absent: switching A → B → A keeps the scenario.
export function createSimulationSessions(){
 const sessions=new Map();
 const get=input=>{
  const key=keyFor(input);
  if(!sessions.has(key)){
   if(sessions.size>=20)sessions.delete(sessions.keys().next().value);
   sessions.set(key,{seed:defaultSimulationSeed(input),lineups:null});
  }
  return sessions.get(key);
 };
 return {
  restore(input){
   const session=get(input);let lineups=null,reset=false;
   if(session.lineups)try{lineups=validateSimulationLineups(input,session.lineups);}catch{session.lineups=null;reset=true;}
   return {seed:session.seed,lineups:lineups??Object.fromEntries(input.teams.map(t=>[t.id,[...t.defaultLineup]])),reset};
  },
  saveSeed(input,seed){if(!validSimulationSeed(seed))return false;get(input).seed=seed;return true;},
  saveLineups(input,lineups){get(input).lineups=structuredClone(lineups);},
  resetLineups(input){get(input).lineups=null;}
 };
}
