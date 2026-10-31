import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSimulation,runSimulation,validateSimulationLineups} from '../dist/player-simulation.mjs';
import {playerMetricEvidence} from '../dist/player-profile.mjs';
import {analyze} from '../dist/model.mjs';
import {forecastBundle} from './helpers.mjs';

function input(){
 const players=side=>Array.from({length:21},(_,i)=>({id:String(side*100+i),name:`P${side*100+i}`,position:i===0||i===11?0:i<5||i<15&&i>11?1:i<9||i<19&&i>=15?2:3,eligible:true,sourceGroup:i<11?'starters':'bench',strength:{attack:0,creation:0,defense:0,keeper:0},channelCoverage:{attack:1,creation:1,defense:1,keeper:1},substitution:{probability:1,typicalMinute:68,starts:5},selectionWeight:30,goalWeight:.2}));
 return {version:'player-simulation-v1',baseMeans:{home:1.5,away:1.5},teams:[1,2].map(side=>({id:String(side),name:`T${side}`,side:side===1?'home':'away',players:players(side),defaultLineup:players(side).slice(0,11).map(p=>p.id),baseline:{values:{attack:0,creation:0,defense:0,keeper:0},coverage:{attack:1,creation:1,defense:1,keeper:1}}})),policy:{maxSubstitutions:5,maxWindows:3,duration:90},coverage:{},limitations:[]};
}

test('canonical evidence accessor preserves alias ownership, actual exposure and missing facts',()=>{
 const p={metrics:{won_tackle:{key:'won_tackle',per90:2.5,games:3,minutesCovered:180,coverage:.6}}};
 assert.deepEqual(playerMetricEvidence(p,'tackles90'),{alias:'tackles90',key:'won_tackle',value:2.5,games:3,minutesCovered:180,coverage:.6});
 assert.equal(playerMetricEvidence(p,'xg90').value,null);
 assert.equal(playerMetricEvidence(p,'xg90').key,null);
});

test('compact preparation uses original team means and only source selectable roster without mutation',()=>{
 const b=forecastBundle(),result=analyze(b,{formCount:5}),before=JSON.stringify(result);
 const prepared=prepareSimulation(b,result,{playerScenarios:{'111':'out'}});
 assert.deepEqual(prepared.baseMeans,result.baselinePrediction.poissonMeans);
 assert.equal(prepared.teams[0].players.length,12);
 assert.equal(prepared.teams[0].players.find(p=>p.id==='111').eligible,false);
 assert.equal(prepared.teams[0].defaultLineup.includes('112'),true);
 assert.equal(prepared.teams[0].replacements[0].outId,'111');
 assert.equal(JSON.stringify(result),before);
 assert.ok(prepared.teams.flatMap(t=>t.players).every(p=>!p.matches&&!p.teamContribution),'worker input contains scalar evidence, no archived match graphs');
 assert.ok(prepared.teams.flatMap(t=>t.players).every(p=>Object.values(p.strength).every(v=>v===0)),'no league references gives neutral channels, not fabricated ranks');
});

test('unavailable players and older history-only identities need explicit in overrides',()=>{
 const b=forecastBundle();b.targetLineup.home.unavailable=[{id:111,name:'Out',reason:'injury'}];
 b.matches[0].players.push({...b.matches[0].players[1],id:9999});
 const a=analyze(b,{formCount:5});
 assert.equal(prepareSimulation(b,a).teams[0].players.find(p=>p.id==='111').eligible,false);
 assert.equal(prepareSimulation(b,a,{playerScenarios:{'111':'in'}}).teams[0].players.find(p=>p.id==='111').eligible,true);
 assert.equal(prepareSimulation(b,a).teams[0].players.find(p=>p.id==='9999').eligible,false);
 assert.equal(prepareSimulation(b,a,{playerScenarios:{'9999':'in'}}).teams[0].players.find(p=>p.id==='9999').eligible,true);
});

