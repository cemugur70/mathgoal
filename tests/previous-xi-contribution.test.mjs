import test from 'node:test';import assert from 'node:assert/strict';
import {forecastBundle} from './helpers.mjs';import {createStarterFeatureIndex} from '../dist/starter-features.mjs';
import {playerContributionReport,optimizeAbsenceReplacements,lineupMeans} from '../dist/player-contribution.mjs';
import {analyze} from '../dist/model.mjs';import {prepareSimulation,validateSimulationLineups,runSimulation} from '../dist/player-simulation.mjs';

test('verified official XI may have wingbacks classified as midfielders without rewriting model positions',()=>{
 const b=forecastBundle();
 for(const m of b.matches)for(const p of m.players)if([102,103].includes(p.id))p.position=2;
 const input=prepareSimulation(b,analyze(b,{trainingLayer:false})),team=input.teams[0];
 assert.equal(team.officialLineup.matchId,'15');
 assert.equal(team.players.find(p=>p.id==='102').position,2,'usual role stays unchanged');
 assert.equal(team.officialLineup.starters.filter(p=>p.position===1).length,2);
 assert.doesNotThrow(()=>validateSimulationLineups(input));
 assert.equal(runSimulation(input,{iterations:100,seed:12345}).iterations,100);
 const noProof=structuredClone(input);noProof.teams[0].officialLineup=null;
 assert.throws(()=>validateSimulationLineups(noProof),/makul diziliş/);
 for(const mutate of [r=>r.matchId=input.matchId,r=>r.date=input.cutoff,r=>r.availableAt=input.cutoff,r=>r.starters[1].id=r.starters[0].id]){
  const invalid=structuredClone(input);mutate(invalid.teams[0].officialLineup);
  assert.throws(()=>validateSimulationLineups(invalid),/makul diziliş/,'unverified/target/future/incomplete reference cannot waive limits');
 }
 const lineup=Object.fromEntries(input.teams.map(t=>[t.id,[...t.defaultLineup]]));
 lineup[team.id][lineup[team.id].indexOf('104')]='112';
 assert.throws(()=>validateSimulationLineups(input,lineup),/makul diziliş/,'arbitrary role changes still require manual formation limits');
 const unavailable=structuredClone(input);unavailable.teams[0].players.find(p=>p.id==='102').eligible=false;
 assert.throws(()=>validateSimulationLineups(unavailable),/uygun/);
});

