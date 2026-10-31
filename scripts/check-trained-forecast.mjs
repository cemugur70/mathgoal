import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {analyze} from '../dist/model.mjs';
import {prepareSimulation,runSimulation} from '../dist/player-simulation.mjs';
const id=process.argv[2]??'5868102';
const b=JSON.parse(await readFile(new URL(`../dist/data/matches/${id}.json`,import.meta.url),'utf8'));
const trainingData=JSON.parse(await readFile(new URL('../dist/data/training.json',import.meta.url),'utf8'));
b.trainingData=trainingData;
const started=performance.now(),old=analyze(b,{formCount:10,trainingLayer:false}),result=analyze(b,{formCount:10});
const input=prepareSimulation(b,result),sim=runSimulation(input,{iterations:10000,seed:12345});
assert.deepEqual(input.baseMeans,result.baselinePrediction.poissonMeans);
assert.equal(input.goalShape,result.prediction.goalShape);
assert.ok(result.training.counts.eligible>120);
assert.ok(result.training.counts.excluded['target-match']>=1);
// Changing the held target's label cannot alter training or either prediction.
const changed={...b,actual:{homeScore:29,awayScore:28},target:{...b.target,homeScore:29,awayScore:28},
 trainingData:{...trainingData,rows:trainingData.rows.map(r=>r.id===id?{...r,homeScore:29,awayScore:28}:r)}};
const other=analyze(changed,{formCount:10});
assert.deepEqual(result.training.coefficients,other.training.coefficients);
assert.deepEqual(result.prediction,other.prediction);
assert.deepEqual(input.baseMeans,prepareSimulation(changed,other).baseMeans);
const actualChance=r=>r.prediction?.heatmap.find(c=>c.home===b.actual?.homeScore&&c.away===b.actual?.awayScore)?.probability;
const summary={id,elapsedMs:performance.now()-started,actual:b.actual,old:{means:old.prediction.expectedGoals,top:old.prediction.mostLikelyScore,actualProbability:actualChance(old)},
 trained:{means:result.prediction.expectedGoals,top:result.prediction.mostLikelyScore,actualProbability:actualChance(result)},training:result.training,
 simulation:{means:sim.means,top:sim.topScores[0],probabilities:sim.probabilities,goalShape:sim.goalShape}};
await writeFile(new URL(`../data/trained-forecast-${id}.json`,import.meta.url),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
