import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from '../dist/model.mjs';
import {prepareSimulation,runSimulation} from '../dist/player-simulation.mjs';
import {outcomeFeatures} from '../dist/outcome-training.mjs';
import {forecastBundle} from './helpers.mjs';
function data(){
 const features=side=>outcomeFeatures({home:{historyCount:10},away:{historyCount:10}},null,side,1);
 return {schemaVersion:1,baseVersion:'network-v1.2.0',id:'fixture-v1',rows:Array.from({length:240},(_,n)=>{
  const time=Date.UTC(2024,0,1+n);return {id:`past-${n}`,date:new Date(time).toISOString(),availableAt:new Date(time+3*3600000).toISOString(),
   featureCutoff:new Date(time).toISOString(),featureMaxAvailableAt:new Date(time-86400000).toISOString(),leagueId:71,formCount:10,
   homeBase:1,awayBase:1,homeFeatures:features('home'),awayFeatures:features('away'),homeScore:2+n%2,awayScore:1+n%2};
 })};
}
test('projection and simulation share learned means, distribution and strict target exclusion',()=>{
 const b=forecastBundle();b.trainingData=data();
 b.trainingData.rows.push({...b.trainingData.rows[0],id:b.target.id,homeScore:29,awayScore:28});
 const result=analyze(b,{formCount:10}),prepared=prepareSimulation(b,result);
 assert.equal(result.training.accepted,true);
 assert.ok(result.training.counts.excluded['target-match']>0);
 assert.notDeepEqual(result.baselinePrediction.poissonMeans,result.untrainedMeans);
 assert.deepEqual(prepared.baseMeans,result.baselinePrediction.poissonMeans);
 assert.equal(prepared.goalShape,result.baselinePrediction.goalShape);
 const changed={...b,actual:{homeScore:27,awayScore:26},trainingData:{...b.trainingData,id:'changed-target',rows:b.trainingData.rows.map(r=>r.id===b.target.id?{...r,homeScore:27,awayScore:26}:r)}};
 assert.deepEqual(result.prediction,analyze(changed,{formCount:10}).prediction);
 const off=analyze(b,{formCount:10,trainingLayer:false});
 assert.deepEqual(off.baselinePrediction.poissonMeans,off.untrainedMeans);
});
test('negative-binomial simulation preserves trained mean and overdispersion across substitution phases',()=>{
 const b=forecastBundle(),input=prepareSimulation(b,analyze(b,{formCount:10}));
 input.baseMeans={home:1.5,away:1.2};input.goalShape=2;
 for(const team of input.teams){team.baseline.coverage={};for(const p of team.players)p.strength={};}
 const r=runSimulation(input,{iterations:30000,seed:100});
 const second=r.histogram.reduce((sum,row)=>sum+row.home*row.home*row.probability,0);
 const variance=second-r.means.home*r.means.home;
 assert.ok(Math.abs(r.means.home-1.5)<.045);
 assert.ok(Math.abs(r.means.away-1.2)<.045);
 assert.ok(Math.abs(variance-(1.5+1.5*1.5/2))<.12);
 assert.equal(r.histogram.reduce((sum,row)=>sum+row.count,0),30000);
 assert.deepEqual(runSimulation(input,{iterations:50,seed:2}),runSimulation(input,{iterations:50,seed:2}));
 assert.throws(()=>runSimulation({...input,goalShape:-2},{iterations:1}),/dağılım/);
});
