import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {analyze} from '../dist/model.mjs';
import {prepareSimulation,runSimulation} from '../dist/player-simulation.mjs';
const matchId=process.argv[2]??'5868108';
const bundle=JSON.parse(await readFile(new URL(`../dist/data/matches/${matchId}.json`,import.meta.url),'utf8'));
const analysis=analyze(bundle,{formCount:10}),input=prepareSimulation(bundle,analysis);
const result=runSimulation(input,{iterations:10000,seed:12345});
assert.deepEqual(result,runSimulation(input,{iterations:10000,seed:12345}),'reproducible seed');
assert.equal(result.histogram.reduce((sum,row)=>sum+row.count,0),10000);
assert.ok(Math.abs(result.probabilities.home+result.probabilities.draw+result.probabilities.away-1)<1e-12);
function checkSample(sample){
 const onPitch=new Map(input.teams.map(t=>[t.id,new Set(sample.lineups[t.id])]));
 for(const event of sample.events){
  const active=onPitch.get(event.teamId);
  if(event.type==='goal'){if(event.playerId!==null)assert.ok(active.has(event.playerId),'scorer still on pitch');}
  else {assert.ok(active.delete(event.outId));assert.ok(!active.has(event.inId));active.add(event.inId);}
 }
 for(const team of input.teams){
  const subs=sample.events.filter(e=>e.type==='substitution'&&e.teamId===team.id),windows=new Map();
  assert.ok(subs.length<=5);
  for(const s of subs)windows.set(s.minute,(windows.get(s.minute)??0)+1);
  assert.ok(windows.size<=3);assert.ok([...windows.values()].every(n=>n<=3));
  assert.equal(Object.values(sample.minutes[team.id]).reduce((s,n)=>s+n,0),990);
 }
}
checkSample(result.sample);
const windows=new Map();
for(let seed=0;seed<100;seed++){
 const sample=runSimulation(input,{iterations:1,seed}).sample;checkSample(sample);
 for(const event of sample.events.filter(e=>e.type==='substitution')){
  const window=event.minute<62?'early':event.minute<75?'middle':'late';
  windows.set(window,(windows.get(window)??0)+1);
 }
}
assert.equal(windows.size,3,'all three substitution windows have actual use');
let baseline;
if(matchId==='5868108'){
 baseline=JSON.parse(await readFile(new URL('../data/simulation-audit-before.json',import.meta.url),'utf8'));
 assert.deepEqual(analysis.prediction,baseline.overview,'main forecast unchanged');
 const keepers=input.teams[0].players.filter(p=>p.position===0&&p.strengthScope.teamMinutes>0);
 const keeperMinutes=keepers.reduce((sum,p)=>sum+p.strengthScope.teamMinutes,0);
 const leagueKeeperBaseline=keepers.reduce((sum,p)=>sum+p.strength.keeper*p.strengthScope.teamMinutes,0)/keeperMinutes;
 assert.ok(Math.abs(result.comparisons[0].historical.keeper-leagueKeeperBaseline)<1e-12,'goalkeeper baseline weights only actual league minutes');
 assert.ok(Math.abs(result.comparisons[0].delta.keeper)<.1,'cup-driven penalty removed; actual league backup contribution retained');
}
const summary={matchId,version:input.version,seed:12345,iterations:10000,base:input.baseMeans,
 means:result.means,probabilities:result.probabilities,comparisons:result.comparisons,coverage:input.coverage,
 teams:input.teams.map(t=>({id:t.id,name:t.name,strengthScope:t.strengthScope,coverage:t.coverage,
  players:t.players.map(p=>({id:p.id,name:p.name,position:p.position,games:p.games,minutes:p.minutes,
   teamGames:p.teamGames,teamMinutes:p.teamMinutes,teamSubAppearances:p.teamSubAppearances,
   strengthScope:p.strengthScope,benchEntryWeight:p.benchEntryWeight,goalWeight:p.goalWeight}))})),
 sample:result.sample,windowCountsAcross100Seeds:Object.fromEntries(windows),
 before:baseline?{means:baseline.means,probabilities:baseline.probabilities,comparisons:baseline.comparisons}:null};
await writeFile(new URL(`../data/simulation-audit-after-${matchId}.json`,import.meta.url),JSON.stringify(summary,null,2));
console.log(JSON.stringify({matchId,means:summary.means,probabilities:summary.probabilities,
 keeperDelta:summary.comparisons.map(t=>({team:t.name,delta:t.delta.keeper})),windows:summary.windowCountsAcross100Seeds,checks:'passed'}));
