import test from 'node:test';import assert from 'node:assert/strict';
import {trainGbdtModel,predictGbdt,gbdtRow,selectGbdtModel,GBDT_FEATURE_NAMES} from '../dist/gbdt-training.mjs';
import {applyOutcomeModel} from '../dist/outcome-training.mjs';
import {STARTER_FEATURE_NAMES,createStarterFeatureIndex,starterVector,STARTER_CHANNELS} from '../dist/starter-features.mjs';
import {gbdtPhaseMeans} from '../dist/player-simulation.mjs';
const DAY=86400000,iso=t=>new Date(t).toISOString(),start=Date.UTC(2024,0,1),options={cutoff:'2026-01-01T00:00:00Z',targetId:'target',formCount:10,leagueId:1};
function rows(){return Array.from({length:240},(_,i)=>{const date=start+i*DAY,x=i%4<2?1:-1,z=i%2?1:-1;
 const v=STARTER_FEATURE_NAMES.map(()=>0);v[0]=x;v[2]=z;
 return {id:String(i),date:iso(date),availableAt:iso(date+10800000),featureCutoff:iso(date),featureMaxAvailableAt:iso(date-DAY),formCount:10,leagueId:1,
 homeBase:2,awayBase:2,homeFeatures:[1,1,Math.log(2),0,0,0,0,0,1,0],awayFeatures:[1,0,Math.log(2),0,0,0,0,0,1,0],
 homeScore:x>0&&z>0?4:1,awayScore:x>0&&z>0?4:1,homeGraphFeatures:Array(12).fill(0),awayGraphFeatures:Array(12).fill(0),graphFeatureMaxAvailableAt:iso(date-DAY),
 homeStarterFeatures:v,awayStarterFeatures:v,starterFeatureMaxAvailableAt:iso(date-DAY)};});}
test('GBDT learns a nonlinear player interaction, is deterministic, and shared inference uses the selected learning rate',()=>{
 const data=rows(),m=trainGbdtModel(data,options),repeat=trainGbdtModel(data,options);
 assert.equal(m.accepted,true);assert.deepEqual(m.trees,repeat.trees);assert.ok(m.report.validation.selected.pairedCountNll<m.report.validation.baseline.pairedCountNll);
 assert.equal(m.featureNames.length,GBDT_FEATURE_NAMES.length);assert.ok(m.trees.some(t=>t.left?.feature!=null||t.right?.feature!=null));
 const low=gbdtRow(data[0]),high=gbdtRow(data[1]);assert.ok(predictGbdt(m,2,high.homeFeatures)>predictGbdt(m,2,low.homeFeatures)+.5);
 const p=applyOutcomeModel(m,{homeBase:2,awayBase:2,homeFeatures:high.homeFeatures,awayFeatures:low.awayFeatures});
 assert.equal(p.used,true);assert.equal(p.home,predictGbdt(m,2,high.homeFeatures));assert.equal(p.away,predictGbdt(m,2,low.awayFeatures));
 assert.equal(m.learningRate,m.report.selection.params.learningRate);
 assert.ok(m.training.finalRefitIncludesTest);assert.equal(m.report.testUsedForSelection,false);
});
test('held-out test labels and target outcomes cannot select tree structure, hyperparameters or shape',()=>{
 const data=rows(),m=trainGbdtModel(data,options),testStart=Date.parse(m.ranges.test.firstDate);
 const changed=data.map(r=>Date.parse(r.date)>=testStart?{...r,homeScore:9,awayScore:8}:r);
 const next=trainGbdtModel(changed,options);assert.deepEqual(m.report.selection,next.report.selection);assert.deepEqual(m.report.lockedTrees,next.report.lockedTrees);assert.equal(m.report.lockedShape,next.report.lockedShape);
 const injected=trainGbdtModel([...data,{...data[0],id:'target',homeScore:99,awayScore:98}],options);
 assert.deepEqual(m.trees,injected.trees);assert.equal(injected.counts.excluded['target-match'],1);
 const reference={...m,report:{...m.report,validation:{selected:{...m.report.validation.selected,pairedCountNll:0,exactScoreAccuracy:1}}}};
 assert.equal(selectGbdtModel(m,reference,{mode:'auto'}).gbdt.active,false);assert.equal(selectGbdtModel(m,reference,{mode:'gbdt'}).gbdt.experimental,true);
});
test('unverified future XI features are neutralized and insufficient datasets cannot activate a tree model',()=>{
 const data=rows(),r=data[0];const a=gbdtRow({...r,starterFeatureMaxAvailableAt:r.date,homeStarterFeatures:Array(101).fill(3)}),b=gbdtRow({...r,starterFeatureMaxAvailableAt:null});assert.deepEqual(a.homeFeatures,b.homeFeatures);
 const m=trainGbdtModel(data.slice(0,80),options);assert.equal(m.accepted,false);assert.equal(selectGbdtModel(m,{report:null},{mode:'gbdt'}).gbdt.active,false);
 const bad=trainGbdtModel([...data,{...r,id:'bad',homeFeatures:null}],options);assert.equal(bad.counts.excluded['invalid-model-observation'],1);
});
function fixture(){const target={id:'target',date:iso(start+20*DAY),leagueId:1,home:{id:1,name:'A'},away:{id:2,name:'B'},started:false,finished:false};
 const matches=Array.from({length:8},(_,n)=>({id:'m'+n,date:iso(start+n*DAY),leagueId:1,home:target.home,away:target.away,homeScore:1,awayScore:0,finished:true,
 players:[1,2].flatMap(teamId=>Array.from({length:11},(_,i)=>({id:String(teamId*100+i),name:'P'+teamId+i,teamId,position:i===0?0:i<5?1:i<9?2:3,starter:true,minutes:90,stats:{goals:0,expected_goals:i/10,accurate_passes:20,expected_assists:.1,'matchstats.headers.tackles':2,interceptions:1,duel_won:4,saves:i===0?3:undefined}})))}));return {target,matches};}