test('missing XI position uses a prior official roster even with unknown minutes, never target or future roles',()=>{
 const b=forecastBundle();
 for(const m of b.matches)for(const p of m.players)if(p.id===102)p.position=null;
 const old=structuredClone(b.matches.find(m=>m.id==='11'));old.id='older-role';old.date='2026-09-01T12:00:00Z';
 const player=old.players.find(p=>p.id===102);player.position=1;player.minutes=null;player.stats.minutes_played=null;player.starter=false;
 b.matches.push(old);
 const future=structuredClone(old);future.id='future-role';future.date='2026-11-02T12:00:00Z';future.players.find(p=>p.id===102).position=3;
 const target=structuredClone(old);Object.assign(target,{id:b.target.id,date:b.target.date});target.players.find(p=>p.id===102).position=3;
 const features=createStarterFeatureIndex([...b.matches,target,future]).features(b.target),p=features.teams.home.profiles.find(p=>p.id==='102');
 assert.equal(p.position,1);assert.equal(p.positionEvidence.matchId,'older-role');assert.equal(p.positionEvidence.source,'prior-official-match-roster');
 assert.equal(p.games,5);assert.equal(p.minutes,450,'unknown minutes prove only role, never extra exposure');
 assert.ok(features.evidence.matchIds.includes('older-role'));assert.ok(!features.evidence.matchIds.includes('future-role'));assert.ok(!features.evidence.matchIds.includes(b.target.id));
 const prepared=prepareSimulation(b,analyze(b,{formCount:5,trainingLayer:false}));
 assert.equal(prepared.teams[0].players.find(p=>p.id==='102').position,1);assert.doesNotThrow(()=>validateSimulationLineups(prepared));
 const withoutRole=structuredClone(b);withoutRole.matches=withoutRole.matches.filter(m=>m.id!=='older-role');
 const unknown=createStarterFeatureIndex(withoutRole.matches).features(withoutRole.target).teams.home.profiles.find(p=>p.id==='102');
 assert.equal(unknown.position,null);assert.equal(unknown.positionEvidence,null,'no source means no invented position');
 const invalid=prepareSimulation(withoutRole,analyze(withoutRole,{formCount:5,trainingLayer:false}));
 assert.throws(()=>validateSimulationLineups(invalid),/Player 102/,'actionable error identifies the unresolved player');
});
test('previous official XI includes cup fixtures and never takes the target first XI or an invented minutes XI',()=>{
 const b=forecastBundle(),cup=structuredClone(b.matches.find(m=>m.id==='15'));cup.id='cup';cup.date='2026-10-30T12:00:00Z';cup.leagueId=99;
 cup.players.find(p=>p.id===111).id=777;cup.players.find(p=>p.id===777).name='Cup starter';b.matches.push(cup);
 b.targetLineup.home.starters[10]={id:888,name:'Target actual XI',position:3};
 const c=createStarterFeatureIndex(b.matches).features(b.target,{lineup:b.targetLineup});assert.equal(c.teams.home.sourceMatchId,'cup');
 assert.ok(c.teams.home.profiles.some(p=>p.id==='777'));assert.ok(!c.teams.home.profiles.some(p=>p.id==='888'));
 cup.players=cup.players.filter(p=>p.id!==777);const partial=createStarterFeatureIndex(b.matches).features(b.target);
 assert.equal(partial.teams.home.type,'previousXI-incomplete');assert.equal(partial.teams.home.profiles.length,10);
});
test('only verified pre-cutoff absences apply automatically; manual scenarios are explicit and zero-minute evidence stays missing',()=>{
 const b=forecastBundle(),idx=createStarterFeatureIndex(b.matches);b.targetLineup.home.unavailable=[{id:111,name:'Player 111',reason:'injury'}];
 const c=idx.features(b.target,{lineup:b.targetLineup});assert.ok(!c.teams.home.profiles.some(p=>p.id==='111'));assert.ok(c.teams.home.profiles.some(p=>p.id==='112'));
 assert.equal(c.teams.home.replacements[0].source,'pre-match-source');
 const late={...b.targetLineup,observedAt:'2026-11-01T19:00:00Z'},past=idx.features({...b.target,finished:true},{lineup:late});
 assert.ok(past.teams.home.profiles.some(p=>p.id==='111'));assert.equal(past.teams.home.ignoredSourceAbsences,true);
 const scenario=idx.features({...b.target,finished:true},{lineup:late,playerScenarios:{111:'out'}});assert.ok(scenario.teams.home.profiles.some(p=>p.id==='112'));
 assert.equal(scenario.teams.home.replacements[0].source,'user-scenario');
 const override=idx.features(b.target,{lineup:b.targetLineup,playerScenarios:{111:'in'}});assert.ok(override.teams.home.profiles.some(p=>p.id==='111'));
});
test('counterfactual contribution quantifies a missing forward, preserves market inputs and is not added twice',()=>{
 const b=forecastBundle(),c=createStarterFeatureIndex(b.matches).features(b.target,{playerScenarios:{111:'out'}});
 const model={kind:'poisson-gbdt',learningRate:.4,trees:[{feature:102,threshold:.2,left:{value:-.5},right:{value:.5}}],shape:null,
  gbdt:{targetInput:{homeBase:1,awayBase:1,homeFeatures:[...Array(22).fill(0),...c.home,...Array(120).fill(.3)],awayFeatures:[...Array(22).fill(0),...c.away,...Array(120).fill(.3)]}}};
 optimizeAbsenceReplacements(model,model.gbdt.targetInput,c);const before=JSON.stringify(c),report=playerContributionReport(model,c),p=report.rows.find(p=>p.playerId==='111');
 assert.equal(p.supported,true);assert.ok(p.ownGoalContribution>0);assert.ok(report.absenceImpact.home<0);assert.equal(JSON.stringify(c),before);
 const current={home:c.teams.home.profiles,away:c.teams.away.profiles};assert.deepEqual(lineupMeans(model,model.gbdt.targetInput,current),report.selectedMeans);
 const marketModel={...model,trees:[{feature:123,threshold:.1,left:{value:-.5},right:{value:.5}}]};
 assert.ok(lineupMeans(marketModel,model.gbdt.targetInput,current).home>1,'market tail survives lineup rebuilding');
});
test('simulation defaults are exactly the previous XI and use the same missing-player replacement policy',()=>{
 const b=forecastBundle();b.targetLineup.home.starters[10]={id:888,name:'Target XI',position:3};
 const a=analyze(b,{formCount:5}),prepared=prepareSimulation(b,a);assert.equal(prepared.lineupType,'previousMatchXI');
 assert.ok(prepared.teams[0].defaultLineup.includes('111'));assert.ok(!prepared.teams[0].defaultLineup.includes('888'));assert.equal(prepared.teams[0].previousMatch.id,'15');
 const injured=prepareSimulation(b,a,{playerScenarios:{111:'out'}});assert.ok(injured.teams[0].defaultLineup.includes('112'));assert.ok(!injured.teams[0].defaultLineup.includes('111'));
});