test('lineup validation rejects unknown, duplicate, unavailable, missing and goalkeeper-invalid selections',()=>{
 const i=input(),valid=validateSimulationLineups(i);
 assert.equal(valid['1'].length,11);
 for(const modify of [ids=>ids.slice(0,10),ids=>ids.map((v,n)=>n===1?ids[0]:v),ids=>ids.map((v,n)=>n===1?'foreign':v),ids=>ids.map((v,n)=>n===0?'111':v),ids=>ids.map((v,n)=>n===1?'111':v)]){
  const lineups={'1':modify([...i.teams[0].defaultLineup])};
  // replacing the only keeper with the bench keeper is valid; test a striker instead.
  if(lineups['1'][0]==='111')lineups['1'][0]='120';
  assert.throws(()=>runSimulation(i,{iterations:1,lineups}));
 }
 i.teams[0].players[1].eligible=false;
 assert.throws(()=>runSimulation(i,{iterations:1}),/uygun|kadro/i);
 assert.throws(()=>runSimulation(input(),{iterations:100001}),/tekrar/i);
 assert.throws(()=>runSimulation(input(),{iterations:0}),/tekrar/i);
 assert.throws(()=>runSimulation(input(),{seed:-1}),/tohum/i);
});

test('seeded repetitions preserve complete histogram mass and symmetric probabilities',()=>{
 const i=input(),before=JSON.stringify(i),a=runSimulation(i,{seed:123,iterations:10000}),b=runSimulation(i,{seed:123,iterations:10000});
 assert.deepEqual(a,b);
 assert.equal(JSON.stringify(i),before);
 assert.equal(a.histogram.reduce((s,r)=>s+r.count,0),10000);
 assert.ok(Math.abs(a.probabilities.home+a.probabilities.draw+a.probabilities.away-1)<1e-12);
 assert.ok(Math.abs(a.probabilities.under25+a.probabilities.over25-1)<1e-12);
 assert.ok(Math.abs(a.means.home-1.5)<.06);
 assert.ok(Math.abs(a.means.away-1.5)<.06);
 assert.ok(Math.abs(a.probabilities.home-a.probabilities.away)<.025);
 assert.deepEqual(a.topScores,[...a.histogram].sort((x,y)=>y.count-x.count||x.home-y.home||x.away-y.away).slice(0,10));
 assert.ok(a.sample.events.every((e,n,es)=>!n||es[n-1].minute<=e.minute));
});

test('substitution sample preserves eleven, one keeper, same roles, max five in three windows and no re-entry',()=>{
 const i=input(),r=runSimulation(i,{iterations:30,seed:9}),on=Object.fromEntries(i.teams.map(t=>[t.id,new Set(t.defaultLineup)])),exited=new Set();
 for(const team of i.teams){
  const subs=r.sample.events.filter(e=>e.type==='substitution'&&e.teamId===team.id);
  assert.equal(subs.length,5);
  assert.ok(new Set(subs.map(s=>s.minute)).size<=3);
  assert.equal(Object.values(r.sample.minutes[team.id]).reduce((s,n)=>s+n,0),990);
 }
 for(const e of r.sample.events){
  const team=i.teams.find(t=>t.id===e.teamId),byId=new Map(team.players.map(p=>[p.id,p]));
  if(e.type==='substitution'){
   assert.ok(on[team.id].has(e.outId));assert.ok(!on[team.id].has(e.inId));assert.ok(!exited.has(e.inId));
   assert.equal(byId.get(e.inId).position,byId.get(e.outId).position);assert.notEqual(byId.get(e.outId).position,0);
   on[team.id].delete(e.outId);on[team.id].add(e.inId);exited.add(e.outId);
   assert.equal(on[team.id].size,11);assert.equal([...on[team.id]].filter(id=>byId.get(id).position===0).length,1);
  }else if(e.playerId!==null)assert.ok(on[team.id].has(e.playerId),'scorer is on pitch');
 }
 for(const team of i.teams)assert.ok(Math.abs(r.usage.filter(u=>u.teamId===team.id).reduce((s,u)=>s+u.averageMinutes,0)-990)<1e-9);
});