test('XI detail builder uses only prior eligible appearances, exposes missing vs zero, and protects actual post-match lineups',()=>{
 const {target,matches}=fixture(),idx=createStarterFeatureIndex(matches),first=idx.features(target);
 assert.equal(first.teams.home.profiles.length,11);assert.equal(first.home.length,STARTER_FEATURE_NAMES.length);assert.equal(first.teams.home.type,'lastStarting11');
 const p=first.teams.home.profiles[1];assert.equal(p.metrics.goals.per90,0);assert.equal(p.metrics.xgot.per90,null);
 const leaked={...matches[0],id:'target',date:target.date,players:matches[0].players.map(p=>({...p,stats:{goals:99,expected_goals:99}}))};
 const future={...leaked,id:'future',date:iso(start+30*DAY)};
 assert.deepEqual(first,createStarterFeatureIndex([...matches,leaked,future]).features(target));
 const lineup={matchId:'target',eligibleForModel:true,type:'confirmed',observedAt:iso(start+19*DAY),home:{starters:matches[0].players.filter(p=>p.teamId===1)},away:{starters:matches[0].players.filter(p=>p.teamId===2)}};
 assert.equal(idx.features(target,{lineup}).teams.home.type,'lastStarting11');
 assert.equal(idx.features({...target,finished:true},{lineup}).teams.home.type,'lastStarting11');
 assert.equal(idx.features(target,{lineup:{...lineup,observedAt:iso(start+21*DAY)}}).teams.home.type,'lastStarting11');
 assert.ok(Date.parse(first.evidence.maxAvailableAt)<Date.parse(target.date));assert.ok(!first.evidence.matchIds.includes('target'));
});
test('simulation reevaluates the same trees for selected on-pitch players without a second heuristic player factor',()=>{
 const profile=(id,attack)=>({id,position:3,minutes:900,channels:Object.fromEntries(STARTER_CHANNELS.map(c=>[c,c==='attack'?attack:0])),missing:Object.fromEntries(STARTER_CHANNELS.map(c=>[c,0]))});
 const h=Array.from({length:11},(_,i)=>profile('h'+i,.1)),a=Array.from({length:11},(_,i)=>profile('a'+i,.1)),replacement={...profile('strong',2),minutes:901};
 const original=[...Array(22).fill(0),...starterVector(h,a,1)],model={learningRate:.1,trees:[{feature:22,threshold:1,left:{value:-1},right:{value:1}}]};
 const input={baseMeans:{home:1,away:1},teams:[{id:'H',side:'home'},{id:'A',side:'away'}],gbdtScenario:{model,reference:{homeBase:1,awayBase:1,homeFeatures:original,awayFeatures:original},profiles:{H:Object.fromEntries([...h,replacement].map(p=>[p.id,p])),A:Object.fromEntries(a.map(p=>[p.id,p]))}}};
 const current={H:h.map(p=>p.id),A:a.map(p=>p.id)};assert.deepEqual(gbdtPhaseMeans(input,current),{home:1,away:1});
 current.H[0]='strong';assert.ok(gbdtPhaseMeans(input,current).home>1);assert.equal(gbdtPhaseMeans(input,current).away,1);
});
