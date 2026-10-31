import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {analyze} from '../dist/model.mjs';
import {prepareSimulation,runSimulation} from '../dist/player-simulation.mjs';
const id=process.argv[2]??'5904782',mode=process.argv[3]??'auto';
const b=JSON.parse(await readFile(new URL(`../dist/data/matches/${id}.json`,import.meta.url),'utf8'));
b.trainingData=JSON.parse(await readFile(new URL('../dist/data/training.json',import.meta.url),'utf8'));
const result=analyze(b,{formCount:10,playerGraphMode:mode}),input=prepareSimulation(b,result),simulation=runSimulation(input,{iterations:10000,seed:12345});
assert.deepEqual(input.baseMeans,result.baselinePrediction.poissonMeans);
assert.equal(input.training.playerGraph.active,result.training.playerGraph.active);
assert.ok(Date.parse(result.training.playerGraph.targetEvidence.maxAvailableAt)<Date.parse(result.target.date));
assert.ok(!result.training.playerGraph.targetEvidence.matchIds.includes(id));
const first=b.trainingData.rows[0],changed={...b,actual:{homeScore:29,awayScore:28},
 trainingData:{...b.trainingData,id:'target-label-injected',rows:[...b.trainingData.rows,{...first,id,homeScore:29,awayScore:28}]}};
const other=analyze(changed,{formCount:10,playerGraphMode:mode});
assert.deepEqual(result.prediction,other.prediction);assert.deepEqual(input.baseMeans,prepareSimulation(changed,other).baseMeans);
assert.ok(result.prediction.tailMass>=0&&result.prediction.tailMass<1e-4);
const g=result.training.playerGraph;
const summary={id,mode,version:result.version,graphActive:g.active,graphStatus:g.status,reason:g.reason,
 scope:result.training.scope,counts:result.training.counts,modelBaseMeans:input.baseMeans,finalMeans:result.prediction.expectedGoals,
 forecast:result.prediction.mostLikelyScore,simulation:{means:simulation.means,top:simulation.topScores[0],probabilities:simulation.probabilities},
 graph:g,scoreGridMaximum:result.prediction.scoreGridMaximum,tailMass:result.prediction.tailMass};
await writeFile(new URL(`../data/player-graph-prediction-${id}-${mode}.json`,import.meta.url),JSON.stringify(summary,null,2));
console.log(JSON.stringify({id,mode,active:g.active,status:g.status,forecast:summary.forecast,simulation:summary.simulation,
 test:g.comparison.test,checks:'passed'}));