test('bench is optional, no replacement is forced and demoted starters become eligible substitutes',()=>{
 const i=input();i.teams.forEach(t=>t.players=t.players.slice(0,11));
 const r=runSimulation(i,{iterations:3});assert.equal(r.sample.events.filter(e=>e.type==='substitution').length,0);
 const j=input(),lineups={'1':j.teams[0].defaultLineup.map(id=>id==='110'?'120':id)};
 const swapped=runSimulation(j,{iterations:30,lineups});
 assert.equal(swapped.usage.find(u=>u.teamId==='1'&&u.playerId==='120').starts,30);
 assert.ok(swapped.usage.find(u=>u.teamId==='1'&&u.playerId==='110').appearances>0);
});

test('missing channels do not amplify other metrics and selected improvements move only relevant matchup direction',()=>{
 const i=input();i.teams.forEach(t=>t.players=t.players.slice(0,11));
 const neutral=runSimulation(i,{iterations:10000,seed:33});
 i.teams[0].players.filter(p=>p.position===3).forEach(p=>p.strength.attack=1);
 const better=runSimulation(i,{iterations:10000,seed:33});
 assert.ok(better.means.home>neutral.means.home+.05);
 assert.equal(better.comparisons[0].delta.attack>0,true);
 i.teams[0].baseline.coverage.attack=0;
 assert.equal(runSimulation(i,{iterations:1}).comparisons[0].delta.attack,0);
});

test('goal count histogram is not truncated at legacy score-grid eight',()=>{
 const i=input();i.baseMeans={home:12,away:12};
 const r=runSimulation(i,{iterations:200,seed:5});
 assert.ok(r.histogram.some(s=>s.home>8||s.away>8));
 assert.equal(r.histogram.reduce((n,s)=>n+s.count,0),200);
});

function preparationFixture(){
 const metric=(key,per90,extra={})=>({key,per90,games:3,minutesCovered:180,coverage:.5,...extra});
 const profile=(id,xg,minutes,teamMinutes)=>({id:String(id),playerId:String(id),name:`P${id}`,position:3,
  games:10,minutes,xg90:999,metrics:{expected_goals:metric('expected_goals',xg)},matches:[],
  teamContribution:{minutes:teamMinutes}});
 const references=[.1,.2,.3,.4,.8].map((xg,n)=>({playerId:`ref${n}`,position:3,games:3,minutes:270,
  metrics:{expected_goals:metric('expected_goals',xg),goals:metric('goals',.1),total_shots:metric('total_shots',2)}}));
 // Neither insufficient appearances nor another position may move a forward's median.
 references.push({...references[0],playerId:'too-few-games',games:2,
  metrics:{expected_goals:metric('expected_goals',100)}});
 for(let n=0;n<5;n++)references.push({...references[0],playerId:`def${n}`,position:1,
  metrics:{expected_goals:metric('expected_goals',100)}});
 const profiles=[profile(111,.7,900,90),profile(112,.1,450,270)];
 const bundle=forecastBundle();bundle.matches=[];
 const raw=(id,teamId,position,stats,minutes=60,starter=true)=>({id,teamId,position,name:`P${id}`,minutes,starter,stats});
 const match=(id,day,teamId,players,leagueId=71)=>({id:String(id),date:`2026-10-${String(day).padStart(2,'0')}T12:00:00Z`,home:{id:teamId,name:`T${teamId}`},away:{id:teamId+1000,name:'Opponent'},homeScore:1,awayScore:0,finished:true,leagueId,players});
 for(let d=1;d<=6;d++)bundle.matches.push(match(`scope${d}`,d,1,[
  raw(111,1,3,d<=3?{expected_goals:.7*60/90}:{}),raw(112,1,3,d<=3?{expected_goals:.1*60/90}: {},60,false)]));
 for(let n=0;n<5;n++)for(let d=1;d<=3;d++){
  bundle.matches.push(match(`ref${n}-${d}`,d,40+n,[raw(600+n,40+n,3,{expected_goals:[.1,.2,.3,.4,.8][n]*60/90,goals:.1*60/90,total_shots:2*60/90})]));
  bundle.matches.push(match(`def${n}-${d}`,d,50+n,[raw(700+n,50+n,1,{expected_goals:100*60/90})]));
 }
 for(let d=1;d<=2;d++)bundle.matches.push(match(`few${d}`,d,80,[raw(800,80,3,{expected_goals:100*60/90})]));
 bundle.leagueCoverage={leagueId:71,season:'2026/2027',cutoff:bundle.analysisAt,expectedMatchIds:bundle.matches.map(m=>m.id)};
 const analysis={baselinePrediction:{poissonMeans:{home:1.5,away:1}},
  playerAnalysis:{formCount:10,teams:{'1':{players:profiles}},
   leagueRatings:{profiles:references,coverage:{status:'complete'}}}};
 return {bundle,analysis,metric,profiles,references};
}

