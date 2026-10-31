import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulationSessions,defaultSimulationSeed} from '../dist/simulation-session.mjs';
import {runSimulation} from '../dist/player-simulation.mjs';

function input(){
 const teams=[1,2].map(side=>{
  const players=Array.from({length:12},(_,i)=>({id:String(side*100+i),name:`P${side}-${i}`,position:i===0?0:i<5||i===11?1:i<9?2:3,eligible:true,
   strength:{attack:0,creation:0,defense:0,keeper:0},channelCoverage:{attack:1,creation:1,defense:1,keeper:1},substitution:{probability:.5},selectionWeight:1,goalWeight:.2}));
  return {id:String(side),name:`T${side}`,side:side===1?'home':'away',players,defaultLineup:players.slice(0,11).map(p=>p.id),baseline:{values:{attack:0,creation:0,defense:0,keeper:0},coverage:{attack:1,creation:1,defense:1,keeper:1}}};
 });
 return {matchId:'5749720',formCount:10,baseMeans:{home:1.6,away:1.1},teams,policy:{maxSubstitutions:5,maxWindows:3,duration:90},coverage:{},limitations:[]};
}

test('A to B to A model switches retain seed and custom XI and reproduce the complete simulation',()=>{
 const a=input(),sessions=createSimulationSessions(),first=sessions.restore(a);
 assert.equal(first.seed,defaultSimulationSeed(a));
 first.lineups['1'][1]='111';sessions.saveLineups(a,first.lineups);sessions.saveSeed(a,12345);
 const before=runSimulation(a,{...sessions.restore(a),iterations:10000});
 const b={...a,model:'other',baseMeans:{home:.8,away:2.2}};
 assert.equal(sessions.restore(b).seed,12345);
 assert.deepEqual(sessions.restore(b).lineups,sessions.restore(a).lineups);
 runSimulation(b,{...sessions.restore(b),iterations:100});
 const after=runSimulation(structuredClone(a),{...sessions.restore(structuredClone(a)),iterations:10000});
 assert.deepEqual(after,before,'histogram, sample score, events and substitutions all repeat');
 first.lineups['1'][1]='bad';assert.equal(sessions.restore(a).lineups['1'][1],'111','saved state does not alias the rendered roster');
});

test('default seed survives fresh sessions and unrelated fixtures while explicit seeds remain scoped',()=>{
 const a=input(),sessions=createSimulationSessions();sessions.saveSeed(a,0);
 assert.equal(sessions.restore(a).seed,0);
 const other={...a,matchId:'5749726'};assert.equal(sessions.restore(other).seed,defaultSimulationSeed(other));
 assert.equal(sessions.restore(a).seed,0);
 assert.equal(createSimulationSessions().restore(a).seed,createSimulationSessions().restore(a).seed);
 for(const seed of [-1,NaN,4294967296,1.2])assert.equal(sessions.saveSeed(a,seed),false);
 assert.equal(sessions.restore(a).seed,0);
});

test('updated availability rejects a retained XI, preserves its seed, and reset uses the current defaults',()=>{
 const a=input(),sessions=createSimulationSessions(),state=sessions.restore(a);
 state.lineups['1'][1]='111';sessions.saveLineups(a,state.lineups);sessions.saveSeed(a,99);
 const updated=structuredClone(a);updated.teams[0].players[11].eligible=false;
 const restored=sessions.restore(updated);assert.equal(restored.reset,true);assert.equal(restored.seed,99);
 assert.deepEqual(restored.lineups['1'],updated.teams[0].defaultLineup);
 sessions.saveLineups(a,state.lineups);sessions.resetLineups(a);
 assert.deepEqual(sessions.restore(a).lineups['1'],a.teams[0].defaultLineup);
});
