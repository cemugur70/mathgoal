import test from 'node:test';
import assert from 'node:assert/strict';
import {outcomeFeatures} from '../dist/outcome-training.mjs';
import {PLAYER_GRAPH_FEATURE_NAMES} from '../dist/player-graph-features.mjs';
import {trainPlayerGraphModels,selectPlayerGraphModel,GRAPH_OUTCOME_FEATURE_NAMES} from '../dist/player-graph-training.mjs';
import {analyze} from '../dist/model.mjs';
import {prepareSimulation} from '../dist/player-simulation.mjs';
import {forecastBundle} from './helpers.mjs';
const DAY=86400000,cutoff='2026-11-01T18:00:00Z';
function fixture(){
 const p={gf:2,xg:2,ga:2,xga:2,points:1,shots:10,shotsOnTarget:3,historyCount:10};
 return Array.from({length:240},(_,n)=>{const date=Date.UTC(2024,0,1+n),high=n%3!==0,g=PLAYER_GRAPH_FEATURE_NAMES.map(name=>name==='poolXg'?Number(high):name==='historyFraction'?1:0);
  return {id:'past-'+n,date:new Date(date).toISOString(),availableAt:new Date(date+3*3600000).toISOString(),leagueId:71,formCount:10,
   homeBase:2,awayBase:2.5,homeFeatures:outcomeFeatures({home:p,away:p},null,'home',2),awayFeatures:outcomeFeatures({home:p,away:p},null,'away',2.5),
   homeScore:n%3===0?0:n%3===1?3:4,awayScore:2,featureCutoff:new Date(date).toISOString(),featureMaxAvailableAt:new Date(date-2*DAY).toISOString(),
   graphFeatureMaxAvailableAt:new Date(date-DAY).toISOString(),homeGraphFeatures:g,awayGraphFeatures:g};});
}
const opts={cutoff,targetId:'target',formCount:10,leagueId:71};
function context(){return {home:PLAYER_GRAPH_FEATURE_NAMES.map(n=>n==='missingFraction'?0:1),away:PLAYER_GRAPH_FEATURE_NAMES.map(n=>n==='missingFraction'?0:1),
 coverage:{home:{historyGames:5,minuteCoverage:1,missingFraction:0},away:{historyGames:5,minuteCoverage:1,missingFraction:0}},evidence:{maxAvailableAt:'2026-10-31T00:00:00Z'}};}
test('graph signal is learned on aligned chronological cohorts and test labels never select the model',()=>{
 const models=trainPlayerGraphModels(fixture(),opts);
 assert.equal(models.accepted,true);assert.equal(models.comparison.alignedCohorts,true);
 assert.equal(models.comparison.testUsedForSelection,false);
 assert.equal(models.candidate.coefficients.length,GRAPH_OUTCOME_FEATURE_NAMES.length);
 assert.ok(models.comparison.validationNllGain>=.003);
 assert.ok(models.comparison.validation.graph.exactScoreAccuracy>=models.comparison.validation.baseline.exactScoreAccuracy);
 const changed=fixture().map(row=>Date.parse(row.date)>=Date.parse(models.candidate.ranges.test.firstDate)?{...row,homeScore:30,awayScore:29}:row);
 const other=trainPlayerGraphModels(changed,opts);
 assert.equal(other.accepted,models.accepted);
 assert.equal(other.candidate.report.selection.regularization,models.candidate.report.selection.regularization);
 assert.deepEqual(other.candidate.report.lockedCoefficients,models.candidate.report.lockedCoefficients);
 assert.notDeepEqual(other.candidate.coefficients,models.candidate.coefficients,'final refit may use past held-out labels only after the report was frozen');
});
test('target labels and unverifiable future graph features cannot change learned predictions',()=>{
 const rows=fixture(),target={...rows[0],id:'target',homeScore:99,awayScore:98};
 const original=trainPlayerGraphModels(rows,opts),withTarget=trainPlayerGraphModels([...rows,target],opts);
 assert.deepEqual(original.candidate.coefficients,withTarget.candidate.coefficients);
 const bad=rows.map(row=>({...row,graphFeatureMaxAvailableAt:new Date(Date.parse(row.date)+DAY).toISOString(),homeGraphFeatures:Array(12).fill(2),awayGraphFeatures:Array(12).fill(2)}));
 const neutral=rows.map(row=>({...row,graphFeatureMaxAvailableAt:null,homeGraphFeatures:Array(12).fill(-2),awayGraphFeatures:Array(12).fill(-2)}));
 assert.deepEqual(trainPlayerGraphModels(bad,opts).candidate.coefficients,trainPlayerGraphModels(neutral,opts).candidate.coefficients);
 assert.equal(trainPlayerGraphModels(bad,opts).accepted,false);
});
test('preview is explicit and cannot bypass target coverage, baseline mode or unavailable learning',()=>{
 const models=trainPlayerGraphModels(fixture(),opts),features=context();
 assert.equal(selectPlayerGraphModel(models,features).playerGraph.active,true);
 assert.equal(selectPlayerGraphModel(models,features,{mode:'baseline'}).playerGraph.active,false);
 features.coverage.home.historyGames=2;
 assert.equal(selectPlayerGraphModel(models,features,{mode:'graph'}).playerGraph.active,false);
 features.coverage.home.historyGames=5;
 const rejected={...models,accepted:false,reason:'Validation policy rejected'};
 assert.equal(selectPlayerGraphModel(rejected,features).playerGraph.active,false);
 const preview=selectPlayerGraphModel(rejected,features,{mode:'graph'});
 assert.equal(preview.playerGraph.active,true);assert.equal(preview.playerGraph.validated,false);assert.equal(preview.playerGraph.status,'experimental');
});
test('forecast and simulation use the same learned graph means without target outcome leakage',()=>{
 const b=forecastBundle(),rows=fixture();
 b.trainingData={schemaVersion:2,baseVersion:'network-v1.2.0',id:'graph-fixture',graphFeatureNames:PLAYER_GRAPH_FEATURE_NAMES,rows};
 const result=analyze(b,{formCount:10,playerGraphMode:'graph'}),input=prepareSimulation(b,result);
 assert.equal(result.training.playerGraph.active,true);
 assert.equal(result.training.featureNames.length,GRAPH_OUTCOME_FEATURE_NAMES.length);
 assert.deepEqual(input.baseMeans,result.baselinePrediction.poissonMeans);
 assert.equal(input.training.playerGraph.active,true);assert.equal(input.goalShape,result.baselinePrediction.goalShape);
 assert.ok(result.prediction.tailMass>=0&&result.prediction.tailMass<1e-5);
 const altered={...b,actual:{homeScore:29,awayScore:28},matches:[...b.matches,{...b.target,homeScore:29,awayScore:28,players:b.matches[0].players}],
  trainingData:{...b.trainingData,id:'target-mutated',rows:[...rows,{...rows[0],id:b.target.id,homeScore:29,awayScore:28}]}};
 const other=analyze(altered,{formCount:10,playerGraphMode:'graph'});
 assert.deepEqual(result.prediction,other.prediction);
 assert.deepEqual(input.baseMeans,prepareSimulation(altered,other).baseMeans);
});