test('preparation uses same-position league median, canonical exposure and fixed missing-metric weights',()=>{
 const f=preparationFixture(),get=()=>prepareSimulation(f.bundle,f.analysis).teams[0].players.find(p=>p.id==='111');
 let p=get(),xg=p.evidence.find(e=>e.alias==='xg90');
 assert.equal(xg.referenceCount,7);
 assert.ok(Math.abs(xg.referenceMedian-.3)<1e-12);
 assert.equal(xg.key,'expected_goals');
 assert.ok(Math.abs(xg.value-.7)<1e-12,'same-league records win over the stale xg90 display alias');
 assert.equal(xg.minutesCovered,180);
 assert.equal(xg.coverage,.5);
 assert.equal(xg.reliability,.25,'180/(180+180) × min(1,3/3) × half of selected matches');
 assert.ok(Math.abs(p.strength.attack-.12)<1e-12,'.60 × .8 relative value × .25 reliability; missing goals/shots stay neutral');
 assert.equal(p.channelCoverage.attack,.3);

 // Missing xG must not inflate the remaining .25 + .15 channel weights to one.
 for(const m of f.bundle.matches)for(const p of m.players)if(p.id===111)p.stats={goals:.5*60/90,total_shots:3*60/90};
 p=get();
 assert.equal(p.evidence.find(e=>e.alias==='xg90').reason,'missing-metric');
 assert.ok(Math.abs(p.strength.attack-.20)<1e-12,'.25 × 1 × 2/3 plus .15 × 1/3 × 2/3, without renormalization');
 assert.equal(p.channelCoverage.attack,.4);

 // Four eligible forwards remain insufficient despite the extra low-sample forward
 // and five valid defenders in the same league.
 f.bundle.matches=f.bundle.matches.filter(m=>!m.players.some(p=>p.id===603||p.id===604));
 p=get();
 assert.ok(p.evidence.filter(e=>e.channel==='attack').every(e=>e.referenceCount===4));
 assert.equal(p.strength.attack,0);
 assert.equal(p.channelCoverage.attack,0);
 assert.equal(p.evidence.find(e=>e.alias==='goals90').reason,'insufficient-reference');
});

test('preparation baseline weights same-league strengths by same-league team minutes, preserving personal display facts',()=>{
 const f=preparationFixture(),prepared=prepareSimulation(f.bundle,f.analysis),home=prepared.teams[0];
 const high=home.players.find(p=>p.id==='111'),low=home.players.find(p=>p.id==='112');
 assert.ok(Math.abs(high.strength.attack-.12)<1e-12);
 assert.ok(Math.abs(low.strength.attack-(-.06))<1e-12);
 assert.ok(Math.abs(home.baseline.values.attack-.03)<1e-12,
  '(.12 × 360 league team minutes − .06 × 360 league team minutes) / 720, not personal 900/450-minute or supplied stale contribution weights');
 assert.equal(high.games,10);assert.equal(high.minutes,900);
 assert.equal(high.teamGames,6);assert.equal(high.teamMinutes,360);
 assert.equal(high.strengthScope.games,6);assert.equal(high.strengthScope.minutes,360);
 assert.equal(home.baseline.coverage.attack,.3);
 assert.equal(f.profiles[0].teamContribution.minutes,90,'source contribution is preserved');
 assert.equal(f.profiles[1].teamContribution.minutes,270);
});

