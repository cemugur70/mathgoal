import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {GBDT_FEATURE_NAMES,BASE_GBDT_FEATURE_NAMES} from '../dist/gbdt-training.mjs';
import {analyze} from '../dist/model.mjs';
import {prepareSimulation,runSimulation,gbdtPhaseMeans} from '../dist/player-simulation.mjs';
const id=process.argv[2]??'5749726',count=Number(process.argv[3]??10);
const bundle=JSON.parse(await readFile(new URL(`../dist/data/matches/${id}.json`,import.meta.url)));
bundle.trainingData=JSON.parse(await readFile(new URL('../dist/data/training.json',import.meta.url)));
const started=performance.now(),result=analyze(bundle,{formCount:count,playerGraphMode:'gbdt'}),t=result.training;
assert.equal(t.kind,'poisson-gbdt');assert.equal(t.gbdt.active,true);assert.equal(t.gbdt.alignedCohorts,true);
assert.equal(t.featureNames.length,t.training.networkLayer?GBDT_FEATURE_NAMES.length:BASE_GBDT_FEATURE_NAMES.length);assert.equal(t.learningRate,t.report.selection.params.learningRate);
assert.ok(!t.gbdt.starters.evidence.matchIds.includes(id));assert.ok(Date.parse(t.gbdt.starters.evidence.maxAvailableAt)<Date.parse(result.target.date));
const input=prepareSimulation(bundle,result),original=t.gbdt.starters.teams;
assert.deepEqual(input.baseMeans,result.baselinePrediction.poissonMeans);
// An unchanged inferred XI gives exactly the projected GBDT mean before scenario changes.
for(const team of input.teams)for(const p of original[team.side].profiles)input.gbdtScenario.profiles[team.id][p.id]=p;
const referenceLineups=Object.fromEntries(input.teams.map(team=>[team.id,original[team.side].profiles.map(p=>p.id)]));
assert.deepEqual(gbdtPhaseMeans(input,referenceLineups),input.baseMeans);
const simulation=runSimulation(input,{iterations:10000,seed:12345});
const changed={...bundle,actual:{homeScore:29,awayScore:28},trainingData:{...bundle.trainingData,rows:[...bundle.trainingData.rows,{...bundle.trainingData.rows[0],id,formCount:count,homeScore:29,awayScore:28}]}};
const other=analyze(changed,{formCount:count,playerGraphMode:'gbdt'});assert.deepEqual(other.prediction,result.prediction);
const automatic=analyze(bundle,{formCount:count,playerGraphMode:'auto'}),disabled=analyze(bundle,{formCount:count,playerGraphMode:'gbdt',playerLayer:false});
assert.equal(disabled.training.gbdt.active,false);
const summary={id,count,elapsedMs:Math.round(performance.now()-started),checks:'passed',kind:t.kind,experimental:t.gbdt.experimental,
 eligible:t.counts.eligible,testMatches:t.counts.test,treeCount:t.trees.length,featureCount:t.featureNames.length,shape:t.shape,
 forecast:result.prediction.topScores[0],means:result.baselinePrediction.poissonMeans,
 simulation:{means:simulation.means,forecast:simulation.topScores[0]},comparison:t.gbdt.comparison,
 auto:{gbdtActive:automatic.training.gbdt.active,graphActive:automatic.training.playerGraph?.active??false},
 starters:Object.fromEntries(['home','away'].map(s=>[s,{count:original[s].profiles.length,type:original[s].type,withHistory:original[s].withHistory}]))};
await writeFile(new URL(`../data/gbdt-prediction-${id}-${count}.json`,import.meta.url),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
