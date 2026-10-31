import test from 'node:test';
import assert from 'node:assert/strict';
import {playerStatMeasure} from '../dist/player-stat-values.mjs';
test('fractionWithPercentage uses the count numerator for per90 and paired attempts for sum',()=>{
 const row={raw:true,minutes:45,stats:{accurate_passes:23},statTotals:{accurate_passes:30}},meta={type:'fractionWithPercentage'};
 assert.equal(playerStatMeasure(row,'accurate_passes',{meta,mode:'per90'}).value,46);
 assert.equal(playerStatMeasure(row,'accurate_passes',{meta}).nonCount,false);
 assert.deepEqual(playerStatMeasure(row,'accurate_passes',{meta}).paired,{numerator:23,total:30,games:1,coverage:1});
});
test('total minutes remain total minutes rather than a duration-weighted average',()=>{
 const row={metrics:{minutes_played:{sum:580,average:72.5,minuteWeightedAverage:84.162,per90:null}}};
 assert.equal(playerStatMeasure(row,'minutes_played').value,580);
 assert.equal(playerStatMeasure(row,'minutes_played',{mode:'average'}).value,72.5);
 assert.equal(playerStatMeasure(row,'minutes_played',{mode:'per90'}).value,580);
});
test('paired fraction scope is separate from the full observed count total',()=>{
 const row={playerId:'1',metrics:{accurate_passes:{sum:90,average:45,minuteWeightedAverage:44,per90:54,type:'fractionWithPercentage'}}};
 const pair={numerator:30,total:40,games:1,coverage:.5};
 const measured=playerStatMeasure(row,'accurate_passes',{fractionEvidence:()=>pair});
 assert.equal(measured.value,90);assert.equal(measured.paired.coverage,.5);
 assert.equal(measured.paired.numerator,30);assert.equal(measured.paired.total,40);
 assert.equal(playerStatMeasure(row,'accurate_passes',{mode:'per90'}).value,54);
});
test('ratings and percentages stay averages while unknowns, observed zeros and decimals remain distinct',()=>{
 const row={metrics:{rating_title:{sum:null,minuteWeightedAverage:7.62,average:7.5,per90:null},xg_and_xa:{sum:7.61,per90:1.18}}};
 assert.equal(playerStatMeasure(row,'rating_title').value,7.62);
 assert.equal(playerStatMeasure(row,'rating_title',{mode:'per90'}).value,7.62);
 assert.equal(playerStatMeasure(row,'xg_and_xa').value,7.61);
 assert.equal(playerStatMeasure({raw:true,stats:{goals:0}},'goals').value,0);
 assert.equal(playerStatMeasure({raw:true,stats:{goals:null}},'goals').value,null);
 assert.equal(playerStatMeasure({raw:true,stats:{}},'goals').value,null);
 assert.ok(Math.abs(playerStatMeasure({raw:true,minutes:60,stats:{goals_prevented:-.4}},'goals_prevented',{mode:'per90'}).value+.6)<1e-12);
});