test('cup appearances, personal display metrics, and future evidence cannot move league comparison strengths or baselines',()=>{
 const f=preparationFixture(),before=prepareSimulation(f.bundle,f.analysis);
 const cup={...structuredClone(f.bundle.matches[0]),id:'cup',leagueId:99,date:'2026-10-30T12:00:00Z'};
 cup.players=cup.players.map(p=>({...p,minutes:90,stats:{expected_goals:100,goals:100,goals_prevented:100}}));
 const future={...structuredClone(cup),id:'future-league',leagueId:71,date:'2026-11-02T12:00:00Z'};
 f.bundle.matches.push(cup,future);
 // The all-competition personal UI and bench-participation window may differ;
 // neither unscoped totals nor cup strength enter same-league comparisons.
 f.profiles[0].metrics.expected_goals.per90=100;
 const after=prepareSimulation(f.bundle,f.analysis),a=before.teams[0],b=after.teams[0];
 assert.deepEqual(a.baseline,b.baseline);
 for(const p of a.players){const q=b.players.find(q=>q.id===p.id);assert.deepEqual(p.strength,q.strength);assert.deepEqual(p.strengthScope,q.strengthScope);assert.equal(p.goalWeight,q.goalWeight);}
 assert.equal(b.players.find(p=>p.id==='111').teamGames,7);
 assert.equal(b.players.find(p=>p.id==='111').strengthScope.teamGames,6);
 assert.equal(after.coverage.strengthScope.leagueId,71);
 assert.equal(after.coverage.strengthScope.status,'complete');
 const missing={...f.bundle.matches[0],id:'missing-stats',players:[]};
 f.bundle.matches.push(missing);f.bundle.leagueCoverage.expectedMatchIds.push(missing.id);
 const partial=prepareSimulation(f.bundle,f.analysis);
 assert.equal(partial.coverage.strengthScope.status,'partial');
 assert.ok(partial.coverage.strengthScope.missingPlayerStatsMatchIds.includes('missing-stats'));
});

test('bench entry rewards team-window substitute participation; replacement starters use a separate weight',()=>{
 const f=preparationFixture();
 for(const m of f.bundle.matches)for(const p of m.players)if(p.id===112)p.minutes=10;
 const prepared=prepareSimulation(f.bundle,f.analysis),home=prepared.teams[0],regularStarter=home.players.find(p=>p.id==='111'),regularSub=home.players.find(p=>p.id==='112');
 assert.equal(regularStarter.teamGames,6);assert.equal(regularStarter.teamStarts,6);
 assert.equal(regularSub.teamGames,6);assert.equal(regularSub.teamSubAppearances,6);
 assert.equal(regularSub.teamMinutes,60);assert.equal(regularSub.minutes,450,'personal UI history stays separate');
 assert.ok(regularSub.benchEntryWeight>regularStarter.benchEntryWeight);
 assert.ok(regularStarter.starterSelectionWeight>regularSub.starterSelectionWeight);
 assert.equal(regularSub.selectionWeight,regularSub.benchEntryWeight);
});

test('substitution window prior spreads exits with a hard three-per-window cap and history moves window probabilities',()=>{
 const i=input(),counts=[0,0,0];
 for(let seed=1;seed<=120;seed++){
  const r=runSimulation(i,{iterations:1,seed});
  for(const team of i.teams){
   const subs=r.sample.events.filter(e=>e.type==='substitution'&&e.teamId===team.id),windows=[0,0,0];
   for(const e of subs){windows[e.window]++;counts[e.window]++;}
   assert.ok(windows.every(n=>n<=3));assert.ok(windows.filter(Boolean).length>=2);
  }
 }
 const total=counts.reduce((a,b)=>a+b,0);
 assert.ok(counts.every(n=>n/total>.15),'substitutions do not collapse into the middle window');
 assert.ok(counts[1]>counts[0]&&counts[1]>counts[2],'middle window retains the stated larger prior');
 const f=preparationFixture(),p=prepareSimulation(f.bundle,f.analysis).teams[0].players.find(p=>p.id==='111');
 assert.deepEqual(p.substitution.exitWindows,[6,0,0]);
 assert.ok(p.substitution.windowProbabilities[0]>.25,'observed early exits shift the prior');
 assert.ok(Math.abs(p.substitution.windowProbabilities.reduce((a,b)=>a+b,0)-1)<1e-12);
});

test('formation validation requires at least three defenders, two midfielders and one forward',()=>{
 for(const position of [1,2,3]){
  const i=input();i.teams[0].players.forEach(p=>{if(p.position!==0)p.position=position;});
  assert.throws(()=>validateSimulationLineups(i),/diziliş|defans|orta saha|forvet/i);
 }
 const balanced=input();assert.equal(validateSimulationLineups(balanced)['1'].length,11);
});

test('continuous goal timestamps preserve on-pitch chronology through one-minute and same-display-minute boundaries',()=>{
 const i=input();i.baseMeans={home:25,away:25};let sameDisplayBoundary=false,oneMinutePhase=false;
 for(let seed=1;seed<=60;seed++){
  const r=runSimulation(i,{iterations:1,seed}),on=Object.fromEntries(i.teams.map(t=>[t.id,new Set(t.defaultLineup)]));
  const boundaries=[...new Set(r.sample.events.filter(e=>e.type==='substitution').map(e=>e.time))].sort((a,b)=>a-b);
  let previous=-1;
  for(const e of r.sample.events){
   assert.ok(e.time>=previous);previous=e.time;assert.equal(e.minute,Math.ceil(e.time));
   if(e.type==='substitution'){
    assert.equal(e.time,e.minute);assert.ok(on[e.teamId].has(e.outId));assert.ok(!on[e.teamId].has(e.inId));
    on[e.teamId].delete(e.outId);on[e.teamId].add(e.inId);
   }else{
    assert.ok(e.time>0&&e.time<90);assert.ok(on[e.teamId].has(e.playerId));
    assert.ok(!boundaries.includes(e.time),'phase goals never lie exactly on substitution boundaries');
    if(boundaries.some(time=>Math.ceil(e.time)===time&&e.time<time))sameDisplayBoundary=true;
    if(boundaries.some((b,n)=>n&&b-boundaries[n-1]===1&&e.time>boundaries[n-1]&&e.time<b))oneMinutePhase=true;
   }
  }
 }
 assert.ok(sameDisplayBoundary);assert.ok(oneMinutePhase,'the regression exercised goals inside a one-minute phase');
});

test('scorer weights blend xG/goals, shrink small samples to position priors, preserve missing evidence and allow observed-zero scorers',()=>{
 const f=preparationFixture();
 for(const m of f.bundle.matches)if(m.id.startsWith('scope'))m.players=m.players.filter(p=>p.id!==111);
 f.bundle.matches[0].players.push({id:111,teamId:1,name:'Short cameo',position:3,starter:false,minutes:10,
  stats:{expected_goals:5*10/90,goals:1*10/90}});
 let p=prepareSimulation(f.bundle,f.analysis).teams[0].players.find(p=>p.id==='111');
 assert.ok(Math.abs(p.goalEvidence.rawRate-3.8)<1e-12);
 assert.ok(Math.abs(p.goalEvidence.reliability-10/280)<1e-12);
 assert.ok(p.goalWeight<p.goalEvidence.rawRate/3,'small-sample scorer rates are heavily shrunk');
 assert.equal(p.goalEvidence.priorSource,'same-league-position-median');
 const raw=f.bundle.matches[0].players.find(p=>p.id===111);raw.stats={expected_goals:0,goals:0};
 p=prepareSimulation(f.bundle,f.analysis).teams[0].players.find(p=>p.id==='111');
 assert.equal(p.goalEvidence.rawRate,0);assert.ok(p.goalWeight>=.02);
 raw.stats={};p=prepareSimulation(f.bundle,f.analysis).teams[0].players.find(p=>p.id==='111');
 assert.equal(p.goalWeight,null);assert.equal(p.goalEvidence.xg.value,null);assert.equal(p.goalEvidence.goals.value,null);
 assert.equal(p.goalEvidence.reason,'missing-scoring-metrics');
});
